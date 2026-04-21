from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.user import User, UserResponse, UserLogin, UserCreate, UserUpdate
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

USE_SQL = os.getenv('USE_SQL', 'false').lower() == 'true'

if USE_SQL:
    from sqlalchemy import select
    from database_sql import AsyncSessionLocal
    from models_sql import UserSQL
    from crud_sql import convert_to_dict, json_loads
    from models_chat_users import UserPermissionSQL
else:
    from database import get_users_collection

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "macedo-si-secret-key-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def authenticate_user(email: str, password: str) -> Optional[User]:
    """Authenticate user credentials"""
    if USE_SQL:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(UserSQL).where(UserSQL.email == email, UserSQL.is_active == True)
            )
            user_obj = result.scalar_one_or_none()
            
            if not user_obj:
                return None
            
            user_data = convert_to_dict(user_obj)
            user = User(**user_data)
            if not verify_password(password, user.password_hash):
                return None
            
            return user
    else:
        users_collection = await get_users_collection()
        user_data = await users_collection.find_one({"email": email, "is_active": True})
        
        if not user_data:
            return None
        
        user = User(**user_data)
        if not verify_password(password, user.password_hash):
            return None
        
        return user

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    if USE_SQL:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(UserSQL).where(UserSQL.email == email, UserSQL.is_active == True)
            )
            user_obj = result.scalar_one_or_none()
            
            if user_obj is None:
                raise credentials_exception
            
            user_data = convert_to_dict(user_obj)
            perm_result = await session.execute(
                select(UserPermissionSQL).where(UserPermissionSQL.user_id == user_obj.id)
            )
            permissions = perm_result.scalars().all()
            user_data["permissoes"] = [
                {
                    "setor": permission.setor,
                    "visualizacoes": json_loads(permission.visualizacoes),
                }
                for permission in permissions
            ]
            return UserResponse(**user_data)
    else:
        users_collection = await get_users_collection()
        user_data = await users_collection.find_one({"email": email, "is_active": True})
        
        if user_data is None:
            raise credentials_exception
        
        return UserResponse(**user_data)

async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Ensure current user is admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user
