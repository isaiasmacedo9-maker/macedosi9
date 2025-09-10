from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.trabalhista import (
    SolicitacaoTrabalhista, SolicitacaoTrabalhistaCreate, SolicitacaoTrabalhistaUpdate,
    Funcionario, FuncionarioCreate, FuncionarioUpdate,
    ObrigacaoTrabalhista, ObrigacaoTrabalhistaCreate, ObrigacaoTrabalhistaUpdate,
    ChecklistTrabalhista, ItemChecklist, TrabalhistaFilters, RelatorioTrabalhista,
    TipoSolicitacao, StatusSolicitacao, PeriodicidadeObrigacao
)
from models.user import UserResponse
from auth import get_current_user
from database import (
    get_trabalhista_collection, get_funcionarios_collection, 
    get_obrigacoes_trabalhistas_collection, get_checklists_trabalhistas_collection
)
from datetime import datetime, date, timedelta
import uuid

router = APIRouter(prefix="/trabalhista", tags=["Trabalhista"])

def check_trabalhista_access(user: UserResponse):
    """Check if user has access to trabalhista module"""
    if user.role != "admin" and "trabalhista" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to trabalhista module not allowed"
        )

# Solicitações Trabalhistas
@router.post("/solicitacoes", response_model=SolicitacaoTrabalhista)
async def create_solicitacao(
    solicitacao_data: SolicitacaoTrabalhistaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Create solicitacao dict for MongoDB
    solicitacao_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": solicitacao_data.empresa_id,
        "empresa": solicitacao_data.empresa,
        "tipo": solicitacao_data.tipo.value if hasattr(solicitacao_data.tipo, 'value') else solicitacao_data.tipo,
        "titulo": solicitacao_data.titulo,
        "descricao": solicitacao_data.descricao,
        "data_solicitacao": datetime.combine(date.today(), datetime.min.time()),
        "prazo": datetime.combine(solicitacao_data.prazo, datetime.min.time()),
        "responsavel": solicitacao_data.responsavel,
        "status": StatusSolicitacao.PENDENTE.value,
        "prioridade": solicitacao_data.prioridade,
        "funcionario_id": solicitacao_data.funcionario_id,
        "tipo_afastamento": solicitacao_data.tipo_afastamento.value if solicitacao_data.tipo_afastamento else None,
        "periodo_afastamento": solicitacao_data.periodo_afastamento,
        "observacoes": solicitacao_data.observacoes,
        "documentos_anexos": [],
        "documentos_necessarios": [],
        "checklist_items": [],
        "historico_alteracoes": [
            {
                "data": datetime.utcnow(),
                "acao": "Solicitação criada",
                "usuario": current_user.name,
                "observacao": "Solicitação criada via sistema"
            }
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    if solicitacao_data.detalhes_folha:
        solicitacao_dict["detalhes_folha"] = solicitacao_data.detalhes_folha.model_dump()
    
    await trabalhista_collection.insert_one(solicitacao_dict)
    return SolicitacaoTrabalhista(**solicitacao_dict)

@router.get("/solicitacoes", response_model=List[SolicitacaoTrabalhista])
async def get_solicitacoes(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    responsavel: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get solicitacoes trabalhistas with filters"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Build query
    query = {}
    
    if tipo:
        query["tipo"] = tipo
    
    if status:
        query["status"] = status
        
    if responsavel:
        query["responsavel"] = {"$regex": responsavel, "$options": "i"}
    
    if data_inicio and data_fim:
        query["data_solicitacao"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"titulo": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}}
        ]
    
    solicitacoes_cursor = trabalhista_collection.find(query).skip(skip).limit(limit).sort("data_solicitacao", -1)
    solicitacoes = []
    async for solicitacao_data in solicitacoes_cursor:
        solicitacoes.append(SolicitacaoTrabalhista(**solicitacao_data))
    
    return solicitacoes

@router.get("/solicitacoes/{solicitacao_id}", response_model=SolicitacaoTrabalhista)
async def get_solicitacao(
    solicitacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get solicitacao trabalhista by ID"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    solicitacao_data = await trabalhista_collection.find_one({"id": solicitacao_id})
    
    if not solicitacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    return SolicitacaoTrabalhista(**solicitacao_data)

@router.put("/solicitacoes/{solicitacao_id}", response_model=SolicitacaoTrabalhista)
async def update_solicitacao(
    solicitacao_id: str,
    solicitacao_update: SolicitacaoTrabalhistaUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    existing_solicitacao = await trabalhista_collection.find_one({"id": solicitacao_id})
    if not existing_solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    # Build update data
    update_data = {k: v.value if hasattr(v, 'value') else v for k, v in solicitacao_update.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # Add to history
        historico_action = {
            "data": datetime.utcnow(),
            "acao": "Solicitação editada",
            "usuario": current_user.name,
            "observacao": f"Campos alterados: {', '.join(update_data.keys())}"
        }
        
        await trabalhista_collection.update_one(
            {"id": solicitacao_id}, 
            {
                "$set": update_data,
                "$push": {"historico_alteracoes": historico_action}
            }
        )
    
    updated_solicitacao_data = await trabalhista_collection.find_one({"id": solicitacao_id})
    return SolicitacaoTrabalhista(**updated_solicitacao_data)

@router.delete("/solicitacoes/{solicitacao_id}")
async def delete_solicitacao(
    solicitacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    result = await trabalhista_collection.delete_one({"id": solicitacao_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    return {"message": "Solicitacao deleted successfully"}

# Funcionários
@router.post("/funcionarios", response_model=Funcionario)
async def create_funcionario(
    funcionario_data: FuncionarioCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new funcionario"""
    check_trabalhista_access(current_user)
    funcionarios_collection = await get_funcionarios_collection()
    
    funcionario_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": funcionario_data.empresa_id,
        "dados_pessoais": funcionario_data.dados_pessoais.model_dump(),
        "dados_contratuais": funcionario_data.dados_contratuais.model_dump(),
        "status": "ativo",
        "observacoes": funcionario_data.observacoes,
        "documentos_anexos": [],
        "historico_alteracoes": [
            {
                "data": datetime.utcnow(),
                "acao": "Funcionário cadastrado",
                "usuario": current_user.name,
                "observacao": "Cadastro inicial"
            }
        ],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Convert dates to datetime
    if funcionario_dict["dados_contratuais"].get("data_admissao"):
        funcionario_dict["dados_contratuais"]["data_admissao"] = datetime.combine(
            funcionario_data.dados_contratuais.data_admissao, datetime.min.time()
        )
    
    await funcionarios_collection.insert_one(funcionario_dict)
    return Funcionario(**funcionario_dict)

@router.get("/funcionarios", response_model=List[Funcionario])
async def get_funcionarios(
    current_user: UserResponse = Depends(get_current_user),
    empresa_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get funcionarios with filters"""
    check_trabalhista_access(current_user)
    funcionarios_collection = await get_funcionarios_collection()
    
    query = {}
    
    if empresa_id:
        query["empresa_id"] = empresa_id
    
    if status:
        query["status"] = status
    
    if search:
        query["$or"] = [
            {"dados_pessoais.nome_completo": {"$regex": search, "$options": "i"}},
            {"dados_pessoais.cpf": {"$regex": search, "$options": "i"}},
            {"dados_contratuais.funcao": {"$regex": search, "$options": "i"}}
        ]
    
    funcionarios_cursor = funcionarios_collection.find(query).skip(skip).limit(limit).sort("dados_pessoais.nome_completo", 1)
    funcionarios = []
    async for funcionario_data in funcionarios_cursor:
        funcionarios.append(Funcionario(**funcionario_data))
    
    return funcionarios

# Obrigações Trabalhistas
@router.post("/obrigacoes", response_model=ObrigacaoTrabalhista)
async def create_obrigacao(
    obrigacao_data: ObrigacaoTrabalhistaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new obrigacao trabalhista"""
    check_trabalhista_access(current_user)
    obrigacoes_collection = await get_obrigacoes_trabalhistas_collection()
    
    # Calculate next due date
    hoje = date.today()
    if obrigacao_data.periodicidade == PeriodicidadeObrigacao.MENSAL:
        proximo_vencimento = hoje.replace(day=obrigacao_data.dia_vencimento)
        if proximo_vencimento <= hoje:
            if hoje.month == 12:
                proximo_vencimento = proximo_vencimento.replace(year=hoje.year + 1, month=1)
            else:
                proximo_vencimento = proximo_vencimento.replace(month=hoje.month + 1)
    else:
        proximo_vencimento = hoje.replace(day=obrigacao_data.dia_vencimento)  # Simplified
    
    obrigacao_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": obrigacao_data.empresa_id,
        "nome": obrigacao_data.nome,
        "descricao": obrigacao_data.descricao,
        "periodicidade": obrigacao_data.periodicidade.value,
        "dia_vencimento": obrigacao_data.dia_vencimento,
        "proximo_vencimento": datetime.combine(proximo_vencimento, datetime.min.time()),
        "status": "pendente",
        "responsavel": obrigacao_data.responsavel,
        "observacoes": obrigacao_data.observacoes,
        "arquivos_entrega": [],
        "historico_entregas": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await obrigacoes_collection.insert_one(obrigacao_dict)
    return ObrigacaoTrabalhista(**obrigacao_dict)

@router.get("/obrigacoes", response_model=List[ObrigacaoTrabalhista])
async def get_obrigacoes(
    current_user: UserResponse = Depends(get_current_user),
    empresa_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    vencimento_ate: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get obrigacoes trabalhistas with filters"""
    check_trabalhista_access(current_user)
    obrigacoes_collection = await get_obrigacoes_trabalhistas_collection()
    
    query = {}
    
    if empresa_id:
        query["empresa_id"] = empresa_id
    
    if status:
        query["status"] = status
        
    if vencimento_ate:
        query["proximo_vencimento"] = {"$lte": datetime.combine(vencimento_ate, datetime.max.time())}
    
    obrigacoes_cursor = obrigacoes_collection.find(query).skip(skip).limit(limit).sort("proximo_vencimento", 1)
    obrigacoes = []
    async for obrigacao_data in obrigacoes_cursor:
        obrigacoes.append(ObrigacaoTrabalhista(**obrigacao_data))
    
    return obrigacoes

# Dashboard e Relatórios
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get trabalhista dashboard statistics"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    funcionarios_collection = await get_funcionarios_collection()
    obrigacoes_collection = await get_obrigacoes_trabalhistas_collection()
    
    # Solicitações por status
    solicitacoes_stats = {}
    for status_val in StatusSolicitacao:
        count = await trabalhista_collection.count_documents({"status": status_val.value})
        solicitacoes_stats[status_val.value] = count
    
    # Funcionários por status
    funcionarios_ativos = await funcionarios_collection.count_documents({"status": "ativo"})
    funcionarios_total = await funcionarios_collection.count_documents({})
    
    # Obrigações vencendo (próximos 30 dias)
    data_limite = datetime.combine(date.today() + timedelta(days=30), datetime.max.time())
    obrigacoes_vencendo = await obrigacoes_collection.count_documents({
        "proximo_vencimento": {"$lte": data_limite},
        "status": "pendente"
    })
    
    # Solicitações por tipo
    solicitacoes_tipo = {}
    for tipo_val in TipoSolicitacao:
        count = await trabalhista_collection.count_documents({"tipo": tipo_val.value})
        if count > 0:
            solicitacoes_tipo[tipo_val.value] = count
    
    return {
        "solicitacoes_por_status": solicitacoes_stats,
        "funcionarios_ativos": funcionarios_ativos,
        "funcionarios_total": funcionarios_total,
        "obrigacoes_vencendo": obrigacoes_vencendo,
        "solicitacoes_por_tipo": solicitacoes_tipo,
        "data_atualizacao": datetime.utcnow()
    }

@router.get("/relatorios/mensal")
async def relatorio_mensal(
    mes: int = Query(..., ge=1, le=12),
    ano: int = Query(..., ge=2020),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate monthly trabalhista report"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    funcionarios_collection = await get_funcionarios_collection()
    
    # Date range for the month
    inicio_mes = datetime(ano, mes, 1)
    if mes == 12:
        fim_mes = datetime(ano + 1, 1, 1) - timedelta(days=1)
    else:
        fim_mes = datetime(ano, mes + 1, 1) - timedelta(days=1)
    
    # Solicitações no período
    solicitacoes_periodo = await trabalhista_collection.count_documents({
        "data_solicitacao": {"$gte": inicio_mes, "$lte": fim_mes}
    })
    
    # Admissões no período
    admissoes = await funcionarios_collection.count_documents({
        "dados_contratuais.data_admissao": {"$gte": inicio_mes, "$lte": fim_mes}
    })
    
    # Demissões no período (se houver data_demissao)
    demissoes = await funcionarios_collection.count_documents({
        "dados_contratuais.data_demissao": {"$gte": inicio_mes, "$lte": fim_mes}
    })
    
    return {
        "periodo": f"{mes:02d}/{ano}",
        "total_solicitacoes": solicitacoes_periodo,
        "admissoes": admissoes,
        "demissoes": demissoes,
        "saldo_funcionarios": admissoes - demissoes,
        "data_geracao": datetime.utcnow()
    }

# Backward compatibility - manter as rotas antigas
@router.post("/", response_model=SolicitacaoTrabalhista)
async def create_solicitacao_legacy(
    solicitacao_data: SolicitacaoTrabalhistaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Legacy endpoint - redirects to new endpoint"""
    return await create_solicitacao(solicitacao_data, current_user)

@router.get("/", response_model=List[SolicitacaoTrabalhista])
async def get_solicitacoes_legacy(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Legacy endpoint - redirects to new endpoint"""
    return await get_solicitacoes(current_user, tipo, status, None, search, None, None, skip, limit)