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

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content: str
    source_module: str = "family"  # Module where post was created
    target_audience: str = "module"  # "module", "public", "private"
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

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone: Optional[str] = None
    password_hash: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    avatar_url: Optional[str] = None
    role: UserRole = UserRole.ADULT
    is_active: bool = True
    is_verified: bool = False
    privacy_settings: PrivacySettings = Field(default_factory=PrivacySettings)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

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
    invited_user_email: str  # Email of person being invited
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

# === INPUT/OUTPUT MODELS ===

class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    middle_name: Optional[str]
    role: UserRole
    is_active: bool
    is_verified: bool
    privacy_settings: PrivacySettings
    created_at: datetime
    affiliations: Optional[List[Dict[str, Any]]] = []

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
    invited_user_email: str
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
    """Get all family member user IDs for a given user"""
    family_memberships = await db.family_members.find({"user_id": user_id, "is_active": True}).to_list(100)
    
    connected_users = set()
    
    for membership in family_memberships:
        # Get all other members of the same family
        family_members = await db.family_members.find({
            "family_id": membership["family_id"], 
            "is_active": True
        }).to_list(100)
        
        for member in family_members:
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
        return await get_user_family_connections(user_id)
    elif module == "organizations":
        return await get_user_organization_connections(user_id)
    elif module in ["news", "journal", "services", "marketplace", "finance", "events"]:
        # For other modules, use a combination of family and organization connections
        family_connections = await get_user_family_connections(user_id)
        org_connections = await get_user_organization_connections(user_id)
        return list(set(family_connections + org_connections))
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
        date_of_birth=user_data.date_of_birth
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
        affiliations=affiliations
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
        role=current_user.role,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        privacy_settings=current_user.privacy_settings,
        created_at=current_user.created_at,
        affiliations=affiliations
    )

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
            family_response = FamilyProfileResponse(**family)
            family_response.is_user_member = True
            family_response.user_role = FamilyRole(membership["family_role"])
            families.append(family_response)
    
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
    if invitation.get("expires_at") and invitation["expires_at"] < datetime.now(timezone.utc):
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

# Helper function for family access
async def get_user_family_ids(user_id: str) -> List[str]:
    """Get list of family IDs user belongs to"""
    family_memberships = await db.family_members.find({
        "user_id": user_id,
        "is_active": True,
        "invitation_accepted": True
    }).to_list(100)
    return [membership["family_id"] for membership in family_memberships]

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

# Posts Endpoints
@api_router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    module: str = "family",  # Module to filter posts by
    current_user: User = Depends(get_current_user)
):
    """Get posts feed filtered by module and user connections"""
    
    # Get connected users based on module
    connected_users = await get_module_connections(current_user.id, module)
    
    # Query posts from connected users in the specified module
    posts = await db.posts.find({
        "is_published": True,
        "source_module": module,
        "user_id": {"$in": connected_users}
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Remove MongoDB _id and get additional info
    result = []
    for post in posts:
        post.pop("_id", None)
        
        # Get author info
        author = await get_user_by_id(post["user_id"])
        post["author"] = {
            "id": author.id,
            "first_name": author.first_name,
            "last_name": author.last_name
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
    media_file_ids: List[str] = Form(default=[]),
    current_user: User = Depends(get_current_user)
):
    """Create a new post with optional media attachments"""
    
    # Handle empty list case for media_file_ids
    if isinstance(media_file_ids, str):
        media_file_ids = [media_file_ids] if media_file_ids else []
    
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
    
    # Create post with module information
    new_post = Post(
        user_id=current_user.id,
        content=content,
        source_module=source_module,
        target_audience=target_audience,
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
            "last_name": author.last_name
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

# Basic status endpoints
@api_router.get("/")
async def root():
    return {"message": "ZION.CITY API v1.0.0", "status": "operational"}

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