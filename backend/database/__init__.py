"""
ZION.CITY Database Module
=========================
Database connection, caching, and utility functions.
"""

from .connection import (
    get_database,
    get_collection,
    ensure_indexes,
    DatabaseManager,
)

from .cache import (
    user_cache,
    get_user_by_id_cached,
    get_users_by_ids_cached,
    invalidate_user_cache,
)

__all__ = [
    # Connection
    'get_database',
    'get_collection',
    'ensure_indexes',
    'DatabaseManager',
    # Cache
    'user_cache',
    'get_user_by_id_cached',
    'get_users_by_ids_cached',
    'invalidate_user_cache',
]
