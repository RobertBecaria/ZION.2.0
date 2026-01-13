"""
ZION.CITY Security Module

This module contains all security-related functionality including:
- Password hashing and verification
- JWT token creation and validation
- Authentication dependencies

Usage:
    from core.security import (
        create_access_token,
        verify_password,
        get_password_hash,
        get_current_user
    )
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ============================================================
# CONFIGURATION
# ============================================================

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError(
        "CRITICAL: JWT_SECRET_KEY environment variable is required. "
        "Generate one with: openssl rand -hex 32"
    )

ALGORITHM = "HS256"
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 if IS_PRODUCTION else 60 * 24  # 7 days prod, 1 day dev

# Security bearer for FastAPI
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


# ============================================================
# PASSWORD FUNCTIONS
# ============================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash.

    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password to compare against

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: The plain text password to hash

    Returns:
        The hashed password
    """
    return pwd_context.hash(password)


# ============================================================
# JWT TOKEN FUNCTIONS
# ============================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token.

    Args:
        data: The data to encode in the token (usually {"sub": user_id})
        expires_delta: Optional custom expiration time

    Returns:
        The encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token.

    Args:
        token: The JWT token string

    Returns:
        The decoded token payload

    Raises:
        jwt.ExpiredSignatureError: If token is expired
        jwt.InvalidTokenError: If token is invalid
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_token_user_id(token: str) -> Optional[str]:
    """Extract user ID from a JWT token.

    Args:
        token: The JWT token string

    Returns:
        The user ID from the token, or None if invalid
    """
    try:
        payload = decode_token(token)
        return payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ============================================================
# PASSWORD VALIDATION
# ============================================================

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements.

    Requirements:
    - At least 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Args:
        password: The password to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    import re

    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\]\\;'/`~]", password):
        return False, "Password must contain at least one special character"

    return True, "Password is valid"


# ============================================================
# AUTHENTICATION HELPERS
# ============================================================

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """Extract and validate user ID from request token.

    This is a FastAPI dependency that can be used in endpoints.

    Args:
        credentials: The HTTP Bearer credentials

    Returns:
        The user ID from the token

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID"
            )
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


async def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(optional_security)
) -> Optional[str]:
    """Extract user ID from request token if present.

    Unlike get_current_user_id, this doesn't raise an error if no token
    is provided. Useful for endpoints that work for both authenticated
    and anonymous users.

    Args:
        credentials: The optional HTTP Bearer credentials

    Returns:
        The user ID from the token, or None if not authenticated
    """
    if not credentials:
        return None

    try:
        payload = decode_token(credentials.credentials)
        return payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
