from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.atendimento import (
    Ticket, TicketCreate, TicketUpdate, Conversa, ConversaCreate,
    ArtigoBaseConhecimento, ArtigoBaseConhecimentoCreate,
    AvaliacaoAtendimento, AtendimentoFilters, RelatorioAtendimento,
    DashboardAtendimento, StatusTicket, PrioridadeTicket,
    CanalAtendimento, TipoTicket, TipoResposta
)
from models.user import UserResponse
from auth import get_current_user
import os
_USE_SQL = os.getenv('USE_SQL', 'false').lower() == 'true'
if _USE_SQL:
    from database_compat import (
        get_atendimento_collection, get_base_conhecimento_collection,
        get_avaliacoes_atendimento_collection
    )
else:
    from database import (
        get_atendimento_collection, get_base_conhecimento_collection,
        get_avaliacoes_atendimento_collection
    )
from datetime import datetime, date, timedelta
import uuid

router = APIRouter(prefix="/atendimento", tags=["Atendimento"])

def check_atendimento_access(user: UserResponse):
    """Check if user has access to atendimento module"""
    if user.role != "admin" and "atendimento" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to atendimento module not allowed"
        )

def generate_ticket_number() -> str:
    """Generate sequential ticket number"""
    import random
    year = datetime.now().year
    number = random.randint(1000, 9999)  # In production, use proper sequence
    return f"#{year}{number:04d}"

def calculate_sla_deadlines(prioridade: PrioridadeTicket, data_abertura: datetime) -> dict:
    """Calculate SLA deadlines based on priority"""
    sla_config = {
        PrioridadeTicket.BAIXA: {"primeira_resposta": 240, "resolucao": 2880},      # 4h, 48h
        PrioridadeTicket.MEDIA: {"primeira_resposta": 120, "resolucao": 1440},      # 2h, 24h  
        PrioridadeTicket.ALTA: {"primeira_resposta": 60, "resolucao": 480},         # 1h, 8h
        PrioridadeTicket.URGENTE: {"primeira_resposta": 30, "resolucao": 240},      # 30min, 4h
        PrioridadeTicket.CRITICA: {"primeira_resposta": 15, "resolucao": 120}       # 15min, 2h
    }
    
    config = sla_config.get(prioridade, sla_config[PrioridadeTicket.MEDIA])
    
    return {
        "prazo_primeira_resposta": data_abertura + timedelta(minutes=config["primeira_resposta"]),
        "prazo_resolucao": data_abertura + timedelta(minutes=config["resolucao"])
    }

# Tickets - CRUD Completo
@router.post("/tickets", response_model=Ticket)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new ticket"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    data_abertura = datetime.utcnow()
    numero_ticket = generate_ticket_number()
    
    # Calculate SLA deadlines
    sla_deadlines = calculate_sla_deadlines(ticket_data.prioridade, data_abertura)
    
    ticket_dict = {
        "id": str(uuid.uuid4()),
        "numero": numero_ticket,
        "empresa_id": ticket_data.empresa_id,
        "empresa": ticket_data.empresa,
        "solicitante_nome": ticket_data.solicitante_nome,
        "solicitante_email": ticket_data.solicitante_email,
        "solicitante_telefone": ticket_data.solicitante_telefone,
        "titulo": ticket_data.titulo,
        "descricao": ticket_data.descricao,
        "tipo": ticket_data.tipo.value if hasattr(ticket_data.tipo, 'value') else ticket_data.tipo,
        "categoria": ticket_data.categoria,
        "prioridade": ticket_data.prioridade.value if hasattr(ticket_data.prioridade, 'value') else ticket_data.prioridade,
        "status": StatusTicket.ABERTO.value,
        "responsavel": ticket_data.responsavel,
        "equipe": ticket_data.equipe,
        "canal": ticket_data.canal.value if hasattr(ticket_data.canal, 'value') else ticket_data.canal,
        "data_abertura": datetime.combine(ticket_data.data_abertura, datetime.min.time()),
        "data_primeira_resposta": None,
        "data_resolucao": None,
        "data_fechamento": None,
        "sla": sla_deadlines["prazo_resolucao"],  # Mantido para compatibilidade
        "prazo_primeira_resposta": sla_deadlines["prazo_primeira_resposta"],
        "prazo_resolucao": sla_deadlines["prazo_resolucao"],
        "sla_primeira_resposta_violado": False,
        "sla_resolucao_violado": False,
        "tempo_primeira_resposta": None,
        "tempo_resolucao": None,
        "solucao": None,
        "satisfacao_cliente": None,
        "feedback_cliente": None,
        "tags": ticket_data.tags,
        "tickets_relacionados": [],
        "documentos_relacionados": [],
        "conversas": [],  # Mantido para compatibilidade
        "arquivos": [],   # Mantido para compatibilidade
        "historico_status": [
            {
                "data": data_abertura,
                "status_anterior": None,
                "status_novo": StatusTicket.ABERTO.value,
                "usuario": current_user.name,
                "observacao": "Ticket criado"
            }
        ],
        "created_at": data_abertura,
        "updated_at": data_abertura
    }
    
    await tickets_collection.insert_one(ticket_dict)
    return Ticket(**ticket_dict)

@router.get("/tickets", response_model=List[Ticket])
async def get_tickets(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = Query(None),
    prioridade: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    responsavel: Optional[str] = Query(None),
    equipe: Optional[str] = Query(None),
    canal: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    sla_violado: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get tickets with advanced filters"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    # Build query
    query = {}
    
    if status:
        query["status"] = status
    
    if prioridade:
        query["prioridade"] = prioridade
    
    if tipo:
        query["tipo"] = tipo
        
    if responsavel:
        query["responsavel"] = {"$regex": responsavel, "$options": "i"}
        
    if equipe:
        query["equipe"] = equipe
        
    if canal:
        query["canal"] = canal
    
    if data_inicio and data_fim:
        query["data_abertura"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    if sla_violado is not None:
        if sla_violado:
            query["$or"] = [
                {"sla_primeira_resposta_violado": True},
                {"sla_resolucao_violado": True}
            ]
        else:
            query["sla_primeira_resposta_violado"] = False
            query["sla_resolucao_violado"] = False
    
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"titulo": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}},
            {"solicitante_nome": {"$regex": search, "$options": "i"}},
            {"numero": {"$regex": search, "$options": "i"}}
        ]
    
    tickets_cursor = tickets_collection.find(query).skip(skip).limit(limit).sort("data_abertura", -1)
    tickets = []
    async for ticket_data in tickets_cursor:
        tickets.append(Ticket(**ticket_data))
    
    return tickets

@router.get("/tickets/{ticket_id}", response_model=Ticket)
async def get_ticket(
    ticket_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get ticket by ID"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    ticket_data = await tickets_collection.find_one({"id": ticket_id})
    if not ticket_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    return Ticket(**ticket_data)

@router.put("/tickets/{ticket_id}", response_model=Ticket)
async def update_ticket(
    ticket_id: str,
    ticket_update: TicketUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update ticket"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    existing_ticket = await tickets_collection.find_one({"id": ticket_id})
    if not existing_ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Build update data
    update_data = {k: v.value if hasattr(v, 'value') else v for k, v in ticket_update.model_dump().items() if v is not None}
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # Handle status changes
        if "status" in update_data:
            old_status = existing_ticket.get("status")
            new_status = update_data["status"]
            
            # Add to status history
            historico_entry = {
                "data": datetime.utcnow(),
                "status_anterior": old_status,
                "status_novo": new_status,
                "usuario": current_user.name,
                "observacao": f"Status alterado de {old_status} para {new_status}"
            }
            
            # Update special dates based on status
            if new_status == StatusTicket.RESOLVIDO.value and not existing_ticket.get("data_resolucao"):
                update_data["data_resolucao"] = datetime.utcnow()
                # Calculate resolution time
                data_abertura = existing_ticket.get("data_abertura")
                if data_abertura:
                    if isinstance(data_abertura, str):
                        data_abertura = datetime.fromisoformat(data_abertura.replace('Z', '+00:00'))
                    tempo_resolucao = (datetime.utcnow() - data_abertura).total_seconds() / 60
                    update_data["tempo_resolucao"] = int(tempo_resolucao)
            
            elif new_status == StatusTicket.FECHADO.value and not existing_ticket.get("data_fechamento"):
                update_data["data_fechamento"] = datetime.utcnow()
            
            await tickets_collection.update_one(
                {"id": ticket_id},
                {
                    "$set": update_data,
                    "$push": {"historico_status": historico_entry}
                }
            )
        else:
            await tickets_collection.update_one(
                {"id": ticket_id},
                {"$set": update_data}
            )
    
    updated_ticket_data = await tickets_collection.find_one({"id": ticket_id})
    return Ticket(**updated_ticket_data)

@router.delete("/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete ticket"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    result = await tickets_collection.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    return {"message": "Ticket deleted successfully"}

# Conversas/Mensagens
@router.post("/tickets/{ticket_id}/conversas", response_model=Conversa)
async def add_conversa(
    ticket_id: str,
    conversa_data: ConversaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Add conversation message to ticket"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    ticket_data = await tickets_collection.find_one({"id": ticket_id})
    if not ticket_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    conversa = Conversa(
        usuario=current_user.name,
        mensagem=conversa_data.mensagem,
        tipo=conversa_data.tipo,
        eh_publico=conversa_data.eh_publico,
        anexos=conversa_data.anexos
    )
    
    # Check if this is first response
    update_fields = {"updated_at": datetime.utcnow()}
    existing_conversas = ticket_data.get("conversas", [])
    
    if not existing_conversas and not ticket_data.get("data_primeira_resposta"):
        update_fields["data_primeira_resposta"] = datetime.utcnow()
        # Calculate first response time
        data_abertura = ticket_data.get("data_abertura")
        if data_abertura:
            if isinstance(data_abertura, str):
                data_abertura = datetime.fromisoformat(data_abertura.replace('Z', '+00:00'))
            tempo_primeira_resposta = (datetime.utcnow() - data_abertura).total_seconds() / 60
            update_fields["tempo_primeira_resposta"] = int(tempo_primeira_resposta)
    
    await tickets_collection.update_one(
        {"id": ticket_id},
        {
            "$push": {"conversas": conversa.model_dump()},
            "$set": update_fields
        }
    )
    
    return conversa

# Base de Conhecimento
@router.post("/base-conhecimento", response_model=ArtigoBaseConhecimento)
async def create_artigo(
    artigo_data: ArtigoBaseConhecimentoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create knowledge base article"""
    check_atendimento_access(current_user)
    base_collection = await get_base_conhecimento_collection()
    
    artigo_dict = {
        "id": str(uuid.uuid4()),
        "titulo": artigo_data.titulo,
        "conteudo": artigo_data.conteudo,
        "resumo": artigo_data.resumo,
        "categoria": artigo_data.categoria,
        "tags": artigo_data.tags,
        "publicado": artigo_data.publicado,
        "visivel_cliente": artigo_data.visivel_cliente,
        "visualizacoes": 0,
        "avaliacoes_positivas": 0,
        "avaliacoes_negativas": 0,
        "tickets_relacionados": [],
        "autor": current_user.name,
        "data_publicacao": datetime.utcnow() if artigo_data.publicado else None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await base_collection.insert_one(artigo_dict)
    return ArtigoBaseConhecimento(**artigo_dict)

@router.get("/base-conhecimento", response_model=List[ArtigoBaseConhecimento])
async def get_artigos(
    current_user: UserResponse = Depends(get_current_user),
    categoria: Optional[str] = Query(None),
    publicado: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get knowledge base articles"""
    check_atendimento_access(current_user)
    base_collection = await get_base_conhecimento_collection()
    
    query = {}
    
    if categoria:
        query["categoria"] = categoria
    
    if publicado is not None:
        query["publicado"] = publicado
    
    if search:
        query["$or"] = [
            {"titulo": {"$regex": search, "$options": "i"}},
            {"conteudo": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    
    artigos_cursor = base_collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
    artigos = []
    async for artigo_data in artigos_cursor:
        artigos.append(ArtigoBaseConhecimento(**artigo_data))
    
    return artigos

# Dashboard e Relatórios
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get atendimento dashboard statistics"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    # Tickets por status
    tickets_stats = {}
    for status_val in StatusTicket:
        count = await tickets_collection.count_documents({"status": status_val.value})
        tickets_stats[status_val.value] = count
    
    # Tickets com SLA violado
    tickets_sla_violado = await tickets_collection.count_documents({
        "$or": [
            {"sla_primeira_resposta_violado": True},
            {"sla_resolucao_violado": True}
        ]
    })
    
    # Tickets por prioridade
    tickets_prioridade = {}
    for prioridade_val in PrioridadeTicket:
        count = await tickets_collection.count_documents({"prioridade": prioridade_val.value})
        if count > 0:
            tickets_prioridade[prioridade_val.value] = count
    
    # Tickets por equipe
    pipeline_equipe = [
        {"$group": {"_id": "$equipe", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    tickets_por_equipe = {}
    async for result in tickets_collection.aggregate(pipeline_equipe):
        equipe = result["_id"] or "Não Atribuído"
        tickets_por_equipe[equipe] = result["count"]
    
    # Tempo médio de resposta (primeiras respostas)
    pipeline_tempo_resposta = [
        {"$match": {"tempo_primeira_resposta": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "tempo_medio": {"$avg": "$tempo_primeira_resposta"}}}
    ]
    
    tempo_medio_resposta = 0
    async for result in tickets_collection.aggregate(pipeline_tempo_resposta):
        tempo_medio_resposta = result.get("tempo_medio", 0)
    
    # Satisfação média
    pipeline_satisfacao = [
        {"$match": {"satisfacao_cliente": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "satisfacao_media": {"$avg": "$satisfacao_cliente"}}}
    ]
    
    satisfacao_media = 0
    async for result in tickets_collection.aggregate(pipeline_satisfacao):
        satisfacao_media = result.get("satisfacao_media", 0)
    
    return {
        "tickets_por_status": tickets_stats,
        "tickets_sla_violado": tickets_sla_violado,
        "tickets_por_prioridade": tickets_prioridade,
        "tickets_por_equipe": tickets_por_equipe,
        "tempo_medio_resposta": round(tempo_medio_resposta, 2),  # minutos
        "satisfacao_media": round(satisfacao_media, 2),
        "data_atualizacao": datetime.utcnow()
    }

@router.get("/relatorios/atendimento")
async def relatorio_atendimento(
    data_inicio: date = Query(...),
    data_fim: date = Query(...),
    equipe: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate attendance report"""
    check_atendimento_access(current_user)
    tickets_collection = await get_atendimento_collection()
    
    # Build query
    query = {
        "data_abertura": {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    }
    
    if equipe:
        query["equipe"] = equipe
    
    # Total tickets
    total_tickets = await tickets_collection.count_documents(query)
    
    # Tickets resolvidos
    query_resolvidos = {**query, "status": {"$in": [StatusTicket.RESOLVIDO.value, StatusTicket.FECHADO.value]}}
    tickets_resolvidos = await tickets_collection.count_documents(query_resolvidos)
    
    # Tickets em aberto
    query_abertos = {**query, "status": {"$in": [StatusTicket.ABERTO.value, StatusTicket.EM_ANDAMENTO.value]}}
    tickets_em_aberto = await tickets_collection.count_documents(query_abertos)
    
    # Taxa de resolução
    taxa_resolucao = (tickets_resolvidos / total_tickets * 100) if total_tickets > 0 else 0
    
    # Métricas de tempo
    pipeline_tempos = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "tempo_medio_primeira_resposta": {"$avg": "$tempo_primeira_resposta"},
            "tempo_medio_resolucao": {"$avg": "$tempo_resolucao"}
        }}
    ]
    
    tempo_medio_primeira_resposta = 0
    tempo_medio_resolucao = 0
    
    async for result in tickets_collection.aggregate(pipeline_tempos):
        tempo_medio_primeira_resposta = result.get("tempo_medio_primeira_resposta", 0) or 0
        tempo_medio_resolucao = result.get("tempo_medio_resolucao", 0) or 0
    
    # Satisfação média
    pipeline_satisfacao = [
        {"$match": {**query, "satisfacao_cliente": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": None, "satisfacao_media": {"$avg": "$satisfacao_cliente"}}}
    ]
    
    satisfacao_media = 0
    async for result in tickets_collection.aggregate(pipeline_satisfacao):
        satisfacao_media = result.get("satisfacao_media", 0) or 0
    
    # NPS médio (seria necessário collection separada para avaliações detalhadas)
    nps_medio = 0  # Placeholder
    
    # Violações SLA
    violacoes_sla = await tickets_collection.count_documents({
        **query,
        "$or": [
            {"sla_primeira_resposta_violado": True},
            {"sla_resolucao_violado": True}
        ]
    })
    
    return {
        "periodo": {
            "inicio": data_inicio,
            "fim": data_fim
        },
        "total_tickets": total_tickets,
        "tickets_resolvidos": tickets_resolvidos,
        "tickets_em_aberto": tickets_em_aberto,
        "taxa_resolucao": round(taxa_resolucao, 2),
        "tempo_medio_primeira_resposta": round(tempo_medio_primeira_resposta / 60, 2),  # horas
        "tempo_medio_resolucao": round(tempo_medio_resolucao / 60, 2),  # horas
        "satisfacao_media": round(satisfacao_media, 2),
        "nps_medio": nps_medio,
        "violacoes_sla": violacoes_sla,
        "data_geracao": datetime.utcnow()
    }

# Legacy endpoints for backward compatibility
@router.post("/", response_model=Ticket)
async def create_ticket_legacy(
    ticket_data: TicketCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Legacy endpoint"""
    return await create_ticket(ticket_data, current_user)

@router.get("/", response_model=List[Ticket])
async def get_tickets_legacy(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = Query(None),
    prioridade: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Legacy endpoint"""
    return await get_tickets(current_user, status, prioridade, None, None, None, None, None, None, None, search, skip, limit)