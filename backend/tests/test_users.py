"""
Unit tests for user CRUD operations.
Tests user profile management, gender updates, and user search.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


# ============================================================
# User Model Tests
# ============================================================

class TestUserModel:
    """Test User model validation and defaults."""

    def test_user_has_required_fields(self, test_user_data):
        """Test that user has all required fields."""
        required_fields = [
            "id", "email", "password_hash", "first_name", "last_name",
            "role", "is_active", "is_verified", "created_at"
        ]

        for field in required_fields:
            assert field in test_user_data, f"Missing required field: {field}"

    def test_user_role_is_valid(self, test_user_data):
        """Test that user role is a valid value."""
        valid_roles = ["ADMIN", "FAMILY_ADMIN", "ADULT", "CHILD", "BUSINESS", "GOVERNMENT"]
        assert test_user_data["role"] in valid_roles

    def test_user_gender_is_valid(self, test_user_data):
        """Test that user gender is a valid value."""
        valid_genders = ["MALE", "FEMALE", "IT", None]
        assert test_user_data.get("gender") in valid_genders

    def test_user_email_format(self, test_user_data):
        """Test that user email is in valid format."""
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        assert re.match(email_pattern, test_user_data["email"]) is not None


# ============================================================
# User Response Model Tests
# ============================================================

class TestUserResponseModel:
    """Test UserResponse model for API responses."""

    def test_response_excludes_password_hash(self, test_user_data):
        """Test that password_hash is not included in response."""
        response_fields = [
            "id", "email", "first_name", "last_name", "middle_name",
            "role", "is_active", "is_verified", "created_at"
        ]

        # Simulate creating a response (excluding password_hash)
        response = {k: v for k, v in test_user_data.items() if k != "password_hash"}

        assert "password_hash" not in response
        for field in response_fields:
            assert field in response

    def test_response_includes_affiliations(self, test_user_data):
        """Test that response can include affiliations."""
        response = dict(test_user_data)
        response["affiliations"] = []
        response.pop("password_hash", None)

        assert "affiliations" in response
        assert isinstance(response["affiliations"], list)


# ============================================================
# Gender Update Tests
# ============================================================

class TestGenderUpdate:
    """Test gender update functionality."""

    @pytest.mark.parametrize("gender,is_valid", [
        ("MALE", True),
        ("FEMALE", True),
        ("IT", True),  # AI Agents, Smart Devices
        ("INVALID", False),
        ("male", False),  # Case sensitive
        ("", False),
        (None, False),
    ])
    def test_gender_value_validation(self, gender, is_valid):
        """Test that gender values are validated correctly."""
        valid_genders = {"MALE", "FEMALE", "IT"}
        result = gender in valid_genders if gender else False
        assert result == is_valid, f"Gender validation failed for '{gender}'"

    def test_gender_update_changes_value(self, test_user_data):
        """Test that gender update modifies the user data."""
        original_gender = test_user_data.get("gender")

        # Update gender
        test_user_data["gender"] = "FEMALE"

        assert test_user_data["gender"] != original_gender
        assert test_user_data["gender"] == "FEMALE"


# ============================================================
# Profile Completion Tests
# ============================================================

class TestProfileCompletion:
    """Test profile completion checks."""

    def calculate_profile_completion(self, user_data: dict) -> float:
        """Calculate profile completion percentage."""
        fields_to_check = [
            ("first_name", 10),
            ("last_name", 10),
            ("email", 10),
            ("gender", 10),
            ("date_of_birth", 10),
            ("phone", 10),
            ("address_street", 10),
            ("address_city", 10),
            ("address_country", 10),
            ("profile_picture", 10),
        ]

        total_weight = sum(weight for _, weight in fields_to_check)
        earned_weight = 0

        for field, weight in fields_to_check:
            if user_data.get(field):
                earned_weight += weight

        return (earned_weight / total_weight) * 100

    def test_complete_profile_is_100_percent(self):
        """Test that complete profile shows 100%."""
        complete_user = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "gender": "MALE",
            "date_of_birth": datetime.now(timezone.utc),
            "phone": "+1234567890",
            "address_street": "123 Main St",
            "address_city": "New York",
            "address_country": "USA",
            "profile_picture": "base64data..."
        }

        completion = self.calculate_profile_completion(complete_user)
        assert completion == 100.0

    def test_minimal_profile_is_partial(self):
        """Test that minimal profile shows partial completion."""
        minimal_user = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com"
        }

        completion = self.calculate_profile_completion(minimal_user)
        assert 0 < completion < 100
        assert completion == 30.0  # 3 fields * 10% each

    def test_empty_profile_is_zero(self):
        """Test that empty profile shows 0%."""
        empty_user = {}
        completion = self.calculate_profile_completion(empty_user)
        assert completion == 0.0


# ============================================================
# User Search Tests
# ============================================================

class TestUserSearch:
    """Test user search functionality."""

    def search_users(self, users: list, query: str) -> list:
        """Search users by name or email."""
        query_lower = query.lower()
        results = []

        for user in users:
            # Search in first_name, last_name, and email
            searchable = [
                user.get("first_name", "").lower(),
                user.get("last_name", "").lower(),
                user.get("email", "").lower(),
            ]

            if any(query_lower in field for field in searchable):
                results.append(user)

        return results

    def test_search_by_first_name(self, test_user_data):
        """Test searching users by first name."""
        users = [test_user_data]
        results = self.search_users(users, "Test")
        assert len(results) == 1
        assert results[0]["id"] == test_user_data["id"]

    def test_search_by_last_name(self, test_user_data):
        """Test searching users by last name."""
        users = [test_user_data]
        results = self.search_users(users, "User")
        assert len(results) == 1

    def test_search_by_email(self, test_user_data):
        """Test searching users by email."""
        users = [test_user_data]
        results = self.search_users(users, "testuser@")
        assert len(results) == 1

    def test_search_is_case_insensitive(self, test_user_data):
        """Test that search is case insensitive."""
        users = [test_user_data]

        results_lower = self.search_users(users, "test")
        results_upper = self.search_users(users, "TEST")
        results_mixed = self.search_users(users, "TeSt")

        assert len(results_lower) == len(results_upper) == len(results_mixed) == 1

    def test_search_returns_empty_for_no_match(self, test_user_data):
        """Test that search returns empty list for no match."""
        users = [test_user_data]
        results = self.search_users(users, "nonexistent")
        assert len(results) == 0


# ============================================================
# Privacy Settings Tests
# ============================================================

class TestPrivacySettings:
    """Test user privacy settings."""

    def apply_privacy_filter(self, user_data: dict, viewer_relationship: str) -> dict:
        """Apply privacy settings to user data based on viewer relationship."""
        privacy = user_data.get("privacy_settings", {})
        filtered = {"id": user_data["id"], "first_name": user_data["first_name"], "last_name": user_data["last_name"]}

        if viewer_relationship == "self":
            # User can see all their own data
            return dict(user_data)

        if viewer_relationship == "family":
            if privacy.get("family_visible_to_friends", True):
                filtered["address_city"] = user_data.get("address_city")
                filtered["phone"] = user_data.get("phone")

        if viewer_relationship == "public":
            if privacy.get("profile_visible_to_public", True):
                filtered["bio"] = user_data.get("bio")
            else:
                # Hide most info from public
                pass

        return filtered

    def test_self_can_see_all_data(self, test_user_data):
        """Test that user can see all their own data."""
        result = self.apply_privacy_filter(test_user_data, "self")
        assert result == test_user_data

    def test_family_sees_limited_data(self, test_user_data):
        """Test that family members see limited data based on privacy."""
        result = self.apply_privacy_filter(test_user_data, "family")

        assert "id" in result
        assert "first_name" in result
        assert "password_hash" not in result

    def test_public_sees_minimal_data(self, test_user_data):
        """Test that public sees minimal data."""
        result = self.apply_privacy_filter(test_user_data, "public")

        assert "id" in result
        assert "first_name" in result
        assert "password_hash" not in result


# ============================================================
# User Deactivation Tests
# ============================================================

class TestUserDeactivation:
    """Test user account deactivation."""

    def deactivate_user(self, user_data: dict) -> dict:
        """Deactivate a user account."""
        user_data["is_active"] = False
        user_data["updated_at"] = datetime.now(timezone.utc)
        return user_data

    def test_deactivation_sets_is_active_false(self, test_user_data):
        """Test that deactivation sets is_active to False."""
        assert test_user_data["is_active"] is True

        result = self.deactivate_user(test_user_data)

        assert result["is_active"] is False

    def test_deactivation_updates_timestamp(self, test_user_data):
        """Test that deactivation updates the timestamp."""
        original_updated = test_user_data.get("updated_at")

        result = self.deactivate_user(test_user_data)

        assert result["updated_at"] != original_updated
        assert result["updated_at"] > original_updated


# ============================================================
# User Role Hierarchy Tests
# ============================================================

class TestUserRoleHierarchy:
    """Test user role hierarchy and permissions."""

    ROLE_HIERARCHY = {
        "ADMIN": 100,
        "GOVERNMENT": 80,
        "BUSINESS": 60,
        "FAMILY_ADMIN": 50,
        "ADULT": 40,
        "CHILD": 10,
    }

    def get_role_level(self, role: str) -> int:
        """Get the numeric level for a role."""
        return self.ROLE_HIERARCHY.get(role, 0)

    def can_manage(self, manager_role: str, target_role: str) -> bool:
        """Check if manager role can manage target role."""
        return self.get_role_level(manager_role) > self.get_role_level(target_role)

    @pytest.mark.parametrize("manager_role,target_role,can_manage", [
        ("ADMIN", "ADULT", True),
        ("ADMIN", "CHILD", True),
        ("ADULT", "CHILD", True),
        ("CHILD", "ADULT", False),
        ("ADULT", "ADMIN", False),
        ("FAMILY_ADMIN", "ADULT", True),
        ("ADULT", "FAMILY_ADMIN", False),
    ])
    def test_role_management_permissions(self, manager_role, target_role, can_manage):
        """Test that role management follows hierarchy."""
        result = self.can_manage(manager_role, target_role)
        assert result == can_manage, f"{manager_role} managing {target_role}"


# ============================================================
# Profile Picture Validation Tests
# ============================================================

class TestProfilePictureValidation:
    """Test profile picture upload validation."""

    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
    ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

    def validate_profile_picture(self, file_data: dict) -> tuple:
        """Validate a profile picture upload.

        Returns: (is_valid, error_message)
        """
        # Check file size
        if file_data.get("size", 0) > self.MAX_IMAGE_SIZE:
            return False, "File size exceeds 5 MB limit"

        # Check MIME type
        mime_type = file_data.get("content_type", "")
        if mime_type not in self.ALLOWED_MIME_TYPES:
            return False, f"Invalid file type: {mime_type}"

        # Check dimensions (if provided)
        width = file_data.get("width", 0)
        height = file_data.get("height", 0)
        if width > 4096 or height > 4096:
            return False, "Image dimensions exceed 4096x4096"

        return True, None

    def test_valid_jpeg_image(self):
        """Test that valid JPEG image passes validation."""
        file_data = {
            "size": 1024 * 1024,  # 1 MB
            "content_type": "image/jpeg",
            "width": 800,
            "height": 600
        }

        is_valid, error = self.validate_profile_picture(file_data)
        assert is_valid is True
        assert error is None

    def test_oversized_image_rejected(self):
        """Test that oversized image is rejected."""
        file_data = {
            "size": 10 * 1024 * 1024,  # 10 MB
            "content_type": "image/jpeg"
        }

        is_valid, error = self.validate_profile_picture(file_data)
        assert is_valid is False
        assert "5 MB" in error

    def test_invalid_mime_type_rejected(self):
        """Test that invalid MIME type is rejected."""
        file_data = {
            "size": 1024,
            "content_type": "application/pdf"
        }

        is_valid, error = self.validate_profile_picture(file_data)
        assert is_valid is False
        assert "Invalid file type" in error

    def test_oversized_dimensions_rejected(self):
        """Test that oversized dimensions are rejected."""
        file_data = {
            "size": 1024,
            "content_type": "image/png",
            "width": 8000,
            "height": 6000
        }

        is_valid, error = self.validate_profile_picture(file_data)
        assert is_valid is False
        assert "dimensions" in error


# ============================================================
# Last Login Tracking Tests
# ============================================================

class TestLastLoginTracking:
    """Test last login timestamp tracking."""

    def update_last_login(self, user_data: dict) -> dict:
        """Update user's last login timestamp."""
        user_data["last_login"] = datetime.now(timezone.utc)
        return user_data

    def test_last_login_is_updated(self, test_user_data):
        """Test that last login is updated correctly."""
        original_login = test_user_data.get("last_login")

        result = self.update_last_login(test_user_data)

        assert result["last_login"] is not None
        if original_login:
            assert result["last_login"] >= original_login

    def test_last_login_is_utc(self, test_user_data):
        """Test that last login is in UTC timezone."""
        result = self.update_last_login(test_user_data)

        assert result["last_login"].tzinfo == timezone.utc
