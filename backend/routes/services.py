"""
Rotas para módulo de Serviços/Tarefas
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from database_sql import AsyncSessionLocal
from models_sql import UserSQL, ClientSQL
from models_services import ServicoSQL, ComentarioServicoSQL, ServicesConfigurationSQL
from auth import get_current_user
from crud_sql import convert_to_dict, json_dumps, json_loads
from models.user import UserResponse
import json

router = APIRouter(prefix="/services", tags=["Services"])


def _normalize_sector(value: Optional[str]) -> str:
    raw = str(value or "").strip().lower()
    if "todos" in raw:
        return "todos"
    if "fisc" in raw:
        return "fiscal"
    if "finan" in raw:
        return "financeiro"
    if "trabalh" in raw:
        return "trabalhista"
    if "comer" in raw:
        return "comercial"
    if "contad" in raw or "societ" in raw:
        return "contadores"
    if "atend" in raw:
        return "atendimento"
    return raw

# ==================== MODELS ====================

class ServicoCreate(BaseModel):
    empresa_id: str
    tipo_servico: str
    setor: str
    cidade: str
    titulo: str
    descricao: str
    prioridade: str = "media"
    responsavel_id: Optional[str] = None
    data_prazo: Optional[date] = None
    observacoes: Optional[str] = None

class ServicoUpdate(BaseModel):
    tipo_servico: Optional[str] = None
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    prioridade: Optional[str] = None
    responsavel_id: Optional[str] = None
    data_prazo: Optional[date] = None
    observacoes: Optional[str] = None

class ComentarioCreate(BaseModel):
    comentario: str

class ServicoResponse(BaseModel):
    id: str
    numero: str
    empresa_id: str
    empresa_nome: str
    tipo_servico: str
    setor: str
    cidade: str
    titulo: str
    descricao: str
    status: str
    prioridade: str
    solicitante_id: str
    solicitante_nome: str
    responsavel_id: Optional[str]
    responsavel_nome: Optional[str]
    data_solicitacao: date
    data_prazo: Optional[date]
    data_inicio: Optional[datetime]
    data_conclusao: Optional[datetime]
    observacoes: Optional[str]
    conversation_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class ServicesConfigurationPayload(BaseModel):
    departments: Optional[List[dict]] = []
    membersByDepartment: Optional[dict] = {}
    assignmentsByDepartment: Optional[dict] = {}
    activityLogs: Optional[List[dict]] = []

# ==================== HELPER FUNCTIONS ====================

def gerar_numero_servico(ano: int, sequencia: int) -> str:
    """Gera número único do serviço"""
    return f"SRV-{ano}-{sequencia:04d}"

async def get_proximo_numero_servico(session) -> str:
    """Obtém próximo número de serviço"""
    ano_atual = datetime.now().year
    
    # Buscar último serviço do ano
    result = await session.execute(
        select(ServicoSQL)
        .where(ServicoSQL.numero.like(f"SRV-{ano_atual}-%"))
        .order_by(ServicoSQL.numero.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    
    if ultimo:
        # Extrair sequência do último número
        sequencia = int(ultimo.numero.split('-')[-1]) + 1
    else:
        sequencia = 1
    
    return gerar_numero_servico(ano_atual, sequencia)

def user_can_access_service(user: UserResponse, servico: ServicoSQL) -> bool:
    """Verifica se usuário pode acessar o serviço"""
    if user.role == 'admin':
        return True
    
    # Verificar cidade
    if 'Todas' not in user.allowed_cities and servico.cidade not in user.allowed_cities:
        return False
    
    # Verificar setor
    setores_permitidos = {_normalize_sector(p.get('setor')) for p in (user.permissoes or [])}
    if 'todos' not in setores_permitidos and _normalize_sector(servico.setor) not in setores_permitidos:
        return False
    
    return True

# ==================== ROUTES ====================

@router.get("/configuration")
async def get_services_configuration(
    current_user: UserResponse = Depends(get_current_user),
):
    """Retorna configuração persistida do módulo de serviços."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicesConfigurationSQL).where(ServicesConfigurationSQL.config_key == "default")
        )
        row = result.scalar_one_or_none()
        if not row:
            return {
                "departments": [],
                "membersByDepartment": {},
                "assignmentsByDepartment": {},
                "activityLogs": [],
            }

        try:
            payload = json.loads(row.payload_json or "{}")
        except Exception:
            payload = {}

        return {
            "departments": payload.get("departments", []),
            "membersByDepartment": payload.get("membersByDepartment", {}),
            "assignmentsByDepartment": payload.get("assignmentsByDepartment", {}),
            "activityLogs": payload.get("activityLogs", []),
        }


@router.put("/configuration")
async def update_services_configuration(
    payload: ServicesConfigurationPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    """Atualiza configuração persistida do módulo de serviços (admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar configurações de serviços")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicesConfigurationSQL).where(ServicesConfigurationSQL.config_key == "default")
        )
        row = result.scalar_one_or_none()
        serialized = json_dumps(
            {
                "departments": payload.departments or [],
                "membersByDepartment": payload.membersByDepartment or {},
                "assignmentsByDepartment": payload.assignmentsByDepartment or {},
                "activityLogs": payload.activityLogs or [],
            }
        )

        if row is None:
            row = ServicesConfigurationSQL(
                config_key="default",
                payload_json=serialized,
                updated_by_id=current_user.id,
                updated_by_name=current_user.name,
            )
            session.add(row)
        else:
            row.payload_json = serialized
            row.updated_by_id = current_user.id
            row.updated_by_name = current_user.name

        await session.commit()
        return {"message": "Configurações de serviços salvas com sucesso"}

@router.get("/dashboard")
async def get_dashboard(current_user: UserResponse = Depends(get_current_user)):
    """Dashboard com resumo de serviços"""
    async with AsyncSessionLocal() as session:
        # Filtros base
        filters = []
        
        # Filtro por cidade
        if 'Todas' not in current_user.allowed_cities:
            filters.append(ServicoSQL.cidade.in_(current_user.allowed_cities))
        
        # Filtro por setor (normalizado para evitar diferença de grafia/case)
        setores_permitidos = {
            _normalize_sector((p or {}).get("setor"))
            for p in (current_user.permissoes or [])
            if (p or {}).get("setor")
        }
        if setores_permitidos and "todos" not in setores_permitidos:
            filters.append(func.lower(ServicoSQL.setor).in_(setores_permitidos))
        
        # Novas tarefas (últimas 7 dias)
        from datetime import timedelta
        sete_dias_atras = datetime.now() - timedelta(days=7)
        
        result = await session.execute(
            select(func.count(ServicoSQL.id))
            .where(
                and_(
                    ServicoSQL.created_at >= sete_dias_atras,
                    *filters
                )
            )
        )
        novas_tarefas = result.scalar()
        
        # Minhas tarefas pendentes
        result = await session.execute(
            select(func.count(ServicoSQL.id))
            .where(
                and_(
                    ServicoSQL.responsavel_id == current_user.id,
                    ServicoSQL.status.in_(['pendente', 'em_andamento', 'aguardando_cliente']),
                    *filters
                )
            )
        )
        minhas_pendentes = result.scalar()
        
        # Tarefas por status
        result = await session.execute(
            select(ServicoSQL.status, func.count(ServicoSQL.id))
            .where(and_(*filters))
            .group_by(ServicoSQL.status)
        )
        por_status = {row[0]: row[1] for row in result.all()}
        
        # Tarefas por prioridade
        result = await session.execute(
            select(ServicoSQL.prioridade, func.count(ServicoSQL.id))
            .where(and_(*filters))
            .group_by(ServicoSQL.prioridade)
        )
        por_prioridade = {row[0]: row[1] for row in result.all()}
        
        # Tarefas atrasadas
        result = await session.execute(
            select(func.count(ServicoSQL.id))
            .where(
                and_(
                    ServicoSQL.data_prazo < date.today(),
                    ServicoSQL.status.in_(['pendente', 'em_andamento']),
                    *filters
                )
            )
        )
        atrasadas = result.scalar()
        
        return {
            "novas_tarefas": novas_tarefas,
            "minhas_pendentes": minhas_pendentes,
            "atrasadas": atrasadas,
            "por_status": por_status,
            "por_prioridade": por_prioridade
        }

@router.get("/", response_model=List[ServicoResponse])
async def list_services(
    status: Optional[str] = None,
    setor: Optional[str] = None,
    cidade: Optional[str] = None,
    responsavel_id: Optional[str] = None,
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista serviços com filtros"""
    async with AsyncSessionLocal() as session:
        query = select(ServicoSQL)
        filters = []
        
        # Filtros de permissão do usuário
        if 'Todas' not in current_user.allowed_cities:
            filters.append(ServicoSQL.cidade.in_(current_user.allowed_cities))
        
        setores_permitidos = {
            _normalize_sector(p.get('setor'))
            for p in (current_user.permissoes or [])
        }
        if setores_permitidos and 'todos' not in setores_permitidos:
            filters.append(func.lower(ServicoSQL.setor).in_(setores_permitidos))
        
        # Filtros da requisição
        if status:
            filters.append(ServicoSQL.status == status)
        if setor:
            filters.append(func.lower(ServicoSQL.setor) == _normalize_sector(setor))
        if cidade:
            filters.append(ServicoSQL.cidade == cidade)
        if responsavel_id:
            filters.append(ServicoSQL.responsavel_id == responsavel_id)
        
        if filters:
            query = query.where(and_(*filters))
        
        query = query.order_by(ServicoSQL.created_at.desc()).limit(limit)
        
        result = await session.execute(query)
        servicos = result.scalars().all()
        
        return [convert_to_dict(s) for s in servicos]

@router.get("/{servico_id}")
async def get_service(
    servico_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca serviço específico"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        if not user_can_access_service(current_user, servico):
            raise HTTPException(status_code=403, detail="Sem permissão para acessar este serviço")
        
        return convert_to_dict(servico)

@router.post("/", response_model=ServicoResponse)
async def create_service(
    data: ServicoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria novo serviço"""
    async with AsyncSessionLocal() as session:
        # Buscar empresa
        result = await session.execute(
            select(ClientSQL).where(ClientSQL.id == data.empresa_id)
        )
        empresa = result.scalar_one_or_none()
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        
        # Buscar responsável se fornecido
        responsavel_nome = None
        if data.responsavel_id:
            result = await session.execute(
                select(UserSQL).where(UserSQL.id == data.responsavel_id)
            )
            responsavel = result.scalar_one_or_none()
            if responsavel:
                responsavel_nome = responsavel.name
        
        # Gerar número
        numero = await get_proximo_numero_servico(session)
        
        # Criar serviço
        servico = ServicoSQL(
            numero=numero,
            empresa_id=data.empresa_id,
            empresa_nome=empresa.nome_empresa,
            tipo_servico=data.tipo_servico,
            setor=data.setor,
            cidade=data.cidade,
            titulo=data.titulo,
            descricao=data.descricao,
            prioridade=data.prioridade,
            solicitante_id=current_user.id,
            solicitante_nome=current_user.name,
            responsavel_id=data.responsavel_id,
            responsavel_nome=responsavel_nome,
            data_prazo=data.data_prazo,
            observacoes=data.observacoes,
            historico_alteracoes=json_dumps([{
                'data': datetime.now().isoformat(),
                'usuario': current_user.name,
                'acao': 'Serviço criado'
            }])
        )
        
        session.add(servico)
        await session.commit()
        await session.refresh(servico)
        
        return convert_to_dict(servico)

@router.put("/{servico_id}")
async def update_service(
    servico_id: str,
    data: ServicoUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualiza serviço"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        if not user_can_access_service(current_user, servico):
            raise HTTPException(status_code=403, detail="Sem permissão")
        
        # Histórico de alterações
        historico = json_loads(servico.historico_alteracoes)
        alteracoes = []
        
        # Atualizar campos
        if data.tipo_servico is not None:
            alteracoes.append(f"Tipo alterado de '{servico.tipo_servico}' para '{data.tipo_servico}'")
            servico.tipo_servico = data.tipo_servico
        
        if data.titulo is not None:
            servico.titulo = data.titulo
        
        if data.descricao is not None:
            servico.descricao = data.descricao
        
        if data.status is not None:
            alteracoes.append(f"Status alterado de '{servico.status}' para '{data.status}'")
            servico.status = data.status
            
            if data.status == 'em_andamento' and not servico.data_inicio:
                servico.data_inicio = datetime.now()
            elif data.status == 'concluido' and not servico.data_conclusao:
                servico.data_conclusao = datetime.now()
        
        if data.prioridade is not None:
            alteracoes.append(f"Prioridade alterada de '{servico.prioridade}' para '{data.prioridade}'")
            servico.prioridade = data.prioridade
        
        if data.responsavel_id is not None:
            # Buscar novo responsável
            result = await session.execute(
                select(UserSQL).where(UserSQL.id == data.responsavel_id)
            )
            responsavel = result.scalar_one_or_none()
            if responsavel:
                alteracoes.append(f"Responsável alterado para '{responsavel.name}'")
                servico.responsavel_id = data.responsavel_id
                servico.responsavel_nome = responsavel.name
        
        if data.data_prazo is not None:
            servico.data_prazo = data.data_prazo
        
        if data.observacoes is not None:
            servico.observacoes = data.observacoes
        
        # Adicionar ao histórico
        if alteracoes:
            historico.append({
                'data': datetime.now().isoformat(),
                'usuario': current_user.name,
                'acao': '; '.join(alteracoes)
            })
            servico.historico_alteracoes = json_dumps(historico)
        
        servico.updated_at = datetime.now()
        await session.commit()
        await session.refresh(servico)
        
        return convert_to_dict(servico)

@router.delete("/{servico_id}")
async def delete_service(
    servico_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Deleta serviço"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        # Apenas admin ou solicitante pode deletar
        if current_user.role != 'admin' and servico.solicitante_id != current_user.id:
            raise HTTPException(status_code=403, detail="Sem permissão para deletar")
        
        await session.delete(servico)
        await session.commit()
        
        return {"message": "Serviço deletado com sucesso"}

@router.post("/{servico_id}/comentarios")
async def add_comment(
    servico_id: str,
    data: ComentarioCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Adiciona comentário ao serviço"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        if not user_can_access_service(current_user, servico):
            raise HTTPException(status_code=403, detail="Sem permissão")
        
        comentario = ComentarioServicoSQL(
            servico_id=servico_id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            comentario=data.comentario
        )
        
        session.add(comentario)
        await session.commit()
        
        return {"message": "Comentário adicionado"}

@router.get("/{servico_id}/comentarios")
async def get_comments(
    servico_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista comentários do serviço"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        if not user_can_access_service(current_user, servico):
            raise HTTPException(status_code=403, detail="Sem permissão")
        
        result = await session.execute(
            select(ComentarioServicoSQL)
            .where(ComentarioServicoSQL.servico_id == servico_id)
            .order_by(ComentarioServicoSQL.created_at.asc())
        )
        comentarios = result.scalars().all()
        
        return [convert_to_dict(c) for c in comentarios]

@router.post("/{servico_id}/enviar-chat")
async def send_to_chat(
    servico_id: str,
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Envia serviço para uma conversa do chat"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoSQL).where(ServicoSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        if not user_can_access_service(current_user, servico):
            raise HTTPException(status_code=403, detail="Sem permissão")
        
        # Vincular com conversa
        servico.conversation_id = conversation_id
        
        # Adicionar ao histórico
        historico = json_loads(servico.historico_alteracoes)
        historico.append({
            'data': datetime.now().isoformat(),
            'usuario': current_user.name,
            'acao': 'Enviado para o chat'
        })
        servico.historico_alteracoes = json_dumps(historico)
        
        await session.commit()
        
        return {"message": "Serviço enviado para o chat", "conversation_id": conversation_id}
