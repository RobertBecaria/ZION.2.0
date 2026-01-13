"""
ZION.CITY Database Connection
MongoDB connection configuration and utilities
"""
import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("zion")


# === CONFIGURATION ===

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'zion_city')
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'

# Connection pool settings
MAX_POOL_SIZE = int(os.environ.get('MONGO_MAX_POOL_SIZE', 100))
MIN_POOL_SIZE = int(os.environ.get('MONGO_MIN_POOL_SIZE', 10))
MAX_IDLE_TIME_MS = int(os.environ.get('MONGO_MAX_IDLE_TIME_MS', 45000))
SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000))
CONNECT_TIMEOUT_MS = int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', 10000))
SOCKET_TIMEOUT_MS = int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', 30000))


# === CLIENT INSTANCE ===

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def get_client() -> AsyncIOMotorClient:
    """
    Get or create the MongoDB client instance.

    Uses lazy initialization to avoid connection at import time.
    """
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            MONGO_URL,
            maxPoolSize=MAX_POOL_SIZE,
            minPoolSize=MIN_POOL_SIZE,
            maxIdleTimeMS=MAX_IDLE_TIME_MS,
            serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
            connectTimeoutMS=CONNECT_TIMEOUT_MS,
            socketTimeoutMS=SOCKET_TIMEOUT_MS,
            retryWrites=True,
            w='majority' if IS_PRODUCTION else 1
        )
        logger.info(f"MongoDB client initialized: {MONGO_URL[:30]}...")
    return _client


def get_database() -> AsyncIOMotorDatabase:
    """
    Get the database instance.

    Returns:
        AsyncIOMotorDatabase: The database instance
    """
    global _db
    if _db is None:
        _db = get_client()[DB_NAME]
        logger.info(f"Using database: {DB_NAME}")
    return _db


# Shorthand for common usage
db = property(lambda self: get_database())


async def check_connection() -> bool:
    """
    Verify database connection is working.

    Returns:
        True if connection is successful

    Raises:
        Exception: If connection fails
    """
    client = get_client()
    await client.admin.command('ping')
    logger.info("MongoDB connection verified")
    return True


async def close_connection() -> None:
    """Close the MongoDB connection gracefully."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")


async def get_server_info() -> dict:
    """Get MongoDB server information."""
    client = get_client()
    return await client.server_info()


async def list_collections() -> list:
    """List all collections in the database."""
    db = get_database()
    return await db.list_collection_names()


# === HEALTH CHECK ===

async def health_check() -> dict:
    """
    Perform a health check on the database.

    Returns:
        Dictionary with health status information
    """
    try:
        await check_connection()
        server_info = await get_server_info()
        collections = await list_collections()

        return {
            "status": "healthy",
            "database": DB_NAME,
            "server_version": server_info.get("version", "unknown"),
            "collections_count": len(collections),
            "is_production": IS_PRODUCTION
        }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "database": DB_NAME
        }
