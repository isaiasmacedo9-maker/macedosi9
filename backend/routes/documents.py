from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user
from database_compat import get_documents_collection
from models.user import UserResponse

router = APIRouter(prefix="/documents", tags=["Documents"])


def _normalize_text(value: str = "") -> str:
    return str(value or "").strip().lower()


class DocumentCreate(BaseModel):
    nome: str
    setor: str
    origem: str  # contabilidade | cliente
    empresa_id: str
    empresa_nome: str
    tipo_documento: str
    data: Optional[str] = None  # yyyy-mm-dd


class DocumentUpdate(BaseModel):
    nome: Optional[str] = None
    setor: Optional[str] = None
    origem: Optional[str] = None
    empresa_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    tipo_documento: Optional[str] = None
    data: Optional[str] = None


def _check_docs_access(user: UserResponse):
    if user.role == "admin":
        return
    allowed = set((user.allowed_sectors or []))
    if "todos" in allowed or "documentos" in allowed:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access to documents module not allowed")


@router.get("/")
async def list_documents(
    origem: Optional[str] = Query(None),
    setor: Optional[str] = Query(None),
    empresa_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=5000),
    current_user: UserResponse = Depends(get_current_user),
):
    _check_docs_access(current_user)
    collection = await get_documents_collection()
    query: Dict[str, Any] = {}
    if origem:
        query["origem"] = origem
    if setor:
        query["setor"] = setor
    if empresa_id:
        query["empresa_id"] = empresa_id

    rows = await collection.find(query, limit=limit)
    docs: List[Dict[str, Any]] = list(rows)

    if search:
        needle = _normalize_text(search)
        docs = [
            doc
            for doc in docs
            if needle in _normalize_text(doc.get("empresa_nome", ""))
            or needle in _normalize_text(doc.get("nome", ""))
            or needle in _normalize_text(doc.get("tipo_documento", ""))
        ]

    docs.sort(key=lambda d: str(d.get("created_at") or d.get("data") or ""), reverse=True)
    return docs


@router.post("/")
async def create_document(
    payload: DocumentCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    _check_docs_access(current_user)
    collection = await get_documents_collection()
    doc = {
        "id": str(uuid.uuid4()),
        "nome": payload.nome,
        "setor": payload.setor,
        "origem": payload.origem,
        "empresa_id": payload.empresa_id,
        "empresa_nome": payload.empresa_nome,
        "tipo_documento": payload.tipo_documento,
        "data": payload.data or datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": str(current_user.id),
        "created_by_name": str(current_user.name),
    }
    await collection.insert_one(doc)
    return doc


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    payload: DocumentUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    _check_docs_access(current_user)
    collection = await get_documents_collection()
    existing = await collection.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not patch:
        return existing
    patch["updated_at"] = datetime.utcnow().isoformat()
    patch["updated_by_id"] = str(current_user.id)
    patch["updated_by_name"] = str(current_user.name)
    await collection.update_one({"id": doc_id}, {"$set": patch})
    return await collection.find_one({"id": doc_id})


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    _check_docs_access(current_user)
    collection = await get_documents_collection()
    existing = await collection.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await collection.delete_one({"id": doc_id})
    return {"message": "Document deleted successfully"}


@router.get("/types")
async def list_document_types(current_user: UserResponse = Depends(get_current_user)):
    _check_docs_access(current_user)
    collection = await get_documents_collection()
    rows = await collection.find({}, limit=5000)
    types = sorted(
        {
            str(row.get("tipo_documento", "")).strip()
            for row in rows
            if str(row.get("tipo_documento", "")).strip()
        },
        key=lambda s: s.lower(),
    )
    return {"types": types}
