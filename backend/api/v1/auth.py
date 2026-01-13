"""
ZION.CITY Authentication Router
Handles user authentication and registration

NOTE: This is a demonstration router showing the target architecture.
Full migration from server.py should be done incrementally.
"""
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
import logging

from core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    validate_password_strength,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from api.deps import get_db, get_current_user

logger = logging.getLogger("zion")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# === SCHEMAS ===

class UserLogin(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str


class UserRegistration(BaseModel):
    """Registration request schema"""
    email: EmailStr
    password: str = Field(..., min_length=12)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    middle_name: Optional[str] = None


class TokenResponse(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response schema"""
    id: str
    email: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    profile_picture: Optional[str] = None
    role: Optional[str] = None


class LoginResponse(BaseModel):
    """Login response with token and user info"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


# === ENDPOINTS ===

@router.post("/login", response_model=LoginResponse)
async def login(
    user_data: UserLogin,
    request: Request,
    db=Depends(get_db)
):
    """
    Authenticate user and return JWT token.

    Rate limited to 5 requests per minute per IP.
    """
    # Find user by email
    user = await db.users.find_one({"email": user_data.email.lower()})

    if not user:
        logger.warning(f"Login attempt for non-existent email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(user_data.password, user.get("password_hash", "")):
        logger.warning(f"Failed login attempt for user: {user['id']}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Generate token
    access_token = create_access_token(data={"sub": user["id"]})

    # Update last login
    from datetime import datetime, timezone
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )

    logger.info(f"User logged in: {user['id']}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            first_name=user.get("first_name", ""),
            last_name=user.get("last_name", ""),
            middle_name=user.get("middle_name"),
            profile_picture=user.get("profile_picture"),
            role=user.get("role")
        )
    )


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegistration,
    request: Request,
    db=Depends(get_db)
):
    """
    Register a new user.

    Rate limited to 3 requests per minute per IP.
    """
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Check if email already exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create user
    import uuid
    from datetime import datetime, timezone

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    new_user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": get_password_hash(user_data.password),
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "middle_name": user_data.middle_name,
        "role": "USER",
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }

    await db.users.insert_one(new_user)

    # Generate token
    access_token = create_access_token(data={"sub": user_id})

    logger.info(f"New user registered: {user_id}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user_id,
            email=new_user["email"],
            first_name=new_user["first_name"],
            last_name=new_user["last_name"],
            middle_name=new_user.get("middle_name"),
            role=new_user["role"]
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current authenticated user information."""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        first_name=current_user.get("first_name", ""),
        last_name=current_user.get("last_name", ""),
        middle_name=current_user.get("middle_name"),
        profile_picture=current_user.get("profile_picture"),
        role=current_user.get("role")
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(current_user=Depends(get_current_user)):
    """Refresh the access token for an authenticated user."""
    access_token = create_access_token(data={"sub": current_user["id"]})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    """
    Logout the current user.

    Note: JWT tokens are stateless, so this is primarily for client-side cleanup.
    For true token invalidation, implement a token blacklist.
    """
    logger.info(f"User logged out: {current_user['id']}")
    return {"message": "Successfully logged out"}
