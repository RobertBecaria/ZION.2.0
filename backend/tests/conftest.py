"""
Pytest fixtures and configuration for ZION.2.0 backend tests.
Provides mock database, test users, and authentication helpers.
"""
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Generator, Dict, Any
import jwt
import uuid

# Test configuration
TEST_SECRET_KEY = "test-secret-key-for-testing-only-do-not-use-in-production"
TEST_ALGORITHM = "HS256"


# ============================================================
# Event Loop Fixture
# ============================================================

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================
# Mock Database Fixtures
# ============================================================

class MockCollection:
    """Mock MongoDB collection for testing."""

    def __init__(self, name: str):
        self.name = name
        self._data: Dict[str, Any] = {}

    async def find_one(self, query: dict) -> dict | None:
        """Find a single document matching the query."""
        for doc in self._data.values():
            matches = all(doc.get(k) == v for k, v in query.items())
            if matches:
                return doc.copy()
        return None

    async def insert_one(self, document: dict):
        """Insert a document into the collection."""
        doc_id = document.get("id") or str(uuid.uuid4())
        self._data[doc_id] = document.copy()
        return MagicMock(inserted_id=doc_id)

    async def update_one(self, query: dict, update: dict):
        """Update a single document."""
        for doc_id, doc in self._data.items():
            matches = all(doc.get(k) == v for k, v in query.items())
            if matches:
                if "$set" in update:
                    doc.update(update["$set"])
                if "$push" in update:
                    for key, value in update["$push"].items():
                        if key not in doc:
                            doc[key] = []
                        doc[key].append(value)
                if "$inc" in update:
                    for key, value in update["$inc"].items():
                        doc[key] = doc.get(key, 0) + value
                return MagicMock(modified_count=1)
        return MagicMock(modified_count=0)

    async def delete_one(self, query: dict):
        """Delete a single document."""
        for doc_id, doc in list(self._data.items()):
            matches = all(doc.get(k) == v for k, v in query.items())
            if matches:
                del self._data[doc_id]
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)

    def find(self, query: dict = None):
        """Return a cursor-like object for find operations."""
        return MockCursor(self._data, query or {})

    async def count_documents(self, query: dict = None):
        """Count documents matching the query."""
        if not query:
            return len(self._data)
        count = 0
        for doc in self._data.values():
            matches = all(doc.get(k) == v for k, v in query.items())
            if matches:
                count += 1
        return count

    async def create_index(self, *args, **kwargs):
        """Mock index creation."""
        pass

    def clear(self):
        """Clear all data from the collection."""
        self._data.clear()


class MockCursor:
    """Mock MongoDB cursor for testing."""

    def __init__(self, data: dict, query: dict):
        self._data = data
        self._query = query
        self._skip_count = 0
        self._limit_count = None
        self._sort_key = None
        self._sort_direction = 1

    def skip(self, count: int):
        """Skip a number of documents."""
        self._skip_count = count
        return self

    def limit(self, count: int):
        """Limit the number of documents returned."""
        self._limit_count = count
        return self

    def sort(self, key_or_list, direction=1):
        """Sort the results."""
        if isinstance(key_or_list, list):
            self._sort_key, self._sort_direction = key_or_list[0]
        else:
            self._sort_key = key_or_list
            self._sort_direction = direction
        return self

    async def to_list(self, length: int = None) -> list:
        """Convert cursor to list."""
        results = []
        for doc in self._data.values():
            if self._query:
                matches = all(doc.get(k) == v for k, v in self._query.items())
                if not matches:
                    continue
            results.append(doc.copy())

        # Apply sorting
        if self._sort_key:
            results.sort(
                key=lambda x: x.get(self._sort_key, ""),
                reverse=self._sort_direction == -1
            )

        # Apply skip and limit
        if self._skip_count:
            results = results[self._skip_count:]
        if self._limit_count:
            results = results[:self._limit_count]
        elif length:
            results = results[:length]

        return results


class MockDatabase:
    """Mock MongoDB database for testing."""

    def __init__(self):
        self._collections: Dict[str, MockCollection] = {}

    def __getattr__(self, name: str) -> MockCollection:
        """Get or create a collection by name."""
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getitem__(self, name: str) -> MockCollection:
        """Get or create a collection by name."""
        return self.__getattr__(name)

    def clear_all(self):
        """Clear all collections."""
        for collection in self._collections.values():
            collection.clear()


@pytest.fixture
def mock_db():
    """Provide a mock database for tests."""
    return MockDatabase()


# ============================================================
# Test User Fixtures
# ============================================================

@pytest.fixture
def test_user_data():
    """Return test user data."""
    return {
        "id": "test-user-id-123",
        "email": "testuser@test.com",
        "password_hash": "$2b$12$KIXQzSv1xhyHTiKJFCQSyeT6ZmWJ0HpIxVF6L3a1t.hNVPYwS8Fuy",  # "TestPassword123"
        "first_name": "Test",
        "last_name": "User",
        "middle_name": None,
        "gender": "MALE",
        "role": "ADULT",
        "is_active": True,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "privacy_settings": {
            "work_visible_in_services": True,
            "school_visible_in_events": True,
            "location_sharing_enabled": False,
            "profile_visible_to_public": True,
            "family_visible_to_friends": True
        }
    }


@pytest.fixture
def test_admin_user_data():
    """Return test admin user data."""
    return {
        "id": "test-admin-id-456",
        "email": "admin@test.com",
        "password_hash": "$2b$12$KIXQzSv1xhyHTiKJFCQSyeT6ZmWJ0HpIxVF6L3a1t.hNVPYwS8Fuy",  # "TestPassword123"
        "first_name": "Admin",
        "last_name": "User",
        "middle_name": None,
        "gender": "FEMALE",
        "role": "ADMIN",
        "is_active": True,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "privacy_settings": {
            "work_visible_in_services": True,
            "school_visible_in_events": True,
            "location_sharing_enabled": False,
            "profile_visible_to_public": True,
            "family_visible_to_friends": True
        }
    }


@pytest.fixture
def test_child_user_data():
    """Return test child user data."""
    return {
        "id": "test-child-id-789",
        "email": "child@test.com",
        "password_hash": "$2b$12$KIXQzSv1xhyHTiKJFCQSyeT6ZmWJ0HpIxVF6L3a1t.hNVPYwS8Fuy",  # "TestPassword123"
        "first_name": "Test",
        "last_name": "Child",
        "middle_name": None,
        "gender": "MALE",
        "role": "CHILD",
        "is_active": True,
        "is_verified": False,
        "date_of_birth": datetime.now(timezone.utc) - timedelta(days=365*10),  # 10 years old
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "privacy_settings": {
            "work_visible_in_services": False,
            "school_visible_in_events": True,
            "location_sharing_enabled": False,
            "profile_visible_to_public": False,
            "family_visible_to_friends": True
        }
    }


# ============================================================
# Authentication Fixtures
# ============================================================

def create_test_token(user_id: str, token_type: str = "user", expires_minutes: int = 30) -> str:
    """Create a test JWT token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode = {
        "sub": user_id,
        "type": token_type,
        "exp": expire
    }
    return jwt.encode(to_encode, TEST_SECRET_KEY, algorithm=TEST_ALGORITHM)


@pytest.fixture
def test_user_token(test_user_data):
    """Create a valid JWT token for the test user."""
    return create_test_token(test_user_data["id"])


@pytest.fixture
def test_admin_token(test_admin_user_data):
    """Create a valid JWT token for the admin user."""
    return create_test_token(test_admin_user_data["id"])


@pytest.fixture
def expired_token():
    """Create an expired JWT token."""
    return create_test_token("test-user-id-123", expires_minutes=-1)


@pytest.fixture
def invalid_token():
    """Return an invalid JWT token."""
    return "invalid.token.here"


# ============================================================
# Test Family Fixtures
# ============================================================

@pytest.fixture
def test_family_data():
    """Return test family profile data."""
    return {
        "id": "test-family-id-123",
        "family_name": "Test Family",
        "family_surname": "Testov",
        "description": "A test family for unit testing",
        "public_bio": "We are a happy test family",
        "primary_address": "123 Test Street",
        "city": "Test City",
        "state": "Test State",
        "country": "Test Country",
        "is_private": True,
        "allow_public_discovery": False,
        "member_count": 2,
        "children_count": 0,
        "creator_id": "test-user-id-123",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_active": True
    }


@pytest.fixture
def test_family_member_data(test_user_data, test_family_data):
    """Return test family member data."""
    return {
        "id": "test-member-id-123",
        "family_id": test_family_data["id"],
        "user_id": test_user_data["id"],
        "family_role": "CREATOR",
        "relationship_to_family": "Father",
        "is_primary_resident": True,
        "invitation_accepted": True,
        "joined_at": datetime.now(timezone.utc),
        "is_active": True
    }


# ============================================================
# Test Organization Fixtures
# ============================================================

@pytest.fixture
def test_organization_data():
    """Return test work organization data."""
    return {
        "id": "test-org-id-123",
        "name": "Test Company Inc.",
        "organization_type": "COMPANY",
        "description": "A test company for unit testing",
        "size": "11-50",
        "industry": "Technology",
        "website": "https://testcompany.com",
        "email": "contact@testcompany.com",
        "phone": "+1234567890",
        "address": "456 Business Ave",
        "city": "Tech City",
        "country": "Test Country",
        "owner_id": "test-user-id-123",
        "member_count": 5,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_active": True
    }


# ============================================================
# Test Post Fixtures
# ============================================================

@pytest.fixture
def test_post_data(test_user_data):
    """Return test post data."""
    return {
        "id": "test-post-id-123",
        "user_id": test_user_data["id"],
        "content": "This is a test post content",
        "source_module": "family",
        "target_audience": "module",
        "visibility": "FAMILY_ONLY",
        "family_id": "test-family-id-123",
        "media_files": [],
        "youtube_urls": [],
        "likes_count": 0,
        "comments_count": 0,
        "is_published": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": None
    }


# ============================================================
# Test Chat Fixtures
# ============================================================

@pytest.fixture
def test_chat_group_data(test_user_data):
    """Return test chat group data."""
    return {
        "id": "test-group-id-123",
        "name": "Test Family Chat",
        "description": "A test chat group for the family",
        "group_type": "FAMILY",
        "admin_id": test_user_data["id"],
        "color_code": "#059669",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }


@pytest.fixture
def test_direct_chat_data(test_user_data, test_admin_user_data):
    """Return test direct chat data."""
    return {
        "id": "test-direct-chat-id-123",
        "participant_ids": [test_user_data["id"], test_admin_user_data["id"]],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_active": True
    }


@pytest.fixture
def test_message_data(test_user_data, test_chat_group_data):
    """Return test chat message data."""
    return {
        "id": "test-message-id-123",
        "group_id": test_chat_group_data["id"],
        "direct_chat_id": None,
        "user_id": test_user_data["id"],
        "content": "Hello, this is a test message!",
        "message_type": "TEXT",
        "reply_to": None,
        "status": "sent",
        "created_at": datetime.now(timezone.utc),
        "updated_at": None,
        "is_edited": False,
        "is_deleted": False
    }


# ============================================================
# HTTP Client Fixtures
# ============================================================

@pytest.fixture
def auth_headers(test_user_token):
    """Return authentication headers for the test user."""
    return {"Authorization": f"Bearer {test_user_token}"}


@pytest.fixture
def admin_auth_headers(test_admin_token):
    """Return authentication headers for the admin user."""
    return {"Authorization": f"Bearer {test_admin_token}"}
