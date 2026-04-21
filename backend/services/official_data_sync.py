import csv
import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from sqlalchemy import text

from database_sql import AsyncSessionLocal
from models_sql import ClientSQL, FinancialClientSQL


def _normalize_text(value: Optional[str]) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
    )


def _read_csv_rows(path: str) -> List[Dict[str, str]]:
    file_path = Path(path)
    if not file_path.exists():
        return []
    for encoding in ("utf-8-sig", "latin-1"):
        try:
            with open(file_path, "r", encoding=encoding, newline="") as f:
                reader = csv.DictReader(f)
                return [dict(row) for row in reader]
        except UnicodeDecodeError:
            continue
    return []


def _safe_cnpj(cnpj: str, fallback_key: str) -> str:
    digits = re.sub(r"\D", "", str(cnpj or ""))
    if len(digits) >= 14:
        return digits[:14]
    hashed = hashlib.md5(fallback_key.encode("utf-8")).hexdigest()
    synthetic = "".join([str(int(ch, 16) % 10) for ch in hashed])[:14]
    return synthetic or "00000000000000"


def _parse_bool(value: Optional[str]) -> bool:
    raw = _normalize_text(value)
    return raw in {"1", "true", "sim", "yes", "y", "novo cliente"}


def _parse_money(value: Optional[str]) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    raw = raw.replace("R$", "").strip()
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    else:
        raw = raw.replace(" ", "")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _parse_int(value: Optional[str], default: int = 0) -> int:
    raw = re.sub(r"\D", "", str(value or ""))
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _map_regime(raw_tipo: Optional[str]) -> str:
    raw = _normalize_text(raw_tipo)
    if "mei" in raw:
        return "mei"
    if "lucro real" in raw:
        return "lucro_real"
    if "lucro presumido" in raw:
        return "lucro_presumido"
    if "simples" in raw:
        return "simples_nacional"
    return "simples_nacional"


def _map_status_empresa(raw_status: Optional[str]) -> str:
    raw = _normalize_text(raw_status)
    if "paralisada" in raw or "cancel" in raw or "inativa" in raw:
        return "inativa"
    if "suspensa" in raw:
        return "suspensa"
    return "ativa"


def _map_status_pagamento(raw_tipo: Optional[str]) -> str:
    raw = _normalize_text(raw_tipo)
    if "atraso" in raw:
        return "atrasado"
    return "em_dia"


def _map_tipo_empresa_financeiro(raw_tipo: Optional[str]) -> str:
    raw = _normalize_text(raw_tipo)
    if "mei" in raw:
        return "mei"
    if "lucro real" in raw:
        return "lucro_real"
    if "lucro presumido" in raw:
        return "lucro_presumido"
    if "simples" in raw:
        return "simples"
    return "outros"


def _to_title_or_default(value: Optional[str], default: str) -> str:
    raw = str(value or "").strip()
    return raw if raw else default


def _default_official_csv_paths() -> Tuple[str, str]:
    user_home = Path.home()
    downloads = user_home / "Downloads"
    clients_path = os.getenv("OFFICIAL_CLIENTS_CSV_PATH", str(downloads / "clientes_completo.csv"))
    financial_path = os.getenv("OFFICIAL_FINANCIAL_CSV_PATH", str(downloads / "financeiro_completo.csv"))
    return clients_path, financial_path


@dataclass
class ImportResult:
    clients_upserted: int = 0
    financial_upserted: int = 0
    financial_unmatched: int = 0


async def ensure_official_columns() -> None:
    async with AsyncSessionLocal() as session:
        conn = await session.connection()
        table_columns: Dict[str, List[str]] = {}
        for table_name in ("clients", "financial_clients"):
            rows = await conn.execute(text(f"PRAGMA table_info({table_name})"))
            table_columns[table_name] = [row[1] for row in rows.fetchall()]

        if "external_task_id" not in table_columns["clients"]:
            await conn.execute(text("ALTER TABLE clients ADD COLUMN external_task_id VARCHAR(64)"))
        if "official_locked" not in table_columns["clients"]:
            await conn.execute(text("ALTER TABLE clients ADD COLUMN official_locked BOOLEAN NOT NULL DEFAULT 0"))
        if "official_source" not in table_columns["clients"]:
            await conn.execute(text("ALTER TABLE clients ADD COLUMN official_source VARCHAR(50)"))
        if "official_imported_at" not in table_columns["clients"]:
            await conn.execute(text("ALTER TABLE clients ADD COLUMN official_imported_at DATETIME"))

        if "external_task_id" not in table_columns["financial_clients"]:
            await conn.execute(text("ALTER TABLE financial_clients ADD COLUMN external_task_id VARCHAR(64)"))
        if "official_locked" not in table_columns["financial_clients"]:
            await conn.execute(text("ALTER TABLE financial_clients ADD COLUMN official_locked BOOLEAN NOT NULL DEFAULT 0"))
        if "official_source" not in table_columns["financial_clients"]:
            await conn.execute(text("ALTER TABLE financial_clients ADD COLUMN official_source VARCHAR(50)"))
        if "official_imported_at" not in table_columns["financial_clients"]:
            await conn.execute(text("ALTER TABLE financial_clients ADD COLUMN official_imported_at DATETIME"))
        await session.commit()


async def import_official_csv_data(
    clients_csv_path: Optional[str] = None,
    financial_csv_path: Optional[str] = None,
) -> Dict[str, int]:
    await ensure_official_columns()
    default_clients_path, default_financial_path = _default_official_csv_paths()
    clients_path = clients_csv_path or default_clients_path
    financial_path = financial_csv_path or default_financial_path

    client_rows = _read_csv_rows(clients_path)
    financial_rows = _read_csv_rows(financial_path)
    result = ImportResult()

    if not client_rows and not financial_rows:
        return {
            "clients_upserted": 0,
            "financial_upserted": 0,
            "financial_unmatched": 0,
        }

    now = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        # Upsert official clients
        task_to_client: Dict[str, ClientSQL] = {}
        name_to_client: Dict[str, ClientSQL] = {}
        cnpj_to_client: Dict[str, ClientSQL] = {}
        seen_clients_by_task: Dict[str, ClientSQL] = {}
        seen_clients_by_cnpj: Dict[str, ClientSQL] = {}

        for row in client_rows:
            external_task_id = str(row.get("IdTarefa") or "").strip()
            nome_empresa = _to_title_or_default(row.get("Empresa"), "Empresa sem nome")
            cnpj = _safe_cnpj(row.get("CNPJ"), external_task_id or nome_empresa)
            cidade = _to_title_or_default(row.get("Cidade"), "Jacobina")
            cidade_emp = _to_title_or_default(row.get("CidadeEmp"), cidade)
            status_empresa = _map_status_empresa(row.get("Status"))
            tipo_regime = _map_regime(row.get("Tipo"))
            tipo_empresa = "filial" if _normalize_text(row.get("TipoEmpresa")) == "filial" else "matriz"

            existing = None
            if external_task_id and external_task_id in seen_clients_by_task:
                existing = seen_clients_by_task[external_task_id]

            if existing is None and cnpj in seen_clients_by_cnpj:
                existing = seen_clients_by_cnpj[cnpj]

            if existing is None and external_task_id:
                existing_query = await session.execute(
                    text("SELECT id FROM clients WHERE external_task_id = :external_task_id LIMIT 1"),
                    {"external_task_id": external_task_id},
                )
                row_existing = existing_query.first()
                if row_existing:
                    existing = await session.get(ClientSQL, row_existing[0])

            if existing is None:
                existing_query = await session.execute(
                    text("SELECT id FROM clients WHERE cnpj = :cnpj LIMIT 1"),
                    {"cnpj": cnpj},
                )
                row_existing = existing_query.first()
                if row_existing:
                    existing = await session.get(ClientSQL, row_existing[0])

            payload = dict(
                nome_empresa=nome_empresa,
                nome_fantasia=(row.get("NFantasia") or None),
                status_empresa=status_empresa,
                cidade_atendimento=cidade,
                telefone=(row.get("Telefone") or None),
                whatsapp=(row.get("Telefone") or None),
                email=(row.get("Email") or None),
                responsavel_empresa=(row.get("Responsavel") or None),
                cnpj=cnpj,
                codigo_iob=(row.get("Código IOB") or None),
                novo_cliente=_parse_bool(row.get("Novo")),
                tipo_empresa=tipo_empresa,
                tipo_regime=tipo_regime,
                endereco_logradouro=(row.get("Rua") or None),
                endereco_numero=(row.get("Numero") or None),
                endereco_complemento=(row.get("Complemento") or None),
                endereco_bairro=(row.get("Bairro") or None),
                endereco_distrito=None,
                endereco_cep=(row.get("Cep") or row.get("CEP") or None),
                endereco_cidade=cidade_emp,
                endereco_estado=(row.get("Estado") or "BA"),
                forma_envio=(_normalize_text(row.get("Envio")) or "email"),
                empresa_grupo=(row.get("Grupo") or None),
                external_task_id=external_task_id or None,
                official_locked=True,
                official_source="official_csv",
                official_imported_at=now,
                updated_at=now,
            )

            if isinstance(existing, ClientSQL):
                for key, value in payload.items():
                    setattr(existing, key, value)
            else:
                obj = ClientSQL(id=str(uuid.uuid4()), created_at=now, **payload)
                session.add(obj)
                existing = obj
            result.clients_upserted += 1

            if existing.external_task_id:
                task_to_client[str(existing.external_task_id)] = existing
                seen_clients_by_task[str(existing.external_task_id)] = existing
            name_to_client[_normalize_text(existing.nome_empresa)] = existing
            cnpj_to_client[re.sub(r"\D", "", existing.cnpj or "")] = existing
            seen_clients_by_cnpj[re.sub(r"\D", "", existing.cnpj or "")] = existing

        await session.flush()

        # Upsert official financial clients linked to clients
        for row in financial_rows:
            link_code = str(row.get("Empresa") or "").strip()
            external_task_id = str(row.get("IdTarefa") or "").strip()
            cnpj_raw = re.sub(r"\D", "", str(row.get("CNPJ_Financeiro") or ""))

            linked_client = None
            if link_code and link_code in task_to_client:
                linked_client = task_to_client[link_code]
            elif external_task_id and external_task_id in task_to_client:
                linked_client = task_to_client[external_task_id]
            elif cnpj_raw and cnpj_raw in cnpj_to_client:
                linked_client = cnpj_to_client[cnpj_raw]
            else:
                maybe_name = _normalize_text(row.get("Empresa"))
                if maybe_name in name_to_client:
                    linked_client = name_to_client[maybe_name]

            if not linked_client:
                result.financial_unmatched += 1
                continue

            existing_query = await session.execute(
                text("SELECT id FROM financial_clients WHERE empresa_id = :empresa_id LIMIT 1"),
                {"empresa_id": linked_client.id},
            )
            row_existing = existing_query.first()
            existing_fin = await session.get(FinancialClientSQL, row_existing[0]) if row_existing else None

            contas_pagamento = []
            cpag = str(row.get("CPagamento") or "").strip()
            if cpag:
                contas_pagamento.append(cpag)

            payload_fin = dict(
                empresa_id=linked_client.id,
                empresa=linked_client.nome_empresa,
                valor_com_desconto=_parse_money(row.get("ValorDesconto_Num") or row.get("ValorDesconto")),
                valor_boleto=_parse_money(row.get("ValorBoleto_Num") or row.get("ValorBoleto")),
                dia_vencimento=_parse_int(row.get("Vencimento_Dia") or row.get("Vencimento"), default=10),
                tipo_honorario="mensal",
                empresa_individual_grupo="grupo" if _normalize_text(row.get("EmpresaG")) == "grupo" else "individual",
                contas_pagamento=json.dumps(contas_pagamento, ensure_ascii=False),
                tipo_pagamento="recorrente",
                forma_pagamento_especial=(row.get("PagEspecial") or None),
                tipo_empresa=_map_tipo_empresa_financeiro(row.get("Tipo_Financeiro")),
                status_pagamento=_map_status_pagamento(row.get("Tipo_Financeiro")),
                observacoes=(row.get("Obs") or None),
                external_task_id=external_task_id or None,
                official_locked=True,
                official_source="official_csv",
                official_imported_at=now,
                updated_at=now,
            )

            if isinstance(existing_fin, FinancialClientSQL):
                for key, value in payload_fin.items():
                    setattr(existing_fin, key, value)
            else:
                obj_fin = FinancialClientSQL(id=str(uuid.uuid4()), created_at=now, **payload_fin)
                session.add(obj_fin)
            result.financial_upserted += 1

        await session.commit()

    return {
        "clients_upserted": result.clients_upserted,
        "financial_upserted": result.financial_upserted,
        "financial_unmatched": result.financial_unmatched,
    }
