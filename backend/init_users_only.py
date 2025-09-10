#!/usr/bin/env python3
"""
Initialize database with users only for testing
"""

import asyncio
from models.user import User
from auth import get_password_hash
from database import connect_to_mongo, close_mongo_connection, get_users_collection

async def init_users():
    """Initialize default users"""
    users_collection = await get_users_collection()
    
    # Check if users already exist
    user_count = await users_collection.count_documents({})
    if user_count > 0:
        print("Users already exist, skipping user initialization")
        return
    
    users = [
        User(
            email="admin@macedo.com.br",
            name="Administrador",
            password_hash=get_password_hash("admin123"),
            role="admin",
            allowed_cities=["jacobina", "ourolandia", "umburanas", "uberlandia"],
            allowed_sectors=["comercial", "trabalhista", "fiscal", "financeiro", "contabil", "atendimento"]
        ),
        User(
            email="colaborador@macedo.com.br",
            name="João Silva",
            password_hash=get_password_hash("colab123"),
            role="colaborador",
            allowed_cities=["jacobina"],
            allowed_sectors=["financeiro", "contabil"]
        ),
        User(
            email="fiscal@macedo.com.br",
            name="Maria Santos",
            password_hash=get_password_hash("fiscal123"),
            role="colaborador",
            allowed_cities=["ourolandia"],
            allowed_sectors=["fiscal", "contabil"]
        )
    ]
    
    for user in users:
        await users_collection.insert_one(user.model_dump())
    
    print(f"Initialized {len(users)} users")

async def main():
    """Initialize users only"""
    print("🚀 Starting user initialization...")
    
    await connect_to_mongo()
    
    try:
        await init_users()
        print("✅ User initialization completed successfully!")
    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        raise
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())