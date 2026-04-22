from fastapi import APIRouter, HTTPException, status, Depends, Query, File, UploadFile
from pydantic import BaseModel
from typing import List, Optional
from models.financial import (
    ContaReceber, ContaReceberCreate, ContaReceberUpdate, PagamentoTitulo,
    FinancialClient, FinancialClientCreate, FinancialClientUpdate,
    HistoricoAlteracao, ContatoCobranca, ContatoCobrancaCreate,
    PropostaRenegociacao, ContaReceberFilters, RelatorioFinanceiro,
    ImportacaoExtrato, MovimentoExtrato, ClassificacaoMovimento,
    SituacaoTitulo, FormaPagamento
)
from models.user import UserResponse
from auth import get_current_user
from database_adapter import DatabaseAdapter
from database_compat import (
    get_contas_receber_collection, get_financial_clients_collection,
    get_importacoes_extrato_collection, get_financial_settings_collection
)
from datetime import datetime, date, timedelta
import json
import uuid
import re
import csv
import io
import unicodedata
from typing import Dict, Any

router = APIRouter(prefix="/financial", tags=["Financial"])


class FinancialHonorariosSettingsPayload(BaseModel):
    items: List[Dict[str, Any]]


class FinancialAssinaturaServicesPayload(BaseModel):
    items: List[Dict[str, Any]]


class FinancialAssinaturaPlansPayload(BaseModel):
    items: List[Dict[str, Any]]

class ContaPagarCreatePayload(BaseModel):
    external_id: Optional[str] = None
    descricao: str
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    valor: float = 0.0
    valor_pago: float = 0.0
    juros: float = 0.0
    valor_restante: float = 0.0
    situacao: Optional[str] = "em_dia"
    forma_pagamento: Optional[str] = None
    tipo_despesa: Optional[str] = None
    centro_custo: Optional[str] = None
    conta_utilizada: Optional[str] = None
    competencia: Optional[str] = None
    natureza_despesa: Optional[str] = None
    recorrente: Optional[bool] = False
    tipo_parcela: Optional[str] = None
    numero_parcela: Optional[int] = None
    total_parcelas: Optional[int] = None
    prioridade: Optional[str] = None
    comentario: Optional[str] = None
    comprovante_anexo: Optional[str] = None
    pago: Optional[bool] = False
    data_lancamento: Optional[date] = None
    data_pagamento_ref: Optional[date] = None
    data_reproducao: Optional[date] = None


class ContaPagarUpdatePayload(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    valor: Optional[float] = None
    valor_pago: Optional[float] = None
    juros: Optional[float] = None
    valor_restante: Optional[float] = None
    situacao: Optional[str] = None
    forma_pagamento: Optional[str] = None
    tipo_despesa: Optional[str] = None
    centro_custo: Optional[str] = None
    conta_utilizada: Optional[str] = None
    competencia: Optional[str] = None
    natureza_despesa: Optional[str] = None
    recorrente: Optional[bool] = None
    tipo_parcela: Optional[str] = None
    numero_parcela: Optional[int] = None
    total_parcelas: Optional[int] = None
    prioridade: Optional[str] = None
    comentario: Optional[str] = None
    comprovante_anexo: Optional[str] = None
    pago: Optional[bool] = None
    data_lancamento: Optional[date] = None
    data_pagamento_ref: Optional[date] = None
    data_reproducao: Optional[date] = None

DEFAULT_ASSINATURA_SERVICES = [
    {"id": "svc-001", "nome": "Escrituracao contabil mensal"},
    {"id": "svc-002", "nome": "Apuracao de impostos federais"},
    {"id": "svc-003", "nome": "Apuracao de impostos estaduais"},
    {"id": "svc-004", "nome": "Apuracao de impostos municipais"},
    {"id": "svc-005", "nome": "Entrega de PGDAS"},
    {"id": "svc-006", "nome": "Entrega de DCTFWeb"},
    {"id": "svc-007", "nome": "Entrega de EFD Contribuicoes"},
    {"id": "svc-008", "nome": "Entrega de ECD"},
    {"id": "svc-009", "nome": "Entrega de ECF"},
    {"id": "svc-010", "nome": "Entrega de DIRF"},
    {"id": "svc-011", "nome": "Entrega de DEFIS"},
    {"id": "svc-012", "nome": "Entrega de RAIS"},
    {"id": "svc-013", "nome": "Entrega de CAGED"},
    {"id": "svc-014", "nome": "Folha de pagamento mensal"},
    {"id": "svc-015", "nome": "Calculo de ferias"},
    {"id": "svc-016", "nome": "Calculo de rescisao"},
    {"id": "svc-017", "nome": "Pro-labore de socios"},
    {"id": "svc-018", "nome": "Emissao de guias INSS"},
    {"id": "svc-019", "nome": "Emissao de guias FGTS"},
    {"id": "svc-020", "nome": "Emissao de DAS mensal"},
    {"id": "svc-021", "nome": "Conferencia de notas fiscais"},
    {"id": "svc-022", "nome": "Conciliacao bancaria"},
    {"id": "svc-023", "nome": "Fluxo de caixa gerencial"},
    {"id": "svc-024", "nome": "Relatorio de resultados"},
    {"id": "svc-025", "nome": "Regularizacao fiscal"},
    {"id": "svc-026", "nome": "Parcelamento de debitos"},
    {"id": "svc-027", "nome": "Abertura de empresa"},
    {"id": "svc-028", "nome": "Alteracao contratual"},
    {"id": "svc-029", "nome": "Baixa de empresa"},
    {"id": "svc-030", "nome": "Consultoria tributaria"},
]


def _is_official_locked(record: Dict[str, Any]) -> bool:
    return bool((record or {}).get("official_locked"))

def check_financial_access(user: UserResponse):
    """Check if user has access to financial module"""
    if user.role != "admin" and "financeiro" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to financial module not allowed"
        )


def _normalize_text(value: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFD', str(value or '').strip().lower())
        if unicodedata.category(c) != 'Mn'
    )


def _parse_br_decimal(value: Any) -> float:
    if value is None:
        return 0.0
    raw = str(value).strip()
    if not raw:
        return 0.0
    raw = raw.replace("R$", "").replace(" ", "")
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _parse_optional_int(value: Any) -> Optional[int]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return int(float(raw.replace(",", ".")))
    except ValueError:
        return None


def _parse_bool(value: Any) -> bool:
    normalized = _normalize_text(value)
    return normalized in {"sim", "true", "1", "pago", "yes", "y"}


def _parse_date_value(value: Any) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None

    iso_match = re.match(r"^\d{4}-\d{2}-\d{2}$", raw)
    if iso_match:
        return raw

    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue

    return None


def _normalize_situacao(value: Any, paid: bool) -> str:
    text = _normalize_text(value)
    if paid or text in {"em dia", "pago", "quitado"}:
        return "pago"
    if text in {"atrasado", "vencido", "em atraso"}:
        return "atrasado"
    if text in {"pendente", "a pagar", "aberto"}:
        return "em_aberto"
    return "em_aberto"


def _build_csv_row_external_id(csv_row: Dict[str, Any]) -> str:
    normalized_row = _build_normalized_csv_row(csv_row)
    seed = "|".join(
        [
            str(_csv_get(normalized_row, "ID", "Id")).strip(),
            str(_csv_get(normalized_row, "Dia", "Data_Lancamento")).strip(),
            str(_csv_get(normalized_row, "Descrição", "Descricao", "descricao")).strip(),
            str(_csv_get(normalized_row, "Valor_Num", "Valor")).strip(),
        ]
    )
    digest = uuid.uuid5(uuid.NAMESPACE_DNS, seed or str(uuid.uuid4()))
    return str(digest)[:8].upper()


def _build_normalized_csv_row(csv_row: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    for key, value in (csv_row or {}).items():
        normalized[_normalize_text(key)] = value
    return normalized


def _csv_get(csv_row_normalized: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = csv_row_normalized.get(_normalize_text(key))
        if value not in (None, ""):
            return value
    return ""


async def _get_contas_pagar_settings_row():
    collection = await get_financial_settings_collection()
    row = await collection.find_one({"key": "contas_pagar"})
    if not row:
        row = {
            "id": str(uuid.uuid4()),
            "key": "contas_pagar",
            "items": [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        await collection.insert_one(row)
    return collection, row

# Contas a Receber
@router.post("/contas-receber", response_model=ContaReceber)
async def create_conta_receber(
    conta_data: ContaReceberCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new conta a receber"""
    check_financial_access(current_user)
    
    async with DatabaseAdapter() as db:
        # Calculate totals
        total_bruto = conta_data.valor_original
        total_liquido = total_bruto
        
        # Create conta dict manually to ensure proper serialization
        conta_dict = {
            "id": str(uuid.uuid4()),
            "empresa_id": conta_data.empresa_id,
            "empresa": conta_data.empresa,
            "situacao": SituacaoTitulo.EM_ABERTO.value,
            "descricao": conta_data.descricao,
            "documento": conta_data.documento,
            "tipo_documento": conta_data.tipo_documento.value if hasattr(conta_data.tipo_documento, 'value') else conta_data.tipo_documento,
            "forma_pagamento": conta_data.forma_pagamento.value if hasattr(conta_data.forma_pagamento, 'value') else conta_data.forma_pagamento,
            "conta": conta_data.conta,
            "centro_custo": conta_data.centro_custo,
            "plano_custo": conta_data.plano_custo,
            "data_emissao": datetime.combine(conta_data.data_emissao, datetime.min.time()),
            "data_vencimento": datetime.combine(conta_data.data_vencimento, datetime.min.time()),
            "valor_original": conta_data.valor_original,
            "desconto_aplicado": 0.0,
            "acrescimo_aplicado": 0.0,
            "valor_quitado": 0.0,
            "troco": 0.0,
            "total_bruto": total_bruto,
            "total_liquido": total_liquido,
            "cidade_atendimento": conta_data.cidade_atendimento,
            "usuario_responsavel": conta_data.usuario_responsavel,
            "observacao": conta_data.observacao,
            "data_recebimento": None,
            "historico_alteracoes": [
                {
                    "data": datetime.utcnow(),
                    "acao": "Título criado",
                    "usuario": current_user.name,
                    "observacao": "Título criado via API",
                    "campo_alterado": None,
                    "valor_anterior": None,
                    "valor_novo": None
                }
            ],
            "contatos_cobranca": [],
            "anexos": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.insert_one("contas_receber", conta_dict)
        
        # Convert to model for response
        return ContaReceber(**conta_dict)

@router.get("/contas-receber", response_model=List[ContaReceber])
async def get_contas_receber(
    current_user: UserResponse = Depends(get_current_user),
    cidade: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get contas a receber with filters"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build query
    query = {}
    
    # City access control
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    # Situation filter
    if situacao:
        query["situacao"] = situacao
    
    # Search filter
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"documento": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}}
        ]
    
    contas_data = await contas_collection.find(query, skip=skip, limit=limit)
    contas = []
    for conta_data in contas_data:
        contas.append(ContaReceber(**conta_data))
    
    return contas

@router.get("/contas-receber/{conta_id}", response_model=ContaReceber)
async def get_conta_receber(
    conta_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get conta a receber by ID"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    conta_data = await contas_collection.find_one({"id": conta_id})
    
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    return ContaReceber(**conta_data)

@router.put("/contas-receber/{conta_id}/baixa")
async def baixar_conta_receber(
    conta_id: str,
    pagamento_data: PagamentoTitulo,
    current_user: UserResponse = Depends(get_current_user)
):
    """Dar baixa em conta a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    conta_data = await contas_collection.find_one({"id": conta_id})
    
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    conta = ContaReceber(**conta_data)
    
    # Update conta
    historico_action = HistoricoAlteracao(
        acao="Baixa realizada",
        usuario=current_user.name,
        observacao=pagamento_data.observacao or "Pagamento recebido",
        valor_novo=str(pagamento_data.valor_recebido)
    )
    
    update_data = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": datetime.combine(pagamento_data.data_recebimento, datetime.min.time()),
        "desconto_aplicado": pagamento_data.desconto_aplicado,
        "acrescimo_aplicado": pagamento_data.acrescimo_aplicado,
        "valor_quitado": pagamento_data.valor_recebido,
        "troco": pagamento_data.troco,
        "total_liquido": conta.valor_original - pagamento_data.desconto_aplicado + pagamento_data.acrescimo_aplicado,
        "updated_at": datetime.utcnow()
    }
    
    # Update the document with both $set and $push operations
    await contas_collection.update_one(
        {"id": conta_id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )
    
    # Get updated conta
    updated_conta_data = await contas_collection.find_one({"id": conta_id})
    return ContaReceber(**updated_conta_data)

@router.put("/contas-receber/{conta_id}", response_model=ContaReceber)
async def update_conta_receber(
    conta_id: str,
    conta_update: ContaReceberUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update conta a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Build update data
    update_data = {k: v for k, v in conta_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Add to history
    historico_action = HistoricoAlteracao(
        acao="Registro editado",
        usuario=current_user.name,
        observacao="Dados atualizados"
    )
    
    await contas_collection.update_one(
        {"id": conta_id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )
    
    # Get updated conta
    updated_conta_data = await contas_collection.find_one({"id": conta_id})
    return ContaReceber(**updated_conta_data)

@router.delete("/contas-receber/{conta_id}")
async def delete_conta_receber(
    conta_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete conta a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    result = await contas_collection.delete_one({"id": conta_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    return {"message": "Conta a receber deleted successfully"}

@router.post("/contas-receber/{conta_id}/duplicate", response_model=ContaReceber)
async def duplicate_conta_receber(
    conta_id: str,
    nova_data_vencimento: date,
    current_user: UserResponse = Depends(get_current_user)
):
    """Duplicate conta a receber for recurring entries"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Create new conta based on original
    conta_original = ContaReceber(**conta_data)
    
    # Create new conta dict manually to ensure proper serialization
    nova_conta_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": conta_original.empresa_id,
        "empresa": conta_original.empresa,
        "situacao": SituacaoTitulo.EM_ABERTO.value,
        "descricao": conta_original.descricao,
        "documento": f"{conta_original.documento}-DUP",
        "tipo_documento": conta_original.tipo_documento.value if hasattr(conta_original.tipo_documento, 'value') else conta_original.tipo_documento,
        "forma_pagamento": conta_original.forma_pagamento.value if hasattr(conta_original.forma_pagamento, 'value') else conta_original.forma_pagamento,
        "conta": conta_original.conta,
        "centro_custo": conta_original.centro_custo,
        "plano_custo": conta_original.plano_custo,
        "data_emissao": datetime.combine(date.today(), datetime.min.time()),
        "data_vencimento": datetime.combine(nova_data_vencimento, datetime.min.time()),
        "valor_original": conta_original.valor_original,
        "desconto_aplicado": 0.0,
        "acrescimo_aplicado": 0.0,
        "valor_quitado": 0.0,
        "troco": 0.0,
        "total_bruto": conta_original.valor_original,
        "total_liquido": conta_original.valor_original,
        "cidade_atendimento": conta_original.cidade_atendimento,
        "usuario_responsavel": current_user.name,
        "observacao": conta_original.observacao,
        "data_recebimento": None,
        "historico_alteracoes": [
            {
                "data": datetime.utcnow(),
                "acao": "Criado por duplicação",
                "usuario": current_user.name,
                "observacao": f"Duplicado do título {conta_id}",
                "campo_alterado": None,
                "valor_anterior": None,
                "valor_novo": None
            }
        ],
        "contatos_cobranca": [],
        "anexos": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await contas_collection.insert_one(nova_conta_dict)
    
    # Convert back to model for response
    return ContaReceber(**nova_conta_dict)

# Cobrança e Contatos
@router.post("/contas-receber/{conta_id}/contatos", response_model=ContatoCobranca)
async def add_contato_cobranca(
    conta_id: str,
    contato_data: ContatoCobrancaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Add contact record to conta a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Create contato data without titulo_id (it's already in the conta)
    contato_dict = contato_data.model_dump()
    contato_dict.pop('titulo_id', None)  # Remove titulo_id as it's not part of ContatoCobranca model
    contato_dict['usuario_responsavel'] = current_user.name
    
    contato = ContatoCobranca(**contato_dict)
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"contatos_cobranca": contato.model_dump()}}
    )
    
    return contato

@router.post("/contas-receber/{conta_id}/proposta-renegociacao", response_model=PropostaRenegociacao)
async def create_proposta_renegociacao(
    conta_id: str,
    proposta_data: PropostaRenegociacao,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create renegotiation proposal"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Update proposta with conta_id and user
    proposta_data.titulo_id = conta_id
    proposta_data.usuario_responsavel = current_user.name
    
    # Add to historical record
    historico_action = HistoricoAlteracao(
        acao="Proposta de renegociação criada",
        usuario=current_user.name,
        observacao=f"Nova data: {proposta_data.nova_data_vencimento}, Novo valor: R${proposta_data.novo_valor}"
    )
    
    # Convert date to datetime for MongoDB
    historico_dict = historico_action.model_dump()
    historico_dict["data"] = datetime.utcnow()
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"historico_alteracoes": historico_dict}}
    )
    
    return proposta_data

@router.get("/cobranca/lembretes/{conta_id}")
async def gerar_lembrete_cobranca(
    conta_id: str,
    tipo: str = Query(..., regex="^(whatsapp|email)$"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate collection reminder text"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    conta = ContaReceber(**conta_data)
    
    if tipo == "whatsapp":
        mensagem = f"""
🏢 *{conta.empresa}*

Prezado(a) cliente,

Identificamos que o título referente ao documento *{conta.documento}* no valor de *R$ {conta.total_liquido:.2f}* com vencimento em *{conta.data_vencimento.strftime('%d/%m/%Y')}* encontra-se em aberto.

Por gentileza, regularizar a situação o mais breve possível.

Atenciosamente,
Macedo SI - Contabilidade
        """
    else:  # email
        mensagem = f"""
Assunto: Cobrança - Documento {conta.documento}

Prezado(a) {conta.empresa},

Informamos que o título referente ao documento {conta.documento} no valor de R$ {conta.total_liquido:.2f} com vencimento em {conta.data_vencimento.strftime('%d/%m/%Y')} encontra-se em aberto em nossos registros.

Solicitamos a gentileza de regularizar a situação o mais breve possível.

Atenciosamente,
Macedo SI - Contabilidade
        """
    
    return {"mensagem": mensagem.strip(), "tipo": tipo}

# Relatórios
@router.get("/relatorios/inadimplencia")
async def relatorio_inadimplencia(
    cidade: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate default report"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build query
    query = {"situacao": {"$in": [SituacaoTitulo.ATRASADO, SituacaoTitulo.EM_ABERTO]}}
    
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    if data_inicio and data_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    # Aggregate data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "cidade": "$cidade_atendimento",
                "situacao": "$situacao"
            },
            "total_titulos": {"$sum": 1},
            "valor_total": {"$sum": "$total_liquido"}
        }},
        {"$sort": {"_id.cidade": 1, "_id.situacao": 1}}
    ]
    
    resultados = []
    async for result in contas_collection.aggregate(pipeline):
        resultados.append({
            "cidade": result["_id"]["cidade"],
            "situacao": result["_id"]["situacao"],
            "total_titulos": result["total_titulos"],
            "valor_total": result["valor_total"]
        })
    
    return {"relatorio": resultados, "data_geracao": datetime.utcnow()}

@router.get("/relatorios/recebimentos")
async def relatorio_recebimentos(
    data_inicio: date = Query(...),
    data_fim: date = Query(...),
    cidade: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate payment report"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build query - convert dates to datetime for MongoDB
    query = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    }
    
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    # Aggregate data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "forma_pagamento": "$forma_pagamento",
                "cidade": "$cidade_atendimento"
            },
            "total_titulos": {"$sum": 1},
            "valor_total": {"$sum": "$valor_quitado"},
            "desconto_total": {"$sum": "$desconto_aplicado"},
            "acrescimo_total": {"$sum": "$acrescimo_aplicado"}
        }},
        {"$sort": {"_id.cidade": 1, "_id.forma_pagamento": 1}}
    ]
    
    resultados = []
    async for result in contas_collection.aggregate(pipeline):
        resultados.append({
            "forma_pagamento": result["_id"]["forma_pagamento"],
            "cidade": result["_id"]["cidade"],
            "total_titulos": result["total_titulos"],
            "valor_total": result["valor_total"],
            "desconto_total": result["desconto_total"],
            "acrescimo_total": result["acrescimo_total"]
        })
    
    return {
        "relatorio": resultados,
        "periodo": {"inicio": data_inicio, "fim": data_fim},
        "data_geracao": datetime.utcnow()
    }

# Importação de Extratos
@router.post("/extrato/importar", response_model=ImportacaoExtrato)
async def importar_extrato(
    arquivo: UploadFile = File(...),
    conta_bancaria: str = Query(...),
    cidade: str = Query(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Import bank statement (PDF/CSV)"""
    check_financial_access(current_user)
    
    # Validate file type
    if not arquivo.filename.lower().endswith(('.pdf', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and CSV files are supported"
        )
    
    # Create import record
    importacao = ImportacaoExtrato(
        nome_arquivo=arquivo.filename,
        tipo_arquivo=arquivo.filename.split('.')[-1].upper(),
        conta_bancaria=conta_bancaria,
        cidade=cidade,
        usuario_responsavel=current_user.name,
        total_movimentos=0,
        status="processando"
    )
    
    # Save import record
    importacoes_collection = await get_importacoes_extrato_collection()
    await importacoes_collection.insert_one(importacao.model_dump())
    
    try:
        # Read file content
        conteudo = await arquivo.read()
        
        # Process file based on type
        if arquivo.filename.lower().endswith('.pdf'):
            movimentos = await processar_pdf_extrato(conteudo, importacao.id)
        else:  # CSV
            movimentos = await processar_csv_extrato(conteudo, importacao.id)
        
        # Update import record
        importacao.movimentos = movimentos
        importacao.total_movimentos = len(movimentos)
        importacao.status = "processando_matches"
        importacao.log_processamento.append(f"Arquivo processado: {len(movimentos)} movimentos encontrados")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        # Try automatic matching
        baixas_automaticas = await processar_conciliacao_automatica(importacao.id, current_user.name)
        
        # Final update
        importacao.baixas_automaticas = baixas_automaticas
        importacao.pendentes_classificacao = len([m for m in movimentos if m.status_classificacao == "pendente"])
        importacao.status = "concluido"
        importacao.log_processamento.append(f"Conciliação automática: {baixas_automaticas} títulos baixados")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        return importacao
        
    except Exception as e:
        # Update import with error
        importacao.status = "erro"
        importacao.log_processamento.append(f"Erro no processamento: {str(e)}")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )

async def processar_pdf_extrato(conteudo: bytes, importacao_id: str) -> List[MovimentoExtrato]:
    """Process PDF bank statement using basic text extraction"""
    try:
        # Simple PDF text extraction (would need PyPDF2 or similar for production)
        # For now, we'll create a mock implementation
        text_content = conteudo.decode('utf-8', errors='ignore')
        
        movimentos = []
        lines = text_content.split('\n')
        
        for line in lines:
            # Try to find patterns that look like bank movements
            # This is a simplified version - real implementation would be more robust
            if re.search(r'\d{2}/\d{2}/\d{4}.*\d+[,\.]\d{2}', line):
                movimento = extrair_movimento_da_linha(line)
                if movimento:
                    movimentos.append(movimento)
        
        return movimentos
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing PDF: {str(e)}"
        )

async def processar_csv_extrato(conteudo: bytes, importacao_id: str) -> List[MovimentoExtrato]:
    """Process CSV bank statement"""
    try:
        text_content = conteudo.decode('utf-8')
        lines = text_content.strip().split('\n')
        
        # Skip header if present
        if lines and ('data' in lines[0].lower() or 'date' in lines[0].lower()):
            lines = lines[1:]
        
        movimentos = []
        for line in lines:
            if line.strip():
                campos = line.split(';')  # Try semicolon first
                if len(campos) < 3:
                    campos = line.split(',')  # Fallback to comma
                
                if len(campos) >= 3:
                    movimento = criar_movimento_from_csv(campos)
                    if movimento:
                        movimentos.append(movimento)
        
        return movimentos
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV: {str(e)}"
        )

def extrair_movimento_da_linha(linha: str) -> Optional[MovimentoExtrato]:
    """Extract movement data from a text line"""
    try:
        # Pattern to extract date, description and value
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        value_pattern = r'([\d,\.]+)'
        
        date_match = re.search(date_pattern, linha)
        if not date_match:
            return None
        
        # Extract date
        data_str = date_match.group(1)
        data_movimento = datetime.strptime(data_str, '%d/%m/%Y').date()
        
        # Extract description (text between date and value)
        descricao_match = re.search(f'{date_pattern}\\s*(.+?)\\s*{value_pattern}', linha)
        descricao = descricao_match.group(2).strip() if descricao_match else linha.strip()
        
        # Extract value (last occurrence)
        valores = re.findall(r'[\d,\.]+', linha)
        if not valores:
            return None
        
        valor_str = valores[-1].replace(',', '.')
        valor = float(valor_str)
        
        # Determine if credit or debit (simple heuristic)
        tipo_movimento = "credito" if "CREDITO" in linha.upper() or valor > 0 else "debito"
        
        # Try to extract CNPJ
        cnpj_pattern = r'(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})'
        cnpj_match = re.search(cnpj_pattern, descricao)
        cnpj_detectado = cnpj_match.group(1) if cnpj_match else None
        
        return MovimentoExtrato(
            data_movimento=data_movimento,
            descricao_original=linha.strip(),
            descricao_processada=descricao,
            valor=abs(valor),
            tipo_movimento=tipo_movimento,
            cnpj_detectado=cnpj_detectado
        )
        
    except Exception:
        return None

def criar_movimento_from_csv(campos: List[str]) -> Optional[MovimentoExtrato]:
    """Create movement from CSV fields"""
    try:
        if len(campos) < 3:
            return None
        
        # Assume: Date, Description, Value, [Balance]
        data_str = campos[0].strip()
        descricao = campos[1].strip()
        valor_str = campos[2].strip().replace(',', '.')
        saldo_str = campos[3].strip().replace(',', '.') if len(campos) > 3 else None
        
        # Parse date (try multiple formats)
        data_movimento = None
        for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y']:
            try:
                data_movimento = datetime.strptime(data_str, fmt).date()
                break
            except ValueError:
                continue
        
        if not data_movimento:
            return None
        
        valor = float(valor_str)
        saldo = float(saldo_str) if saldo_str else None
        
        # Determine movement type
        tipo_movimento = "credito" if valor > 0 else "debito"
        
        # Try to extract CNPJ
        cnpj_pattern = r'(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})'
        cnpj_match = re.search(cnpj_pattern, descricao)
        cnpj_detectado = cnpj_match.group(1) if cnpj_match else None
        
        return MovimentoExtrato(
            data_movimento=data_movimento,
            descricao_original=f"{data_str};{descricao};{valor_str}",
            descricao_processada=descricao,
            valor=abs(valor),
            tipo_movimento=tipo_movimento,
            saldo=saldo,
            cnpj_detectado=cnpj_detectado
        )
        
    except Exception:
        return None

async def processar_conciliacao_automatica(importacao_id: str, usuario: str) -> int:
    """Process automatic reconciliation"""
    importacoes_collection = await get_importacoes_extrato_collection()
    contas_collection = await get_contas_receber_collection()
    
    importacao_data = await importacoes_collection.find_one({"id": importacao_id})
    if not importacao_data:
        return 0
    
    importacao = ImportacaoExtrato(**importacao_data)
    baixas_realizadas = 0
    
    for movimento in importacao.movimentos:
        if movimento.tipo_movimento != "credito":
            continue  # Only process credit movements
        
        # Find matching títulos
        candidatos = await encontrar_candidatos_conciliacao(movimento, contas_collection)
        
        # If single high-confidence match, process automatically
        if len(candidatos) == 1 and candidatos[0]["score"] >= 80:
            await realizar_baixa_automatica(candidatos[0]["titulo"], movimento, usuario, contas_collection)
            movimento.status_classificacao = "classificado"
            movimento.classificado_por = "sistema"
            movimento.data_classificacao = datetime.utcnow()
            baixas_realizadas += 1
        elif candidatos:
            # Set best candidate as suggestion
            melhor_candidato = max(candidatos, key=lambda x: x["score"])
            movimento.titulo_sugerido = melhor_candidato["titulo"]["id"]
            movimento.score_match = melhor_candidato["score"]
    
    # Update import with processed movements
    await importacoes_collection.update_one(
        {"id": importacao_id},
        {"$set": {"movimentos": [m.model_dump() for m in importacao.movimentos]}}
    )
    
    return baixas_realizadas

async def encontrar_candidatos_conciliacao(movimento: MovimentoExtrato, contas_collection) -> List[Dict]:
    """Find matching candidates for reconciliation"""
    candidatos = []
    
    # Query for open titles
    query = {
        "situacao": {"$in": [SituacaoTitulo.EM_ABERTO, SituacaoTitulo.ATRASADO]},
        "total_liquido": {"$gte": movimento.valor - 0.50, "$lte": movimento.valor + 0.50}  # Value tolerance
    }
    
    for conta_data in (await contas_collection.find(query)):
        conta = ContaReceber(**conta_data)
        score = calcular_score_match(movimento, conta)
        
        if score > 30:  # Minimum threshold
            candidatos.append({
                "titulo": conta_data,
                "score": score
            })
    
    return candidatos

def calcular_score_match(movimento: MovimentoExtrato, conta: ContaReceber) -> float:
    """Calculate matching score between movement and título"""
    score = 0
    
    # Exact value match
    if abs(movimento.valor - conta.total_liquido) < 0.01:
        score += 40
    elif abs(movimento.valor - conta.total_liquido) <= 0.50:
        score += 20
    
    # CNPJ match
    if movimento.cnpj_detectado and movimento.cnpj_detectado in conta.empresa:
        score += 50
    
    # Date proximity (within 30 days of due date)
    days_diff = abs((movimento.data_movimento - conta.data_vencimento).days)
    if days_diff <= 7:
        score += 15
    elif days_diff <= 30:
        score += 5
    
    # Text similarity (basic)
    if any(word.lower() in movimento.descricao_processada.lower() 
           for word in conta.empresa.split() if len(word) > 3):
        score += 15
    
    return score

async def realizar_baixa_automatica(titulo_data: Dict, movimento: MovimentoExtrato, usuario: str, contas_collection):
    """Perform automatic payment"""
    titulo = ContaReceber(**titulo_data)
    
    historico_action = HistoricoAlteracao(
        acao="Baixa automática por importação",
        usuario=usuario,
        observacao=f"Conciliado automaticamente com movimento: {movimento.descricao_processada}"
    )
    
    update_data = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": movimento.data_movimento,
        "valor_quitado": movimento.valor,
        "updated_at": datetime.utcnow()
    }
    
    await contas_collection.update_one(
        {"id": titulo.id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )

@router.get("/extrato/importacoes", response_model=List[ImportacaoExtrato])
async def listar_importacoes(
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """List import history"""
    check_financial_access(current_user)
    importacoes_collection = await get_importacoes_extrato_collection()
    
    query = {}
    if current_user.role != "admin":
        query["cidade"] = {"$in": current_user.allowed_cities}
    
    importacoes = []
    for importacao_data in await importacoes_collection.find(query, skip=skip, limit=limit):
        importacoes.append(ImportacaoExtrato(**importacao_data))
    
    return importacoes

@router.get("/extrato/classificacao/{importacao_id}")
async def obter_fila_classificacao(
    importacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get classification queue for manual processing"""
    check_financial_access(current_user)
    importacoes_collection = await get_importacoes_extrato_collection()
    
    importacao_data = await importacoes_collection.find_one({"id": importacao_id})
    if not importacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importação not found"
        )
    
    importacao = ImportacaoExtrato(**importacao_data)
    
    # Get only unclassified movements
    movimentos_pendentes = [m for m in importacao.movimentos if m.status_classificacao == "pendente"]
    
    return {
        "importacao_id": importacao_id,
        "total_pendentes": len(movimentos_pendentes),
        "movimentos": movimentos_pendentes
    }

@router.post("/extrato/classificar-movimento")
async def classificar_movimento(
    classificacao: ClassificacaoMovimento,
    current_user: UserResponse = Depends(get_current_user)
):
    """Manually classify movement"""
    check_financial_access(current_user)
    importacoes_collection = await get_importacoes_extrato_collection()
    contas_collection = await get_contas_receber_collection()
    
    importacao_data = await importacoes_collection.find_one({"id": classificacao.movimento_id.split('_')[0]})
    if not importacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importação not found"
        )
    
    importacao = ImportacaoExtrato(**importacao_data)
    
    # Find and update movement
    movimento_encontrado = None
    for movimento in importacao.movimentos:
        if movimento.id == classificacao.movimento_id:
            movimento_encontrado = movimento
            break
    
    if not movimento_encontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimento not found"
        )
    
    # Process classification
    if classificacao.acao == "associar_titulo" and classificacao.titulo_id:
        # Associate with existing título
        titulo_data = await contas_collection.find_one({"id": classificacao.titulo_id})
        if titulo_data:
            await realizar_baixa_automatica(titulo_data, movimento_encontrado, current_user.name, contas_collection)
    
    # Update movement status
    movimento_encontrado.status_classificacao = "classificado"
    movimento_encontrado.classificado_por = current_user.name
    movimento_encontrado.data_classificacao = datetime.utcnow()
    
    # Update import
    await importacoes_collection.update_one(
        {"id": importacao.id},
        {"$set": {"movimentos": [m.model_dump() for m in importacao.movimentos]}}
    )
    
    return {"message": "Movimento classificado com sucesso"}

# Financial Clients - Updated and expanded
@router.post("/clients", response_model=FinancialClient)
async def create_financial_client(
    client_data: FinancialClientCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new financial client"""
    check_financial_access(current_user)
    financial_clients_collection = await get_financial_clients_collection()
    
    # Check if client already exists
    existing_client = await financial_clients_collection.find_one({"empresa_id": client_data.empresa_id})
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Financial client already exists"
        )
    
    # Create client dict with proper serialization
    financial_client_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": client_data.empresa_id,
        "empresa": client_data.empresa,
        "client_id": client_data.client_id or client_data.empresa_id,
        "empresa_nome": client_data.empresa_nome or client_data.empresa,
        "cnpj": client_data.cnpj,
        "cidade": client_data.cidade,
        "valor_com_desconto": client_data.valor_com_desconto,
        "valor_boleto": client_data.valor_boleto,
        "valor_desconto": client_data.valor_desconto or 0.0,
        "data_vencimento": client_data.data_vencimento,
        "dia_vencimento": client_data.dia_vencimento,
        "tipo_honorario": client_data.tipo_honorario.value if hasattr(client_data.tipo_honorario, 'value') else client_data.tipo_honorario,
        "empresa_individual_grupo": client_data.empresa_individual_grupo.value if hasattr(client_data.empresa_individual_grupo, 'value') else client_data.empresa_individual_grupo,
        "contas_pagamento": client_data.contas_pagamento,
        "tipo_pagamento": client_data.tipo_pagamento.value if hasattr(client_data.tipo_pagamento, 'value') else client_data.tipo_pagamento,
        "forma_pagamento_especial": client_data.forma_pagamento_especial,
        "tipo_pagamento_especial": client_data.tipo_pagamento_especial,
        "tipo_empresa": client_data.tipo_empresa.value if hasattr(client_data.tipo_empresa, 'value') else client_data.tipo_empresa,
        "responsavel_financeiro": client_data.responsavel_financeiro,
        "quantidade_funcionarios": client_data.quantidade_funcionarios or 0,
        "status_fiscal": client_data.status_fiscal or "sem_movimento",
        "capacidade_pagamento": client_data.capacidade_pagamento or "paga_em_dia",
        "status_cliente": client_data.status_cliente or "ativa",
        "status_pagamento": client_data.status_pagamento.value if hasattr(client_data.status_pagamento, 'value') else client_data.status_pagamento,
        "observacoes": client_data.observacoes,
        "ultimo_pagamento": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await financial_clients_collection.insert_one(financial_client_dict)
    
    return FinancialClient(**financial_client_dict)

@router.get("/clients", response_model=List[FinancialClient])
async def get_financial_clients(
    current_user: UserResponse = Depends(get_current_user),
    status_pagamento: Optional[str] = Query(None),
    tipo_honorario: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get financial clients with filters"""
    check_financial_access(current_user)
    financial_clients_collection = await get_financial_clients_collection()
    
    # Build query
    query = {}
    
    # Status filter
    if status_pagamento:
        query["status_pagamento"] = status_pagamento
    
    # Type filter
    if tipo_honorario:
        query["tipo_honorario"] = tipo_honorario
    
    # Search filter
    if search:
        query["empresa"] = {"$regex": search, "$options": "i"}
    
    clients_cursor = await financial_clients_collection.find(query, skip=skip, limit=limit)
    clients = []
    async for client_data in clients_cursor:
        clients.append(FinancialClient(**client_data))
    
    return clients
@router.put("/clients/{client_id}", response_model=FinancialClient) 
async def update_financial_client(
    client_id: str,
    client_update: FinancialClientUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update financial client"""
    check_financial_access(current_user)
    financial_clients_collection = await get_financial_clients_collection()
    
    client_data = await financial_clients_collection.find_one({"id": client_id})
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )

    if _is_official_locked(client_data):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Official financial client is locked and cannot be edited"
        )
    
    # Build update data
    update_data = {k: v for k, v in client_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await financial_clients_collection.update_one({"id": client_id}, {"$set": update_data})
    
    # Get updated client
    updated_client_data = await financial_clients_collection.find_one({"id": client_id})
    return FinancialClient(**updated_client_data)

@router.delete("/clients/{client_id}")
async def delete_financial_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete financial client"""
    check_financial_access(current_user)
    financial_clients_collection = await get_financial_clients_collection()

    existing = await financial_clients_collection.find_one({"id": client_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )

    if _is_official_locked(existing):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Official financial client is locked and cannot be removed"
        )
    
    result = await financial_clients_collection.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )
    
    return {"message": "Financial client deleted successfully"}

@router.get("/clients/{client_id}", response_model=FinancialClient)
async def get_financial_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get financial client by ID"""
    check_financial_access(current_user)
    financial_clients_collection = await get_financial_clients_collection()
    
    client_data = await financial_clients_collection.find_one({"id": client_id})
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )
    
    return FinancialClient(**client_data)


@router.get("/contas-pagar")
async def list_contas_pagar(
    current_user: UserResponse = Depends(get_current_user),
    search: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
):
    check_financial_access(current_user)
    _, row = await _get_contas_pagar_settings_row()
    items = row.get("items", [])

    filtered = []
    search_text = _normalize_text(search) if search else ""
    situacao_text = _normalize_text(situacao) if situacao else ""

    for item in items:
        if situacao_text and _normalize_text(item.get("situacao", "")) != situacao_text:
            continue
        if search_text:
            haystack = " ".join(
                [
                    str(item.get("descricao", "")),
                    str(item.get("categoria", "")),
                    str(item.get("subcategoria", "")),
                    str(item.get("centro_custo", "")),
                    str(item.get("competencia", "")),
                    str(item.get("external_id", "")),
                ]
            )
            if search_text not in _normalize_text(haystack):
                continue
        filtered.append(item)

    filtered.sort(key=lambda i: (i.get("data_lancamento") or "", i.get("created_at") or ""), reverse=True)
    return {"items": filtered, "total": len(filtered)}


@router.post("/contas-pagar")
async def create_conta_pagar(
    payload: ContaPagarCreatePayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection, row = await _get_contas_pagar_settings_row()
    now_iso = datetime.utcnow().isoformat()

    item_id = str(uuid.uuid4())
    data_lancamento = (payload.data_lancamento or date.today()).isoformat()
    data_pagamento_ref = payload.data_pagamento_ref.isoformat() if payload.data_pagamento_ref else None
    data_reproducao = payload.data_reproducao.isoformat() if payload.data_reproducao else None

    item = {
        "id": item_id,
        "external_id": payload.external_id or item_id[:8].upper(),
        "descricao": payload.descricao,
        "categoria": payload.categoria or "",
        "subcategoria": payload.subcategoria or "",
        "valor": float(payload.valor or 0),
        "valor_pago": float(payload.valor_pago or 0),
        "juros": float(payload.juros or 0),
        "valor_restante": float(payload.valor_restante or 0),
        "situacao": payload.situacao or "em_aberto",
        "forma_pagamento": payload.forma_pagamento or "",
        "tipo_despesa": payload.tipo_despesa or "",
        "centro_custo": payload.centro_custo or "",
        "conta_utilizada": payload.conta_utilizada or "",
        "competencia": payload.competencia or "",
        "natureza_despesa": payload.natureza_despesa or "",
        "recorrente": bool(payload.recorrente),
        "tipo_parcela": payload.tipo_parcela or "",
        "numero_parcela": payload.numero_parcela,
        "total_parcelas": payload.total_parcelas,
        "prioridade": payload.prioridade or "",
        "comentario": payload.comentario or "",
        "comprovante_anexo": payload.comprovante_anexo or "",
        "pago": bool(payload.pago),
        "data_lancamento": data_lancamento,
        "data_pagamento_ref": data_pagamento_ref,
        "data_reproducao": data_reproducao,
        "created_at": now_iso,
        "updated_at": now_iso,
        "created_by_id": str(current_user.id),
        "created_by_name": str(current_user.name),
    }

    next_items = [item, *(row.get("items", []) if isinstance(row.get("items"), list) else [])]
    await collection.update_one(
        {"key": "contas_pagar"},
        {"$set": {"items": next_items, "updated_at": now_iso, "updated_by_id": str(current_user.id), "updated_by_name": str(current_user.name)}},
    )

    return {"message": "Conta a pagar criada com sucesso", "item": item}


@router.put("/contas-pagar/{conta_id}")
async def update_conta_pagar(
    conta_id: str,
    payload: ContaPagarUpdatePayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection, row = await _get_contas_pagar_settings_row()
    items = row.get("items", []) if isinstance(row.get("items"), list) else []
    now_iso = datetime.utcnow().isoformat()

    update_dict = payload.model_dump(exclude_unset=True)
    if "data_lancamento" in update_dict and update_dict["data_lancamento"]:
        update_dict["data_lancamento"] = update_dict["data_lancamento"].isoformat()
    if "data_pagamento_ref" in update_dict and update_dict["data_pagamento_ref"]:
        update_dict["data_pagamento_ref"] = update_dict["data_pagamento_ref"].isoformat()
    if "data_reproducao" in update_dict and update_dict["data_reproducao"]:
        update_dict["data_reproducao"] = update_dict["data_reproducao"].isoformat()

    updated = None
    next_items = []
    for item in items:
        if str(item.get("id")) == str(conta_id):
            merged = {**item, **update_dict, "updated_at": now_iso, "updated_by_id": str(current_user.id), "updated_by_name": str(current_user.name)}
            updated = merged
            next_items.append(merged)
        else:
            next_items.append(item)

    if not updated:
        raise HTTPException(status_code=404, detail="Conta a pagar não encontrada")

    await collection.update_one(
        {"key": "contas_pagar"},
        {"$set": {"items": next_items, "updated_at": now_iso, "updated_by_id": str(current_user.id), "updated_by_name": str(current_user.name)}},
    )

    return {"message": "Conta a pagar atualizada com sucesso", "item": updated}


@router.post("/contas-pagar/import-csv")
async def import_contas_pagar_csv(
    file: UploadFile = File(...),
    clear_existing: bool = Query(False),
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Arquivo inválido. Envie um CSV.")

    raw_bytes = await file.read()
    try:
        decoded = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_bytes.decode("latin-1")

    collection, row = await _get_contas_pagar_settings_row()
    existing_items = [] if clear_existing else (row.get("items", []) if isinstance(row.get("items"), list) else [])
    existing_by_external = {str(item.get("external_id")): item for item in existing_items if item.get("external_id")}

    reader = csv.DictReader(io.StringIO(decoded))
    now_iso = datetime.utcnow().isoformat()
    inserted = 0
    updated = 0

    for csv_row in reader:
        normalized_row = _build_normalized_csv_row(csv_row)
        external_id = str(_csv_get(normalized_row, "ID", "Id")).strip()
        descricao = str(_csv_get(normalized_row, "Descrição", "Descricao", "descricao")).strip()
        if not external_id and not descricao:
            continue
        if not external_id:
            external_id = _build_csv_row_external_id(csv_row)

        paid = _parse_bool(_csv_get(normalized_row, "Pago_Bool", "Pago"))
        situacao = _normalize_situacao(_csv_get(normalized_row, "Situação", "Situacao"), paid)

        item_payload = {
            "id": existing_by_external.get(external_id, {}).get("id") or str(uuid.uuid4()),
            "external_id": external_id,
            "descricao": descricao or "Sem descrição",
            "categoria": str(_csv_get(normalized_row, "Categoria") or "").strip(),
            "subcategoria": str(_csv_get(normalized_row, "Subcategoria") or "").strip(),
            "valor": _parse_br_decimal(_csv_get(normalized_row, "Valor_Num", "Valor")),
            "valor_pago": _parse_br_decimal(_csv_get(normalized_row, "Valor_Pago_Num", "Valor Pago")),
            "juros": _parse_br_decimal(_csv_get(normalized_row, "Juros_Num", "Juros")),
            "valor_restante": _parse_br_decimal(_csv_get(normalized_row, "Valor_Restante_Num", "Valor Restante")),
            "situacao": situacao,
            "forma_pagamento": str(_csv_get(normalized_row, "Forma de Pagamento") or "").strip(),
            "tipo_despesa": str(_csv_get(normalized_row, "Tipo de despesa") or "").strip(),
            "centro_custo": str(_csv_get(normalized_row, "Centro de Custo") or "").strip(),
            "conta_utilizada": str(_csv_get(normalized_row, "Conta Utilizada") or "").strip(),
            "competencia": str(_csv_get(normalized_row, "Competência", "Competencia") or "").strip(),
            "natureza_despesa": str(_csv_get(normalized_row, "Natureza da Despesa") or "").strip(),
            "recorrente": _parse_bool(_csv_get(normalized_row, "Recorrente")),
            "tipo_parcela": str(_csv_get(normalized_row, "Tipo de Parcela") or "").strip(),
            "numero_parcela": _parse_optional_int(_csv_get(normalized_row, "Nº da Parcela", "No da Parcela")),
            "total_parcelas": _parse_optional_int(_csv_get(normalized_row, "Total de Parcelas")),
            "prioridade": str(_csv_get(normalized_row, "Prioridade") or "").strip(),
            "comentario": str(_csv_get(normalized_row, "Comentário", "Comentario") or "").strip(),
            "comprovante_anexo": str(_csv_get(normalized_row, "Comprovante / Anexo") or "").strip(),
            "pago": paid,
            "data_lancamento": _parse_date_value(_csv_get(normalized_row, "Data_Lancamento", "Dia")) or date.today().isoformat(),
            "data_pagamento_ref": _parse_date_value(_csv_get(normalized_row, "Data_Pagamento_Ref", "Pagamento")),
            "data_reproducao": _parse_date_value(_csv_get(normalized_row, "Data_Reproducao_ISO", "Data de Reprodução")),
            "updated_at": now_iso,
            "updated_by_id": str(current_user.id),
            "updated_by_name": str(current_user.name),
            "import_source": "contas_a_pagar_csv",
        }

        if external_id and external_id in existing_by_external:
            existing = existing_by_external[external_id]
            item_payload["created_at"] = existing.get("created_at", now_iso)
            item_payload["created_by_id"] = existing.get("created_by_id", str(current_user.id))
            item_payload["created_by_name"] = existing.get("created_by_name", str(current_user.name))
            existing_by_external[external_id] = item_payload
            updated += 1
        else:
            item_payload["created_at"] = now_iso
            item_payload["created_by_id"] = str(current_user.id)
            item_payload["created_by_name"] = str(current_user.name)
            existing_items.append(item_payload)
            if external_id:
                existing_by_external[external_id] = item_payload
            inserted += 1

    # Merge updated references back into list
    merged = []
    for item in existing_items:
        ext_id = str(item.get("external_id") or "")
        if ext_id and ext_id in existing_by_external:
            merged.append(existing_by_external[ext_id])
        else:
            merged.append(item)

    # include updated records that may not have been present in existing_items structure
    merged_by_id = {str(item.get("id")): item for item in merged if item.get("id")}
    for updated_item in existing_by_external.values():
        item_id = str(updated_item.get("id") or "")
        if item_id and item_id not in merged_by_id:
            merged.append(updated_item)

    merged.sort(key=lambda i: (i.get("data_lancamento") or "", i.get("created_at") or ""), reverse=True)

    await collection.update_one(
        {"key": "contas_pagar"},
        {"$set": {"items": merged, "updated_at": now_iso, "updated_by_id": str(current_user.id), "updated_by_name": str(current_user.name)}},
    )

    return {
        "message": "Importação de contas a pagar concluída",
        "inserted": inserted,
        "updated": updated,
        "total": len(merged),
        "filename": file.filename,
    }


@router.get("/settings/honorarios")
async def get_financial_honorarios_settings(
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    row = await collection.find_one({"key": "honorarios"})
    return {"items": (row or {}).get("items", [])}


@router.put("/settings/honorarios")
async def update_financial_honorarios_settings(
    payload: FinancialHonorariosSettingsPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    now_iso = datetime.utcnow().isoformat()
    current = await collection.find_one({"key": "honorarios"})
    base = {
        "key": "honorarios",
        "items": payload.items or [],
        "updated_at": now_iso,
        "updated_by_id": str(current_user.id),
        "updated_by_name": str(current_user.name),
    }
    if current:
        await collection.update_one({"key": "honorarios"}, {"$set": base})
    else:
        await collection.insert_one({"id": str(uuid.uuid4()), "created_at": now_iso, **base})
    return {"message": "Financial honorarios settings saved", "items": payload.items or []}

# Busca avançada com filtros
@router.get("/settings/assinaturas/services")
async def get_financial_assinatura_services_settings(
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    row = await collection.find_one({"key": "assinaturas_services"})
    items = (row or {}).get("items")
    if not isinstance(items, list) or not items:
        items = DEFAULT_ASSINATURA_SERVICES
    return {"items": items}


@router.put("/settings/assinaturas/services")
async def update_financial_assinatura_services_settings(
    payload: FinancialAssinaturaServicesPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    now_iso = datetime.utcnow().isoformat()
    current = await collection.find_one({"key": "assinaturas_services"})
    base = {
        "key": "assinaturas_services",
        "items": payload.items or [],
        "updated_at": now_iso,
        "updated_by_id": str(current_user.id),
        "updated_by_name": str(current_user.name),
    }
    if current:
        await collection.update_one({"key": "assinaturas_services"}, {"$set": base})
    else:
        await collection.insert_one({"id": str(uuid.uuid4()), "created_at": now_iso, **base})
    return {"message": "Financial assinatura services settings saved", "items": payload.items or []}


@router.get("/settings/assinaturas/plans")
async def get_financial_assinatura_plans_settings(
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    row = await collection.find_one({"key": "assinaturas_plans"})
    items = (row or {}).get("items")
    if not isinstance(items, list):
        items = []
    return {"items": items}


@router.put("/settings/assinaturas/plans")
async def update_financial_assinatura_plans_settings(
    payload: FinancialAssinaturaPlansPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    check_financial_access(current_user)
    collection = await get_financial_settings_collection()
    now_iso = datetime.utcnow().isoformat()
    current = await collection.find_one({"key": "assinaturas_plans"})
    base = {
        "key": "assinaturas_plans",
        "items": payload.items or [],
        "updated_at": now_iso,
        "updated_by_id": str(current_user.id),
        "updated_by_name": str(current_user.name),
    }
    if current:
        await collection.update_one({"key": "assinaturas_plans"}, {"$set": base})
    else:
        await collection.insert_one({"id": str(uuid.uuid4()), "created_at": now_iso, **base})
    return {"message": "Financial assinatura plans settings saved", "items": payload.items or []}

@router.post("/contas-receber/search", response_model=List[ContaReceber])
async def search_contas_receber(
    filters: ContaReceberFilters,
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Advanced search for contas a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build query from filters
    query = {}
    
    # City access control
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif filters.cidade:
        query["cidade_atendimento"] = filters.cidade
    
    # Apply filters
    if filters.empresa:
        query["empresa"] = {"$regex": filters.empresa, "$options": "i"}
    
    if filters.cnpj:
        query["empresa"] = {"$regex": filters.cnpj.replace(".", "").replace("/", "").replace("-", ""), "$options": "i"}
    
    if filters.situacao:
        query["situacao"] = {"$in": [s.value for s in filters.situacao]}
    
    if filters.data_vencimento_inicio and filters.data_vencimento_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(filters.data_vencimento_inicio, datetime.min.time()),
            "$lte": datetime.combine(filters.data_vencimento_fim, datetime.max.time())
        }
    
    if filters.valor_minimo is not None or filters.valor_maximo is not None:
        valor_query = {}
        if filters.valor_minimo is not None:
            valor_query["$gte"] = filters.valor_minimo
        if filters.valor_maximo is not None:
            valor_query["$lte"] = filters.valor_maximo
        query["total_liquido"] = valor_query
    
    if filters.usuario_responsavel:
        query["usuario_responsavel"] = {"$regex": filters.usuario_responsavel, "$options": "i"}
    
    if filters.forma_pagamento:
        query["forma_pagamento"] = {"$in": [fp.value for fp in filters.forma_pagamento]}
    
    # Execute query
    contas_data = await contas_collection.find(query, skip=skip, limit=limit)
    contas = []
    for conta_data in contas_data:
        contas.append(ContaReceber(**conta_data))
    
    return contas

# Export data
@router.get("/export/contas-receber")
async def export_contas_receber(
    formato: str = Query("json", regex="^(json|csv)$"),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Export contas a receber data"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build query
    query = {}
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    
    if situacao:
        query["situacao"] = situacao
    
    if data_inicio and data_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    # Get data
    contas = []
    for conta_data in (await contas_collection.find(query)):
        contas.append(ContaReceber(**conta_data))
    
    if formato == "json":
        return {
            "data": [conta.model_dump() for conta in contas],
            "total_registros": len(contas),
            "data_export": datetime.utcnow()
        }
    else:  # CSV
        # Create CSV content
        csv_content = "ID,Empresa,Situacao,Descricao,Documento,Vencimento,Valor_Original,Total_Liquido,Cidade\n"
        for conta in contas:
            csv_content += f"{conta.id},{conta.empresa},{conta.situacao},{conta.descricao},{conta.documento},{conta.data_vencimento},{conta.valor_original},{conta.total_liquido},{conta.cidade_atendimento}\n"
        
        return {
            "content": csv_content,
            "filename": f"contas_receber_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }

# Dashboard com estatísticas avançadas - atualizado
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get comprehensive financial dashboard statistics"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build base query for user access
    base_query = {}
    if current_user.role != "admin":
        base_query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    
    # Total em aberto
    total_aberto_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value, SituacaoTitulo.RENEGOCIADO.value]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}, "count": {"$sum": 1}}}
    ])
    
    total_aberto = {"valor": 0, "count": 0}
    async for result in total_aberto_cursor:
        total_aberto = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Total atrasado (vencidos)
    hoje = datetime.now().date()
    total_atrasado_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value]}, "data_vencimento": {"$lt": datetime.combine(hoje, datetime.min.time())}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}, "count": {"$sum": 1}}}
    ])
    
    total_atrasado = {"valor": 0, "count": 0}
    async for result in total_atrasado_cursor:
        total_atrasado = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Total recebido no mês
    inicio_mes = datetime.combine(hoje.replace(day=1), datetime.min.time())
    total_recebido_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": SituacaoTitulo.PAGO.value, "data_recebimento": {"$gte": inicio_mes}}},
        {"$group": {"_id": None, "total": {"$sum": "$valor_quitado"}, "count": {"$sum": 1}}}
    ])
    
    total_recebido = {"valor": 0, "count": 0}
    async for result in total_recebido_cursor:
        total_recebido = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Aging (vencimento por faixas) - Simplified version
    aging_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value]}}},
        {"$group": {
            "_id": "aging",
            "total": {"$sum": "$total_liquido"},
            "count": {"$sum": 1}
        }}
    ])
    
    aging = {
        "a_vencer": {"valor": 0, "count": 0},
        "ate_30_dias": {"valor": 0, "count": 0},
        "31_60_dias": {"valor": 0, "count": 0},
        "61_90_dias": {"valor": 0, "count": 0},
        "acima_90_dias": {"valor": 0, "count": 0}
    }
    
    # For now, put all aging data in a_vencer (simplified)
    async for result in aging_cursor:
        aging["a_vencer"] = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    return {
        "total_aberto": total_aberto,
        "total_atrasado": total_atrasado,
        "total_recebido_mes": total_recebido,
        "aging": aging,
        "data_atualizacao": datetime.utcnow()
    }
