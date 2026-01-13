"""
ZION.CITY Caching Module

This module provides in-memory caching for frequently accessed data.
It includes both a general-purpose cache and specialized user caching.

Usage:
    from database import get_user_by_id_cached, get_users_by_ids_cached

    user = await get_user_by_id_cached(user_id)
    users = await get_users_by_ids_cached([id1, id2, id3])
"""

import asyncio
import time
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("zion")


class SimpleCache:
    """Simple in-memory cache with TTL for frequent queries.

    This is a lightweight caching solution for reducing database
    load on frequently accessed data. For production at scale,
    consider using Redis instead.

    Attributes:
        default_ttl: Time-to-live in seconds for cache entries
    """

    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        async with self._lock:
            if key in self._cache:
                if time.time() - self._timestamps[key] < self.default_ttl:
                    return self._cache[key]
                else:
                    # Expired, remove it
                    del self._cache[key]
                    del self._timestamps[key]
        return None

    async def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache with TTL.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Optional TTL override (not used in this simple implementation)
        """
        async with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()

    async def delete(self, key: str):
        """Delete key from cache.

        Args:
            key: Cache key to delete
        """
        async with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)

    async def clear_expired(self):
        """Clean up expired entries."""
        async with self._lock:
            current_time = time.time()
            expired_keys = [
                k for k, t in self._timestamps.items()
                if current_time - t >= self.default_ttl
            ]
            for key in expired_keys:
                del self._cache[key]
                del self._timestamps[key]

            if expired_keys:
                logger.debug(f"Cleared {len(expired_keys)} expired cache entries")


# Initialize caches
cache = SimpleCache(default_ttl=300)  # 5 minutes TTL for general cache
user_cache = SimpleCache(default_ttl=120)  # 2 minutes TTL for user data

# Database reference - will be set during initialization
_db = None


def set_database(db):
    """Set the database reference for cache operations.

    This must be called during application startup.

    Args:
        db: The MongoDB database instance
    """
    global _db
    _db = db


async def get_user_by_id_cached(user_id: str) -> Optional[dict]:
    """Get user by ID with caching to reduce DB queries.

    This is a performance optimization for the 200+ places where
    we look up user data. Returns a dict (not User model) to avoid
    serialization overhead.

    Args:
        user_id: The user ID to look up

    Returns:
        User data dict or None if not found
    """
    if not user_id:
        return None

    if _db is None:
        raise RuntimeError("Database not set. Call set_database() first.")

    cache_key = f"user:{user_id}"

    # Try cache first
    cached = await user_cache.get(cache_key)
    if cached:
        return cached

    # Fetch from database
    user = await _db.users.find_one({"id": user_id})
    if user:
        user.pop("_id", None)
        user.pop("password_hash", None)  # Never cache sensitive data
        await user_cache.set(cache_key, user)
        return user

    return None


async def get_users_by_ids_cached(user_ids: List[str]) -> Dict[str, dict]:
    """Batch fetch multiple users with caching.

    Returns a dict mapping user_id -> user_data for efficient lookups.
    This eliminates N+1 queries when fetching multiple users.

    Args:
        user_ids: List of user IDs to look up

    Returns:
        Dict mapping user_id to user data
    """
    if not user_ids:
        return {}

    if _db is None:
        raise RuntimeError("Database not set. Call set_database() first.")

    result = {}
    missing_ids = []

    # Check cache for each user
    for user_id in user_ids:
        cache_key = f"user:{user_id}"
        cached = await user_cache.get(cache_key)
        if cached:
            result[user_id] = cached
        else:
            missing_ids.append(user_id)

    # Batch fetch missing users from database
    if missing_ids:
        users = await _db.users.find(
            {"id": {"$in": missing_ids}},
            {"_id": 0, "password_hash": 0}  # Exclude sensitive fields
        ).to_list(len(missing_ids))

        for user in users:
            user_id = user.get("id")
            if user_id:
                await user_cache.set(f"user:{user_id}", user)
                result[user_id] = user

    return result


async def invalidate_user_cache(user_id: str):
    """Invalidate cached user data.

    Call this when user data is updated to ensure
    fresh data is fetched on next access.

    Args:
        user_id: The user ID to invalidate
    """
    await user_cache.delete(f"user:{user_id}")
