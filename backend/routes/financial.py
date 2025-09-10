from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.financial import ContaReceber, ContaReceberCreate, FinancialClient, FinancialClientCreate, HistoricoAction
from models.user import UserResponse
from auth import get_current_user
from database import get_contas_receber_collection, get_financial_clients_collection
from datetime import datetime, date

router = APIRouter(prefix="/financial", tags=["Financial"])

def check_financial_access(user: UserResponse):
    """Check if user has access to financial module"""
    if user.role != "admin" and "financeiro" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to financial module not allowed"
        )

# Contas a Receber
@router.post("/contas-receber", response_model=ContaReceber)
async def create_conta_receber(
    conta_data: ContaReceberCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new conta a receber"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Calculate totals
    total_bruto = conta_data.valor_original
    total_liquido = total_bruto
    
    conta = ContaReceber(
        **conta_data.model_dump(),
        situacao="em_aberto",
        total_bruto=total_bruto,
        total_liquido=total_liquido
    )
    
    # Convert to dict and ensure proper serialization
    conta_dict = conta.model_dump()
    
    # Convert date objects to datetime for MongoDB compatibility
    if isinstance(conta_dict.get('data_emissao'), date):
        conta_dict['data_emissao'] = datetime.combine(conta_dict['data_emissao'], datetime.min.time())
    if isinstance(conta_dict.get('data_vencimento'), date):
        conta_dict['data_vencimento'] = datetime.combine(conta_dict['data_vencimento'], datetime.min.time())
    
    await contas_collection.insert_one(conta_dict)
    return conta

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
    
    contas_cursor = contas_collection.find(query).skip(skip).limit(limit).sort("data_vencimento", -1)
    contas = []
    async for conta_data in contas_cursor:
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
    valor_recebido: float,
    data_recebimento: date,
    desconto: float = 0.0,
    acrescimo: float = 0.0,
    observacao: str = "",
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
    historico_action = HistoricoAction(
        data=datetime.utcnow(),
        acao="Baixa realizada",
        usuario=current_user.name,
        observacao=observacao,
        valor=valor_recebido
    )
    
    update_data = {
        "situacao": "pago",
        "data_recebimento": data_recebimento,
        "desconto_aplicado": desconto,
        "acrescimo_aplicado": acrescimo,
        "valor_quitado": valor_recebido,
        "total_liquido": conta.valor_original - desconto + acrescimo,
        "updated_at": datetime.utcnow(),
        "$push": {"historico": historico_action.model_dump()}
    }
    
    await contas_collection.update_one({"id": conta_id}, {"$set": update_data})
    
    # Get updated conta
    updated_conta_data = await contas_collection.find_one({"id": conta_id})
    return ContaReceber(**updated_conta_data)

# Financial Clients
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
    
    financial_client = FinancialClient(**client_data.model_dump())
    await financial_clients_collection.insert_one(financial_client.model_dump())
    
    return financial_client

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
    
    clients_cursor = financial_clients_collection.find(query).skip(skip).limit(limit).sort("empresa", 1)
    clients = []
    async for client_data in clients_cursor:
        clients.append(FinancialClient(**client_data))
    
    return clients

@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get financial dashboard statistics"""
    check_financial_access(current_user)
    contas_collection = await get_contas_receber_collection()
    
    # Build base query for user access
    base_query = {}
    if current_user.role != "admin":
        base_query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    
    # Total em aberto
    total_aberto_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": ["em_aberto", "atrasado", "renegociado"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}}}
    ])
    
    total_aberto = 0
    async for result in total_aberto_cursor:
        total_aberto = result.get("total", 0)
    
    # Total atrasado
    total_atrasado_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": "atrasado"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}}}
    ])
    
    total_atrasado = 0
    async for result in total_atrasado_cursor:
        total_atrasado = result.get("total", 0)
    
    # Total recebido
    total_recebido_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": "pago"}},
        {"$group": {"_id": None, "total": {"$sum": "$valor_quitado"}}}
    ])
    
    total_recebido = 0
    async for result in total_recebido_cursor:
        total_recebido = result.get("total", 0)
    
    return {
        "total_aberto": total_aberto,
        "total_atrasado": total_atrasado,
        "total_recebido": total_recebido
    }