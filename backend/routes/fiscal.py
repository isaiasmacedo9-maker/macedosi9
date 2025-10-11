from fastapi import APIRouter, HTTPException, status, Depends, Query, File, UploadFile
from typing import List, Optional
from models.fiscal import (
    ObrigacaoFiscal, ObrigacaoFiscalCreate, ObrigacaoFiscalUpdate,
    NotaFiscal, NotaFiscalCreate, NotaFiscalUpdate,
    FiscalFilters, NotaFiscalFilters, RelatorioFiscal,
    TipoObrigacao, StatusObrigacao, PeriodicidadeObrigacao,
    TipoNota, StatusConciliacao, RegimeTributario,
    ImpostoCalculado, ResumoImpostos
)
from models.user import UserResponse
from auth import get_current_user
from database_adapter import DatabaseAdapter
from datetime import datetime, date, timedelta
import uuid
import base64
import xml.etree.ElementTree as ET

router = APIRouter(prefix="/fiscal", tags=["Fiscal"])

def check_fiscal_access(user: UserResponse):
    """Check if user has access to fiscal module"""
    if user.role != "admin" and "fiscal" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to fiscal module not allowed"
        )

# Dashboard Fiscal
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get fiscal dashboard statistics"""
    check_fiscal_access(current_user)
    
    async with DatabaseAdapter() as db:
        # Get obrigações por status
        obrigacoes = await db.find("fiscal", {})
        
        obrigacoes_por_status = {}
        obrigacoes_vencendo_30_dias = 0
        hoje = datetime.now()
        data_limite = hoje + timedelta(days=30)
        
        for obrigacao in obrigacoes:
            status = obrigacao.get("status", "pendente")
            obrigacoes_por_status[status] = obrigacoes_por_status.get(status, 0) + 1
            
            # Check if vencendo nos próximos 30 dias
            proximo_vencimento = obrigacao.get("proximo_vencimento")
            if proximo_vencimento:
                if isinstance(proximo_vencimento, str):
                    try:
                        proximo_vencimento = datetime.fromisoformat(proximo_vencimento.replace('Z', '+00:00'))
                    except:
                        continue
                
                if proximo_vencimento <= data_limite:
                    obrigacoes_vencendo_30_dias += 1
        
        # Get notas fiscais do mês atual
        inicio_mes = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        notas_fiscais = await db.find("notas_fiscais", {})
        
        notas_fiscais_mes = 0
        for nota in notas_fiscais:
            data_emissao = nota.get("data_emissao")
            if data_emissao:
                if isinstance(data_emissao, str):
                    try:
                        data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00'))
                    except:
                        continue
                
                if data_emissao >= inicio_mes:
                    notas_fiscais_mes += 1
    
    return {
        "obrigacoes_por_status": obrigacoes_por_status,
        "obrigacoes_vencendo_30_dias": obrigacoes_vencendo_30_dias,
        "notas_fiscais_mes": notas_fiscais_mes
    }

# Obrigações Fiscais - CRUD
@router.post("/obrigacoes", response_model=ObrigacaoFiscal)
async def create_obrigacao(
    obrigacao_data: ObrigacaoFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new obrigacao fiscal"""
    check_fiscal_access(current_user)
    
    # Calculate next due date based on periodicity
    hoje = date.today()
    dia_vencimento = obrigacao_data.dia_vencimento
    
    if obrigacao_data.periodicidade == PeriodicidadeObrigacao.MENSAL:
        # Handle months with fewer days than the due day
        try:
            proximo_vencimento = hoje.replace(day=dia_vencimento)
        except ValueError:
            # If day doesn't exist in current month, use last day of month
            import calendar
            last_day = calendar.monthrange(hoje.year, hoje.month)[1]
            proximo_vencimento = hoje.replace(day=min(dia_vencimento, last_day))
        
        if proximo_vencimento <= hoje:
            # Move to next month
            if hoje.month == 12:
                next_year = hoje.year + 1
                next_month = 1
            else:
                next_year = hoje.year
                next_month = hoje.month + 1
            
            try:
                proximo_vencimento = proximo_vencimento.replace(year=next_year, month=next_month, day=dia_vencimento)
            except ValueError:
                # Handle case where next month doesn't have the due day
                import calendar
                last_day = calendar.monthrange(next_year, next_month)[1]
                proximo_vencimento = proximo_vencimento.replace(year=next_year, month=next_month, day=min(dia_vencimento, last_day))
    elif obrigacao_data.periodicidade == PeriodicidadeObrigacao.TRIMESTRAL:
        # Calculate next quarter
        trimestre_atual = (hoje.month - 1) // 3 + 1
        mes_proximo_trimestre = (trimestre_atual * 3) + 1
        if mes_proximo_trimestre > 12:
            mes_proximo_trimestre = 1
            ano = hoje.year + 1
        else:
            ano = hoje.year
        
        # Handle months with fewer days than the due day
        try:
            proximo_vencimento = date(ano, mes_proximo_trimestre, dia_vencimento)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(ano, mes_proximo_trimestre)[1]
            proximo_vencimento = date(ano, mes_proximo_trimestre, min(dia_vencimento, last_day))
    else:
        # Simplified for other periodicities (annual, etc.)
        try:
            proximo_vencimento = hoje.replace(day=dia_vencimento)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(hoje.year, hoje.month)[1]
            proximo_vencimento = hoje.replace(day=min(dia_vencimento, last_day))
    
    obrigacao_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": obrigacao_data.empresa_id,
        "empresa": obrigacao_data.empresa,
        "tipo": obrigacao_data.tipo.value if hasattr(obrigacao_data.tipo, 'value') else obrigacao_data.tipo,
        "nome": obrigacao_data.nome,
        "descricao": obrigacao_data.descricao,
        "periodicidade": obrigacao_data.periodicidade.value if hasattr(obrigacao_data.periodicidade, 'value') else obrigacao_data.periodicidade,
        "dia_vencimento": obrigacao_data.dia_vencimento,
        "proximo_vencimento": datetime.combine(proximo_vencimento, datetime.min.time()),
        "ultimo_vencimento": None,
        "status": StatusObrigacao.PENDENTE.value,
        "responsavel": obrigacao_data.responsavel,
        "regime_tributario": obrigacao_data.regime_tributario.value if hasattr(obrigacao_data.regime_tributario, 'value') else obrigacao_data.regime_tributario,
        "protocolo_entrega": None,
        "data_entrega": None,
        "arquivo_enviado": None,
        "comprovante_entrega": None,
        "observacoes": obrigacao_data.observacoes,
        "valor": obrigacao_data.valor,
        "documentos": [],
        "vencimento": datetime.combine(proximo_vencimento, datetime.min.time()),
        "historico_entregas": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    async with DatabaseAdapter() as db:
        await db.insert_one("fiscal", obrigacao_dict)
    
    return ObrigacaoFiscal(**obrigacao_dict)

@router.get("/obrigacoes", response_model=List[ObrigacaoFiscal])
async def get_obrigacoes(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    responsavel: Optional[str] = Query(None),
    regime_tributario: Optional[str] = Query(None),
    vencimento_inicio: Optional[date] = Query(None),
    vencimento_fim: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get obrigacoes fiscais with advanced filters"""
    check_fiscal_access(current_user)
    
    # Build query (simplified for SQL adapter)
    query = {}
    
    if tipo:
        query["tipo"] = tipo
    
    if status:
        query["status"] = status
        
    if regime_tributario:
        query["regime_tributario"] = regime_tributario
    
    async with DatabaseAdapter() as db:
        obrigacoes_data = await db.find("fiscal", query, limit=limit, skip=skip)
        
        # Apply additional filters that are harder to do in SQL
        filtered_obrigacoes = []
        for obrigacao_data in obrigacoes_data:
            # Filter by responsavel (case insensitive search)
            if responsavel and responsavel.lower() not in obrigacao_data.get("responsavel", "").lower():
                continue
            
            # Filter by search (multiple fields)
            if search:
                search_lower = search.lower()
                searchable_fields = [
                    obrigacao_data.get("empresa", ""),
                    obrigacao_data.get("nome", ""),
                    obrigacao_data.get("responsavel", ""),
                    obrigacao_data.get("descricao", "")
                ]
                if not any(search_lower in field.lower() for field in searchable_fields):
                    continue
            
            # Filter by vencimento range
            if vencimento_inicio and vencimento_fim:
                proximo_vencimento = obrigacao_data.get("proximo_vencimento")
                if proximo_vencimento:
                    if isinstance(proximo_vencimento, str):
                        try:
                            proximo_vencimento = datetime.fromisoformat(proximo_vencimento.replace('Z', '+00:00'))
                        except:
                            continue
                    
                    venc_date = proximo_vencimento.date() if isinstance(proximo_vencimento, datetime) else proximo_vencimento
                    if not (vencimento_inicio <= venc_date <= vencimento_fim):
                        continue
            
            filtered_obrigacoes.append(ObrigacaoFiscal(**obrigacao_data))
    
    return filtered_obrigacoes

@router.get("/obrigacoes/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def get_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get specific obrigacao fiscal"""
    check_fiscal_access(current_user)
    
    async with DatabaseAdapter() as db:
        obrigacao_data = await db.find_one("fiscal", {"id": obrigacao_id})
        
        if not obrigacao_data:
            raise HTTPException(status_code=404, detail="Obrigação fiscal not found")
        
        return ObrigacaoFiscal(**obrigacao_data)

@router.put("/obrigacoes/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def update_obrigacao(
    obrigacao_id: str,
    obrigacao_update: ObrigacaoFiscalUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update obrigacao fiscal"""
    check_fiscal_access(current_user)
    
    async with DatabaseAdapter() as db:
        # Check if exists
        existing = await db.find_one("fiscal", {"id": obrigacao_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Obrigação fiscal not found")
        
        # Prepare update data
        update_data = obrigacao_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        # Convert enums to values
        for key, value in update_data.items():
            if hasattr(value, 'value'):
                update_data[key] = value.value
        
        # Update
        await db.update_one("fiscal", {"id": obrigacao_id}, {"$set": update_data})
        
        # Get updated record
        updated_data = await db.find_one("fiscal", {"id": obrigacao_id})
        return ObrigacaoFiscal(**updated_data)

@router.delete("/obrigacoes/{obrigacao_id}")
async def delete_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete obrigacao fiscal"""
    check_fiscal_access(current_user)
    
    async with DatabaseAdapter() as db:
        result = await db.delete_one("fiscal", {"id": obrigacao_id})
        
        if result["deleted_count"] == 0:
            raise HTTPException(status_code=404, detail="Obrigação fiscal not found")
        
        return {"message": "Obrigação fiscal deleted successfully"}

# Notas Fiscais - CRUD
@router.get("/notas-fiscais", response_model=List[NotaFiscal])
async def get_notas_fiscais(
    current_user: UserResponse = Depends(get_current_user),
    tipo_nota: Optional[str] = Query(None),
    status_conciliacao: Optional[str] = Query(None),
    cnpj_emitente: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get notas fiscais with filters"""
    check_fiscal_access(current_user)
    
    query = {}
    
    if tipo_nota:
        query["tipo"] = tipo_nota
    
    if status_conciliacao:
        query["status_conciliacao"] = status_conciliacao
    
    async with DatabaseAdapter() as db:
        notas_data = await db.find("notas_fiscais", query, limit=limit, skip=skip)
        
        # Apply additional filters
        filtered_notas = []
        for nota_data in notas_data:
            # Filter by CNPJ emitente (partial match)
            if cnpj_emitente and cnpj_emitente not in nota_data.get("emitente_cnpj", ""):
                continue
            
            # Filter by date range
            if data_inicio and data_fim:
                data_emissao = nota_data.get("data_emissao")
                if data_emissao:
                    if isinstance(data_emissao, str):
                        try:
                            data_emissao = datetime.fromisoformat(data_emissao.replace('Z', '+00:00')).date()
                        except:
                            continue
                    
                    if not (data_inicio <= data_emissao <= data_fim):
                        continue
            
            filtered_notas.append(NotaFiscal(**nota_data))
    
    return filtered_notas

@router.post("/notas-fiscais", response_model=NotaFiscal)
async def create_nota_fiscal(
    nota_data: NotaFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new nota fiscal"""
    check_fiscal_access(current_user)
    
    nota_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": nota_data.empresa_id,
        "empresa": nota_data.empresa,
        "tipo": nota_data.tipo.value if hasattr(nota_data.tipo, 'value') else nota_data.tipo,
        "numero": nota_data.numero,
        "serie": nota_data.serie,
        "chave_nfe": nota_data.chave_nfe,
        "data_emissao": nota_data.data_emissao,
        "emitente_cnpj": nota_data.emitente_cnpj,
        "emitente_razao_social": nota_data.emitente_razao_social,
        "destinatario_cnpj": nota_data.destinatario_cnpj,
        "destinatario_razao_social": nota_data.destinatario_razao_social,
        "valor_total": nota_data.valor_total,
        "valor_produtos": nota_data.valor_produtos,
        "valor_servicos": nota_data.valor_servicos,
        "cfop": nota_data.cfop,
        "natureza_operacao": nota_data.natureza_operacao,
        "status_conciliacao": StatusConciliacao.NAO_CONCILIADA.value,
        "xml_content": None,
        "observacoes": getattr(nota_data, 'observacoes', None),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    async with DatabaseAdapter() as db:
        await db.insert_one("notas_fiscais", nota_dict)
    
    return NotaFiscal(**nota_dict)

@router.post("/notas-fiscais/upload-xml")
async def upload_xml_nfe(
    empresa_id: str = Query(...),
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload XML NFe file"""
    check_fiscal_access(current_user)
    
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="File must be XML")
    
    # This is a placeholder - in real implementation would parse XML
    return {"message": "XML upload functionality available", "filename": file.filename}

# Relatórios
@router.get("/relatorios/impostos")
async def get_relatorio_impostos(
    periodo: str = Query(..., description="Período no formato YYYY-MM"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get relatório de impostos por período"""
    check_fiscal_access(current_user)
    
    try:
        ano, mes = periodo.split('-')
        ano = int(ano)
        mes = int(mes)
    except:
        raise HTTPException(status_code=400, detail="Período deve estar no formato YYYY-MM")
    
    # Calculate period dates
    inicio_periodo = datetime(ano, mes, 1)
    if mes == 12:
        fim_periodo = datetime(ano + 1, 1, 1) - timedelta(days=1)
    else:
        fim_periodo = datetime(ano, mes + 1, 1) - timedelta(days=1)
    
    async with DatabaseAdapter() as db:
        # Get obrigações do período
        obrigacoes = await db.find("fiscal", {})
        
        detalhes_por_tipo = {}
        total_impostos = 0.0
        
        for obrigacao in obrigacoes:
            # Check if obrigação is in the period
            proximo_vencimento = obrigacao.get("proximo_vencimento")
            if proximo_vencimento:
                if isinstance(proximo_vencimento, str):
                    try:
                        proximo_vencimento = datetime.fromisoformat(proximo_vencimento.replace('Z', '+00:00'))
                    except:
                        continue
                
                if inicio_periodo <= proximo_vencimento <= fim_periodo:
                    tipo = obrigacao.get("tipo", "outros")
                    valor = obrigacao.get("valor", 0.0) or 0.0
                    
                    if tipo not in detalhes_por_tipo:
                        detalhes_por_tipo[tipo] = {
                            "tipo": tipo,
                            "quantidade": 0,
                            "valor_total": 0.0,
                            "obrigacoes": []
                        }
                    
                    detalhes_por_tipo[tipo]["quantidade"] += 1
                    detalhes_por_tipo[tipo]["valor_total"] += valor
                    detalhes_por_tipo[tipo]["obrigacoes"].append({
                        "nome": obrigacao.get("nome"),
                        "empresa": obrigacao.get("empresa"),
                        "valor": valor,
                        "vencimento": proximo_vencimento.isoformat()
                    })
                    
                    total_impostos += valor
    
    return {
        "periodo": periodo,
        "detalhes_por_tipo": list(detalhes_por_tipo.values()),
        "resumo_geral": {
            "total_impostos": total_impostos,
            "quantidade_total": sum(d["quantidade"] for d in detalhes_por_tipo.values())
        }
    }