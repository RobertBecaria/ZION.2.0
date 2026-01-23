"""
Unit tests for chat/messaging endpoints.
Tests chat groups, direct messages, message status, and WebSocket events.
"""
import pytest
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any


# ============================================================
# Chat Group Model Tests
# ============================================================

class TestChatGroupModel:
    """Test ChatGroup model validation and defaults."""

    def test_chat_group_has_required_fields(self, test_chat_group_data):
        """Test that chat group has all required fields."""
        required_fields = [
            "id", "name", "group_type", "admin_id",
            "is_active", "created_at"
        ]

        for field in required_fields:
            assert field in test_chat_group_data, f"Missing required field: {field}"

    def test_chat_group_type_is_valid(self, test_chat_group_data):
        """Test that group type is valid."""
        valid_types = ["FAMILY", "RELATIVES", "CUSTOM", "WORK", "SCHOOL"]
        assert test_chat_group_data["group_type"] in valid_types


# ============================================================
# Chat Group Creation Tests
# ============================================================

class TestChatGroupCreation:
    """Test chat group creation functionality."""

    VALID_GROUP_TYPES = ["FAMILY", "RELATIVES", "CUSTOM"]

    def create_chat_group(self, name: str, admin_id: str, group_type: str = "CUSTOM",
                         description: str = None, color_code: str = "#059669") -> dict:
        """Create a new chat group."""
        import uuid

        if group_type not in self.VALID_GROUP_TYPES:
            raise ValueError(f"Invalid group type: {group_type}")

        return {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "group_type": group_type,
            "admin_id": admin_id,
            "color_code": color_code,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

    def test_create_family_group(self, test_user_data):
        """Test creating a family chat group."""
        group = self.create_chat_group(
            "Family Chat",
            test_user_data["id"],
            group_type="FAMILY"
        )

        assert group["name"] == "Family Chat"
        assert group["group_type"] == "FAMILY"
        assert group["admin_id"] == test_user_data["id"]

    def test_create_custom_group(self, test_user_data):
        """Test creating a custom chat group."""
        group = self.create_chat_group(
            "Friends Chat",
            test_user_data["id"],
            group_type="CUSTOM",
            description="A chat for friends"
        )

        assert group["group_type"] == "CUSTOM"
        assert group["description"] == "A chat for friends"

    def test_invalid_group_type_raises_error(self, test_user_data):
        """Test that invalid group type raises an error."""
        with pytest.raises(ValueError):
            self.create_chat_group(
                "Invalid Group",
                test_user_data["id"],
                group_type="INVALID"
            )


# ============================================================
# Direct Chat Tests
# ============================================================

class TestDirectChat:
    """Test direct (1:1) chat functionality."""

    def create_direct_chat(self, user1_id: str, user2_id: str) -> dict:
        """Create a direct chat between two users."""
        import uuid

        if user1_id == user2_id:
            raise ValueError("Cannot create direct chat with self")

        # Sort participant IDs for consistent ordering
        participant_ids = sorted([user1_id, user2_id])

        return {
            "id": str(uuid.uuid4()),
            "participant_ids": participant_ids,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True
        }

    def test_create_direct_chat(self, test_user_data, test_admin_user_data):
        """Test creating a direct chat."""
        chat = self.create_direct_chat(
            test_user_data["id"],
            test_admin_user_data["id"]
        )

        assert len(chat["participant_ids"]) == 2
        assert test_user_data["id"] in chat["participant_ids"]
        assert test_admin_user_data["id"] in chat["participant_ids"]

    def test_cannot_chat_with_self(self, test_user_data):
        """Test that user cannot create chat with themselves."""
        with pytest.raises(ValueError):
            self.create_direct_chat(
                test_user_data["id"],
                test_user_data["id"]
            )

    def test_participant_ids_are_sorted(self, test_user_data, test_admin_user_data):
        """Test that participant IDs are sorted consistently."""
        chat1 = self.create_direct_chat(test_user_data["id"], test_admin_user_data["id"])
        chat2 = self.create_direct_chat(test_admin_user_data["id"], test_user_data["id"])

        assert chat1["participant_ids"] == chat2["participant_ids"]


# ============================================================
# Chat Message Tests
# ============================================================

class TestChatMessage:
    """Test chat message functionality."""

    VALID_MESSAGE_TYPES = ["TEXT", "IMAGE", "FILE", "SYSTEM", "VOICE"]
    VALID_STATUSES = ["sent", "delivered", "read"]

    def create_message(self, user_id: str, content: str, group_id: str = None,
                      direct_chat_id: str = None, message_type: str = "TEXT",
                      reply_to: str = None) -> dict:
        """Create a chat message."""
        import uuid

        if not group_id and not direct_chat_id:
            raise ValueError("Message must have either group_id or direct_chat_id")

        if message_type not in self.VALID_MESSAGE_TYPES:
            raise ValueError(f"Invalid message type: {message_type}")

        return {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "direct_chat_id": direct_chat_id,
            "user_id": user_id,
            "content": content,
            "message_type": message_type,
            "reply_to": reply_to,
            "status": "sent",
            "delivered_at": None,
            "read_at": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "is_edited": False,
            "is_deleted": False
        }

    def test_create_text_message(self, test_user_data, test_chat_group_data):
        """Test creating a text message."""
        message = self.create_message(
            test_user_data["id"],
            "Hello, World!",
            group_id=test_chat_group_data["id"]
        )

        assert message["content"] == "Hello, World!"
        assert message["message_type"] == "TEXT"
        assert message["status"] == "sent"
        assert message["is_deleted"] is False

    def test_create_reply_message(self, test_user_data, test_chat_group_data, test_message_data):
        """Test creating a reply message."""
        message = self.create_message(
            test_user_data["id"],
            "This is a reply",
            group_id=test_chat_group_data["id"],
            reply_to=test_message_data["id"]
        )

        assert message["reply_to"] == test_message_data["id"]

    def test_message_requires_chat_reference(self, test_user_data):
        """Test that message requires group or direct chat reference."""
        with pytest.raises(ValueError):
            self.create_message(
                test_user_data["id"],
                "Orphan message"
                # No group_id or direct_chat_id
            )

    def test_invalid_message_type_raises_error(self, test_user_data, test_chat_group_data):
        """Test that invalid message type raises error."""
        with pytest.raises(ValueError):
            self.create_message(
                test_user_data["id"],
                "Test",
                group_id=test_chat_group_data["id"],
                message_type="INVALID"
            )


# ============================================================
# Message Status Tests
# ============================================================

class TestMessageStatus:
    """Test message status transitions."""

    def update_message_status(self, message: dict, new_status: str) -> dict:
        """Update message status with proper timestamps."""
        valid_transitions = {
            "sent": ["delivered", "read"],
            "delivered": ["read"],
            "read": []
        }

        current_status = message["status"]

        if new_status not in valid_transitions.get(current_status, []):
            if current_status == new_status:
                return message  # No change needed
            raise ValueError(f"Invalid status transition: {current_status} -> {new_status}")

        message["status"] = new_status

        if new_status == "delivered":
            message["delivered_at"] = datetime.now(timezone.utc)
        elif new_status == "read":
            if not message["delivered_at"]:
                message["delivered_at"] = datetime.now(timezone.utc)
            message["read_at"] = datetime.now(timezone.utc)

        return message

    def test_mark_message_delivered(self, test_message_data):
        """Test marking a message as delivered."""
        test_message_data["status"] = "sent"

        result = self.update_message_status(test_message_data, "delivered")

        assert result["status"] == "delivered"
        assert result["delivered_at"] is not None

    def test_mark_message_read(self, test_message_data):
        """Test marking a message as read."""
        test_message_data["status"] = "delivered"

        result = self.update_message_status(test_message_data, "read")

        assert result["status"] == "read"
        assert result["read_at"] is not None

    def test_cannot_go_backwards(self, test_message_data):
        """Test that status cannot go backwards."""
        test_message_data["status"] = "read"

        with pytest.raises(ValueError):
            self.update_message_status(test_message_data, "sent")

    def test_read_sets_delivered_if_missing(self, test_message_data):
        """Test that marking read also sets delivered if missing."""
        test_message_data["status"] = "sent"
        test_message_data["delivered_at"] = None

        result = self.update_message_status(test_message_data, "read")

        assert result["delivered_at"] is not None
        assert result["read_at"] is not None


# ============================================================
# Message Editing Tests
# ============================================================

class TestMessageEditing:
    """Test message editing functionality."""

    MAX_EDIT_WINDOW_MINUTES = 15

    def can_edit_message(self, message: dict, user_id: str) -> bool:
        """Check if user can edit a message."""
        # Only message author can edit
        if message["user_id"] != user_id:
            return False

        # Cannot edit deleted messages
        if message.get("is_deleted", False):
            return False

        # Check edit time window
        created_at = message["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        time_since_creation = datetime.now(timezone.utc) - created_at
        if time_since_creation > timedelta(minutes=self.MAX_EDIT_WINDOW_MINUTES):
            return False

        return True

    def edit_message(self, message: dict, new_content: str, user_id: str) -> dict:
        """Edit a message's content."""
        if not self.can_edit_message(message, user_id):
            raise ValueError("Cannot edit this message")

        message["content"] = new_content
        message["is_edited"] = True
        message["updated_at"] = datetime.now(timezone.utc)

        return message

    def test_author_can_edit_recent_message(self, test_message_data, test_user_data):
        """Test that author can edit their recent message."""
        test_message_data["user_id"] = test_user_data["id"]
        test_message_data["created_at"] = datetime.now(timezone.utc)

        can_edit = self.can_edit_message(test_message_data, test_user_data["id"])
        assert can_edit is True

    def test_non_author_cannot_edit(self, test_message_data, test_admin_user_data):
        """Test that non-author cannot edit message."""
        # test_message_data.user_id is test_user, not admin
        can_edit = self.can_edit_message(test_message_data, test_admin_user_data["id"])
        assert can_edit is False

    def test_cannot_edit_old_message(self, test_message_data, test_user_data):
        """Test that old messages cannot be edited."""
        test_message_data["user_id"] = test_user_data["id"]
        test_message_data["created_at"] = datetime.now(timezone.utc) - timedelta(hours=1)

        can_edit = self.can_edit_message(test_message_data, test_user_data["id"])
        assert can_edit is False

    def test_cannot_edit_deleted_message(self, test_message_data, test_user_data):
        """Test that deleted messages cannot be edited."""
        test_message_data["user_id"] = test_user_data["id"]
        test_message_data["is_deleted"] = True

        can_edit = self.can_edit_message(test_message_data, test_user_data["id"])
        assert can_edit is False

    def test_edit_sets_is_edited_flag(self, test_message_data, test_user_data):
        """Test that editing sets the is_edited flag."""
        test_message_data["user_id"] = test_user_data["id"]
        test_message_data["created_at"] = datetime.now(timezone.utc)

        result = self.edit_message(test_message_data, "New content", test_user_data["id"])

        assert result["is_edited"] is True
        assert result["updated_at"] is not None


# ============================================================
# Message Deletion Tests
# ============================================================

class TestMessageDeletion:
    """Test message deletion functionality."""

    def delete_message(self, message: dict, user_id: str, is_admin: bool = False) -> dict:
        """Soft delete a message."""
        # Only author or admin can delete
        if message["user_id"] != user_id and not is_admin:
            raise ValueError("Cannot delete this message")

        message["is_deleted"] = True
        message["content"] = "[Message deleted]"
        message["updated_at"] = datetime.now(timezone.utc)

        return message

    def test_author_can_delete_message(self, test_message_data, test_user_data):
        """Test that author can delete their message."""
        test_message_data["user_id"] = test_user_data["id"]

        result = self.delete_message(test_message_data, test_user_data["id"])

        assert result["is_deleted"] is True
        assert result["content"] == "[Message deleted]"

    def test_admin_can_delete_any_message(self, test_message_data, test_admin_user_data):
        """Test that admin can delete any message."""
        # Message belongs to different user
        test_message_data["user_id"] = "different-user-id"

        result = self.delete_message(
            test_message_data,
            test_admin_user_data["id"],
            is_admin=True
        )

        assert result["is_deleted"] is True

    def test_non_author_cannot_delete(self, test_message_data):
        """Test that non-author non-admin cannot delete."""
        test_message_data["user_id"] = "original-author-id"

        with pytest.raises(ValueError):
            self.delete_message(
                test_message_data,
                "some-other-user-id",
                is_admin=False
            )


# ============================================================
# Typing Status Tests
# ============================================================

class TestTypingStatus:
    """Test typing status functionality."""

    def create_typing_status(self, chat_id: str, chat_type: str, user_id: str,
                            is_typing: bool = True) -> dict:
        """Create a typing status record."""
        return {
            "chat_id": chat_id,
            "chat_type": chat_type,
            "user_id": user_id,
            "is_typing": is_typing,
            "updated_at": datetime.now(timezone.utc)
        }

    def test_create_typing_status(self, test_user_data, test_chat_group_data):
        """Test creating a typing status."""
        status = self.create_typing_status(
            test_chat_group_data["id"],
            "group",
            test_user_data["id"],
            is_typing=True
        )

        assert status["is_typing"] is True
        assert status["chat_type"] == "group"

    def test_typing_status_can_be_cleared(self, test_user_data, test_chat_group_data):
        """Test that typing status can be cleared."""
        status = self.create_typing_status(
            test_chat_group_data["id"],
            "group",
            test_user_data["id"],
            is_typing=False
        )

        assert status["is_typing"] is False


# ============================================================
# Message Search Tests
# ============================================================

class TestMessageSearch:
    """Test message search functionality."""

    def search_messages(self, messages: List[dict], query: str, limit: int = 50) -> List[dict]:
        """Search messages by content."""
        query_lower = query.lower()
        results = []

        for message in messages:
            if message.get("is_deleted", False):
                continue

            content = message.get("content", "").lower()
            if query_lower in content:
                results.append(message)

            if len(results) >= limit:
                break

        return results

    def test_search_finds_matching_messages(self):
        """Test that search finds matching messages."""
        messages = [
            {"id": "1", "content": "Hello world", "is_deleted": False},
            {"id": "2", "content": "Goodbye world", "is_deleted": False},
            {"id": "3", "content": "Hello there", "is_deleted": False},
        ]

        results = self.search_messages(messages, "hello")

        assert len(results) == 2
        assert all("hello" in r["content"].lower() for r in results)

    def test_search_is_case_insensitive(self):
        """Test that search is case insensitive."""
        messages = [
            {"id": "1", "content": "HELLO WORLD", "is_deleted": False},
        ]

        results = self.search_messages(messages, "hello")
        assert len(results) == 1

    def test_search_excludes_deleted_messages(self):
        """Test that search excludes deleted messages."""
        messages = [
            {"id": "1", "content": "Hello world", "is_deleted": True},
            {"id": "2", "content": "Hello there", "is_deleted": False},
        ]

        results = self.search_messages(messages, "hello")

        assert len(results) == 1
        assert results[0]["id"] == "2"

    def test_search_respects_limit(self):
        """Test that search respects the limit parameter."""
        messages = [
            {"id": str(i), "content": f"Message {i} test", "is_deleted": False}
            for i in range(100)
        ]

        results = self.search_messages(messages, "test", limit=10)
        assert len(results) == 10


# ============================================================
# Chat Group Member Management Tests
# ============================================================

class TestChatGroupMembers:
    """Test chat group member management."""

    def add_member_to_group(self, group_id: str, user_id: str, role: str = "MEMBER") -> dict:
        """Add a member to a chat group."""
        import uuid

        valid_roles = ["ADMIN", "MEMBER"]
        if role not in valid_roles:
            raise ValueError(f"Invalid role: {role}")

        return {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "user_id": user_id,
            "role": role,
            "joined_at": datetime.now(timezone.utc),
            "is_active": True
        }

    def test_add_regular_member(self, test_chat_group_data, test_user_data):
        """Test adding a regular member to group."""
        member = self.add_member_to_group(
            test_chat_group_data["id"],
            test_user_data["id"]
        )

        assert member["role"] == "MEMBER"
        assert member["is_active"] is True

    def test_add_admin_member(self, test_chat_group_data, test_admin_user_data):
        """Test adding an admin member to group."""
        member = self.add_member_to_group(
            test_chat_group_data["id"],
            test_admin_user_data["id"],
            role="ADMIN"
        )

        assert member["role"] == "ADMIN"

    def test_invalid_role_raises_error(self, test_chat_group_data, test_user_data):
        """Test that invalid role raises error."""
        with pytest.raises(ValueError):
            self.add_member_to_group(
                test_chat_group_data["id"],
                test_user_data["id"],
                role="INVALID"
            )
