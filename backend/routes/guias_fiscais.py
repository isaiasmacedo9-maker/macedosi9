"""
Rotas para Guias Fiscais - CRUD completo com upload de arquivos
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional
from pydantic import BaseModel, Field
from models.user import UserResponse
from auth import get_current_user
from database_adapter import DatabaseAdapter
from datetime import datetime, date
import uuid
import os
import shutil

router = APIRouter(prefix="/guias-fiscais", tags=["Guias Fiscais"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
GUIAS_DIR = os.path.join(UPLOAD_DIR, "guias")
COMPROVANTES_DIR = os.path.join(UPLOAD_DIR, "comprovantes")

os.makedirs(GUIAS_DIR, exist_ok=True)
os.makedirs(COMPROVANTES_DIR, exist_ok=True)


# ==================== MODELS ====================
class GuiaFiscalCreate(BaseModel):
    empresa_id: str
    empresa_nome: str
    tipo_guia: str
    competencia: str
    valor: float
    data_vencimento: str  # ISO date string
    data_pagamento: Optional[str] = None
    status: str = "pendente"
    colaborador_responsavel: str
    observacoes: Optional[str] = None


class GuiaFiscalUpdate(BaseModel):
    empresa_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    tipo_guia: Optional[str] = None
    competencia: Optional[str] = None
    valor: Optional[float] = None
    data_vencimento: Optional[str] = None
    data_pagamento: Optional[str] = None
    status: Optional[str] = None
    colaborador_responsavel: Optional[str] = None
    observacoes: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.get("/")
async def listar_guias(
    current_user: UserResponse = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    empresa: Optional[str] = Query(None),
    competencia: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Listar todas as guias fiscais com filtros opcionais"""
    async with DatabaseAdapter() as db:
        query = {}
        if status_filter:
            query["status"] = status_filter
        if empresa:
            query["empresa_nome"] = empresa
        if competencia:
            query["competencia"] = competencia

        guias = await db.find("guias_fiscais", query, limit=limit, skip=skip)
        total = await db.count_documents("guias_fiscais", query)

        return {
            "guias": guias,
            "total": total,
            "skip": skip,
            "limit": limit
        }


@router.get("/stats")
async def stats_guias(current_user: UserResponse = Depends(get_current_user)):
    """Estatísticas das guias fiscais"""
    async with DatabaseAdapter() as db:
        total = await db.count_documents("guias_fiscais", {})
        pendentes = await db.count_documents("guias_fiscais", {"status": "pendente"})
        pagas = await db.count_documents("guias_fiscais", {"status": "pago"})
        atrasadas = await db.count_documents("guias_fiscais", {"status": "atrasado"})

        # Calculate total value
        all_guias = await db.find("guias_fiscais", {}, limit=10000)
        valor_total = sum(g.get("valor", 0) for g in all_guias)
        valor_pendente = sum(g.get("valor", 0) for g in all_guias if g.get("status") == "pendente")
        valor_atrasado = sum(g.get("valor", 0) for g in all_guias if g.get("status") == "atrasado")

        return {
            "total": total,
            "pendentes": pendentes,
            "pagas": pagas,
            "atrasadas": atrasadas,
            "valor_total": valor_total,
            "valor_pendente": valor_pendente,
            "valor_atrasado": valor_atrasado
        }


@router.get("/{guia_id}")
async def obter_guia(
    guia_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Obter uma guia fiscal por ID"""
    async with DatabaseAdapter() as db:
        guia = await db.find_one("guias_fiscais", {"id": guia_id})
        if not guia:
            raise HTTPException(status_code=404, detail="Guia não encontrada")
        return guia


@router.post("/")
async def criar_guia(
    guia_data: GuiaFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Criar nova guia fiscal"""
    guia_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": guia_data.empresa_id,
        "empresa_nome": guia_data.empresa_nome,
        "tipo_guia": guia_data.tipo_guia,
        "competencia": guia_data.competencia,
        "valor": guia_data.valor,
        "data_vencimento": guia_data.data_vencimento,
        "data_pagamento": guia_data.data_pagamento,
        "status": guia_data.status,
        "colaborador_responsavel": guia_data.colaborador_responsavel,
        "colaborador_lancamento_id": current_user.id,
        "colaborador_lancamento_nome": current_user.name,
        "observacoes": guia_data.observacoes,
        "arquivo_guia": None,
        "arquivo_comprovante": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    async with DatabaseAdapter() as db:
        await db.insert_one("guias_fiscais", guia_dict)

    return guia_dict


@router.put("/{guia_id}")
async def atualizar_guia(
    guia_id: str,
    guia_data: GuiaFiscalUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualizar guia fiscal"""
    async with DatabaseAdapter() as db:
        existing = await db.find_one("guias_fiscais", {"id": guia_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        update_data = guia_data.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()

        await db.update_one("guias_fiscais", {"id": guia_id}, {"$set": update_data})

        updated = await db.find_one("guias_fiscais", {"id": guia_id})
        return updated


@router.delete("/{guia_id}")
async def excluir_guia(
    guia_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Excluir guia fiscal"""
    async with DatabaseAdapter() as db:
        existing = await db.find_one("guias_fiscais", {"id": guia_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        # Remove files if they exist
        if existing.get("arquivo_guia"):
            try:
                os.remove(existing["arquivo_guia"])
            except OSError:
                pass
        if existing.get("arquivo_comprovante"):
            try:
                os.remove(existing["arquivo_comprovante"])
            except OSError:
                pass

        await db.delete_one("guias_fiscais", {"id": guia_id})
        return {"message": "Guia excluída com sucesso"}


@router.post("/{guia_id}/upload-guia")
async def upload_arquivo_guia(
    guia_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload do arquivo PDF da guia"""
    async with DatabaseAdapter() as db:
        existing = await db.find_one("guias_fiscais", {"id": guia_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        # Save file
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        filename = f"{guia_id}_guia{ext}"
        filepath = os.path.join(GUIAS_DIR, filename)

        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        await db.update_one(
            "guias_fiscais",
            {"id": guia_id},
            {"$set": {"arquivo_guia": filepath, "updated_at": datetime.utcnow()}}
        )

        return {"message": "Arquivo da guia enviado", "filename": filename}


@router.post("/{guia_id}/upload-comprovante")
async def upload_comprovante(
    guia_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload do comprovante de pagamento"""
    async with DatabaseAdapter() as db:
        existing = await db.find_one("guias_fiscais", {"id": guia_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Guia não encontrada")

        ext = os.path.splitext(file.filename)[1] or ".pdf"
        filename = f"{guia_id}_comprovante{ext}"
        filepath = os.path.join(COMPROVANTES_DIR, filename)

        with open(filepath, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        await db.update_one(
            "guias_fiscais",
            {"id": guia_id},
            {"$set": {"arquivo_comprovante": filepath, "updated_at": datetime.utcnow()}}
        )

        return {"message": "Comprovante enviado", "filename": filename}


@router.get("/{guia_id}/download-guia")
async def download_arquivo_guia(
    guia_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Download do arquivo PDF da guia"""
    async with DatabaseAdapter() as db:
        guia = await db.find_one("guias_fiscais", {"id": guia_id})
        if not guia:
            raise HTTPException(status_code=404, detail="Guia não encontrada")
        if not guia.get("arquivo_guia") or not os.path.exists(guia["arquivo_guia"]):
            raise HTTPException(status_code=404, detail="Arquivo não encontrado")

        return FileResponse(guia["arquivo_guia"], filename=os.path.basename(guia["arquivo_guia"]))


@router.get("/{guia_id}/download-comprovante")
async def download_comprovante(
    guia_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Download do comprovante de pagamento"""
    async with DatabaseAdapter() as db:
        guia = await db.find_one("guias_fiscais", {"id": guia_id})
        if not guia:
            raise HTTPException(status_code=404, detail="Guia não encontrada")
        if not guia.get("arquivo_comprovante") or not os.path.exists(guia["arquivo_comprovante"]):
            raise HTTPException(status_code=404, detail="Comprovante não encontrado")

        return FileResponse(guia["arquivo_comprovante"], filename=os.path.basename(guia["arquivo_comprovante"]))
