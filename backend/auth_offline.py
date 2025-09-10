from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database_json import db
import os

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "macedo-si-offline-secret-key-2025-super-secure")
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

def authenticate_user(email: str, password: str) -> Optional[Dict]:
    """Authenticate user credentials"""
    user = db.find_one('users', {"email": email, "is_active": True})
    
    if not user:
        return None
    
    if not verify_password(password, user['password_hash']):
        return None
    
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
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
    
    user = db.find_one('users', {"email": email, "is_active": True})
    
    if user is None:
        raise credentials_exception
    
    return user

def get_admin_user(current_user: Dict = Depends(get_current_user)) -> Dict:
    """Ensure current user is admin"""
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def check_city_access(user: Dict, cidade: str) -> bool:
    """Check if user has access to specific city"""
    if user['role'] == 'admin':
        return True
    return cidade in user.get('allowed_cities', [])

def check_sector_access(user: Dict, setor: str) -> bool:
    """Check if user has access to specific sector"""
    if user['role'] == 'admin':
        return True
    return setor in user.get('allowed_sectors', [])

def require_sector_access(setor: str):
    """Decorator to require sector access"""
    def decorator(current_user: Dict = Depends(get_current_user)):
        if not check_sector_access(current_user, setor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access to {setor} sector not allowed"
            )
        return current_user
    return decorator

def require_city_access(cidade: str):
    """Decorator to require city access"""
    def decorator(current_user: Dict = Depends(get_current_user)):
        if not check_city_access(current_user, cidade):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access to {cidade} city not allowed"
            )
        return current_user
    return decorator