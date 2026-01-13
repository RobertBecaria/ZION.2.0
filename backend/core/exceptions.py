"""
ZION.CITY Exception Handling

This module provides standardized exception handling for API endpoints.
Using these decorators ensures consistent error responses and proper logging.
"""

import logging
from functools import wraps
from typing import Callable, TypeVar, Any

from fastapi import HTTPException, status

logger = logging.getLogger("zion")

# Type variable for generic function decorator
F = TypeVar('F', bound=Callable[..., Any])


class ZionException(Exception):
    """Base exception for ZION.CITY application errors."""

    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(self.message)


class ValidationError(ZionException):
    """Raised when input validation fails."""

    def __init__(self, message: str, detail: str = None):
        super().__init__(message, status_code=400, detail=detail)


class NotFoundError(ZionException):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, identifier: str = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with id '{identifier}' not found"
        super().__init__(message, status_code=404)


class PermissionDeniedError(ZionException):
    """Raised when user lacks permission for an action."""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, status_code=403)


class RateLimitError(ZionException):
    """Raised when rate limit is exceeded."""

    def __init__(self, message: str = "Too many requests. Please try again later."):
        super().__init__(message, status_code=429)


class ConflictError(ZionException):
    """Raised when there's a conflict (e.g., duplicate entry)."""

    def __init__(self, message: str):
        super().__init__(message, status_code=409)


def handle_exceptions(func: F) -> F:
    """Decorator for consistent exception handling in API endpoints.

    This decorator catches common exceptions and converts them to
    appropriate HTTP responses with proper logging.

    Usage:
        @api_router.get("/resource/{id}")
        @handle_exceptions
        async def get_resource(id: str):
            # Your code here - no need for try/except
            resource = await db.resources.find_one({"id": id})
            if not resource:
                raise NotFoundError("Resource", id)
            return resource

    Benefits:
        - Consistent error responses across all endpoints
        - Automatic logging of errors with stack traces
        - No sensitive information leaked to clients
        - Cleaner endpoint code without repetitive try/except
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions as-is
            raise
        except ZionException as e:
            # Handle our custom exceptions
            logger.warning(f"{func.__name__}: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except ValueError as e:
            # Handle validation errors
            logger.warning(f"Validation error in {func.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except PermissionError as e:
            # Handle permission errors
            logger.warning(f"Permission denied in {func.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied"
            )
        except Exception as e:
            # Handle unexpected errors - log full stack trace but return generic message
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

    return wrapper


def handle_exceptions_sync(func: F) -> F:
    """Synchronous version of handle_exceptions decorator.

    Use this for non-async functions.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except ZionException as e:
            logger.warning(f"{func.__name__}: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except ValueError as e:
            logger.warning(f"Validation error in {func.__name__}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

    return wrapper


# Convenience function to raise not found errors
def ensure_found(obj: Any, resource_name: str, identifier: str = None) -> Any:
    """Raise NotFoundError if object is None.

    Usage:
        user = ensure_found(
            await db.users.find_one({"id": user_id}),
            "User",
            user_id
        )
    """
    if obj is None:
        raise NotFoundError(resource_name, identifier)
    return obj
