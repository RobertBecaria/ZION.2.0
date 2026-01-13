"""
ZION.CITY Backend Core Module
=============================
Core utilities and infrastructure components.
"""

from .logging import (
    setup_logging,
    get_logger,
    ContextLogger,
    request_context,
    JSONFormatter
)

from .exceptions import (
    ZionException,
    ValidationError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    ConflictError,
    handle_exceptions,
    handle_exceptions_sync,
    ensure_found
)

from .security import (
    pwd_context,
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    security,
    optional_security,
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    get_token_user_id,
    validate_password_strength,
    get_current_user_id,
    get_optional_user_id,
)

__all__ = [
    # Logging
    'setup_logging',
    'get_logger',
    'ContextLogger',
    'request_context',
    'JSONFormatter',
    # Exceptions
    'ZionException',
    'ValidationError',
    'NotFoundError',
    'PermissionDeniedError',
    'RateLimitError',
    'ConflictError',
    'handle_exceptions',
    'handle_exceptions_sync',
    'ensure_found',
    # Security
    'pwd_context',
    'SECRET_KEY',
    'ALGORITHM',
    'ACCESS_TOKEN_EXPIRE_MINUTES',
    'security',
    'optional_security',
    'verify_password',
    'get_password_hash',
    'create_access_token',
    'decode_token',
    'get_token_user_id',
    'validate_password_strength',
    'get_current_user_id',
    'get_optional_user_id',
]
