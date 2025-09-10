from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime
import uuid

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    password_hash: str
    role: str = Field(..., pattern="^(admin|colaborador)$")
    allowed_cities: List[str] = []
    allowed_sectors: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = Field(..., pattern="^(admin|colaborador)$")
    allowed_cities: List[str] = []
    allowed_sectors: List[str] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    allowed_cities: Optional[List[str]] = None
    allowed_sectors: Optional[List[str]] = None
    is_active: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    allowed_cities: List[str]
    allowed_sectors: List[str]
    is_active: bool
    created_at: datetime