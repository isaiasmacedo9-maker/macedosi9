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
from database import (
    get_fiscal_collection, get_notas_fiscais_collection,
    get_apuracoes_fiscais_collection
)
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

# Obrigações Fiscais - CRUD Expandido
@router.post("/obrigacoes", response_model=ObrigacaoFiscal)
async def create_obrigacao(
    obrigacao_data: ObrigacaoFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    # Calculate next due date based on periodicity
    hoje = date.today()
    dia_vencimento = obrigacao_data.dia_vencimento
    
    if obrigacao_data.periodicidade == PeriodicidadeObrigacao.MENSAL:
        proximo_vencimento = hoje.replace(day=dia_vencimento)
        if proximo_vencimento <= hoje:
            if hoje.month == 12:
                proximo_vencimento = proximo_vencimento.replace(year=hoje.year + 1, month=1)
            else:
                proximo_vencimento = proximo_vencimento.replace(month=hoje.month + 1)
    elif obrigacao_data.periodicidade == PeriodicidadeObrigacao.TRIMESTRAL:
        # Calculate next quarter
        trimestre_atual = (hoje.month - 1) // 3 + 1
        mes_proximo_trimestre = (trimestre_atual * 3) + 1
        if mes_proximo_trimestre > 12:
            mes_proximo_trimestre = 1
            ano = hoje.year + 1
        else:
            ano = hoje.year
        proximo_vencimento = date(ano, mes_proximo_trimestre, dia_vencimento)
    else:
        # Simplified for other periodicities
        proximo_vencimento = hoje.replace(day=dia_vencimento)
    
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
        "documentos": [],  # Mantido para compatibilidade
        "vencimento": datetime.combine(proximo_vencimento, datetime.min.time()),  # Mantido para compatibilidade
        "historico_entregas": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await fiscal_collection.insert_one(obrigacao_dict)
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
    fiscal_collection = await get_fiscal_collection()
    
    # Build query
    query = {}
    
    if tipo:
        query["tipo"] = tipo
    
    if status:
        query["status"] = status
        
    if responsavel:
        query["responsavel"] = {"$regex": responsavel, "$options": "i"}
        
    if regime_tributario:
        query["regime_tributario"] = regime_tributario
    
    if vencimento_inicio and vencimento_fim:
        query["proximo_vencimento"] = {
            "$gte": datetime.combine(vencimento_inicio, datetime.min.time()),
            "$lte": datetime.combine(vencimento_fim, datetime.max.time())
        }
    
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"nome": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}}
        ]
    
    obrigacoes_cursor = fiscal_collection.find(query).skip(skip).limit(limit).sort("proximo_vencimento", 1)
    obrigacoes = []
    async for obrigacao_data in obrigacoes_cursor:
        obrigacoes.append(ObrigacaoFiscal(**obrigacao_data))
    
    return obrigacoes

@router.get("/obrigacoes/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def get_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get obrigacao fiscal by ID"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    obrigacao_data = await fiscal_collection.find_one({"id": obrigacao_id})
    
    if not obrigacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    return ObrigacaoFiscal(**obrigacao_data)

@router.put("/obrigacoes/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def update_obrigacao(
    obrigacao_id: str,
    obrigacao_update: ObrigacaoFiscalUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    existing_obrigacao = await fiscal_collection.find_one({"id": obrigacao_id})
    if not existing_obrigacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    # Build update data
    update_data = {k: v.value if hasattr(v, 'value') else v for k, v in obrigacao_update.model_dump().items() if v is not None}
    
    # Convert dates if present
    if 'data_entrega' in update_data and update_data['data_entrega']:
        update_data['data_entrega'] = datetime.combine(update_data['data_entrega'], datetime.min.time())
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # Add to history if status or delivery changed
        if 'status' in update_data or 'data_entrega' in update_data:
            historico_entry = {
                "data": datetime.utcnow(),
                "acao": "Status atualizado" if 'status' in update_data else "Entrega registrada",
                "usuario": current_user.name,
                "detalhes": update_data
            }
            
            await fiscal_collection.update_one(
                {"id": obrigacao_id}, 
                {
                    "$set": update_data,
                    "$push": {"historico_entregas": historico_entry}
                }
            )
        else:
            await fiscal_collection.update_one(
                {"id": obrigacao_id}, 
                {"$set": update_data}
            )
    
    updated_obrigacao_data = await fiscal_collection.find_one({"id": obrigacao_id})
    return ObrigacaoFiscal(**updated_obrigacao_data)

@router.delete("/obrigacoes/{obrigacao_id}")
async def delete_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    result = await fiscal_collection.delete_one({"id": obrigacao_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    return {"message": "Obrigacao deleted successfully"}

# Notas Fiscais - CRUD Completo
@router.post("/notas-fiscais", response_model=NotaFiscal)
async def create_nota_fiscal(
    nota_data: NotaFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new nota fiscal"""
    check_fiscal_access(current_user)
    notas_collection = await get_notas_fiscais_collection()
    
    # Check if NFe key already exists
    existing_nota = await notas_collection.find_one({"chave_nfe": nota_data.chave_nfe})
    if existing_nota:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nota fiscal with this chave NFe already exists"
        )
    
    nota_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": nota_data.empresa_id,
        "empresa": nota_data.empresa,
        "tipo": nota_data.tipo.value if hasattr(nota_data.tipo, 'value') else nota_data.tipo,
        "numero": nota_data.numero,
        "serie": nota_data.serie,
        "chave_nfe": nota_data.chave_nfe,
        "data_emissao": datetime.combine(nota_data.data_emissao, datetime.min.time()),
        "data_vencimento": datetime.combine(nota_data.data_vencimento, datetime.min.time()) if nota_data.data_vencimento else None,
        "emitente_cnpj": nota_data.emitente_cnpj,
        "emitente_razao_social": nota_data.emitente_razao_social,
        "destinatario_cnpj": nota_data.destinatario_cnpj,
        "destinatario_razao_social": nota_data.destinatario_razao_social,
        "valor_total": nota_data.valor_total,
        "valor_produtos": nota_data.valor_produtos,
        "valor_servicos": nota_data.valor_servicos,
        "base_icms": 0.0,
        "valor_icms": 0.0,
        "base_ipi": 0.0,
        "valor_ipi": 0.0,
        "valor_pis": 0.0,
        "valor_cofins": 0.0,
        "valor_iss": 0.0,
        "impostos": [],
        "status_conciliacao": StatusConciliacao.NAO_CONCILIADO.value,
        "conciliado_com": None,
        "data_conciliacao": None,
        "arquivo_xml": None,
        "arquivo_pdf": None,
        "cfop": nota_data.cfop,
        "natureza_operacao": nota_data.natureza_operacao,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await notas_collection.insert_one(nota_dict)
    return NotaFiscal(**nota_dict)

@router.get("/notas-fiscais", response_model=List[NotaFiscal])
async def get_notas_fiscais(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    emitente_cnpj: Optional[str] = Query(None),
    chave_nfe: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    status_conciliacao: Optional[str] = Query(None),
    valor_minimo: Optional[float] = Query(None),
    valor_maximo: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get notas fiscais with filters"""
    check_fiscal_access(current_user)
    notas_collection = await get_notas_fiscais_collection()
    
    # Build query
    query = {}
    
    if tipo:
        query["tipo"] = tipo
    
    if emitente_cnpj:
        query["emitente_cnpj"] = {"$regex": emitente_cnpj, "$options": "i"}
    
    if chave_nfe:
        query["chave_nfe"] = {"$regex": chave_nfe, "$options": "i"}
    
    if status_conciliacao:
        query["status_conciliacao"] = status_conciliacao
    
    if data_inicio and data_fim:
        query["data_emissao"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    if valor_minimo is not None or valor_maximo is not None:
        valor_query = {}
        if valor_minimo is not None:
            valor_query["$gte"] = valor_minimo
        if valor_maximo is not None:
            valor_query["$lte"] = valor_maximo
        query["valor_total"] = valor_query
    
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"emitente_razao_social": {"$regex": search, "$options": "i"}},
            {"destinatario_razao_social": {"$regex": search, "$options": "i"}},
            {"chave_nfe": {"$regex": search, "$options": "i"}}
        ]
    
    notas_cursor = notas_collection.find(query).skip(skip).limit(limit).sort("data_emissao", -1)
    notas = []
    async for nota_data in notas_cursor:
        notas.append(NotaFiscal(**nota_data))
    
    return notas

@router.post("/notas-fiscais/upload-xml")
async def upload_xml_nfe(
    arquivo: UploadFile = File(...),
    empresa_id: str = Query(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload and process XML NFe"""
    check_fiscal_access(current_user)
    
    if not arquivo.filename.lower().endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only XML files are allowed"
        )
    
    try:
        # Read XML content
        xml_content = await arquivo.read()
        xml_string = xml_content.decode('utf-8')
        
        # Parse XML
        root = ET.fromstring(xml_string)
        
        # Extract NFe data (simplified extraction)
        # This is a basic implementation - production would need more robust XML parsing
        nfe_info = extract_nfe_data(root, empresa_id)
        
        # Create nota fiscal from XML data
        notas_collection = await get_notas_fiscais_collection()
        
        # Check if already exists
        existing = await notas_collection.find_one({"chave_nfe": nfe_info.get("chave_nfe")})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NFe already exists in system"
            )
        
        nfe_info["arquivo_xml"] = base64.b64encode(xml_content).decode('utf-8')
        nfe_info["created_at"] = datetime.utcnow()
        nfe_info["updated_at"] = datetime.utcnow()
        
        await notas_collection.insert_one(nfe_info)
        
        return {
            "message": "XML processed successfully",
            "chave_nfe": nfe_info.get("chave_nfe"),
            "valor_total": nfe_info.get("valor_total")
        }
        
    except ET.ParseError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid XML format"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing XML: {str(e)}"
        )

def extract_nfe_data(xml_root, empresa_id: str) -> dict:
    """Extract NFe data from XML (simplified implementation)"""
    # This is a basic implementation - production would need comprehensive XML parsing
    nfe_info = {
        "id": str(uuid.uuid4()),
        "empresa_id": empresa_id,
        "empresa": "Empresa XML Import",
        "tipo": TipoNota.ENTRADA.value,
        "numero": 1,
        "serie": "1",
        "chave_nfe": "EXTRACTED_FROM_XML",
        "data_emissao": datetime.utcnow(),
        "emitente_cnpj": "00000000000000",
        "emitente_razao_social": "Emitente XML",
        "valor_total": 100.0,
        "valor_produtos": 100.0,
        "valor_servicos": 0.0,
        "status_conciliacao": StatusConciliacao.NAO_CONCILIADO.value,
        "impostos": []
    }
    
    # TODO: Implement proper XML parsing for production
    return nfe_info

# Dashboard e Relatórios
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get fiscal dashboard statistics"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    notas_collection = await get_notas_fiscais_collection()
    
    # Obrigações por status
    obrigacoes_stats = {}
    for status_val in StatusObrigacao:
        count = await fiscal_collection.count_documents({"status": status_val.value})
        obrigacoes_stats[status_val.value] = count
    
    # Obrigações vencendo (próximos 30 dias)
    data_limite = datetime.combine(date.today() + timedelta(days=30), datetime.max.time())
    obrigacoes_vencendo = await fiscal_collection.count_documents({
        "proximo_vencimento": {"$lte": data_limite},
        "status": {"$in": [StatusObrigacao.PENDENTE.value, StatusObrigacao.EM_ANDAMENTO.value]}
    })
    
    # Obrigações por tipo
    obrigacoes_tipo = {}
    for tipo_val in TipoObrigacao:
        count = await fiscal_collection.count_documents({"tipo": tipo_val.value})
        if count > 0:
            obrigacoes_tipo[tipo_val.value] = count
    
    # Notas fiscais este mês
    inicio_mes = datetime.combine(date.today().replace(day=1), datetime.min.time())
    notas_mes = await notas_collection.count_documents({
        "data_emissao": {"$gte": inicio_mes}
    })
    
    # Valor total notas fiscais não conciliadas
    pipeline_nao_conciliadas = [
        {"$match": {"status_conciliacao": StatusConciliacao.NAO_CONCILIADO.value}},
        {"$group": {"_id": None, "total": {"$sum": "$valor_total"}, "count": {"$sum": 1}}}
    ]
    
    nao_conciliadas = {"total": 0, "count": 0}
    async for result in notas_collection.aggregate(pipeline_nao_conciliadas):
        nao_conciliadas = {"total": result.get("total", 0), "count": result.get("count", 0)}
    
    return {
        "obrigacoes_por_status": obrigacoes_stats,
        "obrigacoes_vencendo": obrigacoes_vencendo,
        "obrigacoes_por_tipo": obrigacoes_tipo,
        "notas_fiscais_mes": notas_mes,
        "notas_nao_conciliadas": nao_conciliadas,
        "data_atualizacao": datetime.utcnow()
    }

@router.get("/relatorios/impostos")
async def relatorio_impostos(
    periodo: str = Query(..., regex=r"^\d{4}-\d{2}$"),  # YYYY-MM
    empresa_id: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate tax report for period"""
    check_fiscal_access(current_user)
    notas_collection = await get_notas_fiscais_collection()
    
    # Parse period
    ano, mes = map(int, periodo.split('-'))
    inicio_periodo = datetime(ano, mes, 1)
    if mes == 12:
        fim_periodo = datetime(ano + 1, 1, 1) - timedelta(days=1)
    else:
        fim_periodo = datetime(ano, mes + 1, 1) - timedelta(days=1)
    
    # Build query
    query = {
        "data_emissao": {"$gte": inicio_periodo, "$lte": fim_periodo}
    }
    
    if empresa_id:
        query["empresa_id"] = empresa_id
    
    # Aggregate tax data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$tipo",
            "total_notas": {"$sum": 1},
            "valor_total": {"$sum": "$valor_total"},
            "total_icms": {"$sum": "$valor_icms"},
            "total_ipi": {"$sum": "$valor_ipi"},
            "total_pis": {"$sum": "$valor_pis"},
            "total_cofins": {"$sum": "$valor_cofins"},
            "total_iss": {"$sum": "$valor_iss"}
        }}
    ]
    
    resultados = []
    total_geral = ResumoImpostos(periodo=periodo)
    
    async for result in notas_collection.aggregate(pipeline):
        tipo_nota = result["_id"]
        resumo = {
            "tipo_nota": tipo_nota,
            "total_notas": result["total_notas"],
            "valor_total": result["valor_total"],
            "impostos": {
                "icms": result["total_icms"],
                "ipi": result["total_ipi"],
                "pis": result["total_pis"],
                "cofins": result["total_cofins"],  
                "iss": result["total_iss"]
            }
        }
        resultados.append(resumo)
        
        # Add to general total
        total_geral.icms += result["total_icms"]
        total_geral.ipi += result["total_ipi"]
        total_geral.pis += result["total_pis"] 
        total_geral.cofins += result["total_cofins"]
        total_geral.iss += result["total_iss"]
    
    total_geral.total_impostos = (
        total_geral.icms + total_geral.ipi + total_geral.pis + 
        total_geral.cofins + total_geral.iss
    )
    
    return {
        "periodo": periodo,
        "detalhes_por_tipo": resultados,
        "resumo_geral": total_geral.model_dump(),
        "data_geracao": datetime.utcnow()
    }

# Backward compatibility - manter rotas legadas
@router.post("/", response_model=ObrigacaoFiscal)
async def create_obrigacao_legacy(
    obrigacao_data: ObrigacaoFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Legacy endpoint"""
    return await create_obrigacao(obrigacao_data, current_user)

@router.get("/", response_model=List[ObrigacaoFiscal])
async def get_obrigacoes_legacy(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Legacy endpoint"""
    return await get_obrigacoes(current_user, tipo, status, None, None, None, None, search, skip, limit)