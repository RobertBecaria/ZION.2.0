"""
ZION.CITY Base Repository

This module provides the base repository pattern for database operations.
Repositories encapsulate data access logic and provide a clean interface
for working with database collections.

Usage:
    from repositories import BaseRepository

    class UserRepository(BaseRepository):
        collection_name = 'users'
        id_field = 'id'

    repo = UserRepository(db)
    user = await repo.find_by_id('user-123')
"""

import logging
from typing import Dict, List, Optional, Any, TypeVar, Generic
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("zion")

T = TypeVar('T', bound=dict)


class BaseRepository(Generic[T]):
    """Base repository providing common database operations.

    This class provides a consistent interface for CRUD operations
    across all collections. Extend this class for specific entities.

    Attributes:
        collection_name: Name of the MongoDB collection
        id_field: Name of the ID field (default: 'id')
        db: Database instance
    """

    collection_name: str = None
    id_field: str = 'id'

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize repository with database instance.

        Args:
            db: MongoDB database instance
        """
        if not self.collection_name:
            raise ValueError(f"{self.__class__.__name__} must define collection_name")
        self.db = db
        self.collection = db[self.collection_name]

    # ============================================================
    # READ OPERATIONS
    # ============================================================

    async def find_by_id(self, entity_id: str, projection: dict = None) -> Optional[T]:
        """Find entity by ID.

        Args:
            entity_id: The entity ID
            projection: Optional fields to include/exclude

        Returns:
            Entity dict or None if not found
        """
        query = {self.id_field: entity_id}
        result = await self.collection.find_one(query, projection)
        if result:
            result.pop("_id", None)
        return result

    async def find_one(self, query: dict, projection: dict = None) -> Optional[T]:
        """Find single entity matching query.

        Args:
            query: MongoDB query dict
            projection: Optional fields to include/exclude

        Returns:
            Entity dict or None if not found
        """
        result = await self.collection.find_one(query, projection)
        if result:
            result.pop("_id", None)
        return result

    async def find_many(
        self,
        query: dict,
        projection: dict = None,
        sort: List[tuple] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[T]:
        """Find multiple entities matching query.

        Args:
            query: MongoDB query dict
            projection: Optional fields to include/exclude
            sort: Optional sort specification [(field, direction), ...]
            skip: Number of documents to skip
            limit: Maximum documents to return (default: 100)

        Returns:
            List of entity dicts
        """
        cursor = self.collection.find(query, projection)

        if sort:
            cursor = cursor.sort(sort)
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)

        results = await cursor.to_list(limit)
        for r in results:
            r.pop("_id", None)
        return results

    async def count(self, query: dict = None) -> int:
        """Count documents matching query.

        Args:
            query: Optional MongoDB query dict

        Returns:
            Count of matching documents
        """
        return await self.collection.count_documents(query or {})

    async def exists(self, query: dict) -> bool:
        """Check if any document matches query.

        Args:
            query: MongoDB query dict

        Returns:
            True if at least one document matches
        """
        return await self.collection.count_documents(query, limit=1) > 0

    # ============================================================
    # WRITE OPERATIONS
    # ============================================================

    async def insert_one(self, document: dict) -> T:
        """Insert a single document.

        Args:
            document: Document to insert

        Returns:
            Inserted document (without _id)
        """
        # Add timestamps if not present
        now = datetime.now(timezone.utc)
        if 'created_at' not in document:
            document['created_at'] = now
        if 'updated_at' not in document:
            document['updated_at'] = now

        result = await self.collection.insert_one(document)
        document.pop("_id", None)
        return document

    async def insert_many(self, documents: List[dict]) -> List[T]:
        """Insert multiple documents.

        Args:
            documents: List of documents to insert

        Returns:
            List of inserted documents (without _id)
        """
        now = datetime.now(timezone.utc)
        for doc in documents:
            if 'created_at' not in doc:
                doc['created_at'] = now
            if 'updated_at' not in doc:
                doc['updated_at'] = now

        await self.collection.insert_many(documents)
        for doc in documents:
            doc.pop("_id", None)
        return documents

    async def update_by_id(
        self,
        entity_id: str,
        update: dict,
        upsert: bool = False
    ) -> Optional[T]:
        """Update entity by ID.

        Args:
            entity_id: The entity ID
            update: Update operations (will be wrapped in $set if needed)
            upsert: Whether to insert if not found

        Returns:
            Updated document or None
        """
        query = {self.id_field: entity_id}
        return await self.update_one(query, update, upsert)

    async def update_one(
        self,
        query: dict,
        update: dict,
        upsert: bool = False
    ) -> Optional[T]:
        """Update single document matching query.

        Args:
            query: MongoDB query dict
            update: Update operations
            upsert: Whether to insert if not found

        Returns:
            Updated document or None
        """
        # Auto-wrap in $set if no operators present
        if not any(key.startswith('$') for key in update.keys()):
            update = {"$set": update}

        # Always update the updated_at timestamp
        if "$set" in update:
            update["$set"]["updated_at"] = datetime.now(timezone.utc)
        else:
            update["$set"] = {"updated_at": datetime.now(timezone.utc)}

        result = await self.collection.find_one_and_update(
            query,
            update,
            upsert=upsert,
            return_document=True
        )
        if result:
            result.pop("_id", None)
        return result

    async def update_many(self, query: dict, update: dict) -> int:
        """Update multiple documents matching query.

        Args:
            query: MongoDB query dict
            update: Update operations

        Returns:
            Count of modified documents
        """
        # Auto-wrap in $set if no operators present
        if not any(key.startswith('$') for key in update.keys()):
            update = {"$set": update}

        # Always update the updated_at timestamp
        if "$set" in update:
            update["$set"]["updated_at"] = datetime.now(timezone.utc)
        else:
            update["$set"] = {"updated_at": datetime.now(timezone.utc)}

        result = await self.collection.update_many(query, update)
        return result.modified_count

    # ============================================================
    # DELETE OPERATIONS
    # ============================================================

    async def delete_by_id(self, entity_id: str) -> bool:
        """Delete entity by ID.

        Args:
            entity_id: The entity ID

        Returns:
            True if deleted, False if not found
        """
        result = await self.collection.delete_one({self.id_field: entity_id})
        return result.deleted_count > 0

    async def delete_one(self, query: dict) -> bool:
        """Delete single document matching query.

        Args:
            query: MongoDB query dict

        Returns:
            True if deleted, False if not found
        """
        result = await self.collection.delete_one(query)
        return result.deleted_count > 0

    async def delete_many(self, query: dict) -> int:
        """Delete multiple documents matching query.

        Args:
            query: MongoDB query dict

        Returns:
            Count of deleted documents
        """
        result = await self.collection.delete_many(query)
        return result.deleted_count

    # ============================================================
    # SOFT DELETE OPERATIONS
    # ============================================================

    async def soft_delete_by_id(self, entity_id: str) -> bool:
        """Soft delete entity by ID (sets is_deleted=True).

        Args:
            entity_id: The entity ID

        Returns:
            True if updated, False if not found
        """
        result = await self.update_by_id(
            entity_id,
            {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}
        )
        return result is not None

    # ============================================================
    # AGGREGATION
    # ============================================================

    async def aggregate(self, pipeline: List[dict]) -> List[dict]:
        """Run aggregation pipeline.

        Args:
            pipeline: MongoDB aggregation pipeline

        Returns:
            List of result documents
        """
        results = await self.collection.aggregate(pipeline).to_list(100)
        for r in results:
            r.pop("_id", None)
        return results
