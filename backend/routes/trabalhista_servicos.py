"""
Rotas para serviços específicos do módulo Trabalhista:
- Recalculo
- Admissão
- Demissão
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel, Field
from models.user import UserResponse
from auth import get_current_user
from database_adapter import get_db_adapter
from datetime import datetime, date
import io
import uuid
import pandas as pd

router = APIRouter(prefix="/trabalhista/servicos", tags=["Trabalhista - Serviços"])

# ==================== HELPERS ====================

def _normalize_col_name(value: str) -> str:
    normalized = (
        str(value or "")
        .strip()
        .lower()
        .replace("ç", "c")
        .replace("ã", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
    )
    return normalized


def _pick_col(columns: List[str], candidates: List[str]) -> Optional[str]:
    for col in columns:
        for candidate in candidates:
            if candidate in col:
                return col
    return None


# ==================== MODELS ====================

class RecalculoCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo_recalculo: str  # "rescisao", "impostos", "folha", "ferias", "13salario"
    funcionario_id: Optional[str] = None
    funcionario_nome: Optional[str] = None
    periodo_referencia: str
    valor_original: float
    motivo: str
    responsavel: str
    observacoes: Optional[str] = None

class Recalculo(RecalculoCreate):
    id: str
    numero: str
    valor_recalculado: Optional[float] = None
    diferenca: Optional[float] = None
    status: str = "pendente"  # pendente, em_andamento, concluido, cancelado
    data_solicitacao: datetime
    data_conclusao: Optional[datetime] = None
    documentos_anexos: List[str] = []
    historico: List[dict] = []
    created_at: datetime
    updated_at: datetime

class AdmissaoCreate(BaseModel):
    empresa_id: str
    empresa: str
    funcionario_nome: str
    cpf: str
    data_nascimento: date
    cargo: str
    salario: float
    data_admissao: date
    tipo_contrato: str  # "clt", "pj", "estagio", "temporario"
    jornada_trabalho: str
    responsavel: str
    documentos_necessarios: List[str] = []
    observacoes: Optional[str] = None

class Admissao(AdmissaoCreate):
    id: str
    numero: str
    funcionario_id: Optional[str] = None
    status: str = "pendente"  # pendente, documentacao_pendente, em_andamento, concluido, cancelado
    documentos_recebidos: List[dict] = []
    checklist: List[dict] = []
    contrato_assinado: bool = False
    integrado_folha: bool = False
    data_integracao: Optional[datetime] = None
    historico: List[dict] = []
    created_at: datetime
    updated_at: datetime

class DemissaoCreate(BaseModel):
    empresa_id: str
    empresa: str
    funcionario_id: str
    funcionario_nome: str
    data_demissao: date
    tipo_demissao: str  # "sem_justa_causa", "justa_causa", "pedido_demissao", "acordo", "termino_contrato"
    aviso_previo: str  # "trabalhado", "indenizado", "dispensado"
    motivo: str
    responsavel: str
    observacoes: Optional[str] = None

class Demissao(DemissaoCreate):
    id: str
    numero: str
    status: str = "pendente"  # pendente, calculo_pendente, aguardando_homologacao, homologado, concluido
    valor_rescisao: Optional[float] = None
    saldo_salario: Optional[float] = None
    ferias_vencidas: Optional[float] = None
    ferias_proporcionais: Optional[float] = None
    decimo_terceiro: Optional[float] = None
    multa_fgts: Optional[float] = None
    data_homologacao: Optional[datetime] = None
    data_pagamento: Optional[datetime] = None
    documentos_gerados: List[dict] = []
    checklist: List[dict] = []
    historico: List[dict] = []
    created_at: datetime
    updated_at: datetime

# ==================== RECALCULO ====================

@router.post("/recalculos", response_model=Recalculo)
async def create_recalculo(
    recalculo_data: RecalculoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Criar nova solicitação de recalculo"""
    db = await get_db_adapter()
    
    # Gerar número sequencial
    count = await db.count('recalculos_trabalhistas', {})
    numero = f"REC{str(count + 1).zfill(6)}"
    
    recalculo_dict = {
        "id": str(uuid.uuid4()),
        "numero": numero,
        **recalculo_data.model_dump(),
        "status": "pendente",
        "data_solicitacao": datetime.utcnow(),
        "documentos_anexos": [],
        "historico": [{
            "data": datetime.utcnow(),
            "acao": "Solicitação criada",
            "usuario": current_user.name,
            "observacao": "Recalculo solicitado"
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.insert('recalculos_trabalhistas', recalculo_dict)
    return Recalculo(**recalculo_dict)

@router.get("/recalculos", response_model=List[Recalculo])
async def get_recalculos(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = None,
    tipo_recalculo: Optional[str] = None,
    empresa_id: Optional[str] = None
):
    """Listar recalculos com filtros"""
    db = await get_db_adapter()
    
    filters = {}
    if status:
        filters['status'] = status
    if tipo_recalculo:
        filters['tipo_recalculo'] = tipo_recalculo
    if empresa_id:
        filters['empresa_id'] = empresa_id
    
    recalculos = await db.find('recalculos_trabalhistas', filters)
    return [Recalculo(**r) for r in recalculos]

@router.get("/recalculos/{recalculo_id}", response_model=Recalculo)
async def get_recalculo(
    recalculo_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Buscar recalculo por ID"""
    db = await get_db_adapter()
    recalculo = await db.find_one('recalculos_trabalhistas', {'id': recalculo_id})
    
    if not recalculo:
        raise HTTPException(status_code=404, detail="Recalculo não encontrado")
    
    return Recalculo(**recalculo)

@router.put("/recalculos/{recalculo_id}", response_model=Recalculo)
async def update_recalculo(
    recalculo_id: str,
    valor_recalculado: Optional[float] = None,
    status: Optional[str] = None,
    observacao: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualizar recalculo"""
    db = await get_db_adapter()
    recalculo = await db.find_one('recalculos_trabalhistas', {'id': recalculo_id})
    
    if not recalculo:
        raise HTTPException(status_code=404, detail="Recalculo não encontrado")
    
    update_data = {"updated_at": datetime.utcnow()}
    
    if valor_recalculado is not None:
        update_data['valor_recalculado'] = valor_recalculado
        update_data['diferenca'] = valor_recalculado - recalculo['valor_original']
    
    if status:
        update_data['status'] = status
        if status == 'concluido':
            update_data['data_conclusao'] = datetime.utcnow()
    
    # Adicionar ao histórico
    historico_entry = {
        "data": datetime.utcnow(),
        "acao": f"Status alterado para {status}" if status else "Recalculo atualizado",
        "usuario": current_user.name,
        "observacao": observacao or ""
    }
    
    await db.update(
        'recalculos_trabalhistas',
        {'id': recalculo_id},
        {
            **update_data,
            'historico': recalculo.get('historico', []) + [historico_entry]
        }
    )
    
    updated = await db.find_one('recalculos_trabalhistas', {'id': recalculo_id})
    return Recalculo(**updated)

# ==================== ADMISSÃO ====================

@router.post("/admissoes", response_model=Admissao)
async def create_admissao(
    admissao_data: AdmissaoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Criar nova admissão"""
    db = await get_db_adapter()
    
    count = await db.count('admissoes_trabalhistas', {})
    numero = f"ADM{str(count + 1).zfill(6)}"
    
    # Checklist padrão de admissão
    checklist_padrao = [
        {"item": "Documentos pessoais recebidos", "concluido": False},
        {"item": "Exame admissional realizado", "concluido": False},
        {"item": "Contrato assinado", "concluido": False},
        {"item": "Cadastro no eSocial", "concluido": False},
        {"item": "Registro em carteira", "concluido": False},
        {"item": "Cadastro no sistema de folha", "concluido": False},
        {"item": "Vale transporte solicitado", "concluido": False},
        {"item": "Crachá emitido", "concluido": False}
    ]
    
    admissao_dict = {
        "id": str(uuid.uuid4()),
        "numero": numero,
        **admissao_data.model_dump(),
        "status": "pendente",
        "documentos_recebidos": [],
        "checklist": checklist_padrao,
        "contrato_assinado": False,
        "integrado_folha": False,
        "historico": [{
            "data": datetime.utcnow(),
            "acao": "Admissão criada",
            "usuario": current_user.name,
            "observacao": f"Admissão de {admissao_data.funcionario_nome}"
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.insert('admissoes_trabalhistas', admissao_dict)
    return Admissao(**admissao_dict)

@router.get("/admissoes", response_model=List[Admissao])
async def get_admissoes(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = None,
    empresa_id: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None
):
    """Listar admissões com filtros"""
    db = await get_db_adapter()
    
    filters = {}
    if status:
        filters['status'] = status
    if empresa_id:
        filters['empresa_id'] = empresa_id
    
    admissoes = await db.find('admissoes_trabalhistas', filters)
    return [Admissao(**a) for a in admissoes]

@router.put("/admissoes/{admissao_id}/checklist/{item_index}")
async def update_checklist_admissao(
    admissao_id: str,
    item_index: int,
    concluido: bool,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualizar item do checklist de admissão"""
    db = await get_db_adapter()
    admissao = await db.find_one('admissoes_trabalhistas', {'id': admissao_id})
    
    if not admissao:
        raise HTTPException(status_code=404, detail="Admissão não encontrada")
    
    checklist = admissao.get('checklist', [])
    if item_index >= len(checklist):
        raise HTTPException(status_code=400, detail="Índice de checklist inválido")
    
    checklist[item_index]['concluido'] = concluido
    
    # Verificar se todos os itens foram concluídos
    todos_concluidos = all(item['concluido'] for item in checklist)
    update_data = {
        'checklist': checklist,
        'updated_at': datetime.utcnow()
    }
    
    if todos_concluidos and admissao['status'] != 'concluido':
        update_data['status'] = 'concluido'
        update_data['data_integracao'] = datetime.utcnow()
        update_data['integrado_folha'] = True
    
    await db.update('admissoes_trabalhistas', {'id': admissao_id}, update_data)
    return {"message": "Checklist atualizado", "todos_concluidos": todos_concluidos}

# ==================== DEMISSÃO ====================

@router.post("/demissoes", response_model=Demissao)
async def create_demissao(
    demissao_data: DemissaoCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Criar nova demissão"""
    db = await get_db_adapter()
    
    count = await db.count('demissoes_trabalhistas', {})
    numero = f"DEM{str(count + 1).zfill(6)}"
    
    # Checklist padrão de demissão
    checklist_padrao = [
        {"item": "Aviso prévio comunicado", "concluido": False},
        {"item": "Cálculo de rescisão realizado", "concluido": False},
        {"item": "TRCT gerado", "concluido": False},
        {"item": "Termo de homologação", "concluido": False},
        {"item": "Guias de FGTS e INSS", "concluido": False},
        {"item": "Seguro desemprego", "concluido": False},
        {"item": "Exame demissional", "concluido": False},
        {"item": "Baixa no eSocial", "concluido": False},
        {"item": "Devolução de uniformes/equipamentos", "concluido": False}
    ]
    
    demissao_dict = {
        "id": str(uuid.uuid4()),
        "numero": numero,
        **demissao_data.model_dump(),
        "status": "pendente",
        "checklist": checklist_padrao,
        "documentos_gerados": [],
        "historico": [{
            "data": datetime.utcnow(),
            "acao": "Demissão registrada",
            "usuario": current_user.name,
            "observacao": f"Demissão de {demissao_data.funcionario_nome}"
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.insert('demissoes_trabalhistas', demissao_dict)
    return Demissao(**demissao_dict)

@router.get("/demissoes", response_model=List[Demissao])
async def get_demissoes(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = None,
    empresa_id: Optional[str] = None,
    tipo_demissao: Optional[str] = None
):
    """Listar demissões com filtros"""
    db = await get_db_adapter()
    
    filters = {}
    if status:
        filters['status'] = status
    if empresa_id:
        filters['empresa_id'] = empresa_id
    if tipo_demissao:
        filters['tipo_demissao'] = tipo_demissao
    
    demissoes = await db.find('demissoes_trabalhistas', filters)
    return [Demissao(**d) for d in demissoes]

@router.put("/demissoes/{demissao_id}/calcular-rescisao")
async def calcular_rescisao(
    demissao_id: str,
    saldo_salario: float,
    ferias_vencidas: float = 0,
    ferias_proporcionais: float = 0,
    decimo_terceiro: float = 0,
    multa_fgts: float = 0,
    current_user: UserResponse = Depends(get_current_user)
):
    """Calcular valores de rescisão"""
    db = await get_db_adapter()
    
    valor_total = saldo_salario + ferias_vencidas + ferias_proporcionais + decimo_terceiro + multa_fgts
    
    update_data = {
        'valor_rescisao': valor_total,
        'saldo_salario': saldo_salario,
        'ferias_vencidas': ferias_vencidas,
        'ferias_proporcionais': ferias_proporcionais,
        'decimo_terceiro': decimo_terceiro,
        'multa_fgts': multa_fgts,
        'status': 'aguardando_homologacao',
        'updated_at': datetime.utcnow()
    }
    
    await db.update('demissoes_trabalhistas', {'id': demissao_id}, update_data)
    
    return {
        "message": "Cálculo de rescisão realizado",
        "valor_total": valor_total,
        "detalhamento": {
            "saldo_salario": saldo_salario,
            "ferias_vencidas": ferias_vencidas,
            "ferias_proporcionais": ferias_proporcionais,
            "decimo_terceiro": decimo_terceiro,
            "multa_fgts": multa_fgts
        }
    }

@router.put("/demissoes/{demissao_id}/homologar")
async def homologar_demissao(
    demissao_id: str,
    data_homologacao: datetime,
    observacao: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Registrar homologação da demissão"""
    db = await get_db_adapter()
    demissao = await db.find_one('demissoes_trabalhistas', {'id': demissao_id})
    
    if not demissao:
        raise HTTPException(status_code=404, detail="Demissão não encontrada")
    
    historico_entry = {
        "data": datetime.utcnow(),
        "acao": "Demissão homologada",
        "usuario": current_user.name,
        "observacao": observacao or "Homologação realizada"
    }
    
    await db.update(
        'demissoes_trabalhistas',
        {'id': demissao_id},
        {
            'status': 'homologado',
            'data_homologacao': data_homologacao,
            'updated_at': datetime.utcnow(),
            'historico': demissao.get('historico', []) + [historico_entry]
        }
    )
    
    return {"message": "Demissão homologada com sucesso"}

# ==================== IMPORTACAO ====================

@router.post("/import-funcionarios")
async def import_funcionarios_planilha(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Importa funcionarios a partir de planilha CSV/XLSX e retorna dados + relatorio de validacao."""
    filename = (file.filename or "").lower()
    if not filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato invalido. Envie CSV, XLSX ou XLS.")

    try:
        content = await file.read()
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(content), sep=";")
            except Exception:
                df = pd.read_csv(io.BytesIO(content), sep=",")
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha ao ler planilha: {str(exc)}")

    if df.empty:
        return {
            "items": [],
            "count": 0,
            "summary": {"total_linhas": 0, "validas": 0, "invalidas": 0},
            "report": []
        }

    df.columns = [_normalize_col_name(col) for col in df.columns]
    cols = list(df.columns)

    nome_col = _pick_col(cols, ["nome", "funcionario", "colaborador"])
    cpf_col = _pick_col(cols, ["cpf"])
    cargo_col = _pick_col(cols, ["cargo", "funcao", "profissao"])
    salario_col = _pick_col(cols, ["salario", "remuneracao"])
    admissao_col = _pick_col(cols, ["admissao", "data_admissao", "dt_admissao"])

    if not nome_col:
        raise HTTPException(status_code=400, detail="Coluna de nome nao encontrada.")

    items = []
    report = []
    for index, row in df.iterrows():
        linha_num = int(index) + 2  # +2 por cabecalho + base 1
        nome = str(row.get(nome_col, "")).strip()
        if not nome or nome.lower() == "nan":
            report.append({"linha": linha_num, "status": "erro", "motivo": "Nome obrigatorio ausente"})
            continue
        cpf = str(row.get(cpf_col, "")).strip() if cpf_col else ""
        cargo = str(row.get(cargo_col, "")).strip() if cargo_col else ""

        salario_raw = row.get(salario_col, 0) if salario_col else 0
        try:
            salario = float(str(salario_raw).replace(".", "").replace(",", "."))
        except Exception:
            salario = 0.0

        admissao_raw = row.get(admissao_col, None) if admissao_col else None
        data_admissao = None
        if pd.notna(admissao_raw):
            try:
                data_admissao = pd.to_datetime(admissao_raw).date().isoformat()
            except Exception:
                data_admissao = str(admissao_raw).strip()

        erros = []
        if not cargo or cargo.lower() == "nan":
            erros.append("Cargo ausente")
        if salario < 0:
            erros.append("Salario invalido")
        if cpf and cpf.lower() != "nan":
            cpf_digits = "".join(ch for ch in cpf if ch.isdigit())
            if len(cpf_digits) not in (0, 11):
                erros.append("CPF com formato invalido")
        if data_admissao:
            try:
                parsed_adm = datetime.fromisoformat(str(data_admissao))
                if parsed_adm.date() > datetime.utcnow().date():
                    erros.append("Data de admissao no futuro")
            except Exception:
                erros.append("Data de admissao invalida")

        if erros:
            report.append({"linha": linha_num, "status": "erro", "motivo": "; ".join(erros)})
            continue

        items.append(
            {
                "nome": nome,
                "cpf": cpf if cpf and cpf.lower() != "nan" else "",
                "cargo": cargo if cargo and cargo.lower() != "nan" else "",
                "salario": salario,
                "data_admissao": data_admissao or datetime.utcnow().date().isoformat(),
            }
        )
        report.append({"linha": linha_num, "status": "ok", "motivo": "Importado"})

    total_linhas = len(report)
    validas = len([row for row in report if row["status"] == "ok"])
    invalidas = total_linhas - validas

    return {
        "items": items,
        "count": len(items),
        "imported_by": current_user.name,
        "summary": {
            "total_linhas": total_linhas,
            "validas": validas,
            "invalidas": invalidas,
        },
        "report": report,
    }


# ==================== DASHBOARD E RELATÓRIOS ====================

@router.get("/dashboard-servicos")
async def get_dashboard_servicos(
    current_user: UserResponse = Depends(get_current_user)
):
    """Dashboard de serviços trabalhistas"""
    db = await get_db_adapter()
    
    # Recalculos
    recalculos_pendentes = await db.count('recalculos_trabalhistas', {'status': 'pendente'})
    recalculos_andamento = await db.count('recalculos_trabalhistas', {'status': 'em_andamento'})
    
    # Admissões
    admissoes_pendentes = await db.count('admissoes_trabalhistas', {'status': 'pendente'})
    admissoes_andamento = await db.count('admissoes_trabalhistas', {'status': {'$in': ['documentacao_pendente', 'em_andamento']}})
    
    # Demissões
    demissoes_pendentes = await db.count('demissoes_trabalhistas', {'status': 'pendente'})
    demissoes_aguardando = await db.count('demissoes_trabalhistas', {'status': {'$in': ['calculo_pendente', 'aguardando_homologacao']}})
    
    return {
        "recalculos": {
            "pendentes": recalculos_pendentes,
            "em_andamento": recalculos_andamento
        },
        "admissoes": {
            "pendentes": admissoes_pendentes,
            "em_andamento": admissoes_andamento
        },
        "demissoes": {
            "pendentes": demissoes_pendentes,
            "aguardando_homologacao": demissoes_aguardando
        }
    }
