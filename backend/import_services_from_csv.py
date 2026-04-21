import asyncio
import csv
import hashlib
import re
import uuid
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import select

from database_sql import AsyncSessionLocal
from models_academy_processes import AcademyProcessModelSQL
from models_services import ServicoSQL
from models_sql import ClientSQL, UserSQL


def _normalize_text(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
    )


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _normalize_text(value)).strip("-")


def _parse_csv_rows(path: str):
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"CSV não encontrado: {path}")

    for encoding in ("utf-8-sig", "latin-1"):
        try:
            with open(file_path, "r", encoding=encoding, newline="") as handler:
                return list(csv.DictReader(handler))
        except UnicodeDecodeError:
            continue
    return []


def _parse_date(value: str):
    raw = str(value or "").strip()
    if not raw:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _sanitize_cnpj(seed: str) -> str:
    digits = re.sub(r"\D", "", str(seed or ""))
    if len(digits) >= 14:
        return digits[:14]
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    synthetic = "".join(str(int(ch, 16) % 10) for ch in digest)[:14]
    return synthetic or "00000000000000"


def _map_setor(value: str) -> str:
    raw = _normalize_text(value)
    if "trabalh" in raw:
        return "Trabalhista"
    if "fisc" in raw:
        return "Fiscal"
    if "finan" in raw:
        return "Financeiro"
    if "comer" in raw:
        return "Comercial"
    if "contad" in raw or "societ" in raw:
        return "Contadores"
    return "Atendimento"


def _map_prioridade(value: str) -> str:
    raw = _normalize_text(value)
    if "urgente" in raw:
        return "urgente"
    if "alta" in raw:
        return "alta"
    if "baixa" in raw:
        return "baixa"
    return "media"


def _map_canal(value: str) -> str:
    raw = _normalize_text(value)
    if "whats" in raw or "celular" in raw:
        return "whatsapp"
    if "email" in raw:
        return "email"
    if "presencial" in raw or "visita" in raw:
        return "presencial"
    if "plataforma" in raw:
        return "portal"
    return "portal"


async def _get_next_service_sequence(session, year: int) -> int:
    result = await session.execute(
        select(ServicoSQL.numero).where(ServicoSQL.numero.like(f"SRV-{year}-%"))
    )
    max_seq = 0
    for (numero,) in result.all():
        parts = str(numero or "").split("-")
        if len(parts) != 3:
            continue
        try:
            seq = int(parts[-1])
            max_seq = max(max_seq, seq)
        except ValueError:
            continue
    return max_seq + 1


async def import_services_models_csv(csv_path: str):
    rows = _parse_csv_rows(csv_path)
    if not rows:
        return {"models_created": 0, "services_created": 0, "services_skipped": 0, "clients_created": 0}

    now = datetime.utcnow()
    services_created = 0
    services_skipped = 0
    models_created = 0
    clients_created = 0

    async with AsyncSessionLocal() as session:
        users_result = await session.execute(select(UserSQL))
        users = users_result.scalars().all()
        users_by_name = {_normalize_text(user.name): user for user in users if user.name}
        users_by_email = {_normalize_text(user.email): user for user in users if user.email}
        fallback_user = next((u for u in users if u.role == "admin"), users[0] if users else None)
        if fallback_user is None:
            raise RuntimeError("Nenhum usuário encontrado para registrar serviços importados.")

        clients_result = await session.execute(select(ClientSQL))
        clients = clients_result.scalars().all()
        clients_by_name = {_normalize_text(client.nome_empresa): client for client in clients if client.nome_empresa}

        models_result = await session.execute(select(AcademyProcessModelSQL))
        existing_models = models_result.scalars().all()
        model_by_name = {_normalize_text(model.nome): model for model in existing_models if model.nome}

        existing_services_result = await session.execute(select(ServicoSQL))
        existing_services = existing_services_result.scalars().all()
        existing_signatures = {
            (
                _normalize_text(item.empresa_nome),
                _normalize_text(item.tipo_servico),
                _normalize_text(item.descricao),
                str(item.data_solicitacao or ""),
            )
            for item in existing_services
        }

        year = datetime.utcnow().year
        sequence = await _get_next_service_sequence(session, year)

        for row in rows:
            nome_empresa = str(row.get("nome_empresa") or "").strip()
            nome_servico = str(row.get("nome_servico") or "").strip()
            descricao = str(row.get("descricao") or "").strip()
            quem_incluiu = str(row.get("quem_incluiu") or "").strip()
            setor = _map_setor(row.get("setor_executa") or "")
            urgencia = _map_prioridade(row.get("urgencia") or "")
            canal_raw = str(row.get("canal_atendimento") or "").strip()
            canal = _map_canal(canal_raw)
            cidade = str(row.get("cidade_execucao") or "").strip() or "Jacobina"
            data_inicio_dt = _parse_date(row.get("data_inicio") or "")
            data_solicitacao = (data_inicio_dt.date() if data_inicio_dt else date.today())

            if not nome_empresa or not nome_servico:
                services_skipped += 1
                continue

            client = clients_by_name.get(_normalize_text(nome_empresa))
            if client is None:
                cnpj_seed = f"{nome_empresa}-{cidade}"
                client = ClientSQL(
                    id=str(uuid.uuid4()),
                    nome_empresa=nome_empresa,
                    nome_fantasia=nome_empresa,
                    status_empresa="ativa",
                    cidade_atendimento=cidade,
                    cnpj=_sanitize_cnpj(cnpj_seed),
                    tipo_regime="simples_nacional",
                    tipo_empresa="matriz",
                    forma_envio="email",
                    created_at=now,
                    updated_at=now,
                )
                session.add(client)
                clients_by_name[_normalize_text(nome_empresa)] = client
                clients_created += 1
                await session.flush()

            model = model_by_name.get(_normalize_text(nome_servico))
            if model is None:
                model = AcademyProcessModelSQL(
                    id=str(uuid.uuid4()),
                    nome=nome_servico,
                    descricao=f"Modelo importado automaticamente para {nome_servico}.",
                    setor_destino=setor,
                    regimes_config="{}",
                    clientes_excecoes_config="{}",
                    prazo_config="{}",
                    recorrencia_config="{}",
                    etapas=(
                        '[{"id":"step-1","nome":"Execução","setorResponsavel":"'
                        + setor
                        + '","tarefas":[{"id":"task-1","descricao":"'
                        + (descricao or f"Executar serviço: {nome_servico}")
                        + '"}]}]'
                    ),
                    metadata_json='{"source":"cadastros_servicos_resumido.csv","manual_auto":true}',
                    criado_por_id=fallback_user.id,
                    criado_por_nome=fallback_user.name,
                    created_at=now,
                    updated_at=now,
                )
                session.add(model)
                model_by_name[_normalize_text(nome_servico)] = model
                models_created += 1
                await session.flush()

            actor = users_by_name.get(_normalize_text(quem_incluiu)) or users_by_email.get(_normalize_text(quem_incluiu)) or fallback_user
            signature = (
                _normalize_text(nome_empresa),
                _normalize_text(nome_servico),
                _normalize_text(descricao),
                str(data_solicitacao),
            )
            if signature in existing_signatures:
                services_skipped += 1
                continue

            numero = f"SRV-{year}-{sequence:04d}"
            sequence += 1

            servico = ServicoSQL(
                id=str(uuid.uuid4()),
                numero=numero,
                empresa_id=client.id,
                empresa_nome=client.nome_empresa,
                tipo_servico=nome_servico,
                setor=setor,
                cidade=cidade,
                titulo=nome_servico,
                descricao=descricao or f"Serviço importado: {nome_servico}",
                status="pendente",
                prioridade=urgencia,
                solicitante_id=actor.id,
                solicitante_nome=actor.name,
                responsavel_id=actor.id,
                responsavel_nome=actor.name,
                data_solicitacao=data_solicitacao,
                data_inicio=data_inicio_dt or now,
                observacoes=f"Canal: {canal_raw or 'Não informado'} | Quem incluiu: {quem_incluiu or actor.name} | Modelo: {model.nome}",
                historico_alteracoes='[{"acao":"import_csv","origem":"cadastros_servicos_resumido.csv"}]',
                created_at=now,
                updated_at=now,
            )
            session.add(servico)
            existing_signatures.add(signature)
            services_created += 1

        await session.commit()

    return {
        "models_created": models_created,
        "services_created": services_created,
        "services_skipped": services_skipped,
        "clients_created": clients_created,
    }


if __name__ == "__main__":
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else str(Path.home() / "Downloads" / "cadastros_servicos_resumido.csv")
    result = asyncio.run(import_services_models_csv(csv_path))
    print(result)
