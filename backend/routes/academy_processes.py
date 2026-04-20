"""
Rotas para Macedo Academy - Modelos e Processos Gerados.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime, date
from sqlalchemy import select
import json

from database_sql import AsyncSessionLocal
from models_academy_processes import AcademyProcessModelSQL, AcademyGeneratedProcessSQL
from models.user import UserResponse
from auth import get_current_user

router = APIRouter(prefix="/academy-processes", tags=["Academy Processes"])


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def json_loads(value: Optional[str], fallback: Any):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def model_to_dict(item: AcademyProcessModelSQL) -> Dict[str, Any]:
    return {
        "id": item.id,
        "nome": item.nome,
        "descricao": item.descricao or "",
        "setorDestino": item.setor_destino or "",
        "regimesConfig": json_loads(item.regimes_config, {}),
        "clientesExcecoesConfig": json_loads(item.clientes_excecoes_config, {}),
        "prazoConfig": json_loads(item.prazo_config, {}),
        "recorrenciaConfig": json_loads(item.recorrencia_config, {}),
        "etapas": json_loads(item.etapas, []),
        "metadata": json_loads(item.metadata_json, {}),
        "criado_por_id": item.criado_por_id,
        "criado_por_nome": item.criado_por_nome,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def generated_to_dict(item: AcademyGeneratedProcessSQL) -> Dict[str, Any]:
    return {
        "id": item.id,
        "model_id": item.model_id,
        "model_nome": item.model_nome,
        "cliente_nome": item.cliente_nome,
        "cliente_cnpj": item.cliente_cnpj,
        "status": item.status,
        "data_vencimento": item.data_vencimento.isoformat() if item.data_vencimento else None,
        "payload": json_loads(item.payload, {}),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


class AcademyProcessModelInput(BaseModel):
    id: Optional[str] = None
    nome: str
    descricao: Optional[str] = ""
    setorDestino: Optional[str] = ""
    regimesConfig: Optional[Dict[str, Any]] = {}
    clientesExcecoesConfig: Optional[Dict[str, Any]] = {}
    prazoConfig: Optional[Dict[str, Any]] = {}
    recorrenciaConfig: Optional[Dict[str, Any]] = {}
    etapas: Optional[List[Dict[str, Any]]] = []
    metadata: Optional[Dict[str, Any]] = {}


class GeneratedProcessInput(BaseModel):
    model_id: Optional[str] = None
    model_nome: str
    cliente_nome: str
    cliente_cnpj: Optional[str] = ""
    status: Optional[str] = "pendente"
    data_vencimento: Optional[date] = None
    payload: Optional[Dict[str, Any]] = {}


class GeneratedProcessUpdateInput(BaseModel):
    status: Optional[str] = None
    data_vencimento: Optional[date] = None
    payload: Optional[Dict[str, Any]] = None


class GenerateBatchInput(BaseModel):
    items: List[GeneratedProcessInput]


@router.get("/models")
async def list_models(current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyProcessModelSQL).order_by(AcademyProcessModelSQL.updated_at.desc())
        )
        rows = result.scalars().all()
        return [model_to_dict(item) for item in rows]


@router.post("/models")
async def create_model(data: AcademyProcessModelInput, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        row = AcademyProcessModelSQL(
            id=data.id if data.id else None,
            nome=data.nome,
            descricao=data.descricao or "",
            setor_destino=data.setorDestino or "",
            regimes_config=json_dumps(data.regimesConfig or {}),
            clientes_excecoes_config=json_dumps(data.clientesExcecoesConfig or {}),
            prazo_config=json_dumps(data.prazoConfig or {}),
            recorrencia_config=json_dumps(data.recorrenciaConfig or {}),
            etapas=json_dumps(data.etapas or []),
            metadata_json=json_dumps(data.metadata or {}),
            criado_por_id=current_user.id,
            criado_por_nome=current_user.name,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return model_to_dict(row)


@router.put("/models/{model_id}")
async def update_model(model_id: str, data: AcademyProcessModelInput, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyProcessModelSQL).where(AcademyProcessModelSQL.id == model_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo não encontrado")

        row.nome = data.nome
        row.descricao = data.descricao or ""
        row.setor_destino = data.setorDestino or ""
        row.regimes_config = json_dumps(data.regimesConfig or {})
        row.clientes_excecoes_config = json_dumps(data.clientesExcecoesConfig or {})
        row.prazo_config = json_dumps(data.prazoConfig or {})
        row.recorrencia_config = json_dumps(data.recorrenciaConfig or {})
        row.etapas = json_dumps(data.etapas or [])
        row.metadata_json = json_dumps(data.metadata or {})
        row.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(row)
        return model_to_dict(row)


@router.delete("/models/{model_id}")
async def delete_model(model_id: str, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyProcessModelSQL).where(AcademyProcessModelSQL.id == model_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Modelo não encontrado")
        await session.delete(row)
        await session.commit()
        return {"message": "Modelo removido com sucesso"}


@router.get("/generated")
async def list_generated(
    model_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user),
):
    async with AsyncSessionLocal() as session:
        query = select(AcademyGeneratedProcessSQL)
        if model_id:
            query = query.where(AcademyGeneratedProcessSQL.model_id == model_id)
        if status:
            query = query.where(AcademyGeneratedProcessSQL.status == status)
        query = query.order_by(AcademyGeneratedProcessSQL.created_at.desc())
        result = await session.execute(query)
        rows = result.scalars().all()
        return [generated_to_dict(item) for item in rows]


@router.post("/generated")
async def create_generated(data: GeneratedProcessInput, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        row = AcademyGeneratedProcessSQL(
            model_id=data.model_id,
            model_nome=data.model_nome,
            cliente_nome=data.cliente_nome,
            cliente_cnpj=data.cliente_cnpj or "",
            status=data.status or "pendente",
            data_vencimento=data.data_vencimento,
            payload=json_dumps(data.payload or {}),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return generated_to_dict(row)


@router.put("/generated/{generated_id}")
async def update_generated(generated_id: str, data: GeneratedProcessUpdateInput, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyGeneratedProcessSQL).where(AcademyGeneratedProcessSQL.id == generated_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Processo gerado não encontrado")

        if data.status is not None:
            row.status = data.status
        if data.data_vencimento is not None:
            row.data_vencimento = data.data_vencimento
        if data.payload is not None:
            row.payload = json_dumps(data.payload)
        row.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(row)
        return generated_to_dict(row)


@router.delete("/generated/{generated_id}")
async def delete_generated(generated_id: str, current_user: UserResponse = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyGeneratedProcessSQL).where(AcademyGeneratedProcessSQL.id == generated_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Processo gerado não encontrado")
        await session.delete(row)
        await session.commit()
        return {"message": "Processo gerado removido com sucesso"}


@router.post("/generate")
async def generate_batch(data: GenerateBatchInput, current_user: UserResponse = Depends(get_current_user)):
    if not data.items:
        return {"created": 0, "items": []}

    async with AsyncSessionLocal() as session:
        created_rows = []
        for item in data.items:
            row = AcademyGeneratedProcessSQL(
                model_id=item.model_id,
                model_nome=item.model_nome,
                cliente_nome=item.cliente_nome,
                cliente_cnpj=item.cliente_cnpj or "",
                status=item.status or "pendente",
                data_vencimento=item.data_vencimento,
                payload=json_dumps(item.payload or {}),
            )
            session.add(row)
            created_rows.append(row)
        await session.commit()
        for row in created_rows:
            await session.refresh(row)
        return {"created": len(created_rows), "items": [generated_to_dict(row) for row in created_rows]}


@router.get("/calendar")
async def get_calendar(
    mes: int = Query(..., ge=1, le=12),
    ano: int = Query(..., ge=2000, le=2100),
    current_user: UserResponse = Depends(get_current_user),
):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AcademyGeneratedProcessSQL).order_by(AcademyGeneratedProcessSQL.data_vencimento.asc(), AcademyGeneratedProcessSQL.created_at.asc())
        )
        rows = result.scalars().all()

        grouped = {}
        for row in rows:
            target_date = row.data_vencimento or (row.created_at.date() if row.created_at else None)
            if not target_date:
                continue
            if target_date.month != mes or target_date.year != ano:
                continue
            key = target_date.isoformat()
            grouped.setdefault(key, [])
            grouped[key].append(generated_to_dict(row))

        return grouped
