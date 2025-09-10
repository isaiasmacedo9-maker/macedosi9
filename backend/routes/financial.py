from fastapi import APIRouter, HTTPException, status, Depends, Query, File, UploadFile
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
from database import (
    get_contas_receber_collection, get_financial_clients_collection,
    get_importacoes_extrato_collection
)
from datetime import datetime, date, timedelta
import json
import uuid
import re
from typing import Dict, Any

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
    historico_action = HistoricoAlteracao(
        data=datetime.utcnow(),
        acao="Baixa realizada",
        usuario=current_user.name,
        observacao=observacao,
        valor_novo=str(valor_recebido)
    )
    
    update_data = {
        "situacao": SituacaoTitulo.PAGO,
        "data_recebimento": data_recebimento,
        "desconto_aplicado": desconto,
        "acrescimo_aplicado": acrescimo,
        "valor_quitado": valor_recebido,
        "total_liquido": conta.valor_original - desconto + acrescimo,
        "updated_at": datetime.utcnow(),
        "$push": {"historico_alteracoes": historico_action.model_dump()}
    }
    
    await contas_collection.update_one({"id": conta_id}, {"$set": update_data})
    
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
    nova_conta = ContaReceber(
        empresa_id=conta_original.empresa_id,
        empresa=conta_original.empresa,
        descricao=conta_original.descricao,
        documento=f"{conta_original.documento}-DUP",
        tipo_documento=conta_original.tipo_documento,
        forma_pagamento=conta_original.forma_pagamento,
        conta=conta_original.conta,
        centro_custo=conta_original.centro_custo,
        plano_custo=conta_original.plano_custo,
        data_emissao=date.today(),
        data_vencimento=nova_data_vencimento,
        valor_original=conta_original.valor_original,
        cidade_atendimento=conta_original.cidade_atendimento,
        usuario_responsavel=current_user.name,
        historico_alteracoes=[
            HistoricoAlteracao(
                acao="Criado por duplicação",
                usuario=current_user.name,
                observacao=f"Duplicado do título {conta_id}"
            )
        ]
    )
    
    await contas_collection.insert_one(nova_conta.model_dump())
    return nova_conta

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
    
    contato = ContatoCobranca(
        **contato_data.model_dump(),
        usuario_responsavel=current_user.name
    )
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"contatos_cobranca": contato.model_dump()}}
    )
    
    return contato

@router.post("/contas-receber/{conta_id}/proposta-renegociacao", response_model=PropostaRenegociacao)
async def create_proposta_renegociacao(
    conta_id: str,
    nova_data_vencimento: date,
    novo_valor: float,
    desconto_proposto: float = 0.0,
    condicoes: str = "",
    observacao: Optional[str] = None,
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
    
    proposta = PropostaRenegociacao(
        titulo_id=conta_id,
        nova_data_vencimento=nova_data_vencimento,
        novo_valor=novo_valor,
        desconto_proposto=desconto_proposto,
        condicoes=condicoes,
        observacao=observacao,
        usuario_responsavel=current_user.name
    )
    
    # Add to historical record
    historico_action = HistoricoAlteracao(
        acao="Proposta de renegociação criada",
        usuario=current_user.name,
        observacao=f"Nova data: {nova_data_vencimento}, Novo valor: R${novo_valor}"
    )
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"historico_alteracoes": historico_action.model_dump()}}
    )
    
    return proposta

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
    
    # Build query
    query = {
        "situacao": SituacaoTitulo.PAGO,
        "data_recebimento": {
            "$gte": data_inicio,
            "$lte": data_fim
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