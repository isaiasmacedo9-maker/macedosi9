from fastapi import FastAPI, APIRouter, HTTPException, status, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import os
import shutil

# Importar banco de dados offline e modelos
from database_json import db
from models_offline import *
from auth_offline import *
from services.extrato_processor import ExtratoProcessor
from services.report_generator import ReportGenerator
from services.chat_service import ChatService

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lifespan events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Macedo SI Offline System")
    
    # Inicializar dados default se necessário
    await initialize_default_data()
    
    yield
    
    # Shutdown
    logger.info("📴 Shutting down Macedo SI System")

# Create the main app
app = FastAPI(
    title="Macedo SI - Sistema Offline",
    description="Sistema Integrado de Gestão Contábil - Versão Offline",
    version="2.0.0",
    lifespan=lifespan
)

# Create a router with the /api prefix for all endpoints
api_router = APIRouter(prefix="/api")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instanciar serviços
extrato_processor = ExtratoProcessor()
report_generator = ReportGenerator()
chat_service = ChatService()

# Health check endpoints
@api_router.get("/")
async def root():
    return {
        "message": "Macedo SI - Sistema Offline",
        "version": "2.0.0",
        "status": "operational",
        "database": "JSON Local",
        "collections": len(db.collections)
    }

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Sistema offline operacional",
        "timestamp": datetime.now().isoformat(),
        "data_dir": str(db.data_dir),
        "cities": db.cities,
        "sectors": db.sectors
    }

# Authentication routes
@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """Login do usuário"""
    user = authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos"
        )
    
    # Atualizar último login
    db.update('users', {'id': user['id']}, {
        'last_login': datetime.now().isoformat(),
        'login_count': user.get('login_count', 0) + 1
    })
    
    # Criar token
    access_token = create_access_token(data={"sub": user['email']})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user)
    }

@api_router.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Informações do usuário atual"""
    return UserResponse(**current_user)

@api_router.post("/auth/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: dict = Depends(get_current_user)
):
    """Alterar senha do usuário"""
    if not verify_password(old_password, current_user['password_hash']):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    new_hash = get_password_hash(new_password)
    db.update('users', {'id': current_user['id']}, {'password_hash': new_hash})
    
    return {"message": "Senha alterada com sucesso"}

# Companies routes
@api_router.post("/companies")
async def create_company(
    company_data: Company,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova empresa"""
    # Verificar acesso à cidade
    if not db.check_city_access(current_user['allowed_cities'], company_data.cidade):
        raise HTTPException(status_code=403, detail="Acesso negado para esta cidade")
    
    # Verificar CNPJ único
    existing = db.find_one('companies', {'cnpj': company_data.cnpj})
    if existing:
        raise HTTPException(status_code=400, detail="CNPJ já cadastrado")
    
    company_id = db.insert('companies', company_data.model_dump(), current_user['id'])
    
    return {"id": company_id, "message": "Empresa criada com sucesso"}

@api_router.get("/companies")
async def get_companies(
    cidade: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Listar empresas"""
    query = {}
    
    # Controle de acesso por cidade
    if current_user['role'] != 'admin':
        query['cidade'] = {'$in': current_user['allowed_cities']}
    elif cidade:
        query['cidade'] = cidade
    
    if status:
        query['status'] = status
    
    if search:
        # Busca em múltiplos campos
        companies = db.find('companies', {})
        filtered = []
        search_lower = search.lower()
        
        for company in companies:
            if (search_lower in company.get('nome_empresa', '').lower() or
                search_lower in company.get('nome_fantasia', '').lower() or
                search_lower in company.get('cnpj', '') or
                search_lower in company.get('codigo_iob', '').lower()):
                filtered.append(company)
        
        return {
            "companies": filtered[skip:skip+limit],
            "total": len(filtered),
            "skip": skip,
            "limit": limit
        }
    
    companies = db.find('companies', query, limit=limit, skip=skip)
    total = db.count('companies', query)
    
    return {
        "companies": companies,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/companies/{company_id}")
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter empresa por ID"""
    company = db.find_one('companies', {'id': company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Verificar acesso
    if not db.check_city_access(current_user['allowed_cities'], company['cidade']):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return company

@api_router.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    company_update: dict,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar empresa"""
    company = db.find_one('companies', {'id': company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Verificar acesso
    if not db.check_city_access(current_user['allowed_cities'], company['cidade']):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    db.update('companies', {'id': company_id}, company_update, current_user['id'])
    
    return {"message": "Empresa atualizada com sucesso"}

@api_router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Excluir empresa"""
    company = db.find_one('companies', {'id': company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Verificar acesso
    if not db.check_city_access(current_user['allowed_cities'], company['cidade']):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Verificar se tem contas em aberto
    contas = db.find('accounts_receivable', {'empresa_id': company_id, 'situacao': {'$in': ['em_aberto', 'atrasado']}})
    if contas:
        raise HTTPException(status_code=400, detail="Empresa possui contas em aberto")
    
    db.delete('companies', {'id': company_id}, current_user['id'])
    
    return {"message": "Empresa excluída com sucesso"}

# Accounts Receivable routes
@api_router.post("/accounts-receivable")
async def create_account_receivable(
    account_data: AccountReceivable,
    current_user: dict = Depends(get_current_user)
):
    """Criar conta a receber"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    # Verificar acesso à cidade
    if not db.check_city_access(current_user['allowed_cities'], account_data.cidade_atendimento):
        raise HTTPException(status_code=403, detail="Acesso negado para esta cidade")
    
    # Calcular totais automaticamente
    account_dict = account_data.model_dump()
    account_dict['total_bruto'] = account_data.valor_original
    account_dict['total_liquido'] = account_data.valor_original - account_data.desconto_aplicado + account_data.acrescimo_aplicado
    
    # Calcular score de risco baseado no histórico da empresa
    account_dict['score_risco'] = calculate_risk_score(account_data.empresa_id)
    
    account_id = db.insert('accounts_receivable', account_dict, current_user['id'])
    
    return {"id": account_id, "message": "Conta a receber criada com sucesso"}

@api_router.get("/accounts-receivable")
async def get_accounts_receivable(
    cidade: Optional[str] = None,
    situacao: Optional[str] = None,
    empresa: Optional[str] = None,
    vencimento_inicio: Optional[str] = None,
    vencimento_fim: Optional[str] = None,
    valor_min: Optional[float] = None,
    valor_max: Optional[float] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Listar contas a receber com filtros avançados"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    query = {}
    
    # Controle de acesso por cidade
    if current_user['role'] != 'admin':
        query['cidade_atendimento'] = {'$in': current_user['allowed_cities']}
    elif cidade:
        query['cidade_atendimento'] = cidade
    
    # Aplicar filtros
    if situacao:
        query['situacao'] = situacao
    
    # Para filtros mais complexos, buscar todos e filtrar manualmente
    accounts = db.find('accounts_receivable', query)
    
    # Filtros adicionais
    if empresa:
        accounts = [acc for acc in accounts if empresa.lower() in acc.get('empresa', '').lower()]
    
    if vencimento_inicio:
        inicio = datetime.fromisoformat(vencimento_inicio).date()
        accounts = [acc for acc in accounts if datetime.fromisoformat(acc['data_vencimento']).date() >= inicio]
    
    if vencimento_fim:
        fim = datetime.fromisoformat(vencimento_fim).date()
        accounts = [acc for acc in accounts if datetime.fromisoformat(acc['data_vencimento']).date() <= fim]
    
    if valor_min is not None:
        accounts = [acc for acc in accounts if acc.get('valor_original', 0) >= valor_min]
    
    if valor_max is not None:
        accounts = [acc for acc in accounts if acc.get('valor_original', 0) <= valor_max]
    
    # Aplicar paginação
    total = len(accounts)
    accounts = accounts[skip:skip+limit]
    
    return {
        "accounts": accounts,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.put("/accounts-receivable/{account_id}/payment")
async def register_payment(
    account_id: str,
    valor_recebido: float,
    data_recebimento: str,
    desconto: float = 0.0,
    acrescimo: float = 0.0,
    observacao: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Registrar pagamento de conta a receber"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    account = db.find_one('accounts_receivable', {'id': account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    
    # Verificar acesso à cidade
    if not db.check_city_access(current_user['allowed_cities'], account['cidade_atendimento']):
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Criar entrada no histórico
    historico_entry = {
        'id': str(uuid.uuid4()),
        'data': datetime.now().isoformat(),
        'acao': 'Pagamento registrado',
        'usuario': current_user['name'],
        'observacao': observacao,
        'valor': valor_recebido
    }
    
    # Atualizar conta
    update_data = {
        'situacao': 'pago',
        'data_recebimento': data_recebimento,
        'desconto_aplicado': desconto,
        'acrescimo_aplicado': acrescimo,
        'valor_quitado': valor_recebido,
        'total_liquido': account['valor_original'] - desconto + acrescimo,
        'historico': account.get('historico', []) + [historico_entry]
    }
    
    db.update('accounts_receivable', {'id': account_id}, update_data, current_user['id'])
    
    return {"message": "Pagamento registrado com sucesso"}

# Extrato processing routes
@api_router.post("/extrato/upload")
async def upload_extrato(
    file: UploadFile = File(...),
    conta: str = "",
    cidade: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Upload e processamento de extrato"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    # Verificar tipo de arquivo
    if not file.filename.lower().endswith(('.pdf', '.csv', '.ofx')):
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado")
    
    # Salvar arquivo temporário
    upload_dir = Path("/app/data/uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Processar extrato
        result = await extrato_processor.process_file(str(file_path), conta, cidade, current_user['id'])
        
        return {
            "message": "Extrato processado com sucesso",
            "total_movimentos": result['total_movimentos'],
            "baixas_automaticas": result['baixas_automaticas'],
            "pendentes_classificacao": result['pendentes_classificacao'],
            "import_id": result['import_id']
        }
    
    finally:
        # Limpar arquivo temporário
        if file_path.exists():
            file_path.unlink()

@api_router.get("/extrato/queue")
async def get_import_queue(
    status: str = "pending",
    current_user: dict = Depends(get_current_user)
):
    """Obter fila de classificação de extratos"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    queue_items = db.get_import_queue(status)
    
    return {
        "items": queue_items,
        "total": len(queue_items)
    }

@api_router.post("/extrato/classify")
async def classify_import_item(
    item_id: str,
    empresa_id: str,
    titulo_id: Optional[str] = None,
    acao: str = "associar",  # associar, criar_empresa, ignorar
    current_user: dict = Depends(get_current_user)
):
    """Classificar item da fila de importação"""
    # Verificar acesso ao setor financeiro
    if not db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        raise HTTPException(status_code=403, detail="Acesso negado ao módulo financeiro")
    
    result = await extrato_processor.classify_item(item_id, empresa_id, titulo_id, acao, current_user['id'])
    
    return {"message": "Item classificado com sucesso", "result": result}

# Tasks routes
@api_router.post("/tasks")
async def create_task(
    task_data: Task,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova tarefa"""
    # Verificar acesso ao setor
    if not db.check_sector_access(current_user['allowed_sectors'], task_data.categoria):
        raise HTTPException(status_code=403, detail=f"Acesso negado ao setor {task_data.categoria}")
    
    # Verificar acesso à cidade
    if not db.check_city_access(current_user['allowed_cities'], task_data.cidade):
        raise HTTPException(status_code=403, detail="Acesso negado para esta cidade")
    
    task_dict = task_data.model_dump()
    task_dict['criador_id'] = current_user['id']
    task_dict['criador_nome'] = current_user['name']
    
    task_id = db.insert('tasks', task_dict, current_user['id'])
    
    return {"id": task_id, "message": "Tarefa criada com sucesso"}

@api_router.get("/tasks")
async def get_tasks(
    cidade: Optional[str] = None,
    categoria: Optional[str] = None,
    status: Optional[str] = None,
    responsavel_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Listar tarefas"""
    query = {}
    
    # Controle de acesso
    if current_user['role'] != 'admin':
        # Usuário vê tarefas que criou ou é responsável
        query['$or'] = [
            {'criador_id': current_user['id']},
            {'responsavel_id': current_user['id']}
        ]
        
        # Filtrar por cidades permitidas
        if current_user['allowed_cities']:
            cidade_query = {'cidade': {'$in': current_user['allowed_cities']}}
            if '$and' not in query:
                query['$and'] = []
            query['$and'].append(cidade_query)
    
    # Aplicar filtros
    if cidade:
        query['cidade'] = cidade
    if categoria:
        query['categoria'] = categoria
    if status:
        query['status'] = status
    if responsavel_id:
        query['responsavel_id'] = responsavel_id
    
    # Como o sistema de query do JSON é limitado, vamos filtrar manualmente
    all_tasks = db.find('tasks', {})
    filtered_tasks = []
    
    for task in all_tasks:
        # Verificar acesso básico
        if (current_user['role'] != 'admin' and 
            task.get('criador_id') != current_user['id'] and 
            task.get('responsavel_id') != current_user['id']):
            continue
        
        # Verificar cidade
        if (current_user['role'] != 'admin' and 
            current_user['allowed_cities'] and 
            task.get('cidade') not in current_user['allowed_cities']):
            continue
        
        # Aplicar filtros
        if cidade and task.get('cidade') != cidade:
            continue
        if categoria and task.get('categoria') != categoria:
            continue
        if status and task.get('status') != status:
            continue
        if responsavel_id and task.get('responsavel_id') != responsavel_id:
            continue
        
        filtered_tasks.append(task)
    
    total = len(filtered_tasks)
    tasks = filtered_tasks[skip:skip+limit]
    
    return {
        "tasks": tasks,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# Dashboard routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Estatísticas do dashboard"""
    stats = {}
    
    # Estatísticas de empresas
    companies_query = {}
    if current_user['role'] != 'admin':
        companies_query['cidade'] = {'$in': current_user['allowed_cities']}
    
    stats['total_companies'] = db.count('companies', companies_query)
    stats['active_companies'] = db.count('companies', {**companies_query, 'status': 'ativa'})
    
    # Estatísticas financeiras (se tiver acesso)
    if db.check_sector_access(current_user['allowed_sectors'], 'financeiro'):
        accounts_query = {}
        if current_user['role'] != 'admin':
            accounts_query['cidade_atendimento'] = {'$in': current_user['allowed_cities']}
        
        stats['contas_em_aberto'] = db.count('accounts_receivable', {**accounts_query, 'situacao': 'em_aberto'})
        stats['contas_atrasadas'] = db.count('accounts_receivable', {**accounts_query, 'situacao': 'atrasado'})
        
        # Calcular valor total em aberto
        contas_abertas = db.find('accounts_receivable', {**accounts_query, 'situacao': {'$in': ['em_aberto', 'atrasado']}})
        stats['valor_total_aberto'] = sum(conta.get('total_liquido', 0) for conta in contas_abertas)
    
    # Estatísticas de tarefas
    tasks_query = {}
    if current_user['role'] != 'admin':
        # Filtrar tarefas do usuário
        user_tasks = db.find('tasks', {'$or': [
            {'criador_id': current_user['id']},
            {'responsavel_id': current_user['id']}
        ]})
        
        stats['tarefas_pendentes'] = len([t for t in user_tasks if t.get('status') == 'pendente'])
        stats['tarefas_em_andamento'] = len([t for t in user_tasks if t.get('status') == 'em_andamento'])
        stats['tarefas_atrasadas'] = len([t for t in user_tasks if t.get('status') == 'atrasada'])
    else:
        stats['tarefas_pendentes'] = db.count('tasks', {'status': 'pendente'})
        stats['tarefas_em_andamento'] = db.count('tasks', {'status': 'em_andamento'})
        stats['tarefas_atrasadas'] = db.count('tasks', {'status': 'atrasada'})
    
    return stats

# Backup routes
@api_router.post("/backup/create")
async def create_backup(
    backup_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Criar backup do sistema"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar backups")
    
    backup_id = db.create_backup(backup_name)
    
    return {"message": "Backup criado com sucesso", "backup_id": backup_id}

@api_router.get("/backup/list")
async def list_backups(current_user: dict = Depends(get_current_user)):
    """Listar backups disponíveis"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem listar backups")
    
    backups = db.find('backup_history', {}, limit=50)
    
    return {"backups": backups}

@api_router.post("/backup/restore/{backup_name}")
async def restore_backup(
    backup_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Restaurar backup"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Apenas administradores podem restaurar backups")
    
    success = db.restore_backup(backup_name)
    
    if success:
        return {"message": "Backup restaurado com sucesso"}
    else:
        raise HTTPException(status_code=404, detail="Backup não encontrado")

# Include all routes in the main router
app.include_router(api_router)

# Utility functions
def calculate_risk_score(empresa_id: str) -> int:
    """Calcula score de risco da empresa baseado no histórico"""
    contas = db.find('accounts_receivable', {'empresa_id': empresa_id})
    
    if not contas:
        return 50  # Score neutro para empresa nova
    
    total_contas = len(contas)
    contas_atrasadas = len([c for c in contas if c.get('situacao') == 'atrasado'])
    contas_pagas = len([c for c in contas if c.get('situacao') == 'pago'])
    
    # Calcular score (0-100, onde 0 é maior risco)
    if total_contas == 0:
        return 50
    
    taxa_atraso = contas_atrasadas / total_contas
    taxa_pagamento = contas_pagas / total_contas
    
    score = int(100 - (taxa_atraso * 50) + (taxa_pagamento * 25))
    
    return max(0, min(100, score))

async def initialize_default_data():
    """Inicializa dados padrão do sistema"""
    # Verificar se já existem usuários
    existing_users = db.find('users', {})
    
    if not existing_users:
        # Criar usuário admin padrão
        admin_user = {
            'email': 'admin@macedosi.com.br',
            'name': 'Administrador',
            'password_hash': get_password_hash('admin123'),
            'role': 'admin',
            'allowed_cities': [],  # Admin tem acesso a todas
            'allowed_sectors': [],  # Admin tem acesso a todos
            'is_active': True
        }
        
        db.insert('users', admin_user)
        logger.info("✅ Usuário admin criado")
        
        # Criar usuários colaboradores de exemplo
        colaboradores = [
            {
                'email': 'jacobina@macedosi.com.br',
                'name': 'João Silva',
                'password_hash': get_password_hash('jacobina123'),
                'role': 'colaborador',
                'allowed_cities': ['jacobina'],
                'allowed_sectors': ['financeiro', 'contabil', 'comercial'],
                'is_active': True
            },
            {
                'email': 'ourolandia@macedosi.com.br',
                'name': 'Maria Santos',
                'password_hash': get_password_hash('ourolandia123'),
                'role': 'colaborador',
                'allowed_cities': ['ourolandia'],
                'allowed_sectors': ['fiscal', 'trabalhista'],
                'is_active': True
            },
            {
                'email': 'umburanas@macedosi.com.br',
                'name': 'Carlos Oliveira',
                'password_hash': get_password_hash('umburanas123'),
                'role': 'colaborador',
                'allowed_cities': ['umburanas'],
                'allowed_sectors': ['atendimento', 'comercial'],
                'is_active': True
            },
            {
                'email': 'uberlandia@macedosi.com.br',
                'name': 'Ana Costa',
                'password_hash': get_password_hash('uberlandia123'),
                'role': 'colaborador',
                'allowed_cities': ['uberlandia'],
                'allowed_sectors': ['financeiro', 'fiscal', 'trabalhista', 'contabil'],
                'is_active': True
            }
        ]
        
        for colaborador in colaboradores:
            db.insert('users', colaborador)
        
        logger.info("✅ Usuários colaboradores criados")
    
    # Configurações padrão do sistema
    settings = db.find('settings', {})
    if not settings:
        default_settings = [
            {
                'modulo': 'sistema',
                'chave': 'tolerancia_valor_conciliacao',
                'valor': 0.50,
                'descricao': 'Tolerância para conciliação automática de valores (R$)',
                'tipo': 'number'
            },
            {
                'modulo': 'sistema',
                'chave': 'dias_tolerancia_data',
                'valor': 5,
                'descricao': 'Tolerância em dias para conciliação automática',
                'tipo': 'number'
            },
            {
                'modulo': 'financeiro',
                'chave': 'taxa_juros_atraso',
                'valor': 1.0,
                'descricao': 'Taxa de juros por atraso (%)',
                'tipo': 'number'
            }
        ]
        
        for setting in default_settings:
            db.insert('settings', setting)
        
        logger.info("✅ Configurações padrão criadas")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)