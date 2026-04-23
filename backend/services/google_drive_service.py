from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken


DEFAULT_GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
]


class GoogleIntegrationError(Exception):
    pass


def _derive_secret_key() -> str:
    return (
        os.getenv("GOOGLE_INTEGRATION_SECRET")
        or os.getenv("SECRET_KEY")
        or "macedo-si-google-integration-secret"
    )


def _build_fernet() -> Fernet:
    digest = hashlib.sha256(_derive_secret_key().encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_service_account_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return _build_fernet().encrypt(raw).decode("utf-8")


def decrypt_service_account_payload(token: str) -> Dict[str, Any]:
    if not token:
        raise GoogleIntegrationError("Credencial Google não configurada.")
    try:
        decrypted = _build_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
        parsed = json.loads(decrypted)
        if not isinstance(parsed, dict):
            raise GoogleIntegrationError("Credencial Google inválida.")
        return parsed
    except (InvalidToken, json.JSONDecodeError) as exc:
        raise GoogleIntegrationError("Não foi possível descriptografar a credencial Google.") from exc


def parse_service_account_input(raw_value: Any) -> Dict[str, Any]:
    if isinstance(raw_value, dict):
        parsed = raw_value
    elif isinstance(raw_value, str):
        text = raw_value.strip()
        if not text:
            raise GoogleIntegrationError("JSON da service account está vazio.")
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise GoogleIntegrationError("JSON da service account inválido.") from exc
    else:
        raise GoogleIntegrationError("Formato de credencial inválido.")

    required = ("type", "client_email", "private_key")
    missing = [field for field in required if not parsed.get(field)]
    if missing:
        raise GoogleIntegrationError(f"Credencial incompleta. Campos faltando: {', '.join(missing)}")
    if str(parsed.get("type", "")).strip() != "service_account":
        raise GoogleIntegrationError("A credencial precisa ser do tipo service_account.")
    return parsed


class GoogleDriveService:
    def __init__(self, service_account_info: Dict[str, Any], scopes: Optional[list[str]] = None):
        self.service_account_info = service_account_info
        self.scopes = scopes or list(DEFAULT_GOOGLE_SCOPES)

    def _build_drive_client(self):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise GoogleIntegrationError(
                "Bibliotecas Google não instaladas. Instale google-auth e google-api-python-client."
            ) from exc

        credentials = service_account.Credentials.from_service_account_info(
            self.service_account_info,
            scopes=self.scopes,
        )
        return build("drive", "v3", credentials=credentials, cache_discovery=False)

    def _build_docs_client(self):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise GoogleIntegrationError(
                "Bibliotecas Google não instaladas. Instale google-auth e google-api-python-client."
            ) from exc

        credentials = service_account.Credentials.from_service_account_info(
            self.service_account_info,
            scopes=self.scopes,
        )
        return build("docs", "v1", credentials=credentials, cache_discovery=False)

    def test_folder_access(self, folder_id: str) -> Dict[str, Any]:
        if not str(folder_id or "").strip():
            raise GoogleIntegrationError("Informe o ID da pasta raiz no Google Drive.")
        drive_client = self._build_drive_client()
        try:
            metadata = (
                drive_client.files()
                .get(fileId=folder_id, fields="id,name,mimeType,webViewLink,parents")
                .execute()
            )
        except Exception as exc:
            raise GoogleIntegrationError(f"Falha ao acessar pasta no Google Drive: {exc}") from exc

        mime_type = str(metadata.get("mimeType", ""))
        if mime_type != "application/vnd.google-apps.folder":
            raise GoogleIntegrationError("O ID informado não é de uma pasta do Google Drive.")
        return {
            "id": metadata.get("id"),
            "name": metadata.get("name"),
            "mimeType": mime_type,
            "webViewLink": metadata.get("webViewLink"),
            "parents": metadata.get("parents") or [],
        }

    @staticmethod
    def sanitize_folder_name(value: str, fallback: str = "Sem nome") -> str:
        text = str(value or "").strip()
        if not text:
            text = fallback
        text = re.sub(r"[\\/:*?\"<>|]+", "-", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:120] or fallback

    def _find_folder_by_name(self, drive_client, parent_id: str, folder_name: str) -> Optional[Dict[str, Any]]:
        escaped_name = str(folder_name).replace("'", "\\'")
        query = (
            f"mimeType='application/vnd.google-apps.folder' and trashed=false "
            f"and '{parent_id}' in parents and name='{escaped_name}'"
        )
        result = (
            drive_client.files()
            .list(q=query, spaces="drive", fields="files(id,name,parents,webViewLink)", pageSize=1)
            .execute()
        )
        files = result.get("files") or []
        return files[0] if files else None

    def _create_folder(self, drive_client, parent_id: str, folder_name: str) -> Dict[str, Any]:
        metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        created = (
            drive_client.files()
            .create(body=metadata, fields="id,name,parents,webViewLink")
            .execute()
        )
        return created

    def ensure_folder_path(self, root_folder_id: str, folder_parts: List[str]) -> Dict[str, Any]:
        if not str(root_folder_id or "").strip():
            raise GoogleIntegrationError("Pasta raiz do Drive não informada.")
        drive_client = self._build_drive_client()
        current = self.test_folder_access(root_folder_id)
        current_id = current.get("id")

        for raw_part in folder_parts:
            folder_name = self.sanitize_folder_name(raw_part)
            existing = self._find_folder_by_name(drive_client, current_id, folder_name)
            current = existing or self._create_folder(drive_client, current_id, folder_name)
            current_id = current.get("id")

        return current

    def upload_file(
        self,
        *,
        parent_folder_id: str,
        file_name: str,
        file_bytes: bytes,
        mime_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not file_bytes:
            raise GoogleIntegrationError("Arquivo vazio não pode ser enviado.")
        drive_client = self._build_drive_client()
        safe_name = self.sanitize_folder_name(file_name, fallback="arquivo")
        try:
            from googleapiclient.http import MediaIoBaseUpload
        except ImportError as exc:
            raise GoogleIntegrationError(
                "Bibliotecas Google não instaladas. Instale google-auth e google-api-python-client."
            ) from exc

        media = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=(mime_type or "application/octet-stream"),
            resumable=False,
        )
        metadata = {"name": safe_name, "parents": [parent_folder_id]}
        uploaded = (
            drive_client.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id,name,mimeType,size,webViewLink,webContentLink,parents",
            )
            .execute()
        )
        return uploaded

    def copy_file_to_folder(self, *, source_file_id: str, parent_folder_id: str, new_name: str) -> Dict[str, Any]:
        drive_client = self._build_drive_client()
        metadata = {"name": self.sanitize_folder_name(new_name, fallback="Documento"), "parents": [parent_folder_id]}
        copied = (
            drive_client.files()
            .copy(
                fileId=source_file_id,
                body=metadata,
                fields="id,name,mimeType,webViewLink,webContentLink,parents",
            )
            .execute()
        )
        return copied

    def replace_google_doc_placeholders(self, *, document_id: str, replacements: Dict[str, str]) -> None:
        docs_client = self._build_docs_client()
        requests = []
        for key, value in (replacements or {}).items():
            token = str(key or "").strip()
            if not token:
                continue
            if not token.startswith("{{"):
                token = f"{{{{{token}}}}}"
            requests.append(
                {
                    "replaceAllText": {
                        "containsText": {"text": token, "matchCase": True},
                        "replaceText": str(value or ""),
                    }
                }
            )
        if not requests:
            return
        docs_client.documents().batchUpdate(documentId=document_id, body={"requests": requests}).execute()

    def export_google_doc_as_pdf_bytes(self, *, document_id: str) -> bytes:
        drive_client = self._build_drive_client()
        try:
            data = drive_client.files().export(fileId=document_id, mimeType="application/pdf").execute()
        except Exception as exc:
            raise GoogleIntegrationError(f"Falha ao exportar documento como PDF: {exc}") from exc
        if not data:
            raise GoogleIntegrationError("Exportação de PDF retornou conteúdo vazio.")
        return data
