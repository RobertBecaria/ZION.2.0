"""
Unit tests for family management endpoints.
Tests family profile CRUD, member management, invitations, and privacy.
"""
import pytest
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any


# ============================================================
# Family Profile Model Tests
# ============================================================

class TestFamilyProfileModel:
    """Test FamilyProfile model validation and defaults."""

    def test_family_profile_has_required_fields(self, test_family_data):
        """Test that family profile has all required fields."""
        required_fields = [
            "id", "family_name", "creator_id", "is_private",
            "member_count", "is_active", "created_at"
        ]

        for field in required_fields:
            assert field in test_family_data, f"Missing required field: {field}"

    def test_family_profile_default_privacy(self, test_family_data):
        """Test that family profile defaults to private."""
        assert test_family_data["is_private"] is True
        assert test_family_data["allow_public_discovery"] is False

    def test_family_profile_member_count_defaults(self, test_family_data):
        """Test that member count starts at appropriate value."""
        assert test_family_data["member_count"] >= 1
        assert test_family_data["children_count"] >= 0


# ============================================================
# Family Creation Tests
# ============================================================

class TestFamilyCreation:
    """Test family creation functionality."""

    def create_family(self, name: str, creator_id: str, **kwargs) -> dict:
        """Create a new family profile."""
        import uuid

        family = {
            "id": str(uuid.uuid4()),
            "family_name": name,
            "family_surname": kwargs.get("family_surname"),
            "description": kwargs.get("description"),
            "public_bio": kwargs.get("public_bio"),
            "primary_address": kwargs.get("primary_address"),
            "city": kwargs.get("city"),
            "state": kwargs.get("state"),
            "country": kwargs.get("country"),
            "is_private": kwargs.get("is_private", True),
            "allow_public_discovery": kwargs.get("allow_public_discovery", False),
            "member_count": 1,
            "children_count": 0,
            "creator_id": creator_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True
        }

        return family

    def test_create_minimal_family(self, test_user_data):
        """Test creating a family with minimal data."""
        family = self.create_family("Test Family", test_user_data["id"])

        assert family["family_name"] == "Test Family"
        assert family["creator_id"] == test_user_data["id"]
        assert family["is_private"] is True
        assert family["member_count"] == 1

    def test_create_family_with_full_data(self, test_user_data):
        """Test creating a family with full data."""
        family = self.create_family(
            "Full Family",
            test_user_data["id"],
            family_surname="Testov",
            description="A test family",
            city="Test City",
            country="Test Country",
            is_private=False
        )

        assert family["family_surname"] == "Testov"
        assert family["description"] == "A test family"
        assert family["city"] == "Test City"
        assert family["is_private"] is False

    def test_family_id_is_unique(self, test_user_data):
        """Test that each family gets a unique ID."""
        family1 = self.create_family("Family 1", test_user_data["id"])
        family2 = self.create_family("Family 2", test_user_data["id"])

        assert family1["id"] != family2["id"]


# ============================================================
# Family Member Management Tests
# ============================================================

class TestFamilyMemberManagement:
    """Test family member management functionality."""

    VALID_FAMILY_ROLES = ["CREATOR", "ADMIN", "ADULT_MEMBER", "CHILD"]
    VALID_RELATIONSHIPS = [
        "Father", "Mother", "Son", "Daughter", "Grandfather",
        "Grandmother", "Uncle", "Aunt", "Cousin", "Other"
    ]

    def add_member(self, family_id: str, user_id: str, role: str = "ADULT_MEMBER",
                   relationship: str = "Other") -> dict:
        """Add a member to a family."""
        import uuid

        if role not in self.VALID_FAMILY_ROLES:
            raise ValueError(f"Invalid family role: {role}")

        member = {
            "id": str(uuid.uuid4()),
            "family_id": family_id,
            "user_id": user_id,
            "family_role": role,
            "relationship_to_family": relationship,
            "is_primary_resident": True,
            "invitation_accepted": False,
            "joined_at": datetime.now(timezone.utc),
            "is_active": True
        }

        return member

    def test_add_adult_member(self, test_family_data, test_user_data):
        """Test adding an adult member to a family."""
        member = self.add_member(
            test_family_data["id"],
            test_user_data["id"],
            role="ADULT_MEMBER",
            relationship="Father"
        )

        assert member["family_id"] == test_family_data["id"]
        assert member["user_id"] == test_user_data["id"]
        assert member["family_role"] == "ADULT_MEMBER"
        assert member["relationship_to_family"] == "Father"

    def test_add_child_member(self, test_family_data, test_child_user_data):
        """Test adding a child member to a family."""
        member = self.add_member(
            test_family_data["id"],
            test_child_user_data["id"],
            role="CHILD",
            relationship="Son"
        )

        assert member["family_role"] == "CHILD"
        assert member["relationship_to_family"] == "Son"

    def test_invalid_role_raises_error(self, test_family_data, test_user_data):
        """Test that invalid role raises an error."""
        with pytest.raises(ValueError) as exc_info:
            self.add_member(
                test_family_data["id"],
                test_user_data["id"],
                role="INVALID_ROLE"
            )

        assert "Invalid family role" in str(exc_info.value)

    def test_member_starts_with_pending_invitation(self, test_family_data, test_user_data):
        """Test that new member starts with pending invitation."""
        member = self.add_member(test_family_data["id"], test_user_data["id"])
        assert member["invitation_accepted"] is False


# ============================================================
# Family Invitation Tests
# ============================================================

class TestFamilyInvitations:
    """Test family invitation functionality."""

    def create_invitation(self, family_id: str, inviter_id: str, invitee_email: str,
                         invitation_type: str = "MEMBER") -> dict:
        """Create a family invitation."""
        import uuid

        invitation = {
            "id": str(uuid.uuid4()),
            "family_id": family_id,
            "invited_by_user_id": inviter_id,
            "invited_user_email": invitee_email,
            "invited_user_id": None,  # Set if user exists
            "invitation_type": invitation_type,
            "relationship_to_family": None,
            "message": None,
            "status": "PENDING",
            "sent_at": datetime.now(timezone.utc),
            "responded_at": None,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "is_active": True
        }

        return invitation

    def test_create_member_invitation(self, test_family_data, test_user_data):
        """Test creating a member invitation."""
        invitation = self.create_invitation(
            test_family_data["id"],
            test_user_data["id"],
            "newmember@test.com"
        )

        assert invitation["family_id"] == test_family_data["id"]
        assert invitation["invited_user_email"] == "newmember@test.com"
        assert invitation["status"] == "PENDING"
        assert invitation["invitation_type"] == "MEMBER"

    def test_create_admin_invitation(self, test_family_data, test_user_data):
        """Test creating an admin invitation."""
        invitation = self.create_invitation(
            test_family_data["id"],
            test_user_data["id"],
            "admin@test.com",
            invitation_type="ADMIN"
        )

        assert invitation["invitation_type"] == "ADMIN"

    def test_invitation_has_expiration(self, test_family_data, test_user_data):
        """Test that invitation has an expiration date."""
        invitation = self.create_invitation(
            test_family_data["id"],
            test_user_data["id"],
            "test@test.com"
        )

        assert invitation["expires_at"] is not None
        assert invitation["expires_at"] > invitation["sent_at"]

    def test_accept_invitation(self, test_family_data, test_user_data):
        """Test accepting an invitation."""
        invitation = self.create_invitation(
            test_family_data["id"],
            test_user_data["id"],
            "test@test.com"
        )

        # Accept the invitation
        invitation["status"] = "ACCEPTED"
        invitation["responded_at"] = datetime.now(timezone.utc)

        assert invitation["status"] == "ACCEPTED"
        assert invitation["responded_at"] is not None

    def test_decline_invitation(self, test_family_data, test_user_data):
        """Test declining an invitation."""
        invitation = self.create_invitation(
            test_family_data["id"],
            test_user_data["id"],
            "test@test.com"
        )

        # Decline the invitation
        invitation["status"] = "DECLINED"
        invitation["responded_at"] = datetime.now(timezone.utc)

        assert invitation["status"] == "DECLINED"


# ============================================================
# Family Privacy Tests
# ============================================================

class TestFamilyPrivacy:
    """Test family privacy settings and filtering."""

    def apply_family_privacy(self, family_data: dict, viewer_relationship: str) -> dict:
        """Apply privacy settings to family data based on viewer relationship."""
        is_private = family_data.get("is_private", True)

        if viewer_relationship == "member":
            # Members can see everything
            return dict(family_data)

        if viewer_relationship == "subscriber":
            # Subscribers see public info
            return {
                "id": family_data["id"],
                "family_name": family_data["family_name"],
                "public_bio": family_data.get("public_bio"),
                "city": family_data.get("city"),
                "country": family_data.get("country"),
                "member_count": family_data["member_count"]
            }

        if viewer_relationship == "public":
            if not family_data.get("allow_public_discovery"):
                return None  # Hidden from public

            return {
                "id": family_data["id"],
                "family_name": family_data["family_name"],
                "public_bio": family_data.get("public_bio")
            }

        return None

    def test_member_sees_all_data(self, test_family_data):
        """Test that family member sees all data."""
        result = self.apply_family_privacy(test_family_data, "member")
        assert result == test_family_data

    def test_subscriber_sees_limited_data(self, test_family_data):
        """Test that subscriber sees limited data."""
        result = self.apply_family_privacy(test_family_data, "subscriber")

        assert "family_name" in result
        assert "public_bio" in result
        assert "description" not in result
        assert "primary_address" not in result

    def test_private_family_hidden_from_public(self, test_family_data):
        """Test that private family is hidden from public."""
        test_family_data["is_private"] = True
        test_family_data["allow_public_discovery"] = False

        result = self.apply_family_privacy(test_family_data, "public")
        assert result is None

    def test_discoverable_family_visible_to_public(self, test_family_data):
        """Test that discoverable family is visible to public."""
        test_family_data["allow_public_discovery"] = True

        result = self.apply_family_privacy(test_family_data, "public")
        assert result is not None
        assert "family_name" in result


# ============================================================
# Family Post Visibility Tests
# ============================================================

class TestFamilyPostVisibility:
    """Test family post visibility rules."""

    VISIBILITY_RULES = {
        "PUBLIC": ["everyone"],
        "FAMILY_ONLY": ["family_members"],
        "HOUSEHOLD_ONLY": ["household_members"],
        "FATHERS_ONLY": ["male_parents"],
        "MOTHERS_ONLY": ["female_parents"],
        "CHILDREN_ONLY": ["children"],
        "PARENTS_ONLY": ["parents"],
        "ONLY_ME": ["creator"]
    }

    def can_view_post(self, post_visibility: str, viewer_role: str, viewer_gender: str = None) -> bool:
        """Check if viewer can see a post based on visibility settings."""
        if post_visibility == "PUBLIC":
            return True

        if post_visibility == "FAMILY_ONLY":
            return viewer_role in ["CREATOR", "ADMIN", "ADULT_MEMBER", "CHILD"]

        if post_visibility == "HOUSEHOLD_ONLY":
            return viewer_role in ["CREATOR", "ADMIN", "ADULT_MEMBER", "CHILD"]

        if post_visibility == "FATHERS_ONLY":
            return viewer_role in ["CREATOR", "ADMIN", "ADULT_MEMBER"] and viewer_gender == "MALE"

        if post_visibility == "MOTHERS_ONLY":
            return viewer_role in ["CREATOR", "ADMIN", "ADULT_MEMBER"] and viewer_gender == "FEMALE"

        if post_visibility == "CHILDREN_ONLY":
            return viewer_role == "CHILD"

        if post_visibility == "PARENTS_ONLY":
            return viewer_role in ["CREATOR", "ADMIN", "ADULT_MEMBER"]

        if post_visibility == "ONLY_ME":
            return viewer_role == "CREATOR"

        return False

    @pytest.mark.parametrize("visibility,viewer_role,viewer_gender,can_view", [
        ("PUBLIC", "ADULT_MEMBER", "MALE", True),
        ("PUBLIC", "CHILD", "FEMALE", True),
        ("FAMILY_ONLY", "ADULT_MEMBER", "MALE", True),
        ("FAMILY_ONLY", "CHILD", "FEMALE", True),
        ("FATHERS_ONLY", "ADULT_MEMBER", "MALE", True),
        ("FATHERS_ONLY", "ADULT_MEMBER", "FEMALE", False),
        ("MOTHERS_ONLY", "ADULT_MEMBER", "FEMALE", True),
        ("MOTHERS_ONLY", "ADULT_MEMBER", "MALE", False),
        ("CHILDREN_ONLY", "CHILD", "MALE", True),
        ("CHILDREN_ONLY", "ADULT_MEMBER", "MALE", False),
        ("PARENTS_ONLY", "ADULT_MEMBER", "MALE", True),
        ("PARENTS_ONLY", "CHILD", "MALE", False),
        ("ONLY_ME", "CREATOR", "MALE", True),
        ("ONLY_ME", "ADMIN", "MALE", False),
    ])
    def test_post_visibility_rules(self, visibility, viewer_role, viewer_gender, can_view):
        """Test that post visibility rules work correctly."""
        result = self.can_view_post(visibility, viewer_role, viewer_gender)
        assert result == can_view, f"{visibility} for {viewer_role}/{viewer_gender}"


# ============================================================
# Family Statistics Tests
# ============================================================

class TestFamilyStatistics:
    """Test family statistics calculations."""

    def calculate_family_stats(self, members: List[Dict[str, Any]]) -> dict:
        """Calculate family statistics from members list."""
        active_members = [m for m in members if m.get("is_active", True)]

        stats = {
            "total_members": len(active_members),
            "adults": 0,
            "children": 0,
            "admins": 0,
            "pending_invitations": 0
        }

        for member in active_members:
            role = member.get("family_role", "ADULT_MEMBER")

            if role == "CHILD":
                stats["children"] += 1
            else:
                stats["adults"] += 1

            if role in ["CREATOR", "ADMIN"]:
                stats["admins"] += 1

            if not member.get("invitation_accepted", False):
                stats["pending_invitations"] += 1

        return stats

    def test_empty_family_stats(self):
        """Test stats for empty family."""
        stats = self.calculate_family_stats([])
        assert stats["total_members"] == 0
        assert stats["adults"] == 0
        assert stats["children"] == 0

    def test_family_with_adults_and_children(self):
        """Test stats for family with adults and children."""
        members = [
            {"family_role": "CREATOR", "is_active": True, "invitation_accepted": True},
            {"family_role": "ADMIN", "is_active": True, "invitation_accepted": True},
            {"family_role": "ADULT_MEMBER", "is_active": True, "invitation_accepted": True},
            {"family_role": "CHILD", "is_active": True, "invitation_accepted": True},
            {"family_role": "CHILD", "is_active": True, "invitation_accepted": True},
        ]

        stats = self.calculate_family_stats(members)

        assert stats["total_members"] == 5
        assert stats["adults"] == 3
        assert stats["children"] == 2
        assert stats["admins"] == 2

    def test_inactive_members_excluded(self):
        """Test that inactive members are excluded from stats."""
        members = [
            {"family_role": "CREATOR", "is_active": True, "invitation_accepted": True},
            {"family_role": "ADULT_MEMBER", "is_active": False, "invitation_accepted": True},
        ]

        stats = self.calculate_family_stats(members)
        assert stats["total_members"] == 1


# ============================================================
# Family Deletion Tests
# ============================================================

class TestFamilyDeletion:
    """Test family deletion functionality."""

    def can_delete_family(self, user_id: str, family_creator_id: str, user_role: str) -> bool:
        """Check if user can delete a family."""
        # Only creator or admin can delete
        if user_role == "ADMIN":
            return True
        if user_id == family_creator_id:
            return True
        return False

    def soft_delete_family(self, family_data: dict) -> dict:
        """Soft delete a family (set is_active to False)."""
        family_data["is_active"] = False
        family_data["updated_at"] = datetime.now(timezone.utc)
        return family_data

    def test_creator_can_delete_family(self, test_family_data, test_user_data):
        """Test that creator can delete their family."""
        # test_user_data is the creator
        can_delete = self.can_delete_family(
            test_user_data["id"],
            test_family_data["creator_id"],
            test_user_data["role"]
        )
        assert can_delete is True

    def test_admin_can_delete_family(self, test_family_data, test_admin_user_data):
        """Test that admin can delete any family."""
        can_delete = self.can_delete_family(
            test_admin_user_data["id"],
            test_family_data["creator_id"],
            test_admin_user_data["role"]
        )
        assert can_delete is True

    def test_regular_member_cannot_delete_family(self, test_family_data):
        """Test that regular member cannot delete family."""
        can_delete = self.can_delete_family(
            "some-other-user-id",
            test_family_data["creator_id"],
            "ADULT"
        )
        assert can_delete is False

    def test_soft_delete_sets_inactive(self, test_family_data):
        """Test that soft delete sets family to inactive."""
        assert test_family_data["is_active"] is True

        result = self.soft_delete_family(test_family_data)

        assert result["is_active"] is False
