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
]
