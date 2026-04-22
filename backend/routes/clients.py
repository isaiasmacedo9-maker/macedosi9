from datetime import datetime
import copy
import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select

from auth import get_current_user
from database_compat import (
    get_chat_enhanced_collection,
    get_client_portal_users_collection,
    get_clients_setup_collection,
    get_clients_collection,
    get_users_collection,
)
from database_sql import AsyncSessionLocal
from models.client import Client, ClientCreate, ClientUpdate
from models.user import UserResponse
from models_sql import ClientActivityLogSQL
from services.official_data_sync import import_official_csv_data

router = APIRouter(prefix="/clients", tags=["Clients"])


class ClientSetupPayload(BaseModel):
    payload: Dict[str, Any]


class ClientPortalUserPayload(BaseModel):
    id: Optional[str] = None
    nome: str
    email: str
    senha: str
    clienteId: Optional[str] = None
    linkedClientRefs: Optional[List[str]] = None
    linkedClientIds: Optional[List[str]] = None


def _normalize_client_payload(client_data: dict) -> dict:
    """Normalize legacy/incomplete client payloads before Pydantic validation."""
    data = copy.deepcopy(client_data or {})
    endereco = data.get("endereco") or {}
    if not isinstance(endereco, dict):
        endereco = {}
    data["endereco"] = {
        "logradouro": endereco.get("logradouro") or "-",
        "numero": endereco.get("numero"),
        "complemento": endereco.get("complemento"),
        "bairro": endereco.get("bairro") or "-",
        "distrito": endereco.get("distrito"),
        "cep": endereco.get("cep") or "00000-000",
        "cidade": endereco.get("cidade") or (data.get("cidade_atendimento") or "-"),
        "estado": endereco.get("estado") or "BA",
    }
    return data


def _has_clients_permission(user: UserResponse, action: str) -> bool:
    if user.role == "admin":
        return True
    permissions = getattr(user, "permissoes", []) or []
    action_norm = str(action or "").strip().lower()
    for perm in permissions:
        setor = str((perm or {}).get("setor", "")).strip().lower()
        visualizacoes = [str(v).strip().lower() for v in ((perm or {}).get("visualizacoes") or [])]
        if setor in {"todos", "clientes"} and ("todos" in visualizacoes or action_norm in visualizacoes):
            return True
    return False


def _require_clients_permission(user: UserResponse, action: str):
    if _has_clients_permission(user, action):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"User has no permission to {action.lower()} clients",
    )


def _sanitize_client_for_log(payload: Dict[str, Any]) -> Dict[str, Any]:
    blocked_keys = {"password", "senha", "token"}
    cleaned: Dict[str, Any] = {}
    for key, value in (payload or {}).items():
        if key in blocked_keys:
            continue
        cleaned[key] = value.isoformat() if isinstance(value, datetime) else value
    return cleaned


async def _log_client_activity(
    action: str,
    actor: UserResponse,
    client_id: str,
    client_name: str,
    details: Optional[dict] = None,
):
    async with AsyncSessionLocal() as session:
        log = ClientActivityLogSQL(
            action=action,
            actor_id=str(actor.id),
            actor_name=str(actor.name),
            actor_email=str(actor.email),
            client_id=str(client_id),
            client_name=str(client_name or "-"),
            details=json.dumps(details or {}, ensure_ascii=False),
            created_at=datetime.utcnow(),
        )
        session.add(log)
        await session.commit()


def check_city_access(user: UserResponse, cidade: str) -> bool:
    """Check if user has access to specific city."""
    if user.role == "admin":
        return True
    return cidade in user.allowed_cities


@router.post("/")
async def create_client(
    client_data: ClientCreate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Create new client."""
    _require_clients_permission(current_user, "Adicionar")
    if not check_city_access(current_user, client_data.cidade_atendimento):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city",
        )

    clients_collection = await get_clients_collection()
    existing_client = await clients_collection.find_one({"cnpj": client_data.cnpj})
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNPJ already registered",
        )

    client = Client(**client_data.model_dump())
    await clients_collection.insert_one(client.model_dump())

    await _log_client_activity(
        action="create",
        actor=current_user,
        client_id=client.id,
        client_name=client.nome_empresa,
        details={"new": _sanitize_client_for_log(client.model_dump())},
    )

    await send_notification_to_financial(client, current_user)
    return client


async def send_notification_to_financial(client: Client, creator: UserResponse):
    """Send automatic notification to finance users in the same city."""
    try:
        users_collection = await get_users_collection()
        chat_collection = await get_chat_enhanced_collection()

        financial_users = []
        for user_data in (await users_collection.find({"allowed_sectors": "financeiro", "allowed_cities": client.cidade})):
            if user_data.get("id") != creator.id:
                financial_users.append(user_data)

        if not financial_users:
            return

        message_text = (
            "Nova Empresa Cadastrada\n\n"
            f"Empresa: {client.nome_empresa}\n"
            f"CNPJ: {client.cnpj}\n"
            f"Cidade: {client.cidade}/{client.estado}\n"
            f"Telefone: {client.telefone if client.telefone else 'Nao informado'}\n"
            f"Email: {client.email}\n"
            f"Setor: {client.setor}\n"
            f"Cadastrado por: {creator.name}\n"
            f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n"
        )

        for user in financial_users:
            conversation_id = str(uuid.uuid4())
            existing_conversation = await chat_collection.find_one(
                {
                    "tipo": "privado",
                    "$or": [
                        {"participantes": {"$all": [creator.id, user.get("id")]}},
                        {"participantes": {"$all": [user.get("id"), creator.id]}},
                    ],
                }
            )

            if existing_conversation:
                conversation_id = existing_conversation.get("id")
            else:
                new_conversation = {
                    "id": conversation_id,
                    "tipo": "privado",
                    "nome": f"Chat com {user.get('name')}",
                    "participantes": [creator.id, user.get("id")],
                    "criado_por": creator.id,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
                await chat_collection.insert_one(new_conversation)

            message = {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "remetente_id": "system",
                "remetente_nome": "Sistema - Notificacao Automatica",
                "mensagem": message_text,
                "tipo": "notificacao",
                "data_envio": datetime.utcnow(),
                "lida": False,
                "metadata": {
                    "tipo_notificacao": "nova_empresa",
                    "empresa_id": client.id,
                    "empresa_nome": client.nome_empresa,
                    "criador": creator.name,
                },
            }

            await chat_collection.update_one(
                {"id": conversation_id},
                {"$push": {"mensagens": message}, "$set": {"updated_at": datetime.utcnow()}},
            )
    except Exception as error:
        print(f"Warning: notification dispatch failed: {error}")


@router.get("/")
async def get_clients(
    current_user: UserResponse = Depends(get_current_user),
    cidade: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get clients with filters."""
    clients_collection = await get_clients_collection()
    filter_query: Dict[str, Any] = {}

    if current_user.role != "admin":
        filter_query["cidade"] = {"$in": current_user.allowed_cities}
    elif cidade:
        filter_query["cidade"] = cidade

    if status:
        filter_query["status"] = status

    if search:
        filter_query["$or"] = [
            {"nome_empresa": {"$regex": search, "$options": "i"}},
            {"nome_fantasia": {"$regex": search, "$options": "i"}},
            {"cnpj": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}},
        ]

    clients_data = await clients_collection.find(filter_query, limit=limit, skip=skip)
    clients = []
    for client_data in clients_data:
        normalized = _normalize_client_payload(client_data)
        try:
            clients.append(Client(**normalized))
        except Exception:
            clients.append(normalized)

    total = await clients_collection.count_documents(filter_query)
    return {"clients": clients, "total": total, "skip": skip, "limit": limit}


@router.get("/setup-map")
async def get_clients_setup_map(
    current_user: UserResponse = Depends(get_current_user),
):
    """Get setup/config map by client_id."""
    if current_user.role != "admin" and not _has_clients_permission(current_user, "Editar"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no permission to read clients setup map",
        )
    setup_collection = await get_clients_setup_collection()
    rows = await setup_collection.find({}, limit=10000)
    setup_map: Dict[str, Any] = {}
    for row in rows:
        client_id = str(row.get("client_id") or "")
        if not client_id:
            continue
        setup_map[client_id] = row.get("payload") or {}
    return {"setup_map": setup_map}


@router.put("/setup/{client_id}")
async def upsert_client_setup(
    client_id: str,
    body: ClientSetupPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    """Upsert setup/config for a specific client."""
    _require_clients_permission(current_user, "Editar")
    clients_collection = await get_clients_collection()
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    normalized_existing = _normalize_client_payload(existing_client)
    client = Client(**normalized_existing)
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")

    setup_collection = await get_clients_setup_collection()
    now_iso = datetime.utcnow().isoformat()
    current = await setup_collection.find_one({"client_id": client_id})
    payload = body.payload or {}

    if current:
        await setup_collection.update_one(
            {"client_id": client_id},
            {
                "$set": {
                    "payload": payload,
                    "updated_at": now_iso,
                    "updated_by_id": str(current_user.id),
                    "updated_by_name": str(current_user.name),
                }
            },
        )
    else:
        await setup_collection.insert_one(
            {
                "id": str(uuid.uuid4()),
                "client_id": client_id,
                "payload": payload,
                "created_at": now_iso,
                "updated_at": now_iso,
                "created_by_id": str(current_user.id),
                "created_by_name": str(current_user.name),
                "updated_by_id": str(current_user.id),
                "updated_by_name": str(current_user.name),
            }
        )

    await _log_client_activity(
        action="setup_update",
        actor=current_user,
        client_id=client_id,
        client_name=client.nome_empresa,
        details={"changed_fields": list((payload or {}).keys())},
    )
    return {"message": "Client setup saved"}


@router.get("/portal-users")
async def list_client_portal_users(
    current_user: UserResponse = Depends(get_current_user),
):
    """List all client portal users."""
    if current_user.role != "admin" and not _has_clients_permission(current_user, "Editar"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no permission to read client portal users",
        )
    portal_collection = await get_client_portal_users_collection()
    rows = await portal_collection.find({}, limit=10000)
    rows.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
    return rows


@router.put("/portal-users/{client_id}")
async def upsert_client_portal_user(
    client_id: str,
    body: ClientPortalUserPayload,
    current_user: UserResponse = Depends(get_current_user),
):
    """Upsert portal login for a client."""
    _require_clients_permission(current_user, "Editar")
    clients_collection = await get_clients_collection()
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    normalized_existing = _normalize_client_payload(existing_client)
    client = Client(**normalized_existing)
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")

    portal_collection = await get_client_portal_users_collection()
    now_iso = datetime.utcnow().isoformat()
    email_norm = body.email.strip().lower()
    existing_by_client = await portal_collection.find_one({"clientRefId": client_id})
    existing_by_email = await portal_collection.find_one({"email": email_norm})
    target_id = (existing_by_client or existing_by_email or {}).get("id") or str(uuid.uuid4())
    record = {
        "id": body.id or target_id,
        "clientRefId": client_id,
        "clienteId": body.clienteId or client_id,
        "nome": body.nome.strip(),
        "email": email_norm,
        "senha": body.senha,
        "linkedClientRefs": [str(v).strip() for v in (body.linkedClientRefs or [client_id]) if str(v).strip()],
        "linkedClientIds": [str(v).strip() for v in (body.linkedClientIds or [body.clienteId or client_id]) if str(v).strip()],
        "updatedAt": now_iso,
        "updatedById": str(current_user.id),
        "updatedByName": str(current_user.name),
    }

    if existing_by_client or existing_by_email:
        await portal_collection.update_one(
            {"id": target_id},
            {"$set": {**record, "id": target_id}},
        )
    else:
        await portal_collection.insert_one(
            {
                "id": target_id,
                "createdAt": now_iso,
                **record,
            }
        )

    await _log_client_activity(
        action="portal_user_update",
        actor=current_user,
        client_id=client_id,
        client_name=client.nome_empresa,
        details={"email": email_norm},
    )
    return {"message": "Client portal user saved", "id": target_id}


@router.delete("/portal-users/by-id/{portal_user_id}")
async def delete_client_portal_user(
    portal_user_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete client portal user by portal user id."""
    _require_clients_permission(current_user, "Editar")
    portal_collection = await get_client_portal_users_collection()
    existing = await portal_collection.find_one({"id": portal_user_id})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client portal user not found")
    await portal_collection.delete_one({"id": portal_user_id})
    return {"message": "Client portal user deleted"}


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get client by ID."""
    clients_collection = await get_clients_collection()
    client_data = await clients_collection.find_one({"id": client_id})

    if not client_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    normalized_client = _normalize_client_payload(client_data)
    client = Client(**normalized_client)

    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")

    return client


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    client_update: ClientUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """Update client."""
    _require_clients_permission(current_user, "Editar")
    clients_collection = await get_clients_collection()
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    normalized_existing = _normalize_client_payload(existing_client)
    client = Client(**normalized_existing)
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")

    update_data = client_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        before = _sanitize_client_for_log(existing_client)
        await clients_collection.update_one({"id": client_id}, {"$set": update_data})
        await _log_client_activity(
            action="update",
            actor=current_user,
            client_id=client_id,
            client_name=client.nome_empresa,
            details={
                "changed_fields": list(update_data.keys()),
                "before": before,
                "patch": _sanitize_client_for_log(update_data),
            },
        )

    updated_client_data = await clients_collection.find_one({"id": client_id})
    return Client(**_normalize_client_payload(updated_client_data))


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Delete client."""
    _require_clients_permission(current_user, "Remover")
    clients_collection = await get_clients_collection()
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    client = Client(**_normalize_client_payload(existing_client))
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")

    await _log_client_activity(
        action="delete",
        actor=current_user,
        client_id=client_id,
        client_name=client.nome_empresa,
        details={"previous": _sanitize_client_for_log(existing_client)},
    )

    await clients_collection.delete_one({"id": client_id})
    return {"message": "Client deleted successfully"}


@router.post("/import-official-csv")
async def import_official_clients_csv(
    clients_csv_path: Optional[str] = Query(None),
    financial_csv_path: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user),
):
    """Import official CSVs."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can import official csv data")
    result = await import_official_csv_data(clients_csv_path, financial_csv_path)
    return {"message": "Official CSV import completed", **result}


@router.get("/cnpj/{cnpj}")
async def get_client_by_cnpj(
    cnpj: str,
    current_user: UserResponse = Depends(get_current_user),
):
    """Get client by CNPJ."""
    clients_collection = await get_clients_collection()
    client_data = await clients_collection.find_one({"cnpj": cnpj})

    if not client_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    client = Client(**_normalize_client_payload(client_data))
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied for this city")
    return client


@router.get("/activity-logs/list")
async def get_client_activity_logs(
    current_user: UserResponse = Depends(get_current_user),
    client_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    """Audit list for client create/edit/remove actions."""
    if current_user.role != "admin" and not _has_clients_permission(current_user, "Editar"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no permission to view client activity logs",
        )

    async with AsyncSessionLocal() as session:
        query = select(ClientActivityLogSQL)
        count_query = select(func.count()).select_from(ClientActivityLogSQL)

        if client_id:
            query = query.where(ClientActivityLogSQL.client_id == client_id)
            count_query = count_query.where(ClientActivityLogSQL.client_id == client_id)
        if action:
            query = query.where(ClientActivityLogSQL.action == action)
            count_query = count_query.where(ClientActivityLogSQL.action == action)

        query = query.order_by(ClientActivityLogSQL.created_at.desc()).offset(skip).limit(limit)
        rows = (await session.execute(query)).scalars().all()
        total = (await session.execute(count_query)).scalar_one()

    items = []
    for row in rows:
        try:
            details = json.loads(row.details or "{}")
        except Exception:
            details = {}
        items.append(
            {
                "id": row.id,
                "client_id": row.client_id,
                "client_name": row.client_name,
                "action": row.action,
                "actor_id": row.actor_id,
                "actor_name": row.actor_name,
                "actor_email": row.actor_email,
                "details": details,
                "created_at": row.created_at,
            }
        )

    return {"items": items, "skip": skip, "limit": limit, "total": total}
