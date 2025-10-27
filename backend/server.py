from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import aiofiles
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'zion_city')]

# Create the main app without a prefix
app = FastAPI(title="ZION.CITY API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Enums for better type safety
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    FAMILY_ADMIN = "FAMILY_ADMIN"
    ADULT = "ADULT"
    CHILD = "CHILD"
    BUSINESS = "BUSINESS"
    GOVERNMENT = "GOVERNMENT"

class AffiliationType(str, Enum):
    WORK = "WORK"
    SCHOOL = "SCHOOL"
    UNIVERSITY = "UNIVERSITY"
    MEDICAL = "MEDICAL"
    GOVERNMENT = "GOVERNMENT"
    BUSINESS = "BUSINESS"
    CLUB = "CLUB"
    OTHER = "OTHER"

class VerificationLevel(str, Enum):
    SELF_DECLARED = "SELF_DECLARED"
    ORGANIZATION_VERIFIED = "ORGANIZATION_VERIFIED"
    GOVERNMENT_VERIFIED = "GOVERNMENT_VERIFIED"

# === CORE MODELS ===

class MediaFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    original_filename: str
    stored_filename: str
    file_path: str
    file_type: str  # "image", "document", "video"
    mime_type: str
    file_size: int  # in bytes
    uploaded_by: str  # user_id
    source_module: str = "personal"  # "family", "work", "education", "health", "government", "business", "community", "personal"
    privacy_level: str = "private"  # "private", "module", "public"
    metadata: Dict[str, Any] = {}  # Additional metadata (dimensions, duration, etc.)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MediaCollection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: Optional[str] = None
    source_module: str = "personal"
    media_ids: List[str] = []  # List of MediaFile IDs
    cover_media_id: Optional[str] = None
    privacy_level: str = "private"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class PostVisibility(str, Enum):
    PUBLIC = "PUBLIC"                      # Everyone can see
    FAMILY_ONLY = "FAMILY_ONLY"           # All family members
    HOUSEHOLD_ONLY = "HOUSEHOLD_ONLY"     # Same household members
    FATHERS_ONLY = "FATHERS_ONLY"         # Male parents only
    MOTHERS_ONLY = "MOTHERS_ONLY"         # Female parents only
    CHILDREN_ONLY = "CHILDREN_ONLY"       # Children only
    PARENTS_ONLY = "PARENTS_ONLY"         # All parents (fathers + mothers)
    EXTENDED_FAMILY_ONLY = "EXTENDED_FAMILY_ONLY"  # Extended family members
    ONLY_ME = "ONLY_ME"                   # Creator only

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str
    source_module: str = "family"  # Module where post was created
    target_audience: str = "module"  # "module", "public", "private"
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY  # NEW: Role-based visibility
    family_id: Optional[str] = None  # NEW: Which family this post belongs to
    media_files: List[str] = []  # List of MediaFile IDs
    youtube_urls: List[str] = []  # Extracted YouTube URLs
    likes_count: int = 0
    comments_count: int = 0
    is_published: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class ChatGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    group_type: str  # "FAMILY", "RELATIVES", "CUSTOM"
    admin_id: str  # User who created/manages the group
    color_code: str = "#059669"  # Default to Family green
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatGroupMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    user_id: str
    role: str = "MEMBER"  # "ADMIN", "MEMBER"
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    user_id: str
    content: str
    message_type: str = "TEXT"  # "TEXT", "IMAGE", "FILE", "SYSTEM"
    reply_to: Optional[str] = None  # ID of message being replied to
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    is_deleted: bool = False

class ScheduledAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    user_id: str  # Who created the action
    title: str
    description: Optional[str] = None
    action_type: str  # "REMINDER", "BIRTHDAY", "APPOINTMENT", "EVENT", "TASK"
    scheduled_date: datetime
    scheduled_time: Optional[str] = None  # Time in HH:MM format
    color_code: str = "#059669"  # Inherits from module/group color
    is_completed: bool = False
    invitees: List[str] = []  # User IDs who are invited
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class PostLike(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostComment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For nested comments/replies
    likes_count: int = 0
    replies_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    is_deleted: bool = False

class CommentLike(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    comment_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostReaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    emoji: str  # "👍", "❤️", "😂", "😮", "😢", "😡", etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Who should receive the notification
    sender_id: str  # Who triggered the notification
    type: str  # "like", "comment", "mention", "reaction"
    title: str
    message: str
    related_post_id: Optional[str] = None
    related_comment_id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_at: Optional[datetime] = None

class Affiliation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: AffiliationType
    description: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserAffiliation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    affiliation_id: str
    user_role_in_org: str  # e.g., "Менеджер", "Студент", "Родитель"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True
    verification_level: VerificationLevel = VerificationLevel.SELF_DECLARED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PrivacySettings(BaseModel):
    work_visible_in_services: bool = True
    school_visible_in_events: bool = True
    location_sharing_enabled: bool = False
    profile_visible_to_public: bool = True
    family_visible_to_friends: bool = True

class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    IT = "IT"  # AI Agents, Smart Devices, IoT

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone: Optional[str] = None
    password_hash: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[Gender] = None  # NEW: MALE, FEMALE, IT
    avatar_url: Optional[str] = None
    profile_picture: Optional[str] = None  # Base64 encoded profile photo
    role: UserRole = UserRole.ADULT
    is_active: bool = True
    is_verified: bool = False
    privacy_settings: PrivacySettings = Field(default_factory=PrivacySettings)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    
    # NEW FAMILY SYSTEM FIELDS
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    marriage_status: Optional[str] = None  # SINGLE, MARRIED, DIVORCED, WIDOWED
    spouse_user_id: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_phone: Optional[str] = None
    profile_completed: bool = False
    
    # MY INFO MODULE FIELDS
    name_alias: Optional[str] = None  # Display name (vs legal first_name/last_name)
    additional_user_data: Dict[str, Any] = {}  # Extensible field for future user data

# === FAMILY PROFILE SYSTEM MODELS ===

class FamilyRole(str, Enum):
    CREATOR = "CREATOR"        # Original creator
    ADMIN = "ADMIN"           # Spouses and co-admins
    ADULT_MEMBER = "ADULT_MEMBER"    # Adult family members
    CHILD = "CHILD"           # Children in the family

class FamilyContentType(str, Enum):
    ANNOUNCEMENT = "ANNOUNCEMENT"      # Family announcements & news
    PHOTO_ALBUM = "PHOTO_ALBUM"      # Family photo albums
    EVENT = "EVENT"                   # Family events/reunions
    MILESTONE = "MILESTONE"           # Family milestones (births, marriages, etc.)
    BUSINESS_UPDATE = "BUSINESS_UPDATE"  # Family business updates

class FamilyPostPrivacy(str, Enum):
    PUBLIC = "PUBLIC"         # Visible to all subscribed families
    FAMILY_ONLY = "FAMILY_ONLY"  # Visible only to family members
    ADMIN_ONLY = "ADMIN_ONLY"     # Visible only to family admins

class Family(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    admin_id: str  # The family administrator
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class FamilyMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_id: str
    user_id: str
    family_role: FamilyRole = FamilyRole.ADULT_MEMBER
    
    # Relationship context
    relationship_to_family: Optional[str] = None  # "Father", "Mother", "Son", "Daughter", etc.
    is_primary_resident: bool = True  # Lives at the family address
    
    # Member status
    invitation_accepted: bool = False  # Has confirmed household membership
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class FamilyProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_name: str  # e.g., "The Johnson Family"
    family_surname: Optional[str] = None  # Primary family surname
    description: Optional[str] = None  # Family bio/description
    public_bio: Optional[str] = None  # Public facing bio for subscribers
    
    # Address & Location (household definition)
    primary_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    
    # Family Information
    established_date: Optional[datetime] = None  # When family was established
    family_photo_url: Optional[str] = None  # Family cover photo
    banner_url: Optional[str] = None  # Family banner image
    
    # Privacy & Access Settings
    is_private: bool = True  # Invite-only by default
    allow_public_discovery: bool = False  # Can be found in search
    
    # Statistics
    member_count: int = 1
    children_count: int = 0
    
    # Metadata
    creator_id: str  # User who created the family profile
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class FamilyInvitation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_id: str
    invited_by_user_id: str  # Who sent the invitation
    invited_user_email: EmailStr  # Email of person being invited
    invited_user_id: Optional[str] = None  # If user already exists in system
    
    # Invitation details
    invitation_type: str = "MEMBER"  # "MEMBER", "ADMIN"
    relationship_to_family: Optional[str] = None
    message: Optional[str] = None  # Personal message with invitation
    
    # Status tracking
    status: str = "PENDING"  # "PENDING", "ACCEPTED", "DECLINED", "EXPIRED"
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    is_active: bool = True

class FamilySubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    subscriber_family_id: str  # Family that is subscribing
    target_family_id: str     # Family being subscribed to
    invited_by_user_id: str   # User who sent the subscription invite
    
    # Subscription details
    subscription_level: str = "BASIC"  # "BASIC", "CLOSE_FAMILY", "EXTENDED_FAMILY"
    can_see_public_content: bool = True
    can_see_family_events: bool = False
    
    # Status
    status: str = "ACTIVE"  # "ACTIVE", "PAUSED", "BLOCKED"
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class FamilyPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_id: str
    posted_by_user_id: str  # Family member who posted
    
    # Content
    title: Optional[str] = None
    content: str
    content_type: FamilyContentType = FamilyContentType.ANNOUNCEMENT
    
    # Privacy & Audience
    privacy_level: FamilyPostPrivacy = FamilyPostPrivacy.PUBLIC
    target_audience: str = "SUBSCRIBERS"  # "SUBSCRIBERS", "FAMILY_ONLY", "SPECIFIC_FAMILIES"
    
    # Media & Attachments
    media_files: List[str] = []  # MediaFile IDs
    youtube_urls: List[str] = []
    
    # Child post handling (for when parents post on behalf of children)
    original_child_post_id: Optional[str] = None  # If this was originally a child's private post
    is_child_post_approved: bool = True  # Parents can approve child posts for public viewing
    
    # Engagement
    likes_count: int = 0
    comments_count: int = 0
    
    # Metadata
    is_published: bool = True
    is_pinned: bool = False  # Pin important family announcements
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# === WORK ORGANIZATION SYSTEM MODELS ===

class WorkRole(str, Enum):
    # Organization roles - updated to include MEMBER
    OWNER = "OWNER"  # Organization owner (creator)
    ADMIN = "ADMIN"  # Organization administrator
    CEO = "CEO"
    CTO = "CTO"
    CFO = "CFO"
    COO = "COO"
    FOUNDER = "FOUNDER"
    CO_FOUNDER = "CO_FOUNDER"
    PRESIDENT = "PRESIDENT"
    VICE_PRESIDENT = "VICE_PRESIDENT"
    DIRECTOR = "DIRECTOR"
    MANAGER = "MANAGER"
    SENIOR_MANAGER = "SENIOR_MANAGER"
    TEAM_LEAD = "TEAM_LEAD"
    EMPLOYEE = "EMPLOYEE"
    SENIOR_EMPLOYEE = "SENIOR_EMPLOYEE"
    MEMBER = "MEMBER"  # Generic member
    CONTRACTOR = "CONTRACTOR"
    INTERN = "INTERN"
    CONSULTANT = "CONSULTANT"
    CLIENT = "CLIENT"
    CUSTOM = "CUSTOM"

class OrganizationType(str, Enum):
    COMPANY = "COMPANY"
    STARTUP = "STARTUP"
    NGO = "NGO"
    NON_PROFIT = "NON_PROFIT"
    GOVERNMENT = "GOVERNMENT"
    EDUCATIONAL = "EDUCATIONAL"
    HEALTHCARE = "HEALTHCARE"
    OTHER = "OTHER"

class OrganizationSize(str, Enum):
    SIZE_1_10 = "1-10"
    SIZE_11_50 = "11-50"
    SIZE_51_200 = "51-200"
    SIZE_201_500 = "201-500"
    SIZE_500_PLUS = "500+"

class WorkOrganization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="organization_id")
    name: str
    organization_type: OrganizationType = OrganizationType.COMPANY
    
    # Organization Details
    description: Optional[str] = None
    industry: Optional[str] = None
    organization_size: Optional[OrganizationSize] = None
    founded_year: Optional[int] = None
    
    # Contact & Location
    website: Optional[str] = None
    official_email: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Branding
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    
    # Privacy Settings
    is_private: bool = False  # Public by default
    allow_public_discovery: bool = True
    
    # Statistics
    member_count: int = 1
    
    # Metadata
    creator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

    class Config:
        populate_by_name = True

class WorkMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="member_id")
    organization_id: str
    user_id: str
    
    # Position Details
    role: WorkRole = WorkRole.EMPLOYEE
    custom_role_name: Optional[str] = None  # If role is CUSTOM
    department: Optional[str] = None  # Sales, Engineering, HR, Marketing, etc.
    team: Optional[str] = None  # Specific team within department
    
    # Employment Details
    job_title: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_current: bool = True
    
    # Permissions
    can_post: bool = True
    can_invite: bool = False  # Only managers and above
    is_admin: bool = False
    
    # Status
    status: str = "ACTIVE"  # ACTIVE, INACTIVE, LEFT
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

    class Config:
        populate_by_name = True

class WorkPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    posted_by_user_id: str
    
    # Content
    title: Optional[str] = None
    content: str
    
    # Privacy
    privacy_level: str = "PUBLIC"  # PUBLIC, ORGANIZATION_ONLY, DEPARTMENT_ONLY
    target_department: Optional[str] = None  # If department-specific
    
    # Media
    media_files: List[str] = []
    youtube_urls: List[str] = []
    
    # Engagement
    likes_count: int = 0
    comments_count: int = 0
    
    # Metadata
    is_published: bool = True
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# === INPUT/OUTPUT MODELS ===

class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[Gender] = None  # NEW: Gender selection

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    middle_name: Optional[str]
    name_alias: Optional[str] = None  # Display name
    gender: Optional[Gender] = None  # NEW: Include gender in response
    profile_picture: Optional[str] = None  # Base64 profile photo
    role: UserRole
    is_active: bool
    is_verified: bool
    privacy_settings: PrivacySettings
    created_at: datetime
    affiliations: Optional[List[Dict[str, Any]]] = []
    # Family system fields
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    marriage_status: Optional[str] = None
    profile_completed: bool = False

class AffiliationCreate(BaseModel):
    name: str
    type: AffiliationType
    description: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class UserAffiliationCreate(BaseModel):
    affiliation_id: str
    user_role_in_org: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class OnboardingData(BaseModel):
    work_place: Optional[str] = None
    work_role: Optional[str] = None
    university: Optional[str] = None
    university_role: Optional[str] = None
    school: Optional[str] = None
    school_role: Optional[str] = None
    privacy_settings: Optional[PrivacySettings] = None

class ChatGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    group_type: str = "CUSTOM"
    color_code: str = "#059669"
    member_ids: List[str] = []

class GenderUpdateRequest(BaseModel):
    gender: Gender

# === FAMILY PROFILE INPUT/OUTPUT MODELS ===

class FamilyProfileCreate(BaseModel):
    family_name: str
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

class FamilyProfileUpdate(BaseModel):
    family_name: Optional[str] = None
    family_surname: Optional[str] = None
    description: Optional[str] = None
    public_bio: Optional[str] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    established_date: Optional[datetime] = None
    family_photo_url: Optional[str] = None
    is_private: Optional[bool] = None
    allow_public_discovery: Optional[bool] = None

class FamilyMemberInvite(BaseModel):
    invited_user_email: EmailStr
    invitation_type: str = "MEMBER"  # "MEMBER", "ADMIN"
    relationship_to_family: Optional[str] = None
    message: Optional[str] = None

class FamilySubscriptionInvite(BaseModel):
    target_family_id: str
    subscription_level: str = "BASIC"
    message: Optional[str] = None

class FamilyPostCreate(BaseModel):
    title: Optional[str] = None
    content: str
    content_type: FamilyContentType = FamilyContentType.ANNOUNCEMENT
    privacy_level: FamilyPostPrivacy = FamilyPostPrivacy.PUBLIC
    target_audience: str = "SUBSCRIBERS"
    media_file_ids: List[str] = []
    youtube_urls: List[str] = []
    is_pinned: bool = False

class FamilyProfileResponse(BaseModel):
    id: str
    family_name: str
    family_surname: Optional[str]
    description: Optional[str]
    public_bio: Optional[str]
    primary_address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: Optional[str]
    established_date: Optional[datetime]
    family_photo_url: Optional[str]
    banner_url: Optional[str]
    is_private: bool
    allow_public_discovery: bool
    member_count: int
    children_count: int
    creator_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # Additional fields for response
    is_user_member: Optional[bool] = False
    user_role: Optional[FamilyRole] = None
    subscription_status: Optional[str] = None  # For external families

class FamilyMemberResponse(BaseModel):
    id: str
    user_id: str
    family_role: FamilyRole
    relationship_to_family: Optional[str]
    is_primary_resident: bool
    invitation_accepted: bool
    joined_at: datetime
    
    # User details
    user_first_name: str
    user_last_name: str
    user_avatar_url: Optional[str]

class FamilyPostResponse(BaseModel):
    id: str
    family_id: str
    title: Optional[str]
    content: str
    content_type: FamilyContentType
    privacy_level: FamilyPostPrivacy
    target_audience: str
    media_files: List[str]
    youtube_urls: List[str]
    original_child_post_id: Optional[str]
    is_child_post_approved: bool
    likes_count: int
    comments_count: int
    is_published: bool
    is_pinned: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Author details
    author: Dict[str, Any]
    family: Dict[str, Any]

# === WORK ORGANIZATION INPUT/OUTPUT MODELS ===

class WorkOrganizationSearch(BaseModel):
    query: str  # Organization name to search
    organization_type: Optional[OrganizationType] = None

class WorkOrganizationCreate(BaseModel):
    # Basic Info
    name: str
    organization_type: OrganizationType = OrganizationType.COMPANY
    
    # Organization Details
    description: Optional[str] = None
    industry: Optional[str] = None
    organization_size: Optional[OrganizationSize] = None
    founded_year: Optional[int] = None
    
    # Contact & Location
    website: Optional[str] = None
    official_email: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Privacy
    is_private: bool = False
    allow_public_discovery: bool = True
    
    # Creator's Role & Position (for initial member)
    creator_role: WorkRole = WorkRole.EMPLOYEE
    custom_role_name: Optional[str] = None
    creator_department: Optional[str] = None
    creator_team: Optional[str] = None
    creator_job_title: Optional[str] = None

class WorkOrganizationResponse(BaseModel):
    id: str
    name: str
    organization_type: OrganizationType
    description: Optional[str]
    industry: Optional[str]
    organization_size: Optional[OrganizationSize]
    founded_year: Optional[int]
    website: Optional[str]
    official_email: Optional[str]
    address_street: Optional[str]
    address_city: Optional[str]
    address_state: Optional[str]
    address_country: Optional[str]
    address_postal_code: Optional[str]
    logo_url: Optional[str]
    banner_url: Optional[str]
    is_private: bool
    allow_public_discovery: bool
    member_count: int
    creator_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool
    
    # User's membership details (if member)
    user_role: Optional[WorkRole] = None
    user_custom_role_name: Optional[str] = None
    user_department: Optional[str] = None
    user_team: Optional[str] = None
    user_job_title: Optional[str] = None
    user_is_admin: bool = False
    user_can_invite: bool = False
    user_can_post: bool = True

class WorkMemberAdd(BaseModel):
    user_email: str
    role: WorkRole = WorkRole.EMPLOYEE
    custom_role_name: Optional[str] = None
    department: Optional[str] = None
    team: Optional[str] = None
    job_title: Optional[str] = None
    can_invite: bool = False
    is_admin: bool = False

class WorkMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: WorkRole
    custom_role_name: Optional[str]
    department: Optional[str]
    team: Optional[str]
    job_title: Optional[str]
    start_date: Optional[datetime]
    is_current: bool
    can_post: bool
    can_invite: bool
    is_admin: bool
    status: str
    joined_at: datetime
    
    # User details
    user_first_name: str
    user_last_name: str
    user_email: str
    user_avatar_url: Optional[str]

class WorkPostCreate(BaseModel):
    title: Optional[str] = None
    content: str
    privacy_level: str = "PUBLIC"
    target_department: Optional[str] = None
    media_file_ids: List[str] = []
    youtube_urls: List[str] = []
    is_pinned: bool = False

class WorkPostResponse(BaseModel):
    id: str
    organization_id: str
    title: Optional[str]
    content: str
    privacy_level: str
    target_department: Optional[str]
    media_files: List[str]
    youtube_urls: List[str]
    likes_count: int
    comments_count: int
    is_published: bool
    is_pinned: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Author details
    author: Dict[str, Any]
    organization: Dict[str, Any]

# ===== DEPARTMENTS & ANNOUNCEMENTS MODELS =====

class DepartmentRole(str, Enum):
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"
    LEAD = "LEAD"
    MEMBER = "MEMBER"
    CLIENT = "CLIENT"

class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    name: str
    description: Optional[str] = None
    color: str  # Hex color code
    head_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#1D4ED8"
    head_id: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    head_id: Optional[str] = None

class DepartmentMember(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    department_id: str
    user_id: str
    role: DepartmentRole
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DepartmentMemberAdd(BaseModel):
    user_id: str
    role: DepartmentRole = DepartmentRole.MEMBER

class AnnouncementPriority(str, Enum):
    NORMAL = "NORMAL"
    IMPORTANT = "IMPORTANT"
    URGENT = "URGENT"

class AnnouncementTargetType(str, Enum):
    ALL = "ALL"
    DEPARTMENTS = "DEPARTMENTS"

class Announcement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    department_id: Optional[str] = None  # Which department created this
    title: str
    content: str
    priority: AnnouncementPriority
    author_id: str
    target_type: AnnouncementTargetType
    target_departments: List[str] = []  # Empty if target_type is ALL
    is_pinned: bool = False
    views: int = 0
    reactions: Dict[str, int] = {}  # {"thumbsup": 5, "heart": 3}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: AnnouncementPriority = AnnouncementPriority.NORMAL
    target_type: AnnouncementTargetType = AnnouncementTargetType.ALL
    target_departments: List[str] = []
    department_id: Optional[str] = None
    is_pinned: bool = False

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    priority: Optional[AnnouncementPriority] = None
    target_type: Optional[AnnouncementTargetType] = None
    target_departments: Optional[List[str]] = None
    is_pinned: Optional[bool] = None

class AnnouncementReaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    announcement_id: str
    user_id: str
    reaction_type: str  # thumbsup, heart, clap, fire
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AnnouncementReactionRequest(BaseModel):
    reaction_type: str

# ===== ORGANIZATION FOLLOW MODELS =====

class OrganizationFollow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    follower_id: str  # User who is following
    followed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ===== END ORGANIZATION FOLLOW MODELS =====

# ===== MEMBER SETTINGS & CHANGE REQUESTS MODELS =====

class ChangeRequestType(str, Enum):
    ROLE_CHANGE = "ROLE_CHANGE"
    DEPARTMENT_CHANGE = "DEPARTMENT_CHANGE"
    TEAM_CHANGE = "TEAM_CHANGE"
    JOB_TITLE_CHANGE = "JOB_TITLE_CHANGE"
    PERMISSIONS_CHANGE = "PERMISSIONS_CHANGE"

class ChangeRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class WorkChangeRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    user_id: str  # Member requesting the change
    request_type: ChangeRequestType
    
    # Current values
    current_role: Optional[WorkRole] = None
    current_department: Optional[str] = None
    current_team: Optional[str] = None
    current_job_title: Optional[str] = None
    current_can_post: Optional[bool] = None
    current_can_invite: Optional[bool] = None
    
    # Requested values
    requested_role: Optional[WorkRole] = None
    requested_custom_role_name: Optional[str] = None
    requested_department: Optional[str] = None
    requested_team: Optional[str] = None
    requested_job_title: Optional[str] = None
    requested_can_post: Optional[bool] = None
    requested_can_invite: Optional[bool] = None
    
    # Request details
    reason: Optional[str] = None  # Why they need this change
    status: ChangeRequestStatus = ChangeRequestStatus.PENDING
    reviewed_by: Optional[str] = None  # Admin who reviewed
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkChangeRequestCreate(BaseModel):
    request_type: ChangeRequestType
    requested_role: Optional[WorkRole] = None
    requested_custom_role_name: Optional[str] = None
    requested_department: Optional[str] = None
    requested_team: Optional[str] = None
    requested_job_title: Optional[str] = None
    requested_can_post: Optional[bool] = None
    requested_can_invite: Optional[bool] = None
    reason: Optional[str] = None

class WorkChangeRequestResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    request_type: ChangeRequestType
    
    # Current values
    current_role: Optional[WorkRole]
    current_department: Optional[str]
    current_team: Optional[str]
    current_job_title: Optional[str]
    
    # Requested values
    requested_role: Optional[WorkRole]
    requested_custom_role_name: Optional[str]
    requested_department: Optional[str]
    requested_team: Optional[str]
    requested_job_title: Optional[str]
    
    reason: Optional[str]
    status: ChangeRequestStatus
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    
    # User details
    user_first_name: str
    user_last_name: str
    user_email: str
    user_avatar_url: Optional[str]

# === WORK NOTIFICATION MODELS ===

class NotificationType(str, Enum):
    ROLE_CHANGE_APPROVED = "ROLE_CHANGE_APPROVED"
    ROLE_CHANGE_REJECTED = "ROLE_CHANGE_REJECTED"
    JOIN_REQUEST_APPROVED = "JOIN_REQUEST_APPROVED"
    JOIN_REQUEST_REJECTED = "JOIN_REQUEST_REJECTED"
    DEPARTMENT_CHANGE_APPROVED = "DEPARTMENT_CHANGE_APPROVED"
    DEPARTMENT_CHANGE_REJECTED = "DEPARTMENT_CHANGE_REJECTED"
    TEAM_CHANGE_APPROVED = "TEAM_CHANGE_APPROVED"
    TEAM_CHANGE_REJECTED = "TEAM_CHANGE_REJECTED"

class WorkNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # User who receives the notification
    organization_id: str
    notification_type: NotificationType
    title: str  # Short title of notification
    message: str  # Detailed message
    related_request_id: Optional[str] = None  # ID of the related request
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkNotificationResponse(BaseModel):
    id: str
    user_id: str
    organization_id: str
    notification_type: NotificationType
    title: str
    message: str
    related_request_id: Optional[str]
    is_read: bool
    created_at: datetime
    organization_name: Optional[str] = None

class WorkMemberSettingsUpdate(BaseModel):
    """Member updates their own settings - creates change requests for role/dept/team"""
    job_title: Optional[str] = None  # Direct update, no approval needed
    requested_role: Optional[WorkRole] = None  # Requires approval
    requested_custom_role_name: Optional[str] = None
    requested_department: Optional[str] = None  # Requires approval
    requested_team: Optional[str] = None  # Requires approval
    reason: Optional[str] = None  # Why they need these changes

class WorkTeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    team_lead_id: Optional[str] = None

class WorkTeam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    name: str
    description: Optional[str] = None
    department_id: Optional[str] = None
    team_lead_id: Optional[str] = None
    member_ids: List[str] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

# ===== END MEMBER SETTINGS & CHANGE REQUESTS MODELS =====

# ===== END DEPARTMENTS & ANNOUNCEMENTS MODELS =====

class ChatMessageCreate(BaseModel):
    group_id: str
    content: str
    message_type: str = "TEXT"
    reply_to: Optional[str] = None

class ScheduledActionCreate(BaseModel):
    group_id: str
    title: str
    description: Optional[str] = None
    action_type: str
    scheduled_date: datetime
    scheduled_time: Optional[str] = None
    color_code: str = "#059669"
    invitees: List[str] = []
    location: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class PostCreate(BaseModel):
    content: str
    source_module: str = "family"  # Module where post is being created
    target_audience: str = "module"  # Audience for the post

class PostResponse(BaseModel):
    id: str
    user_id: str
    content: str
    source_module: str = "family"
    target_audience: str = "module"
    visibility: str = "FAMILY_ONLY"  # NEW: Role-based visibility
    family_id: Optional[str] = None  # NEW: Family ID
    author: Dict[str, Any]  # User info
    media_files: List[Dict[str, Any]] = []  # MediaFile info
    youtube_urls: List[str] = []
    likes_count: int
    comments_count: int
    is_published: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # New social features fields
    user_liked: bool = False  # Whether current user liked this post
    user_reaction: Optional[str] = None  # User's emoji reaction
    top_reactions: List[Dict[str, Any]] = []  # Top emoji reactions with counts

class CommentResponse(BaseModel):
    id: str
    post_id: str
    content: str
    author: Dict[str, Any]
    parent_comment_id: Optional[str] = None
    likes_count: int = 0
    replies_count: int = 0
    replies: List["CommentResponse"] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    user_liked: bool = False  # Whether current user liked this comment

# Enable forward references for nested CommentResponse
CommentResponse.model_rebuild()

# === NEW FAMILY SYSTEM MODELS (NODE & SUPER NODE ARCHITECTURE) ===

class MarriageStatus(str, Enum):
    SINGLE = "SINGLE"
    MARRIED = "MARRIED"
    DIVORCED = "DIVORCED"
    WIDOWED = "WIDOWED"

class NodeType(str, Enum):
    NODE = "NODE"  # Nuclear family unit
    SUPER_NODE = "SUPER_NODE"  # Household with multiple families

class FamilyUnitRole(str, Enum):
    HEAD = "HEAD"  # Family unit head (creator)
    SPOUSE = "SPOUSE"  # Married spouse
    CHILD = "CHILD"  # Children
    PARENT = "PARENT"  # Parents living with family

class PostVisibility(str, Enum):
    FAMILY_ONLY = "FAMILY_ONLY"  # Only my family unit sees
    HOUSEHOLD_ONLY = "HOUSEHOLD_ONLY"  # All families in my household see
    PUBLIC = "PUBLIC"  # Everyone in my connections sees

class JoinRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"

class VoteChoice(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"

class AddressModel(BaseModel):
    """Structured address for matching"""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

class FamilyUnit(BaseModel):
    """Nuclear family unit - NODE"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_name: str
    family_surname: str
    
    # Address (stored as flat fields for MongoDB)
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Node Information
    node_type: NodeType = NodeType.NODE
    parent_household_id: Optional[str] = None
    
    # Creator & Metadata
    creator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Statistics
    member_count: int = 1
    is_active: bool = True
    
    def get_matching_key(self) -> str:
        """Generate matching key for intelligent search"""
        return f"{self.address_street}|{self.address_city}|{self.address_country}|{self.family_surname}".lower()

class FamilyUnitMember(BaseModel):
    """Junction table linking users to family units"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_unit_id: str
    user_id: str
    role: FamilyUnitRole
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class HouseholdProfile(BaseModel):
    """Household containing multiple family units - SUPER NODE"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_name: str
    
    # Shared Address
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Node Information
    node_type: NodeType = NodeType.SUPER_NODE
    member_family_unit_ids: List[str] = []
    
    # Creator & Metadata
    creator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    is_active: bool = True

class HouseholdMember(BaseModel):
    """Individual member of a household"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_id: str
    user_id: Optional[str] = None  # Linked user account
    name: str
    surname: Optional[str] = None
    relationship: str = "member"  # roommate, tenant, family_member, other
    is_creator: bool = False
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class HouseholdCreateRequest(BaseModel):
    """Request to create a household"""
    household_name: str
    address_street: str
    address_city: str
    address_state: Optional[str] = None
    address_country: str
    address_postal_code: Optional[str] = None
    members: List[dict] = []  # Initial members

class HouseholdResponse(BaseModel):
    """Response model for household"""
    id: str
    household_name: str
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    creator_id: str
    member_count: int = 0
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

class Vote(BaseModel):
    """Individual vote on join request"""
    user_id: str
    family_unit_id: str
    vote: VoteChoice
    voted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FamilyJoinRequest(BaseModel):
    """Request to join a family/household with voting system"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requesting_user_id: str
    requesting_family_unit_id: Optional[str] = None
    target_family_unit_id: Optional[str] = None
    target_household_id: Optional[str] = None
    request_type: str = "JOIN_HOUSEHOLD"
    message: Optional[str] = None
    
    # Voting System
    votes: List[Dict[str, Any]] = []  # Using Dict instead of Vote for MongoDB compatibility
    total_voters: int
    votes_required: int
    
    # Status
    status: JoinRequestStatus = JoinRequestStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    resolved_at: Optional[datetime] = None
    is_active: bool = True

class FamilyUnitPost(BaseModel):
    """Posts created on behalf of family unit"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_unit_id: str
    posted_by_user_id: str
    content: str
    media_files: List[str] = []
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_published: bool = True

# === NEW FAMILY SYSTEM REQUEST/RESPONSE MODELS ===

class ProfileCompletionRequest(BaseModel):
    """Complete user profile for family system"""
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    marriage_status: MarriageStatus
    spouse_name: Optional[str] = None
    spouse_phone: Optional[str] = None

class MatchingFamilyResult(BaseModel):
    """Result from intelligent family matching"""
    family_unit_id: str
    family_name: str
    family_surname: str
    address: AddressModel
    member_count: int
    match_score: int

class FamilyUnitCreateRequest(BaseModel):
    """Create new family unit"""
    family_name: str
    family_surname: str

class JoinRequestCreateRequest(BaseModel):
    """Request to join existing family/household"""
    target_family_unit_id: Optional[str] = None
    target_household_id: Optional[str] = None
    message: Optional[str] = None

class VoteRequest(BaseModel):
    """Vote on join request"""
    vote: VoteChoice

class FamilyUnitPostCreateRequest(BaseModel):
    """Create post on behalf of family"""
    content: str
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY
    media_files: List[str] = []

class FamilyUnitResponse(BaseModel):
    """Response model for family unit"""
    id: str
    family_name: str
    family_surname: str
    address: AddressModel
    node_type: NodeType
    parent_household_id: Optional[str]
    member_count: int
    is_user_member: bool = False
    user_role: Optional[FamilyUnitRole] = None
    created_at: datetime

class HouseholdResponse(BaseModel):
    """Response model for household"""
    id: str
    household_name: str
    address: AddressModel
    member_family_units: List[FamilyUnitResponse]
    created_at: datetime

# === END NEW FAMILY SYSTEM MODELS ===

# === MY INFO MODULE MODELS ===

class DocumentType(str, Enum):
    """Types of legal documents"""
    PASSPORT = "PASSPORT"  # Internal passport
    TRAVELING_PASSPORT = "TRAVELING_PASSPORT"  # International passport
    DRIVERS_LICENSE = "DRIVERS_LICENSE"  # Driver's license
    
class UserDocument(BaseModel):
    """User legal documents (passports, driver's license, etc.)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    document_type: DocumentType
    
    # Common fields
    country: str  # Country that issued the document
    document_number: Optional[str] = None
    
    # Document-specific data stored as flexible dict for extensibility
    # Examples:
    # - PASSPORT: {"series": "45 24", "issued_by": "...", "issue_date": "...", "department_code": "..."}
    # - TRAVELING_PASSPORT: {"first_name": "...", "last_name": "...", "issue_date": "...", "expiry_date": "..."}
    # - DRIVERS_LICENSE: {"license_number": "...", "issue_date": "...", "expires": "...", "categories": "..."}
    document_data: Dict[str, Any] = {}
    
    # Scan file reference (using existing media system)
    scan_file_id: Optional[str] = None  # Reference to MediaFile
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class UserDocumentCreate(BaseModel):
    """Request to create a new document"""
    document_type: DocumentType
    country: str
    document_number: Optional[str] = None
    document_data: Dict[str, Any] = {}

class UserDocumentUpdate(BaseModel):
    """Request to update an existing document"""
    country: Optional[str] = None
    document_number: Optional[str] = None
    document_data: Optional[Dict[str, Any]] = None

class UserDocumentResponse(BaseModel):
    """Response model for user document"""
    id: str
    document_type: DocumentType
    country: str
    document_number: Optional[str]
    document_data: Dict[str, Any]
    scan_file_id: Optional[str]
    scan_file_url: Optional[str]  # Full URL to scan if available
    created_at: datetime
    updated_at: datetime

class MyInfoUpdate(BaseModel):
    """Update MY INFO data (all profile fields)"""
    # Name fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    name_alias: Optional[str] = None  # Display name (vs legal name)
    
    # Contact info
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None  # NEW: MALE, FEMALE, IT
    
    # Address fields
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_country: Optional[str] = None
    address_postal_code: Optional[str] = None
    
    # Marriage info
    marriage_status: Optional[str] = None
    spouse_name: Optional[str] = None
    spouse_phone: Optional[str] = None
    
    additional_user_data: Optional[Dict[str, Any]] = None  # Future extensibility
    
class MyInfoResponse(BaseModel):
    """Complete MY INFO response"""
    id: str
    email: str
    
    # Name fields
    first_name: str
    last_name: str
    middle_name: Optional[str]
    name_alias: Optional[str]  # Display name
    
    # Personal info
    phone: Optional[str]
    date_of_birth: Optional[datetime]
    profile_picture: Optional[str] = None  # Base64 image
    gender: Optional[str] = None  # MALE, FEMALE, IT
    
    # Address
    address_street: Optional[str]
    address_city: Optional[str]
    address_state: Optional[str]
    address_country: Optional[str]
    address_postal_code: Optional[str]
    
    # Marriage info
    marriage_status: Optional[str]
    spouse_name: Optional[str]
    spouse_phone: Optional[str]
    
    # Profile status
    profile_completed: bool
    
    # Extensibility
    additional_user_data: Dict[str, Any]
    
    # Metadata
    created_at: datetime
    updated_at: datetime

# === END MY INFO MODULE MODELS ===

class MediaUploadResponse(BaseModel):
    id: str
    original_filename: str
    file_type: str
    file_size: int
    file_url: str

# === UTILITY FUNCTIONS ===

# File upload settings
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = {
    "image": 10 * 1024 * 1024,  # 10MB
    "document": 50 * 1024 * 1024,  # 50MB
}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif"}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf", 
    "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}

def extract_youtube_urls(text: str) -> List[str]:
    """Extract YouTube URLs from text content"""
    youtube_patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
        r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]+)',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]+)'
    ]
    
    urls = []
    for pattern in youtube_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            # Construct standard YouTube URL
            urls.append(f"https://www.youtube.com/watch?v={match}")
    
    return list(set(urls))  # Remove duplicates

def get_file_type(mime_type: str) -> str:
    """Determine file type based on MIME type"""
    if mime_type in ALLOWED_IMAGE_TYPES:
        return "image"
    elif mime_type in ALLOWED_DOCUMENT_TYPES:
        return "document"
    else:
        return "unknown"

def validate_file(file: UploadFile) -> tuple[bool, str]:
    """Validate uploaded file"""
    file_type = get_file_type(file.content_type)
    
    if file_type == "unknown":
        return False, "Unsupported file type"
    
    # Check file size (we'll validate this during upload)
    max_size = MAX_FILE_SIZE.get(file_type, 0)
    if file.size and file.size > max_size:
        return False, f"File too large. Max size: {max_size // (1024*1024)}MB"
    
    return True, "Valid file"

async def save_uploaded_file(file: UploadFile, user_id: str) -> MediaFile:
    """Save uploaded file to disk and create MediaFile record"""
    # Create user-specific directory
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    stored_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = user_dir / stored_filename
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Create MediaFile record
    media_file = MediaFile(
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_type=get_file_type(file.content_type),
        mime_type=file.content_type,
        file_size=len(content),
        uploaded_by=user_id
    )
    
    return media_file

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_user_by_email(email: str):
    user_data = await db.users.find_one({"email": email})
    if user_data:
        return User(**user_data)
    return None

async def get_user_by_id(user_id: str):
    user_data = await db.users.find_one({"id": user_id})
    if user_data:
        return User(**user_data)
    return None

async def authenticate_user(email: str, password: str):
    user = await get_user_by_email(email)
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user

async def get_user_affiliations(user_id: str):
    """Get all affiliations for a user with detailed information"""
    user_affiliations = await db.user_affiliations.find({"user_id": user_id, "is_active": True}).to_list(100)
    
    affiliations_data = []
    for ua in user_affiliations:
        affiliation = await db.affiliations.find_one({"id": ua["affiliation_id"]})
        if affiliation:
            # Remove MongoDB's _id field to avoid serialization issues
            affiliation.pop("_id", None)
            ua.pop("_id", None)
            
            affiliations_data.append({
                "id": ua["id"],
                "user_role_in_org": ua["user_role_in_org"],
                "start_date": ua.get("start_date"),
                "end_date": ua.get("end_date"),
                "verification_level": ua["verification_level"],
                "affiliation": affiliation
            })
    
    return affiliations_data

async def find_or_create_affiliation(affiliation_data: AffiliationCreate) -> str:
    """Find existing affiliation or create new one"""
    existing = await db.affiliations.find_one({
        "name": affiliation_data.name,
        "type": affiliation_data.type
    })
    
    if existing:
        return existing["id"]
    
    new_affiliation = Affiliation(**affiliation_data.dict())
    await db.affiliations.insert_one(new_affiliation.dict())
    return new_affiliation.id

async def create_auto_family_groups(user_id: str):
    """Auto-create Family and Relatives groups for new users"""
    user = await get_user_by_id(user_id)
    if not user:
        return
    
    # Create Family group
    family_group = ChatGroup(
        name=f"{user.first_name}'s Family",
        description="Household family members",
        group_type="FAMILY",
        admin_id=user_id,
        color_code="#059669"  # Family green
    )
    await db.chat_groups.insert_one(family_group.dict())
    
    # Add user as admin member
    family_member = ChatGroupMember(
        group_id=family_group.id,
        user_id=user_id,
        role="ADMIN"
    )
    await db.chat_group_members.insert_one(family_member.dict())
    
    # Create Relatives group
    relatives_group = ChatGroup(
        name=f"{user.first_name}'s Relatives",
        description="Extended family and relatives",
        group_type="RELATIVES",
        admin_id=user_id,
        color_code="#047857"  # Darker green for relatives
    )
    await db.chat_groups.insert_one(relatives_group.dict())
    
    # Add user as admin member
    relatives_member = ChatGroupMember(
        group_id=relatives_group.id,
        user_id=user_id,
        role="ADMIN"
    )
    await db.chat_group_members.insert_one(relatives_member.dict())
    
    return [family_group.id, relatives_group.id]

async def get_user_family_connections(user_id: str) -> List[str]:
    """Get all family member user IDs for a given user (supports both old families and new family profiles)"""
    # Get family memberships (works for both old families and new family profiles)
    family_memberships = await db.family_members.find({
        "user_id": user_id, 
        "is_active": True,
        "invitation_accepted": True  # Only include accepted invitations
    }).to_list(100)
    
    connected_users = set()
    
    for membership in family_memberships:
        # Get all other members of the same family
        family_members = await db.family_members.find({
            "family_id": membership["family_id"], 
            "is_active": True,
            "invitation_accepted": True
        }).to_list(100)
        
        for member in family_members:
            connected_users.add(member["user_id"])
        
        # Also get users from subscribed families (for family profile system)
        user_family_ids = [membership["family_id"]]
        subscriptions = await db.family_subscriptions.find({
            "subscriber_family_id": {"$in": user_family_ids},
            "is_active": True,
            "status": "ACTIVE"
        }).to_list(100)
        
        for sub in subscriptions:
            # Get members of subscribed family
            subscribed_family_members = await db.family_members.find({
                "family_id": sub["target_family_id"],
                "is_active": True,
                "invitation_accepted": True
            }).to_list(100)
            
            for member in subscribed_family_members:
                connected_users.add(member["user_id"])
    
    return list(connected_users)

async def get_user_organization_connections(user_id: str) -> List[str]:
    """Get all organization colleague user IDs for a given user"""
    user_affiliations = await db.user_affiliations.find({"user_id": user_id, "is_active": True}).to_list(100)
    
    connected_users = set()
    
    for affiliation in user_affiliations:
        # Get all other users in the same organization
        org_members = await db.user_affiliations.find({
            "affiliation_id": affiliation["affiliation_id"],
            "is_active": True
        }).to_list(100)
        
        for member in org_members:
            connected_users.add(member["user_id"])
    
    return list(connected_users)

async def get_module_connections(user_id: str, module: str) -> List[str]:
    """Get connected user IDs based on module type"""
    if module == "family":
        family_connections = await get_user_family_connections(user_id)
        # Always include the user's own ID so they can see their own posts
        connected_users = set(family_connections)
        connected_users.add(user_id)
        return list(connected_users)
    elif module == "organizations":
        org_connections = await get_user_organization_connections(user_id)
        # Always include the user's own ID so they can see their own posts
        connected_users = set(org_connections)
        connected_users.add(user_id)
        return list(connected_users)
    elif module in ["news", "journal", "services", "marketplace", "finance", "events"]:
        # For other modules, use a combination of family and organization connections
        family_connections = await get_user_family_connections(user_id)
        org_connections = await get_user_organization_connections(user_id)
        connected_users = set(family_connections + org_connections)
        # Always include the user's own ID so they can see their own posts
        connected_users.add(user_id)
        return list(connected_users)
    else:
        return [user_id]  # Only user's own posts for unknown modules

async def get_user_chat_groups(user_id: str):
    """Get all chat groups where user is a member"""
    memberships = await db.chat_group_members.find({"user_id": user_id, "is_active": True}).to_list(100)
    
    groups = []
    for membership in memberships:
        group = await db.chat_groups.find_one({"id": membership["group_id"], "is_active": True})
        if group:
            # Remove MongoDB _id
            group.pop("_id", None)
            membership.pop("_id", None)
            
            # Get member count
            member_count = await db.chat_group_members.count_documents({
                "group_id": group["id"], 
                "is_active": True
            })
            
            # Get latest message
            latest_message = await db.chat_messages.find_one(
                {"group_id": group["id"], "is_deleted": False},
                sort=[("created_at", -1)]
            )
            if latest_message:
                latest_message.pop("_id", None)
            
            groups.append({
                "group": group,
                "user_role": membership["role"],
                "member_count": member_count,
                "latest_message": latest_message,
                "joined_at": membership["joined_at"]
            })
    
    return groups

# === NEW FAMILY SYSTEM HELPER FUNCTIONS ===

async def find_matching_family_units(address_street: str, address_city: str, address_country: str, last_name: str, phone: Optional[str] = None) -> List[Dict]:
    """Intelligent matching system to find existing family units"""
    matches = []
    
    # Build query - must match address + last name
    query = {
        "address_street": {"$regex": f".*{address_street}.*", "$options": "i"},
        "address_city": {"$regex": f".*{address_city}.*", "$options": "i"},
        "address_country": {"$regex": f".*{address_country}.*", "$options": "i"},
        "family_surname": {"$regex": f".*{last_name}.*", "$options": "i"},
        "is_active": True
    }
    
    family_units = await db.family_units.find(query).to_list(10)
    
    for family_unit in family_units:
        family_unit.pop("_id", None)
        
        # Calculate match score
        match_score = 0
        if family_unit.get("address_street", "").lower() == address_street.lower():
            match_score += 1
        if family_unit.get("family_surname", "").lower() == last_name.lower():
            match_score += 1
        if phone and family_unit.get("creator_id"):
            # Check if any family member has matching phone
            creator = await db.users.find_one({"id": family_unit["creator_id"]})
            if creator and creator.get("phone") == phone:
                match_score += 1
        
        if match_score >= 2:  # At least 2 out of 3 criteria
            matches.append({
                "family_unit": family_unit,
                "match_score": match_score
            })
    
    # Sort by match score descending
    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return matches

async def get_user_family_units(user_id: str) -> List[str]:
    """Get list of family unit IDs user belongs to"""
    memberships = await db.family_unit_members.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(100)
    return [m["family_unit_id"] for m in memberships]

async def is_family_unit_head(user_id: str, family_unit_id: str) -> bool:
    """Check if user is head of family unit"""
    membership = await db.family_unit_members.find_one({
        "family_unit_id": family_unit_id,
        "user_id": user_id,
        "role": FamilyUnitRole.HEAD.value,
        "is_active": True
    })
    return membership is not None

async def get_family_unit_heads(family_unit_ids: List[str]) -> List[str]:
    """Get user IDs of all family unit heads"""
    heads = []
    for family_unit_id in family_unit_ids:
        memberships = await db.family_unit_members.find({
            "family_unit_id": family_unit_id,
            "role": FamilyUnitRole.HEAD.value,
            "is_active": True
        }).to_list(10)
        for m in memberships:
            heads.append(m["user_id"])
    return heads

async def check_vote_majority(join_request_id: str) -> bool:
    """Check if join request has majority approval"""
    join_request = await db.family_join_requests.find_one({"id": join_request_id})
    if not join_request:
        return False
    
    votes = join_request.get("votes", [])
    approve_count = sum(1 for v in votes if v["vote"] == VoteChoice.APPROVE.value)
    
    return approve_count >= join_request.get("votes_required", 0)

# === END NEW FAMILY SYSTEM HELPER FUNCTIONS ===

# === API ENDPOINTS ===

@api_router.post("/auth/register", response_model=Token)
async def register_user(user_data: UserRegistration):
    # Check if user already exists
    existing_user = await get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        middle_name=user_data.middle_name,
        phone=user_data.phone,
        date_of_birth=user_data.date_of_birth,
        gender=user_data.gender  # NEW: Save gender
    )
    
    await db.users.insert_one(new_user.dict())
    
    # Auto-create family groups for new user
    await create_auto_family_groups(new_user.id)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.id}, expires_delta=access_token_expires
    )
    
    # Get user with affiliations for response
    affiliations = await get_user_affiliations(new_user.id)
    user_response = UserResponse(
        id=new_user.id,
        email=new_user.email,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        middle_name=new_user.middle_name,
        role=new_user.role,
        is_active=new_user.is_active,
        is_verified=new_user.is_verified,
        privacy_settings=new_user.privacy_settings,
        created_at=new_user.created_at,
        affiliations=affiliations
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/login", response_model=Token)
async def login_user(login_data: UserLogin):
    user = await authenticate_user(login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update last login
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    # Get user with affiliations for response
    affiliations = await get_user_affiliations(user.id)
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        role=user.role,
        is_active=user.is_active,
        is_verified=user.is_verified,
        privacy_settings=user.privacy_settings,
        created_at=user.created_at,
        affiliations=affiliations,
        # Family system fields
        address_street=user.address_street,
        address_city=user.address_city,
        address_state=user.address_state,
        address_country=user.address_country,
        address_postal_code=user.address_postal_code,
        marriage_status=user.marriage_status,
        profile_completed=user.profile_completed
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    affiliations = await get_user_affiliations(current_user.id)
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        middle_name=current_user.middle_name,
        name_alias=current_user.name_alias,
        gender=current_user.gender,  # NEW: Include gender
        profile_picture=current_user.profile_picture,
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        privacy_settings=current_user.privacy_settings,
        created_at=current_user.created_at,
        affiliations=affiliations,
        # Family system fields
        address_street=current_user.address_street,
        address_city=current_user.address_city,
        address_state=current_user.address_state,
        address_country=current_user.address_country,
        address_postal_code=current_user.address_postal_code,
        marriage_status=current_user.marriage_status,
        profile_completed=current_user.profile_completed
    )

@api_router.put("/users/gender")
async def update_user_gender(
    gender_data: GenderUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user's gender"""
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "gender": gender_data.gender.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Gender updated successfully", "gender": gender_data.gender.value}

@api_router.put("/auth/change-password")
async def change_password(
    password_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Текущий и новый пароль обязательны")
    
    # Verify current password
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc or not verify_password(current_password, user_doc.get("hashed_password")):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    
    # Hash and update new password
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "hashed_password": hashed_password,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Пароль успешно изменен"}

@api_router.delete("/auth/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user)
):
    """Delete user account permanently"""
    
    # Find user's family profile where they are the creator
    family_profile = await db.family_profiles.find_one({
        "created_by": current_user.id,
        "is_deleted": {"$ne": True}
    })
    
    if family_profile:
        # Get all adult members of the family (excluding the current user)
        family_members = await db.family_members.find({
            "family_id": family_profile["id"],
            "user_id": {"$ne": current_user.id},
            "is_deleted": {"$ne": True}
        }).to_list(None)
        
        # Filter adult members (you can adjust age logic as needed)
        adult_members = []
        for member in family_members:
            user = await db.users.find_one({"id": member["user_id"]})
            if user:
                # Consider anyone 18+ as adult
                if user.get("date_of_birth"):
                    from datetime import date
                    birth_date = user["date_of_birth"]
                    if isinstance(birth_date, str):
                        birth_date = datetime.fromisoformat(birth_date).date()
                    age = (date.today() - birth_date).days / 365.25
                    if age >= 18:
                        adult_members.append(user)
                else:
                    # If no birth date, assume adult
                    adult_members.append(user)
        
        # Mark the original family profile as deleted
        await db.family_profiles.update_one(
            {"id": family_profile["id"]},
            {"$set": {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc),
                "deleted_by": current_user.id
            }}
        )
        
        # Create new family profiles for each adult member
        for adult_user in adult_members:
            new_family_id = str(uuid.uuid4())
            new_family = {
                "id": new_family_id,
                "family_name": f"Семья {adult_user.get('last_name', '')}",
                "family_surname": adult_user.get("last_name", ""),
                "description": f"Автоматически созданный профиль после удаления семьи {family_profile.get('family_name', '')}",
                "created_by": adult_user["id"],
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "is_private": True,
                "is_deleted": False
            }
            await db.family_profiles.insert_one(new_family)
            
            # Add the user as a member of their new family
            new_member = {
                "id": str(uuid.uuid4()),
                "family_id": new_family_id,
                "user_id": adult_user["id"],
                "role": "PARENT",
                "joined_at": datetime.now(timezone.utc),
                "is_deleted": False
            }
            await db.family_members.insert_one(new_member)
            
            # TODO: Send notification to the user about new family profile
            # This would require a notification system to be implemented
    
    # Delete user's posts, comments, etc.
    await db.posts.update_many(
        {"author_id": current_user.id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    # Remove user from all family memberships
    await db.family_members.update_many(
        {"user_id": current_user.id},
        {"$set": {"is_deleted": True, "left_at": datetime.now(timezone.utc)}}
    )
    
    # Delete user account
    await db.users.delete_one({"id": current_user.id})
    
    return {"message": "Аккаунт успешно удален"}

@api_router.put("/users/profile-picture")
async def update_profile_picture(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update user profile picture"""
    profile_picture = data.get("profile_picture")
    
    if not profile_picture:
        raise HTTPException(status_code=400, detail="Изображение не предоставлено")
    
    # Update user's profile picture
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "profile_picture": profile_picture,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Фото профиля обновлено", "profile_picture": profile_picture}

@api_router.delete("/users/profile-picture")
async def delete_profile_picture(
    current_user: User = Depends(get_current_user)
):
    """Delete user profile picture"""
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "profile_picture": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Фото профиля удалено"}

@api_router.post("/onboarding")
async def complete_onboarding(
    onboarding_data: OnboardingData,
    current_user: User = Depends(get_current_user)
):
    """Complete user onboarding with affiliations"""
    affiliations_created = []
    
    # Process work affiliation
    if onboarding_data.work_place and onboarding_data.work_role:
        affiliation_data = AffiliationCreate(
            name=onboarding_data.work_place,
            type=AffiliationType.WORK
        )
        affiliation_id = await find_or_create_affiliation(affiliation_data)
        
        user_affiliation = UserAffiliation(
            user_id=current_user.id,
            affiliation_id=affiliation_id,
            user_role_in_org=onboarding_data.work_role,
            start_date=datetime.now(timezone.utc)
        )
        await db.user_affiliations.insert_one(user_affiliation.dict())
        affiliations_created.append("work")
    
    # Process university affiliation  
    if onboarding_data.university and onboarding_data.university_role:
        affiliation_data = AffiliationCreate(
            name=onboarding_data.university,
            type=AffiliationType.UNIVERSITY
        )
        affiliation_id = await find_or_create_affiliation(affiliation_data)
        
        user_affiliation = UserAffiliation(
            user_id=current_user.id,
            affiliation_id=affiliation_id,
            user_role_in_org=onboarding_data.university_role,
            start_date=datetime.now(timezone.utc)
        )
        await db.user_affiliations.insert_one(user_affiliation.dict())
        affiliations_created.append("university")
    
    # Process school affiliation
    if onboarding_data.school and onboarding_data.school_role:
        affiliation_data = AffiliationCreate(
            name=onboarding_data.school,
            type=AffiliationType.SCHOOL
        )
        affiliation_id = await find_or_create_affiliation(affiliation_data)
        
        user_affiliation = UserAffiliation(
            user_id=current_user.id,
            affiliation_id=affiliation_id,
            user_role_in_org=onboarding_data.school_role,
            start_date=datetime.now(timezone.utc)
        )
        await db.user_affiliations.insert_one(user_affiliation.dict())
        affiliations_created.append("school")
    
    # Update privacy settings if provided
    if onboarding_data.privacy_settings:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {
                "privacy_settings": onboarding_data.privacy_settings.dict(),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    
    return {
        "message": "Onboarding completed successfully",
        "affiliations_created": affiliations_created
    }

@api_router.get("/affiliations", response_model=List[Affiliation])
async def get_affiliations(skip: int = 0, limit: int = 100):
    """Get all available affiliations"""
    affiliations = await db.affiliations.find({"is_active": True}).skip(skip).limit(limit).to_list(limit)
    return [Affiliation(**affiliation) for affiliation in affiliations]

@api_router.post("/affiliations", response_model=Affiliation)
async def create_affiliation(affiliation_data: AffiliationCreate):
    """Create new affiliation"""
    new_affiliation = Affiliation(**affiliation_data.dict())
    await db.affiliations.insert_one(new_affiliation.dict())
    return new_affiliation

@api_router.post("/user-affiliations")
async def create_user_affiliation(
    affiliation_data: UserAffiliationCreate,
    current_user: User = Depends(get_current_user)
):
    """Add affiliation to user"""
    user_affiliation = UserAffiliation(
        user_id=current_user.id,
        affiliation_id=affiliation_data.affiliation_id,
        user_role_in_org=affiliation_data.user_role_in_org,
        start_date=affiliation_data.start_date,
        end_date=affiliation_data.end_date
    )
    
    await db.user_affiliations.insert_one(user_affiliation.dict())
    return {"message": "Affiliation added successfully"}

@api_router.get("/user-affiliations")
async def get_user_affiliations_endpoint(current_user: User = Depends(get_current_user)):
    """Get current user's affiliations"""
    affiliations = await get_user_affiliations(current_user.id)
    return {"affiliations": affiliations}

# === FAMILY PROFILE SYSTEM API ENDPOINTS ===

@api_router.post("/family-profiles", response_model=FamilyProfileResponse)
async def create_family_profile(
    family_data: FamilyProfileCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new family profile"""
    # Only adults can create family profiles
    if current_user.role == UserRole.CHILD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only adults can create family profiles"
        )
    
    # Create family profile
    new_family = FamilyProfile(
        **family_data.dict(),
        creator_id=current_user.id
    )
    
    await db.family_profiles.insert_one(new_family.dict())
    
    # Add creator as family admin
    family_member = FamilyMember(
        family_id=new_family.id,
        user_id=current_user.id,
        family_role=FamilyRole.CREATOR,
        invitation_accepted=True  # Creator automatically accepts
    )
    await db.family_members.insert_one(family_member.dict())
    
    # Return response with user membership info
    response_data = new_family.dict()
    response_data.update({
        "is_user_member": True,
        "user_role": FamilyRole.CREATOR,
        "subscription_status": None
    })
    
    return FamilyProfileResponse(**response_data)

@api_router.post("/family/create-with-members")
async def create_family_with_members(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a new family profile with members (from FamilyStatusForm)"""
    try:
        # Extract data
        family_name = data.get("name")
        surname = data.get("surname", "")
        description = data.get("description", "")
        privacy_level = data.get("privacy_level", "PRIVATE")
        members = data.get("members", [])
        
        if not family_name:
            raise HTTPException(status_code=400, detail="Family name is required")
        
        # Create family profile with correct field names matching FamilyProfileResponse
        new_family = {
            "id": str(uuid.uuid4()),
            "family_name": family_name,  # Changed from 'name'
            "family_surname": surname,    # Changed from 'surname'
            "description": description,
            "public_bio": description,
            "primary_address": None,
            "city": None,
            "state": None,
            "country": None,
            "established_date": datetime.now(timezone.utc),
            "family_photo_url": None,
            "is_private": privacy_level == "PRIVATE",
            "allow_public_discovery": privacy_level == "PUBLIC",
            "member_count": len(members),
            "children_count": len([m for m in members if m.get("role") == "CHILD"]),
            "creator_id": current_user.id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True,
            # Extra fields for frontend compatibility
            "type": "NODE",
            "privacy_level": privacy_level,
            "created_by": current_user.id,
            "posts_count": 0,
            "followers_count": 0,
            "events_count": 0
        }
        
        await db.family_profiles.insert_one(new_family)
        
        # Add family members
        for member in members:
            family_member = {
                "id": str(uuid.uuid4()),
                "family_id": new_family["id"],
                "user_id": member.get("user_id", current_user.id),  # Use current_user.id if no user_id
                "family_role": member.get("role", "PARENT"),
                "is_creator": member.get("is_creator", False),
                "is_active": True,
                "invitation_accepted": True,
                "joined_at": datetime.now(timezone.utc)
            }
            
            # Store additional info for non-registered members
            if not member.get("user_id"):
                family_member["first_name"] = member.get("first_name", "")
                family_member["last_name"] = member.get("last_name", "")
                family_member["date_of_birth"] = member.get("date_of_birth")
            
            await db.family_members.insert_one(family_member)
        
        return {
            "success": True,
            "family": new_family,
            "message": "Family profile created successfully"
        }
        
    except Exception as e:
        print(f"Error creating family: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/family-profiles")
async def get_user_family_profiles(current_user: User = Depends(get_current_user)):
    """Get family profiles where user is a member"""
    family_memberships = await db.family_members.find({
        "user_id": current_user.id, 
        "is_active": True,
        "invitation_accepted": True
    }).to_list(100)
    
    families = []
    for membership in family_memberships:
        family = await db.family_profiles.find_one({"id": membership["family_id"]})
        if family:
            # Remove MongoDB's _id field before creating response
            family_dict = {k: v for k, v in family.items() if k != '_id'}
            
            try:
                family_response = FamilyProfileResponse(**family_dict)
                family_response.is_user_member = True
                family_response.user_role = FamilyRole(membership["family_role"])
                families.append(family_response)
            except Exception as e:
                print(f"Error creating family response: {str(e)}")
                print(f"Family data keys: {family_dict.keys()}")
                continue
    
    return {"family_profiles": families}

@api_router.get("/family-profiles/{family_id}", response_model=FamilyProfileResponse)
async def get_family_profile(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific family profile"""
    family = await db.family_profiles.find_one({"id": family_id})
    if not family:
        raise HTTPException(status_code=404, detail="Family profile not found")
    
    # Check if user has access
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    subscription = await db.family_subscriptions.find_one({
        "subscriber_family_id": {"$in": await get_user_family_ids(current_user.id)},
        "target_family_id": family_id,
        "is_active": True,
        "status": "ACTIVE"
    })
    
    # Check access permissions
    if not membership and not subscription and family["is_private"]:
        raise HTTPException(status_code=403, detail="Access denied to private family profile")
    
    family_response = FamilyProfileResponse(**family)
    if membership:
        family_response.is_user_member = True
        family_response.user_role = FamilyRole(membership["family_role"])
    elif subscription:
        family_response.subscription_status = subscription["status"]
    
    return family_response

@api_router.put("/family-profiles/{family_id}/banner")
async def update_family_banner(
    family_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update family banner image"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Update banner
        banner_image = data.get("banner_image")
        result = await db.family_profiles.update_one(
            {"id": family_id},
            {"$set": {
                "banner_url": banner_image,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Banner updated"}
        else:
            raise HTTPException(status_code=404, detail="Family not found")
            
    except Exception as e:
        print(f"Banner upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/family-profiles/{family_id}/avatar")
async def update_family_avatar(
    family_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update family avatar/photo"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Update avatar
        avatar_image = data.get("avatar_image")
        result = await db.family_profiles.update_one(
            {"id": family_id},
            {"$set": {
                "family_photo_url": avatar_image,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Avatar updated"}
        else:
            raise HTTPException(status_code=404, detail="Family not found")
            
    except Exception as e:
        print(f"Avatar upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Settings Management Endpoints

@api_router.put("/family/{family_id}/update")
async def update_family_basic_info(
    family_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update family basic information (name, description, location)"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Prepare update data
        update_fields = {}
        if "family_name" in data:
            update_fields["family_name"] = data["family_name"]
        if "description" in data:
            update_fields["description"] = data["description"]
            update_fields["public_bio"] = data["description"]
        if "city" in data:
            update_fields["city"] = data["city"]
        if "location" in data:
            update_fields["primary_address"] = data["location"]
        
        update_fields["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.family_profiles.update_one(
            {"id": family_id},
            {"$set": update_fields}
        )
        
        if result.modified_count > 0:
            # Fetch updated family
            updated_family = await db.family_profiles.find_one({"id": family_id})
            family_dict = {k: v for k, v in updated_family.items() if k != '_id'}
            return {"success": True, "family": family_dict, "message": "Family updated"}
        else:
            raise HTTPException(status_code=404, detail="Family not found")
            
    except Exception as e:
        print(f"Update family error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/users/search")
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user)
):
    """Search for users by name or email"""
    try:
        if len(query) < 2:
            return {"users": []}
        
        # Search in users collection
        users = await db.users.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"surname": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ]
        }).limit(10).to_list(10)
        
        # Format user data
        user_results = []
        for user in users:
            if user["id"] != current_user.id:  # Don't include current user
                user_results.append({
                    "id": user["id"],
                    "name": user.get("name", ""),
                    "surname": user.get("surname", ""),
                    "email": user.get("email", "")
                })
        
        return {"users": user_results}
        
    except Exception as e:
        print(f"User search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/family/{family_id}/members")
async def get_family_members_list(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get list of family members with user info"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Get all family members
        members = await db.family_members.find({
            "family_id": family_id,
            "is_active": True
        }).to_list(100)
        
        # Enrich with user data
        member_list = []
        for member in members:
            user = await db.users.find_one({"id": member["user_id"]})
            if user:
                member_list.append({
                    "id": member["id"],
                    "user_id": member["user_id"],
                    "name": user.get("name", ""),
                    "surname": user.get("surname", ""),
                    "email": user.get("email", ""),
                    "relationship": member.get("relationship", "member"),
                    "family_role": member.get("family_role", "MEMBER"),
                    "is_creator": member.get("is_creator", False),
                    "joined_at": member.get("joined_at")
                })
        
        return {"success": True, "members": member_list}
        
    except Exception as e:
        print(f"Get members error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/family/{family_id}/members")
async def add_family_member(
    family_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Add a member to the family"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Get user data
        user_id = data.get("user_id")
        relationship = data.get("relationship", "other")
        
        # Check if user exists
        member_user = await db.users.find_one({"id": user_id})
        if not member_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if already a member
        existing_member = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": user_id,
            "is_active": True
        })
        
        if existing_member:
            raise HTTPException(status_code=400, detail="User is already a family member")
        
        # Add member
        new_member = {
            "id": str(uuid.uuid4()),
            "family_id": family_id,
            "user_id": user_id,
            "family_role": "MEMBER",
            "relationship": relationship,
            "is_creator": False,
            "is_active": True,
            "invitation_accepted": True,
            "joined_at": datetime.now(timezone.utc)
        }
        
        await db.family_members.insert_one(new_member)
        
        # Update family member count
        await db.family_profiles.update_one(
            {"id": family_id},
            {"$inc": {"member_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        
        # Return member with user info
        member_response = {
            "id": new_member["id"],
            "name": member_user.get("name", ""),
            "surname": member_user.get("surname", ""),
            "relationship": relationship
        }
        
        return {"success": True, "member": member_response}
        
    except Exception as e:
        print(f"Add member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/family/{family_id}/members/{member_id}")
async def remove_family_member(
    family_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a member from the family"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Remove member
        result = await db.family_members.update_one(
            {"id": member_id, "family_id": family_id},
            {"$set": {"is_active": False}}
        )
        
        if result.modified_count > 0:
            # Update family member count
            await db.family_profiles.update_one(
                {"id": family_id},
                {"$inc": {"member_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
            )
            return {"success": True, "message": "Member removed"}
        else:
            raise HTTPException(status_code=404, detail="Member not found")
            
    except Exception as e:
        print(f"Remove member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/family/{family_id}/privacy")
async def update_family_privacy_settings(
    family_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update family privacy settings"""
    try:
        # Check if user is member/admin
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Prepare privacy settings update
        privacy_fields = {}
        if "is_private" in data:
            privacy_fields["is_private"] = data["is_private"]
        if "allow_public_discovery" in data:
            privacy_fields["allow_public_discovery"] = data["allow_public_discovery"]
        if "who_can_see_posts" in data:
            privacy_fields["who_can_see_posts"] = data["who_can_see_posts"]
        if "who_can_comment" in data:
            privacy_fields["who_can_comment"] = data["who_can_comment"]
        if "profile_searchability" in data:
            privacy_fields["profile_searchability"] = data["profile_searchability"]
        
        privacy_fields["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.family_profiles.update_one(
            {"id": family_id},
            {"$set": privacy_fields}
        )
        
        if result.modified_count > 0:
            # Fetch updated family
            updated_family = await db.family_profiles.find_one({"id": family_id})
            family_dict = {k: v for k, v in updated_family.items() if k != '_id'}
            return {"success": True, "family": family_dict, "message": "Privacy settings updated"}
        else:
            raise HTTPException(status_code=404, detail="Family not found")
            
    except Exception as e:
        print(f"Update privacy error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/family/{family_id}")
async def delete_family(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete family profile (creator only)"""
    try:
        # Check if user is creator
        membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_creator": True,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Only family creator can delete the family")
        
        # Delete family and related data
        await db.family_profiles.delete_one({"id": family_id})
        await db.family_members.delete_many({"family_id": family_id})
        await db.family_posts.delete_many({"family_id": family_id})
        await db.family_invitations.delete_many({"family_id": family_id})
        
        return {"success": True, "message": "Family deleted successfully"}
        
    except Exception as e:
        print(f"Delete family error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# END: Settings Management Endpoints

# ============================================
#   HOUSEHOLD MANAGEMENT ENDPOINTS
# ============================================

@api_router.post("/household/create")
async def create_household(
    data: HouseholdCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new household"""
    try:
        # Create household
        new_household = {
            "id": str(uuid.uuid4()),
            "household_name": data.household_name,
            "address_street": data.address_street,
            "address_city": data.address_city,
            "address_state": data.address_state,
            "address_country": data.address_country,
            "address_postal_code": data.address_postal_code,
            "creator_id": current_user.id,
            "member_count": 1 + len(data.members),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        await db.households.insert_one(new_household)
        
        # Add creator as first member
        creator_member = {
            "id": str(uuid.uuid4()),
            "household_id": new_household["id"],
            "user_id": current_user.id,
            "name": current_user.name,
            "surname": current_user.surname,
            "relationship": "owner",
            "is_creator": True,
            "joined_at": datetime.now(timezone.utc),
            "is_active": True
        }
        await db.household_members.insert_one(creator_member)
        
        # Add additional members
        for member in data.members:
            household_member = {
                "id": str(uuid.uuid4()),
                "household_id": new_household["id"],
                "user_id": member.get("user_id"),
                "name": member.get("name", ""),
                "surname": member.get("surname", ""),
                "relationship": member.get("relationship", "member"),
                "is_creator": False,
                "joined_at": datetime.now(timezone.utc),
                "is_active": True
            }
            await db.household_members.insert_one(household_member)
        
        return {
            "success": True,
            "household": new_household,
            "message": "Household created successfully"
        }
        
    except Exception as e:
        print(f"Error creating household: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/household")
async def get_user_household(current_user: User = Depends(get_current_user)):
    """Get user's household"""
    try:
        # Find household where user is a member
        membership = await db.household_members.find_one({
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            return {"household": None, "members": []}
        
        # Get household details
        household = await db.households.find_one({"id": membership["household_id"]})
        if not household:
            return {"household": None, "members": []}
        
        # Get all members
        members = await db.household_members.find({
            "household_id": household["id"],
            "is_active": True
        }).to_list(100)
        
        # Enrich members with user data
        enriched_members = []
        for member in members:
            member_data = {
                "id": member["id"],
                "name": member["name"],
                "surname": member.get("surname", ""),
                "relationship": member["relationship"],
                "is_creator": member.get("is_creator", False)
            }
            
            # If linked to user, get additional info
            if member.get("user_id"):
                user = await db.users.find_one({"id": member["user_id"]})
                if user:
                    member_data["email"] = user.get("email", "")
                    member_data["user_id"] = user["id"]
            
            enriched_members.append(member_data)
        
        # Remove MongoDB _id
        household.pop("_id", None)
        
        return {
            "household": household,
            "members": enriched_members
        }
        
    except Exception as e:
        print(f"Error getting household: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/household/{household_id}/update")
async def update_household(
    household_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update household information"""
    try:
        # Check if user is member
        membership = await db.household_members.find_one({
            "household_id": household_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a household member")
        
        # Update household
        update_fields = {}
        if "household_name" in data:
            update_fields["household_name"] = data["household_name"]
        if "address_street" in data:
            update_fields["address_street"] = data["address_street"]
        if "address_city" in data:
            update_fields["address_city"] = data["address_city"]
        if "address_state" in data:
            update_fields["address_state"] = data["address_state"]
        if "address_country" in data:
            update_fields["address_country"] = data["address_country"]
        if "address_postal_code" in data:
            update_fields["address_postal_code"] = data["address_postal_code"]
        
        update_fields["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.households.update_one(
            {"id": household_id},
            {"$set": update_fields}
        )
        
        if result.modified_count > 0:
            updated_household = await db.households.find_one({"id": household_id})
            updated_household.pop("_id", None)
            return {"success": True, "household": updated_household}
        else:
            raise HTTPException(status_code=404, detail="Household not found")
            
    except Exception as e:
        print(f"Update household error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/household/{household_id}/members")
async def add_household_member(
    household_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Add member to household"""
    try:
        # Check if user is member
        membership = await db.household_members.find_one({
            "household_id": household_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a household member")
        
        # Add new member
        new_member = {
            "id": str(uuid.uuid4()),
            "household_id": household_id,
            "user_id": data.get("user_id"),
            "name": data.get("name", ""),
            "surname": data.get("surname", ""),
            "relationship": data.get("relationship", "member"),
            "is_creator": False,
            "joined_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        # If user_id provided, get user info
        if new_member["user_id"]:
            user = await db.users.find_one({"id": new_member["user_id"]})
            if user:
                new_member["name"] = user.get("name", "")
                new_member["surname"] = user.get("surname", "")
        
        await db.household_members.insert_one(new_member)
        
        # Update member count
        await db.households.update_one(
            {"id": household_id},
            {"$inc": {"member_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        
        new_member.pop("_id", None)
        return {"success": True, "member": new_member}
        
    except Exception as e:
        print(f"Add household member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/household/{household_id}/members/{member_id}")
async def remove_household_member(
    household_id: str,
    member_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove member from household"""
    try:
        # Check if user is member
        membership = await db.household_members.find_one({
            "household_id": household_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a household member")
        
        # Cannot remove creator
        member_to_remove = await db.household_members.find_one({"id": member_id})
        if member_to_remove and member_to_remove.get("is_creator"):
            raise HTTPException(status_code=403, detail="Cannot remove household creator")
        
        # Remove member
        result = await db.household_members.update_one(
            {"id": member_id, "household_id": household_id},
            {"$set": {"is_active": False}}
        )
        
        if result.modified_count > 0:
            # Update member count
            await db.households.update_one(
                {"id": household_id},
                {"$inc": {"member_count": -1}, "$set": {"updated_at": datetime.now(timezone.utc)}}
            )
            return {"success": True, "message": "Member removed"}
        else:
            raise HTTPException(status_code=404, detail="Member not found")
            
    except Exception as e:
        print(f"Remove household member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/household/{household_id}")
async def delete_household(
    household_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete household (creator only)"""
    try:
        # Check if user is creator
        membership = await db.household_members.find_one({
            "household_id": household_id,
            "user_id": current_user.id,
            "is_creator": True,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Only household creator can delete")
        
        # Delete household and members
        await db.households.delete_one({"id": household_id})
        await db.household_members.delete_many({"household_id": household_id})
        
        return {"success": True, "message": "Household deleted"}
        
    except Exception as e:
        print(f"Delete household error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# END: Household Management Endpoints

# ============================================
#   PUBLIC FAMILY PROFILE ENDPOINTS
# ============================================

@api_router.get("/family/{family_id}/public")
async def get_public_family_profile(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get public view of family profile (privacy-aware)"""
    try:
        # Helper function to sanitize data
        def sanitize_value(value):
            if isinstance(value, datetime):
                return value.isoformat()
            elif hasattr(value, '__dict__'):
                return str(value)
            return value
        
        # Get family profile
        family = await db.family_profiles.find_one({"id": family_id})
        if not family:
            raise HTTPException(status_code=404, detail="Family not found")
        
        # Remove MongoDB _id field
        family.pop('_id', None)
        
        # Check if user is a member
        is_member = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        # Apply privacy settings
        is_private = family.get("is_private", False)
        
        # If private and not a member, deny access
        if is_private and not is_member:
            raise HTTPException(
                status_code=403, 
                detail="This family profile is private"
            )
        
        # Build public profile data
        public_profile = {
            "id": str(family.get("id", "")),
            "family_name": str(family.get("family_name", "")),
            "family_surname": str(family.get("family_surname", "")),
            "city": str(family.get("city", "")),
            "member_count": int(family.get("member_count", 0)),
            "created_at": sanitize_value(family.get("created_at")),
            "family_photo_url": str(family.get("family_photo_url", "")) if family.get("family_photo_url") else None,
            "banner_url": str(family.get("banner_url", "")) if family.get("banner_url") else None,
            "is_private": bool(is_private),
            "is_member": bool(is_member),
            "is_preview_mode": bool(is_member)
        }
        
        # Add description if allowed
        if not is_private or is_member:
            public_profile["description"] = str(family.get("public_bio") or family.get("description") or "")
        
        # Get members (limited info)
        members_cursor = db.family_members.find({
            "family_id": family_id,
            "is_active": True
        })
        members = await members_cursor.to_list(100)
        
        # Sanitize member data
        public_members = []
        for member in members:
            member.pop('_id', None)
            user = await db.users.find_one({"id": member["user_id"]})
            if user:
                user.pop('_id', None)
                public_members.append({
                    "name": str(user.get("name", "")),
                    "surname": str(user.get("surname", "")),
                    "relationship": str(member.get("relationship", "member")),
                    "is_creator": bool(member.get("is_creator", False))
                })
        
        public_profile["members"] = public_members
        
        # Get posts based on privacy settings
        who_can_see_posts = family.get("who_can_see_posts", "family")
        posts = []
        
        if is_member or who_can_see_posts == "public":
            # Get family posts
            posts_cursor = db.posts.find({
                "family_id": family_id,
                "is_published": True
            }).sort("created_at", -1).limit(10)
            family_posts = await posts_cursor.to_list(10)
            
            for post in family_posts:
                post.pop('_id', None)
                # Get author info
                author = await db.users.find_one({"id": post["user_id"]})
                if author:
                    author.pop('_id', None)
                
                posts.append({
                    "id": str(post.get("id", "")),
                    "content": str(post.get("content", "")),
                    "created_at": sanitize_value(post.get("created_at")),
                    "author_name": str(author.get("name", "")) if author else "",
                    "like_count": int(post.get("like_count", 0)),
                    "comment_count": int(post.get("comment_count", 0))
                })
        
        public_profile["posts"] = posts
        public_profile["posts_visible"] = bool(is_member or who_can_see_posts == "public")
        public_profile["who_can_see_posts"] = str(who_can_see_posts)
        
        return {"success": True, "profile": public_profile}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting public profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# END: Public Family Profile Endpoints



@api_router.put("/family-profiles/{family_id}")
async def update_family_profile(
    family_id: str,
    update_data: FamilyProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update family profile (admin only)"""
    # Check if user is admin
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "family_role": {"$in": [FamilyRole.CREATOR.value, FamilyRole.ADMIN.value]},
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only family admins can update family profiles")
    
    # Update family profile
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.family_profiles.update_one(
        {"id": family_id},
        {"$set": update_dict}
    )
    
    return {"message": "Family profile updated successfully"}

@api_router.post("/family-profiles/{family_id}/invite")
async def invite_family_member(
    family_id: str,
    invitation_data: FamilyMemberInvite,
    current_user: User = Depends(get_current_user)
):
    """Send invitation to join family (admin only)"""
    # Check if user is admin
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "family_role": {"$in": [FamilyRole.CREATOR.value, FamilyRole.ADMIN.value]},
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only family admins can send invitations")
    
    # Check if family exists
    family = await db.family_profiles.find_one({"id": family_id})
    if not family:
        raise HTTPException(status_code=404, detail="Family profile not found")
    
    # Check if user is already invited or a member
    existing_invitation = await db.family_invitations.find_one({
        "family_id": family_id,
        "invited_user_email": invitation_data.invited_user_email,
        "status": "PENDING",
        "is_active": True
    })
    
    if existing_invitation:
        raise HTTPException(status_code=400, detail="Invitation already sent to this email")
    
    # Check if user already exists in system
    invited_user = await db.users.find_one({"email": invitation_data.invited_user_email})
    invited_user_id = invited_user["id"] if invited_user else None
    
    # Create invitation
    invitation = FamilyInvitation(
        family_id=family_id,
        invited_by_user_id=current_user.id,
        invited_user_email=invitation_data.invited_user_email,
        invited_user_id=invited_user_id,
        invitation_type=invitation_data.invitation_type,
        relationship_to_family=invitation_data.relationship_to_family,
        message=invitation_data.message,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)  # 7-day expiry
    )
    
    await db.family_invitations.insert_one(invitation.dict())
    
    # TODO: Send email notification here
    
    return {"message": "Invitation sent successfully", "invitation_id": invitation.id}

@api_router.get("/family-profiles/{family_id}/members")
async def get_family_members(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get family members (members only)"""
    # Check if user has access
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        # Check subscription access
        subscription = await db.family_subscriptions.find_one({
            "subscriber_family_id": {"$in": await get_user_family_ids(current_user.id)},
            "target_family_id": family_id,
            "is_active": True,
            "status": "ACTIVE"
        })
        
        if not subscription:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get family members
    family_memberships = await db.family_members.find({
        "family_id": family_id,
        "is_active": True,
        "invitation_accepted": True
    }).to_list(100)
    
    members = []
    for member in family_memberships:
        user = await db.users.find_one({"id": member["user_id"]})
        if user:
            member_response = FamilyMemberResponse(
                **member,
                user_first_name=user["first_name"],
                user_last_name=user["last_name"],
                user_avatar_url=user.get("avatar_url")
            )
            members.append(member_response)
    
    return {"family_members": members}

@api_router.post("/family-invitations/{invitation_id}/accept")
async def accept_family_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Accept family invitation"""
    invitation = await db.family_invitations.find_one({"id": invitation_id})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    # Check if invitation is for current user
    if invitation["invited_user_email"] != current_user.email:
        raise HTTPException(status_code=403, detail="This invitation is not for you")
    
    if invitation["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Invitation is no longer valid")
    
    # Check if invitation has expired
    expires_at = invitation.get("expires_at")
    if expires_at:
        # Handle both timezone-aware and naive datetimes
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        elif expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invitation has expired")
    
    # Create family membership
    family_member = FamilyMember(
        family_id=invitation["family_id"],
        user_id=current_user.id,
        family_role=FamilyRole.ADMIN if invitation["invitation_type"] == "ADMIN" else FamilyRole.ADULT_MEMBER,
        relationship_to_family=invitation.get("relationship_to_family"),
        invitation_accepted=True
    )
    await db.family_members.insert_one(family_member.dict())
    
    # Update invitation status
    await db.family_invitations.update_one(
        {"id": invitation_id},
        {"$set": {
            "status": "ACCEPTED",
            "responded_at": datetime.now(timezone.utc)
        }}
    )
    
    # Update family member count
    await db.family_profiles.update_one(
        {"id": invitation["family_id"]},
        {"$inc": {"member_count": 1}}
    )
    
    return {"message": "Invitation accepted successfully"}

@api_router.post("/family-invitations/{invitation_id}/decline")
async def decline_family_invitation(
    invitation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Decline family invitation"""
    invitation = await db.family_invitations.find_one({"id": invitation_id})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    # Check if invitation is for current user
    if invitation["invited_user_email"] != current_user.email:
        raise HTTPException(status_code=403, detail="This invitation is not for you")
    
    if invitation["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="Invitation is no longer valid")
    
    # Check if invitation has expired
    expires_at = invitation.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        elif expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invitation has expired")
    
    # Update invitation status
    await db.family_invitations.update_one(
        {"id": invitation_id},
        {"$set": {
            "status": "DECLINED",
            "responded_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Invitation declined successfully"}

@api_router.get("/family-invitations/received")
async def get_received_invitations(
    current_user: User = Depends(get_current_user)
):
    """Get invitations received by current user"""
    invitations = await db.family_invitations.find({
        "invited_user_email": current_user.email,
        "is_active": True
    }).sort("sent_at", -1).to_list(50)
    
    # Enrich with family and sender information
    enriched_invitations = []
    for invitation in invitations:
        # Remove MongoDB _id field
        invitation.pop("_id", None)
        
        # Get family info
        family = await db.family_profiles.find_one({"id": invitation["family_id"]})
        # Get sender info
        sender = await db.users.find_one({"id": invitation["invited_by_user_id"]})
        
        if family and sender:
            # Remove MongoDB _id fields
            family.pop("_id", None)
            sender.pop("_id", None)
            
            enriched_invitation = {
                **invitation,
                "family_name": family["family_name"],
                "invited_by_name": f"{sender['first_name']} {sender['last_name']}"
            }
            enriched_invitations.append(enriched_invitation)
    
    return {"invitations": enriched_invitations}

@api_router.get("/family-invitations/sent")
async def get_sent_invitations(
    current_user: User = Depends(get_current_user)
):
    """Get invitations sent by current user"""
    invitations = await db.family_invitations.find({
        "invited_by_user_id": current_user.id,
        "is_active": True
    }).sort("sent_at", -1).to_list(50)
    
    # Enrich with family information
    enriched_invitations = []
    for invitation in invitations:
        # Remove MongoDB _id field
        invitation.pop("_id", None)
        
        # Get family info
        family = await db.family_profiles.find_one({"id": invitation["family_id"]})
        
        if family:
            # Remove MongoDB _id field
            family.pop("_id", None)
            
            enriched_invitation = {
                **invitation,
                "family_name": family["family_name"]
            }
            enriched_invitations.append(enriched_invitation)
    
    return {"invitations": enriched_invitations}

# Helper function for family access
async def get_user_family_ids(user_id: str) -> List[str]:
    """Get list of family IDs user belongs to"""
    family_memberships = await db.family_members.find({
        "user_id": user_id,
        "is_active": True,
        "invitation_accepted": True
    }).to_list(100)
    return [membership["family_id"] for membership in family_memberships]

# === FAMILY POSTS API ENDPOINTS ===

@api_router.post("/family-profiles/{family_id}/posts", response_model=FamilyPostResponse)
async def create_family_post(
    family_id: str,
    post_data: FamilyPostCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a family post"""
    # Check if user is family member
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "is_active": True,
        "invitation_accepted": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only family members can post")
    
    # Check permissions based on role and post privacy
    user_role = FamilyRole(membership["family_role"])
    
    # Children can only create family-only posts, adults can approve them for public later
    if user_role == FamilyRole.CHILD and post_data.privacy_level == FamilyPostPrivacy.PUBLIC:
        post_data.privacy_level = FamilyPostPrivacy.FAMILY_ONLY
    
    # Only admins can create admin-only posts
    if post_data.privacy_level == FamilyPostPrivacy.ADMIN_ONLY and user_role not in [FamilyRole.CREATOR, FamilyRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only family admins can create admin-only posts")
    
    # Create family post
    family_post = FamilyPost(
        **post_data.dict(),
        family_id=family_id,
        posted_by_user_id=current_user.id
    )
    
    await db.family_posts.insert_one(family_post.dict())
    
    # Prepare response
    family = await db.family_profiles.find_one({"id": family_id})
    post_response = FamilyPostResponse(
        **family_post.dict(),
        author={
            "id": current_user.id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "avatar_url": current_user.avatar_url
        },
        family={
            "id": family["id"],
            "family_name": family["family_name"],
            "family_surname": family.get("family_surname")
        }
    )
    
    return post_response

@api_router.get("/family-profiles/{family_id}/posts")
async def get_family_posts(
    family_id: str,
    current_user: User = Depends(get_current_user),
    privacy_level: Optional[str] = None,
    content_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """Get family posts with privacy filtering"""
    # Check access permissions
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "is_active": True,
        "invitation_accepted": True
    })
    
    subscription = None
    if not membership:
        subscription = await db.family_subscriptions.find_one({
            "subscriber_family_id": {"$in": await get_user_family_ids(current_user.id)},
            "target_family_id": family_id,
            "is_active": True,
            "status": "ACTIVE"
        })
    
    if not membership and not subscription:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build query based on user permissions
    query = {"family_id": family_id, "is_published": True}
    
    if subscription and not membership:
        # External subscribers can only see public posts
        query["privacy_level"] = FamilyPostPrivacy.PUBLIC.value
    elif membership:
        user_role = FamilyRole(membership["family_role"])
        if user_role in [FamilyRole.CREATOR, FamilyRole.ADMIN]:
            # Admins can see all posts
            pass
        else:
            # Regular members can't see admin-only posts
            query["privacy_level"] = {"$ne": FamilyPostPrivacy.ADMIN_ONLY.value}
    
    # Add optional filters
    if privacy_level:
        query["privacy_level"] = privacy_level
    if content_type:
        query["content_type"] = content_type
    
    # Get posts
    posts = await db.family_posts.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with author and family data
    post_responses = []
    for post in posts:
        author = await db.users.find_one({"id": post["posted_by_user_id"]})
        family = await db.family_profiles.find_one({"id": family_id})
        
        if author and family:
            post_response = FamilyPostResponse(
                **post,
                author={
                    "id": author["id"],
                    "first_name": author["first_name"],
                    "last_name": author["last_name"],
                    "avatar_url": author.get("avatar_url")
                },
                family={
                    "id": family["id"],
                    "family_name": family["family_name"],
                    "family_surname": family.get("family_surname")
                }
            )
            post_responses.append(post_response)
    
    return {"family_posts": post_responses, "total": len(post_responses)}

@api_router.put("/family-posts/{post_id}/approve")
async def approve_child_post(
    post_id: str,
    make_public: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Approve child's post and optionally make it public (parent/admin only)"""
    post = await db.family_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is admin in the family
    membership = await db.family_members.find_one({
        "family_id": post["family_id"],
        "user_id": current_user.id,
        "family_role": {"$in": [FamilyRole.CREATOR.value, FamilyRole.ADMIN.value]},
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only family admins can approve posts")
    
    # Update post privacy if requested
    update_data = {"is_child_post_approved": True}
    if make_public:
        update_data["privacy_level"] = FamilyPostPrivacy.PUBLIC.value
    
    await db.family_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    return {"message": "Post approved successfully"}

# === FAMILY SUBSCRIPTION API ENDPOINTS ===

@api_router.post("/family-profiles/{family_id}/subscribe")
async def subscribe_to_family(
    family_id: str,
    subscription_data: FamilySubscriptionInvite,
    current_user: User = Depends(get_current_user)
):
    """Send subscription request to another family"""
    # Check if target family exists
    target_family = await db.family_profiles.find_one({"id": family_id})
    if not target_family:
        raise HTTPException(status_code=404, detail="Family profile not found")
    
    # Check if family is private and user has invitation access
    if target_family["is_private"]:
        # TODO: Implement invitation-based access logic
        # For now, allow if user is connected through existing invitations
        pass
    
    # Get user's family IDs
    user_family_ids = await get_user_family_ids(current_user.id)
    if not user_family_ids:
        raise HTTPException(status_code=400, detail="You must be a member of a family to subscribe to others")
    
    # Use user's first family for subscription (could be enhanced to let user choose)
    subscriber_family_id = user_family_ids[0]
    
    # Check if subscription already exists
    existing_subscription = await db.family_subscriptions.find_one({
        "subscriber_family_id": subscriber_family_id,
        "target_family_id": family_id,
        "is_active": True
    })
    
    if existing_subscription:
        raise HTTPException(status_code=400, detail="Already subscribed to this family")
    
    # Create subscription
    subscription = FamilySubscription(
        subscriber_family_id=subscriber_family_id,
        target_family_id=family_id,
        invited_by_user_id=current_user.id,
        subscription_level=subscription_data.subscription_level
    )
    
    await db.family_subscriptions.insert_one(subscription.dict())
    
    return {"message": "Successfully subscribed to family", "subscription_id": subscription.id}

@api_router.get("/family-profiles/{family_id}/subscribers")
async def get_family_subscribers(
    family_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get families subscribed to this family (admin only)"""
    # Check if user is admin
    membership = await db.family_members.find_one({
        "family_id": family_id,
        "user_id": current_user.id,
        "family_role": {"$in": [FamilyRole.CREATOR.value, FamilyRole.ADMIN.value]},
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Only family admins can view subscribers")
    
    # Get subscriptions
    subscriptions = await db.family_subscriptions.find({
        "target_family_id": family_id,
        "is_active": True,
        "status": "ACTIVE"
    }).to_list(100)
    
    subscribers = []
    for sub in subscriptions:
        subscriber_family = await db.family_profiles.find_one({"id": sub["subscriber_family_id"]})
        if subscriber_family:
            subscribers.append({
                "family": subscriber_family,
                "subscription_level": sub["subscription_level"],
                "subscribed_at": sub["subscribed_at"]
            })
    
    return {"subscribers": subscribers}

# Chat Groups Management Endpoints
@api_router.get("/chat-groups")
async def get_user_chat_groups_endpoint(current_user: User = Depends(get_current_user)):
    """Get all chat groups where user is a member"""
    groups = await get_user_chat_groups(current_user.id)
    return {"chat_groups": groups}

@api_router.post("/chat-groups")
async def create_chat_group(
    group_data: ChatGroupCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new chat group"""
    new_group = ChatGroup(
        name=group_data.name,
        description=group_data.description,
        group_type=group_data.group_type,
        admin_id=current_user.id,
        color_code=group_data.color_code
    )
    
    await db.chat_groups.insert_one(new_group.dict())
    
    # Add creator as admin member
    admin_member = ChatGroupMember(
        group_id=new_group.id,
        user_id=current_user.id,
        role="ADMIN"
    )
    await db.chat_group_members.insert_one(admin_member.dict())
    
    # Add other members
    for member_id in group_data.member_ids:
        if member_id != current_user.id:  # Don't add creator twice
            member = ChatGroupMember(
                group_id=new_group.id,
                user_id=member_id,
                role="MEMBER"
            )
            await db.chat_group_members.insert_one(member.dict())
    
    return {"message": "Chat group created successfully", "group_id": new_group.id}

@api_router.get("/chat-groups/{group_id}/messages")
async def get_chat_messages(
    group_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get messages from a chat group"""
    # Verify user is member of the group
    membership = await db.chat_group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not authorized to view this group")
    
    messages = await db.chat_messages.find(
        {"group_id": group_id, "is_deleted": False}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Remove MongoDB _id fields and get user info for each message
    for message in messages:
        message.pop("_id", None)
        # Get sender info
        sender = await get_user_by_id(message["user_id"])
        if sender:
            message["sender"] = {
                "id": sender.id,
                "first_name": sender.first_name,
                "last_name": sender.last_name
            }
    
    # Reverse to show chronological order (oldest first)
    messages.reverse()
    
    return {"messages": messages}

@api_router.post("/chat-groups/{group_id}/messages")
async def send_chat_message(
    group_id: str,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a message to a chat group"""
    # Verify user is member of the group
    membership = await db.chat_group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not authorized to send messages to this group")
    
    new_message = ChatMessage(
        group_id=group_id,
        user_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type,
        reply_to=message_data.reply_to
    )
    
    await db.chat_messages.insert_one(new_message.dict())
    
    return {"message": "Message sent successfully", "message_id": new_message.id}

# Scheduled Actions Endpoints
@api_router.get("/chat-groups/{group_id}/scheduled-actions")
async def get_scheduled_actions(
    group_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get scheduled actions for a chat group"""
    # Verify user is member of the group
    membership = await db.chat_group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not authorized to view this group")
    
    actions = await db.scheduled_actions.find({
        "group_id": group_id
    }).sort("scheduled_date", 1).to_list(100)
    
    # Remove MongoDB _id fields and get creator info
    for action in actions:
        action.pop("_id", None)
        creator = await get_user_by_id(action["user_id"])
        if creator:
            action["creator"] = {
                "id": creator.id,
                "first_name": creator.first_name,
                "last_name": creator.last_name
            }
    
    return {"scheduled_actions": actions}

@api_router.post("/chat-groups/{group_id}/scheduled-actions")
async def create_scheduled_action(
    group_id: str,
    action_data: ScheduledActionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a scheduled action for a chat group"""
    # Verify user is member of the group
    membership = await db.chat_group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not authorized to create actions in this group")
    
    new_action = ScheduledAction(
        group_id=group_id,
        user_id=current_user.id,
        title=action_data.title,
        description=action_data.description,
        action_type=action_data.action_type,
        scheduled_date=action_data.scheduled_date,
        scheduled_time=action_data.scheduled_time,
        color_code=action_data.color_code,
        invitees=action_data.invitees,
        location=action_data.location
    )
    
    await db.scheduled_actions.insert_one(new_action.dict())
    
    return {"message": "Scheduled action created successfully", "action_id": new_action.id}

@api_router.put("/scheduled-actions/{action_id}/complete")
async def complete_scheduled_action(
    action_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a scheduled action as completed"""
    action = await db.scheduled_actions.find_one({"id": action_id})
    if not action:
        raise HTTPException(status_code=404, detail="Scheduled action not found")
    
    # Verify user is member of the group or creator of the action
    membership = await db.chat_group_members.find_one({
        "group_id": action["group_id"],
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership and action["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to complete this action")
    
    await db.scheduled_actions.update_one(
        {"id": action_id},
        {"$set": {
            "is_completed": True,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Scheduled action marked as completed"}

# Media Upload Endpoints
@api_router.post("/media/upload", response_model=MediaUploadResponse)
async def upload_media_file(
    file: UploadFile = File(...),
    source_module: str = Form(default="personal"),
    privacy_level: str = Form(default="private"),
    current_user: User = Depends(get_current_user)
):
    """Upload a media file (image, document, or video) with module tagging"""
    # Validate file
    is_valid, error_message = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    # Validate source_module
    valid_modules = ["family", "work", "education", "health", "government", "business", "community", "personal"]
    if source_module not in valid_modules:
        source_module = "personal"
    
    # Validate privacy_level
    valid_privacy = ["private", "module", "public"]
    if privacy_level not in valid_privacy:
        privacy_level = "private"
    
    try:
        # Save file and create record
        media_file = await save_uploaded_file(file, current_user.id)
        
        # Update with module and privacy info
        media_file.source_module = source_module
        media_file.privacy_level = privacy_level
        
        # Add metadata based on file type
        if media_file.file_type == "image":
            # You could add image dimensions here using PIL
            media_file.metadata = {"category": "image"}
        elif media_file.file_type == "document":
            media_file.metadata = {"category": "document"}
        else:
            media_file.metadata = {"category": "other"}
        
        # Store in database
        media_dict = media_file.dict()
        await db.media_files.insert_one(media_dict)
        
        return MediaUploadResponse(
            id=media_file.id,
            original_filename=media_file.original_filename,
            file_type=media_file.file_type,
            file_size=media_file.file_size,
            file_url=f"/api/media/{media_file.id}"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@api_router.get("/media")
async def get_user_media(
    media_type: Optional[str] = None,  # "image", "document", "video"
    source_module: Optional[str] = None,  # "family", "work", etc.
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get user's media files with optional filtering"""
    
    # Build query
    query = {"uploaded_by": current_user.id}
    
    if media_type:
        query["file_type"] = media_type
    
    if source_module:
        query["source_module"] = source_module
    
    # Get media files
    media_files = await db.media_files.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Remove MongoDB _id and add file_url
    result = []
    for media in media_files:
        media.pop("_id", None)
        media["file_url"] = f"/api/media/{media['id']}"
        result.append(media)
    
    return {"media_files": result, "total": len(result)}

@api_router.get("/media/modules")
async def get_media_by_modules(current_user: User = Depends(get_current_user)):
    """Get user's media organized by modules"""
    
    # Get all user's media
    media_files = await db.media_files.find({"uploaded_by": current_user.id}).to_list(1000)
    
    # Organize by modules
    modules = {}
    for media in media_files:
        media.pop("_id", None)
        media["file_url"] = f"/api/media/{media['id']}"
        
        module = media.get("source_module", "personal")
        if module not in modules:
            modules[module] = {"images": [], "documents": [], "videos": []}
        
        file_type = media["file_type"]
        if file_type == "image":
            modules[module]["images"].append(media)
        elif file_type == "document":
            modules[module]["documents"].append(media)
        else:
            modules[module]["videos"].append(media)
    
    return {"modules": modules}

@api_router.post("/media/collections")
async def create_media_collection(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    source_module: str = Form(default="personal"),
    media_ids: List[str] = Form(default=[]),
    privacy_level: str = Form(default="private"),
    current_user: User = Depends(get_current_user)
):
    """Create a new media collection (album)"""
    
    # Validate media_ids belong to user
    valid_media_ids = []
    if media_ids:
        for media_id in media_ids:
            media = await db.media_files.find_one({
                "id": media_id,
                "uploaded_by": current_user.id
            })
            if media:
                valid_media_ids.append(media_id)
    
    # Create collection
    collection = MediaCollection(
        user_id=current_user.id,
        name=name,
        description=description,
        source_module=source_module,
        media_ids=valid_media_ids,
        privacy_level=privacy_level
    )
    
    await db.media_collections.insert_one(collection.dict())
    
    return {"message": "Collection created successfully", "collection_id": collection.id}

@api_router.get("/media/collections")
async def get_user_collections(
    source_module: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get user's media collections"""
    
    query = {"user_id": current_user.id}
    if source_module:
        query["source_module"] = source_module
    
    collections = await db.media_collections.find(query).sort("created_at", -1).to_list(100)
    
    # Remove MongoDB _id
    for collection in collections:
        collection.pop("_id", None)
    
    return {"collections": collections}

@api_router.get("/media/{file_id}")
async def get_media_file(file_id: str):
    """Serve uploaded media file - public access for image display"""
    media_file = await db.media_files.find_one({"id": file_id})
    if not media_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = Path(media_file["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=media_file["original_filename"],
        media_type=media_file["mime_type"]
    )

# Helper function to check if user can see post based on visibility
async def can_user_see_post(post: dict, current_user: User, user_family_membership: dict = None) -> bool:
    """
    Determine if current_user can see a post based on role-based visibility rules
    
    Args:
        post: The post document from database
        current_user: The authenticated user
        user_family_membership: User's membership in the post's family (if any)
    
    Returns:
        bool: True if user can see the post, False otherwise
    """
    visibility = post.get("visibility", "FAMILY_ONLY")
    post_family_id = post.get("family_id")
    post_user_id = post.get("user_id")
    
    # Creator can always see their own posts
    if post_user_id == current_user.id:
        return True
    
    # PUBLIC posts - everyone can see
    if visibility == "PUBLIC":
        return True
    
    # ONLY_ME - only creator can see (already checked above)
    if visibility == "ONLY_ME":
        return False
    
    # For family-specific visibility, check if user is a member
    if post_family_id and not user_family_membership:
        # User is not a member of this family
        return False
    
    # FAMILY_ONLY - all family members can see
    if visibility == "FAMILY_ONLY":
        return bool(user_family_membership)
    
    # HOUSEHOLD_ONLY - same household members
    if visibility == "HOUSEHOLD_ONLY":
        if not user_family_membership:
            return False
        # TODO: Add household check when household system is fully implemented
        # For now, treat as FAMILY_ONLY
        return True
    
    # Role-based visibility checks
    if not user_family_membership:
        return False
    
    user_relationship = user_family_membership.get("relationship", "")
    user_gender = current_user.gender
    
    # PARENTS_ONLY - all parents (regardless of gender)
    if visibility == "PARENTS_ONLY":
        return user_relationship == "PARENT"
    
    # FATHERS_ONLY - male parents only
    if visibility == "FATHERS_ONLY":
        return user_relationship == "PARENT" and user_gender == "MALE"
    
    # MOTHERS_ONLY - female parents only
    if visibility == "MOTHERS_ONLY":
        return user_relationship == "PARENT" and user_gender == "FEMALE"
    
    # CHILDREN_ONLY - children only
    if visibility == "CHILDREN_ONLY":
        return user_relationship == "CHILD"
    
    # EXTENDED_FAMILY_ONLY - extended family members
    if visibility == "EXTENDED_FAMILY_ONLY":
        return user_relationship == "EXTENDED_FAMILY"
    
    # Default: hide post
    return False

# Posts Endpoints
@api_router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    module: str = "family",  # Module to filter posts by
    family_id: str = None,  # Filter by specific family ID
    filter: str = None,  # 'subscribed' for subscribed families
    current_user: User = Depends(get_current_user)
):
    """Get posts feed filtered by module, family, and user connections"""
    
    # Build query based on filters
    query = {
        "is_published": True,
        "source_module": module
    }
    
    # Family-specific filtering
    if module == "family":
        if family_id:
            # Filter posts from specific family
            query["family_id"] = family_id
        elif filter == "subscribed":
            # Get subscribed families
            user_families = await get_user_family_ids(current_user.id)
            subscriptions = await db.family_subscriptions.find({
                "subscriber_family_id": {"$in": user_families},
                "is_active": True,
                "status": "ACTIVE"
            }).to_list(100)
            
            subscribed_family_ids = [sub["target_family_id"] for sub in subscriptions]
            if subscribed_family_ids:
                query["family_id"] = {"$in": subscribed_family_ids}
            else:
                # No subscribed families, return empty
                return []
        # else: 'all' - show all family posts (default behavior)
    
    # Get connected users based on module (for non-family filtering)
    if not family_id and filter != "subscribed":
        connected_users = await get_module_connections(current_user.id, module)
        query["user_id"] = {"$in": connected_users}
    
    # Query posts
    posts = await db.posts.find(query).sort("created_at", -1).skip(skip).limit(limit * 2).to_list(limit * 2)  # Fetch more to account for filtering
    
    # Get user's family memberships for visibility checks
    user_family_memberships = {}
    if module == "family":
        user_memberships = await db.family_members.find({
            "user_id": current_user.id,
            "is_active": True
        }).to_list(100)
        
        for membership in user_memberships:
            user_family_memberships[membership["family_id"]] = membership
    
    # Remove MongoDB _id and get additional info
    result = []
    for post in posts:
        post.pop("_id", None)
        
        # NEW: Check visibility - skip post if user can't see it
        post_family_id = post.get("family_id")
        user_membership = user_family_memberships.get(post_family_id) if post_family_id else None
        
        if not await can_user_see_post(post, current_user, user_membership):
            continue
        
        # Stop if we've reached the limit
        if len(result) >= limit:
            break
        
        # Get author info
        author = await get_user_by_id(post["user_id"])
        post["author"] = {
            "id": author.id,
            "first_name": author.first_name,
            "last_name": author.last_name,
            "profile_picture": author.profile_picture
        } if author else {}
        
        # Get media files info
        media_files = []
        for media_id in post.get("media_files", []):
            media = await db.media_files.find_one({"id": media_id})
            if media:
                media.pop("_id", None)
                media["file_url"] = f"/api/media/{media_id}"
                media_files.append(media)
        post["media_files"] = media_files
        
        # Get social features data
        post_id = post["id"]
        
        # Check if current user liked this post
        user_like = await db.post_likes.find_one({
            "post_id": post_id,
            "user_id": current_user.id
        })
        post["user_liked"] = bool(user_like)
        
        # Get user's reaction to this post
        user_reaction = await db.post_reactions.find_one({
            "post_id": post_id,
            "user_id": current_user.id
        })
        post["user_reaction"] = user_reaction["emoji"] if user_reaction else None
        
        # Get top reactions (limit to top 5 most common)
        reactions_pipeline = [
            {"$match": {"post_id": post_id}},
            {"$group": {
                "_id": "$emoji",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        
        reactions_cursor = db.post_reactions.aggregate(reactions_pipeline)
        top_reactions = []
        async for reaction in reactions_cursor:
            top_reactions.append({
                "emoji": reaction["_id"],
                "count": reaction["count"]
            })
        post["top_reactions"] = top_reactions
        
        result.append(PostResponse(**post))
    
    return result

@api_router.post("/posts", response_model=PostResponse)
async def create_post(
    content: str = Form(...),
    source_module: str = Form(default="family"),  # Default to family module
    target_audience: str = Form(default="module"),  # Default to module audience
    visibility: str = Form(default="FAMILY_ONLY"),  # NEW: Role-based visibility
    family_id: str = Form(default=None),  # NEW: Family ID for the post
    media_file_ids: List[str] = Form(default=[]),
    current_user: User = Depends(get_current_user)
):
    """Create a new post with optional media attachments and role-based visibility"""
    
    # Handle empty list case for media_file_ids
    if isinstance(media_file_ids, str):
        media_file_ids = [media_file_ids] if media_file_ids else []
    
    # Validate visibility enum
    try:
        visibility_enum = PostVisibility(visibility)
    except ValueError:
        visibility_enum = PostVisibility.FAMILY_ONLY
    
    # Extract YouTube URLs from content
    youtube_urls = extract_youtube_urls(content)
    
    # Validate media file IDs belong to current user and update their source_module
    valid_media_ids = []
    if media_file_ids:
        for media_id in media_file_ids:
            media = await db.media_files.find_one({
                "id": media_id,
                "uploaded_by": current_user.id
            })
            if media:
                # Update media file's source_module to match the post's context
                await db.media_files.update_one(
                    {"id": media_id},
                    {"$set": {"source_module": source_module}}
                )
                valid_media_ids.append(media_id)
    
    # Create post with module information and visibility
    new_post = Post(
        user_id=current_user.id,
        content=content,
        source_module=source_module,
        target_audience=target_audience,
        visibility=visibility_enum,
        family_id=family_id,
        media_files=valid_media_ids,
        youtube_urls=youtube_urls
    )
    
    await db.posts.insert_one(new_post.dict())
    
    # Prepare response with author info and media files
    author_info = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name
    }
    
    media_files = []
    for media_id in valid_media_ids:
        media = await db.media_files.find_one({"id": media_id})
        if media:
            media.pop("_id", None)
            media["file_url"] = f"/api/media/{media_id}"
            media_files.append(media)
    
    return PostResponse(
        id=new_post.id,
        user_id=new_post.user_id,
        content=new_post.content,
        source_module=new_post.source_module,
        target_audience=new_post.target_audience,
        visibility=new_post.visibility.value,  # NEW
        family_id=new_post.family_id,  # NEW
        author=author_info,
        media_files=media_files,
        youtube_urls=new_post.youtube_urls,
        likes_count=new_post.likes_count,
        comments_count=new_post.comments_count,
        is_published=new_post.is_published,
        created_at=new_post.created_at,
        updated_at=new_post.updated_at,
        user_liked=False,  # New post, so user hasn't liked it yet
        user_reaction=None,  # New post, so no reaction yet
        top_reactions=[]  # New post, so no reactions yet
    )

# === SOCIAL FEATURES ENDPOINTS ===

# Post Likes Endpoints
@api_router.post("/posts/{post_id}/like")
async def like_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a post"""
    # Check if post exists
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user already liked this post
    existing_like = await db.post_likes.find_one({
        "post_id": post_id,
        "user_id": current_user.id
    })
    
    if existing_like:
        # Unlike: Remove the like
        await db.post_likes.delete_one({
            "post_id": post_id,
            "user_id": current_user.id
        })
        # Decrement likes count
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": -1}}
        )
        
        # Create unlike notification (remove notification)
        await db.notifications.delete_many({
            "user_id": post["user_id"],
            "sender_id": current_user.id,
            "type": "like",
            "related_post_id": post_id
        })
        
        return {"liked": False, "message": "Post unliked"}
    else:
        # Like: Add the like
        new_like = PostLike(
            post_id=post_id,
            user_id=current_user.id
        )
        await db.post_likes.insert_one(new_like.dict())
        
        # Increment likes count
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Create notification for post author (don't notify yourself)
        if post["user_id"] != current_user.id:
            notification = Notification(
                user_id=post["user_id"],
                sender_id=current_user.id,
                type="like",
                title="Новый лайк",
                message=f"{current_user.first_name} {current_user.last_name} лайкнул ваш пост",
                related_post_id=post_id
            )
            await db.notifications.insert_one(notification.dict())
        
        return {"liked": True, "message": "Post liked"}

@api_router.get("/posts/{post_id}/likes")
async def get_post_likes(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get list of users who liked a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = await db.post_likes.find({"post_id": post_id}).to_list(None)
    
    # Get user info for each like
    result = []
    for like in likes:
        user = await get_user_by_id(like["user_id"])
        if user:
            result.append({
                "id": like["id"],
                "user": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name
                },
                "created_at": like["created_at"]
            })
    
    return result

# Post Comments Endpoints
@api_router.get("/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get comments for a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get all comments for this post, sorted by creation time
    comments = await db.post_comments.find({
        "post_id": post_id,
        "is_deleted": False
    }).sort("created_at", 1).to_list(None)
    
    # Build nested structure for replies
    comments_dict = {}
    top_level_comments = []
    
    for comment in comments:
        comment.pop("_id", None)
        
        # Get author info
        author = await get_user_by_id(comment["user_id"])
        comment["author"] = {
            "id": author.id,
            "first_name": author.first_name,
            "last_name": author.last_name,
            "profile_picture": author.profile_picture
        } if author else {}
        
        comment["replies"] = []
        comments_dict[comment["id"]] = comment
        
        if comment["parent_comment_id"]:
            # This is a reply
            parent = comments_dict.get(comment["parent_comment_id"])
            if parent:
                parent["replies"].append(comment)
        else:
            # This is a top-level comment
            top_level_comments.append(comment)
    
    return top_level_comments

@api_router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    content: str = Form(...),
    parent_comment_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # If replying to a comment, verify it exists
    if parent_comment_id:
        parent_comment = await db.post_comments.find_one({"id": parent_comment_id})
        if not parent_comment:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    
    # Create comment
    new_comment = PostComment(
        post_id=post_id,
        user_id=current_user.id,
        content=content,
        parent_comment_id=parent_comment_id
    )
    
    await db.post_comments.insert_one(new_comment.dict())
    
    # Update comment counts
    if parent_comment_id:
        # Increment replies count on parent comment
        await db.post_comments.update_one(
            {"id": parent_comment_id},
            {"$inc": {"replies_count": 1}}
        )
    else:
        # Increment comments count on post
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
    
    # Create notification for post author or parent comment author
    notification_user_id = post["user_id"]
    if parent_comment_id and parent_comment:
        notification_user_id = parent_comment["user_id"]
    
    # Don't notify yourself
    if notification_user_id != current_user.id:
        notification_type = "reply" if parent_comment_id else "comment"
        notification_message = f"{current_user.first_name} {current_user.last_name} ответил на ваш комментарий" if parent_comment_id else f"{current_user.first_name} {current_user.last_name} прокомментировал ваш пост"
        
        notification = Notification(
            user_id=notification_user_id,
            sender_id=current_user.id,
            type=notification_type,
            title="Новый комментарий",
            message=notification_message,
            related_post_id=post_id,
            related_comment_id=new_comment.id
        )
        await db.notifications.insert_one(notification.dict())
    
    # Return comment with author info
    return {
        "id": new_comment.id,
        "post_id": new_comment.post_id,
        "content": new_comment.content,
        "parent_comment_id": new_comment.parent_comment_id,
        "author": {
            "id": current_user.id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name
        },
        "likes_count": new_comment.likes_count,
        "replies_count": new_comment.replies_count,
        "created_at": new_comment.created_at,
        "is_edited": new_comment.is_edited
    }

@api_router.put("/comments/{comment_id}")
async def edit_comment(
    comment_id: str,
    content: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Edit a comment (only by comment author)"""
    comment = await db.post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    
    # Update comment
    await db.post_comments.update_one(
        {"id": comment_id},
        {
            "$set": {
                "content": content,
                "updated_at": datetime.now(timezone.utc),
                "is_edited": True
            }
        }
    )
    
    return {"message": "Comment updated successfully"}

@api_router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a comment (only by comment author)"""
    comment = await db.post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    # Mark comment as deleted instead of actually deleting
    await db.post_comments.update_one(
        {"id": comment_id},
        {
            "$set": {
                "is_deleted": True,
                "content": "[Удалено]",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Update counts
    if comment["parent_comment_id"]:
        # Decrement replies count on parent comment
        await db.post_comments.update_one(
            {"id": comment["parent_comment_id"]},
            {"$inc": {"replies_count": -1}}
        )
    else:
        # Decrement comments count on post
        await db.posts.update_one(
            {"id": comment["post_id"]},
            {"$inc": {"comments_count": -1}}
        )
    
    return {"message": "Comment deleted successfully"}

# Comment Likes Endpoints
@api_router.post("/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a comment"""
    comment = await db.post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user already liked this comment
    existing_like = await db.comment_likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    
    if existing_like:
        # Unlike
        await db.comment_likes.delete_one({
            "comment_id": comment_id,
            "user_id": current_user.id
        })
        await db.post_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"liked": False, "message": "Comment unliked"}
    else:
        # Like
        new_like = CommentLike(
            comment_id=comment_id,
            user_id=current_user.id
        )
        await db.comment_likes.insert_one(new_like.dict())
        await db.post_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Create notification for comment author (don't notify yourself)
        if comment["user_id"] != current_user.id:
            notification = Notification(
                user_id=comment["user_id"],
                sender_id=current_user.id,
                type="comment_like",
                title="Лайк комментария",
                message=f"{current_user.first_name} {current_user.last_name} лайкнул ваш комментарий",
                related_comment_id=comment_id
            )
            await db.notifications.insert_one(notification.dict())
        
        return {"liked": True, "message": "Comment liked"}

# Emoji Reactions Endpoints
@api_router.post("/posts/{post_id}/reactions")
async def add_reaction(
    post_id: str,
    emoji: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Add or change emoji reaction to a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Validate emoji (basic validation)
    allowed_emojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "👏", "🤔", "💯"]
    if emoji not in allowed_emojis:
        raise HTTPException(status_code=400, detail="Invalid emoji")
    
    # Check if user already has a reaction on this post
    existing_reaction = await db.post_reactions.find_one({
        "post_id": post_id,
        "user_id": current_user.id
    })
    
    if existing_reaction:
        # Update existing reaction
        await db.post_reactions.update_one(
            {"post_id": post_id, "user_id": current_user.id},
            {"$set": {"emoji": emoji, "created_at": datetime.now(timezone.utc)}}
        )
        message = "Reaction updated"
    else:
        # Create new reaction
        new_reaction = PostReaction(
            post_id=post_id,
            user_id=current_user.id,
            emoji=emoji
        )
        await db.post_reactions.insert_one(new_reaction.dict())
        message = "Reaction added"
        
        # Create notification for post author (don't notify yourself)
        if post["user_id"] != current_user.id:
            notification = Notification(
                user_id=post["user_id"],
                sender_id=current_user.id,
                type="reaction",
                title="Новая реакция",
                message=f"{current_user.first_name} {current_user.last_name} отреагировал на ваш пост: {emoji}",
                related_post_id=post_id
            )
            await db.notifications.insert_one(notification.dict())
    
    return {"message": message, "emoji": emoji}

@api_router.get("/posts/{post_id}/reactions")
async def get_post_reactions(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get emoji reactions for a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    reactions = await db.post_reactions.find({"post_id": post_id}).to_list(None)
    
    # Group reactions by emoji and get user info
    reaction_groups = {}
    for reaction in reactions:
        emoji = reaction["emoji"]
        if emoji not in reaction_groups:
            reaction_groups[emoji] = {
                "emoji": emoji,
                "count": 0,
                "users": []
            }
        reaction_groups[emoji]["count"] += 1
        
        # Get user info
        user = await get_user_by_id(reaction["user_id"])
        if user:
            reaction_groups[emoji]["users"].append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name
            })
    
    return list(reaction_groups.values())

@api_router.delete("/posts/{post_id}/reactions")
async def remove_reaction(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove user's reaction from a post"""
    result = await db.post_reactions.delete_one({
        "post_id": post_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    return {"message": "Reaction removed"}

# Notifications Endpoints
@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get user notifications"""
    filter_query = {"user_id": current_user.id}
    if unread_only:
        filter_query["is_read"] = False
    
    notifications = await db.notifications.find(filter_query)\
        .sort("created_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    # Get sender info for each notification
    result = []
    for notification in notifications:
        notification.pop("_id", None)
        
        # Get sender info
        sender = await get_user_by_id(notification["sender_id"])
        notification["sender"] = {
            "id": sender.id,
            "first_name": sender.first_name,
            "last_name": sender.last_name
        } if sender else {}
        
        result.append(notification)
    
    return result

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for current user"""
    await db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "All notifications marked as read"}

# === NEW FAMILY SYSTEM API ENDPOINTS ===

@api_router.put("/users/profile/complete")
async def complete_user_profile(
    profile_data: ProfileCompletionRequest,
    current_user: User = Depends(get_current_user)
):
    """Complete user profile with address and marriage info for family system"""
    update_data = {
        "address_street": profile_data.address_street,
        "address_city": profile_data.address_city,
        "address_state": profile_data.address_state,
        "address_country": profile_data.address_country,
        "address_postal_code": profile_data.address_postal_code,
        "marriage_status": profile_data.marriage_status.value,
        "spouse_name": profile_data.spouse_name,
        "spouse_phone": profile_data.spouse_phone,
        "profile_completed": True,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    return {"message": "Profile completed successfully", "profile_completed": True}

@api_router.get("/family-units/check-match")
async def check_family_match(
    current_user: User = Depends(get_current_user)
):
    """Check for matching family units based on user's address and last name"""
    if not current_user.profile_completed:
        raise HTTPException(
            status_code=400,
            detail="Please complete your profile first"
        )
    
    # Find matching families
    matches = await find_matching_family_units(
        address_street=current_user.address_street or "",
        address_city=current_user.address_city or "",
        address_country=current_user.address_country or "",
        last_name=current_user.last_name,
        phone=current_user.phone
    )
    
    matching_results = []
    for match in matches:
        family_unit = match["family_unit"]
        matching_results.append(MatchingFamilyResult(
            family_unit_id=family_unit["id"],
            family_name=family_unit["family_name"],
            family_surname=family_unit["family_surname"],
            address=AddressModel(
                street=family_unit.get("address_street"),
                city=family_unit.get("address_city"),
                state=family_unit.get("address_state"),
                country=family_unit.get("address_country"),
                postal_code=family_unit.get("address_postal_code")
            ),
            member_count=family_unit["member_count"],
            match_score=match["match_score"]
        ))
    
    return {
        "matches_found": len(matching_results) > 0,
        "matches": matching_results
    }

@api_router.post("/family-units", response_model=FamilyUnitResponse)
async def create_family_unit(
    family_data: FamilyUnitCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new family unit (NODE)"""
    if not current_user.profile_completed:
        raise HTTPException(
            status_code=400,
            detail="Please complete your profile first"
        )
    
    # Create family unit
    new_family_unit = FamilyUnit(
        family_name=family_data.family_name,
        family_surname=family_data.family_surname,
        address_street=current_user.address_street,
        address_city=current_user.address_city,
        address_state=current_user.address_state,
        address_country=current_user.address_country,
        address_postal_code=current_user.address_postal_code,
        creator_id=current_user.id,
        node_type=NodeType.NODE
    )
    
    await db.family_units.insert_one(new_family_unit.dict())
    
    # Add creator as family unit HEAD
    family_member = FamilyUnitMember(
        family_unit_id=new_family_unit.id,
        user_id=current_user.id,
        role=FamilyUnitRole.HEAD
    )
    await db.family_unit_members.insert_one(family_member.dict())
    
    # If user is married and spouse exists, add them
    if current_user.marriage_status == MarriageStatus.MARRIED.value and current_user.spouse_user_id:
        spouse_member = FamilyUnitMember(
            family_unit_id=new_family_unit.id,
            user_id=current_user.spouse_user_id,
            role=FamilyUnitRole.SPOUSE
        )
        await db.family_unit_members.insert_one(spouse_member.dict())
        # Update member count
        await db.family_units.update_one(
            {"id": new_family_unit.id},
            {"$inc": {"member_count": 1}}
        )
    
    return FamilyUnitResponse(
        id=new_family_unit.id,
        family_name=new_family_unit.family_name,
        family_surname=new_family_unit.family_surname,
        address=AddressModel(
            street=new_family_unit.address_street,
            city=new_family_unit.address_city,
            state=new_family_unit.address_state,
            country=new_family_unit.address_country,
            postal_code=new_family_unit.address_postal_code
        ),
        node_type=new_family_unit.node_type,
        parent_household_id=new_family_unit.parent_household_id,
        member_count=new_family_unit.member_count,
        is_user_member=True,
        user_role=FamilyUnitRole.HEAD,
        created_at=new_family_unit.created_at
    )

@api_router.get("/family-units/my-units")
async def get_my_family_units(
    current_user: User = Depends(get_current_user)
):
    """Get all family units user belongs to"""
    family_unit_ids = await get_user_family_units(current_user.id)
    
    family_units = []
    for family_unit_id in family_unit_ids:
        family_unit = await db.family_units.find_one({"id": family_unit_id})
        if family_unit:
            family_unit.pop("_id", None)
            
            # Get user's role
            membership = await db.family_unit_members.find_one({
                "family_unit_id": family_unit_id,
                "user_id": current_user.id,
                "is_active": True
            })
            
            family_units.append(FamilyUnitResponse(
                id=family_unit["id"],
                family_name=family_unit["family_name"],
                family_surname=family_unit["family_surname"],
                address=AddressModel(
                    street=family_unit.get("address_street"),
                    city=family_unit.get("address_city"),
                    state=family_unit.get("address_state"),
                    country=family_unit.get("address_country"),
                    postal_code=family_unit.get("address_postal_code")
                ),
                node_type=NodeType(family_unit["node_type"]),
                parent_household_id=family_unit.get("parent_household_id"),
                member_count=family_unit["member_count"],
                is_user_member=True,
                user_role=FamilyUnitRole(membership["role"]) if membership else None,
                created_at=family_unit["created_at"]
            ))
    
    return {"family_units": family_units}

@api_router.post("/family-units/{family_unit_id}/join-request")
async def create_join_request(
    family_unit_id: str,
    request_data: JoinRequestCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a join request to an existing family unit"""
    # Check if family unit exists
    target_family = await db.family_units.find_one({"id": family_unit_id})
    if not target_family:
        raise HTTPException(status_code=404, detail="Family unit not found")
    
    # Check if user already belongs to this family
    existing_membership = await db.family_unit_members.find_one({
        "family_unit_id": family_unit_id,
        "user_id": current_user.id,
        "is_active": True
    })
    if existing_membership:
        raise HTTPException(status_code=400, detail="You are already a member of this family")
    
    # Get all family unit heads who need to vote
    family_unit_heads = await get_family_unit_heads([family_unit_id])
    total_voters = len(family_unit_heads)
    votes_required = (total_voters // 2) + 1  # Majority
    
    # Get user's own family unit (if any)
    user_family_units = await get_user_family_units(current_user.id)
    requesting_family_unit_id = user_family_units[0] if user_family_units else None
    
    # Create join request
    join_request = FamilyJoinRequest(
        requesting_user_id=current_user.id,
        requesting_family_unit_id=requesting_family_unit_id,
        target_family_unit_id=family_unit_id,
        request_type="JOIN_FAMILY",
        message=request_data.message,
        total_voters=total_voters,
        votes_required=votes_required
    )
    
    await db.family_join_requests.insert_one(join_request.dict())
    
    return {
        "message": "Join request created successfully",
        "join_request_id": join_request.id,
        "total_voters": total_voters,
        "votes_required": votes_required
    }

@api_router.post("/family-join-requests/{join_request_id}/vote")
async def vote_on_join_request(
    join_request_id: str,
    vote_data: VoteRequest,
    current_user: User = Depends(get_current_user)
):
    """Vote on a family join request"""
    # Get join request
    join_request = await db.family_join_requests.find_one({"id": join_request_id})
    if not join_request:
        raise HTTPException(status_code=404, detail="Join request not found")
    
    if join_request["status"] != JoinRequestStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Join request is no longer pending")
    
    # Check if user is a family unit head of target family
    target_family_id = join_request.get("target_family_unit_id")
    if not target_family_id:
        raise HTTPException(status_code=400, detail="Invalid join request")
    
    is_head = await is_family_unit_head(current_user.id, target_family_id)
    if not is_head:
        raise HTTPException(status_code=403, detail="Only family unit heads can vote")
    
    # Check if user already voted
    existing_votes = join_request.get("votes", [])
    for vote in existing_votes:
        if vote["user_id"] == current_user.id:
            raise HTTPException(status_code=400, detail="You have already voted")
    
    # Add vote
    new_vote = {
        "user_id": current_user.id,
        "family_unit_id": target_family_id,
        "vote": vote_data.vote.value,
        "voted_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.family_join_requests.update_one(
        {"id": join_request_id},
        {"$push": {"votes": new_vote}}
    )
    
    # Check if majority reached
    majority_reached = await check_vote_majority(join_request_id)
    
    if majority_reached:
        # Approve join request
        await db.family_join_requests.update_one(
            {"id": join_request_id},
            {"$set": {
                "status": JoinRequestStatus.APPROVED.value,
                "resolved_at": datetime.now(timezone.utc)
            }}
        )
        
        # Add user to family unit
        new_member = FamilyUnitMember(
            family_unit_id=target_family_id,
            user_id=join_request["requesting_user_id"],
            role=FamilyUnitRole.CHILD  # Default role, can be updated later
        )
        await db.family_unit_members.insert_one(new_member.dict())
        
        # Update member count
        await db.family_units.update_one(
            {"id": target_family_id},
            {"$inc": {"member_count": 1}}
        )
        
        return {
            "message": "Join request approved and user added to family",
            "status": "APPROVED"
        }
    
    return {
        "message": "Vote recorded successfully",
        "status": "PENDING"
    }

@api_router.get("/family-join-requests/pending")
async def get_pending_join_requests(
    current_user: User = Depends(get_current_user)
):
    """Get all pending join requests for families where user is a head"""
    # Get user's family units where they are head
    user_family_units = await get_user_family_units(current_user.id)
    head_family_units = []
    
    for family_unit_id in user_family_units:
        if await is_family_unit_head(current_user.id, family_unit_id):
            head_family_units.append(family_unit_id)
    
    # Get pending join requests for these families
    join_requests = await db.family_join_requests.find({
        "target_family_unit_id": {"$in": head_family_units},
        "status": JoinRequestStatus.PENDING.value,
        "is_active": True
    }).sort("created_at", -1).to_list(50)
    
    # Enrich with user and family info
    enriched_requests = []
    for request in join_requests:
        request.pop("_id", None)
        
        # Get requesting user info
        requesting_user = await db.users.find_one({"id": request["requesting_user_id"]})
        if requesting_user:
            request["requesting_user_name"] = f"{requesting_user['first_name']} {requesting_user['last_name']}"
        
        # Get target family info
        target_family = await db.family_units.find_one({"id": request["target_family_unit_id"]})
        if target_family:
            request["target_family_name"] = target_family["family_name"]
        
        enriched_requests.append(request)
    
    return {"join_requests": enriched_requests}

@api_router.post("/family-units/{family_unit_id}/posts", response_model=dict)
async def create_family_unit_post(
    family_unit_id: str,
    post_data: FamilyUnitPostCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a post on behalf of family unit"""
    # Check if user is member of family unit
    membership = await db.family_unit_members.find_one({
        "family_unit_id": family_unit_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this family unit")
    
    # Create family post
    family_post = FamilyUnitPost(
        family_unit_id=family_unit_id,
        posted_by_user_id=current_user.id,
        content=post_data.content,
        media_files=post_data.media_files,
        visibility=post_data.visibility
    )
    
    await db.family_unit_posts.insert_one(family_post.dict())
    
    # Get family unit info
    family_unit = await db.family_units.find_one({"id": family_unit_id})
    
    return {
        "id": family_post.id,
        "family_unit_id": family_post.family_unit_id,
        "family_name": family_unit["family_name"] if family_unit else None,
        "posted_by_user_id": family_post.posted_by_user_id,
        "posted_by_name": f"{current_user.first_name} {current_user.last_name}",
        "content": family_post.content,
        "visibility": family_post.visibility.value,
        "created_at": family_post.created_at,
        "message": f"Posted on behalf of {family_unit['family_name'] if family_unit else 'family'}"
    }

@api_router.get("/family-units/{family_unit_id}/posts")
async def get_family_unit_posts(
    family_unit_id: str,
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """Get posts for a family unit"""
    # Check access permissions
    membership = await db.family_unit_members.find_one({
        "family_unit_id": family_unit_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get posts
    posts = await db.family_unit_posts.find({
        "family_unit_id": family_unit_id,
        "is_published": True
    }).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with author and family info
    enriched_posts = []
    for post in posts:
        post.pop("_id", None)
        
        author = await db.users.find_one({"id": post["posted_by_user_id"]})
        family_unit = await db.family_units.find_one({"id": family_unit_id})
        
        if author and family_unit:
            enriched_posts.append({
                **post,
                "author_name": f"{author['first_name']} {author['last_name']}",
                "family_name": family_unit["family_name"]
            })
    
    return {"posts": enriched_posts, "total": len(enriched_posts)}

# === END NEW FAMILY SYSTEM API ENDPOINTS ===

# === MY INFO MODULE API ENDPOINTS ===

@api_router.get("/my-info", response_model=MyInfoResponse)
async def get_my_info(current_user: User = Depends(get_current_user)):
    """Get complete MY INFO data for current user"""
    return MyInfoResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        middle_name=current_user.middle_name,
        name_alias=current_user.name_alias,
        phone=current_user.phone,
        date_of_birth=current_user.date_of_birth,
        profile_picture=current_user.profile_picture,
        gender=current_user.gender.value if current_user.gender else None,
        address_street=current_user.address_street,
        address_city=current_user.address_city,
        address_state=current_user.address_state,
        address_country=current_user.address_country,
        address_postal_code=current_user.address_postal_code,
        marriage_status=current_user.marriage_status,
        spouse_name=current_user.spouse_name,
        spouse_phone=current_user.spouse_phone,
        profile_completed=current_user.profile_completed,
        additional_user_data=current_user.additional_user_data,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )

@api_router.put("/my-info", response_model=MyInfoResponse)
async def update_my_info(
    info_update: MyInfoUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update MY INFO data"""
    update_data = {}
    
    # Name fields
    if info_update.first_name is not None:
        update_data["first_name"] = info_update.first_name
    if info_update.last_name is not None:
        update_data["last_name"] = info_update.last_name
    if info_update.middle_name is not None:
        update_data["middle_name"] = info_update.middle_name
    if info_update.name_alias is not None:
        update_data["name_alias"] = info_update.name_alias
    
    # Contact info
    if info_update.email is not None:
        # Check if email is already in use by another user
        existing_user = await db.users.find_one({"email": info_update.email, "id": {"$ne": current_user.id}})
        if existing_user:
            raise HTTPException(status_code=400, detail="Этот email уже используется другим пользователем")
        update_data["email"] = info_update.email
    if info_update.phone is not None:
        update_data["phone"] = info_update.phone
    if info_update.date_of_birth is not None:
        update_data["date_of_birth"] = info_update.date_of_birth
    if info_update.gender is not None:
        update_data["gender"] = info_update.gender  # NEW: Update gender
    
    # Address fields
    if info_update.address_street is not None:
        update_data["address_street"] = info_update.address_street
    if info_update.address_city is not None:
        update_data["address_city"] = info_update.address_city
    if info_update.address_state is not None:
        update_data["address_state"] = info_update.address_state
    if info_update.address_country is not None:
        update_data["address_country"] = info_update.address_country
    if info_update.address_postal_code is not None:
        update_data["address_postal_code"] = info_update.address_postal_code
    
    # Marriage info
    if info_update.marriage_status is not None:
        update_data["marriage_status"] = info_update.marriage_status
    if info_update.spouse_name is not None:
        update_data["spouse_name"] = info_update.spouse_name
    if info_update.spouse_phone is not None:
        update_data["spouse_phone"] = info_update.spouse_phone
    
    if info_update.additional_user_data is not None:
        # Merge with existing additional_user_data
        existing_data = current_user.additional_user_data or {}
        existing_data.update(info_update.additional_user_data)
        update_data["additional_user_data"] = existing_data
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    # Fetch updated user
    updated_user = await get_user_by_id(current_user.id)
    return MyInfoResponse(
        id=updated_user.id,
        email=updated_user.email,
        first_name=updated_user.first_name,
        last_name=updated_user.last_name,
        middle_name=updated_user.middle_name,
        name_alias=updated_user.name_alias,
        phone=updated_user.phone,
        date_of_birth=updated_user.date_of_birth,
        profile_picture=updated_user.profile_picture,
        gender=updated_user.gender.value if updated_user.gender else None,
        address_street=updated_user.address_street,
        address_city=updated_user.address_city,
        address_state=updated_user.address_state,
        address_country=updated_user.address_country,
        address_postal_code=updated_user.address_postal_code,
        marriage_status=updated_user.marriage_status,
        spouse_name=updated_user.spouse_name,
        spouse_phone=updated_user.spouse_phone,
        profile_completed=updated_user.profile_completed,
        additional_user_data=updated_user.additional_user_data,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at
    )

@api_router.get("/my-documents", response_model=List[UserDocumentResponse])
async def get_my_documents(current_user: User = Depends(get_current_user)):
    """Get all documents for current user"""
    documents = await db.user_documents.find({
        "user_id": current_user.id,
        "is_active": True
    }).to_list(100)
    
    # Enrich with scan file URLs
    enriched_docs = []
    for doc in documents:
        doc.pop("_id", None)
        scan_url = None
        if doc.get("scan_file_id"):
            # Get file URL from media system
            scan_url = f"/uploads/{current_user.id}/{doc['scan_file_id']}"
        
        enriched_docs.append(UserDocumentResponse(
            **doc,
            scan_file_url=scan_url
        ))
    
    return enriched_docs

@api_router.post("/my-documents", response_model=UserDocumentResponse)
async def create_document(
    document: UserDocumentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new document"""
    new_doc = UserDocument(
        user_id=current_user.id,
        document_type=document.document_type,
        country=document.country,
        document_number=document.document_number,
        document_data=document.document_data
    )
    
    await db.user_documents.insert_one(new_doc.dict())
    
    return UserDocumentResponse(
        **new_doc.dict(),
        scan_file_url=None
    )

@api_router.put("/my-documents/{document_id}", response_model=UserDocumentResponse)
async def update_document(
    document_id: str,
    document_update: UserDocumentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing document"""
    # Verify document belongs to user
    existing_doc = await db.user_documents.find_one({
        "id": document_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if document_update.country is not None:
        update_data["country"] = document_update.country
    
    if document_update.document_number is not None:
        update_data["document_number"] = document_update.document_number
    
    if document_update.document_data is not None:
        # Merge with existing document_data
        existing_data = existing_doc.get("document_data", {})
        existing_data.update(document_update.document_data)
        update_data["document_data"] = existing_data
    
    await db.user_documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    # Fetch updated document
    updated_doc = await db.user_documents.find_one({"id": document_id})
    updated_doc.pop("_id", None)
    
    scan_url = None
    if updated_doc.get("scan_file_id"):
        scan_url = f"/uploads/{current_user.id}/{updated_doc['scan_file_id']}"
    
    return UserDocumentResponse(
        **updated_doc,
        scan_file_url=scan_url
    )

@api_router.delete("/my-documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a document (soft delete)"""
    result = await db.user_documents.update_one(
        {
            "id": document_id,
            "user_id": current_user.id,
            "is_active": True
        },
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}

@api_router.post("/my-documents/{document_id}/upload-scan")
async def upload_document_scan(
    document_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload scan for a document"""
    # Verify document belongs to user
    existing_doc = await db.user_documents.find_one({
        "id": document_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not existing_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Validate file
    is_valid, message = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Save file using existing media system
    media_file = await save_uploaded_file(file, current_user.id)
    media_file.source_module = "my_documents"
    media_file.privacy_level = "private"  # Documents are always private
    
    # Save to database
    await db.media_files.insert_one(media_file.dict())
    
    # Update document with scan reference
    await db.user_documents.update_one(
        {"id": document_id},
        {
            "$set": {
                "scan_file_id": media_file.id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Scan uploaded successfully",
        "scan_file_id": media_file.id,
        "scan_url": f"/uploads/{current_user.id}/{media_file.stored_filename}"
    }

# === END MY INFO MODULE API ENDPOINTS ===

# === WORK ORGANIZATION SYSTEM API ENDPOINTS ===

@api_router.post("/work/organizations/search")
async def search_work_organizations(
    search_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Search for existing work organizations with filters"""
    try:
        # Build search query
        search_query = {"allow_public_discovery": True}
        
        # Name search
        if search_data.get("query"):
            search_query["$or"] = [
                {"name": {"$regex": search_data["query"], "$options": "i"}},
                {"description": {"$regex": search_data["query"], "$options": "i"}}
            ]
        
        # Filters
        if search_data.get("industry"):
            search_query["industry"] = search_data["industry"]
        
        if search_data.get("city"):
            search_query["address_city"] = {"$regex": search_data["city"], "$options": "i"}
        
        if search_data.get("organization_type"):
            search_query["organization_type"] = search_data["organization_type"]
        
        # Find matching organizations
        organizations = await db.work_organizations.find(search_query).limit(50).to_list(50)
        
        results = []
        for org in organizations:
            org_id = org.get("id") or org.get("organization_id")
            
            # Check if user is already a member
            membership = await db.work_members.find_one({
                "organization_id": org_id,
                "user_id": current_user.id,
                "is_active": True
            })
            
            # Check if user has pending request
            pending_request = await db.work_join_requests.find_one({
                "organization_id": org_id,
                "user_id": current_user.id,
                "status": "pending"
            })
            
            # Count members
            member_count = await db.work_members.count_documents({
                "organization_id": org_id,
                "is_active": True
            })
            
            results.append({
                "id": org_id,
                "name": org["name"],
                "organization_type": org.get("organization_type", "COMPANY"),
                "description": org.get("description", ""),
                "industry": org.get("industry"),
                "organization_size": org.get("organization_size"),
                "address_city": org.get("address_city"),
                "address_country": org.get("address_country"),
                "is_private": org.get("is_private", False),
                "member_count": member_count,
                "logo_url": org.get("logo_url"),
                "banner_url": org.get("banner_url"),
                "user_is_member": membership is not None,
                "user_has_pending_request": pending_request is not None
            })
        
        return {"organizations": results, "count": len(results)}
        
    except Exception as e:
        print(f"Organization search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations", response_model=WorkOrganizationResponse)
async def create_work_organization(
    org_data: WorkOrganizationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new work organization"""
    try:
        # Check if organization with same name already exists
        existing = await db.work_organizations.find_one({
            "name": {"$regex": f"^{re.escape(org_data.name)}$", "$options": "i"},
            "is_active": True
        })
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="An organization with this name already exists"
            )
        
        # Create organization
        organization = WorkOrganization(
            name=org_data.name,
            organization_type=org_data.organization_type,
            description=org_data.description,
            industry=org_data.industry,
            organization_size=org_data.organization_size,
            founded_year=org_data.founded_year,
            website=org_data.website,
            official_email=org_data.official_email,
            address_street=org_data.address_street,
            address_city=org_data.address_city,
            address_state=org_data.address_state,
            address_country=org_data.address_country,
            address_postal_code=org_data.address_postal_code,
            is_private=org_data.is_private,
            allow_public_discovery=org_data.allow_public_discovery,
            creator_id=current_user.id
        )
        
        # Insert organization
        org_dict = organization.model_dump(by_alias=False)
        await db.work_organizations.insert_one(org_dict)
        
        # Add creator as first member with admin privileges
        member = WorkMember(
            organization_id=organization.id,
            user_id=current_user.id,
            role=org_data.creator_role,
            custom_role_name=org_data.custom_role_name if org_data.creator_role == WorkRole.CUSTOM else None,
            department=org_data.creator_department,
            team=org_data.creator_team,
            job_title=org_data.creator_job_title,
            can_invite=True,
            is_admin=True
        )
        
        member_dict = member.model_dump(by_alias=False)
        await db.work_members.insert_one(member_dict)
        
        # Return response with user membership details
        response_data = org_dict.copy()
        
        return WorkOrganizationResponse(
            **response_data,
            user_role=org_data.creator_role,
            user_custom_role_name=org_data.custom_role_name,
            user_department=org_data.creator_department,
            user_team=org_data.creator_team,
            user_is_admin=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create organization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations")
async def get_user_work_organizations(
    current_user: User = Depends(get_current_user)
):
    """Get all work organizations where user is a member"""
    try:
        # Get user's memberships
        memberships = await db.work_members.find({
            "user_id": current_user.id,
            "is_active": True
        }).to_list(100)
        
        organizations = []
        for membership in memberships:
            # Try both id fields since model has alias
            org = await db.work_organizations.find_one({
                "$or": [
                    {"id": membership["organization_id"]},
                    {"organization_id": membership["organization_id"]}
                ],
                "is_active": True
            })
            
            if org:
                org_response_data = org.copy()
                if "organization_id" in org_response_data:
                    org_response_data["id"] = org_response_data.pop("organization_id")
                
                # Handle role - convert 'Member' to 'MEMBER' if needed for backwards compatibility
                role_value = membership["role"]
                if role_value == "Member":
                    role_value = "MEMBER"
                
                org_response = WorkOrganizationResponse(
                    **org_response_data,
                    user_role=WorkRole(role_value),
                    user_custom_role_name=membership.get("custom_role_name"),
                    user_department=membership.get("department"),
                    user_team=membership.get("team"),
                    user_is_admin=membership.get("is_admin", False)
                )
                organizations.append(org_response)
        
        return {"organizations": organizations, "count": len(organizations)}
        
    except Exception as e:
        print(f"Get organizations error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}", response_model=WorkOrganizationResponse)
async def get_work_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific work organization details"""
    try:
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ],
            "is_active": True
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        # If organization is private and user is not a member, deny access
        if org.get("is_private", False) and not membership:
            raise HTTPException(
                status_code=403,
                detail="Access denied. This organization is private."
            )
        
        # Build response with user's membership details
        org_response_data = org.copy()
        if "organization_id" in org_response_data:
            org_response_data["id"] = org_response_data.pop("organization_id")
        
        response_data = WorkOrganizationResponse(**org_response_data)
        
        if membership:
            role = membership["role"]
            response_data.user_role = WorkRole(role)
            response_data.user_custom_role_name = membership.get("custom_role_name")
            response_data.user_department = membership.get("department")
            response_data.user_team = membership.get("team")
            # Determine is_admin based on role - ADMIN, OWNER, CEO, etc. are admins
            admin_roles = ["ADMIN", "OWNER", "CEO", "FOUNDER", "CO_FOUNDER", "PRESIDENT"]
            response_data.user_is_admin = membership.get("is_admin", role in admin_roles)
            response_data.user_can_invite = membership.get("can_invite", role in admin_roles or role in ["MANAGER", "SENIOR_MANAGER", "TEAM_LEAD", "DIRECTOR"])
            response_data.user_can_post = membership.get("can_post", True)
            response_data.user_job_title = membership.get("job_title")
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get organization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/members")
async def add_work_member(
    organization_id: str,
    member_data: WorkMemberAdd,
    current_user: User = Depends(get_current_user)
):
    """Add a new member to work organization"""
    try:
        # Check if organization exists
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ],
            "is_active": True
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if current user has permission to add members
        current_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not current_membership or not current_membership.get("can_invite", False):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to add members"
            )
        
        # Find user by email
        target_user = await db.users.find_one({"email": member_data.user_email})
        
        if not target_user:
            raise HTTPException(
                status_code=404,
                detail="User not found with this email"
            )
        
        # Check if user is already a member
        existing_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": target_user["id"],
            "is_active": True
        })
        
        if existing_membership:
            raise HTTPException(
                status_code=400,
                detail="User is already a member of this organization"
            )
        
        # Create new member
        member = WorkMember(
            organization_id=organization_id,
            user_id=target_user["id"],
            role=member_data.role,
            custom_role_name=member_data.custom_role_name if member_data.role == WorkRole.CUSTOM else None,
            department=member_data.department,
            team=member_data.team,
            job_title=member_data.job_title,
            can_invite=member_data.can_invite,
            is_admin=member_data.is_admin
        )
        
        member_dict = member.model_dump(by_alias=True)
        await db.work_members.insert_one(member_dict)
        
        # Update organization member count
        await db.work_organizations.update_one(
            {"id": organization_id},
            {"$inc": {"member_count": 1}}
        )
        
        return {
            "message": "Member added successfully",
            "member_id": member.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Add member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/members")
async def get_work_organization_members(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all members of a work organization"""
    try:
        # Check if organization exists
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ],
            "is_active": True
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if user is a member (for private organizations)
        if org.get("is_private", False):
            membership = await db.work_members.find_one({
                "organization_id": organization_id,
                "user_id": current_user.id,
                "is_active": True
            })
            
            if not membership:
                raise HTTPException(
                    status_code=403,
                    detail="Access denied"
                )
        
        # Get all members
        members = await db.work_members.find({
            "organization_id": organization_id,
            "is_active": True
        }).to_list(1000)
        
        # Enrich with user details
        member_responses = []
        for member in members:
            user = await db.users.find_one({"id": member["user_id"]})
            
            if user:
                # Handle field mapping for member
                member_data = member.copy()
                if "member_id" in member_data:
                    member_data["id"] = member_data.pop("member_id")
                
                member_response = WorkMemberResponse(
                    **member_data,
                    user_first_name=user["first_name"],
                    user_last_name=user["last_name"],
                    user_email=user["email"],
                    user_avatar_url=user.get("avatar_url") or user.get("profile_picture")
                )
                member_responses.append(member_response)
        
        # Group by department
        departments = {}
        for member in member_responses:
            dept = member.department or "No Department"
            if dept not in departments:
                departments[dept] = []
            departments[dept].append(member)
        
        return {
            "members": member_responses,
            "count": len(member_responses),
            "departments": departments
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get members error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/work/organizations/{organization_id}")
async def update_work_organization(
    organization_id: str,
    update_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update work organization details (admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership or not membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can update organization details"
            )
        
        # Update organization
        update_dict = {k: v for k, v in update_data.items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.work_organizations.update_one(
            {
                "$or": [
                    {"id": organization_id},
                    {"organization_id": organization_id}
                ]
            },
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return {"message": "Organization updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update organization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/leave")
async def leave_work_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Leave a work organization (remove self from members)"""
    try:
        # Find the user's membership
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(
                status_code=404,
                detail="You are not a member of this organization"
            )
        
        # Check if user is the only admin
        if membership.get("is_admin", False):
            admin_count = await db.work_members.count_documents({
                "organization_id": organization_id,
                "is_admin": True,
                "is_active": True
            })
            
            if admin_count <= 1:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot leave: You are the only admin. Please transfer admin rights first or delete the organization."
                )
        
        # Set membership as inactive (soft delete)
        await db.work_members.update_one(
            {"_id": membership["_id"]},
            {
                "$set": {
                    "is_active": False,
                    "left_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "message": "Successfully left the organization",
            "organization_id": organization_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Leave organization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/organizations/{organization_id}/members/{user_id}")
async def remove_work_organization_member(
    organization_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a member from organization (admin only)"""
    try:
        # Check if current user is admin
        admin_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not admin_membership or not admin_membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can remove members"
            )
        
        # Cannot remove yourself this way (use leave endpoint instead)
        if user_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Use the leave endpoint to remove yourself"
            )
        
        # Find the member to remove
        member = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": user_id,
            "is_active": True
        })
        
        if not member:
            raise HTTPException(
                status_code=404,
                detail="Member not found"
            )
        
        # Get organization to check creator
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        # Cannot remove the organization creator/owner
        if org and org.get("creator_id") == user_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot remove the organization owner. Transfer ownership first."
            )
        
        # Remove the member (soft delete)
        await db.work_members.update_one(
            {"_id": member["_id"]},
            {
                "$set": {
                    "is_active": False,
                    "removed_at": datetime.now(timezone.utc),
                    "removed_by": current_user.id
                }
            }
        )
        
        # Update organization member count
        await db.work_organizations.update_one(
            {"$or": [{"id": organization_id}, {"organization_id": organization_id}]},
            {"$inc": {"member_count": -1}}
        )
        
        # Send notification to removed member
        removed_user = await db.users.find_one({"id": user_id})
        if removed_user:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "work_member_removed",
                "title": "Вы удалены из организации",
                "message": f"Вы были удалены из организации {org.get('name', 'Unknown')}",
                "data": {
                    "organization_id": organization_id,
                    "organization_name": org.get("name"),
                    "removed_by": current_user.id
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
        
        return {
            "message": "Member removed successfully",
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Remove member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/work/organizations/{organization_id}/members/{user_id}/role")
async def update_work_member_role(
    organization_id: str,
    user_id: str,
    update_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update a member's role or admin status (admin only)"""
    try:
        # Check if current user is admin
        admin_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not admin_membership or not admin_membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can update member roles"
            )
        
        # Find the member to update
        member = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": user_id,
            "is_active": True
        })
        
        if not member:
            raise HTTPException(
                status_code=404,
                detail="Member not found"
            )
        
        # Get organization to check creator
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        # Cannot change role of organization owner (only ownership transfer can do that)
        if org and org.get("creator_id") == user_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot change the owner's role. Use transfer ownership instead."
            )
        
        # Build update dict
        update_dict = {}
        if "is_admin" in update_data:
            update_dict["is_admin"] = update_data["is_admin"]
        if "role" in update_data:
            update_dict["role"] = update_data["role"]
        if "job_title" in update_data:
            update_dict["job_title"] = update_data["job_title"]
        if "department" in update_data:
            update_dict["department"] = update_data["department"]
        if "team" in update_data:
            update_dict["team"] = update_data["team"]
        if "can_post" in update_data:
            update_dict["can_post"] = update_data["can_post"]
        if "can_invite" in update_data:
            update_dict["can_invite"] = update_data["can_invite"]
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Update the member
        await db.work_members.update_one(
            {"_id": member["_id"]},
            {"$set": update_dict}
        )
        
        # Send notification to member about role change
        target_user = await db.users.find_one({"id": user_id})
        if target_user and ("is_admin" in update_data or "role" in update_data):
            role_text = "администратором" if update_data.get("is_admin") else "членом"
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "work_role_updated",
                "title": "Ваша роль изменена",
                "message": f"Ваша роль в организации {org.get('name', 'Unknown')} была изменена на {role_text}",
                "data": {
                    "organization_id": organization_id,
                    "organization_name": org.get("name"),
                    "new_role": update_data.get("role"),
                    "is_admin": update_data.get("is_admin"),
                    "updated_by": current_user.id
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
        
        return {
            "message": "Member role updated successfully",
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update member role error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/transfer-ownership")
async def transfer_organization_ownership(
    organization_id: str,
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Transfer organization ownership to another admin (owner only)"""
    try:
        new_owner_id = data.get("new_owner_id")
        
        if not new_owner_id:
            raise HTTPException(status_code=400, detail="new_owner_id is required")
        
        # Get organization
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if current user is the owner
        if org.get("creator_id") != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Only the organization owner can transfer ownership"
            )
        
        # Cannot transfer to yourself
        if new_owner_id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="You are already the owner"
            )
        
        # Check if new owner is a member and preferably an admin
        new_owner_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": new_owner_id,
            "is_active": True
        })
        
        if not new_owner_membership:
            raise HTTPException(
                status_code=404,
                detail="New owner must be a member of the organization"
            )
        
        # Update organization creator
        await db.work_organizations.update_one(
            {"_id": org["_id"]},
            {
                "$set": {
                    "creator_id": new_owner_id,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Make new owner an admin if not already
        if not new_owner_membership.get("is_admin", False):
            await db.work_members.update_one(
                {"_id": new_owner_membership["_id"]},
                {"$set": {"is_admin": True}}
            )
        
        # Old owner remains as admin
        old_owner_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if old_owner_membership and not old_owner_membership.get("is_admin", False):
            await db.work_members.update_one(
                {"_id": old_owner_membership["_id"]},
                {"$set": {"is_admin": True}}
            )
        
        # Send notification to new owner
        new_owner = await db.users.find_one({"id": new_owner_id})
        if new_owner:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": new_owner_id,
                "type": "work_ownership_transferred",
                "title": "Вы теперь владелец организации",
                "message": f"Владение организацией {org.get('name', 'Unknown')} передано вам",
                "data": {
                    "organization_id": organization_id,
                    "organization_name": org.get("name"),
                    "previous_owner": current_user.id
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
        
        return {
            "message": "Ownership transferred successfully",
            "new_owner_id": new_owner_id,
            "organization_id": organization_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transfer ownership error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/join")
async def join_work_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Join a public organization instantly"""
    try:
        # Check if organization exists and is public
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        if org.get("is_private", False):
            raise HTTPException(
                status_code=403,
                detail="Cannot join private organization directly. Please request to join instead."
            )
        
        # Check if already a member
        existing_member = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if existing_member:
            raise HTTPException(status_code=400, detail="Already a member of this organization")
        
        # Create new membership
        new_member = {
            "id": str(uuid.uuid4()),
            "organization_id": organization_id,
            "user_id": current_user.id,
            "role": "Member",
            "department": None,
            "team": None,
            "is_admin": False,
            "can_invite": False,
            "permissions": {
                "can_post": True,
                "can_edit_profile": False,
                "can_manage_members": False
            },
            "is_active": True,
            "joined_at": datetime.now(timezone.utc)
        }
        
        await db.work_members.insert_one(new_member)
        
        return {
            "message": "Successfully joined organization",
            "organization_id": organization_id,
            "member_id": new_member["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Join organization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/request-join")
async def request_join_organization(
    organization_id: str,
    message: str = None,
    current_user: User = Depends(get_current_user)
):
    """Request to join a private organization"""
    try:
        # Check if organization exists
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Check if already a member
        existing_member = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if existing_member:
            raise HTTPException(status_code=400, detail="Already a member of this organization")
        
        # Check if already has pending request
        existing_request = await db.work_join_requests.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "pending"
        })
        
        if existing_request:
            raise HTTPException(status_code=400, detail="You already have a pending request for this organization")
        
        # Create join request
        request_id = str(uuid.uuid4())
        join_request = {
            "id": request_id,
            "organization_id": organization_id,
            "organization_name": org.get("name"),
            "organization_type": org.get("organization_type"),
            "user_id": current_user.id,
            "user_email": current_user.email,
            "user_name": f"{current_user.first_name} {current_user.last_name}",
            "message": message,
            "status": "pending",
            "requested_at": datetime.now(timezone.utc),
            "reviewed_at": None,
            "reviewed_by": None,
            "rejection_reason": None
        }
        
        await db.work_join_requests.insert_one(join_request)
        
        return {
            "message": "Join request sent successfully",
            "request_id": request_id,
            "organization_id": organization_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Request join error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/join-requests/my-requests")
async def get_my_join_requests(
    current_user: User = Depends(get_current_user)
):
    """Get all join requests made by current user"""
    try:
        requests = await db.work_join_requests.find({
            "user_id": current_user.id
        }).sort("requested_at", -1).to_list(length=100)
        
        # Clean up MongoDB _id field
        for req in requests:
            req.pop("_id", None)
        
        return {"requests": requests}
        
    except Exception as e:
        print(f"Get my requests error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/join-requests")
async def get_organization_join_requests(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all join requests for an organization (admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership or not membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can view join requests"
            )
        
        # Get pending requests
        requests = await db.work_join_requests.find({
            "organization_id": organization_id,
            "status": "pending"
        }).sort("requested_at", -1).to_list(length=100)
        
        # Clean up MongoDB _id field
        for req in requests:
            req.pop("_id", None)
        
        return {"requests": requests}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get org requests error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/join-requests/{request_id}/approve")
async def approve_join_request(
    request_id: str,
    role: str = "Member",
    current_user: User = Depends(get_current_user)
):
    """Approve a join request (admin only)"""
    try:
        # Get the request
        join_request = await db.work_join_requests.find_one({"id": request_id})
        
        if not join_request:
            raise HTTPException(status_code=404, detail="Join request not found")
        
        if join_request.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Request is not pending")
        
        # Check if current user is admin of the organization
        membership = await db.work_members.find_one({
            "organization_id": join_request["organization_id"],
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership or not membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can approve join requests"
            )
        
        # Check if user is already a member
        existing_member = await db.work_members.find_one({
            "organization_id": join_request["organization_id"],
            "user_id": join_request["user_id"],
            "is_active": True
        })
        
        if existing_member:
            # Update request as approved but don't create duplicate membership
            await db.work_join_requests.update_one(
                {"id": request_id},
                {
                    "$set": {
                        "status": "approved",
                        "reviewed_at": datetime.now(timezone.utc),
                        "reviewed_by": current_user.id
                    }
                }
            )
            return {"message": "User is already a member"}
        
        # Create new membership
        new_member = {
            "id": str(uuid.uuid4()),
            "organization_id": join_request["organization_id"],
            "user_id": join_request["user_id"],
            "role": role,
            "department": None,
            "team": None,
            "is_admin": False,
            "can_invite": False,
            "permissions": {
                "can_post": True,
                "can_edit_profile": False,
                "can_manage_members": False
            },
            "is_active": True,
            "joined_at": datetime.now(timezone.utc)
        }
        
        await db.work_members.insert_one(new_member)
        
        # Update request status
        await db.work_join_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "approved",
                    "reviewed_at": datetime.now(timezone.utc),
                    "reviewed_by": current_user.id
                }
            }
        )
        
        return {
            "message": "Join request approved successfully",
            "member_id": new_member["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Approve request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/join-requests/{request_id}/reject")
async def reject_join_request(
    request_id: str,
    rejection_reason: str = None,
    current_user: User = Depends(get_current_user)
):
    """Reject a join request (admin only)"""
    try:
        # Get the request
        join_request = await db.work_join_requests.find_one({"id": request_id})
        
        if not join_request:
            raise HTTPException(status_code=404, detail="Join request not found")
        
        if join_request.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Request is not pending")
        
        # Check if current user is admin of the organization
        membership = await db.work_members.find_one({
            "organization_id": join_request["organization_id"],
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership or not membership.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Only admins can reject join requests"
            )
        
        # Update request status
        await db.work_join_requests.update_one(
            {"id": request_id},
            {
                "$set": {
                    "status": "rejected",
                    "reviewed_at": datetime.now(timezone.utc),
                    "reviewed_by": current_user.id,
                    "rejection_reason": rejection_reason
                }
            }
        )
        
        return {"message": "Join request rejected"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Reject request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/join-requests/{request_id}")
async def cancel_join_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel own join request"""
    try:
        # Get the request
        join_request = await db.work_join_requests.find_one({"id": request_id})
        
        if not join_request:
            raise HTTPException(status_code=404, detail="Join request not found")
        
        # Check if current user owns the request
        if join_request.get("user_id") != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only cancel your own requests"
            )
        
        if join_request.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Can only cancel pending requests")
        
        # Delete the request
        await db.work_join_requests.delete_one({"id": request_id})
        
        return {"message": "Join request cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Cancel request error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === WORK ORGANIZATION POSTS API ENDPOINTS ===

@api_router.get("/work/posts/feed")
async def get_work_feed(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get posts feed from all organizations user is a member of"""
    try:
        # Get all organizations user is a member of
        memberships = await db.work_members.find({
            "user_id": current_user.id,
            "is_active": True
        }).to_list(length=None)
        
        org_ids = [m["organization_id"] for m in memberships]
        
        if not org_ids:
            return {"posts": [], "count": 0}
        
        # Get posts from all these organizations
        posts = await db.work_posts.find({
            "organization_id": {"$in": org_ids}
        }).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        # For each post, add organization info and check if user liked it
        for post in posts:
            post.pop("_id", None)
            
            # Get organization info
            org = await db.work_organizations.find_one({
                "$or": [
                    {"id": post["organization_id"]},
                    {"organization_id": post["organization_id"]}
                ]
            })
            
            if org:
                post["organization_name"] = org.get("name", "Unknown")
                post["organization_logo"] = org.get("logo_url", "")
            else:
                post["organization_name"] = "Unknown Organization"
                post["organization_logo"] = ""
            
            # Check if user liked this post
            like = await db.work_post_likes.find_one({
                "post_id": post["id"],
                "user_id": current_user.id
            })
            post["user_has_liked"] = like is not None
        
        return {"posts": posts, "count": len(posts)}
        
    except Exception as e:
        print(f"Get feed error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/posts")
async def create_work_post(
    organization_id: str,
    content: str,
    current_user: User = Depends(get_current_user)
):
    """Create a post on organization wall (members only)"""
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not membership:
            raise HTTPException(
                status_code=403,
                detail="Only members can post to the organization wall"
            )
        
        # Check if user has permission to post
        if not membership.get("can_post", False):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to post"
            )
        
        # Create post
        post_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        post = {
            "id": post_id,
            "organization_id": organization_id,
            "author_id": current_user.id,
            "author_name": f"{current_user.first_name} {current_user.last_name}",
            "author_email": current_user.email,
            "content": content,
            "likes_count": 0,
            "comments_count": 0,
            "created_at": now,
            "updated_at": now
        }
        
        await db.work_posts.insert_one(post)
        
        # Return serializable response
        return {
            "message": "Post created successfully",
            "post_id": post_id,
            "post": {
                "id": post_id,
                "organization_id": organization_id,
                "author_id": current_user.id,
                "author_name": f"{current_user.first_name} {current_user.last_name}",
                "author_email": current_user.email,
                "content": content,
                "likes_count": 0,
                "comments_count": 0,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/posts")
async def get_work_posts(
    organization_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get posts from organization wall"""
    try:
        # Check if user is a member or if org is public
        org = await db.work_organizations.find_one({
            "$or": [
                {"id": organization_id},
                {"organization_id": organization_id}
            ]
        })
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # If private, check membership
        if org.get("is_private", False):
            membership = await db.work_members.find_one({
                "organization_id": organization_id,
                "user_id": current_user.id,
                "is_active": True
            })
            
            if not membership:
                raise HTTPException(
                    status_code=403,
                    detail="Only members can view posts from private organizations"
                )
        
        # Get posts
        posts = await db.work_posts.find({
            "organization_id": organization_id
        }).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        # For each post, check if current user has liked it
        for post in posts:
            post.pop("_id", None)
            
            # Check if user liked this post
            like = await db.work_post_likes.find_one({
                "post_id": post["id"],
                "user_id": current_user.id
            })
            post["user_has_liked"] = like is not None
        
        return {"posts": posts, "count": len(posts)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get posts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/posts/{post_id}")
async def delete_work_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a post (author or admin only)"""
    try:
        # Get the post
        post = await db.work_posts.find_one({"id": post_id})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user is author
        is_author = post["author_id"] == current_user.id
        
        # Check if user is admin of the organization
        membership = await db.work_members.find_one({
            "organization_id": post["organization_id"],
            "user_id": current_user.id,
            "is_active": True
        })
        
        is_admin = membership and membership.get("is_admin", False)
        
        if not is_author and not is_admin:
            raise HTTPException(
                status_code=403,
                detail="Only the author or admin can delete this post"
            )
        
        # Delete the post
        await db.work_posts.delete_one({"id": post_id})
        
        # Delete associated likes
        await db.work_post_likes.delete_many({"post_id": post_id})
        
        # Delete associated comments
        await db.work_post_comments.delete_many({"post_id": post_id})
        
        return {"message": "Post deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/posts/{post_id}/like")
async def toggle_post_like(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a post"""
    try:
        # Check if post exists
        post = await db.work_posts.find_one({"id": post_id})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user already liked the post
        existing_like = await db.work_post_likes.find_one({
            "post_id": post_id,
            "user_id": current_user.id
        })
        
        if existing_like:
            # Unlike - remove the like
            await db.work_post_likes.delete_one({"_id": existing_like["_id"]})
            
            # Decrement likes count
            await db.work_posts.update_one(
                {"id": post_id},
                {"$inc": {"likes_count": -1}}
            )
            
            # Get updated count
            updated_post = await db.work_posts.find_one({"id": post_id})
            
            return {
                "message": "Post unliked",
                "liked": False,
                "likes_count": updated_post["likes_count"]
            }
        else:
            # Like - add the like
            like = {
                "id": str(uuid.uuid4()),
                "post_id": post_id,
                "user_id": current_user.id,
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.work_post_likes.insert_one(like)
            
            # Increment likes count
            await db.work_posts.update_one(
                {"id": post_id},
                {"$inc": {"likes_count": 1}}
            )
            
            # Get updated count
            updated_post = await db.work_posts.find_one({"id": post_id})
            
            return {
                "message": "Post liked",
                "liked": True,
                "likes_count": updated_post["likes_count"]
            }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Toggle like error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/posts/{post_id}/comment")
async def add_post_comment(
    post_id: str,
    content: str,
    current_user: User = Depends(get_current_user)
):
    """Add a comment to a post"""
    try:
        # Check if post exists
        post = await db.work_posts.find_one({"id": post_id})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Create comment
        comment_id = str(uuid.uuid4())
        comment = {
            "id": comment_id,
            "post_id": post_id,
            "author_id": current_user.id,
            "author_name": f"{current_user.first_name} {current_user.last_name}",
            "author_email": current_user.email,
            "content": content,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.work_post_comments.insert_one(comment)
        
        # Increment comments count
        await db.work_posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Get updated count
        updated_post = await db.work_posts.find_one({"id": post_id})
        
        return {
            "message": "Comment added successfully",
            "comment_id": comment_id,
            "comments_count": updated_post["comments_count"],
            "comment": comment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Add comment error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get comments for a post"""
    try:
        # Check if post exists
        post = await db.work_posts.find_one({"id": post_id})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Get comments
        comments = await db.work_post_comments.find({
            "post_id": post_id
        }).sort("created_at", 1).limit(limit).to_list(length=limit)
        
        # Clean up MongoDB _id
        for comment in comments:
            comment.pop("_id", None)
        
        return {"comments": comments, "count": len(comments)}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get comments error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === END WORK ORGANIZATION SYSTEM API ENDPOINTS ===

# Basic status endpoints
@api_router.get("/")
async def root():
    return {"message": "ZION.CITY API v1.0.0", "status": "operational"}

# ===== DEPARTMENTS API ENDPOINTS =====

@api_router.post("/organizations/{organization_id}/departments")
async def create_department(
    organization_id: str,
    department_data: DepartmentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new department in an organization."""
    try:
        # Check if organization exists
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Check if user is OWNER or ADMIN or has is_admin=True
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        is_authorized = (
            membership.get("role") in ["OWNER", "ADMIN", "CEO"] or 
            membership.get("is_admin") is True
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Только владелец или администратор может создавать отделы")
        
        # Create department
        department = Department(
            organization_id=organization_id,
            name=department_data.name,
            description=department_data.description,
            color=department_data.color,
            head_id=department_data.head_id
        )
        
        await db.departments.insert_one(department.dict())
        
        return {"success": True, "data": department.dict()}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/departments")
async def list_departments(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """List all departments in an organization."""
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Get all departments
        departments_cursor = db.departments.find({"organization_id": organization_id})
        departments = await departments_cursor.to_list(length=None)
        
        # Enrich with head name and member count
        result = []
        for dept in departments:
            # Get member count
            member_count = await db.department_members.count_documents({"department_id": dept["id"]})
            dept["member_count"] = member_count
            
            # Get head name if exists
            if dept.get("head_id"):
                head_user = await db.users.find_one({"id": dept["head_id"]})
                if head_user:
                    dept["head_name"] = f"{head_user.get('first_name', '')} {head_user.get('last_name', '')}"
            
            result.append(dept)
        
        return {"success": True, "data": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/organizations/{organization_id}/departments/{dept_id}")
async def update_department(
    organization_id: str,
    dept_id: str,
    department_data: DepartmentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a department."""
    try:
        # Check if department exists
        department = await db.departments.find_one({"id": dept_id, "organization_id": organization_id})
        if not department:
            raise HTTPException(status_code=404, detail="Отдел не найден")
        
        # Check permissions (OWNER, ADMIN, or DEPARTMENT_HEAD)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_dept_head = department.get("head_id") == current_user["id"]
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or is_dept_head
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования отдела")
        
        # Update department
        update_data = {k: v for k, v in department_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.departments.update_one(
            {"id": dept_id},
            {"$set": update_data}
        )
        
        # Get updated department
        updated_dept = await db.departments.find_one({"id": dept_id})
        
        # Add member count
        member_count = await db.department_members.count_documents({"department_id": dept_id})
        updated_dept["member_count"] = member_count
        
        return {"success": True, "data": updated_dept}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/organizations/{organization_id}/departments/{dept_id}")
async def delete_department(
    organization_id: str,
    dept_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a department."""
    try:
        # Check permissions (OWNER or ADMIN only)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or membership.get("role") not in ["OWNER", "ADMIN"]:
            raise HTTPException(status_code=403, detail="Только владелец или администратор может удалять отделы")
        
        # Delete department members first
        await db.department_members.delete_many({"department_id": dept_id})
        
        # Delete department
        result = await db.departments.delete_one({"id": dept_id, "organization_id": organization_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Отдел не найден")
        
        return {"success": True, "message": "Отдел успешно удален"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/organizations/{organization_id}/departments/{dept_id}/members")
async def add_department_member(
    organization_id: str,
    dept_id: str,
    member_data: DepartmentMemberAdd,
    current_user: User = Depends(get_current_user)
):
    """Add a member to a department."""
    try:
        # Check if department exists
        department = await db.departments.find_one({"id": dept_id, "organization_id": organization_id})
        if not department:
            raise HTTPException(status_code=404, detail="Отдел не найден")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_dept_head = department.get("head_id") == current_user["id"]
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or is_dept_head
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для добавления членов в отдел")
        
        # Check if user is organization member
        target_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": member_data.user_id,
            "status": "ACTIVE"
        })
        
        if not target_membership:
            raise HTTPException(status_code=400, detail="Пользователь не является членом организации")
        
        # Check if already in department
        existing = await db.department_members.find_one({
            "department_id": dept_id,
            "user_id": member_data.user_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь уже состоит в этом отделе")
        
        # Add member
        dept_member = DepartmentMember(
            department_id=dept_id,
            user_id=member_data.user_id,
            role=member_data.role
        )
        
        await db.department_members.insert_one(dept_member.dict())
        
        # Get user details
        user = await db.users.find_one({"id": member_data.user_id})
        
        result = dept_member.dict()
        result["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
        
        return {"success": True, "data": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/departments/{dept_id}/members")
async def list_department_members(
    organization_id: str,
    dept_id: str,
    current_user: User = Depends(get_current_user)
):
    """List all members of a department."""
    try:
        # Check if user is organization member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Get department members
        members_cursor = db.department_members.find({"department_id": dept_id})
        members = await members_cursor.to_list(length=None)
        
        # Enrich with user details
        result = []
        for member in members:
            user = await db.users.find_one({"id": member["user_id"]})
            if user:
                member["user_name"] = f"{user.get('first_name', '')} {user.get('last_name', '')}"
                member["user_email"] = user.get("email", "")
                member["user_avatar"] = user.get("avatar_url")
                result.append(member)
        
        return {"success": True, "data": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/organizations/{organization_id}/departments/{dept_id}/members/{user_id}")
async def remove_department_member(
    organization_id: str,
    dept_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a member from a department."""
    try:
        # Check if department exists
        department = await db.departments.find_one({"id": dept_id, "organization_id": organization_id})
        if not department:
            raise HTTPException(status_code=404, detail="Отдел не найден")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_dept_head = department.get("head_id") == current_user["id"]
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or is_dept_head
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для удаления членов из отдела")
        
        # Remove member
        result = await db.department_members.delete_one({
            "department_id": dept_id,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Член отдела не найден")
        
        return {"success": True, "message": "Член удален из отдела"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== ANNOUNCEMENTS API ENDPOINTS =====

@api_router.post("/organizations/{organization_id}/announcements")
async def create_announcement(
    organization_id: str,
    announcement_data: AnnouncementCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new announcement."""
    try:
        # Check if organization exists
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Check permissions (OWNER, ADMIN, or DEPARTMENT_HEAD)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_dept_head = False
        if announcement_data.department_id:
            dept = await db.departments.find_one({"id": announcement_data.department_id})
            if dept:
                is_dept_head = dept.get("head_id") == current_user["id"]
        
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or is_dept_head
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для создания объявлений")
        
        # Create announcement
        announcement = Announcement(
            organization_id=organization_id,
            department_id=announcement_data.department_id,
            title=announcement_data.title,
            content=announcement_data.content,
            priority=announcement_data.priority,
            author_id=current_user["id"],
            target_type=announcement_data.target_type,
            target_departments=announcement_data.target_departments,
            is_pinned=announcement_data.is_pinned
        )
        
        await db.announcements.insert_one(announcement.dict())
        
        # Enrich response with author name
        result = announcement.dict()
        result["author_name"] = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}"
        
        return {"success": True, "data": result}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/announcements")
async def list_announcements(
    organization_id: str,
    department_id: Optional[str] = None,
    priority: Optional[str] = None,
    pinned: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """List announcements in an organization."""
    try:
        # Check if user is member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Build query
        query = {"organization_id": organization_id}
        
        if priority:
            query["priority"] = priority
        
        if pinned is not None:
            query["is_pinned"] = pinned
        
        # Handle department filtering
        if department_id:
            query["$or"] = [
                {"target_type": "ALL"},
                {"department_id": department_id},
                {"target_departments": department_id}
            ]
        
        # Get total count
        total = await db.announcements.count_documents(query)
        
        # Get announcements with sorting (pinned first, then by date)
        announcements_cursor = db.announcements.find(query).sort([
            ("is_pinned", -1),
            ("created_at", -1)
        ]).skip(offset).limit(limit)
        
        announcements = await announcements_cursor.to_list(length=None)
        
        # Enrich with author and department details
        result = []
        for ann in announcements:
            # Get author details
            author = await db.users.find_one({"id": ann["author_id"]})
            if author:
                ann["author_name"] = f"{author.get('first_name', '')} {author.get('last_name', '')}"
                ann["author_avatar"] = author.get("avatar_url")
            
            # Get department details if exists
            if ann.get("department_id"):
                dept = await db.departments.find_one({"id": ann["department_id"]})
                if dept:
                    ann["department_name"] = dept.get("name")
                    ann["department_color"] = dept.get("color")
            
            result.append(ann)
        
        return {
            "success": True,
            "data": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/organizations/{organization_id}/announcements/{announcement_id}")
async def update_announcement(
    organization_id: str,
    announcement_id: str,
    announcement_data: AnnouncementUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an announcement."""
    try:
        # Check if announcement exists
        announcement = await db.announcements.find_one({
            "id": announcement_id,
            "organization_id": organization_id
        })
        
        if not announcement:
            raise HTTPException(status_code=404, detail="Объявление не найдено")
        
        # Check permissions (Author, OWNER, or ADMIN)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_author = announcement.get("author_id") == current_user["id"]
        is_authorized = is_author or (membership and membership.get("role") in ["OWNER", "ADMIN"])
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования объявления")
        
        # Update announcement
        update_data = {k: v for k, v in announcement_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.announcements.update_one(
            {"id": announcement_id},
            {"$set": update_data}
        )
        
        # Get updated announcement
        updated_ann = await db.announcements.find_one({"id": announcement_id})
        
        return {"success": True, "data": updated_ann}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/organizations/{organization_id}/announcements/{announcement_id}")
async def delete_announcement(
    organization_id: str,
    announcement_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an announcement."""
    try:
        # Check if announcement exists
        announcement = await db.announcements.find_one({
            "id": announcement_id,
            "organization_id": organization_id
        })
        
        if not announcement:
            raise HTTPException(status_code=404, detail="Объявление не найдено")
        
        # Check permissions (Author, OWNER, or ADMIN)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_author = announcement.get("author_id") == current_user["id"]
        is_authorized = is_author or (membership and membership.get("role") in ["OWNER", "ADMIN"])
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для удаления объявления")
        
        # Delete reactions first
        await db.announcement_reactions.delete_many({"announcement_id": announcement_id})
        
        # Delete announcement
        await db.announcements.delete_one({"id": announcement_id})
        
        return {"success": True, "message": "Объявление успешно удалено"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/organizations/{organization_id}/announcements/{announcement_id}/pin")
async def pin_announcement(
    organization_id: str,
    announcement_id: str,
    pin_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Pin or unpin an announcement."""
    try:
        # Check permissions (OWNER or ADMIN only)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or membership.get("role") not in ["OWNER", "ADMIN"]:
            raise HTTPException(status_code=403, detail="Только владелец или администратор может закреплять объявления")
        
        # Update pin status
        is_pinned = pin_data.get("is_pinned", False)
        await db.announcements.update_one(
            {"id": announcement_id, "organization_id": organization_id},
            {"$set": {"is_pinned": is_pinned, "updated_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": True, "data": {"id": announcement_id, "is_pinned": is_pinned}}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/organizations/{organization_id}/announcements/{announcement_id}/view")
async def track_announcement_view(
    organization_id: str,
    announcement_id: str,
    current_user: User = Depends(get_current_user)
):
    """Track an announcement view."""
    try:
        # Check if user is member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Increment view count
        result = await db.announcements.update_one(
            {"id": announcement_id, "organization_id": organization_id},
            {"$inc": {"views": 1}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Объявление не найдено")
        
        # Get updated view count
        announcement = await db.announcements.find_one({"id": announcement_id})
        
        return {"success": True, "data": {"views": announcement.get("views", 0)}}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/organizations/{organization_id}/announcements/{announcement_id}/react")
async def react_to_announcement(
    organization_id: str,
    announcement_id: str,
    reaction_data: AnnouncementReactionRequest,
    current_user: User = Depends(get_current_user)
):
    """React to an announcement (toggle reaction)."""
    try:
        # Check if user is member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Check if reaction already exists
        existing_reaction = await db.announcement_reactions.find_one({
            "announcement_id": announcement_id,
            "user_id": current_user.id,
            "reaction_type": reaction_data.reaction_type
        })
        
        if existing_reaction:
            # Remove reaction (toggle off)
            await db.announcement_reactions.delete_one({"id": existing_reaction["id"]})
        else:
            # Add reaction
            reaction = AnnouncementReaction(
                announcement_id=announcement_id,
                user_id=current_user.id,
                reaction_type=reaction_data.reaction_type
            )
            await db.announcement_reactions.insert_one(reaction.dict())
        
        # Recalculate reaction counts
        pipeline = [
            {"$match": {"announcement_id": announcement_id}},
            {"$group": {
                "_id": "$reaction_type",
                "count": {"$sum": 1}
            }}
        ]
        
        reaction_counts = {}
        async for result in db.announcement_reactions.aggregate(pipeline):
            reaction_counts[result["_id"]] = result["count"]
        
        # Update announcement reactions
        await db.announcements.update_one(
            {"id": announcement_id},
            {"$set": {"reactions": reaction_counts}}
        )
        
        return {"success": True, "data": {"reactions": reaction_counts}}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END DEPARTMENTS & ANNOUNCEMENTS ENDPOINTS =====

# ===== ORGANIZATION FOLLOW ENDPOINTS =====

@api_router.post("/organizations/{organization_id}/follow")
async def follow_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Follow an organization."""
    try:
        # Check if organization exists
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Check if already following
        existing_follow = await db.organization_follows.find_one({
            "organization_id": organization_id,
            "follower_id": current_user["id"]
        })
        
        if existing_follow:
            raise HTTPException(status_code=400, detail="Вы уже подписаны на эту организацию")
        
        # Create follow
        follow = OrganizationFollow(
            organization_id=organization_id,
            follower_id=current_user["id"]
        )
        
        await db.organization_follows.insert_one(follow.dict())
        
        return {"success": True, "message": "Вы подписались на организацию"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/organizations/{organization_id}/follow")
async def unfollow_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Unfollow an organization."""
    try:
        # Delete follow
        result = await db.organization_follows.delete_one({
            "organization_id": organization_id,
            "follower_id": current_user["id"]
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Вы не подписаны на эту организацию")
        
        return {"success": True, "message": "Вы отписались от организации"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/follow/status")
async def get_follow_status(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check if user is following an organization."""
    try:
        follow = await db.organization_follows.find_one({
            "organization_id": organization_id,
            "follower_id": current_user["id"]
        })
        
        return {
            "success": True,
            "is_following": follow is not None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/followers")
async def get_organization_followers(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get list of followers for an organization."""
    try:
        # Check if organization exists
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Get followers
        followers_cursor = db.organization_follows.find({"organization_id": organization_id})
        followers = await followers_cursor.to_list(length=None)
        
        # Enrich with user details
        result = []
        for follow in followers:
            user = await db.users.find_one({"id": follow["follower_id"]})
            if user:
                result.append({
                    "user_id": user["id"],
                    "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
                    "user_avatar": user.get("avatar_url"),
                    "followed_at": follow["followed_at"]
                })
        
        return {
            "success": True,
            "data": result,
            "count": len(result)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== ENHANCED JOIN REQUEST WITH NOTIFICATIONS =====

@api_router.post("/organizations/{organization_id}/join-request")
async def create_join_request_with_notification(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Send a join request to an organization and notify admins."""
    try:
        # Check if organization exists
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Check if already a member
        existing_member = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user["id"]
        })
        
        if existing_member:
            raise HTTPException(status_code=400, detail="Вы уже являетесь членом этой организации")
        
        # Check if already has pending request
        existing_request = await db.work_join_requests.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "PENDING"
        })
        
        if existing_request:
            raise HTTPException(status_code=400, detail="Вы уже отправили запрос на вступление")
        
        # Create join request
        join_request = {
            "id": str(uuid.uuid4()),
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "PENDING",
            "message": "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.work_join_requests.insert_one(join_request)
        
        # Create notifications for organization admins
        # Find all OWNER and ADMIN members
        admin_members_cursor = db.work_members.find({
            "organization_id": organization_id,
            "role": {"$in": ["OWNER", "ADMIN"]},
            "status": "ACTIVE"
        })
        admin_members = await admin_members_cursor.to_list(length=None)
        
        # Create notification for each admin
        for admin in admin_members:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": admin["user_id"],
                "type": "ORGANIZATION_JOIN_REQUEST",
                "title": "Новый запрос на вступление",
                "message": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')} хочет присоединиться к организации {organization.get('name', '')}",
                "data": {
                    "organization_id": organization_id,
                    "organization_name": organization.get("name"),
                    "request_id": join_request["id"],
                    "requester_id": current_user["id"],
                    "requester_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}"
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
        
        return {
            "success": True,
            "message": "Запрос на вступление отправлен",
            "data": join_request
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/organizations/{organization_id}/public")
async def get_organization_public_profile(
    organization_id: str
):
    """Get public profile of an organization (no auth required)."""
    try:
        # Get organization
        organization = await db.work_organizations.find_one({"id": organization_id})
        if not organization:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # Get member count
        member_count = await db.work_members.count_documents({
            "organization_id": organization_id,
            "status": "ACTIVE"
        })
        
        # Get follower count
        follower_count = await db.organization_follows.count_documents({
            "organization_id": organization_id
        })
        
        # Get department count
        department_count = await db.departments.count_documents({
            "organization_id": organization_id
        })
        
        # Build public profile
        public_profile = {
            "id": organization["id"],
            "name": organization.get("name"),
            "description": organization.get("description"),
            "organization_type": organization.get("organization_type"),
            "industry": organization.get("industry"),
            "founded_year": organization.get("founded_year"),
            "logo_url": organization.get("logo_url"),
            "banner_url": organization.get("banner_url"),
            "location": organization.get("location"),
            "website": organization.get("website"),
            "member_count": member_count,
            "follower_count": follower_count,
            "department_count": department_count,
            "is_public": organization.get("is_public", True),
            "created_at": organization.get("created_at")
        }
        
        return {"success": True, "data": public_profile}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END ORGANIZATION FOLLOW & JOIN REQUEST ENDPOINTS =====

# ===== MEMBER SETTINGS & CHANGE REQUEST ENDPOINTS =====

@api_router.put("/work/organizations/{organization_id}/members/me")
async def update_my_member_settings(
    organization_id: str,
    settings: WorkMemberSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Member updates their own settings.
    - job_title: Applied immediately
    - role/department/team changes: Create change requests for admin approval
    """
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=404, detail="Вы не являетесь членом этой организации")
        
        # Update job title immediately (no approval needed)
        if settings.job_title is not None:
            await db.work_members.update_one(
                {"_id": membership["_id"]},
                {"$set": {"job_title": settings.job_title, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Create change requests for role/department/team changes
        change_requests_created = []
        
        if settings.requested_role is not None:
            change_request = WorkChangeRequest(
                organization_id=organization_id,
                user_id=current_user.id,
                request_type=ChangeRequestType.ROLE_CHANGE,
                current_role=WorkRole(membership["role"]),
                requested_role=settings.requested_role,
                requested_custom_role_name=settings.requested_custom_role_name,
                reason=settings.reason
            )
            await db.work_change_requests.insert_one(change_request.model_dump(by_alias=True))
            change_requests_created.append("role")
        
        if settings.requested_department is not None:
            change_request = WorkChangeRequest(
                organization_id=organization_id,
                user_id=current_user.id,
                request_type=ChangeRequestType.DEPARTMENT_CHANGE,
                current_department=membership.get("department"),
                requested_department=settings.requested_department,
                reason=settings.reason
            )
            await db.work_change_requests.insert_one(change_request.model_dump(by_alias=True))
            change_requests_created.append("department")
        
        if settings.requested_team is not None:
            change_request = WorkChangeRequest(
                organization_id=organization_id,
                user_id=current_user.id,
                request_type=ChangeRequestType.TEAM_CHANGE,
                current_team=membership.get("team"),
                requested_team=settings.requested_team,
                reason=settings.reason
            )
            await db.work_change_requests.insert_one(change_request.model_dump(by_alias=True))
            change_requests_created.append("team")
        
        return {
            "success": True,
            "message": "Настройки обновлены",
            "job_title_updated": settings.job_title is not None,
            "change_requests_created": change_requests_created
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/change-requests")
async def get_change_requests(
    organization_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all pending change requests for the organization (Admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра запросов")
        
        # Build query
        query = {"organization_id": organization_id}
        if status:
            query["status"] = status
        else:
            query["status"] = "PENDING"  # Default to pending
        
        # Get requests
        requests_cursor = db.work_change_requests.find(query).sort("created_at", -1)
        requests = await requests_cursor.to_list(100)
        
        # Enrich with user details
        enriched_requests = []
        for req in requests:
            user = await db.users.find_one({"id": req["user_id"]})
            if user:
                enriched_requests.append(WorkChangeRequestResponse(
                    id=req["id"],
                    organization_id=req["organization_id"],
                    user_id=req["user_id"],
                    request_type=req["request_type"],
                    current_role=req.get("current_role"),
                    current_department=req.get("current_department"),
                    current_team=req.get("current_team"),
                    current_job_title=req.get("current_job_title"),
                    requested_role=req.get("requested_role"),
                    requested_custom_role_name=req.get("requested_custom_role_name"),
                    requested_department=req.get("requested_department"),
                    requested_team=req.get("requested_team"),
                    requested_job_title=req.get("requested_job_title"),
                    reason=req.get("reason"),
                    status=req["status"],
                    reviewed_by=req.get("reviewed_by"),
                    reviewed_at=req.get("reviewed_at"),
                    rejection_reason=req.get("rejection_reason"),
                    created_at=req["created_at"],
                    user_first_name=user.get("first_name", ""),
                    user_last_name=user.get("last_name", ""),
                    user_email=user.get("email", ""),
                    user_avatar_url=user.get("avatar_url")
                ))
        
        return {"success": True, "data": enriched_requests}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/change-requests/{request_id}/approve")
async def approve_change_request(
    organization_id: str,
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Admin approves a change request"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав для одобрения запросов")
        
        # Get the request
        request = await db.work_change_requests.find_one({
            "id": request_id,
            "organization_id": organization_id,
            "status": "PENDING"
        })
        
        if not request:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        
        # Apply the changes based on request type
        target_membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": request["user_id"],
            "status": "ACTIVE"
        })
        
        if not target_membership:
            raise HTTPException(status_code=404, detail="Член организации не найден")
        
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        
        if request["request_type"] == "ROLE_CHANGE" and request.get("requested_role"):
            update_fields["role"] = request["requested_role"]
            if request.get("requested_custom_role_name"):
                update_fields["custom_role_name"] = request["requested_custom_role_name"]
        
        if request["request_type"] == "DEPARTMENT_CHANGE" and request.get("requested_department"):
            update_fields["department"] = request["requested_department"]
        
        if request["request_type"] == "TEAM_CHANGE" and request.get("requested_team"):
            update_fields["team"] = request["requested_team"]
        
        # Update member
        await db.work_members.update_one(
            {"_id": target_membership["_id"]},
            {"$set": update_fields}
        )
        
        # Mark request as approved
        await db.work_change_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": "APPROVED",
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"success": True, "message": "Запрос одобрен"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/change-requests/{request_id}/reject")
async def reject_change_request(
    organization_id: str,
    request_id: str,
    rejection_reason: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Admin rejects a change request"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав для отклонения запросов")
        
        # Get the request
        request = await db.work_change_requests.find_one({
            "id": request_id,
            "organization_id": organization_id,
            "status": "PENDING"
        })
        
        if not request:
            raise HTTPException(status_code=404, detail="Запрос не найден")
        
        # Mark request as rejected
        await db.work_change_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": "REJECTED",
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc),
                "rejection_reason": rejection_reason
            }}
        )
        
        return {"success": True, "message": "Запрос отклонен"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/teams")
async def create_team(
    organization_id: str,
    team_data: WorkTeamCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new team (any member can create)"""
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=404, detail="Вы не являетесь членом этой организации")
        
        # Create team
        team = WorkTeam(
            organization_id=organization_id,
            name=team_data.name,
            description=team_data.description,
            department_id=team_data.department_id,
            team_lead_id=team_data.team_lead_id or current_user.id,
            member_ids=[current_user.id],  # Creator is first member
            created_by=current_user.id
        )
        
        await db.work_teams.insert_one(team.model_dump(by_alias=True))
        
        return {"success": True, "message": "Команда создана", "team_id": team.id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/teams")
async def get_teams(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all teams in the organization"""
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=404, detail="Вы не являетесь членом этой организации")
        
        # Get teams
        teams_cursor = db.work_teams.find({
            "organization_id": organization_id,
            "is_active": True
        })
        teams = await teams_cursor.to_list(100)
        
        # Clean teams data for JSON serialization
        for team in teams:
            team.pop("_id", None)  # Remove MongoDB ObjectId
        
        return {"success": True, "data": teams}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END MEMBER SETTINGS & CHANGE REQUEST ENDPOINTS =====

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc),
        "version": "1.0.0"
    }

# Include the router in the main app
app.include_router(api_router)

# Serve uploaded files
# Mount uploads directory for serving static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()