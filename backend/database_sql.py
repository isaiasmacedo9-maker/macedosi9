"""
SQL Database connection using SQLAlchemy
Substitui MongoDB por SQLite
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from models_sql import Base
import os
from pathlib import Path
from dotenv import load_dotenv

# Import novos modelos para criar tabelas
from models_chat_users import (
    UserPermissionSQL, UserOnlineStatusSQL, ConversationSQL,
    ConversationMemberSQL, ChatMessageSQL, MessageReadStatusSQL
)
from models_services import ServicoSQL, ComentarioServicoSQL
from models_comercial import ServicoComercialSQL, OrdemServicoSQL, ContratoSQL, HistoricoContratoSQL

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# SQLite database URL
DATABASE_URL = os.environ.get('SQL_DATABASE_URL', 'sqlite+aiosqlite:///./macedo_si.db')

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL logging
    future=True,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def init_db():
    """Initialize database - create all tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"Database initialized: {DATABASE_URL}")

async def get_db():
    """Dependency for getting async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def close_db():
    """Close database connection"""
    await engine.dispose()
    print("Database connection closed")
