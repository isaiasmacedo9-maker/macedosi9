from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import os
from dotenv import load_dotenv

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
from routes.guias_fiscais import router as guias_fiscais_router
from routes.academy_processes import router as academy_processes_router

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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Middleware to fix HTTPS redirects behind proxy
class HTTPSRedirectFixMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if response.status_code in (301, 302, 307, 308):
            location = response.headers.get("location", "")
            forwarded_proto = request.headers.get("x-forwarded-proto", "")
            if location.startswith("http://") and forwarded_proto == "https":
                response.headers["location"] = location.replace("http://", "https://", 1)
        return response

app.add_middleware(HTTPSRedirectFixMiddleware)

# Add CORS middleware
default_local_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
allowed_origins = (
    [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    if cors_origins_env
    else default_local_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
api_router.include_router(chat_enhanced_router)
api_router.include_router(chat_router)
api_router.include_router(services_router)
api_router.include_router(comercial_router)
api_router.include_router(tasks_router)
api_router.include_router(agendamentos_router)
api_router.include_router(guias_fiscais_router)
api_router.include_router(academy_processes_router)

# Include the API router in the main app
app.include_router(api_router)
