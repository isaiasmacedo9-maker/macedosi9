from fastapi import APIRouter, HTTPException, status, Depends
from datetime import timedelta
from models.user import UserLogin, UserResponse, User, UserCreate, UserUpdate
from auth import authenticate_user, create_access_token, get_password_hash, get_current_user, get_admin_user, ACCESS_TOKEN_EXPIRE_MINUTES
from database import get_users_collection
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
async def login(user_credentials: UserLogin):
    """Authenticate user and return access token"""
    user = await authenticate_user(user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            allowed_cities=user.allowed_cities,
            allowed_sectors=user.allowed_sectors,
            is_active=user.is_active,
            created_at=user.created_at
        )
    }

@router.post("/register", dependencies=[Depends(get_admin_user)])
async def register(user_data: UserCreate):
    """Register new user (admin only)"""
    users_collection = await get_users_collection()
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=hashed_password,
        role=user_data.role,
        allowed_cities=user_data.allowed_cities,
        allowed_sectors=user_data.allowed_sectors
    )
    
    await users_collection.insert_one(user.model_dump())
    
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        allowed_cities=user.allowed_cities,
        allowed_sectors=user.allowed_sectors,
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.get("/me")
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@router.get("/users", dependencies=[Depends(get_admin_user)])
async def get_all_users():
    """Get all users (admin only)"""
    users_collection = await get_users_collection()
    users_cursor = users_collection.find({})
    users = []
    async for user_data in users_cursor:
        users.append(UserResponse(**user_data))
    return users

@router.put("/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def update_user(user_id: str, user_update: UserUpdate):
    """Update user (admin only)"""
    users_collection = await get_users_collection()
    
    # Check if user exists
    existing_user = await users_collection.find_one({"id": user_id})
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await users_collection.update_one(
            {"id": user_id}, 
            {"$set": update_data}
        )
    
    # Return updated user
    updated_user_data = await users_collection.find_one({"id": user_id})
    return UserResponse(**updated_user_data)

@router.get("/users/{user_id}", dependencies=[Depends(get_admin_user)])
async def get_user(user_id: str):
    """Get specific user (admin only)"""
    users_collection = await get_users_collection()
    user_data = await users_collection.find_one({"id": user_id})
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(**user_data)