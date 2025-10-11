"""
Rotas para gerenciamento de usuários com permissões granulares
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from sqlalchemy import select, delete, and_
from database_sql import AsyncSessionLocal
from models_sql import UserSQL
from models_chat_users import UserPermissionSQL, UserOnlineStatusSQL
from auth import get_admin_user, get_password_hash
from crud_sql import convert_to_dict, json_dumps, json_loads
import json

router = APIRouter(prefix="/users-management", tags=["User Management"])

# Constantes
CIDADES_DISPONIVEIS = ["Jacobina", "Ourolândia", "Umburanas", "Uberlândia", "Todas"]
SETORES_DISPONIVEIS = {
    "Atendimento": ["Tickets", "Base de Conhecimento", "Relatórios"],
    "Contadores": ["Solicitações", "Relatórios", "Dashboard"],
    "Comercial": ["Clientes", "Propostas", "Relatórios"],
    "Fiscal": ["Obrigações", "Notas Fiscais", "Relatórios"],
    "Financeiro": ["Clientes", "Clientes Financeiro", "Contas a Receber", "Relatórios"],
    "Trabalhista": ["Solicitações", "Funcionários", "Obrigações", "Relatórios"]
}

# ==================== MODELS ====================

class PermissaoSetor(BaseModel):
    setor: str
    visualizacoes: List[str]

class UserCreate(BaseModel):
    name: str
    password: str
    role: str = Field(..., pattern="^(admin|colaborador)$")
    allowed_cities: List[str]
    permissoes: List[PermissaoSetor] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|colaborador)$")
    allowed_cities: Optional[List[str]] = None
    permissoes: Optional[List[PermissaoSetor]] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    allowed_cities: List[str]
    allowed_sectors: List[str]  # Mantido para compatibilidade
    permissoes: List[PermissaoSetor]
    is_active: bool
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime

# ==================== HELPER FUNCTIONS ====================

def gerar_email(nome: str) -> str:
    """Gera email a partir do nome do usuário"""
    # Remove espaços extras e converte para lowercase
    nome_limpo = nome.strip().lower()
    # Remove acentos e caracteres especiais
    import unicodedata
    nome_sem_acento = ''.join(
        c for c in unicodedata.normalize('NFD', nome_limpo)
        if unicodedata.category(c) != 'Mn'
    )
    # Substitui espaços por pontos
    nome_email = nome_sem_acento.replace(' ', '.')
    # Remove caracteres não permitidos
    nome_email = ''.join(c for c in nome_email if c.isalnum() or c == '.')
    return f"{nome_email}@macedosi.com"

async def get_user_with_permissions(session, user_id: str):
    """Busca usuário com permissões"""
    # Buscar usuário
    result = await session.execute(select(UserSQL).where(UserSQL.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    
    # Buscar permissões
    result = await session.execute(
        select(UserPermissionSQL).where(UserPermissionSQL.user_id == user_id)
    )
    permissions = result.scalars().all()
    
    # Buscar status online
    result = await session.execute(
        select(UserOnlineStatusSQL).where(UserOnlineStatusSQL.user_id == user_id)
    )
    online_status = result.scalar_one_or_none()
    
    # Montar resposta
    user_dict = convert_to_dict(user)
    user_dict['permissoes'] = [
        {
            'setor': p.setor,
            'visualizacoes': json_loads(p.visualizacoes)
        }
        for p in permissions
    ]
    user_dict['is_online'] = online_status.is_online if online_status else False
    user_dict['last_seen'] = online_status.last_seen if online_status else None
    
    return user_dict

# ==================== ROUTES ====================

@router.get("/config")
async def get_configuration(current_user = Depends(get_admin_user)):
    """Retorna configurações disponíveis (cidades e setores)"""
    return {
        "cidades": CIDADES_DISPONIVEIS,
        "setores": SETORES_DISPONIVEIS
    }

@router.get("/basic")
async def list_users_basic(current_user = Depends(get_current_user)):
    """Lista usuários básicos (para chat) - não exige admin"""
    from auth import get_current_user
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserSQL).where(UserSQL.is_active == True))
        users = result.scalars().all()
        
        # Buscar status online
        users_response = []
        for user in users:
            result = await session.execute(
                select(UserOnlineStatusSQL).where(UserOnlineStatusSQL.user_id == user.id)
            )
            online_status = result.scalar_one_or_none()
            
            users_response.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'is_online': online_status.is_online if online_status else False
            })
        
        return users_response

@router.get("/", response_model=List[UserResponse])
async def list_users(current_user = Depends(get_admin_user)):
    """Lista todos os usuários com permissões"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserSQL))
        users = result.scalars().all()
        
        users_response = []
        for user in users:
            user_data = await get_user_with_permissions(session, user.id)
            if user_data:
                users_response.append(user_data)
        
        return users_response

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user = Depends(get_admin_user)):
    """Busca usuário específico"""
    async with AsyncSessionLocal() as session:
        user_data = await get_user_with_permissions(session, user_id)
        if not user_data:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        return user_data

@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user = Depends(get_admin_user)):
    """Cria novo usuário"""
    async with AsyncSessionLocal() as session:
        # Gerar email
        email = gerar_email(user_data.name)
        
        # Verificar se email já existe
        result = await session.execute(select(UserSQL).where(UserSQL.email == email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Email {email} já está em uso. Tente um nome diferente."
            )
        
        # Validar cidades
        for cidade in user_data.allowed_cities:
            if cidade not in CIDADES_DISPONIVEIS:
                raise HTTPException(status_code=400, detail=f"Cidade inválida: {cidade}")
        
        # Validar permissões
        for perm in user_data.permissoes:
            if perm.setor not in SETORES_DISPONIVEIS:
                raise HTTPException(status_code=400, detail=f"Setor inválido: {perm.setor}")
            visualizacoes_validas = SETORES_DISPONIVEIS[perm.setor]
            for vis in perm.visualizacoes:
                if vis not in visualizacoes_validas:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Visualização inválida '{vis}' para setor {perm.setor}"
                    )
        
        # Criar usuário
        hashed_password = get_password_hash(user_data.password)
        new_user = UserSQL(
            email=email,
            name=user_data.name,
            password_hash=hashed_password,
            role=user_data.role,
            allowed_cities=json_dumps(user_data.allowed_cities),
            allowed_sectors=json_dumps([p.setor for p in user_data.permissoes]),
            is_active=True
        )
        session.add(new_user)
        await session.flush()
        
        # Criar permissões
        for perm in user_data.permissoes:
            permission = UserPermissionSQL(
                user_id=new_user.id,
                setor=perm.setor,
                visualizacoes=json_dumps(perm.visualizacoes)
            )
            session.add(permission)
        
        # Criar status online
        online_status = UserOnlineStatusSQL(
            user_id=new_user.id,
            is_online=False,
            last_seen=datetime.utcnow()
        )
        session.add(online_status)
        
        await session.commit()
        
        # Retornar usuário criado
        user_response = await get_user_with_permissions(session, new_user.id)
        return user_response

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user = Depends(get_admin_user)):
    """Atualiza usuário"""
    async with AsyncSessionLocal() as session:
        # Buscar usuário
        result = await session.execute(select(UserSQL).where(UserSQL.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Atualizar campos básicos
        if user_data.name is not None:
            # Gerar novo email se nome mudou
            new_email = gerar_email(user_data.name)
            if new_email != user.email:
                # Verificar se novo email já existe
                result = await session.execute(
                    select(UserSQL).where(
                        and_(UserSQL.email == new_email, UserSQL.id != user_id)
                    )
                )
                if result.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Email {new_email} já está em uso"
                    )
                user.email = new_email
            user.name = user_data.name
        
        if user_data.password is not None:
            user.password_hash = get_password_hash(user_data.password)
        
        if user_data.role is not None:
            user.role = user_data.role
        
        if user_data.allowed_cities is not None:
            for cidade in user_data.allowed_cities:
                if cidade not in CIDADES_DISPONIVEIS:
                    raise HTTPException(status_code=400, detail=f"Cidade inválida: {cidade}")
            user.allowed_cities = json_dumps(user_data.allowed_cities)
        
        if user_data.is_active is not None:
            user.is_active = user_data.is_active
        
        # Atualizar permissões
        if user_data.permissoes is not None:
            # Validar permissões
            for perm in user_data.permissoes:
                if perm.setor not in SETORES_DISPONIVEIS:
                    raise HTTPException(status_code=400, detail=f"Setor inválido: {perm.setor}")
                visualizacoes_validas = SETORES_DISPONIVEIS[perm.setor]
                for vis in perm.visualizacoes:
                    if vis not in visualizacoes_validas:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Visualização inválida '{vis}' para setor {perm.setor}"
                        )
            
            # Remover permissões antigas
            await session.execute(
                delete(UserPermissionSQL).where(UserPermissionSQL.user_id == user_id)
            )
            
            # Criar novas permissões
            for perm in user_data.permissoes:
                permission = UserPermissionSQL(
                    user_id=user_id,
                    setor=perm.setor,
                    visualizacoes=json_dumps(perm.visualizacoes)
                )
                session.add(permission)
            
            # Atualizar allowed_sectors
            user.allowed_sectors = json_dumps([p.setor for p in user_data.permissoes])
        
        user.updated_at = datetime.utcnow()
        await session.commit()
        
        # Retornar usuário atualizado
        user_response = await get_user_with_permissions(session, user_id)
        return user_response

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_admin_user)):
    """Deleta usuário"""
    async with AsyncSessionLocal() as session:
        # Não permitir deletar o próprio usuário
        if user_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Você não pode deletar seu próprio usuário"
            )
        
        # Buscar usuário
        result = await session.execute(select(UserSQL).where(UserSQL.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Deletar permissões
        await session.execute(
            delete(UserPermissionSQL).where(UserPermissionSQL.user_id == user_id)
        )
        
        # Deletar status online
        await session.execute(
            delete(UserOnlineStatusSQL).where(UserOnlineStatusSQL.user_id == user_id)
        )
        
        # Deletar usuário
        await session.delete(user)
        await session.commit()
        
        return {"message": "Usuário deletado com sucesso"}

@router.get("/online/list")
async def list_online_users(current_user = Depends(get_admin_user)):
    """Lista usuários online"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserSQL, UserOnlineStatusSQL)
            .join(UserOnlineStatusSQL, UserSQL.id == UserOnlineStatusSQL.user_id)
            .where(UserOnlineStatusSQL.is_online == True)
        )
        
        online_users = []
        for user, status in result.all():
            user_dict = convert_to_dict(user)
            user_dict['last_activity'] = status.last_activity
            online_users.append(user_dict)
        
        return online_users
