"""
ZION.CITY Base Repository
Abstract base class for all repository implementations
"""
from typing import TypeVar, Generic, Optional, List, Dict, Any
from datetime import datetime, timezone
import logging

from motor.motor_asyncio import AsyncIOMotorCollection

logger = logging.getLogger("zion")

T = TypeVar('T')


class BaseRepository(Generic[T]):
    """
    Base repository providing common CRUD operations.

    All domain-specific repositories should extend this class.

    Example:
        class UserRepository(BaseRepository):
            def __init__(self, db):
                super().__init__(db, "users")

            async def find_by_email(self, email: str):
                return await self.find_one({"email": email})
    """

    def __init__(self, db, collection_name: str):
        """
        Initialize repository with database and collection.

        Args:
            db: AsyncIOMotorDatabase instance
            collection_name: Name of the MongoDB collection
        """
        self.db = db
        self.collection: AsyncIOMotorCollection = db[collection_name]
        self.collection_name = collection_name

    # === READ OPERATIONS ===

    async def get_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by its ID.

        Args:
            id: Document ID

        Returns:
            Document dict or None if not found
        """
        doc = await self.collection.find_one({"id": id})
        return self._clean(doc)

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Find a single document matching the query.

        Args:
            query: MongoDB query dict

        Returns:
            Document dict or None if not found
        """
        doc = await self.collection.find_one(query)
        return self._clean(doc)

    async def find_many(
        self,
        query: Dict[str, Any],
        limit: int = 100,
        skip: int = 0,
        sort: List[tuple] = None
    ) -> List[Dict[str, Any]]:
        """
        Find multiple documents matching the query.

        Args:
            query: MongoDB query dict
            limit: Maximum documents to return
            skip: Number of documents to skip
            sort: List of (field, direction) tuples

        Returns:
            List of document dicts
        """
        cursor = self.collection.find(query).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        docs = await cursor.to_list(limit)
        return [self._clean(doc) for doc in docs]

    async def get_many_by_ids(self, ids: List[str]) -> List[Dict[str, Any]]:
        """
        Get multiple documents by their IDs.

        Args:
            ids: List of document IDs

        Returns:
            List of document dicts (preserves order)
        """
        if not ids:
            return []
        cursor = self.collection.find({"id": {"$in": ids}})
        docs = await cursor.to_list(len(ids))
        docs_map = {doc["id"]: self._clean(doc) for doc in docs}
        # Preserve order of input IDs
        return [docs_map[id] for id in ids if id in docs_map]

    async def count(self, query: Dict[str, Any] = None) -> int:
        """
        Count documents matching the query.

        Args:
            query: MongoDB query dict (empty dict for all)

        Returns:
            Number of matching documents
        """
        return await self.collection.count_documents(query or {})

    async def exists(self, query: Dict[str, Any]) -> bool:
        """
        Check if any document matches the query.

        Args:
            query: MongoDB query dict

        Returns:
            True if at least one document exists
        """
        doc = await self.collection.find_one(query, {"_id": 1})
        return doc is not None

    # === WRITE OPERATIONS ===

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new document.

        Args:
            data: Document data

        Returns:
            Created document with timestamps
        """
        now = datetime.now(timezone.utc)
        data["created_at"] = data.get("created_at", now)
        data["updated_at"] = now
        await self.collection.insert_one(data)
        return self._clean(data)

    async def create_many(self, docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Create multiple documents.

        Args:
            docs: List of document dicts

        Returns:
            List of created documents
        """
        if not docs:
            return []
        now = datetime.now(timezone.utc)
        for doc in docs:
            doc["created_at"] = doc.get("created_at", now)
            doc["updated_at"] = now
        await self.collection.insert_many(docs)
        return [self._clean(doc) for doc in docs]

    async def update(self, id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update a document by ID.

        Args:
            id: Document ID
            data: Fields to update

        Returns:
            Updated document or None if not found
        """
        data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"id": id},
            {"$set": data},
            return_document=True
        )
        return self._clean(result)

    async def update_many(self, query: Dict[str, Any], data: Dict[str, Any]) -> int:
        """
        Update multiple documents matching the query.

        Args:
            query: MongoDB query dict
            data: Fields to update

        Returns:
            Number of documents modified
        """
        data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.update_many(query, {"$set": data})
        return result.modified_count

    async def upsert(self, query: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update if exists, create if not.

        Args:
            query: Query to find existing document
            data: Document data

        Returns:
            Upserted document
        """
        now = datetime.now(timezone.utc)
        data["updated_at"] = now
        result = await self.collection.find_one_and_update(
            query,
            {"$set": data, "$setOnInsert": {"created_at": now}},
            upsert=True,
            return_document=True
        )
        return self._clean(result)

    # === DELETE OPERATIONS ===

    async def delete(self, id: str) -> bool:
        """
        Delete a document by ID.

        Args:
            id: Document ID

        Returns:
            True if document was deleted
        """
        result = await self.collection.delete_one({"id": id})
        return result.deleted_count > 0

    async def delete_many(self, query: Dict[str, Any]) -> int:
        """
        Delete multiple documents matching the query.

        Args:
            query: MongoDB query dict

        Returns:
            Number of documents deleted
        """
        result = await self.collection.delete_many(query)
        return result.deleted_count

    async def soft_delete(self, id: str) -> Optional[Dict[str, Any]]:
        """
        Soft delete (mark as deleted) a document.

        Args:
            id: Document ID

        Returns:
            Updated document or None if not found
        """
        return await self.update(id, {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc)
        })

    # === AGGREGATION ===

    async def aggregate(self, pipeline: List[Dict[str, Any]], limit: int = 100) -> List[Dict[str, Any]]:
        """
        Run an aggregation pipeline.

        Args:
            pipeline: MongoDB aggregation pipeline
            limit: Maximum results

        Returns:
            List of result documents
        """
        cursor = self.collection.aggregate(pipeline)
        return await cursor.to_list(limit)

    # === UTILITIES ===

    def _clean(self, doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Remove MongoDB _id from document."""
        if doc:
            doc.pop("_id", None)
        return doc
