"""
ZION.CITY User Repository
Database operations for user management
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from .base import BaseRepository


class UserRepository(BaseRepository):
    """
    Repository for user-related database operations.

    Example:
        repo = UserRepository(db)
        user = await repo.find_by_email("user@example.com")
        users = await repo.search("john", limit=10)
    """

    def __init__(self, db):
        super().__init__(db, "users")

    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find user by email address."""
        return await self.find_one({"email": email.lower()})

    async def find_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Find user by ID."""
        return await self.get_by_id(user_id)

    async def email_exists(self, email: str) -> bool:
        """Check if email is already registered."""
        return await self.exists({"email": email.lower()})

    async def search(
        self,
        query: str,
        limit: int = 20,
        skip: int = 0,
        exclude_ids: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search users by name or email.

        Args:
            query: Search query string
            limit: Maximum results
            skip: Number to skip (for pagination)
            exclude_ids: User IDs to exclude from results

        Returns:
            List of matching users
        """
        import re
        safe_query = re.escape(query)

        mongo_query = {
            "$or": [
                {"first_name": {"$regex": safe_query, "$options": "i"}},
                {"last_name": {"$regex": safe_query, "$options": "i"}},
                {"email": {"$regex": safe_query, "$options": "i"}}
            ]
        }

        if exclude_ids:
            mongo_query["id"] = {"$nin": exclude_ids}

        return await self.find_many(
            mongo_query,
            limit=limit,
            skip=skip,
            sort=[("first_name", 1), ("last_name", 1)]
        )

    async def get_basic_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get basic user info (for embedding in other documents).

        Returns only id, first_name, last_name, profile_picture.
        """
        doc = await self.collection.find_one(
            {"id": user_id},
            {"id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
        )
        return self._clean(doc)

    async def get_many_basic_info(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Get basic info for multiple users.

        Returns a dict mapping user_id to basic info.
        """
        if not user_ids:
            return {}

        cursor = self.collection.find(
            {"id": {"$in": user_ids}},
            {"id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
        )
        docs = await cursor.to_list(len(user_ids))
        return {doc["id"]: self._clean(doc) for doc in docs}

    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        await self.collection.update_one(
            {"id": user_id},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

    async def update_profile(self, user_id: str, profile_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update user profile fields.

        Args:
            user_id: User ID
            profile_data: Dict of profile fields to update

        Returns:
            Updated user document
        """
        # Filter out None values
        update_data = {k: v for k, v in profile_data.items() if v is not None}
        if not update_data:
            return await self.get_by_id(user_id)
        return await self.update(user_id, update_data)

    async def get_connections(self, user_id: str, status: str = "accepted") -> List[str]:
        """
        Get IDs of user's connections.

        Args:
            user_id: User ID
            status: Connection status filter

        Returns:
            List of connected user IDs
        """
        # This would typically query a connections collection
        connections = await self.db.connections.find({
            "$or": [
                {"from_user_id": user_id, "status": status},
                {"to_user_id": user_id, "status": status}
            ]
        }).to_list(1000)

        connected_ids = set()
        for conn in connections:
            if conn["from_user_id"] == user_id:
                connected_ids.add(conn["to_user_id"])
            else:
                connected_ids.add(conn["from_user_id"])

        return list(connected_ids)

    async def count_by_role(self, role: str) -> int:
        """Count users with a specific role."""
        return await self.count({"role": role})
