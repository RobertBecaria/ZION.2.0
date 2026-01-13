"""
ZION.CITY API Dependencies
Shared dependencies for API endpoints
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.security import decode_token
from database.connection import get_database

# Security schemes
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_db():
    """Get database instance for dependency injection."""
    return get_database()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Validate JWT token and return user ID.

    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return user_id
    except Exception:
        raise credentials_exception


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """
    Get the current authenticated user document.

    Raises:
        HTTPException: If user not found
    """
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    user.pop("_id", None)
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db=Depends(get_db)
):
    """
    Get current user if authenticated, None otherwise.

    Used for endpoints that work differently for authenticated users.
    """
    if credentials is None:
        return None

    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"id": user_id})
            if user:
                user.pop("_id", None)
                return user
    except Exception:
        pass

    return None


def require_role(allowed_roles: list):
    """
    Dependency factory to require specific user roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role(["ADMIN"]))])
        async def admin_endpoint():
            ...
    """
    async def check_role(current_user=Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return check_role
