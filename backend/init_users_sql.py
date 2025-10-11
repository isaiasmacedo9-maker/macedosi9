"""
Initialize SQL database with default users
"""
import asyncio
from database_sql import AsyncSessionLocal, init_db
from models_sql import UserSQL
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

async def create_default_users():
    """Create default admin and test users"""
    
    # Initialize database first
    await init_db()
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if admin already exists
            from sqlalchemy import select
            result = await session.execute(select(UserSQL).where(UserSQL.email == "admin@macedosi.com"))
            existing_admin = result.scalar_one_or_none()
            
            if not existing_admin:
                # Create admin user
                admin = UserSQL(
                    id=str(uuid.uuid4()),
                    email="admin@macedosi.com",
                    name="Administrador",
                    password_hash=get_password_hash("admin123"),
                    role="admin",
                    allowed_cities='["Todas"]',
                    allowed_sectors='["Todos"]',
                    is_active=True
                )
                session.add(admin)
                print("✓ Created admin user: admin@macedosi.com / admin123")
            else:
                print("ℹ Admin user already exists")
            
            # Check if test user exists
            result = await session.execute(select(UserSQL).where(UserSQL.email == "colaborador@macedosi.com"))
            existing_collab = result.scalar_one_or_none()
            
            if not existing_collab:
                # Create test collaborator
                colaborador = UserSQL(
                    id=str(uuid.uuid4()),
                    email="colaborador@macedosi.com",
                    name="Colaborador Teste",
                    password_hash=get_password_hash("teste123"),
                    role="colaborador",
                    allowed_cities='["São Paulo", "Rio de Janeiro"]',
                    allowed_sectors='["Contábil", "Fiscal"]',
                    is_active=True
                )
                session.add(colaborador)
                print("✓ Created collaborator user: colaborador@macedosi.com / teste123")
            else:
                print("ℹ Collaborator user already exists")
            
            await session.commit()
            print("\n✓ Database initialization completed!")
            
        except Exception as e:
            print(f"❌ Error initializing users: {e}")
            await session.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(create_default_users())
