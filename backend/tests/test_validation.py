"""
Unit tests for Pydantic model validation.
Tests input validation for various API request models.
"""
import pytest
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, EmailStr, ValidationError
from typing import Optional, List
from enum import Enum


# ============================================================
# User Registration Validation Tests
# ============================================================

class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    IT = "IT"


class UserRegistrationModel(BaseModel):
    """Test model matching server's UserRegistration."""
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    middle_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[Gender] = None


class TestUserRegistrationValidation:
    """Test UserRegistration model validation."""

    def test_valid_minimal_registration(self):
        """Test registration with minimal required fields."""
        user = UserRegistrationModel(
            email="test@example.com",
            password="TestPass123",
            first_name="John",
            last_name="Doe"
        )
        assert user.email == "test@example.com"
        assert user.first_name == "John"

    def test_valid_full_registration(self):
        """Test registration with all fields."""
        user = UserRegistrationModel(
            email="test@example.com",
            password="TestPass123",
            first_name="John",
            last_name="Doe",
            middle_name="Michael",
            phone="+1234567890",
            date_of_birth=datetime(1990, 1, 15, tzinfo=timezone.utc),
            gender=Gender.MALE
        )
        assert user.gender == Gender.MALE
        assert user.middle_name == "Michael"

    def test_invalid_email_rejected(self):
        """Test that invalid email is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationModel(
                email="not-an-email",
                password="TestPass123",
                first_name="John",
                last_name="Doe"
            )
        assert "email" in str(exc_info.value)

    def test_short_password_rejected(self):
        """Test that password shorter than 8 chars is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationModel(
                email="test@example.com",
                password="short",
                first_name="John",
                last_name="Doe"
            )
        assert "password" in str(exc_info.value).lower()

    def test_empty_first_name_rejected(self):
        """Test that empty first name is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationModel(
                email="test@example.com",
                password="TestPass123",
                first_name="",
                last_name="Doe"
            )
        assert "first_name" in str(exc_info.value)

    def test_invalid_gender_rejected(self):
        """Test that invalid gender value is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            UserRegistrationModel(
                email="test@example.com",
                password="TestPass123",
                first_name="John",
                last_name="Doe",
                gender="INVALID"
            )
        assert "gender" in str(exc_info.value)


# ============================================================
# Family Profile Validation Tests
# ============================================================

class FamilyProfileCreateModel(BaseModel):
    """Test model matching server's FamilyProfileCreate."""
    family_name: str = Field(min_length=1)
    family_surname: Optional[str] = None
    description: Optional[str] = None
    public_bio: Optional[str] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    established_date: Optional[datetime] = None
    is_private: bool = True
    allow_public_discovery: bool = False


class TestFamilyProfileValidation:
    """Test FamilyProfileCreate model validation."""

    def test_valid_minimal_family(self):
        """Test creating family with minimal data."""
        family = FamilyProfileCreateModel(family_name="Smith Family")
        assert family.family_name == "Smith Family"
        assert family.is_private is True
        assert family.allow_public_discovery is False

    def test_valid_full_family(self):
        """Test creating family with all fields."""
        family = FamilyProfileCreateModel(
            family_name="Johnson Family",
            family_surname="Johnson",
            description="A happy family",
            public_bio="We love adventures",
            primary_address="123 Main St",
            city="New York",
            state="NY",
            country="USA",
            established_date=datetime(2000, 6, 15, tzinfo=timezone.utc),
            is_private=False,
            allow_public_discovery=True
        )
        assert family.city == "New York"
        assert family.is_private is False

    def test_empty_family_name_rejected(self):
        """Test that empty family name is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            FamilyProfileCreateModel(family_name="")
        assert "family_name" in str(exc_info.value)


# ============================================================
# Organization Validation Tests
# ============================================================

class OrganizationType(str, Enum):
    COMPANY = "COMPANY"
    STARTUP = "STARTUP"
    NGO = "NGO"
    EDUCATIONAL = "EDUCATIONAL"


class OrganizationSize(str, Enum):
    SIZE_1_10 = "1-10"
    SIZE_11_50 = "11-50"
    SIZE_51_200 = "51-200"


class OrganizationCreateModel(BaseModel):
    """Test model for organization creation."""
    name: str = Field(min_length=1)
    organization_type: OrganizationType
    description: Optional[str] = None
    size: Optional[OrganizationSize] = None
    website: Optional[str] = None
    email: Optional[EmailStr] = None


class TestOrganizationValidation:
    """Test organization model validation."""

    def test_valid_minimal_organization(self):
        """Test creating organization with minimal data."""
        org = OrganizationCreateModel(
            name="Test Company",
            organization_type=OrganizationType.COMPANY
        )
        assert org.name == "Test Company"
        assert org.organization_type == OrganizationType.COMPANY

    def test_valid_full_organization(self):
        """Test creating organization with all fields."""
        org = OrganizationCreateModel(
            name="Innovative Startup",
            organization_type=OrganizationType.STARTUP,
            description="Building the future",
            size=OrganizationSize.SIZE_11_50,
            website="https://startup.com",
            email="contact@startup.com"
        )
        assert org.size == OrganizationSize.SIZE_11_50
        assert org.email == "contact@startup.com"

    def test_invalid_org_type_rejected(self):
        """Test that invalid organization type is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            OrganizationCreateModel(
                name="Test",
                organization_type="INVALID_TYPE"
            )
        assert "organization_type" in str(exc_info.value)


# ============================================================
# Post Validation Tests
# ============================================================

class PostVisibility(str, Enum):
    PUBLIC = "PUBLIC"
    FAMILY_ONLY = "FAMILY_ONLY"
    HOUSEHOLD_ONLY = "HOUSEHOLD_ONLY"
    ONLY_ME = "ONLY_ME"


class PostCreateModel(BaseModel):
    """Test model for post creation."""
    content: str = Field(min_length=1, max_length=10000)
    source_module: str = "family"
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY
    family_id: Optional[str] = None
    media_files: List[str] = []
    youtube_urls: List[str] = []


class TestPostValidation:
    """Test post model validation."""

    def test_valid_text_post(self):
        """Test creating a text-only post."""
        post = PostCreateModel(content="Hello, World!")
        assert post.content == "Hello, World!"
        assert post.visibility == PostVisibility.FAMILY_ONLY

    def test_valid_post_with_media(self):
        """Test creating a post with media files."""
        post = PostCreateModel(
            content="Check out these photos!",
            media_files=["file-1", "file-2"]
        )
        assert len(post.media_files) == 2

    def test_valid_post_with_youtube(self):
        """Test creating a post with YouTube URLs."""
        post = PostCreateModel(
            content="Watch this video!",
            youtube_urls=["https://youtube.com/watch?v=abc123"]
        )
        assert len(post.youtube_urls) == 1

    def test_empty_content_rejected(self):
        """Test that empty content is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PostCreateModel(content="")
        assert "content" in str(exc_info.value)

    def test_content_too_long_rejected(self):
        """Test that content exceeding max length is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            PostCreateModel(content="x" * 10001)
        assert "content" in str(exc_info.value)


# ============================================================
# Chat Message Validation Tests
# ============================================================

class MessageType(str, Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    FILE = "FILE"
    VOICE = "VOICE"


class ChatMessageCreateModel(BaseModel):
    """Test model for chat message creation."""
    content: str = Field(min_length=1, max_length=5000)
    message_type: MessageType = MessageType.TEXT
    reply_to: Optional[str] = None


class TestChatMessageValidation:
    """Test chat message model validation."""

    def test_valid_text_message(self):
        """Test creating a text message."""
        msg = ChatMessageCreateModel(content="Hello!")
        assert msg.content == "Hello!"
        assert msg.message_type == MessageType.TEXT

    def test_valid_reply_message(self):
        """Test creating a reply message."""
        msg = ChatMessageCreateModel(
            content="I agree!",
            reply_to="msg-123"
        )
        assert msg.reply_to == "msg-123"

    def test_empty_message_rejected(self):
        """Test that empty message is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ChatMessageCreateModel(content="")
        assert "content" in str(exc_info.value)


# ============================================================
# Privacy Settings Validation Tests
# ============================================================

class PrivacySettingsModel(BaseModel):
    """Test model for privacy settings."""
    work_visible_in_services: bool = True
    school_visible_in_events: bool = True
    location_sharing_enabled: bool = False
    profile_visible_to_public: bool = True
    family_visible_to_friends: bool = True


class TestPrivacySettingsValidation:
    """Test privacy settings model validation."""

    def test_default_privacy_settings(self):
        """Test default privacy settings values."""
        settings = PrivacySettingsModel()
        assert settings.work_visible_in_services is True
        assert settings.location_sharing_enabled is False

    def test_custom_privacy_settings(self):
        """Test custom privacy settings."""
        settings = PrivacySettingsModel(
            work_visible_in_services=False,
            location_sharing_enabled=True
        )
        assert settings.work_visible_in_services is False
        assert settings.location_sharing_enabled is True


# ============================================================
# Profile Update Validation Tests
# ============================================================

class ProfileUpdateModel(BaseModel):
    """Test model for profile updates."""
    first_name: Optional[str] = Field(None, min_length=1)
    last_name: Optional[str] = Field(None, min_length=1)
    bio: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = None
    business_email: Optional[EmailStr] = None
    personal_interests: Optional[List[str]] = None


class TestProfileUpdateValidation:
    """Test profile update model validation."""

    def test_partial_update(self):
        """Test updating only some fields."""
        update = ProfileUpdateModel(first_name="Jane")
        assert update.first_name == "Jane"
        assert update.last_name is None

    def test_full_update(self):
        """Test updating all fields."""
        update = ProfileUpdateModel(
            first_name="Jane",
            last_name="Smith",
            bio="Software developer",
            phone="+1234567890",
            business_email="jane@company.com",
            personal_interests=["coding", "reading"]
        )
        assert len(update.personal_interests) == 2

    def test_bio_too_long_rejected(self):
        """Test that bio exceeding max length is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProfileUpdateModel(bio="x" * 501)
        assert "bio" in str(exc_info.value)


# ============================================================
# Date Validation Tests
# ============================================================

class EventCreateModel(BaseModel):
    """Test model for event creation with date validation."""
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None

    def model_post_init(self, __context):
        """Validate that end_date is after start_date."""
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")


class TestDateValidation:
    """Test date-related validation."""

    def test_valid_event_dates(self):
        """Test event with valid date range."""
        event = EventCreateModel(
            title="Meeting",
            start_date=datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc),
            end_date=datetime(2024, 1, 15, 11, 0, tzinfo=timezone.utc)
        )
        assert event.start_date < event.end_date

    def test_event_without_end_date(self):
        """Test event without end date is valid."""
        event = EventCreateModel(
            title="All-day Event",
            start_date=datetime(2024, 1, 15, tzinfo=timezone.utc)
        )
        assert event.end_date is None

    def test_end_date_before_start_date_rejected(self):
        """Test that end_date before start_date is rejected."""
        with pytest.raises(ValueError) as exc_info:
            EventCreateModel(
                title="Invalid Event",
                start_date=datetime(2024, 1, 15, 12, 0, tzinfo=timezone.utc),
                end_date=datetime(2024, 1, 15, 10, 0, tzinfo=timezone.utc)
            )
        assert "end_date must be after start_date" in str(exc_info.value)


# ============================================================
# List Size Validation Tests
# ============================================================

class InvitationBatchModel(BaseModel):
    """Test model for batch invitations."""
    emails: List[EmailStr] = Field(..., min_length=1, max_length=50)
    message: Optional[str] = Field(None, max_length=500)


class TestListValidation:
    """Test list field validation."""

    def test_valid_batch_invitation(self):
        """Test batch invitation with valid email list."""
        batch = InvitationBatchModel(
            emails=["user1@test.com", "user2@test.com"],
            message="Join our team!"
        )
        assert len(batch.emails) == 2

    def test_empty_email_list_rejected(self):
        """Test that empty email list is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InvitationBatchModel(emails=[])
        assert "emails" in str(exc_info.value)

    def test_too_many_emails_rejected(self):
        """Test that too many emails is rejected."""
        emails = [f"user{i}@test.com" for i in range(51)]
        with pytest.raises(ValidationError) as exc_info:
            InvitationBatchModel(emails=emails)
        assert "emails" in str(exc_info.value)

    def test_invalid_email_in_list_rejected(self):
        """Test that invalid email in list is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            InvitationBatchModel(emails=["valid@test.com", "not-an-email"])
        assert "email" in str(exc_info.value).lower()
