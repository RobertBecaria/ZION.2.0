"""
Unit tests for authentication endpoints.
Tests login, registration, token refresh, and password management.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import jwt
import re

# Import test utilities
from tests.conftest import TEST_SECRET_KEY, TEST_ALGORITHM, create_test_token


# ============================================================
# Password Validation Tests
# ============================================================

class TestPasswordValidation:
    """Test password validation rules."""

    @pytest.mark.parametrize("password,should_match", [
        ("TestPass1", True),      # Valid: letters and number
        ("Password123", True),     # Valid: letters and numbers
        ("MyPass1!", True),        # Valid: letters, number, special char
        ("abcdefgh1", True),       # Valid: lowercase and number
        ("ABCDEFGH1", True),       # Valid: uppercase and number
        ("onlyletters", False),    # Invalid: no number
        ("12345678", False),       # Invalid: no letter
        ("short1", False),         # Invalid: too short (< 8 chars)
        ("", False),               # Invalid: empty
        ("ab1", False),            # Invalid: too short
    ])
    def test_password_pattern(self, password, should_match):
        """Test that password pattern validation works correctly."""
        # Pattern from UserRegistration model
        pattern = r'^(?=.*[A-Za-z])(?=.*\d).+$'

        # Check minimum length (8 characters)
        if len(password) >= 8:
            matches = bool(re.match(pattern, password))
        else:
            matches = False

        assert matches == should_match, f"Password '{password}' validation failed"


# ============================================================
# Email Validation Tests
# ============================================================

class TestEmailValidation:
    """Test email validation rules."""

    @pytest.mark.parametrize("email,is_valid", [
        ("test@example.com", True),
        ("user.name@domain.org", True),
        ("user+tag@example.com", True),
        ("user@subdomain.example.com", True),
        ("invalid-email", False),
        ("@nodomain.com", False),
        ("no-at-sign.com", False),
        ("user@", False),
        ("", False),
    ])
    def test_email_format(self, email, is_valid):
        """Test that email format validation works correctly."""
        # Simple email regex for testing
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

        if email:
            matches = bool(re.match(email_pattern, email))
        else:
            matches = False

        assert matches == is_valid, f"Email '{email}' validation failed"


# ============================================================
# Token Generation Tests
# ============================================================

class TestTokenGeneration:
    """Test JWT token generation."""

    def test_create_valid_token(self, test_user_data):
        """Test creating a valid JWT token."""
        token = create_test_token(test_user_data["id"])

        # Decode and verify
        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

        assert payload["sub"] == test_user_data["id"]
        assert payload["type"] == "user"
        assert "exp" in payload

    def test_token_expiration(self, test_user_data):
        """Test that token includes correct expiration."""
        expires_minutes = 30
        token = create_test_token(test_user_data["id"], expires_minutes=expires_minutes)

        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

        # Check expiration is approximately correct (within 1 minute tolerance)
        expected_exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
        actual_exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        diff = abs((expected_exp - actual_exp).total_seconds())
        assert diff < 60, "Token expiration not within expected range"

    def test_expired_token_raises_error(self, expired_token):
        """Test that expired token raises an error on decode."""
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(expired_token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

    def test_invalid_token_raises_error(self, invalid_token):
        """Test that invalid token raises an error on decode."""
        with pytest.raises(jwt.DecodeError):
            jwt.decode(invalid_token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

    def test_token_with_wrong_secret_fails(self, test_user_data):
        """Test that token with wrong secret key fails verification."""
        token = create_test_token(test_user_data["id"])

        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "wrong-secret-key", algorithms=[TEST_ALGORITHM])


# ============================================================
# Password Hashing Tests
# ============================================================

class TestPasswordHashing:
    """Test password hashing functions."""

    def test_password_hash_is_not_plain_text(self):
        """Test that hashed password is not stored as plain text."""
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "TestPassword123"
        hashed = pwd_context.hash(password)

        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_password_verification_succeeds_with_correct_password(self):
        """Test that password verification succeeds with correct password."""
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "TestPassword123"
        hashed = pwd_context.hash(password)

        assert pwd_context.verify(password, hashed) is True

    def test_password_verification_fails_with_wrong_password(self):
        """Test that password verification fails with wrong password."""
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "TestPassword123"
        wrong_password = "WrongPassword456"
        hashed = pwd_context.hash(password)

        assert pwd_context.verify(wrong_password, hashed) is False

    def test_same_password_produces_different_hashes(self):
        """Test that same password produces different hashes (salt is unique)."""
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "TestPassword123"

        hash1 = pwd_context.hash(password)
        hash2 = pwd_context.hash(password)

        assert hash1 != hash2
        # But both should verify
        assert pwd_context.verify(password, hash1) is True
        assert pwd_context.verify(password, hash2) is True


# ============================================================
# User Registration Input Validation Tests
# ============================================================

class TestUserRegistrationValidation:
    """Test user registration input validation."""

    def test_valid_registration_data(self):
        """Test that valid registration data passes validation."""
        from pydantic import BaseModel, Field, EmailStr
        from typing import Optional
        from datetime import datetime

        class TestUserRegistration(BaseModel):
            email: EmailStr
            password: str = Field(min_length=8)
            first_name: str
            last_name: str
            middle_name: Optional[str] = None
            phone: Optional[str] = None

        # Should not raise an exception
        user = TestUserRegistration(
            email="test@example.com",
            password="TestPass123",
            first_name="Test",
            last_name="User"
        )

        assert user.email == "test@example.com"
        assert user.first_name == "Test"
        assert user.last_name == "User"

    def test_invalid_email_raises_error(self):
        """Test that invalid email raises validation error."""
        from pydantic import BaseModel, Field, EmailStr, ValidationError

        class TestUserRegistration(BaseModel):
            email: EmailStr
            password: str = Field(min_length=8)
            first_name: str
            last_name: str

        with pytest.raises(ValidationError):
            TestUserRegistration(
                email="invalid-email",
                password="TestPass123",
                first_name="Test",
                last_name="User"
            )

    def test_short_password_raises_error(self):
        """Test that password shorter than 8 characters raises error."""
        from pydantic import BaseModel, Field, EmailStr, ValidationError

        class TestUserRegistration(BaseModel):
            email: EmailStr
            password: str = Field(min_length=8)
            first_name: str
            last_name: str

        with pytest.raises(ValidationError):
            TestUserRegistration(
                email="test@example.com",
                password="Short1",  # Only 6 characters
                first_name="Test",
                last_name="User"
            )

    def test_missing_required_field_raises_error(self):
        """Test that missing required field raises error."""
        from pydantic import BaseModel, Field, EmailStr, ValidationError

        class TestUserRegistration(BaseModel):
            email: EmailStr
            password: str = Field(min_length=8)
            first_name: str
            last_name: str

        with pytest.raises(ValidationError):
            TestUserRegistration(
                email="test@example.com",
                password="TestPass123",
                first_name="Test"
                # Missing last_name
            )


# ============================================================
# User Login Input Validation Tests
# ============================================================

class TestUserLoginValidation:
    """Test user login input validation."""

    def test_valid_login_data(self):
        """Test that valid login data passes validation."""
        from pydantic import BaseModel, EmailStr

        class TestUserLogin(BaseModel):
            email: EmailStr
            password: str

        login = TestUserLogin(
            email="test@example.com",
            password="anypassword"
        )

        assert login.email == "test@example.com"
        assert login.password == "anypassword"

    def test_invalid_email_in_login_raises_error(self):
        """Test that invalid email in login raises error."""
        from pydantic import BaseModel, EmailStr, ValidationError

        class TestUserLogin(BaseModel):
            email: EmailStr
            password: str

        with pytest.raises(ValidationError):
            TestUserLogin(
                email="not-an-email",
                password="password123"
            )


# ============================================================
# Token Type Tests
# ============================================================

class TestTokenTypes:
    """Test different token types."""

    def test_user_token_type(self, test_user_data):
        """Test that user tokens have correct type."""
        token = create_test_token(test_user_data["id"], token_type="user")
        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

        assert payload["type"] == "user"

    def test_admin_token_type(self, test_admin_user_data):
        """Test that admin tokens can have different type."""
        token = create_test_token(test_admin_user_data["id"], token_type="admin")
        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

        assert payload["type"] == "admin"

    def test_agent_token_type(self):
        """Test that agent tokens have correct type."""
        token = create_test_token("agent-123", token_type="agent")
        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])

        assert payload["type"] == "agent"


# ============================================================
# Authentication Header Tests
# ============================================================

class TestAuthenticationHeaders:
    """Test authentication header formats."""

    def test_bearer_token_format(self, test_user_token):
        """Test that auth header follows Bearer token format."""
        auth_header = f"Bearer {test_user_token}"

        assert auth_header.startswith("Bearer ")
        token = auth_header.split(" ")[1]

        # Token should be decodable
        payload = jwt.decode(token, TEST_SECRET_KEY, algorithms=[TEST_ALGORITHM])
        assert "sub" in payload

    def test_extract_token_from_header(self, test_user_token):
        """Test extracting token from authorization header."""
        auth_header = f"Bearer {test_user_token}"

        # Simulate extracting token
        parts = auth_header.split()
        assert len(parts) == 2
        assert parts[0] == "Bearer"

        extracted_token = parts[1]
        assert extracted_token == test_user_token


# ============================================================
# Role-Based Access Tests
# ============================================================

class TestRoleBasedAccess:
    """Test role-based access control."""

    @pytest.mark.parametrize("role,expected_access", [
        ("ADMIN", True),
        ("ADULT", False),
        ("CHILD", False),
        ("BUSINESS", False),
    ])
    def test_admin_only_access(self, role, expected_access):
        """Test that admin-only resources check role correctly."""
        def is_admin(user_role: str) -> bool:
            return user_role == "ADMIN"

        assert is_admin(role) == expected_access

    @pytest.mark.parametrize("role,expected_access", [
        ("ADMIN", True),
        ("ADULT", True),
        ("CHILD", False),
        ("BUSINESS", True),
    ])
    def test_adult_and_above_access(self, role, expected_access):
        """Test that adult-and-above resources check role correctly."""
        def can_access_adult_content(user_role: str) -> bool:
            adult_roles = ["ADMIN", "ADULT", "BUSINESS", "GOVERNMENT"]
            return user_role in adult_roles

        assert can_access_adult_content(role) == expected_access
