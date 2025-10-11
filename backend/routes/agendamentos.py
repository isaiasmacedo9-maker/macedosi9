"""
Rotas para módulo de Agendamentos (Atendimento + Contadores)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, time, timedelta
from sqlalchemy import select, func, and_, or_
from database_sql import AsyncSessionLocal
from models_sql import UserSQL, ClientSQL
from models_agendamentos import (
    AgendamentoSQL, DisponibilidadeContadorSQL, 
    BloqueioAgendaSQL, HistoricoAgendamentoSQL
)
from auth import get_current_user
from crud_sql import convert_to_dict
from models.user import UserResponse

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])

# ==================== MODELS ====================

class AgendamentoCreate(BaseModel):
    empresa_id: str
    cliente_nome: str
    cliente_telefone: Optional[str] = None
    cliente_email: Optional[str] = None
    data_agendamento: date
    hora_inicio: str  # "14:00"
    hora_fim: str  # "15:00"
    duracao_minutos: str
    tipo_atendimento: str
    motivo_atendimento: str
    setor_responsavel: str
    contador_id: Optional[str] = None
    observacoes: Optional[str] = None

class AgendamentoUpdate(BaseModel):
    data_agendamento: Optional[date] = None
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    contador_id: Optional[str] = None
    status: Optional[str] = None
    motivo_recusa: Optional[str] = None
    notas_atendimento: Optional[str] = None

class DisponibilidadeCreate(BaseModel):
    contador_id: str
    dia_semana: str
    hora_inicio: str
    hora_fim: str

class BloqueioCreate(BaseModel):
    contador_id: str
    data_inicio: date
    data_fim: date
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    dia_todo: bool = True
    motivo: str
    descricao: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

async def gerar_numero_agendamento(session) -> str:
    """Gera número único para agendamento"""
    ano_atual = datetime.now().year
    result = await session.execute(
        select(AgendamentoSQL)
        .where(AgendamentoSQL.numero.like(f"AGD-{ano_atual}-%"))
        .order_by(AgendamentoSQL.numero.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    
    if ultimo:
        sequencia = int(ultimo.numero.split('-')[-1]) + 1
    else:
        sequencia = 1
    
    return f"AGD-{ano_atual}-{sequencia:04d}"

def parse_time(time_str: str) -> time:
    """Converte string HH:MM para time"""
    hours, minutes = map(int, time_str.split(':'))
    return time(hour=hours, minute=minutes)

async def verificar_disponibilidade(
    session, 
    contador_id: str, 
    data: date, 
    hora_inicio: time, 
    hora_fim: time,
    agendamento_id: Optional[str] = None
) -> bool:
    """Verifica se horário está disponível"""
    # Verificar bloqueios
    result = await session.execute(
        select(BloqueioAgendaSQL)
        .where(
            and_(
                BloqueioAgendaSQL.contador_id == contador_id,
                BloqueioAgendaSQL.data_inicio <= data,
                BloqueioAgendaSQL.data_fim >= data
            )
        )
    )
    bloqueios = result.scalars().all()
    
    for bloqueio in bloqueios:
        if bloqueio.dia_todo:
            return False
        if bloqueio.hora_inicio and bloqueio.hora_fim:
            if not (hora_fim <= bloqueio.hora_inicio or hora_inicio >= bloqueio.hora_fim):
                return False
    
    # Verificar agendamentos existentes
    query = select(AgendamentoSQL).where(
        and_(
            AgendamentoSQL.contador_id == contador_id,
            AgendamentoSQL.data_agendamento == data,
            AgendamentoSQL.status.in_(['pendente', 'confirmado'])
        )
    )
    
    if agendamento_id:
        query = query.where(AgendamentoSQL.id != agendamento_id)
    
    result = await session.execute(query)
    agendamentos = result.scalars().all()
    
    for agd in agendamentos:
        if not (hora_fim <= agd.hora_inicio or hora_inicio >= agd.hora_fim):
            return False
    
    return True

# ==================== ROUTES - AGENDAMENTOS ====================

@router.post("/")
async def create_agendamento(
    data: AgendamentoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria novo agendamento"""
    async with AsyncSessionLocal() as session:
        # Buscar empresa
        result = await session.execute(
            select(ClientSQL).where(ClientSQL.id == data.empresa_id)
        )
        empresa = result.scalar_one_or_none()
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        
        # Buscar contador se fornecido
        contador_nome = None
        if data.contador_id:
            result = await session.execute(
                select(UserSQL).where(UserSQL.id == data.contador_id)
            )
            contador = result.scalar_one_or_none()
            if contador:
                contador_nome = contador.name
                
                # Verificar disponibilidade
                hora_inicio = parse_time(data.hora_inicio)
                hora_fim = parse_time(data.hora_fim)
                
                disponivel = await verificar_disponibilidade(
                    session, data.contador_id, data.data_agendamento, 
                    hora_inicio, hora_fim
                )
                
                if not disponivel:
                    raise HTTPException(
                        status_code=400, 
                        detail="Horário não disponível para este contador"
                    )
        
        # Gerar número
        numero = await gerar_numero_agendamento(session)
        
        # Criar agendamento
        agendamento = AgendamentoSQL(
            numero=numero,
            empresa_id=data.empresa_id,
            empresa_nome=empresa.nome_empresa,
            cliente_nome=data.cliente_nome,
            cliente_telefone=data.cliente_telefone,
            cliente_email=data.cliente_email,
            data_agendamento=data.data_agendamento,
            hora_inicio=parse_time(data.hora_inicio),
            hora_fim=parse_time(data.hora_fim),
            duracao_minutos=data.duracao_minutos,
            tipo_atendimento=data.tipo_atendimento,
            motivo_atendimento=data.motivo_atendimento,
            setor_responsavel=data.setor_responsavel,
            contador_id=data.contador_id,
            contador_nome=contador_nome,
            solicitante_id=current_user.id,
            solicitante_nome=current_user.name,
            observacoes=data.observacoes,
            status='pendente' if data.contador_id else 'confirmado'
        )
        session.add(agendamento)
        
        # Adicionar histórico
        historico = HistoricoAgendamentoSQL(
            agendamento_id=agendamento.id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            acao="Agendamento criado",
            descricao=f"Agendamento {numero} criado"
        )
        session.add(historico)
        
        await session.commit()
        await session.refresh(agendamento)
        
        return convert_to_dict(agendamento)

@router.get("/")
async def list_agendamentos(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    contador_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista agendamentos com filtros"""
    async with AsyncSessionLocal() as session:
        query = select(AgendamentoSQL)
        filters = []
        
        if data_inicio:
            filters.append(AgendamentoSQL.data_agendamento >= data_inicio)
        if data_fim:
            filters.append(AgendamentoSQL.data_agendamento <= data_fim)
        if contador_id:
            filters.append(AgendamentoSQL.contador_id == contador_id)
        if status:
            filters.append(AgendamentoSQL.status == status)
        
        if filters:
            query = query.where(and_(*filters))
        
        query = query.order_by(
            AgendamentoSQL.data_agendamento.asc(),
            AgendamentoSQL.hora_inicio.asc()
        )
        
        result = await session.execute(query)
        agendamentos = result.scalars().all()
        
        return [convert_to_dict(a) for a in agendamentos]

@router.get("/calendario")
async def get_calendario(
    mes: int,
    ano: int,
    contador_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Retorna agendamentos do calendário mensal"""
    async with AsyncSessionLocal() as session:
        # Primeiro e último dia do mês
        data_inicio = date(ano, mes, 1)
        if mes == 12:
            data_fim = date(ano + 1, 1, 1) - timedelta(days=1)
        else:
            data_fim = date(ano, mes + 1, 1) - timedelta(days=1)
        
        query = select(AgendamentoSQL).where(
            and_(
                AgendamentoSQL.data_agendamento >= data_inicio,
                AgendamentoSQL.data_agendamento <= data_fim
            )
        )
        
        if contador_id:
            query = query.where(AgendamentoSQL.contador_id == contador_id)
        
        result = await session.execute(query)
        agendamentos = result.scalars().all()
        
        # Organizar por dia
        calendario = {}
        for agd in agendamentos:
            dia_str = agd.data_agendamento.isoformat()
            if dia_str not in calendario:
                calendario[dia_str] = []
            calendario[dia_str].append(convert_to_dict(agd))
        
        return calendario

@router.get("/{agendamento_id}")
async def get_agendamento(
    agendamento_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca agendamento específico"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgendamentoSQL).where(AgendamentoSQL.id == agendamento_id)
        )
        agendamento = result.scalar_one_or_none()
        
        if not agendamento:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        
        return convert_to_dict(agendamento)

@router.put("/{agendamento_id}")
async def update_agendamento(
    agendamento_id: str,
    data: AgendamentoUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualiza agendamento"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgendamentoSQL).where(AgendamentoSQL.id == agendamento_id)
        )
        agendamento = result.scalar_one_or_none()
        
        if not agendamento:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        
        alteracoes = []
        
        # Atualizar campos
        if data.data_agendamento:
            alteracoes.append(f"Data alterada para {data.data_agendamento}")
            agendamento.data_agendamento = data.data_agendamento
        
        if data.hora_inicio and data.hora_fim:
            hora_inicio = parse_time(data.hora_inicio)
            hora_fim = parse_time(data.hora_fim)
            
            if agendamento.contador_id:
                disponivel = await verificar_disponibilidade(
                    session, agendamento.contador_id, 
                    agendamento.data_agendamento,
                    hora_inicio, hora_fim, agendamento_id
                )
                if not disponivel:
                    raise HTTPException(status_code=400, detail="Horário não disponível")
            
            alteracoes.append(f"Horário alterado")
            agendamento.hora_inicio = hora_inicio
            agendamento.hora_fim = hora_fim
        
        if data.status:
            alteracoes.append(f"Status: {agendamento.status} → {data.status}")
            agendamento.status = data.status
        
        if data.motivo_recusa:
            agendamento.motivo_recusa = data.motivo_recusa
        
        if data.notas_atendimento:
            agendamento.notas_atendimento = data.notas_atendimento
        
        # Adicionar histórico
        if alteracoes:
            historico = HistoricoAgendamentoSQL(
                agendamento_id=agendamento_id,
                usuario_id=current_user.id,
                usuario_nome=current_user.name,
                acao="Agendamento atualizado",
                descricao="; ".join(alteracoes)
            )
            session.add(historico)
        
        agendamento.updated_at = datetime.now()
        await session.commit()
        await session.refresh(agendamento)
        
        return convert_to_dict(agendamento)

@router.post("/{agendamento_id}/confirmar")
async def confirmar_agendamento(
    agendamento_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Contador confirma o agendamento"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgendamentoSQL).where(AgendamentoSQL.id == agendamento_id)
        )
        agendamento = result.scalar_one_or_none()
        
        if not agendamento:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        
        agendamento.status = "confirmado"
        agendamento.notificacao_contador = True
        
        historico = HistoricoAgendamentoSQL(
            agendamento_id=agendamento_id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            acao="Agendamento confirmado",
            descricao="Contador confirmou o agendamento"
        )
        session.add(historico)
        
        await session.commit()
        
        return {"message": "Agendamento confirmado com sucesso"}

@router.post("/{agendamento_id}/recusar")
async def recusar_agendamento(
    agendamento_id: str,
    motivo: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Contador recusa o agendamento"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgendamentoSQL).where(AgendamentoSQL.id == agendamento_id)
        )
        agendamento = result.scalar_one_or_none()
        
        if not agendamento:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado")
        
        agendamento.status = "recusado"
        agendamento.motivo_recusa = motivo
        agendamento.notificacao_contador = True
        
        historico = HistoricoAgendamentoSQL(
            agendamento_id=agendamento_id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            acao="Agendamento recusado",
            descricao=f"Contador recusou: {motivo}"
        )
        session.add(historico)
        
        await session.commit()
        
        return {"message": "Agendamento recusado"}

# ==================== ROUTES - DISPONIBILIDADE ====================

@router.post("/disponibilidade")
async def create_disponibilidade(
    data: DisponibilidadeCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria disponibilidade de horário"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserSQL).where(UserSQL.id == data.contador_id)
        )
        contador = result.scalar_one_or_none()
        if not contador:
            raise HTTPException(status_code=404, detail="Contador não encontrado")
        
        disponibilidade = DisponibilidadeContadorSQL(
            contador_id=data.contador_id,
            contador_nome=contador.name,
            dia_semana=data.dia_semana,
            hora_inicio=parse_time(data.hora_inicio),
            hora_fim=parse_time(data.hora_fim)
        )
        session.add(disponibilidade)
        await session.commit()
        
        return {"message": "Disponibilidade criada"}

@router.get("/disponibilidade/{contador_id}")
async def get_disponibilidade(
    contador_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca disponibilidade do contador"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(DisponibilidadeContadorSQL)
            .where(
                and_(
                    DisponibilidadeContadorSQL.contador_id == contador_id,
                    DisponibilidadeContadorSQL.ativo == True
                )
            )
        )
        disponibilidades = result.scalars().all()
        
        return [convert_to_dict(d) for d in disponibilidades]

# ==================== ROUTES - BLOQUEIOS ====================

@router.post("/bloqueios")
async def create_bloqueio(
    data: BloqueioCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria bloqueio de agenda"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserSQL).where(UserSQL.id == data.contador_id)
        )
        contador = result.scalar_one_or_none()
        if not contador:
            raise HTTPException(status_code=404, detail="Contador não encontrado")
        
        bloqueio = BloqueioAgendaSQL(
            contador_id=data.contador_id,
            contador_nome=contador.name,
            data_inicio=data.data_inicio,
            data_fim=data.data_fim,
            dia_todo=data.dia_todo,
            motivo=data.motivo,
            descricao=data.descricao
        )
        
        if not data.dia_todo and data.hora_inicio and data.hora_fim:
            bloqueio.hora_inicio = parse_time(data.hora_inicio)
            bloqueio.hora_fim = parse_time(data.hora_fim)
        
        session.add(bloqueio)
        await session.commit()
        
        return {"message": "Bloqueio criado"}

@router.get("/bloqueios/{contador_id}")
async def get_bloqueios(
    contador_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista bloqueios do contador"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(BloqueioAgendaSQL)
            .where(BloqueioAgendaSQL.contador_id == contador_id)
            .order_by(BloqueioAgendaSQL.data_inicio.desc())
        )
        bloqueios = result.scalars().all()
        
        return [convert_to_dict(b) for b in bloqueios]

@router.get("/dashboard")
async def get_dashboard(current_user: UserResponse = Depends(get_current_user)):
    """Dashboard de agendamentos"""
    async with AsyncSessionLocal() as session:
        hoje = date.today()
        
        # Agendamentos de hoje
        result = await session.execute(
            select(func.count(AgendamentoSQL.id))
            .where(AgendamentoSQL.data_agendamento == hoje)
        )
        hoje_total = result.scalar()
        
        # Pendentes
        result = await session.execute(
            select(func.count(AgendamentoSQL.id))
            .where(AgendamentoSQL.status == 'pendente')
        )
        pendentes = result.scalar()
        
        # Próxima semana
        proxima_semana = hoje + timedelta(days=7)
        result = await session.execute(
            select(func.count(AgendamentoSQL.id))
            .where(
                and_(
                    AgendamentoSQL.data_agendamento >= hoje,
                    AgendamentoSQL.data_agendamento <= proxima_semana,
                    AgendamentoSQL.status.in_(['pendente', 'confirmado'])
                )
            )
        )
        proxima_semana_total = result.scalar()
        
        return {
            "hoje": hoje_total,
            "pendentes": pendentes,
            "proxima_semana": proxima_semana_total
        }
