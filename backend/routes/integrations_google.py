from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import get_admin_user
from database_compat import get_configuracoes_collection
from models.user import UserResponse
from services.google_drive_service import (
    DEFAULT_GOOGLE_SCOPES,
    GoogleDriveService,
    GoogleIntegrationError,
    decrypt_service_account_payload,
    encrypt_service_account_payload,
    parse_service_account_input,
)

router = APIRouter(prefix="/integrations/google-drive", tags=["Google Drive Integration"])

GOOGLE_INTEGRATION_KEY = "google_drive_integration"


class GoogleDriveConfigurePayload(BaseModel):
    enabled: bool = True
    root_folder_id: str
    service_account_json: Optional[Any] = None
    scopes: Optional[list[str]] = None


class GoogleDriveTemplatesPayload(BaseModel):
    contrato_template_file_id: Optional[str] = None
    ordem_servico_template_file_id: Optional[str] = None
    contas_receber_relatorio_geral_template_file_id: Optional[str] = None
    contas_receber_relatorio_cliente_template_file_id: Optional[str] = None
    os_template_file_id: Optional[str] = None
    chat_attachments_folder_name: Optional[str] = None


def _normalize_scopes(scopes: Optional[list[str]]) -> list[str]:
    values = [str(item).strip() for item in (scopes or []) if str(item).strip()]
    return values or list(DEFAULT_GOOGLE_SCOPES)


def _normalize_templates(payload: GoogleDriveTemplatesPayload) -> Dict[str, Any]:
    data = payload.model_dump()
    templates: Dict[str, Any] = {
        "comercial": {
            "contrato_template_file_id": str(data.get("contrato_template_file_id") or "").strip(),
            "ordem_servico_template_file_id": str(data.get("ordem_servico_template_file_id") or "").strip(),
        },
        "financeiro": {
            "contas_receber_relatorio_geral_template_file_id": str(
                data.get("contas_receber_relatorio_geral_template_file_id") or ""
            ).strip(),
            "contas_receber_relatorio_cliente_template_file_id": str(
                data.get("contas_receber_relatorio_cliente_template_file_id") or ""
            ).strip(),
        },
        "chat": {
            "attachments_folder_name": str(data.get("chat_attachments_folder_name") or "Anexos do Chat").strip(),
        },
        "os_template_file_id": str(data.get("os_template_file_id") or "").strip(),
    }
    return templates


def _mask_email(email: str) -> str:
    text = str(email or "").strip()
    if "@" not in text:
        return ""
    name, domain = text.split("@", 1)
    if len(name) <= 2:
        masked_name = "*" * len(name)
    else:
        masked_name = name[0] + ("*" * (len(name) - 2)) + name[-1]
    return f"{masked_name}@{domain}"


def _safe_json_load(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


async def _get_integration_document() -> tuple[Any, Optional[Dict[str, Any]], Dict[str, Any]]:
    collection = await get_configuracoes_collection()
    row = await collection.find_one({"chave": GOOGLE_INTEGRATION_KEY})
    payload = _safe_json_load(str((row or {}).get("valor") or ""))
    return collection, row, payload


def _public_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    service_email = str(payload.get("service_account_email") or "")
    templates = payload.get("templates") if isinstance(payload.get("templates"), dict) else {}
    return {
        "configured": bool(payload.get("credentials_encrypted")),
        "enabled": bool(payload.get("enabled", False)),
        "root_folder_id": payload.get("root_folder_id", ""),
        "service_account_email_masked": _mask_email(service_email),
        "scopes": payload.get("scopes") or list(DEFAULT_GOOGLE_SCOPES),
        "last_test_at": payload.get("last_test_at"),
        "last_test_status": payload.get("last_test_status"),
        "last_test_error": payload.get("last_test_error"),
        "updated_at": payload.get("updated_at"),
        "updated_by_name": payload.get("updated_by_name"),
        "templates": templates,
    }


@router.get("/status")
async def get_google_drive_status(current_user: UserResponse = Depends(get_admin_user)):
    collection, row, payload = await _get_integration_document()
    _ = collection
    _ = row
    return _public_status(payload)


@router.post("/configure")
async def configure_google_drive(
    req: GoogleDriveConfigurePayload,
    current_user: UserResponse = Depends(get_admin_user),
):
    collection, row, current_payload = await _get_integration_document()

    scopes = _normalize_scopes(req.scopes)
    now_iso = datetime.utcnow().isoformat()

    credentials_payload = None
    if req.service_account_json is not None:
        try:
            credentials_payload = parse_service_account_input(req.service_account_json)
        except GoogleIntegrationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    encrypted_credentials = current_payload.get("credentials_encrypted", "")
    service_account_email = str(current_payload.get("service_account_email") or "")
    project_id = str(current_payload.get("project_id") or "")
    client_id = str(current_payload.get("client_id") or "")

    if credentials_payload is not None:
        encrypted_credentials = encrypt_service_account_payload(credentials_payload)
        service_account_email = str(credentials_payload.get("client_email") or "")
        project_id = str(credentials_payload.get("project_id") or "")
        client_id = str(credentials_payload.get("client_id") or "")

    if not encrypted_credentials:
        raise HTTPException(
            status_code=400,
            detail="Informe o JSON da service account na primeira configuração.",
        )

    next_payload = {
        "enabled": bool(req.enabled),
        "root_folder_id": str(req.root_folder_id or "").strip(),
        "credentials_encrypted": encrypted_credentials,
        "service_account_email": service_account_email,
        "project_id": project_id,
        "client_id": client_id,
        "scopes": scopes,
        "templates": current_payload.get("templates") if isinstance(current_payload.get("templates"), dict) else {},
        "updated_at": now_iso,
        "updated_by_id": str(current_user.id),
        "updated_by_name": str(current_user.name),
        "last_test_at": current_payload.get("last_test_at"),
        "last_test_status": current_payload.get("last_test_status"),
        "last_test_error": current_payload.get("last_test_error"),
    }

    document = {
        "id": str((row or {}).get("id") or uuid.uuid4()),
        "chave": GOOGLE_INTEGRATION_KEY,
        "valor": json.dumps(next_payload, ensure_ascii=False),
        "tipo": "json",
        "descricao": "Configuracao de integracao Google Drive / Google Docs",
        "updated_at": now_iso,
    }
    if not row:
        document["created_at"] = now_iso
        await collection.insert_one(document)
    else:
        await collection.update_one({"chave": GOOGLE_INTEGRATION_KEY}, {"$set": document})

    return {"message": "Integração Google Drive configurada com sucesso.", "status": _public_status(next_payload)}


@router.post("/test")
async def test_google_drive_connection(current_user: UserResponse = Depends(get_admin_user)):
    collection, row, payload = await _get_integration_document()
    if not row:
        raise HTTPException(status_code=404, detail="Integração Google Drive não configurada.")

    try:
        service_account_info = decrypt_service_account_payload(str(payload.get("credentials_encrypted") or ""))
        root_folder_id = str(payload.get("root_folder_id") or "").strip()
        scopes = _normalize_scopes(payload.get("scopes"))
        tester = GoogleDriveService(service_account_info=service_account_info, scopes=scopes)
        folder_info = tester.test_folder_access(root_folder_id)

        payload["last_test_at"] = datetime.utcnow().isoformat()
        payload["last_test_status"] = "ok"
        payload["last_test_error"] = ""
        payload["updated_at"] = datetime.utcnow().isoformat()
        payload["updated_by_id"] = str(current_user.id)
        payload["updated_by_name"] = str(current_user.name)

        await collection.update_one(
            {"chave": GOOGLE_INTEGRATION_KEY},
            {"$set": {"valor": json.dumps(payload, ensure_ascii=False), "updated_at": payload["updated_at"]}},
        )

        return {
            "message": "Conexão Google Drive validada com sucesso.",
            "folder": folder_info,
            "status": _public_status(payload),
        }
    except GoogleIntegrationError as exc:
        payload["last_test_at"] = datetime.utcnow().isoformat()
        payload["last_test_status"] = "erro"
        payload["last_test_error"] = str(exc)
        payload["updated_at"] = datetime.utcnow().isoformat()
        payload["updated_by_id"] = str(current_user.id)
        payload["updated_by_name"] = str(current_user.name)
        await collection.update_one(
            {"chave": GOOGLE_INTEGRATION_KEY},
            {"$set": {"valor": json.dumps(payload, ensure_ascii=False), "updated_at": payload["updated_at"]}},
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/templates")
async def get_google_drive_templates(current_user: UserResponse = Depends(get_admin_user)):
    _, _, payload = await _get_integration_document()
    templates = payload.get("templates") if isinstance(payload.get("templates"), dict) else {}
    return {"templates": templates}


@router.put("/templates")
async def update_google_drive_templates(
    req: GoogleDriveTemplatesPayload,
    current_user: UserResponse = Depends(get_admin_user),
):
    collection, row, payload = await _get_integration_document()
    if not row:
        raise HTTPException(status_code=404, detail="Integracao Google Drive nao configurada.")

    payload["templates"] = _normalize_templates(req)
    payload["updated_at"] = datetime.utcnow().isoformat()
    payload["updated_by_id"] = str(current_user.id)
    payload["updated_by_name"] = str(current_user.name)

    await collection.update_one(
        {"chave": GOOGLE_INTEGRATION_KEY},
        {"$set": {"valor": json.dumps(payload, ensure_ascii=False), "updated_at": payload["updated_at"]}},
    )
    return {"message": "Templates da integracao Google atualizados com sucesso.", "templates": payload["templates"]}
