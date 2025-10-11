from fastapi import APIRouter, HTTPException, status, Depends, Query, File, UploadFile
from typing import List, Optional
from models.financial import (
    ContaReceber, ContaReceberCreate, ContaReceberUpdate, PagamentoTitulo,
    FinancialClient, FinancialClientCreate, FinancialClientUpdate,
    HistoricoAlteracao, ContatoCobranca, ContatoCobrancaCreate,
    PropostaRenegociacao, ContaReceberFilters, RelatorioFinanceiro,
    ImportacaoExtrato, MovimentoExtrato, ClassificacaoMovimento,
    SituacaoTitulo, FormaPagamento
)
from models.user import UserResponse
from auth import get_current_user
from database_adapter import DatabaseAdapter
from datetime import datetime, date, timedelta
import json
import uuid
import re
from typing import Dict, Any

router = APIRouter(prefix="/financial", tags=["Financial"])

def check_financial_access(user: UserResponse):
    """Check if user has access to financial module"""
    if user.role != "admin" and "financeiro" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to financial module not allowed"
        )

# Contas a Receber
@router.post("/contas-receber", response_model=ContaReceber)
async def create_conta_receber(
    conta_data: ContaReceberCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new conta a receber"""
    check_financial_access(current_user)
    
    async with DatabaseAdapter() as db:
        # Calculate totals
        total_bruto = conta_data.valor_original
        total_liquido = total_bruto
        
        # Create conta dict manually to ensure proper serialization
        conta_dict = {
            "id": str(uuid.uuid4()),
            "empresa_id": conta_data.empresa_id,
            "empresa": conta_data.empresa,
            "situacao": SituacaoTitulo.EM_ABERTO.value,
            "descricao": conta_data.descricao,
            "documento": conta_data.documento,
            "tipo_documento": conta_data.tipo_documento.value if hasattr(conta_data.tipo_documento, 'value') else conta_data.tipo_documento,
            "forma_pagamento": conta_data.forma_pagamento.value if hasattr(conta_data.forma_pagamento, 'value') else conta_data.forma_pagamento,
            "conta": conta_data.conta,
            "centro_custo": conta_data.centro_custo,
            "plano_custo": conta_data.plano_custo,
            "data_emissao": datetime.combine(conta_data.data_emissao, datetime.min.time()),
            "data_vencimento": datetime.combine(conta_data.data_vencimento, datetime.min.time()),
            "valor_original": conta_data.valor_original,
            "desconto_aplicado": 0.0,
            "acrescimo_aplicado": 0.0,
            "valor_quitado": 0.0,
            "troco": 0.0,
            "total_bruto": total_bruto,
            "total_liquido": total_liquido,
            "cidade_atendimento": conta_data.cidade_atendimento,
            "usuario_responsavel": conta_data.usuario_responsavel,
            "observacao": conta_data.observacao,
            "data_recebimento": None,
            "historico_alteracoes": [
                {
                    "data": datetime.utcnow(),
                    "acao": "Título criado",
                    "usuario": current_user.name,
                    "observacao": "Título criado via API",
                    "campo_alterado": None,
                    "valor_anterior": None,
                    "valor_novo": None
                }
            ],
            "contatos_cobranca": [],
            "anexos": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.insert_one("contas_receber", conta_dict)
        
        # Convert to model for response
        return ContaReceber(**conta_dict)

@router.get("/contas-receber", response_model=List[ContaReceber])
async def get_contas_receber(
    current_user: UserResponse = Depends(get_current_user),
    cidade: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get contas a receber with filters"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query
    query = {}
    
    # City access control
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    # Situation filter
    if situacao:
        query["situacao"] = situacao
    
    # Search filter
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"documento": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}}
        ]
    
    contas_cursor = contas_collection.find(query).skip(skip).limit(limit).sort("data_vencimento", -1)
    contas = []
    async for conta_data in contas_cursor:
        contas.append(ContaReceber(**conta_data))
    
    return contas

@router.get("/contas-receber/{conta_id}", response_model=ContaReceber)
async def get_conta_receber(
    conta_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get conta a receber by ID"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:

            conta_data = await await db.find_one("contas_receber", {"id": conta_id})
    
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    return ContaReceber(**conta_data)

@router.put("/contas-receber/{conta_id}/baixa")
async def baixar_conta_receber(
    conta_id: str,
    pagamento_data: PagamentoTitulo,
    current_user: UserResponse = Depends(get_current_user)
):
    """Dar baixa em conta a receber"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:

            conta_data = await await db.find_one("contas_receber", {"id": conta_id})
    
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    conta = ContaReceber(**conta_data)
    
    # Update conta
    historico_action = HistoricoAlteracao(
        acao="Baixa realizada",
        usuario=current_user.name,
        observacao=pagamento_data.observacao or "Pagamento recebido",
        valor_novo=str(pagamento_data.valor_recebido)
    )
    
    update_data = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": datetime.combine(pagamento_data.data_recebimento, datetime.min.time()),
        "desconto_aplicado": pagamento_data.desconto_aplicado,
        "acrescimo_aplicado": pagamento_data.acrescimo_aplicado,
        "valor_quitado": pagamento_data.valor_recebido,
        "troco": pagamento_data.troco,
        "total_liquido": conta.valor_original - pagamento_data.desconto_aplicado + pagamento_data.acrescimo_aplicado,
        "updated_at": datetime.utcnow()
    }
    
    # Update the document with both $set and $push operations
    await contas_collection.update_one(
        {"id": conta_id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )
    
    # Get updated conta
    updated_conta_data = await contas_collection.find_one({"id": conta_id})
    return ContaReceber(**updated_conta_data)

@router.put("/contas-receber/{conta_id}", response_model=ContaReceber)
async def update_conta_receber(
    conta_id: str,
    conta_update: ContaReceberUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update conta a receber"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Build update data
    update_data = {k: v for k, v in conta_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Add to history
    historico_action = HistoricoAlteracao(
        acao="Registro editado",
        usuario=current_user.name,
        observacao="Dados atualizados"
    )
    
    await contas_collection.update_one(
        {"id": conta_id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )
    
    # Get updated conta
    updated_conta_data = await contas_collection.find_one({"id": conta_id})
    return ContaReceber(**updated_conta_data)

@router.delete("/contas-receber/{conta_id}")
async def delete_conta_receber(
    conta_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete conta a receber"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    result = await contas_collection.delete_one({"id": conta_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    return {"message": "Conta a receber deleted successfully"}

@router.post("/contas-receber/{conta_id}/duplicate", response_model=ContaReceber)
async def duplicate_conta_receber(
    conta_id: str,
    nova_data_vencimento: date,
    current_user: UserResponse = Depends(get_current_user)
):
    """Duplicate conta a receber for recurring entries"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Create new conta based on original
    conta_original = ContaReceber(**conta_data)
    
    # Create new conta dict manually to ensure proper serialization
    nova_conta_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": conta_original.empresa_id,
        "empresa": conta_original.empresa,
        "situacao": SituacaoTitulo.EM_ABERTO.value,
        "descricao": conta_original.descricao,
        "documento": f"{conta_original.documento}-DUP",
        "tipo_documento": conta_original.tipo_documento.value if hasattr(conta_original.tipo_documento, 'value') else conta_original.tipo_documento,
        "forma_pagamento": conta_original.forma_pagamento.value if hasattr(conta_original.forma_pagamento, 'value') else conta_original.forma_pagamento,
        "conta": conta_original.conta,
        "centro_custo": conta_original.centro_custo,
        "plano_custo": conta_original.plano_custo,
        "data_emissao": datetime.combine(date.today(), datetime.min.time()),
        "data_vencimento": datetime.combine(nova_data_vencimento, datetime.min.time()),
        "valor_original": conta_original.valor_original,
        "desconto_aplicado": 0.0,
        "acrescimo_aplicado": 0.0,
        "valor_quitado": 0.0,
        "troco": 0.0,
        "total_bruto": conta_original.valor_original,
        "total_liquido": conta_original.valor_original,
        "cidade_atendimento": conta_original.cidade_atendimento,
        "usuario_responsavel": current_user.name,
        "observacao": conta_original.observacao,
        "data_recebimento": None,
        "historico_alteracoes": [
            {
                "data": datetime.utcnow(),
                "acao": "Criado por duplicação",
                "usuario": current_user.name,
                "observacao": f"Duplicado do título {conta_id}",
                "campo_alterado": None,
                "valor_anterior": None,
                "valor_novo": None
            }
        ],
        "contatos_cobranca": [],
        "anexos": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await contas_collection.insert_one(nova_conta_dict)
    
    # Convert back to model for response
    return ContaReceber(**nova_conta_dict)

# Cobrança e Contatos
@router.post("/contas-receber/{conta_id}/contatos", response_model=ContatoCobranca)
async def add_contato_cobranca(
    conta_id: str,
    contato_data: ContatoCobrancaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Add contact record to conta a receber"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Create contato data without titulo_id (it's already in the conta)
    contato_dict = contato_data.model_dump()
    contato_dict.pop('titulo_id', None)  # Remove titulo_id as it's not part of ContatoCobranca model
    contato_dict['usuario_responsavel'] = current_user.name
    
    contato = ContatoCobranca(**contato_dict)
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"contatos_cobranca": contato.model_dump()}}
    )
    
    return contato

@router.post("/contas-receber/{conta_id}/proposta-renegociacao", response_model=PropostaRenegociacao)
async def create_proposta_renegociacao(
    conta_id: str,
    proposta_data: PropostaRenegociacao,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create renegotiation proposal"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    # Update proposta with conta_id and user
    proposta_data.titulo_id = conta_id
    proposta_data.usuario_responsavel = current_user.name
    
    # Add to historical record
    historico_action = HistoricoAlteracao(
        acao="Proposta de renegociação criada",
        usuario=current_user.name,
        observacao=f"Nova data: {proposta_data.nova_data_vencimento}, Novo valor: R${proposta_data.novo_valor}"
    )
    
    # Convert date to datetime for MongoDB
    historico_dict = historico_action.model_dump()
    historico_dict["data"] = datetime.utcnow()
    
    await contas_collection.update_one(
        {"id": conta_id},
        {"$push": {"historico_alteracoes": historico_dict}}
    )
    
    return proposta_data

@router.get("/cobranca/lembretes/{conta_id}")
async def gerar_lembrete_cobranca(
    conta_id: str,
    tipo: str = Query(..., regex="^(whatsapp|email)$"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate collection reminder text"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    conta_data = await contas_collection.find_one({"id": conta_id})
    if not conta_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conta a receber not found"
        )
    
    conta = ContaReceber(**conta_data)
    
    if tipo == "whatsapp":
        mensagem = f"""
🏢 *{conta.empresa}*

Prezado(a) cliente,

Identificamos que o título referente ao documento *{conta.documento}* no valor de *R$ {conta.total_liquido:.2f}* com vencimento em *{conta.data_vencimento.strftime('%d/%m/%Y')}* encontra-se em aberto.

Por gentileza, regularizar a situação o mais breve possível.

Atenciosamente,
Macedo SI - Contabilidade
        """
    else:  # email
        mensagem = f"""
Assunto: Cobrança - Documento {conta.documento}

Prezado(a) {conta.empresa},

Informamos que o título referente ao documento {conta.documento} no valor de R$ {conta.total_liquido:.2f} com vencimento em {conta.data_vencimento.strftime('%d/%m/%Y')} encontra-se em aberto em nossos registros.

Solicitamos a gentileza de regularizar a situação o mais breve possível.

Atenciosamente,
Macedo SI - Contabilidade
        """
    
    return {"mensagem": mensagem.strip(), "tipo": tipo}

# Relatórios
@router.get("/relatorios/inadimplencia")
async def relatorio_inadimplencia(
    cidade: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate default report"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query
    query = {"situacao": {"$in": [SituacaoTitulo.ATRASADO, SituacaoTitulo.EM_ABERTO]}}
    
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    if data_inicio and data_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    # Aggregate data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "cidade": "$cidade_atendimento",
                "situacao": "$situacao"
            },
            "total_titulos": {"$sum": 1},
            "valor_total": {"$sum": "$total_liquido"}
        }},
        {"$sort": {"_id.cidade": 1, "_id.situacao": 1}}
    ]
    
    resultados = []
    async for result in contas_collection.aggregate(pipeline):
        resultados.append({
            "cidade": result["_id"]["cidade"],
            "situacao": result["_id"]["situacao"],
            "total_titulos": result["total_titulos"],
            "valor_total": result["valor_total"]
        })
    
    return {"relatorio": resultados, "data_geracao": datetime.utcnow()}

@router.get("/relatorios/recebimentos")
async def relatorio_recebimentos(
    data_inicio: date = Query(...),
    data_fim: date = Query(...),
    cidade: Optional[str] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Generate payment report"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query - convert dates to datetime for MongoDB
    query = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    }
    
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif cidade:
        query["cidade_atendimento"] = cidade
    
    # Aggregate data
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {
                "forma_pagamento": "$forma_pagamento",
                "cidade": "$cidade_atendimento"
            },
            "total_titulos": {"$sum": 1},
            "valor_total": {"$sum": "$valor_quitado"},
            "desconto_total": {"$sum": "$desconto_aplicado"},
            "acrescimo_total": {"$sum": "$acrescimo_aplicado"}
        }},
        {"$sort": {"_id.cidade": 1, "_id.forma_pagamento": 1}}
    ]
    
    resultados = []
    async for result in contas_collection.aggregate(pipeline):
        resultados.append({
            "forma_pagamento": result["_id"]["forma_pagamento"],
            "cidade": result["_id"]["cidade"],
            "total_titulos": result["total_titulos"],
            "valor_total": result["valor_total"],
            "desconto_total": result["desconto_total"],
            "acrescimo_total": result["acrescimo_total"]
        })
    
    return {
        "relatorio": resultados,
        "periodo": {"inicio": data_inicio, "fim": data_fim},
        "data_geracao": datetime.utcnow()
    }

# Importação de Extratos
@router.post("/extrato/importar", response_model=ImportacaoExtrato)
async def importar_extrato(
    arquivo: UploadFile = File(...),
    conta_bancaria: str = Query(...),
    cidade: str = Query(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Import bank statement (PDF/CSV)"""
    check_financial_access(current_user)
    
    # Validate file type
    if not arquivo.filename.lower().endswith(('.pdf', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and CSV files are supported"
        )
    
    # Create import record
    importacao = ImportacaoExtrato(
        nome_arquivo=arquivo.filename,
        tipo_arquivo=arquivo.filename.split('.')[-1].upper(),
        conta_bancaria=conta_bancaria,
        cidade=cidade,
        usuario_responsavel=current_user.name,
        total_movimentos=0,
        status="processando"
    )
    
    # Save import record
    async with DatabaseAdapter() as db:

            await await db.insert_one("importacoes_extrato", importacao.model_dump())
    
    try:
        # Read file content
        conteudo = await arquivo.read()
        
        # Process file based on type
        if arquivo.filename.lower().endswith('.pdf'):
            movimentos = await processar_pdf_extrato(conteudo, importacao.id)
        else:  # CSV
            movimentos = await processar_csv_extrato(conteudo, importacao.id)
        
        # Update import record
        importacao.movimentos = movimentos
        importacao.total_movimentos = len(movimentos)
        importacao.status = "processando_matches"
        importacao.log_processamento.append(f"Arquivo processado: {len(movimentos)} movimentos encontrados")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        # Try automatic matching
        baixas_automaticas = await processar_conciliacao_automatica(importacao.id, current_user.name)
        
        # Final update
        importacao.baixas_automaticas = baixas_automaticas
        importacao.pendentes_classificacao = len([m for m in movimentos if m.status_classificacao == "pendente"])
        importacao.status = "concluido"
        importacao.log_processamento.append(f"Conciliação automática: {baixas_automaticas} títulos baixados")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        return importacao
        
    except Exception as e:
        # Update import with error
        importacao.status = "erro"
        importacao.log_processamento.append(f"Erro no processamento: {str(e)}")
        
        await importacoes_collection.update_one(
            {"id": importacao.id},
            {"$set": importacao.model_dump()}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )

async def processar_pdf_extrato(conteudo: bytes, importacao_id: str) -> List[MovimentoExtrato]:
    """Process PDF bank statement using basic text extraction"""
    try:
        # Simple PDF text extraction (would need PyPDF2 or similar for production)
        # For now, we'll create a mock implementation
        text_content = conteudo.decode('utf-8', errors='ignore')
        
        movimentos = []
        lines = text_content.split('\n')
        
        for line in lines:
            # Try to find patterns that look like bank movements
            # This is a simplified version - real implementation would be more robust
            if re.search(r'\d{2}/\d{2}/\d{4}.*\d+[,\.]\d{2}', line):
                movimento = extrair_movimento_da_linha(line)
                if movimento:
                    movimentos.append(movimento)
        
        return movimentos
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing PDF: {str(e)}"
        )

async def processar_csv_extrato(conteudo: bytes, importacao_id: str) -> List[MovimentoExtrato]:
    """Process CSV bank statement"""
    try:
        text_content = conteudo.decode('utf-8')
        lines = text_content.strip().split('\n')
        
        # Skip header if present
        if lines and ('data' in lines[0].lower() or 'date' in lines[0].lower()):
            lines = lines[1:]
        
        movimentos = []
        for line in lines:
            if line.strip():
                campos = line.split(';')  # Try semicolon first
                if len(campos) < 3:
                    campos = line.split(',')  # Fallback to comma
                
                if len(campos) >= 3:
                    movimento = criar_movimento_from_csv(campos)
                    if movimento:
                        movimentos.append(movimento)
        
        return movimentos
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing CSV: {str(e)}"
        )

def extrair_movimento_da_linha(linha: str) -> Optional[MovimentoExtrato]:
    """Extract movement data from a text line"""
    try:
        # Pattern to extract date, description and value
        date_pattern = r'(\d{2}/\d{2}/\d{4})'
        value_pattern = r'([\d,\.]+)'
        
        date_match = re.search(date_pattern, linha)
        if not date_match:
            return None
        
        # Extract date
        data_str = date_match.group(1)
        data_movimento = datetime.strptime(data_str, '%d/%m/%Y').date()
        
        # Extract description (text between date and value)
        descricao_match = re.search(f'{date_pattern}\\s*(.+?)\\s*{value_pattern}', linha)
        descricao = descricao_match.group(2).strip() if descricao_match else linha.strip()
        
        # Extract value (last occurrence)
        valores = re.findall(r'[\d,\.]+', linha)
        if not valores:
            return None
        
        valor_str = valores[-1].replace(',', '.')
        valor = float(valor_str)
        
        # Determine if credit or debit (simple heuristic)
        tipo_movimento = "credito" if "CREDITO" in linha.upper() or valor > 0 else "debito"
        
        # Try to extract CNPJ
        cnpj_pattern = r'(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})'
        cnpj_match = re.search(cnpj_pattern, descricao)
        cnpj_detectado = cnpj_match.group(1) if cnpj_match else None
        
        return MovimentoExtrato(
            data_movimento=data_movimento,
            descricao_original=linha.strip(),
            descricao_processada=descricao,
            valor=abs(valor),
            tipo_movimento=tipo_movimento,
            cnpj_detectado=cnpj_detectado
        )
        
    except Exception:
        return None

def criar_movimento_from_csv(campos: List[str]) -> Optional[MovimentoExtrato]:
    """Create movement from CSV fields"""
    try:
        if len(campos) < 3:
            return None
        
        # Assume: Date, Description, Value, [Balance]
        data_str = campos[0].strip()
        descricao = campos[1].strip()
        valor_str = campos[2].strip().replace(',', '.')
        saldo_str = campos[3].strip().replace(',', '.') if len(campos) > 3 else None
        
        # Parse date (try multiple formats)
        data_movimento = None
        for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y']:
            try:
                data_movimento = datetime.strptime(data_str, fmt).date()
                break
            except ValueError:
                continue
        
        if not data_movimento:
            return None
        
        valor = float(valor_str)
        saldo = float(saldo_str) if saldo_str else None
        
        # Determine movement type
        tipo_movimento = "credito" if valor > 0 else "debito"
        
        # Try to extract CNPJ
        cnpj_pattern = r'(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})'
        cnpj_match = re.search(cnpj_pattern, descricao)
        cnpj_detectado = cnpj_match.group(1) if cnpj_match else None
        
        return MovimentoExtrato(
            data_movimento=data_movimento,
            descricao_original=f"{data_str};{descricao};{valor_str}",
            descricao_processada=descricao,
            valor=abs(valor),
            tipo_movimento=tipo_movimento,
            saldo=saldo,
            cnpj_detectado=cnpj_detectado
        )
        
    except Exception:
        return None

async def processar_conciliacao_automatica(importacao_id: str, usuario: str) -> int:
    """Process automatic reconciliation"""
    async with DatabaseAdapter() as db:

            contas_collection = await get_contas_receber_collection()
    
    importacao_data = await importacoes_collection.find_one({"id": importacao_id})
    if not importacao_data:
        return 0
    
    importacao = ImportacaoExtrato(**importacao_data)
    baixas_realizadas = 0
    
    for movimento in importacao.movimentos:
        if movimento.tipo_movimento != "credito":
            continue  # Only process credit movements
        
        # Find matching títulos
        candidatos = await encontrar_candidatos_conciliacao(movimento, contas_collection)
        
        # If single high-confidence match, process automatically
        if len(candidatos) == 1 and candidatos[0]["score"] >= 80:
            await realizar_baixa_automatica(candidatos[0]["titulo"], movimento, usuario, contas_collection)
            movimento.status_classificacao = "classificado"
            movimento.classificado_por = "sistema"
            movimento.data_classificacao = datetime.utcnow()
            baixas_realizadas += 1
        elif candidatos:
            # Set best candidate as suggestion
            melhor_candidato = max(candidatos, key=lambda x: x["score"])
            movimento.titulo_sugerido = melhor_candidato["titulo"]["id"]
            movimento.score_match = melhor_candidato["score"]
    
    # Update import with processed movements
    await importacoes_collection.update_one(
        {"id": importacao_id},
        {"$set": {"movimentos": [m.model_dump() for m in importacao.movimentos]}}
    )
    
    return baixas_realizadas

async def encontrar_candidatos_conciliacao(movimento: MovimentoExtrato, contas_collection) -> List[Dict]:
    """Find matching candidates for reconciliation"""
    candidatos = []
    
    # Query for open titles
    query = {
        "situacao": {"$in": [SituacaoTitulo.EM_ABERTO, SituacaoTitulo.ATRASADO]},
        "total_liquido": {"$gte": movimento.valor - 0.50, "$lte": movimento.valor + 0.50}  # Value tolerance
    }
    
    async for conta_data in contas_collection.find(query):
        conta = ContaReceber(**conta_data)
        score = calcular_score_match(movimento, conta)
        
        if score > 30:  # Minimum threshold
            candidatos.append({
                "titulo": conta_data,
                "score": score
            })
    
    return candidatos

def calcular_score_match(movimento: MovimentoExtrato, conta: ContaReceber) -> float:
    """Calculate matching score between movement and título"""
    score = 0
    
    # Exact value match
    if abs(movimento.valor - conta.total_liquido) < 0.01:
        score += 40
    elif abs(movimento.valor - conta.total_liquido) <= 0.50:
        score += 20
    
    # CNPJ match
    if movimento.cnpj_detectado and movimento.cnpj_detectado in conta.empresa:
        score += 50
    
    # Date proximity (within 30 days of due date)
    days_diff = abs((movimento.data_movimento - conta.data_vencimento).days)
    if days_diff <= 7:
        score += 15
    elif days_diff <= 30:
        score += 5
    
    # Text similarity (basic)
    if any(word.lower() in movimento.descricao_processada.lower() 
           for word in conta.empresa.split() if len(word) > 3):
        score += 15
    
    return score

async def realizar_baixa_automatica(titulo_data: Dict, movimento: MovimentoExtrato, usuario: str, contas_collection):
    """Perform automatic payment"""
    titulo = ContaReceber(**titulo_data)
    
    historico_action = HistoricoAlteracao(
        acao="Baixa automática por importação",
        usuario=usuario,
        observacao=f"Conciliado automaticamente com movimento: {movimento.descricao_processada}"
    )
    
    update_data = {
        "situacao": SituacaoTitulo.PAGO.value,
        "data_recebimento": movimento.data_movimento,
        "valor_quitado": movimento.valor,
        "updated_at": datetime.utcnow()
    }
    
    await contas_collection.update_one(
        {"id": titulo.id}, 
        {
            "$set": update_data,
            "$push": {"historico_alteracoes": historico_action.model_dump()}
        }
    )

@router.get("/extrato/importacoes", response_model=List[ImportacaoExtrato])
async def listar_importacoes(
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """List import history"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    query = {}
    if current_user.role != "admin":
        query["cidade"] = {"$in": current_user.allowed_cities}
    
    importacoes = []
    async for importacao_data in importacoes_collection.find(query).skip(skip).limit(limit).sort("data_importacao", -1):
        importacoes.append(ImportacaoExtrato(**importacao_data))
    
    return importacoes

@router.get("/extrato/classificacao/{importacao_id}")
async def obter_fila_classificacao(
    importacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get classification queue for manual processing"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    importacao_data = await importacoes_collection.find_one({"id": importacao_id})
    if not importacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importação not found"
        )
    
    importacao = ImportacaoExtrato(**importacao_data)
    
    # Get only unclassified movements
    movimentos_pendentes = [m for m in importacao.movimentos if m.status_classificacao == "pendente"]
    
    return {
        "importacao_id": importacao_id,
        "total_pendentes": len(movimentos_pendentes),
        "movimentos": movimentos_pendentes
    }

@router.post("/extrato/classificar-movimento")
async def classificar_movimento(
    classificacao: ClassificacaoMovimento,
    current_user: UserResponse = Depends(get_current_user)
):
    """Manually classify movement"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:

            contas_collection = await get_contas_receber_collection()
    
    importacao_data = await importacoes_collection.find_one({"id": classificacao.movimento_id.split('_')[0]})
    if not importacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importação not found"
        )
    
    importacao = ImportacaoExtrato(**importacao_data)
    
    # Find and update movement
    movimento_encontrado = None
    for movimento in importacao.movimentos:
        if movimento.id == classificacao.movimento_id:
            movimento_encontrado = movimento
            break
    
    if not movimento_encontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimento not found"
        )
    
    # Process classification
    if classificacao.acao == "associar_titulo" and classificacao.titulo_id:
        # Associate with existing título
        titulo_data = await contas_collection.find_one({"id": classificacao.titulo_id})
        if titulo_data:
            await realizar_baixa_automatica(titulo_data, movimento_encontrado, current_user.name, contas_collection)
    
    # Update movement status
    movimento_encontrado.status_classificacao = "classificado"
    movimento_encontrado.classificado_por = current_user.name
    movimento_encontrado.data_classificacao = datetime.utcnow()
    
    # Update import
    await importacoes_collection.update_one(
        {"id": importacao.id},
        {"$set": {"movimentos": [m.model_dump() for m in importacao.movimentos]}}
    )
    
    return {"message": "Movimento classificado com sucesso"}

# Financial Clients - Updated and expanded
@router.post("/clients", response_model=FinancialClient)
async def create_financial_client(
    client_data: FinancialClientCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new financial client"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Check if client already exists
    existing_client = await financial_clients_collection.find_one({"empresa_id": client_data.empresa_id})
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Financial client already exists"
        )
    
    # Create client dict with proper serialization
    financial_client_dict = {
        "id": str(uuid.uuid4()),
        "empresa_id": client_data.empresa_id,
        "empresa": client_data.empresa,
        "valor_com_desconto": client_data.valor_com_desconto,
        "valor_boleto": client_data.valor_boleto,
        "dia_vencimento": client_data.dia_vencimento,
        "tipo_honorario": client_data.tipo_honorario.value if hasattr(client_data.tipo_honorario, 'value') else client_data.tipo_honorario,
        "empresa_individual_grupo": client_data.empresa_individual_grupo.value if hasattr(client_data.empresa_individual_grupo, 'value') else client_data.empresa_individual_grupo,
        "contas_pagamento": client_data.contas_pagamento,
        "tipo_pagamento": client_data.tipo_pagamento.value if hasattr(client_data.tipo_pagamento, 'value') else client_data.tipo_pagamento,
        "forma_pagamento_especial": client_data.forma_pagamento_especial,
        "tipo_empresa": client_data.tipo_empresa.value if hasattr(client_data.tipo_empresa, 'value') else client_data.tipo_empresa,
        "status_pagamento": client_data.status_pagamento.value if hasattr(client_data.status_pagamento, 'value') else client_data.status_pagamento,
        "observacoes": client_data.observacoes,
        "ultimo_pagamento": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await financial_clients_collection.insert_one(financial_client_dict)
    
    return FinancialClient(**financial_client_dict)

@router.get("/clients", response_model=List[FinancialClient])
async def get_financial_clients(
    current_user: UserResponse = Depends(get_current_user),
    status_pagamento: Optional[str] = Query(None),
    tipo_honorario: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get financial clients with filters"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query
    query = {}
    
    # Status filter
    if status_pagamento:
        query["status_pagamento"] = status_pagamento
    
    # Type filter
    if tipo_honorario:
        query["tipo_honorario"] = tipo_honorario
    
    # Search filter
    if search:
        query["empresa"] = {"$regex": search, "$options": "i"}
    
    clients_cursor = financial_clients_collection.find(query).skip(skip).limit(limit).sort("empresa", 1)
    clients = []
    async for client_data in clients_cursor:
        clients.append(FinancialClient(**client_data))
    
    return clients
@router.put("/clients/{client_id}", response_model=FinancialClient) 
async def update_financial_client(
    client_id: str,
    client_update: FinancialClientUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update financial client"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    client_data = await financial_clients_collection.find_one({"id": client_id})
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )
    
    # Build update data
    update_data = {k: v for k, v in client_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await financial_clients_collection.update_one({"id": client_id}, {"$set": update_data})
    
    # Get updated client
    updated_client_data = await financial_clients_collection.find_one({"id": client_id})
    return FinancialClient(**updated_client_data)

@router.delete("/clients/{client_id}")
async def delete_financial_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete financial client"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    result = await financial_clients_collection.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )
    
    return {"message": "Financial client deleted successfully"}

@router.get("/clients/{client_id}", response_model=FinancialClient)
async def get_financial_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get financial client by ID"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    client_data = await financial_clients_collection.find_one({"id": client_id})
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial client not found"
        )
    
    return FinancialClient(**client_data)

# Busca avançada com filtros
@router.post("/contas-receber/search", response_model=List[ContaReceber])
async def search_contas_receber(
    filters: ContaReceberFilters,
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Advanced search for contas a receber"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query from filters
    query = {}
    
    # City access control
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    elif filters.cidade:
        query["cidade_atendimento"] = filters.cidade
    
    # Apply filters
    if filters.empresa:
        query["empresa"] = {"$regex": filters.empresa, "$options": "i"}
    
    if filters.cnpj:
        query["empresa"] = {"$regex": filters.cnpj.replace(".", "").replace("/", "").replace("-", ""), "$options": "i"}
    
    if filters.situacao:
        query["situacao"] = {"$in": [s.value for s in filters.situacao]}
    
    if filters.data_vencimento_inicio and filters.data_vencimento_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(filters.data_vencimento_inicio, datetime.min.time()),
            "$lte": datetime.combine(filters.data_vencimento_fim, datetime.max.time())
        }
    
    if filters.valor_minimo is not None or filters.valor_maximo is not None:
        valor_query = {}
        if filters.valor_minimo is not None:
            valor_query["$gte"] = filters.valor_minimo
        if filters.valor_maximo is not None:
            valor_query["$lte"] = filters.valor_maximo
        query["total_liquido"] = valor_query
    
    if filters.usuario_responsavel:
        query["usuario_responsavel"] = {"$regex": filters.usuario_responsavel, "$options": "i"}
    
    if filters.forma_pagamento:
        query["forma_pagamento"] = {"$in": [fp.value for fp in filters.forma_pagamento]}
    
    # Execute query
    contas_cursor = contas_collection.find(query).skip(skip).limit(limit).sort("data_vencimento", -1)
    contas = []
    async for conta_data in contas_cursor:
        contas.append(ContaReceber(**conta_data))
    
    return contas

# Export data
@router.get("/export/contas-receber")
async def export_contas_receber(
    formato: str = Query("json", regex="^(json|csv)$"),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Export contas a receber data"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build query
    query = {}
    if current_user.role != "admin":
        query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    
    if situacao:
        query["situacao"] = situacao
    
    if data_inicio and data_fim:
        query["data_vencimento"] = {
            "$gte": datetime.combine(data_inicio, datetime.min.time()),
            "$lte": datetime.combine(data_fim, datetime.max.time())
        }
    
    # Get data
    contas = []
    async for conta_data in contas_collection.find(query):
        contas.append(ContaReceber(**conta_data))
    
    if formato == "json":
        return {
            "data": [conta.model_dump() for conta in contas],
            "total_registros": len(contas),
            "data_export": datetime.utcnow()
        }
    else:  # CSV
        # Create CSV content
        csv_content = "ID,Empresa,Situacao,Descricao,Documento,Vencimento,Valor_Original,Total_Liquido,Cidade\n"
        for conta in contas:
            csv_content += f"{conta.id},{conta.empresa},{conta.situacao},{conta.descricao},{conta.documento},{conta.data_vencimento},{conta.valor_original},{conta.total_liquido},{conta.cidade_atendimento}\n"
        
        return {
            "content": csv_content,
            "filename": f"contas_receber_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }

# Dashboard com estatísticas avançadas - atualizado
@router.get("/dashboard-stats")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get comprehensive financial dashboard statistics"""
    check_financial_access(current_user)
    async with DatabaseAdapter() as db:
    
    # Build base query for user access
    base_query = {}
    if current_user.role != "admin":
        base_query["cidade_atendimento"] = {"$in": current_user.allowed_cities}
    
    # Total em aberto
    total_aberto_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value, SituacaoTitulo.RENEGOCIADO.value]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}, "count": {"$sum": 1}}}
    ])
    
    total_aberto = {"valor": 0, "count": 0}
    async for result in total_aberto_cursor:
        total_aberto = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Total atrasado (vencidos)
    hoje = datetime.now().date()
    total_atrasado_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value]}, "data_vencimento": {"$lt": datetime.combine(hoje, datetime.min.time())}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_liquido"}, "count": {"$sum": 1}}}
    ])
    
    total_atrasado = {"valor": 0, "count": 0}
    async for result in total_atrasado_cursor:
        total_atrasado = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Total recebido no mês
    inicio_mes = datetime.combine(hoje.replace(day=1), datetime.min.time())
    total_recebido_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": SituacaoTitulo.PAGO.value, "data_recebimento": {"$gte": inicio_mes}}},
        {"$group": {"_id": None, "total": {"$sum": "$valor_quitado"}, "count": {"$sum": 1}}}
    ])
    
    total_recebido = {"valor": 0, "count": 0}
    async for result in total_recebido_cursor:
        total_recebido = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    # Aging (vencimento por faixas) - Simplified version
    aging_cursor = contas_collection.aggregate([
        {"$match": {**base_query, "situacao": {"$in": [SituacaoTitulo.EM_ABERTO.value, SituacaoTitulo.ATRASADO.value]}}},
        {"$group": {
            "_id": "aging",
            "total": {"$sum": "$total_liquido"},
            "count": {"$sum": 1}
        }}
    ])
    
    aging = {
        "a_vencer": {"valor": 0, "count": 0},
        "ate_30_dias": {"valor": 0, "count": 0},
        "31_60_dias": {"valor": 0, "count": 0},
        "61_90_dias": {"valor": 0, "count": 0},
        "acima_90_dias": {"valor": 0, "count": 0}
    }
    
    # For now, put all aging data in a_vencer (simplified)
    async for result in aging_cursor:
        aging["a_vencer"] = {"valor": result.get("total", 0), "count": result.get("count", 0)}
    
    return {
        "total_aberto": total_aberto,
        "total_atrasado": total_atrasado,
        "total_recebido_mes": total_recebido,
        "aging": aging,
        "data_atualizacao": datetime.utcnow()
    }