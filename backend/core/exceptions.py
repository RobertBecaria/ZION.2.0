"""
ZION.CITY Exception Handling
Centralized exception handling and error decorators
"""
from functools import wraps
from fastapi import HTTPException
import logging
from typing import Callable, TypeVar, Any

logger = logging.getLogger("zion")

# Type variable for generic function decoration
F = TypeVar('F', bound=Callable[..., Any])


# === CUSTOM EXCEPTIONS ===

class ZionException(Exception):
    """Base exception for ZION.CITY application"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(ZionException):
    """Resource not found"""
    def __init__(self, resource: str, identifier: str = None):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with ID '{identifier}' not found"
        super().__init__(message, status_code=404)


class PermissionDeniedError(ZionException):
    """User doesn't have permission for this action"""
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, status_code=403)


class ValidationError(ZionException):
    """Input validation failed"""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class ConflictError(ZionException):
    """Resource conflict (e.g., duplicate)"""
    def __init__(self, message: str):
        super().__init__(message, status_code=409)


class RateLimitError(ZionException):
    """Rate limit exceeded"""
    def __init__(self, message: str = "Too many requests"):
        super().__init__(message, status_code=429)


# === ERROR HANDLING DECORATOR ===

def handle_exceptions(func: F) -> F:
    """
    Decorator for consistent error handling in API endpoints.

    Catches common exceptions and converts them to appropriate HTTP responses.
    Logs errors with context for debugging.

    Usage:
        @api_router.get("/posts/{post_id}")
        @handle_exceptions
        async def get_post(post_id: str):
            # Code without try/except blocks
            post = await db.posts.find_one({"id": post_id})
            if not post:
                raise NotFoundError("Post", post_id)
            return post
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions as-is
            raise
        except ZionException as e:
            # Handle custom application exceptions
            logger.warning(f"Application error in {func.__name__}: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except ValueError as e:
            # Validation errors
            logger.warning(f"Validation error in {func.__name__}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except PermissionError as e:
            # Permission errors
            logger.warning(f"Permission denied in {func.__name__}: {e}")
            raise HTTPException(status_code=403, detail="Permission denied")
        except Exception as e:
            # Unexpected errors - log full traceback
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Internal server error")
    return wrapper  # type: ignore


def handle_db_exceptions(func: F) -> F:
    """
    Decorator specifically for database operations.
    Handles MongoDB-specific exceptions.

    Usage:
        @handle_db_exceptions
        async def get_user(user_id: str):
            return await db.users.find_one({"id": user_id})
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            error_name = type(e).__name__
            # Handle common MongoDB errors
            if "DuplicateKeyError" in error_name:
                logger.warning(f"Duplicate key in {func.__name__}: {e}")
                raise HTTPException(status_code=409, detail="Resource already exists")
            elif "ConnectionFailure" in error_name or "ServerSelectionTimeout" in error_name:
                logger.error(f"Database connection error in {func.__name__}: {e}")
                raise HTTPException(status_code=503, detail="Database unavailable")
            elif "OperationFailure" in error_name:
                logger.error(f"Database operation failed in {func.__name__}: {e}")
                raise HTTPException(status_code=500, detail="Database operation failed")
            else:
                # Re-raise for other handlers
                raise
    return wrapper  # type: ignore


# === UTILITY FUNCTIONS ===

def raise_not_found(resource: str, identifier: str = None) -> None:
    """Convenience function to raise a 404 error"""
    raise NotFoundError(resource, identifier)


def raise_forbidden(message: str = "Permission denied") -> None:
    """Convenience function to raise a 403 error"""
    raise PermissionDeniedError(message)


def raise_bad_request(message: str) -> None:
    """Convenience function to raise a 400 error"""
    raise ValidationError(message)
