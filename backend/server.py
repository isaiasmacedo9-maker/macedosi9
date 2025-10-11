from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path

# Import database connection - Using adapter for SQL/MongoDB
from database_adapter import startup_database, shutdown_database

# Import routes
from routes.auth import router as auth_router
from routes.clients import router as clients_router
from routes.financial import router as financial_router
from routes.trabalhista import router as trabalhista_router
from routes.trabalhista_servicos import router as trabalhista_servicos_router
from routes.fiscal import router as fiscal_router
from routes.atendimento import router as atendimento_router
from routes.configuracoes import router as configuracoes_router
from routes.chat import router as chat_router
from routes.tasks import router as tasks_router
from routes.users_management import router as users_management_router
from routes.chat_enhanced import router as chat_enhanced_router
from routes.services import router as services_router
from routes.comercial import router as comercial_router
from routes.agendamentos import router as agendamentos_router

# Lifespan events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - Initialize database (SQL or MongoDB based on env)
    await startup_database()
    yield
    # Shutdown
    await shutdown_database()

# Create the main app
app = FastAPI(
    title="Macedo SI API",
    description="Sistema Integrado de Gestão Contábil",
    version="1.0.0",
    lifespan=lifespan
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "Macedo SI API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is operational"}

# Include routers
api_router.include_router(auth_router)
api_router.include_router(users_management_router)
api_router.include_router(clients_router)
api_router.include_router(financial_router)
api_router.include_router(trabalhista_router)
api_router.include_router(trabalhista_servicos_router)
api_router.include_router(fiscal_router)
api_router.include_router(atendimento_router)
api_router.include_router(configuracoes_router)
api_router.include_router(chat_router)
api_router.include_router(chat_enhanced_router)
api_router.include_router(services_router)
api_router.include_router(comercial_router)
api_router.include_router(tasks_router)
api_router.include_router(agendamentos_router)

# Include the API router in the main app
app.include_router(api_router)