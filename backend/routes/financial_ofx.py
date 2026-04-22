from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from auth import get_current_user
from database_compat import (
    get_aliases_cliente_collection,
    get_clients_collection,
    get_contas_receber_collection,
    get_import_batches_collection,
    get_import_rows_collection,
    get_import_settlement_links_collection,
)
from models.user import UserResponse

router = APIRouter(prefix="/financial/contas-receber", tags=["Financial OFX Reconciliation"])


def check_financial_access(user: UserResponse):
    if user.role != "admin" and "financeiro" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to financial module not allowed",
        )


class ManualLinkPayload(BaseModel):
    titulo_id: str
    confirmar_agora: bool = False


class IgnoreRowPayload(BaseModel):
    motivo: Optional[str] = None


class AliasPayload(BaseModel):
    cliente_id: str
    alias_nome: str
    origem: str = "manual"
    ativo: bool = True


class ReopenRowPayload(BaseModel):
    motivo: Optional[str] = None


class BulkIgnorePayload(BaseModel):
    status_alvo: str = "conflitos"
    motivo: Optional[str] = None


@dataclass
class ParsedOfxTx:
    trntype: str
    dtposted: date
    trnamt: float
    fitid: str
    memo: str
    bank_id: str
    acct_id: str
    org: str
    fid: str


IGNORE_KEYWORDS = (
    "tarifa",
    "debito em conta",
    "pagamento efetuado",
    "transferencia enviada",
    "pix enviado",
    "envio pix",
    "saque",
)

# Calibration (safety-first) for auto reconciliation
VALUE_EXACT_TOLERANCE = 0.01
VALUE_CORRECTED_TOLERANCE = 0.05
VALUE_APPROX_TOLERANCE = 0.50

MIN_SCORE_OPEN_CANDIDATE = 60.0
MIN_SCORE_PAID_CANDIDATE = 82.0
AUTO_SETTLEMENT_MIN_SCORE = 86.0
AUTO_SETTLEMENT_MIN_GAP = 12.0
CONFLICT_MIN_SCORE = 68.0


def normalize_text(value: str) -> str:
    return (
        str(value or "")
        .lower()
        .strip()
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("ã", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )


def parse_decimal(amount_raw: str) -> float:
    raw = str(amount_raw or "").strip()
    if not raw:
        return 0.0
    raw = raw.replace(",", ".")
    return float(raw)


def parse_ofx_date(value: str) -> date:
    clean = str(value or "").strip()
    # OFX: YYYYMMDDHHMMSS[...] -> usamos os 8 primeiros
    if len(clean) >= 8 and clean[:8].isdigit():
        return datetime.strptime(clean[:8], "%Y%m%d").date()
    raise ValueError(f"Invalid OFX date: {value}")


def extract_tag(block: str, tag: str) -> str:
    # suporta <TAG>valor até fim da linha ou próximo <
    pattern = re.compile(rf"<{re.escape(tag)}>([^\r\n<]+)", re.IGNORECASE)
    match = pattern.search(block)
    return (match.group(1).strip() if match else "")


def parse_ofx_transactions(content: str) -> Tuple[Dict[str, str], List[ParsedOfxTx]]:
    bank_context = {
        "org": extract_tag(content, "ORG"),
        "fid": extract_tag(content, "FID"),
        "bank_id": extract_tag(content, "BANKID"),
        "acct_id": extract_tag(content, "ACCTID"),
    }
    tx_blocks = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", content, flags=re.IGNORECASE | re.DOTALL)
    transactions: List[ParsedOfxTx] = []

    for block in tx_blocks:
        trntype = extract_tag(block, "TRNTYPE").upper()
        dtposted_raw = extract_tag(block, "DTPOSTED")
        trnamt_raw = extract_tag(block, "TRNAMT")
        fitid = extract_tag(block, "FITID") or str(uuid.uuid4())
        memo = extract_tag(block, "MEMO")
        if not dtposted_raw or not trnamt_raw:
            continue
        try:
            tx = ParsedOfxTx(
                trntype=trntype,
                dtposted=parse_ofx_date(dtposted_raw),
                trnamt=parse_decimal(trnamt_raw),
                fitid=fitid,
                memo=memo,
                bank_id=bank_context.get("bank_id", ""),
                acct_id=bank_context.get("acct_id", ""),
                org=bank_context.get("org", ""),
                fid=bank_context.get("fid", ""),
            )
            transactions.append(tx)
        except Exception:
            continue

    return bank_context, transactions


def parse_memo_fields(memo: str) -> Dict[str, str]:
    raw = str(memo or "").strip()
    parts = [p.strip() for p in raw.split("-") if p.strip()]
    cnpj_cpf_match = re.search(r"(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})", raw)
    documento = cnpj_cpf_match.group(1) if cnpj_cpf_match else ""

    descricao = parts[0] if parts else raw
    nome = ""
    for part in parts[1:]:
        if documento and documento in part:
            continue
        if re.search(r"\d{3,}", part):
            continue
        nome = part
        break

    return {
        "descricao_transacao_extraida": descricao,
        "nome_pagador_extraido": nome,
        "documento_pagador_extraido": documento,
    }


def calc_interest_penalty(base_value: float, due_date: Optional[date], payment_date: date) -> Tuple[int, float, float, float]:
    if not due_date or payment_date <= due_date:
        return 0, 0.0, 0.0, base_value
    dias = (payment_date - due_date).days
    multa = base_value * 0.02
    juros_diario = (base_value * 0.01) / 30
    juros = juros_diario * dias
    corrigido = base_value + multa + juros
    return dias, multa, juros, corrigido


def score_name_similarity(payer_name: str, candidates: List[str]) -> float:
    base = normalize_text(payer_name)
    if not base:
        return 0.0
    best = 0.0
    for item in candidates:
        cand = normalize_text(item)
        if not cand:
            continue
        ratio = SequenceMatcher(None, base, cand).ratio()
        best = max(best, ratio)
    return best


def to_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    as_text = str(value)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(as_text[:10], fmt).date()
        except Exception:
            continue
    try:
        return datetime.fromisoformat(as_text.replace("Z", "+00:00")).date()
    except Exception:
        return None


def classify_eligibility(tx: ParsedOfxTx) -> Tuple[str, str]:
    trn = normalize_text(tx.trntype)
    memo = normalize_text(tx.memo)
    if trn != "credit":
        return "ignorada", "TRNTYPE não elegível para contas a receber"
    if any(keyword in memo for keyword in IGNORE_KEYWORDS):
        return "ignorada", "Movimentação de saída/tarifa detectada"
    if tx.trnamt <= 0:
        return "ignorada", "Valor não positivo"
    return "elegivel", ""


def compute_line_hash(tx: ParsedOfxTx) -> str:
    raw = f"{tx.dtposted.isoformat()}|{tx.trnamt:.2f}|{tx.memo}|{tx.trntype}|{tx.acct_id}|{tx.bank_id}"
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()


def _candidate_aliases(cliente: Dict[str, Any], aliases: List[Dict[str, Any]]) -> List[str]:
    cid = str(cliente.get("id", ""))
    names = [
        cliente.get("nome_empresa"),
        cliente.get("nome_fantasia"),
        cliente.get("responsavel_empresa"),
        cliente.get("empresa_nome_banco"),
    ]
    for alias in aliases:
        if str(alias.get("cliente_id")) == cid and bool(alias.get("ativo", True)):
            names.append(alias.get("alias_nome"))
    return [n for n in names if n]


def score_row_to_title(
    tx: ParsedOfxTx,
    memo_info: Dict[str, str],
    conta: Dict[str, Any],
    cliente: Optional[Dict[str, Any]],
    aliases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    score = 0.0
    reasons: List[str] = []

    valor_original = float(conta.get("valor_original") or conta.get("total_liquido") or 0.0)
    valor_boleto = float(conta.get("total_liquido") or conta.get("valor_original") or 0.0)
    valor_desconto = max(0.0, valor_boleto - float(conta.get("desconto_aplicado") or 0.0))
    due_date = to_date(conta.get("data_vencimento"))
    dias_atraso, multa, juros, valor_corrigido = calc_interest_penalty(valor_original, due_date, tx.dtposted)

    val = float(tx.trnamt)
    if abs(val - valor_boleto) <= VALUE_EXACT_TOLERANCE:
        score += 45
        reasons.append("valor exato boleto")
    elif abs(val - valor_desconto) <= VALUE_EXACT_TOLERANCE:
        score += 43
        reasons.append("valor exato desconto")
    elif abs(val - valor_corrigido) <= VALUE_CORRECTED_TOLERANCE:
        score += 42
        reasons.append("valor corrigido com juros/multa")
    elif abs(val - valor_boleto) <= VALUE_APPROX_TOLERANCE:
        score += 20
        reasons.append("valor aproximado")

    # documento
    doc_tx = re.sub(r"\D", "", memo_info.get("documento_pagador_extraido", ""))
    if doc_tx:
        conta_docs = []
        if cliente:
            conta_docs.extend([cliente.get("cnpj"), cliente.get("cpf_responsavel")])
        conta_docs.extend([conta.get("cnpj"), conta.get("documento")])
        docs_norm = [re.sub(r"\D", "", str(d or "")) for d in conta_docs if d]
        if doc_tx in docs_norm:
            score += 30
            reasons.append("documento compatível")

    # nome
    payer_name = memo_info.get("nome_pagador_extraido", "")
    names_candidates: List[str] = []
    if cliente:
        names_candidates.extend(_candidate_aliases(cliente, aliases))
    names_candidates.extend([conta.get("empresa"), conta.get("empresa_nome")])
    similarity = score_name_similarity(payer_name, [n for n in names_candidates if n])
    if similarity >= 0.92:
        score += 25
        reasons.append("nome muito semelhante")
    elif similarity >= 0.80:
        score += 15
        reasons.append("nome semelhante")
    elif similarity >= 0.70:
        score += 8
        reasons.append("nome parcialmente semelhante")

    # janela temporal
    if due_date:
        diff_days = abs((tx.dtposted - due_date).days)
        if diff_days <= 3:
            score += 12
            reasons.append("janela de data excelente")
        elif diff_days <= 10:
            score += 8
            reasons.append("janela de data boa")
        elif diff_days <= 30:
            score += 3
            reasons.append("janela de data aceitável")

    return {
        "score": round(score, 2),
        "dias_atraso": dias_atraso,
        "multa": round(multa, 2),
        "juros": round(juros, 2),
        "reasons": reasons,
    }


async def _update_batch_totals(batch_id: str):
    rows_collection = await get_import_rows_collection()
    batches_collection = await get_import_batches_collection()
    rows = await rows_collection.find({"batch_id": batch_id}, limit=100000)

    total = len(rows)
    elegiveis = sum(1 for r in rows if r.get("status_conciliacao") not in {"ignoradas"})
    by_status = {
        "lancadas": sum(1 for r in rows if r.get("status_conciliacao") == "lancadas"),
        "nao_identificadas": sum(1 for r in rows if r.get("status_conciliacao") == "nao_identificadas"),
        "ja_lancados": sum(1 for r in rows if r.get("status_conciliacao") == "ja_lancados"),
        "conflitos": sum(1 for r in rows if r.get("status_conciliacao") == "conflitos"),
        "ignoradas": sum(1 for r in rows if r.get("status_conciliacao") == "ignoradas"),
    }

    await batches_collection.update_one(
        {"id": batch_id},
        {
            "$set": {
                "total_transacoes": total,
                "total_elegiveis": elegiveis,
                "total_lancadas": by_status["lancadas"],
                "total_nao_identificadas": by_status["nao_identificadas"],
                "total_ja_lancados": by_status["ja_lancados"],
                "total_conflitos": by_status["conflitos"],
                "total_ignoradas": by_status["ignoradas"],
                "updated_at": datetime.utcnow(),
            }
        },
    )


@router.post("/importacoes/ofx/simular")
async def simular_importacao_ofx(
    arquivo: UploadFile = File(...),
    reimportar: bool = Query(False),
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    if not arquivo.filename.lower().endswith(".ofx"):
        raise HTTPException(status_code=400, detail="Apenas OFX é suportado nesta etapa.")

    raw_bytes = await arquivo.read()
    file_hash = hashlib.sha256(raw_bytes).hexdigest()
    batches_collection = await get_import_batches_collection()
    existing_batch = await batches_collection.find_one({"hash_arquivo": file_hash})
    if existing_batch and not reimportar:
        return {
            "arquivo_ja_importado": True,
            "batch": existing_batch,
            "message": "Arquivo já importado anteriormente. Exibindo lote existente.",
        }

    try:
        content = raw_bytes.decode("utf-8")
    except Exception:
        content = raw_bytes.decode("latin-1", errors="ignore")

    bank_context, txs = parse_ofx_transactions(content)
    if not txs:
        raise HTTPException(status_code=400, detail="Nenhuma transação STMTTRN encontrada no OFX.")

    batch_id = str(uuid.uuid4())
    batch_doc = {
        "id": batch_id,
        "nome_arquivo": arquivo.filename,
        "banco_origem": "Cora",
        "conta_origem": bank_context.get("acct_id") or "",
        "bank_id": bank_context.get("bank_id") or "",
        "hash_arquivo": file_hash,
        "data_importacao": datetime.utcnow(),
        "usuario_id": current_user.id,
        "usuario_nome": current_user.name,
        "total_transacoes": 0,
        "total_elegiveis": 0,
        "total_lancadas": 0,
        "total_nao_identificadas": 0,
        "total_ja_lancados": 0,
        "total_conflitos": 0,
        "total_ignoradas": 0,
        "status_processamento": "simulado",
        "metadata_json": json.dumps(
            {
                "org": bank_context.get("org"),
                "fid": bank_context.get("fid"),
            },
            ensure_ascii=False,
        ),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await batches_collection.insert_one(batch_doc)

    rows_collection = await get_import_rows_collection()
    contas_collection = await get_contas_receber_collection()
    clients_collection = await get_clients_collection()
    aliases_collection = await get_aliases_cliente_collection()

    all_contas = await contas_collection.find({}, limit=100000)
    open_contas = [c for c in all_contas if c.get("situacao") in {"em_aberto", "atrasado", "conflito_revisao"}]
    paid_statuses = {"pago", "pago_com_juros", "pago_com_desconto", "pago_parcial"}
    paid_contas = [c for c in all_contas if c.get("situacao") in paid_statuses]
    clients = await clients_collection.find({}, limit=100000)
    aliases = await aliases_collection.find({}, limit=100000)
    clients_by_id = {str(c.get("id")): c for c in clients}

    rows_to_insert: List[Dict[str, Any]] = []
    for tx in txs:
        memo_info = parse_memo_fields(tx.memo)
        eligibility, reason = classify_eligibility(tx)
        line_hash = compute_line_hash(tx)
        row_id = str(uuid.uuid4())
        row_doc: Dict[str, Any] = {
            "id": row_id,
            "batch_id": batch_id,
            "fitid": tx.fitid,
            "hash_linha": line_hash,
            "data_transacao": tx.dtposted,
            "nome_pagador": memo_info.get("nome_pagador_extraido") or "",
            "documento_pagador": memo_info.get("documento_pagador_extraido") or "",
            "memo_original": tx.memo,
            "descricao_transacao_extraida": memo_info.get("descricao_transacao_extraida") or "",
            "tipo_transacao": tx.trntype,
            "valor": float(tx.trnamt),
            "banco_origem": "Cora",
            "conta_origem": tx.acct_id,
            "bank_id": tx.bank_id,
            "status_conciliacao": "nao_identificadas",
            "titulo_id": None,
            "cliente_id": None,
            "dias_atraso": 0,
            "multa": 0.0,
            "juros": 0.0,
            "motivo_resultado": "",
            "candidatos_json": json.dumps([], ensure_ascii=False),
            "confirmado_manualmente": False,
            "confirmado_por": None,
            "confirmado_em": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        # Deduplicação por FITID e hash composto
        existing_by_fitid = await rows_collection.find_one(
            {"fitid": tx.fitid, "conta_origem": tx.acct_id, "bank_id": tx.bank_id}
        )
        existing_by_hash = await rows_collection.find_one({"hash_linha": line_hash})
        if existing_by_fitid or existing_by_hash:
            row_doc["status_conciliacao"] = "ignoradas"
            row_doc["motivo_resultado"] = "Duplicidade detectada por FITID/hash."
            rows_to_insert.append(row_doc)
            continue

        if eligibility != "elegivel":
            row_doc["status_conciliacao"] = "ignoradas"
            row_doc["motivo_resultado"] = reason
            rows_to_insert.append(row_doc)
            continue

        # candidatos em aberto
        candidates_open: List[Dict[str, Any]] = []
        for conta in open_contas:
            cliente = clients_by_id.get(str(conta.get("empresa_id")))
            scoring = score_row_to_title(tx, memo_info, conta, cliente, aliases)
            if scoring["score"] >= MIN_SCORE_OPEN_CANDIDATE:
                candidates_open.append(
                    {
                        "titulo_id": conta.get("id"),
                        "cliente_id": conta.get("empresa_id"),
                        "empresa": conta.get("empresa"),
                        "score": scoring["score"],
                        "dias_atraso": scoring["dias_atraso"],
                        "multa": scoring["multa"],
                        "juros": scoring["juros"],
                        "motivos": scoring["reasons"],
                    }
                )

        # candidatos já pagos
        candidates_paid: List[Dict[str, Any]] = []
        for conta in paid_contas:
            cliente = clients_by_id.get(str(conta.get("empresa_id")))
            scoring = score_row_to_title(tx, memo_info, conta, cliente, aliases)
            if scoring["score"] >= MIN_SCORE_PAID_CANDIDATE:
                candidates_paid.append(
                    {
                        "titulo_id": conta.get("id"),
                        "cliente_id": conta.get("empresa_id"),
                        "empresa": conta.get("empresa"),
                        "score": scoring["score"],
                    }
                )

        candidates_open.sort(key=lambda c: c["score"], reverse=True)
        candidates_paid.sort(key=lambda c: c["score"], reverse=True)
        row_doc["candidatos_json"] = json.dumps(candidates_open[:5], ensure_ascii=False)

        if candidates_paid and candidates_paid[0]["score"] >= MIN_SCORE_PAID_CANDIDATE:
            row_doc["status_conciliacao"] = "ja_lancados"
            row_doc["titulo_id"] = candidates_paid[0]["titulo_id"]
            row_doc["cliente_id"] = candidates_paid[0]["cliente_id"]
            row_doc["motivo_resultado"] = "Título já pago anteriormente."
            rows_to_insert.append(row_doc)
            continue

        if not candidates_open:
            row_doc["status_conciliacao"] = "nao_identificadas"
            row_doc["motivo_resultado"] = "Sem candidato seguro para conciliação."
            rows_to_insert.append(row_doc)
            continue

        best = candidates_open[0]
        second = candidates_open[1] if len(candidates_open) > 1 else None

        gap = (best["score"] - second["score"]) if second else 999.0
        if best["score"] >= AUTO_SETTLEMENT_MIN_SCORE and (not second or gap >= AUTO_SETTLEMENT_MIN_GAP):
            row_doc["status_conciliacao"] = "lancadas"
            row_doc["titulo_id"] = best["titulo_id"]
            row_doc["cliente_id"] = best["cliente_id"]
            row_doc["dias_atraso"] = best["dias_atraso"]
            row_doc["multa"] = best["multa"]
            row_doc["juros"] = best["juros"]
            row_doc["motivo_resultado"] = f"Sugestão automática segura (score {best['score']})."
        elif best["score"] >= CONFLICT_MIN_SCORE:
            row_doc["status_conciliacao"] = "conflitos"
            row_doc["titulo_id"] = best["titulo_id"]
            row_doc["cliente_id"] = best["cliente_id"]
            row_doc["dias_atraso"] = best["dias_atraso"]
            row_doc["multa"] = best["multa"]
            row_doc["juros"] = best["juros"]
            if second and gap < AUTO_SETTLEMENT_MIN_GAP:
                row_doc["motivo_resultado"] = (
                    f"Conflito por candidatos próximos (gap {gap:.2f}); revisão manual necessária."
                )
            else:
                row_doc["motivo_resultado"] = "Há ambiguidade ou confiança insuficiente para baixa automática."
        else:
            row_doc["status_conciliacao"] = "nao_identificadas"
            row_doc["motivo_resultado"] = "Score insuficiente para conciliação."

        rows_to_insert.append(row_doc)

    for row in rows_to_insert:
        await rows_collection.insert_one(row)

    await _update_batch_totals(batch_id)
    batch = await batches_collection.find_one({"id": batch_id})
    return {"arquivo_ja_importado": False, "batch": batch}


async def _perform_settlement_from_row(
    row: Dict[str, Any],
    user: UserResponse,
):
    contas_collection = await get_contas_receber_collection()
    settlement_collection = await get_import_settlement_links_collection()
    rows_collection = await get_import_rows_collection()

    if not row.get("titulo_id"):
        return {"aplicado": False, "motivo": "Sem título vinculado"}

    conta = await contas_collection.find_one({"id": row.get("titulo_id")})
    if not conta:
        return {"aplicado": False, "motivo": "Título não encontrado"}
    if str(conta.get("situacao") or "").startswith("pago"):
        await rows_collection.update_one(
            {"id": row["id"]},
            {"$set": {"status_conciliacao": "ja_lancados", "motivo_resultado": "Título já estava pago."}},
        )
        return {"aplicado": False, "motivo": "Título já pago"}

    pagamento_date = to_date(row.get("data_transacao")) or date.today()
    juros = float(row.get("juros") or 0.0)
    multa = float(row.get("multa") or 0.0)
    valor = float(row.get("valor") or 0.0)
    valor_total = float(conta.get("total_liquido") or conta.get("valor_original") or 0.0)
    desconto_aplicado = float(conta.get("desconto_aplicado") or 0.0)
    valor_com_desconto = max(0.0, valor_total - desconto_aplicado)
    status_baixa = "pago"
    if juros > 0 or multa > 0:
        status_baixa = "pago_com_juros"
    elif desconto_aplicado > 0 and abs(valor - valor_com_desconto) <= 0.05:
        status_baixa = "pago_com_desconto"
    elif valor_total and valor < (valor_total - 0.05):
        status_baixa = "pago_parcial"

    obs = str(conta.get("observacao") or "").strip()
    obs_import = (
        f"Baixado via importação OFX | lote={row.get('batch_id')} | fitid={row.get('fitid')} | "
        f"valor={valor:.2f} | juros={juros:.2f} | multa={multa:.2f}"
    )
    if obs:
        obs = f"{obs}\n{obs_import}"
    else:
        obs = obs_import

    await contas_collection.update_one(
        {"id": conta.get("id")},
        {
            "$set": {
                "situacao": status_baixa,
                "data_recebimento": pagamento_date,
                "valor_quitado": valor,
                "acrescimo_aplicado": juros + multa,
                "multa_calculada_importacao": multa,
                "juros_calculado_importacao": juros,
                "dias_atraso_importacao": int(row.get("dias_atraso") or 0),
                "updated_at": datetime.utcnow(),
                "observacao": obs,
            }
        },
    )

    await settlement_collection.insert_one(
        {
            "id": str(uuid.uuid4()),
            "conta_id": conta.get("id"),
            "batch_id": row.get("batch_id"),
            "row_id": row.get("id"),
            "fitid": row.get("fitid"),
            "valor_recebido": valor,
            "juros": juros,
            "multa": multa,
            "dias_atraso": int(row.get("dias_atraso") or 0),
            "status_baixa": status_baixa,
            "usuario_id": user.id,
            "usuario_nome": user.name,
            "created_at": datetime.utcnow(),
        }
    )

    await rows_collection.update_one(
        {"id": row["id"]},
        {
            "$set": {
                "confirmado_por": user.name,
                "confirmado_em": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return {"aplicado": True}


@router.post("/importacoes/{batch_id}/confirmar")
async def confirmar_importacao(batch_id: str, current_user: UserResponse = Depends(get_current_user)):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    batches_collection = await get_import_batches_collection()

    batch = await batches_collection.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    rows = await rows_collection.find({"batch_id": batch_id}, limit=100000)
    candidates = [r for r in rows if r.get("status_conciliacao") == "lancadas" and r.get("titulo_id")]

    applied = 0
    skipped = 0
    for row in candidates:
        result = await _perform_settlement_from_row(row, current_user)
        if result.get("aplicado"):
            applied += 1
        else:
            skipped += 1

    await _update_batch_totals(batch_id)
    new_status = "confirmado" if skipped == 0 else "confirmado_parcial"
    await batches_collection.update_one(
        {"id": batch_id},
        {"$set": {"status_processamento": new_status, "updated_at": datetime.utcnow()}},
    )

    return {"message": "Confirmação concluída", "aplicadas": applied, "ignoradas": skipped}


@router.get("/importacoes")
async def listar_lotes_importacao(
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
):
    check_financial_access(current_user)
    batches_collection = await get_import_batches_collection()
    rows = await batches_collection.find({}, skip=skip, limit=limit)
    rows.sort(key=lambda x: str(x.get("data_importacao") or ""), reverse=True)
    return rows


@router.get("/importacoes/links")
async def listar_links_importacao(
    current_user: UserResponse = Depends(get_current_user),
    conta_id: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=20000),
):
    check_financial_access(current_user)
    collection = await get_import_settlement_links_collection()
    query = {"conta_id": conta_id} if conta_id else {}
    rows = await collection.find(query, limit=limit)
    rows.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return rows


@router.get("/importacoes/{batch_id}")
async def obter_detalhe_lote(batch_id: str, current_user: UserResponse = Depends(get_current_user)):
    check_financial_access(current_user)
    batches_collection = await get_import_batches_collection()
    rows_collection = await get_import_rows_collection()
    batch = await batches_collection.find_one({"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Lote não encontrado")

    rows = await rows_collection.find({"batch_id": batch_id}, limit=100000)
    grouped = {
        "lancadas": [],
        "nao_identificadas": [],
        "ja_lancados": [],
        "conflitos": [],
        "ignoradas": [],
    }
    for item in rows:
        status_key = item.get("status_conciliacao") or "nao_identificadas"
        if status_key not in grouped:
            status_key = "nao_identificadas"
        parsed_candidates = []
        try:
            parsed_candidates = json.loads(item.get("candidatos_json") or "[]")
        except Exception:
            parsed_candidates = []
        item["candidatos"] = parsed_candidates
        grouped[status_key].append(item)

    return {"batch": batch, "grouped": grouped}


@router.put("/importacoes/{batch_id}/rows/{row_id}/vincular")
async def vincular_linha_manualmente(
    batch_id: str,
    row_id: str,
    payload: ManualLinkPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    contas_collection = await get_contas_receber_collection()
    row = await rows_collection.find_one({"id": row_id, "batch_id": batch_id})
    if not row:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    conta = await contas_collection.find_one({"id": payload.titulo_id})
    if not conta:
        raise HTTPException(status_code=404, detail="Título não encontrado")

    await rows_collection.update_one(
        {"id": row_id},
        {
            "$set": {
                "titulo_id": payload.titulo_id,
                "cliente_id": conta.get("empresa_id"),
                "status_conciliacao": "lancadas",
                "confirmado_manualmente": True,
                "confirmado_por": current_user.name,
                "confirmado_em": datetime.utcnow(),
                "motivo_resultado": "Conciliação manual confirmada pelo usuário.",
                "updated_at": datetime.utcnow(),
            }
        },
    )
    if payload.confirmar_agora:
        updated = await rows_collection.find_one({"id": row_id})
        await _perform_settlement_from_row(updated, current_user)

    await _update_batch_totals(batch_id)
    return {"message": "Linha vinculada com sucesso"}


@router.put("/importacoes/{batch_id}/rows/{row_id}/ignorar")
async def ignorar_linha_importacao(
    batch_id: str,
    row_id: str,
    payload: IgnoreRowPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    row = await rows_collection.find_one({"id": row_id, "batch_id": batch_id})
    if not row:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    await rows_collection.update_one(
        {"id": row_id},
        {
            "$set": {
                "status_conciliacao": "ignoradas",
                "motivo_resultado": payload.motivo or "Ignorada manualmente.",
                "confirmado_manualmente": True,
                "confirmado_por": current_user.name,
                "confirmado_em": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )
    await _update_batch_totals(batch_id)
    return {"message": "Linha marcada como ignorada"}


@router.post("/importacoes/{batch_id}/rows/{row_id}/confirmar")
async def confirmar_linha_importacao(
    batch_id: str,
    row_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    row = await rows_collection.find_one({"id": row_id, "batch_id": batch_id})
    if not row:
        raise HTTPException(status_code=404, detail="Linha não encontrada")
    if not row.get("titulo_id"):
        raise HTTPException(status_code=400, detail="Linha sem título vinculado para confirmação")
    if row.get("status_conciliacao") not in {"lancadas", "conflitos"}:
        raise HTTPException(status_code=400, detail="Status da linha não permite confirmação direta")

    await rows_collection.update_one(
        {"id": row_id},
        {"$set": {"status_conciliacao": "lancadas", "updated_at": datetime.utcnow()}},
    )
    refreshed = await rows_collection.find_one({"id": row_id})
    result = await _perform_settlement_from_row(refreshed, current_user)
    await _update_batch_totals(batch_id)
    return {"message": "Linha confirmada", "resultado": result}


@router.put("/importacoes/{batch_id}/rows/{row_id}/reabrir")
async def reabrir_linha_importacao(
    batch_id: str,
    row_id: str,
    payload: ReopenRowPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    row = await rows_collection.find_one({"id": row_id, "batch_id": batch_id})
    if not row:
        raise HTTPException(status_code=404, detail="Linha não encontrada")

    await rows_collection.update_one(
        {"id": row_id},
        {
            "$set": {
                "status_conciliacao": "nao_identificadas",
                "titulo_id": None,
                "cliente_id": None,
                "dias_atraso": 0,
                "multa": 0.0,
                "juros": 0.0,
                "motivo_resultado": payload.motivo or "Linha reaberta para nova revisão manual.",
                "confirmado_manualmente": True,
                "confirmado_por": current_user.name,
                "confirmado_em": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        },
    )
    await _update_batch_totals(batch_id)
    return {"message": "Linha reaberta com sucesso"}


@router.post("/importacoes/{batch_id}/bulk/ignorar")
async def ignorar_linhas_em_lote(
    batch_id: str,
    payload: BulkIgnorePayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    rows_collection = await get_import_rows_collection()
    valid_status = {"lancadas", "nao_identificadas", "ja_lancados", "conflitos", "ignoradas"}
    status_alvo = payload.status_alvo if payload.status_alvo in valid_status else "conflitos"
    if status_alvo == "ignoradas":
        raise HTTPException(status_code=400, detail="Status alvo inválido para ignorar em lote")

    rows = await rows_collection.find({"batch_id": batch_id, "status_conciliacao": status_alvo}, limit=100000)
    total = 0
    for row in rows:
        await rows_collection.update_one(
            {"id": row.get("id")},
            {
                "$set": {
                    "status_conciliacao": "ignoradas",
                    "motivo_resultado": payload.motivo or f"Ignorada em lote a partir de {status_alvo}.",
                    "confirmado_manualmente": True,
                    "confirmado_por": current_user.name,
                    "confirmado_em": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        total += 1

    await _update_batch_totals(batch_id)
    return {"message": "Ignoração em lote concluída", "total": total, "status_origem": status_alvo}


@router.get("/aliases")
async def listar_aliases_cliente(
    cliente_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_aliases_cliente_collection()
    query = {"cliente_id": cliente_id} if cliente_id else {}
    rows = await collection.find(query, limit=5000)
    return rows


@router.post("/aliases")
async def criar_alias_cliente(payload: AliasPayload, current_user: UserResponse = Depends(get_current_user)):
    check_financial_access(current_user)
    collection = await get_aliases_cliente_collection()
    doc = {
        "id": str(uuid.uuid4()),
        "cliente_id": payload.cliente_id,
        "alias_nome": payload.alias_nome.strip(),
        "origem": payload.origem,
        "ativo": payload.ativo,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await collection.insert_one(doc)
    return doc
