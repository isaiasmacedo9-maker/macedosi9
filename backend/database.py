from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

class Database:
    client: AsyncIOMotorClient = None
    database = None

db = Database()

async def get_database() -> AsyncIOMotorClient:
    return db.database

async def connect_to_mongo():
    """Create database connection"""
    db.client = AsyncIOMotorClient(MONGO_URL)
    db.database = db.client[DB_NAME]
    print(f"Connected to MongoDB: {DB_NAME}")

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")

# Collections
async def get_users_collection():
    database = await get_database()
    return database.users

async def get_clients_collection():
    database = await get_database()
    return database.clients

async def get_financial_clients_collection():
    database = await get_database()
    return database.financial_clients

async def get_contas_receber_collection():
    database = await get_database()
    return database.contas_receber

async def get_trabalhista_collection():
    database = await get_database()
    return database.trabalhista

async def get_fiscal_collection():
    database = await get_database()
    return database.fiscal

async def get_atendimento_collection():
    database = await get_database()
    return database.atendimento

async def get_configuracoes_collection():
    database = await get_database()
    return database.configuracoes

async def get_chats_collection():
    database = await get_database()
    return database.chats

async def get_tasks_collection():
    database = await get_database()
    return database.tasks