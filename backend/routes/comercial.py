"""
Rotas para módulo Comercial
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy import select, func, and_, or_
from database_sql import AsyncSessionLocal
from models_sql import UserSQL, ClientSQL
from models_comercial import ServicoComercialSQL, OrdemServicoSQL, ContratoSQL, HistoricoContratoSQL
from auth import get_current_user
from crud_sql import convert_to_dict, json_dumps, json_loads
from models.user import UserResponse
import os
import shutil

router = APIRouter(prefix="/comercial", tags=["Comercial"])

# ==================== MODELS ====================

class ServicoComercialCreate(BaseModel):
    empresa_id: str
    tipo_servico: str
    descricao: str
    valor_servico: float
    valor_desconto: float = 0.0
    data_contratacao: date
    data_inicio_previsto: Optional[date] = None
    data_conclusao_prevista: Optional[date] = None
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None

class ContratoCreate(BaseModel):
    empresa_id: str
    nome_contrato: str
    tipo_servico: str
    descricao: Optional[str] = None
    valor_mensal: Optional[float] = None
    valor_total: Optional[float] = None
    forma_pagamento: Optional[str] = None
    data_assinatura: date
    data_inicio_vigencia: date
    data_vencimento: date
    renovacao_automatica: str = "nao"
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None
    clausulas_especiais: Optional[str] = None

class ContratoUpdate(BaseModel):
    nome_contrato: Optional[str] = None
    tipo_servico: Optional[str] = None
    descricao: Optional[str] = None
    valor_mensal: Optional[float] = None
    valor_total: Optional[float] = None
    forma_pagamento: Optional[str] = None
    data_vencimento: Optional[date] = None
    status: Optional[str] = None
    renovacao_automatica: Optional[str] = None
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None
    clausulas_especiais: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

async def gerar_numero_servico_comercial(session) -> str:
    """Gera número único para serviço comercial"""
    ano_atual = datetime.now().year
    result = await session.execute(
        select(ServicoComercialSQL)
        .where(ServicoComercialSQL.numero.like(f"SC-{ano_atual}-%"))
        .order_by(ServicoComercialSQL.numero.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    
    if ultimo:
        sequencia = int(ultimo.numero.split('-')[-1]) + 1
    else:
        sequencia = 1
    
    return f"SC-{ano_atual}-{sequencia:04d}"

async def gerar_numero_ordem_servico(session) -> str:
    """Gera número único para ordem de serviço"""
    ano_atual = datetime.now().year
    result = await session.execute(
        select(OrdemServicoSQL)
        .where(OrdemServicoSQL.numero.like(f"OS-{ano_atual}-%"))
        .order_by(OrdemServicoSQL.numero.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    
    if ultimo:
        sequencia = int(ultimo.numero.split('-')[-1]) + 1
    else:
        sequencia = 1
    
    return f"OS-{ano_atual}-{sequencia:04d}"

async def gerar_numero_contrato(session) -> str:
    """Gera número único para contrato"""
    ano_atual = datetime.now().year
    result = await session.execute(
        select(ContratoSQL)
        .where(ContratoSQL.numero.like(f"CTR-{ano_atual}-%"))
        .order_by(ContratoSQL.numero.desc())
        .limit(1)
    )
    ultimo = result.scalar_one_or_none()
    
    if ultimo:
        sequencia = int(ultimo.numero.split('-')[-1]) + 1
    else:
        sequencia = 1
    
    return f"CTR-{ano_atual}-{sequencia:04d}"

# ==================== SERVIÇOS COMERCIAIS ====================

@router.post("/servicos")
async def create_servico_comercial(
    data: ServicoComercialCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria serviço comercial e gera O.S. automaticamente"""
    async with AsyncSessionLocal() as session:
        # Buscar empresa
        result = await session.execute(
            select(ClientSQL).where(ClientSQL.id == data.empresa_id)
        )
        empresa = result.scalar_one_or_none()
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        
        # Buscar responsável
        responsavel_nome = None
        if data.responsavel_id:
            result = await session.execute(
                select(UserSQL).where(UserSQL.id == data.responsavel_id)
            )
            responsavel = result.scalar_one_or_none()
            if responsavel:
                responsavel_nome = responsavel.name
        
        # Calcular valor total
        valor_total = data.valor_servico - data.valor_desconto
        
        # Gerar números
        numero_servico = await gerar_numero_servico_comercial(session)
        numero_os = await gerar_numero_ordem_servico(session)
        
        # Criar serviço comercial
        servico = ServicoComercialSQL(
            numero=numero_servico,
            empresa_id=data.empresa_id,
            empresa_nome=empresa.nome_empresa,
            tipo_servico=data.tipo_servico,
            descricao=data.descricao,
            valor_servico=data.valor_servico,
            valor_desconto=data.valor_desconto,
            valor_total=valor_total,
            data_contratacao=data.data_contratacao,
            data_inicio_previsto=data.data_inicio_previsto,
            data_conclusao_prevista=data.data_conclusao_prevista,
            responsavel_id=data.responsavel_id,
            responsavel_nome=responsavel_nome,
            observacoes=data.observacoes
        )
        session.add(servico)
        await session.flush()
        
        # Criar O.S. automaticamente
        ordem_servico = OrdemServicoSQL(
            numero=numero_os,
            servico_id=servico.id,
            empresa_id=data.empresa_id,
            empresa_nome=empresa.nome_empresa,
            tipo_servico=data.tipo_servico,
            descricao_servico=data.descricao,
            valor_total=valor_total,
            data_emissao=date.today(),
            data_validade=data.data_conclusao_prevista
        )
        session.add(ordem_servico)
        
        await session.commit()
        await session.refresh(servico)
        
        return {
            "servico": convert_to_dict(servico),
            "ordem_servico": {
                "id": ordem_servico.id,
                "numero": ordem_servico.numero
            }
        }

@router.get("/servicos")
async def list_servicos_comerciais(
    status: Optional[str] = None,
    tipo_servico: Optional[str] = None,
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista serviços comerciais"""
    async with AsyncSessionLocal() as session:
        query = select(ServicoComercialSQL)
        filters = []
        
        if status:
            filters.append(ServicoComercialSQL.status == status)
        if tipo_servico:
            filters.append(ServicoComercialSQL.tipo_servico == tipo_servico)
        
        if filters:
            query = query.where(and_(*filters))
        
        query = query.order_by(ServicoComercialSQL.created_at.desc()).limit(limit)
        
        result = await session.execute(query)
        servicos = result.scalars().all()
        
        return [convert_to_dict(s) for s in servicos]

@router.get("/servicos/{servico_id}")
async def get_servico_comercial(
    servico_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca serviço comercial específico com O.S."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ServicoComercialSQL).where(ServicoComercialSQL.id == servico_id)
        )
        servico = result.scalar_one_or_none()
        
        if not servico:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        
        # Buscar O.S. vinculada
        result = await session.execute(
            select(OrdemServicoSQL).where(OrdemServicoSQL.servico_id == servico_id)
        )
        ordem_servico = result.scalar_one_or_none()
        
        servico_dict = convert_to_dict(servico)
        servico_dict['ordem_servico'] = convert_to_dict(ordem_servico) if ordem_servico else None
        
        return servico_dict

# ==================== ORDENS DE SERVIÇO ====================

@router.get("/ordens-servico")
async def list_ordens_servico(
    status: Optional[str] = None,
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista ordens de serviço"""
    async with AsyncSessionLocal() as session:
        query = select(OrdemServicoSQL)
        
        if status:
            query = query.where(OrdemServicoSQL.status == status)
        
        query = query.order_by(OrdemServicoSQL.created_at.desc()).limit(limit)
        
        result = await session.execute(query)
        ordens = result.scalars().all()
        
        return [convert_to_dict(o) for o in ordens]

@router.put("/ordens-servico/{os_id}/iniciar")
async def iniciar_ordem_servico(
    os_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Inicia execução da O.S."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(OrdemServicoSQL).where(OrdemServicoSQL.id == os_id)
        )
        ordem = result.scalar_one_or_none()
        
        if not ordem:
            raise HTTPException(status_code=404, detail="O.S. não encontrada")
        
        ordem.status = "em_execucao"
        ordem.data_inicio_execucao = datetime.now()
        ordem.executor_id = current_user.id
        ordem.executor_nome = current_user.name
        
        await session.commit()
        
        return {"message": "O.S. iniciada com sucesso"}

@router.put("/ordens-servico/{os_id}/concluir")
async def concluir_ordem_servico(
    os_id: str,
    observacoes: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Conclui execução da O.S."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(OrdemServicoSQL).where(OrdemServicoSQL.id == os_id)
        )
        ordem = result.scalar_one_or_none()
        
        if not ordem:
            raise HTTPException(status_code=404, detail="O.S. não encontrada")
        
        ordem.status = "concluida"
        ordem.data_conclusao = datetime.now()
        if observacoes:
            ordem.observacoes_execucao = observacoes
        
        # Atualizar serviço vinculado
        result = await session.execute(
            select(ServicoComercialSQL).where(ServicoComercialSQL.id == ordem.servico_id)
        )
        servico = result.scalar_one_or_none()
        if servico:
            servico.status = "concluido"
            servico.data_conclusao_real = datetime.now()
        
        await session.commit()
        
        return {"message": "O.S. concluída com sucesso"}

# ==================== CONTRATOS ====================

@router.post("/contratos")
async def create_contrato(
    data: ContratoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria novo contrato"""
    async with AsyncSessionLocal() as session:
        # Buscar empresa
        result = await session.execute(
            select(ClientSQL).where(ClientSQL.id == data.empresa_id)
        )
        empresa = result.scalar_one_or_none()
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")
        
        # Buscar responsável
        responsavel_nome = None
        if data.responsavel_id:
            result = await session.execute(
                select(UserSQL).where(UserSQL.id == data.responsavel_id)
            )
            responsavel = result.scalar_one_or_none()
            if responsavel:
                responsavel_nome = responsavel.name
        
        # Gerar número
        numero = await gerar_numero_contrato(session)
        
        # Criar contrato
        contrato = ContratoSQL(
            numero=numero,
            empresa_id=data.empresa_id,
            empresa_nome=empresa.nome_empresa,
            nome_contrato=data.nome_contrato,
            tipo_servico=data.tipo_servico,
            descricao=data.descricao,
            valor_mensal=data.valor_mensal,
            valor_total=data.valor_total,
            forma_pagamento=data.forma_pagamento,
            data_assinatura=data.data_assinatura,
            data_inicio_vigencia=data.data_inicio_vigencia,
            data_vencimento=data.data_vencimento,
            renovacao_automatica=data.renovacao_automatica,
            responsavel_id=data.responsavel_id,
            responsavel_nome=responsavel_nome,
            observacoes=data.observacoes,
            clausulas_especiais=data.clausulas_especiais
        )
        session.add(contrato)
        
        # Adicionar histórico
        historico = HistoricoContratoSQL(
            contrato_id=contrato.id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            acao="Contrato criado",
            descricao=f"Contrato {numero} criado"
        )
        session.add(historico)
        
        await session.commit()
        await session.refresh(contrato)
        
        return convert_to_dict(contrato)

@router.get("/contratos")
async def list_contratos(
    status: Optional[str] = None,
    vencendo_em: Optional[int] = None,  # dias
    limit: int = 100,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista contratos com filtros"""
    async with AsyncSessionLocal() as session:
        query = select(ContratoSQL)
        filters = []
        
        if status:
            filters.append(ContratoSQL.status == status)
        
        if vencendo_em:
            data_limite = date.today() + timedelta(days=vencendo_em)
            filters.append(
                and_(
                    ContratoSQL.data_vencimento <= data_limite,
                    ContratoSQL.data_vencimento >= date.today(),
                    ContratoSQL.status == "ativo"
                )
            )
        
        if filters:
            query = query.where(and_(*filters))
        
        query = query.order_by(ContratoSQL.data_vencimento.asc()).limit(limit)
        
        result = await session.execute(query)
        contratos = result.scalars().all()
        
        return [convert_to_dict(c) for c in contratos]

@router.get("/contratos/vencimentos")
async def get_calendario_vencimentos(current_user: UserResponse = Depends(get_current_user)):
    """Retorna contratos vencendo por período"""
    async with AsyncSessionLocal() as session:
        hoje = date.today()
        
        # Vencendo no mês
        result = await session.execute(
            select(func.count(ContratoSQL.id))
            .where(
                and_(
                    ContratoSQL.data_vencimento <= hoje + timedelta(days=30),
                    ContratoSQL.data_vencimento >= hoje,
                    ContratoSQL.status == "ativo"
                )
            )
        )
        mes = result.scalar()
        
        # Vencendo em 3 meses
        result = await session.execute(
            select(func.count(ContratoSQL.id))
            .where(
                and_(
                    ContratoSQL.data_vencimento <= hoje + timedelta(days=90),
                    ContratoSQL.data_vencimento >= hoje,
                    ContratoSQL.status == "ativo"
                )
            )
        )
        tres_meses = result.scalar()
        
        # Vencendo em 6 meses
        result = await session.execute(
            select(func.count(ContratoSQL.id))
            .where(
                and_(
                    ContratoSQL.data_vencimento <= hoje + timedelta(days=180),
                    ContratoSQL.data_vencimento >= hoje,
                    ContratoSQL.status == "ativo"
                )
            )
        )
        seis_meses = result.scalar()
        
        return {
            "vencendo_30_dias": mes,
            "vencendo_90_dias": tres_meses,
            "vencendo_180_dias": seis_meses
        }

@router.get("/contratos/{contrato_id}")
async def get_contrato(
    contrato_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca contrato específico"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ContratoSQL).where(ContratoSQL.id == contrato_id)
        )
        contrato = result.scalar_one_or_none()
        
        if not contrato:
            raise HTTPException(status_code=404, detail="Contrato não encontrado")
        
        return convert_to_dict(contrato)

@router.put("/contratos/{contrato_id}")
async def update_contrato(
    contrato_id: str,
    data: ContratoUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualiza contrato"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ContratoSQL).where(ContratoSQL.id == contrato_id)
        )
        contrato = result.scalar_one_or_none()
        
        if not contrato:
            raise HTTPException(status_code=404, detail="Contrato não encontrado")
        
        alteracoes = []
        
        # Atualizar campos
        for field, value in data.dict(exclude_unset=True).items():
            if value is not None:
                old_value = getattr(contrato, field)
                if old_value != value:
                    alteracoes.append(f"{field}: {old_value} → {value}")
                    setattr(contrato, field, value)
        
        # Adicionar histórico
        if alteracoes:
            historico = HistoricoContratoSQL(
                contrato_id=contrato_id,
                usuario_id=current_user.id,
                usuario_nome=current_user.name,
                acao="Contrato atualizado",
                descricao="; ".join(alteracoes)
            )
            session.add(historico)
        
        contrato.updated_at = datetime.now()
        await session.commit()
        await session.refresh(contrato)
        
        return convert_to_dict(contrato)

@router.post("/contratos/{contrato_id}/upload")
async def upload_contrato_pdf(
    contrato_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload de arquivo PDF do contrato"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ContratoSQL).where(ContratoSQL.id == contrato_id)
        )
        contrato = result.scalar_one_or_none()
        
        if not contrato:
            raise HTTPException(status_code=404, detail="Contrato não encontrado")
        
        # Validar tipo de arquivo
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")
        
        # Criar diretório se não existir
        upload_dir = "/app/backend/uploads/contratos"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Salvar arquivo
        file_path = f"{upload_dir}/{contrato.numero}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Atualizar contrato
        contrato.arquivo_contrato = file_path
        
        # Adicionar histórico
        historico = HistoricoContratoSQL(
            contrato_id=contrato_id,
            usuario_id=current_user.id,
            usuario_nome=current_user.name,
            acao="Upload de arquivo",
            descricao=f"Arquivo {file.filename} enviado"
        )
        session.add(historico)
        
        await session.commit()
        
        return {"message": "Arquivo enviado com sucesso", "file_path": file_path}

@router.get("/contratos/{contrato_id}/historico")
async def get_historico_contrato(
    contrato_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Busca histórico de alterações do contrato"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(HistoricoContratoSQL)
            .where(HistoricoContratoSQL.contrato_id == contrato_id)
            .order_by(HistoricoContratoSQL.data.desc())
        )
        historico = result.scalars().all()
        
        return [convert_to_dict(h) for h in historico]
