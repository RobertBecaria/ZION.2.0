"""
ZION.CITY Database Connection Module

This module handles MongoDB connection configuration and database
access. It provides a centralized way to access the database and
ensure proper connection management.

Usage:
    from database import get_database, get_collection, ensure_indexes

    db = get_database()
    users = get_collection('users')
"""

import os
import logging
import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("zion")

# ============================================================
# CONFIGURATION
# ============================================================

IS_PRODUCTION = os.environ.get('ENVIRONMENT', 'development') == 'production'


class DatabaseManager:
    """Singleton manager for database connections.

    Provides centralized database access with connection pooling
    and proper lifecycle management.
    """
    _instance: Optional['DatabaseManager'] = None
    _client: Optional[AsyncIOMotorClient] = None
    _db: Optional[AsyncIOMotorDatabase] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self, mongo_url: str, db_name: str = 'zion_city'):
        """Initialize database connection with optimized settings."""
        if self._client is not None:
            return  # Already initialized

        self._client = AsyncIOMotorClient(
            mongo_url,
            maxPoolSize=100,              # Maximum connection pool size
            minPoolSize=10,               # Minimum connections to maintain
            maxIdleTimeMS=45000,          # Close idle connections after 45 seconds
            serverSelectionTimeoutMS=5000, # Timeout for server selection
            connectTimeoutMS=10000,        # Connection timeout
            socketTimeoutMS=30000,         # Socket timeout for operations
            retryWrites=True,              # Retry failed writes
            w='majority' if IS_PRODUCTION else 1,  # Write concern
        )
        self._db = self._client[db_name]
        logger.info(f"Database initialized: {db_name}")

    @property
    def client(self) -> AsyncIOMotorClient:
        """Get the MongoDB client."""
        if self._client is None:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self._client

    @property
    def db(self) -> AsyncIOMotorDatabase:
        """Get the database instance."""
        if self._db is None:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self._db

    def close(self):
        """Close database connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            logger.info("Database connection closed")


# Global instance for backwards compatibility
_db_manager = DatabaseManager()


def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance.

    Returns:
        The MongoDB database instance
    """
    return _db_manager.db


def get_collection(name: str):
    """Get a collection by name.

    Args:
        name: Collection name

    Returns:
        The MongoDB collection
    """
    return _db_manager.db[name]


async def ensure_indexes():
    """Ensure all database indexes exist (runs on startup).

    Creates indexes in the background for all collections.
    This is idempotent - indexes that already exist are not recreated.
    """
    try:
        db = _db_manager.db

        # ===== USER INDEXES =====
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.users.create_index([("first_name", 1), ("last_name", 1)], background=True)

        # ===== POST INDEXES =====
        await db.posts.create_index([("created_at", -1)], background=True)
        await db.posts.create_index([("user_id", 1), ("created_at", -1)], background=True)
        await db.posts.create_index([("visibility", 1), ("created_at", -1)], background=True)

        # ===== POST INTERACTIONS (Critical for feed performance) =====
        await db.post_likes.create_index("post_id", background=True)
        await db.post_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True, background=True)
        await db.post_comments.create_index("post_id", background=True)
        await db.post_comments.create_index([("post_id", 1), ("created_at", -1)], background=True)
        await db.post_reactions.create_index("post_id", background=True)
        await db.post_reactions.create_index([("post_id", 1), ("user_id", 1)], background=True)

        # ===== CHAT INDEXES (Critical for messaging) =====
        await db.chat_groups.create_index("id", unique=True, background=True)
        await db.chat_group_members.create_index([("user_id", 1), ("is_active", 1)], background=True)
        await db.chat_group_members.create_index([("group_id", 1), ("is_active", 1)], background=True)
        await db.chat_messages.create_index([("group_id", 1), ("is_deleted", 1), ("created_at", -1)], background=True)
        await db.chat_messages.create_index([("direct_chat_id", 1), ("is_deleted", 1), ("created_at", -1)], background=True)
        await db.direct_chats.create_index("id", unique=True, background=True)
        await db.direct_chats.create_index([("participant_ids", 1), ("is_active", 1)], background=True)

        # ===== FAMILY INDEXES =====
        await db.family_members.create_index([("user_id", 1), ("is_active", 1)], background=True)
        await db.family_members.create_index([("family_id", 1), ("is_active", 1)], background=True)
        await db.family_units.create_index("id", unique=True, background=True)
        await db.families.create_index("id", unique=True, background=True)

        # ===== WORK/ORGANIZATIONS INDEXES =====
        await db.work_organizations.create_index("id", unique=True, background=True)
        await db.work_organizations.create_index([("is_active", 1), ("allow_public_discovery", 1)], background=True)
        await db.work_members.create_index([("user_id", 1), ("status", 1)], background=True)
        await db.work_members.create_index([("organization_id", 1), ("status", 1)], background=True)
        await db.user_affiliations.create_index([("user_id", 1), ("is_active", 1)], background=True)

        # ===== NOTIFICATIONS INDEXES =====
        await db.notifications.create_index([("user_id", 1), ("is_read", 1), ("created_at", -1)], background=True)

        # ===== EVENTS INDEXES =====
        await db.goodwill_events.create_index([("status", 1), ("start_date", 1)], background=True)
        await db.goodwill_events.create_index([("organizer_id", 1), ("status", 1)], background=True)
        await db.event_registrations.create_index([("event_id", 1), ("user_id", 1)], background=True)

        # ===== SERVICES/MARKETPLACE INDEXES =====
        await db.service_listings.create_index([("status", 1), ("category_id", 1)], background=True)
        await db.marketplace_products.create_index([("status", 1), ("category", 1)], background=True)
        await db.inventory_items.create_index([("user_id", 1), ("category", 1)], background=True)

        # ===== AI/AGENT INDEXES =====
        await db.agent_conversations.create_index([("user_id", 1), ("updated_at", -1)], background=True)

        # ===== MEDIA INDEXES =====
        await db.media_files.create_index("id", unique=True, background=True)
        await db.media_files.create_index([("user_id", 1), ("created_at", -1)], background=True)

        logger.info("Database indexes verified (35+ indexes)")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
