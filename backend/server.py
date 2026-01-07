from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query, Request, WebSocket, WebSocketDisconnect, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import aiofiles
import re
import json
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timedelta, timezone, date
from passlib.context import CryptContext
import jwt
from enum import Enum
import asyncio
import qrcode
from io import BytesIO
import base64
from functools import lru_cache
from contextlib import asynccontextmanager
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============================================================
# PRODUCTION CONFIGURATION
# ============================================================

# Environment detection
IS_PRODUCTION = os.environ.get('ENVIRONMENT', 'development') == 'production'

# MongoDB connection with optimized settings for production
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=100,              # Maximum connection pool size
    minPoolSize=10,               # Minimum connections to maintain
    maxIdleTimeMS=45000,          # Close idle connections after 45 seconds
    serverSelectionTimeoutMS=5000, # Timeout for server selection
    connectTimeoutMS=10000,        # Connection timeout
    socketTimeoutMS=30000,         # Socket timeout for operations
    retryWrites=True,              # Retry failed writes
    w='majority' if IS_PRODUCTION else 1,  # Write concern
)
db = client[os.environ.get('DB_NAME', 'zion_city')]

# ============================================================
# IN-MEMORY CACHE (Simple LRU Cache for frequent queries)
# ============================================================

class SimpleCache:
    """Simple in-memory cache with TTL for frequent queries"""
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, float] = {}
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        async with self._lock:
            if key in self._cache:
                if time.time() - self._timestamps[key] < self.default_ttl:
                    return self._cache[key]
                else:
                    # Expired, remove it
                    del self._cache[key]
                    del self._timestamps[key]
        return None
    
    async def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache with TTL"""
        async with self._lock:
            self._cache[key] = value
            self._timestamps[key] = time.time()
    
    async def delete(self, key: str):
        """Delete key from cache"""
        async with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
    
    async def clear_expired(self):
        """Clean up expired entries"""
        async with self._lock:
            current_time = time.time()
            expired_keys = [
                k for k, t in self._timestamps.items() 
                if current_time - t >= self.default_ttl
            ]
            for key in expired_keys:
                del self._cache[key]
                del self._timestamps[key]

# Initialize cache
cache = SimpleCache(default_ttl=300)  # 5 minutes TTL

# ============================================================
# RATE LIMITING (In-memory, simple implementation)
# ============================================================

class RateLimiter:
    """Simple in-memory rate limiter"""
    def __init__(self):
        self._requests: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()
    
    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """Check if request is allowed within rate limit"""
        async with self._lock:
            current_time = time.time()
            window_start = current_time - window_seconds
            
            # Clean old requests
            if key in self._requests:
                self._requests[key] = [t for t in self._requests[key] if t > window_start]
            else:
                self._requests[key] = []
            
            # Check limit
            if len(self._requests[key]) >= max_requests:
                return False
            
            # Add current request
            self._requests[key].append(current_time)
            return True
    
    async def cleanup(self):
        """Clean up old entries"""
        async with self._lock:
            current_time = time.time()
            # Remove entries older than 1 hour
            for key in list(self._requests.keys()):
                self._requests[key] = [t for t in self._requests[key] if current_time - t < 3600]
                if not self._requests[key]:
                    del self._requests[key]

# Initialize rate limiter
rate_limiter = RateLimiter()

# Rate limit configurations
RATE_LIMITS = {
    "ai_chat": {"max_requests": 20, "window_seconds": 60},      # 20 AI requests/minute
    "ai_analysis": {"max_requests": 10, "window_seconds": 60},  # 10 file analyses/minute
    "search": {"max_requests": 30, "window_seconds": 60},       # 30 searches/minute
    "posts": {"max_requests": 10, "window_seconds": 60},        # 10 posts/minute
    "default": {"max_requests": 100, "window_seconds": 60},     # 100 general requests/minute
}

async def check_rate_limit(user_id: str, limit_type: str = "default") -> bool:
    """Check if user is within rate limit"""
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["default"])
    key = f"{limit_type}:{user_id}"
    return await rate_limiter.is_allowed(key, config["max_requests"], config["window_seconds"])

# ============================================================
# APP LIFECYCLE & BACKGROUND TASKS
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown tasks"""
    # Startup
    logger.info("🚀 Starting ZION.CITY API server...")
    
    # Create database indexes on startup (idempotent)
    asyncio.create_task(ensure_indexes())
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down ZION.CITY API server...")
    cleanup_task.cancel()
    client.close()

async def ensure_indexes():
    """Ensure all database indexes exist (runs on startup)"""
    try:
        # Key indexes for performance
        await db.users.create_index("id", unique=True, background=True)
        await db.users.create_index("email", unique=True, background=True)
        await db.posts.create_index([("created_at", -1)], background=True)
        await db.posts.create_index([("user_id", 1), ("created_at", -1)], background=True)
        await db.notifications.create_index([("user_id", 1), ("is_read", 1), ("created_at", -1)], background=True)
        await db.agent_conversations.create_index([("user_id", 1), ("updated_at", -1)], background=True)
        logger.info("✅ Database indexes verified")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

async def periodic_cleanup():
    """Background task for periodic cleanup"""
    while True:
        try:
            await asyncio.sleep(300)  # Run every 5 minutes
            await cache.clear_expired()
            await rate_limiter.cleanup()
            logger.debug("🧹 Periodic cleanup completed")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cleanup error: {e}")

# Create the main app with lifespan manager
app = FastAPI(
    title="ZION.CITY API", 
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not IS_PRODUCTION else None,  # Disable docs in production
    redoc_url="/api/redoc" if not IS_PRODUCTION else None
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'fallback-secret-key-for-development')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 if IS_PRODUCTION else 30  # Longer sessions in production

# === WEBSOCKET CONNECTION MANAGER ===
class ChatConnectionManager:
    """Manages WebSocket connections for real-time chat features"""
    
    def __init__(self):
        # Dictionary mapping chat_id to set of websocket connections
        self.chat_connections: Dict[str, Set[WebSocket]] = {}
        # Dictionary mapping user_id to websocket connection
        self.user_connections: Dict[str, WebSocket] = {}
        # Lock for thread safety
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str, chat_id: str = None):
        """Connect a user to WebSocket"""
        await websocket.accept()
        async with self._lock:
            # Store user connection
            self.user_connections[user_id] = websocket
            
            # If chat_id provided, add to chat room
            if chat_id:
                if chat_id not in self.chat_connections:
                    self.chat_connections[chat_id] = set()
                self.chat_connections[chat_id].add(websocket)
        
        logger.info(f"WebSocket connected: user={user_id}, chat={chat_id}")
    
    async def disconnect(self, websocket: WebSocket, user_id: str, chat_id: str = None):
        """Disconnect a user from WebSocket"""
        async with self._lock:
            # Remove from user connections
            if user_id in self.user_connections:
                del self.user_connections[user_id]
            
            # Remove from chat connections
            if chat_id and chat_id in self.chat_connections:
                self.chat_connections[chat_id].discard(websocket)
                if not self.chat_connections[chat_id]:
                    del self.chat_connections[chat_id]
        
        logger.info(f"WebSocket disconnected: user={user_id}")
    
    async def join_chat(self, websocket: WebSocket, chat_id: str):
        """Join a specific chat room"""
        async with self._lock:
            if chat_id not in self.chat_connections:
                self.chat_connections[chat_id] = set()
            self.chat_connections[chat_id].add(websocket)
    
    async def leave_chat(self, websocket: WebSocket, chat_id: str):
        """Leave a specific chat room"""
        async with self._lock:
            if chat_id in self.chat_connections:
                self.chat_connections[chat_id].discard(websocket)
    
    async def broadcast_to_chat(self, chat_id: str, message: dict, exclude_user: str = None):
        """Broadcast a message to all users in a chat"""
        if chat_id not in self.chat_connections:
            return
        
        disconnected = []
        for websocket in self.chat_connections[chat_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to chat {chat_id}: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected sockets
        async with self._lock:
            for ws in disconnected:
                self.chat_connections[chat_id].discard(ws)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to a specific user"""
        if user_id not in self.user_connections:
            return False
        
        try:
            await self.user_connections[user_id].send_json(message)
            return True
        except Exception as e:
            logger.error(f"Error sending to user {user_id}: {e}")
            async with self._lock:
                if user_id in self.user_connections:
                    del self.user_connections[user_id]
            return False
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if a user has an active WebSocket connection"""
        return user_id in self.user_connections
    
    def get_online_users_in_chat(self, chat_id: str) -> int:
        """Get number of online users in a chat"""
        if chat_id not in self.chat_connections:
            return 0
        return len(self.chat_connections[chat_id])

# Initialize the connection manager
chat_manager = ChatConnectionManager()

# Helper function to broadcast new message via WebSocket (defined early for use in API routes)
async def broadcast_new_message(chat_id: str, message_data: dict, sender_id: str):
    """Broadcast a new message to all users in a chat via WebSocket"""
    await chat_manager.broadcast_to_chat(chat_id, {
        "type": "message",
        "message": message_data,
        "chat_id": chat_id
    })
    
    # Also mark as delivered for all connected users
    connected_count = chat_manager.get_online_users_in_chat(chat_id)
    if connected_count > 1:  # More than just sender
        # Update message status to delivered
        await db.direct_chat_messages.update_one(
            {"id": message_data.get("id")},
            {"$set": {"status": "delivered"}}
        )

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
    youtube_video_id: Optional[str] = None  # Single YouTube video ID
    link_url: Optional[str] = None  # Link preview URL
    link_domain: Optional[str] = None  # Link preview domain
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
    group_id: Optional[str] = None  # For group chats
    direct_chat_id: Optional[str] = None  # For direct messages
    user_id: str
    content: str
    message_type: str = "TEXT"  # "TEXT", "IMAGE", "FILE", "SYSTEM"
    reply_to: Optional[str] = None  # ID of message being replied to
    status: str = "sent"  # "sent", "delivered", "read"
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    is_deleted: bool = False

# Direct Message (1:1 Chat) Models
class DirectChat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    participant_ids: List[str]  # Always 2 user IDs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class TypingStatus(BaseModel):
    chat_id: str  # Can be group_id or direct_chat_id
    chat_type: str  # "group" or "direct"
    user_id: str
    is_typing: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    type: str  # "like", "comment", "mention", "reaction", "eric_recommendation", "eric_analysis"
    title: str
    message: str
    related_post_id: Optional[str] = None
    related_comment_id: Optional[str] = None
    related_data: Optional[Dict[str, Any]] = None  # For ERIC: business info, search query, etc.
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
    last_seen: Optional[datetime] = None  # For online status tracking
    is_online: bool = False  # Real-time online status
    
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
    
    # DYNAMIC PROFILE FIELDS
    bio: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_address: Optional[str] = None
    work_anniversary: Optional[datetime] = None  # When user started at current company
    personal_interests: List[str] = []
    education: Optional[str] = None

# === DYNAMIC PROFILE PRIVACY SETTINGS ===

class ProfileFieldVisibility(str, Enum):
    PUBLIC = "PUBLIC"  # Everyone can see
    ORGANIZATION_ONLY = "ORGANIZATION_ONLY"  # Only org members can see
    PRIVATE = "PRIVATE"  # Only me

class ProfilePrivacySettings(BaseModel):
    """User's privacy settings for their dynamic profile - 13 total controls"""
    # Family Context Settings (What family members see) - 4 settings
    family_show_address: bool = True  # Show home address (street, city, state, country)
    family_show_phone: bool = True  # Show personal phone number
    family_show_birthdate: bool = True  # Show date of birth and upcoming birthday countdown
    family_show_spouse_info: bool = True  # Show marriage status and spouse details
    
    # Work Context Settings (What organization members see) - 5 settings
    work_show_department: bool = True  # Show department in organization
    work_show_team: bool = True  # Show team within department
    work_show_manager: bool = True  # Show direct manager/supervisor name
    work_show_work_anniversary: bool = True  # Show start date and years of service
    work_show_job_title: bool = True  # Show job title/position
    
    # Public Context Settings (What everyone sees) - 4 settings
    public_show_email: bool = False  # Show email address (default: hidden)
    public_show_phone: bool = False  # Show phone number (default: hidden)
    public_show_location: bool = True  # Show city and country (default: visible)
    public_show_bio: bool = True  # Show bio/about me section (default: visible)

class ProfileUpdateRequest(BaseModel):
    """Request to update user profile"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_address: Optional[str] = None
    personal_interests: Optional[List[str]] = None
    education: Optional[str] = None

class ProfilePrivacyUpdateRequest(BaseModel):
    """Request to update profile privacy settings - 13 toggle controls"""
    # Family Context Settings
    family_show_address: Optional[bool] = None
    family_show_phone: Optional[bool] = None
    family_show_birthdate: Optional[bool] = None
    family_show_spouse_info: Optional[bool] = None
    
    # Work Context Settings
    work_show_department: Optional[bool] = None
    work_show_team: Optional[bool] = None
    work_show_manager: Optional[bool] = None
    work_show_work_anniversary: Optional[bool] = None
    work_show_job_title: Optional[bool] = None
    
    # Public Context Settings
    public_show_email: Optional[bool] = None
    public_show_phone: Optional[bool] = None
    public_show_location: Optional[bool] = None
    public_show_bio: Optional[bool] = None

class DynamicProfileResponse(BaseModel):
    """Response for dynamic profile view"""
    # Basic Info (always visible to some extent)
    id: str
    first_name: str
    last_name: str
    avatar_url: Optional[str]
    bio: Optional[str]
    
    # Contact Info (visibility-controlled)
    email: Optional[str]
    phone: Optional[str]
    business_phone: Optional[str]
    business_email: Optional[str]
    business_address: Optional[str]
    
    # Personal Info (visibility-controlled)
    date_of_birth: Optional[datetime]
    address_city: Optional[str]
    address_state: Optional[str]
    address_country: Optional[str]
    personal_interests: List[str] = []
    education: Optional[str]
    
    # Family Module Info (visibility-controlled)
    family_info: Optional[Dict[str, Any]] = None
    upcoming_family_birthday: Optional[Dict[str, Any]] = None
    
    # Organization Module Info (visibility-controlled)
    organizations: List[Dict[str, Any]] = []
    
    # Viewer context
    viewer_relationship: str  # "self", "org_member", "public"
    is_own_profile: bool

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

# === RUSSIAN SCHOOL SYSTEM CONSTANTS ===

class SchoolLevel(str, Enum):
    PRIMARY = "PRIMARY"  # Начальная школа (1-4 классы)
    BASIC = "BASIC"  # Основная школа (5-9 классы)
    SECONDARY = "SECONDARY"  # Средняя школа (10-11 классы)
    VOCATIONAL = "VOCATIONAL"  # Техникум/Колледж

# Russian School Structure
RUSSIAN_SCHOOL_STRUCTURE = {
    "PRIMARY": {
        "name": "Начальная школа",
        "name_en": "Primary School",
        "grades": [1, 2, 3, 4],
        "description": "Один основной учитель, базовая грамотность и математика"
    },
    "BASIC": {
        "name": "Основная школа",
        "name_en": "Basic General Education",
        "grades": [5, 6, 7, 8, 9],
        "description": "Разные учителя по предметам, завершается ОГЭ",
        "exam": "ОГЭ (Основной государственный экзамен)"
    },
    "SECONDARY": {
        "name": "Средняя школа",
        "name_en": "Secondary (Complete) General Education",
        "grades": [10, 11],
        "description": "Специализация, подготовка к ЕГЭ и поступлению в вуз",
        "exam": "ЕГЭ (Единый государственный экзамен)"
    }
}

# Russian School Subjects (Предметы)
RUSSIAN_SCHOOL_SUBJECTS = [
    # Core subjects
    "Математика",
    "Русский язык",
    "Литература",
    "Английский язык",
    "Немецкий язык",
    "Французский язык",
    
    # Sciences
    "Физика",
    "Химия",
    "Биология",
    "География",
    "Астрономия",
    
    # Humanities
    "История",
    "Обществознание",
    "Право",
    "Экономика",
    
    # Arts & Physical Education
    "Физкультура",
    "Музыка",
    "ИЗО (Изобразительное искусство)",
    "Технология",
    "МХК (Мировая художественная культура)",
    
    # Other
    "Информатика",
    "ОБЖ (Основы безопасности жизнедеятельности)",
    "Родной язык",
    "Родная литература"
]

# Grade levels (классы)
RUSSIAN_GRADES = list(range(1, 12))  # 1-11

# Class naming conventions (буквы классов)
CLASS_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"]

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
    
    # === SCHOOL-SPECIFIC FIELDS ===
    school_levels: List[SchoolLevel] = []  # Which levels: PRIMARY, BASIC, SECONDARY
    grades_offered: List[int] = []  # Grade numbers: 1-11
    school_type: Optional[str] = None  # "Гимназия", "Лицей", "СОШ", etc.
    principal_name: Optional[str] = None  # Директор школы
    
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
    
    # === TEACHER-SPECIFIC FIELDS (for EDUCATIONAL organizations) ===
    is_teacher: bool = False
    teaching_subjects: List[str] = []  # List of subjects from RUSSIAN_SCHOOL_SUBJECTS
    teaching_grades: List[int] = []  # Grade levels (1-11)
    is_class_supervisor: bool = False  # Классный руководитель
    supervised_class: Optional[str] = None  # e.g., "5А", "7Б"
    teacher_qualification: Optional[str] = None  # e.g., "Высшая категория"
    
    # Status
    status: str = "ACTIVE"  # ACTIVE, INACTIVE, LEFT
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

    class Config:
        populate_by_name = True

class WorkPostType(str, Enum):
    REGULAR = "REGULAR"
    TASK_COMPLETION = "TASK_COMPLETION"
    TASK_DISCUSSION = "TASK_DISCUSSION"

class WorkPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    posted_by_user_id: str
    
    # Content
    title: Optional[str] = None
    content: str
    
    # Post Type & Task Metadata
    post_type: WorkPostType = WorkPostType.REGULAR
    task_metadata: Optional[Dict[str, Any]] = None  # {task_id, task_title, completion_photos, etc.}
    
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
    family_surname: Optional[str] = None
    description: Optional[str] = None
    public_bio: Optional[str] = None
    primary_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    established_date: Optional[datetime] = None
    family_photo_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_private: bool = False
    allow_public_discovery: bool = True
    member_count: int = 0
    children_count: int = 0
    creator_id: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    
    # Additional fields for response
    is_user_member: Optional[bool] = False
    user_role: Optional[FamilyRole] = None
    subscription_status: Optional[str] = None  # For external families

class FamilyMemberResponse(BaseModel):
    id: str
    user_id: str
    family_role: FamilyRole = FamilyRole.ADULT_MEMBER
    relationship_to_family: Optional[str] = None
    is_primary_resident: bool = True
    invitation_accepted: bool = True
    joined_at: Optional[datetime] = None
    
    # User details
    user_first_name: str = ""
    user_last_name: str = ""
    user_avatar_url: Optional[str] = None

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
    
    # === SCHOOL-SPECIFIC FIELDS ===
    school_levels: Optional[List[SchoolLevel]] = None
    grades_offered: Optional[List[int]] = None
    school_type: Optional[str] = None
    principal_name: Optional[str] = None
    
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
    
    # Teacher-specific fields
    is_teacher: Optional[bool] = False
    teaching_subjects: Optional[List[str]] = []
    teaching_grades: Optional[List[int]] = []
    is_class_supervisor: Optional[bool] = False
    supervised_class: Optional[str] = None
    teacher_qualification: Optional[str] = None

# === TEACHER-SPECIFIC MODELS ===

class TeacherProfileUpdate(BaseModel):
    """Update teacher-specific fields"""
    is_teacher: Optional[bool] = None
    teaching_subjects: Optional[List[str]] = None
    teaching_grades: Optional[List[int]] = None
    is_class_supervisor: Optional[bool] = None
    supervised_class: Optional[str] = None
    teacher_qualification: Optional[str] = None
    job_title: Optional[str] = None  # Can also update job title

class TeacherResponse(BaseModel):
    """Response for teacher information"""
    id: str
    user_id: str
    user_first_name: str
    user_last_name: str
    user_email: str
    user_avatar_url: Optional[str]
    job_title: Optional[str]
    teaching_subjects: List[str]
    teaching_grades: List[int]
    is_class_supervisor: bool
    supervised_class: Optional[str]
    teacher_qualification: Optional[str]
    department: Optional[str]
    start_date: Optional[datetime]

# === SCHOOL CLASS MODELS ===

class SchoolClass(BaseModel):
    """School class (e.g., 5-А, 6-Б)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    name: str  # e.g., "5-А", "6-Б"
    grade: int  # 1-11
    class_teacher_id: Optional[str] = None  # Teacher user_id who is class supervisor
    class_teacher_name: Optional[str] = None
    academic_year: Optional[str] = None  # e.g., "2024-2025"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SchoolClassResponse(BaseModel):
    """Response for school class with enriched data"""
    id: str
    name: str
    grade: int
    students_count: int = 0
    class_teacher: Optional[str] = None  # Teacher name
    class_teacher_id: Optional[str] = None
    subjects: List[str] = []  # Subjects taught to this class
    schedule_count: int = 0  # Number of lessons per week
    is_class_teacher: bool = False  # Whether current user is class teacher
    academic_year: Optional[str] = None

# === STUDENT-SPECIFIC MODELS ===

class AcademicStatus(str, Enum):
    ACTIVE = "ACTIVE"
    GRADUATED = "GRADUATED"
    TRANSFERRED = "TRANSFERRED"
    EXPELLED = "EXPELLED"

class WorkStudent(BaseModel):
    """Student profile in educational organization"""
    student_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    user_id: Optional[str] = None  # Student may not have user account initially
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str] = None
    date_of_birth: date
    grade: int  # 1-11
    assigned_class: Optional[str] = None  # Format: 5А, 7Б
    enrolled_subjects: List[str] = []
    parent_ids: List[str] = []  # User IDs of parents
    academic_status: AcademicStatus = AcademicStatus.ACTIVE
    enrollment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    student_number: Optional[str] = None  # Unique identifier within school
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class StudentCreate(BaseModel):
    """Create new student"""
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str] = None
    date_of_birth: date
    grade: int
    assigned_class: Optional[str] = None
    enrolled_subjects: Optional[List[str]] = []
    parent_ids: Optional[List[str]] = []
    student_number: Optional[str] = None
    notes: Optional[str] = None

class StudentUpdate(BaseModel):
    """Update student profile"""
    student_first_name: Optional[str] = None
    student_last_name: Optional[str] = None
    student_middle_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    grade: Optional[int] = None
    assigned_class: Optional[str] = None
    enrolled_subjects: Optional[List[str]] = None
    academic_status: Optional[AcademicStatus] = None
    student_number: Optional[str] = None
    notes: Optional[str] = None

class StudentResponse(BaseModel):
    """Response for student information"""
    student_id: str
    organization_id: Optional[str]  # Can be None for children not yet enrolled
    user_id: Optional[str]
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str]
    date_of_birth: date
    grade: Optional[int]  # Can be None for children without grade
    assigned_class: Optional[str]
    enrolled_subjects: List[str]
    parent_ids: List[str]
    parent_names: List[str] = []  # Enriched parent names
    academic_status: str
    enrollment_date: Optional[datetime]  # Can be None for children not yet enrolled
    student_number: Optional[str]
    notes: Optional[str]
    age: Optional[int] = None  # Calculated from date_of_birth
    # Additional fields for UI compatibility
    id: Optional[str] = None  # Alias for student_id
    first_name: Optional[str] = None  # Alias for student_first_name
    last_name: Optional[str] = None  # Alias for student_last_name
    class_name: Optional[str] = None  # Alias for assigned_class
    class_id: Optional[str] = None  # Derived from assigned_class
    average_grade: Optional[float] = None  # Academic average (placeholder)
    attendance_rate: Optional[int] = None  # Attendance percentage (placeholder)
    parent_name: Optional[str] = None  # Primary parent name

class StudentParentLinkRequest(BaseModel):
    """Link parent to student"""
    parent_user_id: str

class EnrollmentRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class StudentEnrollmentRequest(BaseModel):
    """Parent enrollment request for student"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    parent_user_id: str
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str] = None
    student_dob: date
    requested_grade: int
    requested_class: Optional[str] = None
    parent_message: Optional[str] = None
    status: EnrollmentRequestStatus = EnrollmentRequestStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnrollmentRequestCreate(BaseModel):
    """Create enrollment request"""
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str] = None
    student_dob: date
    requested_grade: int
    requested_class: Optional[str] = None
    parent_message: Optional[str] = None

class EnrollmentRequestResponse(BaseModel):
    """Response for enrollment request"""
    request_id: str
    organization_id: str
    organization_name: str
    parent_user_id: str
    parent_name: str
    parent_email: str
    student_first_name: str
    student_last_name: str
    student_middle_name: Optional[str]
    student_dob: date
    requested_grade: int
    requested_class: Optional[str]
    parent_message: Optional[str]
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

# === CLASS SCHEDULE MODELS ===

class DayOfWeek(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"

class ClassSchedule(BaseModel):
    """Class schedule entry for a specific lesson"""
    schedule_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    grade: int  # 1-11
    assigned_class: str  # Format: 5А, 7Б
    day_of_week: DayOfWeek
    lesson_number: int  # 1-7 (typical Russian school day)
    subject: str  # e.g., Математика, Русский язык
    teacher_id: str  # User ID of the teacher
    classroom: Optional[str] = None  # e.g., "Кабинет 205"
    time_start: Optional[str] = None  # e.g., "08:00"
    time_end: Optional[str] = None  # e.g., "08:45"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class ScheduleCreate(BaseModel):
    """Create new schedule entry"""
    grade: int
    assigned_class: str
    day_of_week: DayOfWeek
    lesson_number: int
    subject: str
    teacher_id: str
    classroom: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None

class ScheduleUpdate(BaseModel):
    """Update schedule entry"""
    subject: Optional[str] = None
    teacher_id: Optional[str] = None
    classroom: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None

class ScheduleResponse(BaseModel):
    """Response for schedule information"""
    schedule_id: str
    organization_id: str
    grade: int
    assigned_class: str
    day_of_week: str
    lesson_number: int
    subject: str
    teacher_id: str
    teacher_name: Optional[str] = None  # Enriched teacher name
    classroom: Optional[str]
    time_start: Optional[str]
    time_end: Optional[str]

# === GRADE/GRADEBOOK MODELS ===

class GradeType(str, Enum):
    EXAM = "EXAM"  # Контрольная работа
    QUIZ = "QUIZ"  # Самостоятельная работа
    HOMEWORK = "HOMEWORK"  # Домашняя работа
    CLASSWORK = "CLASSWORK"  # Работа на уроке
    TEST = "TEST"  # Тест
    ORAL = "ORAL"  # Устный ответ
    PROJECT = "PROJECT"  # Проект

class AcademicPeriod(str, Enum):
    QUARTER_1 = "QUARTER_1"  # 1 четверть
    QUARTER_2 = "QUARTER_2"  # 2 четверть
    QUARTER_3 = "QUARTER_3"  # 3 четверть
    QUARTER_4 = "QUARTER_4"  # 4 четверть
    SEMESTER_1 = "SEMESTER_1"  # 1 полугодие
    SEMESTER_2 = "SEMESTER_2"  # 2 полугодие
    YEAR = "YEAR"  # Годовая

class Grade(BaseModel):
    """Student grade entry"""
    grade_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    student_id: str
    subject: str
    teacher_id: str
    grade_value: int  # 1-5 (Russian grading system: 5=excellent, 4=good, 3=satisfactory, 2=unsatisfactory, 1=very poor)
    grade_type: GradeType
    academic_period: AcademicPeriod
    date: str  # ISO date format
    comment: Optional[str] = None
    weight: int = 1  # Weight for calculating average (e.g., exams might have weight 2)
    is_final: bool = False  # Quarter/semester/year final grade
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GradeCreate(BaseModel):
    """Create new grade entry"""
    student_id: str
    subject: str
    grade_value: int
    grade_type: GradeType
    academic_period: AcademicPeriod
    date: str
    comment: Optional[str] = None
    weight: int = 1
    is_final: bool = False

class GradeUpdate(BaseModel):
    """Update grade entry"""
    grade_value: Optional[int] = None
    grade_type: Optional[GradeType] = None
    comment: Optional[str] = None
    weight: Optional[int] = None

class GradeResponse(BaseModel):
    """Response for grade information"""
    grade_id: str
    organization_id: str
    student_id: str
    student_name: Optional[str] = None  # Enriched student name
    subject: str
    teacher_id: str
    teacher_name: Optional[str] = None  # Enriched teacher name
    grade_value: int
    grade_type: str
    academic_period: str
    date: str
    comment: Optional[str]
    weight: int
    is_final: bool

class StudentGradesSummary(BaseModel):
    """Summary of student's grades by subject"""
    student_id: str
    student_name: str
    subject: str
    grades: List[GradeResponse]
    average: Optional[float] = None
    grade_count: int

# === JOURNAL POST MODELS (МОЯ ЛЕНТА) ===

class JournalAudienceType(str, Enum):
    PUBLIC = "PUBLIC"  # Everyone subscribed to organization
    TEACHERS = "TEACHERS"  # Teachers only
    PARENTS = "PARENTS"  # Parents only
    STUDENTS_PARENTS = "STUDENTS_PARENTS"  # Students and their parents
    ADMINS = "ADMINS"  # Admins only

class JournalPostCreate(BaseModel):
    """Create journal post"""
    title: Optional[str] = None
    content: str
    audience_type: JournalAudienceType = JournalAudienceType.PUBLIC
    media_file_ids: List[str] = []
    is_pinned: bool = False

class JournalPost(BaseModel):
    """Journal post in educational organization"""
    post_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    posted_by_user_id: str
    posted_by_role: str  # "teacher", "parent", "admin"
    
    # Content
    title: Optional[str] = None
    content: str
    
    # Audience Control
    audience_type: JournalAudienceType
    
    # Media
    media_files: List[str] = []
    
    # Engagement
    likes_count: int = 0
    comments_count: int = 0
    
    # Metadata
    is_published: bool = True
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class JournalPostResponse(BaseModel):
    """Response for journal post"""
    post_id: str
    organization_id: str
    organization_name: Optional[str] = None
    posted_by_user_id: str
    posted_by_role: str
    author: Dict[str, Any]  # Author details
    
    title: Optional[str]
    content: str
    audience_type: str
    
    media_files: List[str]
    likes_count: int
    comments_count: int
    
    is_published: bool
    is_pinned: bool
    created_at: datetime

# === ACADEMIC CALENDAR MODELS ===

class AcademicEventType(str, Enum):
    HOLIDAY = "HOLIDAY"  # School holidays
    EXAM = "EXAM"  # Exams
    MEETING = "MEETING"  # Parent-teacher meetings
    EVENT = "EVENT"  # School events
    DEADLINE = "DEADLINE"  # Assignment deadlines
    VACATION = "VACATION"  # Vacation periods
    CONFERENCE = "CONFERENCE"  # Conferences
    COMPETITION = "COMPETITION"  # Competitions
    BIRTHDAY = "BIRTHDAY"  # Birthday party (for kids)
    EXCURSION = "EXCURSION"  # Field trips

class EventCreatorRole(str, Enum):
    """Role of event creator - determines color coding"""
    ADMIN = "ADMIN"  # School administration - Red
    TEACHER = "TEACHER"  # Teachers - Blue
    PARENT = "PARENT"  # Parents - Green
    STUDENT = "STUDENT"  # Kids/Students - Yellow

class RSVPStatus(str, Enum):
    """RSVP response status"""
    YES = "YES"
    NO = "NO"
    MAYBE = "MAYBE"

class RSVPResponse(BaseModel):
    """Single RSVP response"""
    user_id: str
    user_name: str
    status: RSVPStatus
    dietary_restrictions: Optional[str] = None  # Food allergies/restrictions
    responded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BirthdayPartyTheme(str, Enum):
    """Birthday party theme options"""
    PINK = "PINK"  # Girl party theme
    BLUE = "BLUE"  # Boy party theme

class BirthdayPartyData(BaseModel):
    """Birthday party specific data"""
    theme: BirthdayPartyTheme = BirthdayPartyTheme.PINK
    custom_message: Optional[str] = None  # Personal invitation message
    wish_list: List[str] = []  # List of birthday wishes (placeholder for marketplace)
    birthday_child_name: Optional[str] = None  # Name of birthday child
    birthday_child_age: Optional[int] = None  # Age they're turning

class WishItem(BaseModel):
    """Individual wish item with claim tracking"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    claimed_by_user_id: Optional[str] = None
    claimed_by_name: Optional[str] = None
    claimed_at: Optional[str] = None

class WishListUpdate(BaseModel):
    """Request model for updating wish list"""
    wishes: List[str]  # List of wish titles

class WishClaimRequest(BaseModel):
    """Request model for claiming a wish"""
    wish_index: int  # Index of the wish to claim

# Color mapping for creator roles
EVENT_ROLE_COLORS = {
    "ADMIN": "#DC2626",    # Red - School Administration
    "TEACHER": "#2563EB",  # Blue - Teachers
    "PARENT": "#16A34A",   # Green - Parents
    "STUDENT": "#EAB308"   # Yellow - Kids/Students
}

class AcademicEventCreate(BaseModel):
    """Create academic calendar event"""
    title: str
    description: Optional[str] = None
    event_type: AcademicEventType
    start_date: str  # ISO date string
    end_date: Optional[str] = None  # ISO date string for multi-day events
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None  # HH:MM format
    location: Optional[str] = None
    is_all_day: bool = True
    audience_type: str = "PUBLIC"  # PUBLIC, TEACHERS, PARENTS, STUDENTS_PARENTS
    grade_filter: Optional[str] = None  # Filter by grade if applicable
    color: Optional[str] = None  # Custom color for the event
    requires_rsvp: bool = False  # Whether event requires RSVP
    max_attendees: Optional[int] = None  # Maximum attendees for birthday parties, etc.
    invitees: Optional[List[str]] = None  # List of invited user IDs (for private events)
    # Birthday party specific fields
    birthday_party_data: Optional[Dict[str, Any]] = None  # Theme, custom_message, wish_list, etc.

class AcademicEvent(BaseModel):
    """Academic calendar event"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by_user_id: str
    creator_role: str = "PARENT"  # ADMIN, TEACHER, PARENT, STUDENT
    
    # Event details
    title: str
    description: Optional[str] = None
    event_type: AcademicEventType
    
    # Timing
    start_date: str
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: bool = True
    
    # Location
    location: Optional[str] = None
    
    # Audience
    audience_type: str = "PUBLIC"
    grade_filter: Optional[str] = None
    invitees: List[str] = []  # List of invited user IDs
    
    # Display
    color: Optional[str] = None
    
    # RSVP
    requires_rsvp: bool = False
    max_attendees: Optional[int] = None
    rsvp_responses: List[Dict[str, Any]] = []  # List of RSVPResponse dicts
    
    # Birthday party specific data
    birthday_party_data: Optional[Dict[str, Any]] = None  # Theme, custom_message, wish_list, etc.
    
    # Metadata
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AcademicEventResponse(BaseModel):
    """Academic event response with creator info"""
    id: str
    organization_id: str
    organization_name: Optional[str] = None
    
    title: str
    description: Optional[str]
    event_type: str
    creator_role: str = "PARENT"
    role_color: Optional[str] = None  # Color based on creator role
    
    start_date: str
    end_date: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    is_all_day: bool
    
    location: Optional[str]
    audience_type: str
    grade_filter: Optional[str]
    color: Optional[str]
    invitees: List[str] = []
    
    # RSVP fields
    requires_rsvp: bool = False
    max_attendees: Optional[int] = None
    rsvp_responses: List[Dict[str, Any]] = []
    rsvp_summary: Optional[Dict[str, int]] = None  # {"YES": 5, "NO": 2, "MAYBE": 3}
    user_rsvp: Optional[str] = None  # Current user's RSVP status
    
    # Birthday party specific data
    birthday_party_data: Optional[Dict[str, Any]] = None
    
    is_active: bool
    created_at: datetime
    
    # Creator info
    created_by: Optional[Dict[str, Any]] = None

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
    
    # Post Type & Task Metadata
    post_type: str = "REGULAR"
    task_metadata: Optional[Dict[str, Any]] = None
    
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
    EVENT_CREATED = "EVENT_CREATED"
    EVENT_UPDATED = "EVENT_UPDATED"
    EVENT_CANCELLED = "EVENT_CANCELLED"

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

# === WORK ORGANIZATION EVENT MODELS ===

class WorkEventType(str, Enum):
    MEETING = "MEETING"
    TRAINING = "TRAINING"
    DEADLINE = "DEADLINE"
    COMPANY_EVENT = "COMPANY_EVENT"
    TEAM_BUILDING = "TEAM_BUILDING"
    REVIEW = "REVIEW"
    ANNOUNCEMENT = "ANNOUNCEMENT"
    OTHER = "OTHER"

class WorkEventVisibility(str, Enum):
    ALL_MEMBERS = "ALL_MEMBERS"
    DEPARTMENT = "DEPARTMENT"
    TEAM = "TEAM"
    ADMINS_ONLY = "ADMINS_ONLY"

class WorkEventRSVPStatus(str, Enum):
    GOING = "GOING"
    MAYBE = "MAYBE"
    NOT_GOING = "NOT_GOING"

class WorkEventReminderInterval(str, Enum):
    FIFTEEN_MINUTES = "15_MINUTES"  # 15 минут до события
    ONE_HOUR = "1_HOUR"  # 1 час до события
    ONE_DAY = "1_DAY"  # 1 день до события

class WorkOrganizationEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by_user_id: str
    title: str
    description: Optional[str] = None
    event_type: WorkEventType = WorkEventType.OTHER
    scheduled_date: datetime  # Event date
    scheduled_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None  # HH:MM format
    location: Optional[str] = None
    department_id: Optional[str] = None  # For department-specific events
    team_id: Optional[str] = None  # For team-specific events
    visibility: WorkEventVisibility = WorkEventVisibility.ALL_MEMBERS
    rsvp_enabled: bool = False
    rsvp_responses: Dict[str, str] = {}  # {user_id: "GOING"/"MAYBE"/"NOT_GOING"}
    color_code: str = "#ea580c"  # Work module orange
    is_cancelled: bool = False
    cancelled_reason: Optional[str] = None
    # Reminder settings
    reminder_intervals: List[WorkEventReminderInterval] = []  # Selected reminder times
    reminders_sent: Dict[str, List[str]] = {}  # {interval: [user_ids who received]}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class WorkOrganizationEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: WorkEventType = WorkEventType.OTHER
    scheduled_date: str  # ISO format date string
    scheduled_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    visibility: WorkEventVisibility = WorkEventVisibility.ALL_MEMBERS
    rsvp_enabled: bool = False
    reminder_intervals: List[WorkEventReminderInterval] = []  # Reminder options

class WorkOrganizationEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[WorkEventType] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    department_id: Optional[str] = None
    team_id: Optional[str] = None
    visibility: Optional[WorkEventVisibility] = None
    rsvp_enabled: Optional[bool] = None
    is_cancelled: Optional[bool] = None
    cancelled_reason: Optional[str] = None

class WorkEventRSVP(BaseModel):
    response: WorkEventRSVPStatus

class WorkOrganizationEventResponse(BaseModel):
    id: str
    organization_id: str
    created_by_user_id: str
    created_by_name: str  # Creator's full name
    title: str
    description: Optional[str]
    event_type: WorkEventType
    scheduled_date: datetime
    scheduled_time: Optional[str]
    end_time: Optional[str]
    location: Optional[str]
    department_id: Optional[str]
    department_name: Optional[str]
    team_id: Optional[str]
    team_name: Optional[str]
    visibility: WorkEventVisibility
    rsvp_enabled: bool
    rsvp_responses: Dict[str, str]
    rsvp_summary: Dict[str, int]  # {"GOING": 5, "MAYBE": 2, "NOT_GOING": 1}
    user_rsvp_status: Optional[str]  # Current user's RSVP status
    color_code: str
    is_cancelled: bool
    cancelled_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

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

# ===== WORK TASK MANAGEMENT MODELS =====

class TaskStatus(str, Enum):
    NEW = "NEW"  # Новая
    ACCEPTED = "ACCEPTED"  # Принято
    IN_PROGRESS = "IN_PROGRESS"  # В работе
    REVIEW = "REVIEW"  # На проверке
    DONE = "DONE"  # Готово
    CANCELLED = "CANCELLED"  # Отменено

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class TaskAssignmentType(str, Enum):
    PERSONAL = "PERSONAL"  # Personal task (self-assigned)
    USER = "USER"  # Assigned to specific user
    TEAM = "TEAM"  # Assigned to team (anyone can accept)
    DEPARTMENT = "DEPARTMENT"  # Assigned to department (anyone can accept)

class WorkTask(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str  # User ID who created the task
    
    # Task details
    title: str
    description: Optional[str] = None
    
    # Assignment
    assignment_type: TaskAssignmentType = TaskAssignmentType.PERSONAL
    assigned_to: Optional[str] = None  # Specific user ID
    team_id: Optional[str] = None
    department_id: Optional[str] = None
    accepted_by: Optional[str] = None  # Who claimed/accepted the task
    accepted_at: Optional[datetime] = None
    
    # Status & Priority
    status: TaskStatus = TaskStatus.NEW
    priority: TaskPriority = TaskPriority.MEDIUM
    
    # Deadline
    deadline: Optional[datetime] = None
    
    # Subtasks/Checklist
    subtasks: List[Dict[str, Any]] = []  # [{id, title, is_completed}]
    
    # Completion
    requires_photo_proof: bool = False
    completion_photos: List[str] = []  # Media IDs
    completion_note: Optional[str] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    
    # Discussion post link
    discussion_post_id: Optional[str] = None
    completion_post_id: Optional[str] = None
    
    # Template
    is_template: bool = False
    template_name: Optional[str] = None
    created_from_template_id: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_deleted: bool = False

class WorkTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignment_type: TaskAssignmentType = TaskAssignmentType.PERSONAL
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    department_id: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    deadline: Optional[str] = None  # ISO format datetime
    subtasks: List[str] = []  # List of subtask titles
    requires_photo_proof: bool = False
    # For creating from template
    template_id: Optional[str] = None
    # For saving as template
    save_as_template: bool = False
    template_name: Optional[str] = None

class WorkTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignment_type: Optional[TaskAssignmentType] = None
    assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    department_id: Optional[str] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[str] = None
    requires_photo_proof: Optional[bool] = None

class WorkTaskStatusUpdate(BaseModel):
    status: TaskStatus
    completion_note: Optional[str] = None
    completion_photo_ids: List[str] = []

class WorkTaskSubtaskUpdate(BaseModel):
    subtask_id: str
    is_completed: bool

class WorkTaskSubtaskAdd(BaseModel):
    title: str

class WorkTaskAccept(BaseModel):
    """Accept/claim a team or department task"""
    pass  # No additional data needed, just the action

class WorkTaskResponse(BaseModel):
    id: str
    organization_id: str
    created_by: str
    created_by_name: str
    created_by_avatar: Optional[str] = None
    
    title: str
    description: Optional[str]
    
    assignment_type: TaskAssignmentType
    assigned_to: Optional[str]
    assigned_to_name: Optional[str] = None
    assigned_to_avatar: Optional[str] = None
    team_id: Optional[str]
    team_name: Optional[str] = None
    department_id: Optional[str]
    department_name: Optional[str] = None
    accepted_by: Optional[str]
    accepted_by_name: Optional[str] = None
    accepted_at: Optional[datetime]
    
    status: TaskStatus
    priority: TaskPriority
    deadline: Optional[datetime]
    time_remaining: Optional[str] = None  # "2д 5ч" formatted
    is_overdue: bool = False
    
    subtasks: List[Dict[str, Any]]
    subtasks_completed: int = 0
    subtasks_total: int = 0
    
    requires_photo_proof: bool
    completion_photos: List[str]
    completion_note: Optional[str]
    completed_at: Optional[datetime]
    completed_by: Optional[str]
    completed_by_name: Optional[str] = None
    
    discussion_post_id: Optional[str]
    completion_post_id: Optional[str]
    
    is_template: bool
    template_name: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    
    # Permissions for current user
    can_edit: bool = False
    can_delete: bool = False
    can_accept: bool = False
    can_complete: bool = False

class WorkTaskTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    created_by: str
    name: str
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    subtasks: List[str] = []  # List of subtask titles
    requires_photo_proof: bool = False
    default_assignment_type: TaskAssignmentType = TaskAssignmentType.PERSONAL
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class WorkTaskTemplateCreate(BaseModel):
    name: str
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    subtasks: List[str] = []
    requires_photo_proof: bool = False
    default_assignment_type: TaskAssignmentType = TaskAssignmentType.PERSONAL

class WorkTaskTemplateResponse(BaseModel):
    id: str
    organization_id: str
    created_by: str
    created_by_name: str
    name: str
    title: str
    description: Optional[str]
    priority: TaskPriority
    subtasks: List[str]
    requires_photo_proof: bool
    default_assignment_type: TaskAssignmentType
    created_at: datetime

# ===== END WORK TASK MANAGEMENT MODELS =====

# ===== END DEPARTMENTS & ANNOUNCEMENTS MODELS =====

# ===== NEWS MODULE - SOCIAL NETWORK MODELS =====

class FriendRequestStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class FriendRequest(BaseModel):
    """Friend request between users"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str  # User who sent the request
    receiver_id: str  # User who receives the request
    status: FriendRequestStatus = FriendRequestStatus.PENDING
    message: Optional[str] = None  # Optional message with request
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None

class UserFriendship(BaseModel):
    """Mutual friendship between two users"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user1_id: str  # First user (alphabetically smaller ID)
    user2_id: str  # Second user (alphabetically larger ID)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Friendship source
    from_request_id: Optional[str] = None

class UserFollow(BaseModel):
    """One-way follow relationship (follower follows target)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    follower_id: str  # User who is following
    target_id: str  # User being followed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NewsChannelCategory(str, Enum):
    WORLD_NEWS = "WORLD_NEWS"
    POLITICS = "POLITICS"
    ECONOMY = "ECONOMY"
    TECHNOLOGY = "TECHNOLOGY"
    SCIENCE = "SCIENCE"
    SPORTS = "SPORTS"
    CULTURE = "CULTURE"
    ENTERTAINMENT = "ENTERTAINMENT"
    HEALTH = "HEALTH"
    EDUCATION = "EDUCATION"
    LOCAL_NEWS = "LOCAL_NEWS"
    AUTO = "AUTO"
    TRAVEL = "TRAVEL"
    FOOD = "FOOD"
    FASHION = "FASHION"

class NewsChannel(BaseModel):
    """User-created news channel"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str  # User who created the channel
    organization_id: Optional[str] = None  # If official channel, linked to org
    
    # Channel info
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    categories: List[NewsChannelCategory] = []
    
    # Verification
    is_verified: bool = False  # True if linked to organization
    is_official: bool = False  # Official news outlet
    
    # Stats (denormalized for performance)
    subscribers_count: int = 0
    posts_count: int = 0
    
    # Status
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChannelSubscription(BaseModel):
    """User subscription to a news channel"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    subscriber_id: str
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notifications_enabled: bool = True

class ChannelModerator(BaseModel):
    """Moderator assignment for a news channel"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    user_id: str  # The moderator user
    assigned_by: str  # Channel owner who assigned
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    can_post: bool = True  # Can create posts
    can_delete_posts: bool = True  # Can delete posts
    can_pin_posts: bool = True  # Can pin posts
    is_active: bool = True

# ===== NEWS EVENTS MODELS =====

class NewsEventType(str, Enum):
    """Types of events in the NEWS module"""
    PREMIERE = "PREMIERE"           # 🎬 Video/Movie premiere
    STREAM = "STREAM"               # 📺 Live stream
    BROADCAST = "BROADCAST"         # 🎤 Live broadcast/podcast
    ONLINE_EVENT = "ONLINE_EVENT"   # 🎪 Webinar, virtual meetup
    ANNOUNCEMENT = "ANNOUNCEMENT"   # 📢 General announcement
    AMA = "AMA"                     # ❓ Ask Me Anything / Q&A

class NewsEvent(BaseModel):
    """Event in the NEWS module - can be personal or channel-based"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Event details
    title: str
    description: Optional[str] = None
    event_type: NewsEventType = NewsEventType.ANNOUNCEMENT
    
    # Date and time
    event_date: datetime
    duration_minutes: Optional[int] = None  # Duration in minutes
    
    # Creator info
    creator_id: str
    channel_id: Optional[str] = None  # If created by a channel
    
    # Link (for streams, online events, etc.)
    event_link: Optional[str] = None
    
    # Cover image
    cover_url: Optional[str] = None
    
    # Tracking
    attendees: List[str] = []  # User IDs who will attend
    reminders: List[str] = []  # User IDs who want reminders
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class NewsEventCreate(BaseModel):
    """Model for creating a news event"""
    title: str
    description: Optional[str] = None
    event_type: NewsEventType = NewsEventType.ANNOUNCEMENT
    event_date: datetime
    duration_minutes: Optional[int] = None
    channel_id: Optional[str] = None
    event_link: Optional[str] = None
    cover_url: Optional[str] = None

class NewsEventResponse(BaseModel):
    """Response model for news events"""
    id: str
    title: str
    description: Optional[str]
    event_type: str
    event_date: datetime
    duration_minutes: Optional[int]
    creator_id: str
    channel_id: Optional[str]
    event_link: Optional[str]
    cover_url: Optional[str]
    attendees_count: int
    is_attending: bool
    has_reminder: bool
    creator: Optional[dict]
    channel: Optional[dict]
    created_at: datetime

class NewsPostVisibility(str, Enum):
    FRIENDS_ONLY = "FRIENDS_ONLY"
    FRIENDS_AND_FOLLOWERS = "FRIENDS_AND_FOLLOWERS"
    PUBLIC = "PUBLIC"

class NewsPost(BaseModel):
    """Post in the News module with social visibility settings"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Author
    channel_id: Optional[str] = None  # If posted to a channel
    
    # Content
    content: str
    media_files: List[str] = []  # MediaFile IDs
    youtube_urls: List[str] = []
    
    # Visibility
    visibility: NewsPostVisibility = NewsPostVisibility.PUBLIC
    
    # Engagement
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_pinned: bool = False
    is_active: bool = True

class NewsPostCreate(BaseModel):
    content: str
    channel_id: Optional[str] = None
    visibility: NewsPostVisibility = NewsPostVisibility.PUBLIC
    media_files: List[str] = []
    youtube_urls: List[str] = []

# ===== END NEWS MODULE MODELS =====

class ChatMessageCreate(BaseModel):
    group_id: Optional[str] = None
    direct_chat_id: Optional[str] = None
    content: str
    message_type: str = "TEXT"
    reply_to: Optional[str] = None

class DirectChatCreate(BaseModel):
    recipient_id: str  # User ID to start chat with

class MessageStatusUpdate(BaseModel):
    status: str  # "delivered" or "read"

class TypingStatusUpdate(BaseModel):
    is_typing: bool

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
    youtube_video_id: Optional[str] = None  # Single YouTube video ID
    link_url: Optional[str] = None  # Link preview URL
    link_domain: Optional[str] = None  # Link preview domain
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

class HouseholdBasicResponse(BaseModel):
    """Basic response model for household"""
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

def extract_youtube_id_from_url(url: str) -> Optional[str]:
    """Extract YouTube video ID from a URL"""
    youtube_patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([a-zA-Z0-9_-]+)',
        r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]+)',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]+)'
    ]
    
    for pattern in youtube_patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

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
            
            # Get unread count (messages not from this user that haven't been read)
            unread_count = await db.chat_messages.count_documents({
                "group_id": group["id"],
                "user_id": {"$ne": user_id},
                "status": {"$ne": "read"},
                "is_deleted": False
            })
            
            groups.append({
                "group": group,
                "user_role": membership["role"],
                "member_count": member_count,
                "latest_message": latest_message,
                "unread_count": unread_count,
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
        name_alias=user.name_alias,
        gender=user.gender,  # Include gender in login response
        profile_picture=user.profile_picture,
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

# === DYNAMIC PROFILE API ENDPOINTS ===

@api_router.get("/users/me/profile", response_model=DynamicProfileResponse)
async def get_my_dynamic_profile(current_user: User = Depends(get_current_user)):
    """Get current user's own dynamic profile (full access to all data)"""
    
    # Get user's privacy settings (if exists)
    privacy_doc = await db.profile_privacy_settings.find_one({"user_id": current_user.id})
    _privacy_settings = ProfilePrivacySettings(**privacy_doc) if privacy_doc else ProfilePrivacySettings()
    
    # Get family information
    family_info = None
    upcoming_birthday = None
    family_unit = await db.family_units.find_one({
        "member_ids": current_user.id,
        "is_active": True
    })
    
    if family_unit:
        # Get family members to find upcoming birthdays
        family_members = await db.family_unit_members.find({
            "family_unit_id": family_unit["id"],
            "is_active": True
        }).to_list(None)
        
        # Find upcoming birthday
        today = datetime.now(timezone.utc).date()
        upcoming_birthdays = []
        for member in family_members:
            user_doc = await db.users.find_one({"id": member["user_id"]})
            if user_doc and user_doc.get("date_of_birth"):
                birth_date = user_doc["date_of_birth"]
                if isinstance(birth_date, datetime):
                    birth_date = birth_date.date()
                # Calculate next birthday
                next_birthday = birth_date.replace(year=today.year)
                if next_birthday < today:
                    next_birthday = birth_date.replace(year=today.year + 1)
                days_until = (next_birthday - today).days
                if days_until <= 90:  # Next 90 days
                    upcoming_birthdays.append({
                        "name": f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}",
                        "date": next_birthday.isoformat(),
                        "days_until": days_until
                    })
        
        if upcoming_birthdays:
            upcoming_birthdays.sort(key=lambda x: x["days_until"])
            upcoming_birthday = upcoming_birthdays[0]
        
        family_info = {
            "family_name": family_unit.get("family_name", ""),
            "family_surname": family_unit.get("family_surname", ""),
            "member_count": family_unit.get("member_count", 0),
            "address_city": family_unit.get("address_city"),
            "address_country": family_unit.get("address_country")
        }
    
    # Get organization memberships
    organizations = []
    org_members = await db.work_members.find({
        "user_id": current_user.id,
        "status": "ACTIVE"
    }).to_list(None)
    
    for member in org_members:
        org = await db.work_organizations.find_one({"id": member["organization_id"]})
        if org:
            # Get department info
            dept_name = None
            if member.get("department_id"):
                dept = await db.work_departments.find_one({"id": member["department_id"]})
                if dept:
                    dept_name = dept.get("name")
            
            # Get team info
            team_name = None
            if member.get("team_id"):
                team = await db.work_teams.find_one({"id": member["team_id"]})
                if team:
                    team_name = team.get("name")
            
            # Get manager info
            manager_name = None
            if member.get("manager_id"):
                manager = await db.users.find_one({"id": member["manager_id"]})
                if manager:
                    manager_name = f"{manager.get('first_name', '')} {manager.get('last_name', '')}"
            
            organizations.append({
                "id": org["id"],
                "name": org["name"],
                "job_title": member.get("job_title"),
                "department": dept_name,
                "team": team_name,
                "manager": manager_name,
                "role": member.get("role"),
                "is_admin": member.get("is_admin", False),
                "start_date": member.get("start_date").isoformat() if member.get("start_date") else None,
                "work_anniversary": member.get("start_date")
            })
    
    return DynamicProfileResponse(
        id=current_user.id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        avatar_url=current_user.avatar_url or current_user.profile_picture,
        bio=current_user.bio,
        email=current_user.email,
        phone=current_user.phone,
        business_phone=current_user.business_phone,
        business_email=current_user.business_email,
        business_address=current_user.business_address,
        date_of_birth=current_user.date_of_birth,
        address_city=current_user.address_city,
        address_state=current_user.address_state,
        address_country=current_user.address_country,
        personal_interests=current_user.personal_interests or [],
        education=current_user.education,
        family_info=family_info,
        upcoming_family_birthday=upcoming_birthday,
        organizations=organizations,
        viewer_relationship="self",
        is_own_profile=True
    )

@api_router.get("/users/{user_id}/dynamic-profile", response_model=DynamicProfileResponse)
async def get_user_dynamic_profile(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get another user's dynamic profile with visibility rules applied"""
    
    # Get target user
    target_user_doc = await db.users.find_one({"id": user_id})
    if not target_user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user = User(**target_user_doc)
    
    # Get target user's privacy settings
    privacy_doc = await db.profile_privacy_settings.find_one({"user_id": user_id})
    privacy_settings = ProfilePrivacySettings(**privacy_doc) if privacy_doc else ProfilePrivacySettings()
    
    # Determine viewer relationship
    viewer_relationship = "public"
    shared_organizations = []
    
    # Check if users are in same organization
    viewer_orgs = await db.work_members.find({
        "user_id": current_user.id,
        "status": "ACTIVE"
    }).to_list(None)
    
    target_orgs = await db.work_members.find({
        "user_id": user_id,
        "status": "ACTIVE"
    }).to_list(None)
    
    viewer_org_ids = {m["organization_id"] for m in viewer_orgs}
    target_org_ids = {m["organization_id"] for m in target_orgs}
    shared_org_ids = viewer_org_ids & target_org_ids
    
    if shared_org_ids:
        viewer_relationship = "org_member"
        # Get shared organization details
        for org_id in shared_org_ids:
            org = await db.work_organizations.find_one({"id": org_id})
            if org:
                shared_organizations.append(org_id)
    
    # Apply visibility rules based on privacy settings and relationship
    def can_view_field(visibility: ProfileFieldVisibility) -> bool:
        if visibility == ProfileFieldVisibility.PUBLIC:
            return True
        elif visibility == ProfileFieldVisibility.ORGANIZATION_ONLY:
            return viewer_relationship == "org_member"
        elif visibility == ProfileFieldVisibility.PRIVATE:
            return False
        return False
    
    # Build response with visibility filtering
    response_data = {
        "id": target_user.id,
        "first_name": target_user.first_name,
        "last_name": target_user.last_name,
        "avatar_url": target_user.avatar_url or target_user.profile_picture,
        "bio": target_user.bio,
        "email": target_user.email if can_view_field(privacy_settings.email_visibility) else None,
        "phone": target_user.phone if can_view_field(privacy_settings.phone_visibility) else None,
        "business_phone": target_user.business_phone if can_view_field(privacy_settings.business_phone_visibility) else None,
        "business_email": target_user.business_email if can_view_field(privacy_settings.business_email_visibility) else None,
        "business_address": target_user.business_address if can_view_field(privacy_settings.business_phone_visibility) else None,
        "date_of_birth": target_user.date_of_birth if can_view_field(privacy_settings.birth_date_visibility) else None,
        "address_city": target_user.address_city if can_view_field(privacy_settings.address_visibility) else None,
        "address_state": target_user.address_state if can_view_field(privacy_settings.address_visibility) else None,
        "address_country": target_user.address_country if can_view_field(privacy_settings.address_visibility) else None,
        "personal_interests": target_user.personal_interests or [],
        "education": target_user.education,
        "viewer_relationship": viewer_relationship,
        "is_own_profile": False
    }
    
    # Add family info if visible
    family_info = None
    upcoming_birthday = None
    if can_view_field(privacy_settings.family_address_visibility):
        family_unit = await db.family_units.find_one({
            "member_ids": user_id,
            "is_active": True
        })
        if family_unit:
            family_info = {
                "family_name": family_unit.get("family_name", ""),
                "member_count": family_unit.get("member_count", 0),
                "address_city": family_unit.get("address_city"),
                "address_country": family_unit.get("address_country")
            }
    
    response_data["family_info"] = family_info
    response_data["upcoming_family_birthday"] = upcoming_birthday
    
    # Add organization info only for shared organizations
    organizations = []
    if viewer_relationship == "org_member":
        for org_id in shared_organizations:
            member = await db.work_members.find_one({
                "user_id": user_id,
                "organization_id": org_id,
                "status": "ACTIVE"
            })
            
            if member:
                org = await db.work_organizations.find_one({"id": org_id})
                if org:
                    org_data = {
                        "id": org["id"],
                        "name": org["name"],
                        "job_title": member.get("job_title") if can_view_field(privacy_settings.job_title_visibility) else None,
                        "department": None,
                        "team": None,
                        "manager": None,
                        "role": member.get("role"),
                        "is_admin": member.get("is_admin", False)
                    }
                    
                    # Add department if visible
                    if can_view_field(privacy_settings.department_visibility) and member.get("department_id"):
                        dept = await db.work_departments.find_one({"id": member["department_id"]})
                        if dept:
                            org_data["department"] = dept.get("name")
                    
                    # Add team if visible
                    if can_view_field(privacy_settings.team_visibility) and member.get("team_id"):
                        team = await db.work_teams.find_one({"id": member["team_id"]})
                        if team:
                            org_data["team"] = team.get("name")
                    
                    # Add manager if visible
                    if can_view_field(privacy_settings.manager_visibility) and member.get("manager_id"):
                        manager = await db.users.find_one({"id": member["manager_id"]})
                        if manager:
                            org_data["manager"] = f"{manager.get('first_name', '')} {manager.get('last_name', '')}"
                    
                    # Add work anniversary if visible
                    if can_view_field(privacy_settings.work_anniversary_visibility) and member.get("start_date"):
                        org_data["start_date"] = member["start_date"].isoformat()
                        org_data["work_anniversary"] = member["start_date"]
                    
                    organizations.append(org_data)
    
    response_data["organizations"] = organizations
    
    return DynamicProfileResponse(**response_data)

@api_router.put("/users/me/profile")
async def update_my_profile(
    profile_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile information"""
    
    update_fields = {}
    if profile_data.first_name is not None:
        update_fields["first_name"] = profile_data.first_name
    if profile_data.last_name is not None:
        update_fields["last_name"] = profile_data.last_name
    if profile_data.bio is not None:
        update_fields["bio"] = profile_data.bio
    if profile_data.phone is not None:
        update_fields["phone"] = profile_data.phone
    if profile_data.business_phone is not None:
        update_fields["business_phone"] = profile_data.business_phone
    if profile_data.business_email is not None:
        update_fields["business_email"] = profile_data.business_email
    if profile_data.business_address is not None:
        update_fields["business_address"] = profile_data.business_address
    if profile_data.personal_interests is not None:
        update_fields["personal_interests"] = profile_data.personal_interests
    if profile_data.education is not None:
        update_fields["education"] = profile_data.education
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_fields}
        )
    
    return {"success": True, "message": "Profile updated successfully"}

@api_router.put("/users/me/profile/privacy")
async def update_profile_privacy(
    privacy_data: ProfilePrivacyUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user's profile privacy settings - 13 boolean toggles"""
    
    # Get existing privacy settings or create new
    privacy_doc = await db.profile_privacy_settings.find_one({"user_id": current_user.id})
    
    if privacy_doc:
        # Update existing
        update_fields = {}
        # Family Context Settings
        if privacy_data.family_show_address is not None:
            update_fields["family_show_address"] = privacy_data.family_show_address
        if privacy_data.family_show_phone is not None:
            update_fields["family_show_phone"] = privacy_data.family_show_phone
        if privacy_data.family_show_birthdate is not None:
            update_fields["family_show_birthdate"] = privacy_data.family_show_birthdate
        if privacy_data.family_show_spouse_info is not None:
            update_fields["family_show_spouse_info"] = privacy_data.family_show_spouse_info
        
        # Work Context Settings
        if privacy_data.work_show_department is not None:
            update_fields["work_show_department"] = privacy_data.work_show_department
        if privacy_data.work_show_team is not None:
            update_fields["work_show_team"] = privacy_data.work_show_team
        if privacy_data.work_show_manager is not None:
            update_fields["work_show_manager"] = privacy_data.work_show_manager
        if privacy_data.work_show_work_anniversary is not None:
            update_fields["work_show_work_anniversary"] = privacy_data.work_show_work_anniversary
        if privacy_data.work_show_job_title is not None:
            update_fields["work_show_job_title"] = privacy_data.work_show_job_title
        
        # Public Context Settings
        if privacy_data.public_show_email is not None:
            update_fields["public_show_email"] = privacy_data.public_show_email
        if privacy_data.public_show_phone is not None:
            update_fields["public_show_phone"] = privacy_data.public_show_phone
        if privacy_data.public_show_location is not None:
            update_fields["public_show_location"] = privacy_data.public_show_location
        if privacy_data.public_show_bio is not None:
            update_fields["public_show_bio"] = privacy_data.public_show_bio
        
        if update_fields:
            await db.profile_privacy_settings.update_one(
                {"user_id": current_user.id},
                {"$set": update_fields}
            )
    else:
        # Create new privacy settings with defaults
        privacy_settings = ProfilePrivacySettings()
        
        # Apply any provided values
        if privacy_data.family_show_address is not None:
            privacy_settings.family_show_address = privacy_data.family_show_address
        if privacy_data.family_show_phone is not None:
            privacy_settings.family_show_phone = privacy_data.family_show_phone
        if privacy_data.family_show_birthdate is not None:
            privacy_settings.family_show_birthdate = privacy_data.family_show_birthdate
        if privacy_data.family_show_spouse_info is not None:
            privacy_settings.family_show_spouse_info = privacy_data.family_show_spouse_info
        
        if privacy_data.work_show_department is not None:
            privacy_settings.work_show_department = privacy_data.work_show_department
        if privacy_data.work_show_team is not None:
            privacy_settings.work_show_team = privacy_data.work_show_team
        if privacy_data.work_show_manager is not None:
            privacy_settings.work_show_manager = privacy_data.work_show_manager
        if privacy_data.work_show_work_anniversary is not None:
            privacy_settings.work_show_work_anniversary = privacy_data.work_show_work_anniversary
        if privacy_data.work_show_job_title is not None:
            privacy_settings.work_show_job_title = privacy_data.work_show_job_title
        
        if privacy_data.public_show_email is not None:
            privacy_settings.public_show_email = privacy_data.public_show_email
        if privacy_data.public_show_phone is not None:
            privacy_settings.public_show_phone = privacy_data.public_show_phone
        if privacy_data.public_show_location is not None:
            privacy_settings.public_show_location = privacy_data.public_show_location
        if privacy_data.public_show_bio is not None:
            privacy_settings.public_show_bio = privacy_data.public_show_bio
        
        await db.profile_privacy_settings.insert_one({
            "user_id": current_user.id,
            **privacy_settings.dict()
        })
    
    return {"success": True, "message": "Privacy settings updated successfully"}
    
    return {"success": True, "message": "Privacy settings updated successfully"}

@api_router.get("/users/me/profile/privacy", response_model=ProfilePrivacySettings)
async def get_my_privacy_settings(current_user: User = Depends(get_current_user)):
    """Get current user's profile privacy settings"""
    
    privacy_doc = await db.profile_privacy_settings.find_one({"user_id": current_user.id})
    if privacy_doc:
        return ProfilePrivacySettings(**privacy_doc)
    else:
        # Return default settings
        return ProfilePrivacySettings()

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
        
        # ALWAYS add creator as a family member first
        creator_member = {
            "id": str(uuid.uuid4()),
            "family_id": new_family["id"],
            "user_id": current_user.id,
            "family_role": "CREATOR",
            "is_creator": True,
            "is_active": True,
            "invitation_accepted": True,
            "joined_at": datetime.now(timezone.utc)
        }
        await db.family_members.insert_one(creator_member)
        
        # Add additional family members (if provided)
        for member in members:
            # Skip if this member is the creator (already added above)
            if member.get("user_id") == current_user.id:
                continue
                
            family_member = {
                "id": str(uuid.uuid4()),
                "family_id": new_family["id"],
                "user_id": member.get("user_id"),
                "family_role": member.get("role", "PARENT"),
                "is_creator": False,
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
        
        # Update member count to include creator
        await db.family_profiles.update_one(
            {"id": new_family["id"]},
            {"$set": {"member_count": len(members) + 1}}
        )
        
        # Remove _id if present to avoid serialization issues
        if "_id" in new_family:
            del new_family["_id"]
        
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
    """Get family profiles where user is a member - OPTIMIZED with batch query"""
    family_memberships = await db.family_members.find({
        "user_id": current_user.id, 
        "is_active": True,
        "invitation_accepted": True
    }).to_list(100)
    
    if not family_memberships:
        return {"family_profiles": []}
    
    # OPTIMIZED: Batch fetch all family profiles at once
    family_ids = [m["family_id"] for m in family_memberships]
    family_docs = await db.family_profiles.find(
        {"id": {"$in": family_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Create lookup maps for O(1) access
    family_map = {f["id"]: f for f in family_docs}
    membership_map = {m["family_id"]: m for m in family_memberships}
    
    # Build response using lookups
    families = []
    for family_id in family_ids:
        family = family_map.get(family_id)
        membership = membership_map.get(family_id)
        
        if family and membership:
            try:
                family_response = FamilyProfileResponse(**family)
                family_response.is_user_member = True
                family_response.user_role = FamilyRole(membership["family_role"])
                families.append(family_response)
            except Exception as e:
                logger.error(f"Error creating family response: {str(e)}")
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

@api_router.get("/users/search/basic")
async def search_users_basic(
    query: str,
    current_user: User = Depends(get_current_user)
):
    """Search for users by name or email - basic version"""
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
    """Get list of family members with user info - OPTIMIZED with batch query"""
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
        
        # OPTIMIZED: Batch fetch all users at once instead of N+1 queries
        user_ids = [member["user_id"] for member in members]
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1, "avatar_url": 1}
        ).to_list(100)
        
        # Create lookup map for O(1) access
        user_map = {u["id"]: u for u in users}
        
        # Build response using lookup
        member_list = []
        for member in members:
            user = user_map.get(member["user_id"])
            if user:
                member_list.append({
                    "id": member["id"],
                    "user_id": member["user_id"],
                    "name": user.get("first_name", ""),
                    "surname": user.get("last_name", ""),
                    "first_name": user.get("first_name", ""),
                    "last_name": user.get("last_name", ""),
                    "email": user.get("email", ""),
                    "avatar_url": user.get("avatar_url"),
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
    """Remove a member from the family - FIXED with proper authorization"""
    try:
        # Check if current user is a member and get their role
        current_membership = await db.family_members.find_one({
            "family_id": family_id,
            "user_id": current_user.id,
            "is_active": True
        })
        
        if not current_membership:
            raise HTTPException(status_code=403, detail="Not a family member")
        
        # Get the member being removed
        target_member = await db.family_members.find_one({
            "id": member_id,
            "family_id": family_id,
            "is_active": True
        })
        
        if not target_member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Authorization check: Only CREATOR/ADMIN can remove others, or user can remove themselves
        current_role = current_membership.get("family_role", "MEMBER")
        is_admin = current_role in ["CREATOR", "ADMIN"]
        is_removing_self = target_member.get("user_id") == current_user.id
        
        if not is_admin and not is_removing_self:
            raise HTTPException(
                status_code=403, 
                detail="Only family admins can remove other members"
            )
        
        # Prevent removing the creator
        if target_member.get("family_role") == "CREATOR" and not is_removing_self:
            raise HTTPException(
                status_code=403,
                detail="Cannot remove the family creator"
            )
        
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
            
    except HTTPException:
        raise
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
    
    if not family_memberships:
        return {"family_members": []}
    
    # OPTIMIZED: Batch fetch all users at once instead of N+1 queries
    user_ids = [m["user_id"] for m in family_memberships]
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "avatar_url": 1}
    ).to_list(100)
    
    # Create lookup map for O(1) access
    user_map = {u["id"]: u for u in users}
    
    # Build response using lookup
    members = []
    for member in family_memberships:
        user = user_map.get(member["user_id"])
        if user:
            member_data = {k: v for k, v in member.items() if k != '_id'}
            member_response = FamilyMemberResponse(
                **member_data,
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
    
    if not posts:
        return {"family_posts": [], "total": 0}
    
    # OPTIMIZED: Fetch family data once (not in loop)
    family = await db.family_profiles.find_one({"id": family_id}, {"_id": 0})
    
    # OPTIMIZED: Batch fetch all authors at once instead of N+1 queries
    author_ids = list(set(post["posted_by_user_id"] for post in posts))
    authors = await db.users.find(
        {"id": {"$in": author_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "avatar_url": 1}
    ).to_list(len(author_ids))
    
    # Create lookup map for O(1) access
    author_map = {a["id"]: a for a in authors}
    
    # Build response using lookup
    post_responses = []
    for post in posts:
        author = author_map.get(post["posted_by_user_id"])
        
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

# ===== DIRECT MESSAGES (1:1 CHAT) ENDPOINTS =====

@api_router.get("/direct-chats")
async def get_user_direct_chats(current_user: User = Depends(get_current_user)):
    """Get all direct chat conversations for the current user"""
    direct_chats = await db.direct_chats.find({
        "participant_ids": current_user.id,
        "is_active": True
    }).to_list(100)
    
    result = []
    for chat in direct_chats:
        chat.pop("_id", None)
        
        # Get the other participant
        other_user_id = [uid for uid in chat["participant_ids"] if uid != current_user.id][0]
        other_user = await get_user_by_id(other_user_id)
        
        # Get latest message
        latest_message = await db.chat_messages.find_one(
            {"direct_chat_id": chat["id"], "is_deleted": False},
            sort=[("created_at", -1)]
        )
        if latest_message:
            latest_message.pop("_id", None)
        
        # Get unread count
        unread_count = await db.chat_messages.count_documents({
            "direct_chat_id": chat["id"],
            "user_id": {"$ne": current_user.id},
            "status": {"$ne": "read"},
            "is_deleted": False
        })
        
        result.append({
            "chat": chat,
            "other_user": {
                "id": other_user.id if other_user else other_user_id,
                "first_name": other_user.first_name if other_user else "Unknown",
                "last_name": other_user.last_name if other_user else "User",
                "profile_picture": other_user.profile_picture if other_user else None
            } if other_user else None,
            "latest_message": latest_message,
            "unread_count": unread_count
        })
    
    # Sort by latest message time
    result.sort(key=lambda x: x["latest_message"]["created_at"] if x["latest_message"] else x["chat"]["created_at"], reverse=True)
    
    return {"direct_chats": result}

@api_router.post("/direct-chats")
async def create_or_get_direct_chat(
    chat_data: DirectChatCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new direct chat or get existing one"""
    # Check if recipient exists
    recipient = await get_user_by_id(chat_data.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient user not found")
    
    # Check if chat already exists
    existing_chat = await db.direct_chats.find_one({
        "participant_ids": {"$all": [current_user.id, chat_data.recipient_id]},
        "is_active": True
    })
    
    if existing_chat:
        existing_chat.pop("_id", None)
        return {
            "message": "Chat already exists",
            "chat_id": existing_chat["id"],
            "is_new": False
        }
    
    # Create new direct chat
    new_chat = DirectChat(
        participant_ids=[current_user.id, chat_data.recipient_id]
    )
    
    await db.direct_chats.insert_one(new_chat.dict())
    
    return {
        "message": "Direct chat created successfully",
        "chat_id": new_chat.id,
        "is_new": True
    }

@api_router.get("/direct-chats/{chat_id}/messages")
async def get_direct_chat_messages(
    chat_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get messages from a direct chat"""
    # Verify user is participant
    chat = await db.direct_chats.find_one({
        "id": chat_id,
        "participant_ids": current_user.id,
        "is_active": True
    })
    
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized to view this chat")
    
    # Update user's last seen
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"last_seen": datetime.now(timezone.utc), "is_online": True}}
    )
    
    # Mark unread messages as read
    await db.chat_messages.update_many(
        {
            "direct_chat_id": chat_id,
            "user_id": {"$ne": current_user.id},
            "status": {"$ne": "read"}
        },
        {"$set": {
            "status": "read",
            "read_at": datetime.now(timezone.utc)
        }}
    )
    
    messages = await db.chat_messages.find(
        {"direct_chat_id": chat_id, "is_deleted": False}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get sender info and reply message for each message
    for message in messages:
        message.pop("_id", None)
        sender = await get_user_by_id(message["user_id"])
        if sender:
            message["sender"] = {
                "id": sender.id,
                "first_name": sender.first_name,
                "last_name": sender.last_name,
                "profile_picture": sender.profile_picture
            }
        
        # Get reply message content if this is a reply
        if message.get("reply_to"):
            reply_msg = await db.chat_messages.find_one(
                {"id": message["reply_to"]},
                {"_id": 0, "content": 1, "user_id": 1}
            )
            if reply_msg:
                reply_sender = await get_user_by_id(reply_msg["user_id"])
                message["reply_message"] = {
                    "content": reply_msg["content"],
                    "sender": {
                        "first_name": reply_sender.first_name if reply_sender else "Unknown"
                    }
                }
    
    # Reverse to show chronological order
    messages.reverse()
    
    return {"messages": messages}

@api_router.post("/direct-chats/{chat_id}/messages")
async def send_direct_message(
    chat_id: str,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user)
):
    """Send a message in a direct chat"""
    # Verify user is participant
    chat = await db.direct_chats.find_one({
        "id": chat_id,
        "participant_ids": current_user.id,
        "is_active": True
    })
    
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this chat")
    
    new_message = ChatMessage(
        direct_chat_id=chat_id,
        user_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type,
        reply_to=message_data.reply_to,
        status="sent"
    )
    
    await db.chat_messages.insert_one(new_message.dict())
    
    # Update chat timestamp
    await db.direct_chats.update_one(
        {"id": chat_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    # Get sender info for response
    message_dict = new_message.dict()
    message_dict["sender"] = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_picture": current_user.profile_picture
    }
    
    # Convert datetime objects to ISO strings for JSON serialization
    if message_dict.get("created_at"):
        message_dict["created_at"] = message_dict["created_at"].isoformat()
    
    # Broadcast message via WebSocket to all connected users in this chat
    await broadcast_new_message(chat_id, message_dict, current_user.id)
    
    return {"message": "Message sent successfully", "message_id": new_message.id, "data": message_dict}

@api_router.put("/messages/{message_id}/status")
async def update_message_status(
    message_id: str,
    status_data: MessageStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update message status (delivered/read)"""
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only the recipient can mark as delivered/read
    if message["user_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot update status of your own message")
    
    update_data = {"status": status_data.status}
    if status_data.status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc)
    elif status_data.status == "read":
        update_data["read_at"] = datetime.now(timezone.utc)
        if not message.get("delivered_at"):
            update_data["delivered_at"] = datetime.now(timezone.utc)
    
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": update_data}
    )
    
    return {"message": "Status updated successfully"}

@api_router.get("/chats/{chat_id}/typing")
async def get_typing_status(
    chat_id: str,
    chat_type: str = "direct",
    current_user: User = Depends(get_current_user)
):
    """Get typing status for a chat"""
    # Get typing status that's recent (within last 5 seconds)
    five_seconds_ago = datetime.now(timezone.utc) - timedelta(seconds=5)
    
    typing_users = await db.typing_status.find({
        "chat_id": chat_id,
        "chat_type": chat_type,
        "user_id": {"$ne": current_user.id},
        "is_typing": True,
        "updated_at": {"$gte": five_seconds_ago}
    }, {"_id": 0}).to_list(10)
    
    # Get user names for typing users
    for typing_status in typing_users:
        user = await get_user_by_id(typing_status["user_id"])
        if user:
            typing_status["user_name"] = f"{user.first_name} {user.last_name}"
    
    return {"typing_users": typing_users}

@api_router.post("/chats/{chat_id}/typing")
async def set_typing_status(
    chat_id: str,
    typing_data: TypingStatusUpdate,
    chat_type: str = "direct",
    current_user: User = Depends(get_current_user)
):
    """Set typing status for current user in a chat"""
    await db.typing_status.update_one(
        {
            "chat_id": chat_id,
            "chat_type": chat_type,
            "user_id": current_user.id
        },
        {
            "$set": {
                "is_typing": typing_data.is_typing,
                "updated_at": datetime.now(timezone.utc)
            },
            "$setOnInsert": {
                "chat_id": chat_id,
                "chat_type": chat_type,
                "user_id": current_user.id
            }
        },
        upsert=True
    )
    
    return {"message": "Typing status updated"}

@api_router.get("/users/contacts")
async def get_user_contacts(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get list of users that can be contacted (for starting new chats)"""
    query = {"id": {"$ne": current_user.id}}
    
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"first_name": search_regex},
            {"last_name": search_regex},
            {"email": search_regex}
        ]
    
    users = await db.users.find(query, {
        "_id": 0,
        "id": 1,
        "first_name": 1,
        "last_name": 1,
        "email": 1,
        "profile_picture": 1
    }).limit(50).to_list(50)
    
    return {"contacts": users}

# ===== PHASE 2: ENHANCED CHAT FEATURES =====

@api_router.post("/users/heartbeat")
async def user_heartbeat(current_user: User = Depends(get_current_user)):
    """Update user's last_seen timestamp for online status tracking"""
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "last_seen": datetime.now(timezone.utc),
            "is_online": True
        }}
    )
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/users/{user_id}/status")
async def get_user_status(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a user's online status and last seen time"""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "last_seen": 1, "is_online": 1, "first_name": 1, "last_name": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Consider user online if last_seen within 2 minutes
    last_seen = user.get("last_seen")
    is_online = False
    if last_seen:
        if isinstance(last_seen, str):
            last_seen = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
        time_diff = datetime.now(timezone.utc) - last_seen
        is_online = time_diff.total_seconds() < 120  # 2 minutes
    
    return {
        "user_id": user_id,
        "is_online": is_online,
        "last_seen": last_seen.isoformat() if last_seen else None
    }

@api_router.get("/direct-chats/{chat_id}/messages/search")
async def search_direct_chat_messages(
    chat_id: str,
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search messages in a direct chat"""
    # Verify user is participant
    chat = await db.direct_chats.find_one({
        "id": chat_id,
        "participant_ids": current_user.id,
        "is_active": True
    })
    
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized to search this chat")
    
    # Search messages
    messages = await db.chat_messages.find({
        "direct_chat_id": chat_id,
        "content": {"$regex": query, "$options": "i"},
        "is_deleted": False
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add sender info
    for message in messages:
        message.pop("_id", None)
        sender = await get_user_by_id(message["user_id"])
        if sender:
            message["sender"] = {
                "id": sender.id,
                "first_name": sender.first_name,
                "last_name": sender.last_name,
                "profile_picture": sender.profile_picture
            }
    
    total = await db.chat_messages.count_documents({
        "direct_chat_id": chat_id,
        "content": {"$regex": query, "$options": "i"},
        "is_deleted": False
    })
    
    return {
        "messages": messages,
        "total": total,
        "query": query
    }

@api_router.get("/chat-groups/{group_id}/messages/search")
async def search_group_chat_messages(
    group_id: str,
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search messages in a group chat"""
    # Verify user is member
    membership = await db.chat_group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.id,
        "is_active": True
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Search messages
    messages = await db.chat_messages.find({
        "group_id": group_id,
        "content": {"$regex": query, "$options": "i"},
        "is_deleted": False
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add sender info
    for message in messages:
        message.pop("_id", None)
        sender = await get_user_by_id(message["user_id"])
        if sender:
            message["sender"] = {
                "id": sender.id,
                "first_name": sender.first_name,
                "last_name": sender.last_name,
                "profile_picture": sender.profile_picture
            }
    
    total = await db.chat_messages.count_documents({
        "group_id": group_id,
        "content": {"$regex": query, "$options": "i"},
        "is_deleted": False
    })
    
    return {
        "messages": messages,
        "total": total,
        "query": query
    }

@api_router.post("/direct-chats/{chat_id}/messages/attachment")
async def send_message_with_attachment(
    chat_id: str,
    file: UploadFile = File(...),
    content: str = Form(default=""),
    reply_to: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user)
):
    """Send a message with a file attachment in a direct chat"""
    # Verify user is participant
    chat = await db.direct_chats.find_one({
        "id": chat_id,
        "participant_ids": current_user.id,
        "is_active": True
    })
    
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate and save file
    is_valid, error = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    stored_filename = f"chat_{chat_id}_{str(uuid.uuid4())}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)
    
    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Determine message type
    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        message_type = "IMAGE"
    else:
        message_type = "FILE"
    
    # Create message with attachment
    new_message = ChatMessage(
        direct_chat_id=chat_id,
        user_id=current_user.id,
        content=content or file.filename,
        message_type=message_type,
        reply_to=reply_to,
        status="sent"
    )
    
    # Store attachment info in message
    message_dict = new_message.dict()
    message_dict["attachment"] = {
        "filename": file.filename,
        "stored_filename": stored_filename,
        "file_path": f"/api/media/files/{stored_filename}",
        "mime_type": content_type,
        "file_size": os.path.getsize(file_path)
    }
    
    await db.chat_messages.insert_one(message_dict)
    
    # Update chat timestamp
    await db.direct_chats.update_one(
        {"id": chat_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    # Add sender info for response
    message_dict["sender"] = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_picture": current_user.profile_picture
    }
    message_dict.pop("_id", None)
    
    return {"message": "File uploaded successfully", "data": message_dict}

@api_router.post("/direct-chats/{chat_id}/messages/voice")
async def send_voice_message(
    chat_id: str,
    file: UploadFile = File(...),
    content: str = Form(default=""),
    duration: int = Form(default=0),
    reply_to: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user)
):
    """Send a voice message in a direct chat"""
    # Verify user is participant
    chat = await db.direct_chats.find_one({
        "id": chat_id,
        "participant_ids": current_user.id,
        "is_active": True
    })
    
    if not chat:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate audio file
    allowed_audio_types = ["audio/webm", "audio/ogg", "audio/mp3", "audio/mpeg", "audio/wav", "audio/x-wav"]
    content_type = file.content_type or ""
    
    if not any(audio_type in content_type for audio_type in allowed_audio_types):
        # Also accept webm without proper content type
        if not file.filename.endswith(('.webm', '.ogg', '.mp3', '.wav')):
            raise HTTPException(status_code=400, detail="Invalid audio file format")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1] or '.webm'
    stored_filename = f"voice_{chat_id}_{str(uuid.uuid4())}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)
    
    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_content = await file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)
    
    # Create voice message
    new_message = ChatMessage(
        direct_chat_id=chat_id,
        user_id=current_user.id,
        content=content or "🎤 Голосовое сообщение",
        message_type="VOICE",
        reply_to=reply_to,
        status="sent"
    )
    
    # Store voice message info
    message_dict = new_message.dict()
    message_dict["voice"] = {
        "filename": file.filename,
        "stored_filename": stored_filename,
        "file_path": f"/api/media/files/{stored_filename}",
        "mime_type": content_type or "audio/webm",
        "duration": duration,
        "file_size": len(file_content)
    }
    
    await db.chat_messages.insert_one(message_dict)
    
    # Update chat timestamp
    await db.direct_chats.update_one(
        {"id": chat_id},
        {"$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    # Broadcast message via WebSocket
    await broadcast_new_message(chat_id, message_dict)
    
    # Add sender info for response
    message_dict["sender"] = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_picture": current_user.profile_picture
    }
    message_dict.pop("_id", None)
    
    return {"message": "Voice message sent successfully", "data": message_dict}

@api_router.get("/messages/{message_id}")
async def get_message_by_id(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific message by ID (for reply references)"""
    message = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user has access (is in the chat)
    if message.get("direct_chat_id"):
        chat = await db.direct_chats.find_one({
            "id": message["direct_chat_id"],
            "participant_ids": current_user.id
        })
        if not chat:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif message.get("group_id"):
        membership = await db.chat_group_members.find_one({
            "group_id": message["group_id"],
            "user_id": current_user.id,
            "is_active": True
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Add sender info
    sender = await get_user_by_id(message["user_id"])
    if sender:
        message["sender"] = {
            "id": sender.id,
            "first_name": sender.first_name,
            "last_name": sender.last_name,
            "profile_picture": sender.profile_picture
        }
    
    return {"message": message}

# ===== MESSAGE ACTIONS: REACTIONS, EDIT, DELETE =====

@api_router.post("/messages/{message_id}/react")
async def react_to_message(
    message_id: str,
    reaction_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Add or remove a reaction to a message"""
    emoji = reaction_data.get("emoji")
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji is required")
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Verify user has access
    if message.get("direct_chat_id"):
        chat = await db.direct_chats.find_one({
            "id": message["direct_chat_id"],
            "participant_ids": current_user.id
        })
        if not chat:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif message.get("group_id"):
        membership = await db.chat_group_members.find_one({
            "group_id": message["group_id"],
            "user_id": current_user.id,
            "is_active": True
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get current reactions
    reactions = message.get("reactions", {})
    user_reactions = message.get("user_reactions", {})
    
    # Check if user already reacted with this emoji
    current_user_reaction = user_reactions.get(current_user.id)
    
    if current_user_reaction == emoji:
        # Remove reaction (toggle off)
        if emoji in reactions:
            reactions[emoji] = max(0, reactions.get(emoji, 1) - 1)
            if reactions[emoji] == 0:
                del reactions[emoji]
        if current_user.id in user_reactions:
            del user_reactions[current_user.id]
    else:
        # Remove old reaction if exists
        if current_user_reaction and current_user_reaction in reactions:
            reactions[current_user_reaction] = max(0, reactions.get(current_user_reaction, 1) - 1)
            if reactions[current_user_reaction] == 0:
                del reactions[current_user_reaction]
        
        # Add new reaction
        reactions[emoji] = reactions.get(emoji, 0) + 1
        user_reactions[current_user.id] = emoji
    
    # Update message
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "reactions": reactions,
            "user_reactions": user_reactions
        }}
    )
    
    return {
        "message": "Reaction updated",
        "reactions": reactions,
        "user_reaction": user_reactions.get(current_user.id)
    }

@api_router.put("/messages/{message_id}")
async def edit_message(
    message_id: str,
    update_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Edit a message content (only by the sender)"""
    new_content = update_data.get("content")
    if not new_content or not new_content.strip():
        raise HTTPException(status_code=400, detail="Content is required")
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only the sender can edit
    if message["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    # Can only edit text messages
    if message.get("message_type") not in [None, "TEXT"]:
        raise HTTPException(status_code=400, detail="Can only edit text messages")
    
    # Check if message is deleted
    if message.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit deleted message")
    
    # Update message
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "content": new_content.strip(),
            "is_edited": True,
            "edited_at": datetime.now(timezone.utc)
        }}
    )
    
    updated_message = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    
    return {
        "message": "Message updated",
        "data": updated_message
    }

@api_router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a message (soft delete - only by the sender)"""
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only the sender can delete
    if message["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    # Soft delete - mark as deleted but keep in database
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc),
            "content": ""  # Clear content for privacy
        }}
    )
    
    return {"message": "Message deleted"}

@api_router.post("/messages/{message_id}/forward")
async def forward_message(
    message_id: str,
    forward_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Forward a message to another chat"""
    target_chat_id = forward_data.get("target_chat_id")
    chat_type = forward_data.get("chat_type", "direct")  # 'direct' or 'group'
    
    if not target_chat_id:
        raise HTTPException(status_code=400, detail="Target chat ID is required")
    
    # Get original message
    original_message = await db.chat_messages.find_one({"id": message_id})
    if not original_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if original_message.get("is_deleted"):
        raise HTTPException(status_code=400, detail="Cannot forward deleted message")
    
    # Verify user has access to original message
    if original_message.get("direct_chat_id"):
        chat = await db.direct_chats.find_one({
            "id": original_message["direct_chat_id"],
            "participant_ids": current_user.id
        })
        if not chat:
            raise HTTPException(status_code=403, detail="Not authorized to access this message")
    
    # Verify user has access to target chat
    if chat_type == "direct":
        target_chat = await db.direct_chats.find_one({
            "id": target_chat_id,
            "participant_ids": current_user.id,
            "is_active": True
        })
        if not target_chat:
            raise HTTPException(status_code=403, detail="Not authorized to forward to this chat")
    else:
        target_membership = await db.chat_group_members.find_one({
            "group_id": target_chat_id,
            "user_id": current_user.id,
            "is_active": True
        })
        if not target_membership:
            raise HTTPException(status_code=403, detail="Not authorized to forward to this group")
    
    # Get original sender info
    original_sender = await get_user_by_id(original_message["user_id"])
    original_sender_name = f"{original_sender.first_name} {original_sender.last_name}" if original_sender else "Unknown"
    
    # Create forwarded message
    forwarded_message = ChatMessage(
        direct_chat_id=target_chat_id if chat_type == "direct" else None,
        group_id=target_chat_id if chat_type == "group" else None,
        user_id=current_user.id,
        content=original_message.get("content", ""),
        message_type=original_message.get("message_type", "TEXT"),
        status="sent"
    )
    
    message_dict = forwarded_message.dict()
    message_dict["forwarded_from"] = {
        "message_id": message_id,
        "sender_name": original_sender_name,
        "chat_id": original_message.get("direct_chat_id") or original_message.get("group_id")
    }
    
    # Copy attachment or voice if present
    if original_message.get("attachment"):
        message_dict["attachment"] = original_message["attachment"]
    if original_message.get("voice"):
        message_dict["voice"] = original_message["voice"]
    
    await db.chat_messages.insert_one(message_dict)
    
    # Update target chat timestamp
    if chat_type == "direct":
        await db.direct_chats.update_one(
            {"id": target_chat_id},
            {"$set": {"updated_at": datetime.now(timezone.utc)}}
        )
    else:
        await db.chat_groups.update_one(
            {"id": target_chat_id},
            {"$set": {"updated_at": datetime.now(timezone.utc)}}
        )
    
    # Add sender info for response
    message_dict["sender"] = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_picture": current_user.profile_picture
    }
    message_dict.pop("_id", None)
    
    return {"message": "Message forwarded", "data": message_dict}

# ===== END PHASE 2 ENHANCED CHAT FEATURES =====

# ===== END DIRECT MESSAGES ENDPOINTS =====

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

@api_router.get("/media/files/{filename}")
async def get_media_file_by_name(filename: str):
    """Serve uploaded files (voice messages, chat attachments) by filename"""
    from fastapi.responses import FileResponse
    
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine mime type from extension
    ext = file_path.suffix.lower()
    mime_types = {
        '.webm': 'audio/webm',
        '.ogg': 'audio/ogg',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
    }
    mime_type = mime_types.get(ext, 'application/octet-stream')
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=mime_type
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
    """Get posts feed filtered by module, family, and user connections - OPTIMIZED VERSION"""
    
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
            }, {"_id": 0, "target_family_id": 1}).to_list(100)
            
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
    
    # Get user's family memberships for visibility checks (batch query)
    user_family_memberships = {}
    if module == "family":
        user_memberships = await db.family_members.find({
            "user_id": current_user.id,
            "is_active": True
        }, {"_id": 0, "family_id": 1, "relationship": 1}).to_list(100)
        
        for membership in user_memberships:
            user_family_memberships[membership["family_id"]] = membership
    
    # ========== OPTIMIZED: Fetch posts with projection ==========
    # Only fetch fields we need, skip heavy fields initially
    posts = await db.posts.find(
        query,
        {"_id": 0}  # Exclude _id
    ).sort("created_at", -1).skip(skip).limit(limit * 2).to_list(limit * 2)
    
    # First pass: filter by visibility
    visible_posts = []
    for post in posts:
        post_family_id = post.get("family_id")
        user_membership = user_family_memberships.get(post_family_id) if post_family_id else None
        
        if await can_user_see_post(post, current_user, user_membership):
            visible_posts.append(post)
            if len(visible_posts) >= limit:
                break
    
    if not visible_posts:
        return []
    
    # ========== OPTIMIZED: Batch fetch all related data ==========
    post_ids = [p["id"] for p in visible_posts]
    user_ids = list(set(p["user_id"] for p in visible_posts))
    all_media_ids = []
    for p in visible_posts:
        all_media_ids.extend(p.get("media_files", []))
    all_media_ids = list(set(all_media_ids))
    
    # Batch query 1: All authors at once
    authors_list = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
    ).to_list(len(user_ids))
    authors_map = {a["id"]: a for a in authors_list}
    
    # Batch query 2: All media files at once
    media_files_list = await db.media_files.find(
        {"id": {"$in": all_media_ids}},
        {"_id": 0}
    ).to_list(len(all_media_ids)) if all_media_ids else []
    media_files_map = {m["id"]: m for m in media_files_list}
    
    # Batch query 3: All user likes at once
    user_likes_list = await db.post_likes.find(
        {"post_id": {"$in": post_ids}, "user_id": current_user.id},
        {"_id": 0, "post_id": 1}
    ).to_list(len(post_ids))
    user_likes_set = {l["post_id"] for l in user_likes_list}
    
    # Batch query 4: All user reactions at once
    user_reactions_list = await db.post_reactions.find(
        {"post_id": {"$in": post_ids}, "user_id": current_user.id},
        {"_id": 0, "post_id": 1, "emoji": 1}
    ).to_list(len(post_ids))
    user_reactions_map = {r["post_id"]: r["emoji"] for r in user_reactions_list}
    
    # Batch query 5: All reactions aggregated at once
    reactions_pipeline = [
        {"$match": {"post_id": {"$in": post_ids}}},
        {"$group": {
            "_id": {"post_id": "$post_id", "emoji": "$emoji"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$group": {
            "_id": "$_id.post_id",
            "reactions": {
                "$push": {"emoji": "$_id.emoji", "count": "$count"}
            }
        }}
    ]
    reactions_cursor = db.post_reactions.aggregate(reactions_pipeline)
    post_reactions_map = {}
    async for item in reactions_cursor:
        post_reactions_map[item["_id"]] = item["reactions"][:5]  # Top 5 reactions
    
    # ========== Build response using cached data ==========
    result = []
    for post in visible_posts:
        # Set author from batch query
        author = authors_map.get(post["user_id"])
        post["author"] = {
            "id": author["id"],
            "first_name": author.get("first_name", ""),
            "last_name": author.get("last_name", ""),
            "profile_picture": author.get("profile_picture")
        } if author else {}
        
        # Set media files from batch query
        media_files = []
        for media_id in post.get("media_files", []):
            media = media_files_map.get(media_id)
            if media:
                media_copy = media.copy()
                media_copy["file_url"] = f"/api/media/{media_id}"
                media_files.append(media_copy)
        post["media_files"] = media_files
        
        # Set social data from batch queries
        post_id = post["id"]
        post["user_liked"] = post_id in user_likes_set
        post["user_reaction"] = user_reactions_map.get(post_id)
        post["top_reactions"] = post_reactions_map.get(post_id, [])
        
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
    youtube_video_id: str = Form(default=None),  # Explicit YouTube video ID
    link_url: str = Form(default=None),  # Link for preview
    link_domain: str = Form(default=None),  # Link domain for preview
    current_user: User = Depends(get_current_user)
):
    """Create a new post with optional media attachments, YouTube embeds, link previews, and role-based visibility"""
    
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
    
    # Add explicit YouTube video ID if provided
    if youtube_video_id and youtube_video_id not in [extract_youtube_id_from_url(u) for u in youtube_urls]:
        youtube_urls.append(f"https://www.youtube.com/watch?v={youtube_video_id}")
    
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
        youtube_urls=youtube_urls,
        youtube_video_id=youtube_video_id,
        link_url=link_url,
        link_domain=link_domain
    )
    
    await db.posts.insert_one(new_post.dict())
    
    # Check for @ERIC mention or ERIC_AI visibility and trigger AI response
    should_trigger_eric = '@eric' in content.lower() or '@ERIC' in content or visibility == 'ERIC_AI'
    if should_trigger_eric:
        # Trigger ERIC AI response as a background task
        asyncio.create_task(process_eric_mention_for_post(
            post_id=new_post.id,
            post_content=content,
            author_name=f"{current_user.first_name} {current_user.last_name}",
            user_id=current_user.id
        ))
    
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
        visibility=new_post.visibility.value,
        family_id=new_post.family_id,
        author=author_info,
        media_files=media_files,
        youtube_urls=new_post.youtube_urls,
        youtube_video_id=new_post.youtube_video_id,
        link_url=new_post.link_url,
        link_domain=new_post.link_domain,
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
        
        # Get author info - handle ERIC AI special case
        if comment["user_id"] == "eric-ai":
            comment["author"] = {
                "id": "eric-ai",
                "first_name": "ERIC",
                "last_name": "AI",
                "profile_picture": "/eric-avatar.jpg"
            }
        else:
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

@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(
    current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": current_user.id,
        "is_read": False
    })
    return {"unread_count": count}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

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
    """Get all family units user belongs to - OPTIMIZED with batch queries"""
    # Get user's memberships
    memberships = await db.family_unit_members.find({
        "user_id": current_user.id,
        "is_active": True
    }).to_list(100)
    
    if not memberships:
        return {"family_units": []}
    
    # OPTIMIZED: Batch fetch all family units at once
    family_unit_ids = [m["family_unit_id"] for m in memberships]
    family_units_docs = await db.family_units.find(
        {"id": {"$in": family_unit_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Create lookup maps for O(1) access
    family_unit_map = {fu["id"]: fu for fu in family_units_docs}
    membership_map = {m["family_unit_id"]: m for m in memberships}
    
    # Build response using lookups
    family_units = []
    for family_unit_id in family_unit_ids:
        family_unit = family_unit_map.get(family_unit_id)
        membership = membership_map.get(family_unit_id)
        
        if family_unit:
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
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all work organizations where user is a member, optionally filtered by type"""
    try:
        # Get user's memberships
        memberships = await db.work_members.find({
            "user_id": current_user.id,
            "is_active": True
        }).to_list(100)
        
        organizations = []
        for membership in memberships:
            # Build organization query
            org_query = {
                "$or": [
                    {"id": membership["organization_id"]},
                    {"organization_id": membership["organization_id"]}
                ],
                "is_active": True
            }
            
            # Add type filter if provided
            if type:
                org_query["organization_type"] = type
            
            # Try both id fields since model has alias
            org = await db.work_organizations.find_one(org_query)
            
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
        
        # Create notification for the requesting user
        org = await db.work_organizations.find_one({"id": join_request["organization_id"]})
        org_name = org.get("name") if org else "организации"
        
        notification = WorkNotification(
            user_id=join_request["user_id"],
            organization_id=join_request["organization_id"],
            notification_type=NotificationType.JOIN_REQUEST_APPROVED,
            title="Запрос на вступление одобрен",
            message=f"Ваш запрос на вступление в {org_name} был одобрен. Теперь вы являетесь членом организации.",
            related_request_id=request_id
        )
        
        await db.work_notifications.insert_one(notification.model_dump())
        
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
        
        # Create notification for the requesting user
        org = await db.work_organizations.find_one({"id": join_request["organization_id"]})
        org_name = org.get("name") if org else "организации"
        
        notification_message = f"Ваш запрос на вступление в {org_name} был отклонён."
        if rejection_reason:
            notification_message += f" Причина: {rejection_reason}"
        
        notification = WorkNotification(
            user_id=join_request["user_id"],
            organization_id=join_request["organization_id"],
            notification_type=NotificationType.JOIN_REQUEST_REJECTED,
            title="Запрос на вступление отклонён",
            message=notification_message,
            related_request_id=request_id
        )
        
        await db.work_notifications.insert_one(notification.model_dump())
        
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
            
            # Ensure post_type is set (default to REGULAR for legacy posts)
            if "post_type" not in post:
                post["post_type"] = "REGULAR"
            
            # Ensure task_metadata is set
            if "task_metadata" not in post:
                post["task_metadata"] = None
            
            # Get author info if not present
            if "author_name" not in post:
                author_id = post.get("posted_by_user_id") or post.get("author_id")
                if author_id:
                    author = await db.users.find_one({"id": author_id}, {"_id": 0})
                    if author:
                        post["author_name"] = f"{author.get('first_name', '')} {author.get('last_name', '')}".strip()
                        post["author_id"] = author_id
                        post["author_avatar"] = author.get("avatar_url") or author.get("profile_picture")
                    else:
                        post["author_name"] = "Неизвестный пользователь"
                        post["author_id"] = author_id
                        post["author_avatar"] = None
        
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
async def get_work_post_comments(
    post_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get comments for a work post"""
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
            # Remove MongoDB _id field
            if "_id" in dept:
                del dept["_id"]
            
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
        
        is_dept_head = department.get("head_id") == current_user.id
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or 
            membership.get("is_admin") or 
            is_dept_head
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
        
        # Remove MongoDB _id field
        if "_id" in updated_dept:
            del updated_dept["_id"]
        
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
        
        if not membership or (membership.get("role") not in ["OWNER", "ADMIN"] and not membership.get("is_admin")):
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
        
        is_dept_head = department.get("head_id") == current_user.id
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or 
            membership.get("is_admin") or 
            is_dept_head
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
            # Remove MongoDB _id field
            if "_id" in member:
                del member["_id"]
                
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
        
        is_dept_head = department.get("head_id") == current_user.id
        is_authorized = membership and (
            membership.get("role") in ["OWNER", "ADMIN"] or 
            membership.get("is_admin") or 
            is_dept_head
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
                is_dept_head = dept.get("head_id") == current_user.id
        
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
            author_id=current_user.id,
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
        
        is_author = announcement.get("author_id") == current_user.id
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
        
        is_author = announcement.get("author_id") == current_user.id
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
            "follower_id": current_user.id
        })
        
        if existing_follow:
            raise HTTPException(status_code=400, detail="Вы уже подписаны на эту организацию")
        
        # Create follow
        follow = OrganizationFollow(
            organization_id=organization_id,
            follower_id=current_user.id
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
            "follower_id": current_user.id
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
            "follower_id": current_user.id
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
            "user_id": current_user.id
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
                    "requester_id": current_user.id,
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

# === TEACHER-SPECIFIC ENDPOINTS ===

@api_router.put("/work/organizations/{organization_id}/teachers/me")
async def update_my_teacher_profile(
    organization_id: str,
    teacher_data: TeacherProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update current user's teacher profile"""
    try:
        # Check if user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=404, detail="Вы не являетесь членом этой организации")
        
        # Check if organization is educational
        org = await db.work_organizations.find_one({"id": organization_id})
        if not org or org.get("organization_type") != "EDUCATIONAL":
            raise HTTPException(status_code=400, detail="Эта организация не является учебным заведением")
        
        # Build update fields
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        
        if teacher_data.is_teacher is not None:
            update_fields["is_teacher"] = teacher_data.is_teacher
        if teacher_data.teaching_subjects is not None:
            update_fields["teaching_subjects"] = teacher_data.teaching_subjects
        if teacher_data.teaching_grades is not None:
            update_fields["teaching_grades"] = teacher_data.teaching_grades
        if teacher_data.is_class_supervisor is not None:
            update_fields["is_class_supervisor"] = teacher_data.is_class_supervisor
        if teacher_data.supervised_class is not None:
            update_fields["supervised_class"] = teacher_data.supervised_class
        if teacher_data.teacher_qualification is not None:
            update_fields["teacher_qualification"] = teacher_data.teacher_qualification
        if teacher_data.job_title is not None:
            update_fields["job_title"] = teacher_data.job_title
        
        # Update teacher profile
        await db.work_members.update_one(
            {"_id": membership["_id"]},
            {"$set": update_fields}
        )
        
        return {
            "success": True,
            "message": "Профиль учителя обновлен"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/teachers", response_model=List[TeacherResponse])
async def get_organization_teachers(
    organization_id: str,
    grade: Optional[int] = None,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all teachers in the organization with optional filters"""
    try:
        # Check if user is a member or if org is public
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        org = await db.work_organizations.find_one({"id": organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # If private and not a member, deny access
        if org.get("is_private") and not membership:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "is_teacher": True,
            "status": "ACTIVE"
        }
        
        if grade is not None:
            query["teaching_grades"] = grade
        if subject is not None:
            query["teaching_subjects"] = subject
        
        # Get teachers
        teachers_cursor = db.work_members.find(query)
        teachers = await teachers_cursor.to_list(None)
        
        # Enrich with user details
        teacher_responses = []
        for teacher in teachers:
            user = await db.users.find_one({"id": teacher["user_id"]})
            if user:
                # Handle field mapping for teacher (similar to members endpoint)
                teacher_data = teacher.copy()
                if "member_id" in teacher_data:
                    teacher_data["id"] = teacher_data.pop("member_id")
                
                teacher_responses.append(TeacherResponse(
                    id=teacher_data.get("id"),
                    user_id=teacher_data["user_id"],
                    user_first_name=user["first_name"],
                    user_last_name=user["last_name"],
                    user_email=user["email"],
                    user_avatar_url=user.get("avatar_url"),
                    job_title=teacher_data.get("job_title"),
                    teaching_subjects=teacher_data.get("teaching_subjects", []),
                    teaching_grades=teacher_data.get("teaching_grades", []),
                    is_class_supervisor=teacher_data.get("is_class_supervisor", False),
                    supervised_class=teacher_data.get("supervised_class"),
                    teacher_qualification=teacher_data.get("teacher_qualification"),
                    department=teacher_data.get("department"),
                    start_date=teacher_data.get("start_date")
                ))
        
        return teacher_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/teachers/{teacher_id}", response_model=TeacherResponse)
async def get_teacher_profile(
    organization_id: str,
    teacher_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific teacher's profile"""
    try:
        # Get teacher (use member_id since that's the actual field in MongoDB)
        teacher = await db.work_members.find_one({
            "member_id": teacher_id,
            "organization_id": organization_id,
            "is_teacher": True,
            "status": "ACTIVE"
        })
        
        if not teacher:
            raise HTTPException(status_code=404, detail="Учитель не найден")
        
        # Get user details
        user = await db.users.find_one({"id": teacher["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Handle field mapping for teacher (similar to members endpoint)
        teacher_data = teacher.copy()
        if "member_id" in teacher_data:
            teacher_data["id"] = teacher_data.pop("member_id")
        
        return TeacherResponse(
            id=teacher_data.get("id"),
            user_id=teacher_data["user_id"],
            user_first_name=user["first_name"],
            user_last_name=user["last_name"],
            user_email=user["email"],
            user_avatar_url=user.get("avatar_url"),
            job_title=teacher_data.get("job_title"),
            teaching_subjects=teacher_data.get("teaching_subjects", []),
            teaching_grades=teacher_data.get("teaching_grades", []),
            is_class_supervisor=teacher_data.get("is_class_supervisor", False),
            supervised_class=teacher_data.get("supervised_class"),
            teacher_qualification=teacher_data.get("teacher_qualification"),
            department=teacher_data.get("department"),
            start_date=teacher_data.get("start_date")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/schools/constants")
async def get_school_constants():
    """Get Russian school system constants (subjects, grades, structure)"""
    return {
        "school_structure": RUSSIAN_SCHOOL_STRUCTURE,
        "subjects": RUSSIAN_SCHOOL_SUBJECTS,
        "grades": RUSSIAN_GRADES,
        "class_letters": CLASS_LETTERS,
        "school_levels": [level.value for level in SchoolLevel]
    }


# === SCHOOL CLASSES ENDPOINTS ===

@api_router.get("/work/organizations/{organization_id}/classes", response_model=List[SchoolClassResponse])
async def get_organization_classes(
    organization_id: str,
    grade: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """Get classes for an organization. 
    For teachers: returns classes they teach or supervise.
    For admins: returns all classes in the organization."""
    try:
        # Check if user has access to this organization
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        teacher = await db.teachers.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id
        })
        
        if not membership and not teacher:
            # Also check if user is admin
            if current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Нет доступа к этой организации")
        
        _is_admin = membership and membership.get("is_admin")
        is_teacher = membership and membership.get("is_teacher") or teacher is not None
        
        # Get unique classes from students
        pipeline = [
            {"$match": {"organization_id": organization_id, "academic_status": "ACTIVE"}},
            {"$group": {
                "_id": "$assigned_class",
                "grade": {"$first": "$grade"},
                "students_count": {"$sum": 1}
            }},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort": {"grade": 1, "_id": 1}}
        ]
        
        if grade:
            pipeline[0]["$match"]["grade"] = grade
        
        classes_data = await db.work_students.aggregate(pipeline).to_list(None)
        
        # If no students with classes, create classes based on teacher assignments
        if not classes_data and is_teacher:
            # Get teacher's teaching grades and supervised class
            teacher_info = teacher or await db.work_members.find_one({
                "organization_id": organization_id,
                "user_id": current_user.id,
                "is_teacher": True
            })
            
            if teacher_info:
                teaching_grades = teacher_info.get("teaching_grades", [])
                supervised_class = teacher_info.get("supervised_class")
                
                # Generate sample classes based on teaching grades
                class_letters = ["А", "Б", "В"]
                generated_classes = []
                
                for g in teaching_grades:
                    for letter in class_letters[:2]:  # Just A and B for each grade
                        class_name = f"{g}-{letter}"
                        generated_classes.append({
                            "_id": class_name,
                            "grade": g,
                            "students_count": 0
                        })
                
                # Add supervised class if exists
                if supervised_class and not any(c["_id"] == supervised_class for c in generated_classes):
                    grade_num = int(''.join(filter(str.isdigit, supervised_class))) if supervised_class else None
                    if grade_num:
                        generated_classes.append({
                            "_id": supervised_class,
                            "grade": grade_num,
                            "students_count": 0
                        })
                
                classes_data = sorted(generated_classes, key=lambda x: (x["grade"], x["_id"]))
        
        # Get all teachers to find class supervisors
        teachers_cursor = db.teachers.find({"organization_id": organization_id})
        teachers_list = await teachers_cursor.to_list(None)
        
        # Also check work_members for teacher data
        members_cursor = db.work_members.find({
            "organization_id": organization_id,
            "is_teacher": True
        })
        members_list = await members_cursor.to_list(None)
        
        # Merge teacher info
        all_teachers = {}
        for t in teachers_list:
            supervised = t.get("supervised_class")
            if supervised:
                user = await db.users.find_one({"id": t.get("user_id")})
                if user:
                    all_teachers[supervised] = {
                        "id": t.get("user_id"),
                        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "subjects": t.get("teaching_subjects", [])
                    }
        
        for m in members_list:
            supervised = m.get("supervised_class")
            if supervised and supervised not in all_teachers:
                user = await db.users.find_one({"id": m.get("user_id")})
                if user:
                    all_teachers[supervised] = {
                        "id": m.get("user_id"),
                        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "subjects": m.get("teaching_subjects", [])
                    }
        
        # Get subjects taught to each class (based on teacher teaching_grades and teaching_subjects)
        subjects_by_grade = {}
        for t in teachers_list + members_list:
            for g in t.get("teaching_grades", []):
                if g not in subjects_by_grade:
                    subjects_by_grade[g] = set()
                subjects_by_grade[g].update(t.get("teaching_subjects", []))
        
        # Build response
        class_responses = []
        for class_info in classes_data:
            class_name = class_info["_id"]
            grade_num = class_info.get("grade", 0)
            
            teacher_info = all_teachers.get(class_name, {})
            subjects = list(subjects_by_grade.get(grade_num, set()))
            
            # Determine if current user is the class teacher
            is_class_teacher = teacher_info.get("id") == current_user.id
            
            class_responses.append(SchoolClassResponse(
                id=str(uuid.uuid4()),  # Generate ID for display
                name=class_name,
                grade=grade_num,
                students_count=class_info.get("students_count", 0),
                class_teacher=teacher_info.get("name"),
                class_teacher_id=teacher_info.get("id"),
                subjects=subjects[:5],  # Limit to 5 subjects for display
                schedule_count=len(subjects) * 2,  # Approximate lessons per week
                is_class_teacher=is_class_teacher
            ))
        
        return class_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === STUDENT MANAGEMENT ENDPOINTS ===

@api_router.post("/work/organizations/{organization_id}/students")
async def create_student(
    organization_id: str,
    student_data: StudentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new student (admin/teacher only)"""
    try:
        # Check if user is admin or teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or (not membership.get("is_admin") and not membership.get("is_teacher")):
            raise HTTPException(status_code=403, detail="Недостаточно прав для добавления студента")
        
        # Check if organization is EDUCATIONAL
        org = await db.work_organizations.find_one({"id": organization_id})
        if not org or org.get("organization_type") != "EDUCATIONAL":
            raise HTTPException(status_code=400, detail="Организация должна быть образовательного типа")
        
        # Validate grade
        if student_data.grade < 1 or student_data.grade > 11:
            raise HTTPException(status_code=400, detail="Класс должен быть от 1 до 11")
        
        # Create student
        student = WorkStudent(
            organization_id=organization_id,
            **student_data.dict()
        )
        
        student_dict = student.dict()
        # Convert date objects to ISO strings for MongoDB
        if isinstance(student_dict.get('date_of_birth'), date):
            student_dict['date_of_birth'] = student_dict['date_of_birth'].isoformat()
        
        await db.work_students.insert_one(student_dict)
        
        return {
            "success": True,
            "message": "Студент добавлен успешно",
            "student_id": student.student_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/students", response_model=List[StudentResponse])
async def get_organization_students(
    organization_id: str,
    grade: Optional[int] = None,
    assigned_class: Optional[str] = None,
    academic_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all students in the organization with optional filters"""
    try:
        # Check if user is a member or if org is public
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        org = await db.work_organizations.find_one({"id": organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        # If private and not a member, deny access
        if org.get("is_private") and not membership:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "is_active": True
        }
        
        if grade is not None:
            query["grade"] = grade
        if assigned_class is not None:
            query["assigned_class"] = assigned_class
        if academic_status is not None:
            query["academic_status"] = academic_status
        else:
            query["academic_status"] = "ACTIVE"  # Default to active students
        
        # Get students
        students_cursor = db.work_students.find(query)
        students = await students_cursor.to_list(None)
        
        # Enrich with parent details
        student_responses = []
        for student in students:
            # Parse date_of_birth if it's a string
            if isinstance(student.get('date_of_birth'), str):
                student['date_of_birth'] = datetime.fromisoformat(student['date_of_birth']).date()
            
            # Calculate age
            dob = student.get('date_of_birth')
            age = None
            if isinstance(dob, date):
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Get parent names
            parent_names = []
            for parent_id in student.get("parent_ids", []):
                parent = await db.users.find_one({"id": parent_id})
                if parent:
                    parent_names.append(f"{parent['first_name']} {parent['last_name']}")
            
            student_responses.append(StudentResponse(
                student_id=student["student_id"],
                organization_id=student["organization_id"],
                user_id=student.get("user_id"),
                student_first_name=student["student_first_name"],
                student_last_name=student["student_last_name"],
                student_middle_name=student.get("student_middle_name"),
                date_of_birth=student["date_of_birth"],
                grade=student["grade"],
                assigned_class=student.get("assigned_class"),
                enrolled_subjects=student.get("enrolled_subjects", []),
                parent_ids=student.get("parent_ids", []),
                parent_names=parent_names,
                academic_status=student["academic_status"],
                enrollment_date=student["enrollment_date"],
                student_number=student.get("student_number"),
                notes=student.get("notes"),
                age=age,
                # UI-compatible fields
                id=student["student_id"],
                first_name=student["student_first_name"],
                last_name=student["student_last_name"],
                class_name=student.get("assigned_class"),
                class_id=student.get("assigned_class"),  # Use class name as ID for now
                average_grade=round(3.5 + (hash(student["student_id"]) % 15) / 10, 1),  # Placeholder
                attendance_rate=85 + (hash(student["student_id"]) % 16),  # Placeholder 85-100%
                parent_name=parent_names[0] if parent_names else None
            ))
        
        return student_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/students/{student_id}", response_model=StudentResponse)
async def get_student_profile(
    organization_id: str,
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific student's profile"""
    try:
        # Get student
        student = await db.work_students.find_one({
            "student_id": student_id,
            "organization_id": organization_id,
            "is_active": True
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Студент не найден")
        
        # Check if user has access (member or parent)
        is_parent = current_user.id in student.get("parent_ids", [])
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not is_parent and not membership:
            raise HTTPException(status_code=403, detail="Доступ запрещен")
        
        # Parse date_of_birth if it's a string
        if isinstance(student.get('date_of_birth'), str):
            student['date_of_birth'] = datetime.fromisoformat(student['date_of_birth']).date()
        
        # Calculate age
        dob = student.get('date_of_birth')
        age = None
        if isinstance(dob, date):
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Get parent names
        parent_names = []
        for parent_id in student.get("parent_ids", []):
            parent = await db.users.find_one({"id": parent_id})
            if parent:
                parent_names.append(f"{parent['first_name']} {parent['last_name']}")
        
        return StudentResponse(
            student_id=student["student_id"],
            organization_id=student["organization_id"],
            user_id=student.get("user_id"),
            student_first_name=student["student_first_name"],
            student_last_name=student["student_last_name"],
            student_middle_name=student.get("student_middle_name"),
            date_of_birth=student["date_of_birth"],
            grade=student["grade"],
            assigned_class=student.get("assigned_class"),
            enrolled_subjects=student.get("enrolled_subjects", []),
            parent_ids=student.get("parent_ids", []),
            parent_names=parent_names,
            academic_status=student["academic_status"],
            enrollment_date=student["enrollment_date"],
            student_number=student.get("student_number"),
            notes=student.get("notes"),
            age=age,
            # UI-compatible fields
            id=student["student_id"],
            first_name=student["student_first_name"],
            last_name=student["student_last_name"],
            class_name=student.get("assigned_class"),
            class_id=student.get("assigned_class"),
            average_grade=round(3.5 + (hash(student["student_id"]) % 15) / 10, 1),
            attendance_rate=85 + (hash(student["student_id"]) % 16),
            parent_name=parent_names[0] if parent_names else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/work/organizations/{organization_id}/students/{student_id}")
async def update_student_profile(
    organization_id: str,
    student_id: str,
    student_update: StudentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update student profile (admin/teacher only)"""
    try:
        # Check if user is admin or teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or (not membership.get("is_admin") and not membership.get("is_teacher")):
            raise HTTPException(status_code=403, detail="Недостаточно прав для обновления студента")
        
        # Get student
        student = await db.work_students.find_one({
            "student_id": student_id,
            "organization_id": organization_id
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Студент не найден")
        
        # Build update dict
        update_dict = {k: v for k, v in student_update.dict(exclude_unset=True).items() if v is not None}
        
        if update_dict:
            # Convert date objects to ISO strings
            if 'date_of_birth' in update_dict and isinstance(update_dict['date_of_birth'], date):
                update_dict['date_of_birth'] = update_dict['date_of_birth'].isoformat()
            
            update_dict["updated_at"] = datetime.now(timezone.utc)
            
            await db.work_students.update_one(
                {"student_id": student_id},
                {"$set": update_dict}
            )
        
        return {
            "success": True,
            "message": "Профиль студента обновлен"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/students/{student_id}/parents")
async def link_parent_to_student(
    organization_id: str,
    student_id: str,
    link_request: StudentParentLinkRequest,
    current_user: User = Depends(get_current_user)
):
    """Link parent to student (admin/teacher only)"""
    try:
        # Check if user is admin or teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or (not membership.get("is_admin") and not membership.get("is_teacher")):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Get student
        student = await db.work_students.find_one({
            "student_id": student_id,
            "organization_id": organization_id
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Студент не найден")
        
        # Verify parent user exists
        parent = await db.users.find_one({"id": link_request.parent_user_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Родитель не найден")
        
        # Add parent to student's parent_ids if not already linked
        if link_request.parent_user_id not in student.get("parent_ids", []):
            await db.work_students.update_one(
                {"student_id": student_id},
                {"$push": {"parent_ids": link_request.parent_user_id}}
            )
        
        return {
            "success": True,
            "message": "Родитель привязан к студенту"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/users/me/children", response_model=List[StudentResponse])
async def get_my_children(
    current_user: User = Depends(get_current_user)
):
    """Get all children for the current user (parent)"""
    try:
        # Find all students where user is a parent
        students_cursor = db.work_students.find({
            "parent_ids": current_user.id,
            "is_active": True
        })
        students = await students_cursor.to_list(None)
        
        # Enrich with parent details
        student_responses = []
        for student in students:
            # Parse date_of_birth if it's a string
            if isinstance(student.get('date_of_birth'), str):
                student['date_of_birth'] = datetime.fromisoformat(student['date_of_birth']).date()
            
            # Calculate age
            dob = student.get('date_of_birth')
            age = None
            if isinstance(dob, date):
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Get parent names
            parent_names = []
            for parent_id in student.get("parent_ids", []):
                parent = await db.users.find_one({"id": parent_id})
                if parent:
                    parent_names.append(f"{parent['first_name']} {parent['last_name']}")
            
            student_responses.append(StudentResponse(
                student_id=student["student_id"],
                organization_id=student.get("organization_id"),
                user_id=student.get("user_id"),
                student_first_name=student["student_first_name"],
                student_last_name=student["student_last_name"],
                student_middle_name=student.get("student_middle_name"),
                date_of_birth=student["date_of_birth"],
                grade=student.get("grade"),
                assigned_class=student.get("assigned_class"),
                enrolled_subjects=student.get("enrolled_subjects", []),
                parent_ids=student.get("parent_ids", []),
                parent_names=parent_names,
                academic_status=student["academic_status"],
                enrollment_date=student.get("enrollment_date"),
                student_number=student.get("student_number"),
                notes=student.get("notes"),
                age=age,
                # UI-compatible fields
                id=student["student_id"],
                first_name=student["student_first_name"],
                last_name=student["student_last_name"],
                class_name=student.get("assigned_class"),
                class_id=student.get("assigned_class"),
                average_grade=round(3.5 + (hash(student["student_id"]) % 15) / 10, 1),
                attendance_rate=85 + (hash(student["student_id"]) % 16),
                parent_name=parent_names[0] if parent_names else None
            ))
        
        return student_responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/users/me/children")
async def add_child_profile(
    child_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Add basic child information for parent's profile
    This creates a minimal student record that can be used for enrollment
    """
    try:
        import uuid
        
        # Validate required fields
        if not child_data.get('first_name') or not child_data.get('last_name') or not child_data.get('date_of_birth'):
            raise HTTPException(status_code=400, detail="Требуются поля: имя, фамилия и дата рождения")
        
        # Parse date_of_birth
        try:
            dob = datetime.fromisoformat(child_data['date_of_birth']).date()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Неверный формат даты рождения")
        
        # Create student record
        student_id = str(uuid.uuid4())
        student_doc = {
            "student_id": student_id,
            "organization_id": None,  # Will be set when enrolled in a school
            "student_first_name": child_data['first_name'],
            "student_last_name": child_data['last_name'],
            "student_middle_name": child_data.get('middle_name', ''),
            "date_of_birth": dob.isoformat(),
            "grade": child_data.get('grade'),
            "assigned_class": None,
            "enrolled_subjects": [],
            "parent_ids": [current_user.id],
            "academic_status": "PENDING",  # Not yet enrolled
            "enrollment_date": None,
            "student_number": None,
            "notes": child_data.get('notes', ''),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.work_students.insert_one(student_doc)
        
        # Calculate age for response
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        return {
            "message": "Информация о ребёнке успешно сохранена",
            "student_id": student_id,
            "age": age
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/users/me/school-roles")
async def get_my_school_roles(
    current_user: User = Depends(get_current_user)
):
    """
    Get user's roles across all educational organizations
    Returns:
    - is_parent: boolean (has children)
    - is_teacher: boolean (is teacher in any school)
    - schools_as_parent: list of schools where user has children
    - schools_as_teacher: list of schools where user is a teacher
    """
    try:
        roles = {
            "is_parent": False,
            "is_teacher": False,
            "schools_as_parent": [],
            "schools_as_teacher": []
        }
        
        # Check if user is a parent (has children)
        children_count = await db.work_students.count_documents({
            "parent_ids": current_user.id,
            "is_active": True
        })
        roles["is_parent"] = children_count > 0
        
        # Get schools where user has children
        if roles["is_parent"]:
            students_cursor = db.work_students.find({
                "parent_ids": current_user.id,
                "is_active": True,
                "organization_id": {"$ne": None}
            })
            students = await students_cursor.to_list(None)
            
            # Get unique organization IDs
            org_ids = list(set([s["organization_id"] for s in students if s.get("organization_id")]))
            
            # Get organization details
            for org_id in org_ids:
                org = await db.work_organizations.find_one({"organization_id": org_id})
                if org and org.get("organization_type") == "EDUCATIONAL":
                    # Count children in this school
                    children_in_school = [s for s in students if s.get("organization_id") == org_id]
                    roles["schools_as_parent"].append({
                        "organization_id": org_id,
                        "organization_name": org.get("name"),
                        "children_count": len(children_in_school),
                        "children_ids": [s["student_id"] for s in children_in_school]
                    })
        
        # Check if user is a teacher in any educational organization
        # First check work_members with is_teacher flag
        teacher_memberships_cursor = db.work_members.find({
            "user_id": current_user.id,
            "is_teacher": True,
            "status": "active"
        })
        teacher_memberships = await teacher_memberships_cursor.to_list(None)
        
        # Also check the dedicated teachers collection
        teachers_cursor = db.teachers.find({
            "user_id": current_user.id
        })
        teachers_records = await teachers_cursor.to_list(None)
        
        roles["is_teacher"] = len(teacher_memberships) > 0 or len(teachers_records) > 0
        
        # Get schools where user is a teacher
        if roles["is_teacher"]:
            teacher_org_ids = [m["organization_id"] for m in teacher_memberships]
            # Add org_ids from teachers collection
            for t in teachers_records:
                if t.get("organization_id") and t["organization_id"] not in teacher_org_ids:
                    teacher_org_ids.append(t["organization_id"])
            
            for org_id in teacher_org_ids:
                org = await db.work_organizations.find_one({"organization_id": org_id})
                if org:
                    # Get teacher details from work_members
                    member = next((m for m in teacher_memberships if m["organization_id"] == org_id), None)
                    # Also check teachers collection for details
                    teacher_record = next((t for t in teachers_records if t.get("organization_id") == org_id), None)
                    
                    roles["schools_as_teacher"].append({
                        "organization_id": org_id,
                        "organization_name": org.get("name"),
                        "teaching_subjects": member.get("teaching_subjects", []) if member else (teacher_record.get("subjects", []) if teacher_record else []),
                        "teaching_grades": member.get("teaching_grades", []) if member else (teacher_record.get("grades", []) if teacher_record else []),
                        "is_class_supervisor": member.get("is_class_supervisor", False) if member else False,
                        "supervised_class": member.get("supervised_class") if member else None
                    })
        
        return roles
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === ENROLLMENT REQUEST ENDPOINTS ===

@api_router.post("/work/organizations/{organization_id}/enrollment-requests")
async def create_enrollment_request(
    organization_id: str,
    request_data: EnrollmentRequestCreate,
    current_user: User = Depends(get_current_user)
):
    """Parent submits enrollment request for their child"""
    try:
        # Check if organization exists and is EDUCATIONAL
        org = await db.work_organizations.find_one({"id": organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        if org.get("organization_type") != "EDUCATIONAL":
            raise HTTPException(status_code=400, detail="Организация должна быть образовательного типа")
        
        # Validate grade
        if request_data.requested_grade < 1 or request_data.requested_grade > 11:
            raise HTTPException(status_code=400, detail="Класс должен быть от 1 до 11")
        
        # Create enrollment request
        enrollment_request = StudentEnrollmentRequest(
            organization_id=organization_id,
            parent_user_id=current_user.id,
            **request_data.dict()
        )
        
        request_dict = enrollment_request.dict()
        # Convert date objects to ISO strings for MongoDB
        if isinstance(request_dict.get('student_dob'), date):
            request_dict['student_dob'] = request_dict['student_dob'].isoformat()
        
        await db.student_enrollment_requests.insert_one(request_dict)
        
        return {
            "success": True,
            "message": "Заявка на зачисление отправлена",
            "request_id": enrollment_request.request_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/enrollment-requests", response_model=List[EnrollmentRequestResponse])
async def get_enrollment_requests(
    organization_id: str,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get enrollment requests for organization (admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра заявок")
        
        # Build query
        query = {"organization_id": organization_id}
        if status:
            query["status"] = status
        else:
            query["status"] = "PENDING"  # Default to pending
        
        # Get requests
        requests_cursor = db.student_enrollment_requests.find(query)
        requests = await requests_cursor.to_list(None)
        
        # Get organization name
        org = await db.work_organizations.find_one({"id": organization_id})
        org_name = org.get("name", "") if org else ""
        
        # Enrich with parent details
        request_responses = []
        for req in requests:
            parent = await db.users.find_one({"id": req["parent_user_id"]})
            if parent:
                # Parse date if it's a string
                if isinstance(req.get('student_dob'), str):
                    req['student_dob'] = datetime.fromisoformat(req['student_dob']).date()
                
                request_responses.append(EnrollmentRequestResponse(
                    request_id=req["request_id"],
                    organization_id=req["organization_id"],
                    organization_name=org_name,
                    parent_user_id=req["parent_user_id"],
                    parent_name=f"{parent['first_name']} {parent['last_name']}",
                    parent_email=parent["email"],
                    student_first_name=req["student_first_name"],
                    student_last_name=req["student_last_name"],
                    student_middle_name=req.get("student_middle_name"),
                    student_dob=req["student_dob"],
                    requested_grade=req["requested_grade"],
                    requested_class=req.get("requested_class"),
                    parent_message=req.get("parent_message"),
                    status=req["status"],
                    reviewed_by=req.get("reviewed_by"),
                    reviewed_at=req.get("reviewed_at"),
                    rejection_reason=req.get("rejection_reason"),
                    created_at=req["created_at"]
                ))
        
        return request_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/enrollment-requests/{request_id}/approve")
async def approve_enrollment_request(
    organization_id: str,
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Approve enrollment request and create student (admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Get request
        enrollment_request = await db.student_enrollment_requests.find_one({
            "request_id": request_id,
            "organization_id": organization_id
        })
        
        if not enrollment_request:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        
        if enrollment_request["status"] != "PENDING":
            raise HTTPException(status_code=400, detail="Заявка уже обработана")
        
        # Parse date if it's a string
        student_dob = enrollment_request['student_dob']
        if isinstance(student_dob, str):
            student_dob = datetime.fromisoformat(student_dob).date()
        
        # Create student
        student = WorkStudent(
            organization_id=organization_id,
            student_first_name=enrollment_request["student_first_name"],
            student_last_name=enrollment_request["student_last_name"],
            student_middle_name=enrollment_request.get("student_middle_name"),
            date_of_birth=student_dob,
            grade=enrollment_request["requested_grade"],
            assigned_class=enrollment_request.get("requested_class"),
            parent_ids=[enrollment_request["parent_user_id"]]
        )
        
        student_dict = student.dict()
        # Convert date objects to ISO strings for MongoDB
        if isinstance(student_dict.get('date_of_birth'), date):
            student_dict['date_of_birth'] = student_dict['date_of_birth'].isoformat()
        
        await db.work_students.insert_one(student_dict)
        
        # Update request status
        await db.student_enrollment_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "APPROVED",
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "success": True,
            "message": "Заявка одобрена, студент зачислен",
            "student_id": student.student_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/enrollment-requests/{request_id}/reject")
async def reject_enrollment_request(
    organization_id: str,
    request_id: str,
    rejection_reason: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Reject enrollment request (admin only)"""
    try:
        # Check if user is admin
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership or not membership.get("is_admin"):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Get request
        enrollment_request = await db.student_enrollment_requests.find_one({
            "request_id": request_id,
            "organization_id": organization_id
        })
        
        if not enrollment_request:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        
        if enrollment_request["status"] != "PENDING":
            raise HTTPException(status_code=400, detail="Заявка уже обработана")
        
        # Update request status
        await db.student_enrollment_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "REJECTED",
                "reviewed_by": current_user.id,
                "reviewed_at": datetime.now(timezone.utc),
                "rejection_reason": rejection_reason
            }}
        )
        
        return {
            "success": True,
            "message": "Заявка отклонена"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === CLASS SCHEDULE ENDPOINTS ===

@api_router.post("/work/organizations/{organization_id}/schedules", response_model=ScheduleResponse)
async def create_schedule(
    organization_id: str,
    schedule_data: ScheduleCreate,
    current_user: User = Depends(get_current_user)
):
    """Create class schedule entry (admin/teacher only)"""
    try:
        # Check if organization exists and is EDUCATIONAL
        org = await db.work_organizations.find_one({"organization_id": organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        if org.get("organization_type") != "EDUCATIONAL":
            raise HTTPException(status_code=400, detail="Организация должна быть образовательного типа")
        
        # Check if user is admin or teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active"
        })
        
        if not membership or not (membership.get("is_admin") or membership.get("is_teacher")):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Validate lesson number
        if schedule_data.lesson_number < 1 or schedule_data.lesson_number > 7:
            raise HTTPException(status_code=400, detail="Номер урока должен быть от 1 до 7")
        
        # Create schedule entry
        schedule_id = str(uuid.uuid4())
        schedule_doc = {
            "schedule_id": schedule_id,
            "organization_id": organization_id,
            "grade": schedule_data.grade,
            "assigned_class": schedule_data.assigned_class,
            "day_of_week": schedule_data.day_of_week,
            "lesson_number": schedule_data.lesson_number,
            "subject": schedule_data.subject,
            "teacher_id": schedule_data.teacher_id,
            "classroom": schedule_data.classroom,
            "time_start": schedule_data.time_start,
            "time_end": schedule_data.time_end,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }
        
        await db.class_schedules.insert_one(schedule_doc)
        
        # Get teacher name for response
        teacher = await db.users.find_one({"id": schedule_data.teacher_id})
        teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}" if teacher else None
        
        return ScheduleResponse(
            schedule_id=schedule_id,
            organization_id=organization_id,
            grade=schedule_data.grade,
            assigned_class=schedule_data.assigned_class,
            day_of_week=schedule_data.day_of_week,
            lesson_number=schedule_data.lesson_number,
            subject=schedule_data.subject,
            teacher_id=schedule_data.teacher_id,
            teacher_name=teacher_name,
            classroom=schedule_data.classroom,
            time_start=schedule_data.time_start,
            time_end=schedule_data.time_end
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/schedules", response_model=List[ScheduleResponse])
async def get_schedules(
    organization_id: str,
    grade: Optional[int] = None,
    assigned_class: Optional[str] = None,
    day_of_week: Optional[DayOfWeek] = None,
    current_user: User = Depends(get_current_user)
):
    """Get class schedules with optional filters"""
    try:
        # Check if user has access to organization
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active"
        })
        
        # Also check if user is parent with children in this school
        has_children = await db.work_students.count_documents({
            "organization_id": organization_id,
            "parent_ids": current_user.id,
            "is_active": True
        })
        
        if not membership and has_children == 0:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "is_active": True
        }
        
        if grade:
            query["grade"] = grade
        if assigned_class:
            query["assigned_class"] = assigned_class
        if day_of_week:
            query["day_of_week"] = day_of_week
        
        # Get schedules
        schedules_cursor = db.class_schedules.find(query).sort([("day_of_week", 1), ("lesson_number", 1)])
        schedules = await schedules_cursor.to_list(None)
        
        # Enrich with teacher names
        schedule_responses = []
        for schedule in schedules:
            teacher = await db.users.find_one({"id": schedule["teacher_id"]})
            teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}" if teacher else None
            
            schedule_responses.append(ScheduleResponse(
                schedule_id=schedule["schedule_id"],
                organization_id=schedule["organization_id"],
                grade=schedule["grade"],
                assigned_class=schedule["assigned_class"],
                day_of_week=schedule["day_of_week"],
                lesson_number=schedule["lesson_number"],
                subject=schedule["subject"],
                teacher_id=schedule["teacher_id"],
                teacher_name=teacher_name,
                classroom=schedule.get("classroom"),
                time_start=schedule.get("time_start"),
                time_end=schedule.get("time_end")
            ))
        
        return schedule_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === GRADE/GRADEBOOK ENDPOINTS ===

@api_router.post("/work/organizations/{organization_id}/grades", response_model=GradeResponse)
async def create_grade(
    organization_id: str,
    grade_data: GradeCreate,
    current_user: User = Depends(get_current_user)
):
    """Create grade entry (teacher only)"""
    try:
        # Check if user is teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active",
            "is_teacher": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Только учителя могут выставлять оценки")
        
        # Validate grade value (1-5)
        if grade_data.grade_value < 1 or grade_data.grade_value > 5:
            raise HTTPException(status_code=400, detail="Оценка должна быть от 1 до 5")
        
        # Check if student exists in this organization
        student = await db.work_students.find_one({
            "student_id": grade_data.student_id,
            "organization_id": organization_id,
            "is_active": True
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Ученик не найден в этой организации")
        
        # Create grade entry
        grade_id = str(uuid.uuid4())
        grade_doc = {
            "grade_id": grade_id,
            "organization_id": organization_id,
            "student_id": grade_data.student_id,
            "subject": grade_data.subject,
            "teacher_id": current_user.id,
            "grade_value": grade_data.grade_value,
            "grade_type": grade_data.grade_type,
            "academic_period": grade_data.academic_period,
            "date": grade_data.date,
            "comment": grade_data.comment,
            "weight": grade_data.weight,
            "is_final": grade_data.is_final,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.student_grades.insert_one(grade_doc)
        
        # Get enriched data for response
        teacher_name = f"{current_user.first_name} {current_user.last_name}"
        student_name = f"{student.get('student_last_name', '')} {student.get('student_first_name', '')}"
        
        return GradeResponse(
            grade_id=grade_id,
            organization_id=organization_id,
            student_id=grade_data.student_id,
            student_name=student_name,
            subject=grade_data.subject,
            teacher_id=current_user.id,
            teacher_name=teacher_name,
            grade_value=grade_data.grade_value,
            grade_type=grade_data.grade_type,
            academic_period=grade_data.academic_period,
            date=grade_data.date,
            comment=grade_data.comment,
            weight=grade_data.weight,
            is_final=grade_data.is_final
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/students/{student_id}/grades", response_model=List[GradeResponse])
async def get_student_grades(
    organization_id: str,
    student_id: str,
    subject: Optional[str] = None,
    academic_period: Optional[AcademicPeriod] = None,
    current_user: User = Depends(get_current_user)
):
    """Get grades for a specific student"""
    try:
        # Check if user has access (teacher, admin, or parent of this student)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active"
        })
        
        # Check if user is parent of this student
        student = await db.work_students.find_one({
            "student_id": student_id,
            "organization_id": organization_id
        })
        
        if not student:
            raise HTTPException(status_code=404, detail="Ученик не найден")
        
        is_parent = current_user.id in student.get("parent_ids", [])
        
        if not membership and not is_parent:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "student_id": student_id
        }
        
        if subject:
            query["subject"] = subject
        if academic_period:
            query["academic_period"] = academic_period
        
        # Get grades
        grades_cursor = db.student_grades.find(query).sort("date", -1)
        grades = await grades_cursor.to_list(None)
        
        # Enrich with teacher and student names
        grade_responses = []
        for grade in grades:
            teacher = await db.users.find_one({"id": grade["teacher_id"]})
            teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}" if teacher else None
            student_name = f"{student.get('student_last_name', '')} {student.get('student_first_name', '')}"
            
            grade_responses.append(GradeResponse(
                grade_id=grade["grade_id"],
                organization_id=grade["organization_id"],
                student_id=grade["student_id"],
                student_name=student_name,
                subject=grade["subject"],
                teacher_id=grade["teacher_id"],
                teacher_name=teacher_name,
                grade_value=grade["grade_value"],
                grade_type=grade["grade_type"],
                academic_period=grade["academic_period"],
                date=grade["date"],
                comment=grade.get("comment"),
                weight=grade["weight"],
                is_final=grade["is_final"]
            ))
        
        return grade_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/grades/by-class")
async def get_class_grades(
    organization_id: str,
    grade: int,
    assigned_class: str,
    subject: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all grades for a class (teacher only)"""
    try:
        # Check if user is teacher
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active",
            "is_teacher": True
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Get all students in this class
        students_cursor = db.work_students.find({
            "organization_id": organization_id,
            "grade": grade,
            "assigned_class": assigned_class,
            "is_active": True
        })
        students = await students_cursor.to_list(None)
        
        if not students:
            return []
        
        student_ids = [s["student_id"] for s in students]
        
        # Build grade query
        grade_query = {
            "organization_id": organization_id,
            "student_id": {"$in": student_ids}
        }
        
        if subject:
            grade_query["subject"] = subject
        
        # Get all grades for these students
        grades_cursor = db.student_grades.find(grade_query).sort("date", -1)
        grades = await grades_cursor.to_list(None)
        
        # Group by student and subject
        student_summaries = []
        
        # Get unique subjects
        subjects = list(set([g["subject"] for g in grades]))
        
        for student in students:
            student_name = f"{student.get('student_last_name', '')} {student.get('student_first_name', '')}"
            
            for subj in subjects:
                student_grades = [g for g in grades if g["student_id"] == student["student_id"] and g["subject"] == subj]
                
                if student_grades:
                    # Calculate weighted average
                    total_weighted = sum([g["grade_value"] * g["weight"] for g in student_grades])
                    total_weight = sum([g["weight"] for g in student_grades])
                    average = round(total_weighted / total_weight, 2) if total_weight > 0 else None
                    
                    # Enrich grades with teacher names
                    enriched_grades = []
                    for g in student_grades:
                        teacher = await db.users.find_one({"id": g["teacher_id"]})
                        teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}" if teacher else None
                        
                        enriched_grades.append(GradeResponse(
                            grade_id=g["grade_id"],
                            organization_id=g["organization_id"],
                            student_id=g["student_id"],
                            student_name=student_name,
                            subject=g["subject"],
                            teacher_id=g["teacher_id"],
                            teacher_name=teacher_name,
                            grade_value=g["grade_value"],
                            grade_type=g["grade_type"],
                            academic_period=g["academic_period"],
                            date=g["date"],
                            comment=g.get("comment"),
                            weight=g["weight"],
                            is_final=g["is_final"]
                        ))
                    
                    student_summaries.append({
                        "student_id": student["student_id"],
                        "student_name": student_name,
                        "subject": subj,
                        "grades": enriched_grades,
                        "average": average,
                        "grade_count": len(student_grades)
                    })
        
        return student_summaries
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === JOURNAL POSTS ENDPOINTS (МОЯ ЛЕНТА) ===

@api_router.post("/journal/organizations/{organization_id}/posts", response_model=JournalPostResponse)
async def create_journal_post(
    organization_id: str,
    post_data: JournalPostCreate,
    current_user: User = Depends(get_current_user)
):
    """Create post in journal (teachers, parents, admins)"""
    try:
        # Check if organization exists and is EDUCATIONAL
        org = await db.work_organizations.find_one({"organization_id": organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        
        if org.get("organization_type") != "EDUCATIONAL":
            raise HTTPException(status_code=400, detail="Организация должна быть образовательного типа")
        
        # Determine user's role in this organization
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active"
        })
        
        # Check if user is parent
        has_children = await db.work_students.count_documents({
            "organization_id": organization_id,
            "parent_ids": current_user.id,
            "is_active": True
        })
        
        # Determine role
        if membership and membership.get("is_admin"):
            user_role = "admin"
        elif membership and membership.get("is_teacher"):
            user_role = "teacher"
        elif has_children > 0:
            user_role = "parent"
        else:
            raise HTTPException(status_code=403, detail="Недостаточно прав для создания поста")
        
        # Validate audience based on role
        if user_role == "parent" and post_data.audience_type not in [JournalAudienceType.PARENTS, JournalAudienceType.PUBLIC]:
            raise HTTPException(status_code=403, detail="Родители могут публиковать только для других родителей или публично")
        
        # Create post
        post_id = str(uuid.uuid4())
        post_doc = {
            "post_id": post_id,
            "organization_id": organization_id,
            "posted_by_user_id": current_user.id,
            "posted_by_role": user_role,
            "title": post_data.title,
            "content": post_data.content,
            "audience_type": post_data.audience_type,
            "media_files": post_data.media_file_ids,
            "likes_count": 0,
            "comments_count": 0,
            "is_published": True,
            "is_pinned": post_data.is_pinned,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.journal_posts.insert_one(post_doc)
        
        # Build response
        return JournalPostResponse(
            post_id=post_id,
            organization_id=organization_id,
            organization_name=org.get("name"),
            posted_by_user_id=current_user.id,
            posted_by_role=user_role,
            author={
                "id": current_user.id,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "profile_picture": current_user.profile_picture
            },
            title=post_data.title,
            content=post_data.content,
            audience_type=post_data.audience_type,
            media_files=post_data.media_file_ids,
            likes_count=0,
            comments_count=0,
            is_published=True,
            is_pinned=post_data.is_pinned,
            created_at=datetime.now(timezone.utc)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/journal/organizations/{organization_id}/posts", response_model=List[JournalPostResponse])
async def get_journal_posts(
    organization_id: str,
    audience_filter: Optional[JournalAudienceType] = None,
    current_user: User = Depends(get_current_user)
):
    """Get journal posts with audience filtering"""
    try:
        # Determine user's role in this organization
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "active"
        })
        
        has_children = await db.work_students.count_documents({
            "organization_id": organization_id,
            "parent_ids": current_user.id,
            "is_active": True
        })
        
        # Determine what user can see based on their role
        if membership and membership.get("is_admin"):
            _user_role = "admin"
            allowed_audiences = [JournalAudienceType.PUBLIC, JournalAudienceType.TEACHERS, 
                               JournalAudienceType.PARENTS, JournalAudienceType.STUDENTS_PARENTS, 
                               JournalAudienceType.ADMINS]
        elif membership and membership.get("is_teacher"):
            _user_role = "teacher"
            allowed_audiences = [JournalAudienceType.PUBLIC, JournalAudienceType.TEACHERS]
        elif has_children > 0:
            _user_role = "parent"
            allowed_audiences = [JournalAudienceType.PUBLIC, JournalAudienceType.PARENTS, 
                               JournalAudienceType.STUDENTS_PARENTS]
        else:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "is_published": True
        }
        
        # Apply audience filter with permission check
        if audience_filter:
            # User can only filter by audiences they're allowed to see
            if audience_filter in [a.value for a in allowed_audiences]:
                query["audience_type"] = audience_filter.value if hasattr(audience_filter, 'value') else audience_filter
            else:
                # User doesn't have permission to view this audience type
                raise HTTPException(status_code=403, detail="Недостаточно прав для просмотра данной аудитории")
        else:
            # No filter specified - show all allowed audiences
            query["audience_type"] = {"$in": [a.value for a in allowed_audiences]}
        
        # Get posts
        posts_cursor = db.journal_posts.find(query).sort("created_at", -1)
        posts = await posts_cursor.to_list(None)
        
        # Enrich with author and organization data
        post_responses = []
        org = await db.work_organizations.find_one({"organization_id": organization_id})
        
        for post in posts:
            author = await db.users.find_one({"id": post["posted_by_user_id"]})
            
            post_responses.append(JournalPostResponse(
                post_id=post["post_id"],
                organization_id=post["organization_id"],
                organization_name=org.get("name") if org else None,
                posted_by_user_id=post["posted_by_user_id"],
                posted_by_role=post["posted_by_role"],
                author={
                    "id": post["posted_by_user_id"],
                    "first_name": author.get("first_name", "") if author else "",
                    "last_name": author.get("last_name", "") if author else "",
                    "profile_picture": author.get("profile_picture") if author else None
                },
                title=post.get("title"),
                content=post["content"],
                audience_type=post["audience_type"],
                media_files=post.get("media_files", []),
                likes_count=post.get("likes_count", 0),
                comments_count=post.get("comments_count", 0),
                is_published=post["is_published"],
                is_pinned=post.get("is_pinned", False),
                created_at=datetime.fromisoformat(post["created_at"]) if isinstance(post["created_at"], str) else post["created_at"]
            ))
        
        return post_responses
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === ACADEMIC CALENDAR ENDPOINTS ===

@api_router.post("/journal/organizations/{organization_id}/calendar", response_model=AcademicEventResponse)
async def create_academic_event(
    organization_id: str,
    event: AcademicEventCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new academic calendar event (teachers, admins, parents, students)"""
    try:
        # Determine creator role based on user's relationship to the organization
        creator_role = "PARENT"  # Default
        
        # Check if teacher at this organization
        teacher = await db.teachers.find_one({
            "user_id": current_user.id,
            "organization_id": organization_id
        })
        if teacher:
            creator_role = "TEACHER"
        
        # Check if admin/director (work_member with admin role)
        work_member = await db.work_members.find_one({
            "user_id": current_user.id,
            "organization_id": organization_id
        })
        if work_member and work_member.get("role") in ["OWNER", "ADMIN"]:
            creator_role = "ADMIN"
        
        # Check if student (child of a parent)
        student = await db.work_students.find_one({
            "parent_ids": current_user.id,
            "organization_id": organization_id
        })
        if student and event.event_type in ["BIRTHDAY"]:
            # For birthday events, check if user is a student themselves
            user_student = await db.work_students.find_one({
                "user_id": current_user.id
            })
            if user_student:
                creator_role = "STUDENT"
        
        # Get role color
        role_color = EVENT_ROLE_COLORS.get(creator_role, "#16A34A")
        
        # Get organization info
        org = await db.work_organizations.find_one({"organization_id": organization_id})
        if not org:
            org = await db.organizations.find_one({"id": organization_id})
        
        # Create event document
        event_doc = {
            "id": str(uuid.uuid4()),
            "organization_id": organization_id,
            "created_by_user_id": current_user.id,
            "creator_role": creator_role,
            "title": event.title,
            "description": event.description,
            "event_type": event.event_type.value,
            "start_date": event.start_date,
            "end_date": event.end_date,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "is_all_day": event.is_all_day,
            "location": event.location,
            "audience_type": event.audience_type,
            "grade_filter": event.grade_filter,
            "color": event.color or role_color,  # Use role color if no custom color
            "requires_rsvp": event.requires_rsvp,
            "max_attendees": event.max_attendees,
            "invitees": event.invitees or [],
            "rsvp_responses": [],
            "birthday_party_data": event.birthday_party_data,  # Birthday party specific data
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.academic_events.insert_one(event_doc)
        
        return AcademicEventResponse(
            id=event_doc["id"],
            organization_id=organization_id,
            organization_name=org.get("name") if org else None,
            title=event_doc["title"],
            description=event_doc["description"],
            event_type=event_doc["event_type"],
            creator_role=creator_role,
            role_color=role_color,
            start_date=event_doc["start_date"],
            end_date=event_doc["end_date"],
            start_time=event_doc["start_time"],
            end_time=event_doc["end_time"],
            is_all_day=event_doc["is_all_day"],
            location=event_doc["location"],
            audience_type=event_doc["audience_type"],
            grade_filter=event_doc["grade_filter"],
            color=event_doc["color"],
            requires_rsvp=event_doc["requires_rsvp"],
            max_attendees=event_doc["max_attendees"],
            invitees=event_doc["invitees"],
            rsvp_responses=[],
            rsvp_summary={"YES": 0, "NO": 0, "MAYBE": 0},
            birthday_party_data=event_doc.get("birthday_party_data"),
            is_active=True,
            created_at=datetime.fromisoformat(event_doc["created_at"]),
            created_by={
                "id": current_user.id,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_event_color(event_type: str) -> str:
    """Get default color for event type"""
    colors = {
        "HOLIDAY": "#10B981",  # Green
        "EXAM": "#EF4444",  # Red
        "MEETING": "#3B82F6",  # Blue
        "EVENT": "#8B5CF6",  # Purple
        "DEADLINE": "#F59E0B",  # Amber
        "VACATION": "#06B6D4",  # Cyan
        "CONFERENCE": "#EC4899",  # Pink
        "COMPETITION": "#F97316"  # Orange
    }
    return colors.get(event_type, "#6B7280")


@api_router.get("/journal/organizations/{organization_id}/calendar", response_model=List[AcademicEventResponse])
async def get_academic_events(
    organization_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get academic calendar events for an organization"""
    try:
        # Build query
        query = {
            "organization_id": organization_id,
            "is_active": True
        }
        
        # Filter by event type if specified
        if event_type:
            query["event_type"] = event_type
        
        # Get events
        events_cursor = db.academic_events.find(query, {"_id": 0}).sort("start_date", 1)
        events = await events_cursor.to_list(500)
        
        # Filter by month/year if specified
        if month and year:
            target_month = f"{year}-{str(month).zfill(2)}"
            events = [e for e in events if e.get("start_date", "").startswith(target_month)]
        
        # Get organization info
        org = await db.work_organizations.find_one({"organization_id": organization_id})
        if not org:
            org = await db.organizations.find_one({"id": organization_id})
        
        # Build responses
        responses = []
        for event in events:
            # Get creator info
            creator = await db.users.find_one({"id": event.get("created_by_user_id")})
            
            # Get creator role and color
            creator_role = event.get("creator_role", "PARENT")
            role_color = EVENT_ROLE_COLORS.get(creator_role, "#16A34A")
            
            # Calculate RSVP summary
            rsvp_responses = event.get("rsvp_responses", [])
            rsvp_summary = {"YES": 0, "NO": 0, "MAYBE": 0}
            user_rsvp = None
            for rsvp in rsvp_responses:
                status = rsvp.get("status")
                if status in rsvp_summary:
                    rsvp_summary[status] += 1
                if rsvp.get("user_id") == current_user.id:
                    user_rsvp = status
            
            responses.append(AcademicEventResponse(
                id=event["id"],
                organization_id=organization_id,
                organization_name=org.get("name") if org else None,
                title=event["title"],
                description=event.get("description"),
                event_type=event["event_type"],
                creator_role=creator_role,
                role_color=role_color,
                start_date=event["start_date"],
                end_date=event.get("end_date"),
                start_time=event.get("start_time"),
                end_time=event.get("end_time"),
                is_all_day=event.get("is_all_day", True),
                location=event.get("location"),
                audience_type=event.get("audience_type", "PUBLIC"),
                grade_filter=event.get("grade_filter"),
                color=event.get("color") or role_color,
                invitees=event.get("invitees", []),
                requires_rsvp=event.get("requires_rsvp", False),
                max_attendees=event.get("max_attendees"),
                rsvp_responses=rsvp_responses,
                rsvp_summary=rsvp_summary,
                user_rsvp=user_rsvp,
                birthday_party_data=event.get("birthday_party_data"),
                is_active=event.get("is_active", True),
                created_at=datetime.fromisoformat(event["created_at"]) if isinstance(event["created_at"], str) else event["created_at"],
                created_by={
                    "id": creator.get("id") if creator else None,
                    "first_name": creator.get("first_name") if creator else "Неизвестный",
                    "last_name": creator.get("last_name") if creator else ""
                } if creator else None
            ))
        
        return responses
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RSVPInput(BaseModel):
    """RSVP input for event"""
    status: str  # YES, NO, MAYBE
    dietary_restrictions: Optional[str] = None  # Food allergies/restrictions for birthday parties

@api_router.post("/journal/calendar/{event_id}/rsvp")
async def rsvp_to_event(
    event_id: str,
    rsvp: RSVPInput,
    current_user: User = Depends(get_current_user)
):
    """RSVP to an academic calendar event"""
    try:
        # Validate RSVP status
        if rsvp.status not in ["YES", "NO", "MAYBE"]:
            raise HTTPException(status_code=400, detail="Неверный статус RSVP")
        
        # Find the event
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check if event requires RSVP
        if not event.get("requires_rsvp", False):
            raise HTTPException(status_code=400, detail="Это событие не требует подтверждения")
        
        # Check max attendees limit
        max_attendees = event.get("max_attendees")
        rsvp_responses = event.get("rsvp_responses", [])
        
        if max_attendees and rsvp.status == "YES":
            current_yes_count = sum(1 for r in rsvp_responses if r.get("status") == "YES" and r.get("user_id") != current_user.id)
            if current_yes_count >= max_attendees:
                raise HTTPException(status_code=400, detail="Достигнуто максимальное количество участников")
        
        # Remove existing RSVP from this user
        rsvp_responses = [r for r in rsvp_responses if r.get("user_id") != current_user.id]
        
        # Add new RSVP
        new_rsvp = {
            "user_id": current_user.id,
            "user_name": f"{current_user.first_name} {current_user.last_name}",
            "status": rsvp.status,
            "dietary_restrictions": rsvp.dietary_restrictions,
            "responded_at": datetime.now(timezone.utc).isoformat()
        }
        rsvp_responses.append(new_rsvp)
        
        # Update event
        await db.academic_events.update_one(
            {"id": event_id},
            {
                "$set": {
                    "rsvp_responses": rsvp_responses,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Calculate summary
        rsvp_summary = {"YES": 0, "NO": 0, "MAYBE": 0}
        for r in rsvp_responses:
            status = r.get("status")
            if status in rsvp_summary:
                rsvp_summary[status] += 1
        
        return {
            "message": "RSVP обновлён",
            "event_id": event_id,
            "user_rsvp": rsvp.status,
            "rsvp_summary": rsvp_summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journal/calendar/{event_id}/rsvp")
async def get_event_rsvp(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get RSVP details for an event"""
    try:
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        rsvp_responses = event.get("rsvp_responses", [])
        
        # Calculate summary
        rsvp_summary = {"YES": 0, "NO": 0, "MAYBE": 0}
        user_rsvp = None
        for r in rsvp_responses:
            status = r.get("status")
            if status in rsvp_summary:
                rsvp_summary[status] += 1
            if r.get("user_id") == current_user.id:
                user_rsvp = status
        
        return {
            "event_id": event_id,
            "requires_rsvp": event.get("requires_rsvp", False),
            "max_attendees": event.get("max_attendees"),
            "rsvp_responses": rsvp_responses,
            "rsvp_summary": rsvp_summary,
            "user_rsvp": user_rsvp,
            "total_responses": len(rsvp_responses)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BIRTHDAY WISH LIST ENDPOINTS ====================

@api_router.put("/journal/calendar/{event_id}/wishlist")
async def update_event_wishlist(
    event_id: str,
    wishlist_update: WishListUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update the wish list for a birthday event (event creator only)"""
    try:
        # Get the event
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check if this is a birthday event
        if event.get("event_type") != "BIRTHDAY":
            raise HTTPException(status_code=400, detail="Список желаний доступен только для дней рождения")
        
        # Only the event creator can update the wish list
        if event.get("created_by_user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Только создатель события может изменять список желаний")
        
        # Get existing birthday party data
        birthday_party_data = event.get("birthday_party_data", {}) or {}
        
        # Update the wish list (claims are preserved as they're stored by index)
        birthday_party_data["wish_list"] = wishlist_update.wishes
        
        # Update the event in database
        await db.academic_events.update_one(
            {"id": event_id},
            {
                "$set": {
                    "birthday_party_data": birthday_party_data,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "message": "Список желаний обновлён",
            "event_id": event_id,
            "wish_list": wishlist_update.wishes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journal/calendar/{event_id}/wishlist/claim")
async def claim_birthday_wish(
    event_id: str,
    claim_request: WishClaimRequest,
    current_user: User = Depends(get_current_user)
):
    """Claim a wish item from a birthday party wish list (invited guests only)"""
    try:
        # Get the event
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check if this is a birthday event
        if event.get("event_type") != "BIRTHDAY":
            raise HTTPException(status_code=400, detail="Только события дня рождения имеют список желаний")
        
        # Get birthday party data
        birthday_party_data = event.get("birthday_party_data", {}) or {}
        wish_list = birthday_party_data.get("wish_list", [])
        
        # Validate wish index
        if claim_request.wish_index < 0 or claim_request.wish_index >= len(wish_list):
            raise HTTPException(status_code=400, detail="Неверный индекс желания")
        
        # Initialize wish_claims if not exists
        wish_claims = birthday_party_data.get("wish_claims", {})
        if not isinstance(wish_claims, dict):
            wish_claims = {}
        
        wish_index_str = str(claim_request.wish_index)
        
        # Check if already claimed by someone else
        if wish_index_str in wish_claims:
            existing_claim = wish_claims[wish_index_str]
            if existing_claim.get("user_id") != current_user.id:
                claimer_name = existing_claim.get("user_name", "Кто-то")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Этот подарок уже выбран пользователем {claimer_name}"
                )
            else:
                # User is unclaiming their own claim
                del wish_claims[wish_index_str]
                action = "unclaimed"
        else:
            # Claim the wish
            wish_claims[wish_index_str] = {
                "user_id": current_user.id,
                "user_name": f"{current_user.first_name} {current_user.last_name}",
                "claimed_at": datetime.now(timezone.utc).isoformat()
            }
            action = "claimed"
        
        # Update birthday party data with claims
        birthday_party_data["wish_claims"] = wish_claims
        
        # Update the event
        await db.academic_events.update_one(
            {"id": event_id},
            {
                "$set": {
                    "birthday_party_data": birthday_party_data,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        wish_title = wish_list[claim_request.wish_index]
        
        return {
            "message": "Подарок выбран" if action == "claimed" else "Выбор отменён",
            "event_id": event_id,
            "wish_index": claim_request.wish_index,
            "wish_title": wish_title,
            "action": action,
            "claimed_by": wish_claims.get(wish_index_str) if action == "claimed" else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journal/calendar/{event_id}/wishlist")
async def get_event_wishlist(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get the wish list and claim status for a birthday event"""
    try:
        # Get the event
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check if this is a birthday event
        if event.get("event_type") != "BIRTHDAY":
            raise HTTPException(status_code=400, detail="Только события дня рождения имеют список желаний")
        
        # Get birthday party data
        birthday_party_data = event.get("birthday_party_data", {}) or {}
        wish_list = birthday_party_data.get("wish_list", [])
        wish_claims = birthday_party_data.get("wish_claims", {})
        
        # Build response with claim info
        wishes_with_status = []
        for idx, wish_title in enumerate(wish_list):
            claim_info = wish_claims.get(str(idx))
            is_claimed_by_me = claim_info and claim_info.get("user_id") == current_user.id
            
            wishes_with_status.append({
                "index": idx,
                "title": wish_title,
                "is_claimed": claim_info is not None,
                "is_claimed_by_me": is_claimed_by_me,
                "claimed_by_name": claim_info.get("user_name") if claim_info and not is_claimed_by_me else None,
                "claimed_at": claim_info.get("claimed_at") if claim_info else None
            })
        
        # Check if current user is the event creator
        is_creator = event.get("created_by_user_id") == current_user.id
        
        return {
            "event_id": event_id,
            "wishes": wishes_with_status,
            "total_wishes": len(wish_list),
            "claimed_count": len(wish_claims),
            "is_creator": is_creator,
            "can_edit": is_creator
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journal/organizations/{organization_id}/classmates")
async def get_classmates_for_invitation(
    organization_id: str,
    assigned_class: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get list of classmates for birthday party invitation selection.
    Returns students in the same class or organization for invitation purposes."""
    try:
        # Build query to find students in the organization
        query = {
            "organization_id": organization_id,
            "academic_status": "ACTIVE"
        }
        
        # If assigned_class is provided, filter by class
        if assigned_class:
            query["assigned_class"] = assigned_class
        
        # Get students from work_students collection
        students_cursor = db.work_students.find(query, {"_id": 0})
        students = await students_cursor.to_list(None)
        
        classmates = []
        for student in students:
            # Skip the current user's own children if they're a parent
            _parent_ids = student.get("parent_ids", [])
            
            classmate_info = {
                "id": student.get("id"),
                "student_id": student.get("student_id"),
                "first_name": student.get("first_name", ""),
                "last_name": student.get("last_name", ""),
                "full_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                "assigned_class": student.get("assigned_class"),
                "avatar_url": student.get("avatar_url"),
                "user_id": student.get("user_id")  # Linked user account if exists
            }
            classmates.append(classmate_info)
        
        # Sort by class and then by name
        classmates.sort(key=lambda x: (x.get("assigned_class") or "", x.get("last_name") or "", x.get("first_name") or ""))
        
        return {
            "organization_id": organization_id,
            "assigned_class": assigned_class,
            "classmates": classmates,
            "total_count": len(classmates)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/journal/calendar/{event_id}")
async def delete_academic_event(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an academic calendar event"""
    try:
        # Find the event
        event = await db.academic_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Verify user is the creator or a teacher at the organization
        if event["created_by_user_id"] != current_user.id:
            teacher = await db.teachers.find_one({
                "user_id": current_user.id,
                "organization_id": event["organization_id"]
            })
            if not teacher:
                raise HTTPException(status_code=403, detail="Нет прав на удаление события")
        
        # Soft delete - mark as inactive
        await db.academic_events.update_one(
            {"id": event_id},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "Событие удалено", "id": event_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# === JOURNAL POST INTERACTIONS (Likes & Comments) ===

@api_router.post("/journal/posts/{post_id}/like")
async def like_journal_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a journal post"""
    try:
        # Find the post
        post = await db.journal_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Пост не найден")
        
        # Check if user already liked
        existing_like = await db.journal_post_likes.find_one({
            "post_id": post_id,
            "user_id": current_user.id
        })
        
        if existing_like:
            # Unlike - remove the like
            await db.journal_post_likes.delete_one({
                "post_id": post_id,
                "user_id": current_user.id
            })
            await db.journal_posts.update_one(
                {"post_id": post_id},
                {"$inc": {"likes_count": -1}}
            )
            return {"liked": False, "likes_count": post.get("likes_count", 1) - 1}
        else:
            # Like - add the like
            like_doc = {
                "id": str(uuid.uuid4()),
                "post_id": post_id,
                "user_id": current_user.id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.journal_post_likes.insert_one(like_doc)
            await db.journal_posts.update_one(
                {"post_id": post_id},
                {"$inc": {"likes_count": 1}}
            )
            return {"liked": True, "likes_count": post.get("likes_count", 0) + 1}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journal/posts/{post_id}/comments")
async def create_journal_comment(
    post_id: str,
    content: str = Form(...),
    parent_comment_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a journal post"""
    try:
        # Find the post
        post = await db.journal_posts.find_one({"post_id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Пост не найден")
        
        # Create comment
        comment_id = str(uuid.uuid4())
        comment_doc = {
            "id": comment_id,
            "post_id": post_id,
            "author_id": current_user.id,
            "content": content,
            "parent_comment_id": parent_comment_id,
            "likes_count": 0,
            "is_edited": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.journal_post_comments.insert_one(comment_doc)
        
        # Increment comments count on post
        await db.journal_posts.update_one(
            {"post_id": post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Return the created comment with author info
        return {
            "id": comment_id,
            "content": content,
            "author": {
                "id": current_user.id,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "profile_picture": current_user.profile_picture
            },
            "likes_count": 0,
            "user_liked": False,
            "created_at": comment_doc["created_at"],
            "is_edited": False,
            "replies": []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/journal/posts/{post_id}/comments")
async def get_journal_comments(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get comments for a journal post"""
    try:
        # Get top-level comments
        comments_cursor = db.journal_post_comments.find({
            "post_id": post_id,
            "parent_comment_id": None
        }).sort("created_at", 1)
        
        comments = await comments_cursor.to_list(100)
        
        # Build response with nested replies
        result = []
        for comment in comments:
            author = await db.users.find_one({"id": comment["author_id"]})
            
            # Check if current user liked this comment
            user_liked = await db.journal_comment_likes.find_one({
                "comment_id": comment["id"],
                "user_id": current_user.id
            }) is not None
            
            # Get replies
            replies_cursor = db.journal_post_comments.find({
                "post_id": post_id,
                "parent_comment_id": comment["id"]
            }).sort("created_at", 1)
            replies = await replies_cursor.to_list(50)
            
            replies_result = []
            for reply in replies:
                reply_author = await db.users.find_one({"id": reply["author_id"]})
                reply_user_liked = await db.journal_comment_likes.find_one({
                    "comment_id": reply["id"],
                    "user_id": current_user.id
                }) is not None
                
                replies_result.append({
                    "id": reply["id"],
                    "content": reply["content"],
                    "author": {
                        "id": reply["author_id"],
                        "first_name": reply_author.get("first_name", "") if reply_author else "",
                        "last_name": reply_author.get("last_name", "") if reply_author else "",
                        "profile_picture": reply_author.get("profile_picture") if reply_author else None
                    },
                    "likes_count": reply.get("likes_count", 0),
                    "user_liked": reply_user_liked,
                    "created_at": reply["created_at"],
                    "is_edited": reply.get("is_edited", False),
                    "replies": []
                })
            
            result.append({
                "id": comment["id"],
                "content": comment["content"],
                "author": {
                    "id": comment["author_id"],
                    "first_name": author.get("first_name", "") if author else "",
                    "last_name": author.get("last_name", "") if author else "",
                    "profile_picture": author.get("profile_picture") if author else None
                },
                "likes_count": comment.get("likes_count", 0),
                "user_liked": user_liked,
                "created_at": comment["created_at"],
                "is_edited": comment.get("is_edited", False),
                "replies": replies_result
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/journal/comments/{comment_id}/like")
async def like_journal_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a journal comment"""
    try:
        # Find the comment
        comment = await db.journal_post_comments.find_one({"id": comment_id})
        if not comment:
            raise HTTPException(status_code=404, detail="Комментарий не найден")
        
        # Check if already liked
        existing_like = await db.journal_comment_likes.find_one({
            "comment_id": comment_id,
            "user_id": current_user.id
        })
        
        if existing_like:
            # Unlike
            await db.journal_comment_likes.delete_one({
                "comment_id": comment_id,
                "user_id": current_user.id
            })
            await db.journal_post_comments.update_one(
                {"id": comment_id},
                {"$inc": {"likes_count": -1}}
            )
            return {"liked": False}
        else:
            # Like
            await db.journal_comment_likes.insert_one({
                "id": str(uuid.uuid4()),
                "comment_id": comment_id,
                "user_id": current_user.id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.journal_post_comments.update_one(
                {"id": comment_id},
                {"$inc": {"likes_count": 1}}
            )
            return {"liked": True}
            
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
        
        # Create notification for the requesting user
        org = await db.work_organizations.find_one({"id": organization_id})
        org_name = org.get("name") if org else "организации"
        
        notification_title = "Запрос одобрен"
        notification_message = f"Ваш запрос на изменение роли в {org_name} был одобрен."
        
        if request["request_type"] == "ROLE_CHANGE":
            notification_message = f"Ваш запрос на изменение роли на '{request.get('requested_role')}' в {org_name} был одобрен."
            notification_type = NotificationType.ROLE_CHANGE_APPROVED
        elif request["request_type"] == "DEPARTMENT_CHANGE":
            notification_message = f"Ваш запрос на изменение отдела в {org_name} был одобрен."
            notification_type = NotificationType.DEPARTMENT_CHANGE_APPROVED
        elif request["request_type"] == "TEAM_CHANGE":
            notification_message = f"Ваш запрос на изменение команды в {org_name} был одобрен."
            notification_type = NotificationType.TEAM_CHANGE_APPROVED
        else:
            notification_type = NotificationType.ROLE_CHANGE_APPROVED
        
        notification = WorkNotification(
            user_id=request["user_id"],
            organization_id=organization_id,
            notification_type=notification_type,
            title=notification_title,
            message=notification_message,
            related_request_id=request_id
        )
        
        await db.work_notifications.insert_one(notification.model_dump())
        
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
        
        # Create notification for the requesting user
        org = await db.work_organizations.find_one({"id": organization_id})
        org_name = org.get("name") if org else "организации"
        
        notification_title = "Запрос отклонён"
        notification_message = f"Ваш запрос на изменение в {org_name} был отклонён."
        
        if rejection_reason:
            notification_message += f" Причина: {rejection_reason}"
        
        if request["request_type"] == "ROLE_CHANGE":
            notification_message = f"Ваш запрос на изменение роли в {org_name} был отклонён."
            if rejection_reason:
                notification_message += f" Причина: {rejection_reason}"
            notification_type = NotificationType.ROLE_CHANGE_REJECTED
        elif request["request_type"] == "DEPARTMENT_CHANGE":
            notification_message = f"Ваш запрос на изменение отдела в {org_name} был отклонён."
            if rejection_reason:
                notification_message += f" Причина: {rejection_reason}"
            notification_type = NotificationType.DEPARTMENT_CHANGE_REJECTED
        elif request["request_type"] == "TEAM_CHANGE":
            notification_message = f"Ваш запрос на изменение команды в {org_name} был отклонён."
            if rejection_reason:
                notification_message += f" Причина: {rejection_reason}"
            notification_type = NotificationType.TEAM_CHANGE_REJECTED
        else:
            notification_type = NotificationType.ROLE_CHANGE_REJECTED
        
        notification = WorkNotification(
            user_id=request["user_id"],
            organization_id=organization_id,
            notification_type=notification_type,
            title=notification_title,
            message=notification_message,
            related_request_id=request_id
        )
        
        await db.work_notifications.insert_one(notification.model_dump())
        
        return {"success": True, "message": "Запрос отклонен"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === WORK NOTIFICATION ENDPOINTS ===

@api_router.get("/work/notifications")
async def get_user_notifications(
    current_user: User = Depends(get_current_user),
    unread_only: bool = False,
    limit: int = 50
):
    """Get notifications for the current user"""
    try:
        query = {"user_id": current_user.id}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.work_notifications.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        # Enrich notifications with organization names
        notification_responses = []
        for notif in notifications:
            org = await db.work_organizations.find_one({"id": notif["organization_id"]})
            notification_responses.append(
                WorkNotificationResponse(
                    **notif,
                    organization_name=org.get("name") if org else None
                )
            )
        
        return {"success": True, "notifications": notification_responses}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/work/notifications/{notification_id}/read")
async def mark_work_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a work notification as read"""
    try:
        result = await db.work_notifications.update_one(
            {"id": notification_id, "user_id": current_user.id},
            {"$set": {"is_read": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/work/notifications/read-all")
async def mark_all_work_notifications_read(
    current_user: User = Depends(get_current_user)
):
    """Mark all work notifications as read for current user"""
    try:
        result = await db.work_notifications.update_many(
            {"user_id": current_user.id, "is_read": False},
            {"$set": {"is_read": True}}
        )
        
        return {
            "success": True,
            "message": f"Marked {result.modified_count} notifications as read"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === WORK ORGANIZATION EVENT ENDPOINTS ===

@api_router.post("/work/organizations/{organization_id}/events")
async def create_organization_event(
    organization_id: str,
    event_data: WorkOrganizationEventCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new organization event (all members can create)"""
    try:
        # Verify user is a member of the organization
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Create event - exclude scheduled_date from dump and convert it separately
        event_dict = event_data.model_dump(exclude={'scheduled_date'})
        new_event = WorkOrganizationEvent(
            organization_id=organization_id,
            created_by_user_id=current_user.id,
            scheduled_date=datetime.fromisoformat(event_data.scheduled_date),
            **event_dict
        )
        
        await db.work_organization_events.insert_one(new_event.model_dump())
        
        # Get organization details for notification
        org = await db.work_organizations.find_one({"id": organization_id})
        org_name = org.get("name") if org else "организации"
        
        # Create notifications for members based on visibility
        members_to_notify = []
        
        if event_data.visibility == WorkEventVisibility.ALL_MEMBERS:
            # Notify all organization members except creator
            all_members = await db.work_members.find({
                "organization_id": organization_id,
                "status": "ACTIVE"
            }).to_list(length=None)
            members_to_notify = [m["user_id"] for m in all_members if m["user_id"] != current_user.id]
        
        elif event_data.visibility == WorkEventVisibility.DEPARTMENT and event_data.department_id:
            # Notify department members
            dept_members = await db.work_members.find({
                "organization_id": organization_id,
                "department": event_data.department_id,
                "status": "ACTIVE"
            }).to_list(length=None)
            members_to_notify = [m["user_id"] for m in dept_members if m["user_id"] != current_user.id]
        
        elif event_data.visibility == WorkEventVisibility.TEAM and event_data.team_id:
            # Notify team members
            team_members = await db.work_members.find({
                "organization_id": organization_id,
                "team": event_data.team_id,
                "status": "ACTIVE"
            }).to_list(length=None)
            members_to_notify = [m["user_id"] for m in team_members if m["user_id"] != current_user.id]
        
        elif event_data.visibility == WorkEventVisibility.ADMINS_ONLY:
            # Notify admins only
            admin_members = await db.work_members.find({
                "organization_id": organization_id,
                "is_admin": True,
                "status": "ACTIVE"
            }).to_list(length=None)
            members_to_notify = [m["user_id"] for m in admin_members if m["user_id"] != current_user.id]
        
        # Create notifications
        event_date_str = datetime.fromisoformat(event_data.scheduled_date).strftime('%d.%m.%Y')
        if event_data.scheduled_time:
            event_date_str += f" в {event_data.scheduled_time}"
        
        for user_id in members_to_notify:
            notification = WorkNotification(
                user_id=user_id,
                organization_id=organization_id,
                notification_type=NotificationType.EVENT_CREATED,
                title="Новое событие",
                message=f"Создано событие '{event_data.title}' в {org_name} на {event_date_str}",
                related_request_id=new_event.id
            )
            await db.work_notifications.insert_one(notification.model_dump())
        
        return {"success": True, "message": "Событие создано", "event_id": new_event.id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/events")
async def get_organization_events(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    upcoming_only: bool = True,
    event_type: Optional[str] = None,
    department_id: Optional[str] = None,
    team_id: Optional[str] = None
):
    """Get organization events with filters"""
    try:
        # Verify user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Build query
        query = {"organization_id": organization_id, "is_cancelled": False}
        
        if upcoming_only:
            query["scheduled_date"] = {"$gte": datetime.now(timezone.utc)}
        
        if event_type:
            query["event_type"] = event_type
        
        if department_id:
            query["department_id"] = department_id
        
        if team_id:
            query["team_id"] = team_id
        
        # Filter by visibility (user can only see events they're allowed to)
        # Simplified for now - show all events to organization members
        final_query = {
            **query,
            "$or": [
                {"visibility": "ALL_MEMBERS"},
                {"created_by_user_id": current_user.id}
            ]
        }
        
        # Fetch events
        events = await db.work_organization_events.find(final_query).sort("scheduled_date", 1).to_list(length=100)
        
        # Enrich events with additional data
        event_responses = []
        for event in events:
            # Get creator name
            creator = await db.users.find_one({"id": event["created_by_user_id"]})
            creator_name = f"{creator['first_name']} {creator['last_name']}" if creator else "Неизвестно"
            
            # Get department/team names
            dept_name = None
            team_name = None
            
            if event.get("department_id"):
                dept = await db.work_departments.find_one({"id": event["department_id"]})
                dept_name = dept.get("name") if dept else None
            
            if event.get("team_id"):
                team = await db.work_teams.find_one({"id": event["team_id"]})
                team_name = team.get("name") if team else None
            
            # Calculate RSVP summary
            rsvp_responses = event.get("rsvp_responses", {})
            rsvp_summary = {
                "GOING": sum(1 for status in rsvp_responses.values() if status == "GOING"),
                "MAYBE": sum(1 for status in rsvp_responses.values() if status == "MAYBE"),
                "NOT_GOING": sum(1 for status in rsvp_responses.values() if status == "NOT_GOING")
            }
            
            user_rsvp_status = rsvp_responses.get(current_user.id)
            
            # Create response object (exclude MongoDB _id)
            event_data = {
                "id": event.get("id"),
                "organization_id": event.get("organization_id"),
                "created_by_user_id": event.get("created_by_user_id"),
                "title": event.get("title"),
                "description": event.get("description"),
                "event_type": event.get("event_type"),
                "scheduled_date": event.get("scheduled_date"),
                "scheduled_time": event.get("scheduled_time"),
                "end_time": event.get("end_time"),
                "location": event.get("location"),
                "department_id": event.get("department_id"),
                "team_id": event.get("team_id"),
                "visibility": event.get("visibility"),
                "rsvp_enabled": event.get("rsvp_enabled", False),
                "rsvp_responses": event.get("rsvp_responses", {}),
                "color_code": event.get("color_code", "#ea580c"),
                "is_cancelled": event.get("is_cancelled", False),
                "cancelled_reason": event.get("cancelled_reason"),
                "reminder_intervals": event.get("reminder_intervals", []),
                "reminders_sent": event.get("reminders_sent", {}),
                "created_at": event.get("created_at"),
                "updated_at": event.get("updated_at"),
                "created_by_name": creator_name,
                "department_name": dept_name,
                "team_name": team_name,
                "rsvp_summary": rsvp_summary,
                "user_rsvp_status": user_rsvp_status
            }
            
            event_responses.append(event_data)
        
        return {"success": True, "events": event_responses}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/events/{event_id}")
async def get_organization_event(
    organization_id: str,
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get single event details"""
    try:
        # Verify membership
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Get event
        event = await db.work_organization_events.find_one({"id": event_id, "organization_id": organization_id})
        
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Enrich with additional data (same as list endpoint)
        creator = await db.users.find_one({"id": event["created_by_user_id"]})
        creator_name = f"{creator['first_name']} {creator['last_name']}" if creator else "Неизвестно"
        
        dept_name = None
        team_name = None
        
        if event.get("department_id"):
            dept = await db.work_departments.find_one({"id": event["department_id"]})
            dept_name = dept.get("name") if dept else None
        
        if event.get("team_id"):
            team = await db.work_teams.find_one({"id": event["team_id"]})
            team_name = team.get("name") if team else None
        
        rsvp_responses = event.get("rsvp_responses", {})
        rsvp_summary = {
            "GOING": sum(1 for status in rsvp_responses.values() if status == "GOING"),
            "MAYBE": sum(1 for status in rsvp_responses.values() if status == "MAYBE"),
            "NOT_GOING": sum(1 for status in rsvp_responses.values() if status == "NOT_GOING")
        }
        
        user_rsvp_status = rsvp_responses.get(current_user.id)
        
        # Remove MongoDB _id before creating response
        event_clean = {k: v for k, v in event.items() if k != '_id'}
        
        event_response = WorkOrganizationEventResponse(
            **event_clean,
            created_by_name=creator_name,
            department_name=dept_name,
            team_name=team_name,
            rsvp_summary=rsvp_summary,
            user_rsvp_status=user_rsvp_status
        )
        
        return {"success": True, "event": event_response}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/work/organizations/{organization_id}/events/{event_id}")
async def update_organization_event(
    organization_id: str,
    event_id: str,
    event_update: WorkOrganizationEventUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an event (creator or admin only)"""
    try:
        # Get event
        event = await db.work_organization_events.find_one({"id": event_id, "organization_id": organization_id})
        
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check permissions (creator or admin)
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        is_creator = event["created_by_user_id"] == current_user.id
        is_admin = membership.get("is_admin", False)
        
        if not (is_creator or is_admin):
            raise HTTPException(status_code=403, detail="Только создатель или админ могут обновить событие")
        
        # Build update
        update_data = {k: v for k, v in event_update.model_dump().items() if v is not None}
        
        if "scheduled_date" in update_data:
            update_data["scheduled_date"] = datetime.fromisoformat(update_data["scheduled_date"])
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Update event
        await db.work_organization_events.update_one(
            {"id": event_id},
            {"$set": update_data}
        )
        
        # Send update notification if significant change
        if any(k in update_data for k in ["title", "scheduled_date", "scheduled_time", "location", "is_cancelled"]):
            org = await db.work_organizations.find_one({"id": organization_id})
            org_name = org.get("name") if org else "организации"
            
            # Get all members who had RSVP'd
            rsvp_user_ids = list(event.get("rsvp_responses", {}).keys())
            
            if event_update.is_cancelled:
                notif_message = f"Событие '{event['title']}' в {org_name} было отменено."
                if event_update.cancelled_reason:
                    notif_message += f" Причина: {event_update.cancelled_reason}"
                notif_type = NotificationType.EVENT_CANCELLED
            else:
                notif_message = f"Событие '{event['title']}' в {org_name} было обновлено."
                notif_type = NotificationType.EVENT_UPDATED
            
            for user_id in rsvp_user_ids:
                if user_id != current_user.id:
                    notification = WorkNotification(
                        user_id=user_id,
                        organization_id=organization_id,
                        notification_type=notif_type,
                        title="Событие обновлено" if not event_update.is_cancelled else "Событие отменено",
                        message=notif_message,
                        related_request_id=event_id
                    )
                    await db.work_notifications.insert_one(notification.model_dump())
        
        return {"success": True, "message": "Событие обновлено"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/organizations/{organization_id}/events/{event_id}")
async def delete_organization_event(
    organization_id: str,
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an event (creator or admin only)"""
    try:
        # Get event
        event = await db.work_organization_events.find_one({"id": event_id, "organization_id": organization_id})
        
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        is_creator = event["created_by_user_id"] == current_user.id
        is_admin = membership.get("is_admin", False)
        
        if not (is_creator or is_admin):
            raise HTTPException(status_code=403, detail="Только создатель или админ могут удалить событие")
        
        # Delete event
        await db.work_organization_events.delete_one({"id": event_id})
        
        return {"success": True, "message": "Событие удалено"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/events/{event_id}/rsvp")
async def rsvp_to_work_event(
    organization_id: str,
    event_id: str,
    rsvp_data: WorkEventRSVP,
    current_user: User = Depends(get_current_user)
):
    """RSVP to a work event"""
    try:
        # Verify membership
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Get event
        event = await db.work_organization_events.find_one({"id": event_id, "organization_id": organization_id})
        
        if not event:
            raise HTTPException(status_code=404, detail="Событие не найдено")
        
        if not event.get("rsvp_enabled", False):
            raise HTTPException(status_code=400, detail="RSVP не включен для этого события")
        
        # Update RSVP
        await db.work_organization_events.update_one(
            {"id": event_id},
            {"$set": {f"rsvp_responses.{current_user.id}": rsvp_data.response.value}}
        )
        
        return {"success": True, "message": "RSVP обновлен"}
        
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

# ===== EVENT REMINDERS SYSTEM =====

async def check_and_send_event_reminders():
    """
    Background task to check upcoming events and send reminders.
    Should be called periodically (e.g., every 5 minutes via cron or scheduler)
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Get all upcoming events that have reminders configured
        events_cursor = db.work_organization_events.find({
            "scheduled_date": {"$gte": now},
            "is_cancelled": False,
            "reminder_intervals": {"$exists": True, "$ne": []}
        })
        
        events = await events_cursor.to_list(length=None)
        
        for event in events:
            event_time = event['scheduled_date']
            
            # Check each reminder interval
            for interval in event.get('reminder_intervals', []):
                # Calculate when this reminder should be sent
                if interval == "15_MINUTES":
                    reminder_time = event_time - timedelta(minutes=15)
                    interval_key = "15_MINUTES"
                elif interval == "1_HOUR":
                    reminder_time = event_time - timedelta(hours=1)
                    interval_key = "1_HOUR"
                elif interval == "1_DAY":
                    reminder_time = event_time - timedelta(days=1)
                    interval_key = "1_DAY"
                else:
                    continue
                
                # Check if it's time to send this reminder (within 5-minute window)
                time_diff = (now - reminder_time).total_seconds()
                
                # If within 5-minute window and not already sent
                if -300 <= time_diff <= 300:  # 5 minutes before and after
                    reminders_sent = event.get('reminders_sent', {})
                    
                    if interval_key not in reminders_sent:
                        # Get participants who should receive reminder
                        participants = await get_event_participants(event)
                        
                        # Send notifications
                        for user_id in participants:
                            await create_event_reminder_notification(
                                user_id=user_id,
                                event=event,
                                interval=interval_key
                            )
                        
                        # Mark reminder as sent
                        if interval_key not in reminders_sent:
                            reminders_sent[interval_key] = []
                        reminders_sent[interval_key].extend(participants)
                        
                        # Update event
                        await db.work_organization_events.update_one(
                            {"id": event['id']},
                            {"$set": {"reminders_sent": reminders_sent}}
                        )
                        
                        print(f"✓ Sent {interval_key} reminder for event: {event['title']}")
        
    except Exception as e:
        print(f"Error in check_and_send_event_reminders: {str(e)}")


async def get_event_participants(event: dict) -> List[str]:
    """
    Get list of user IDs who should receive reminder for this event.
    Returns users who RSVPed GOING or MAYBE (or all members if RSVP not enabled)
    """
    participants = []
    
    if event.get('rsvp_enabled'):
        # Get users who responded GOING or MAYBE
        rsvp_responses = event.get('rsvp_responses', {})
        for user_id, response in rsvp_responses.items():
            if response in ['GOING', 'MAYBE']:
                participants.append(user_id)
    else:
        # Get all organization members based on visibility
        if event['visibility'] == 'ALL_MEMBERS':
            members_cursor = db.work_members.find({
                "organization_id": event['organization_id'],
                "status": "ACTIVE"
            })
            members = await members_cursor.to_list(length=None)
            participants = [m['user_id'] for m in members]
            
        elif event['visibility'] == 'DEPARTMENT' and event.get('department_id'):
            members_cursor = db.work_members.find({
                "organization_id": event['organization_id'],
                "department_id": event['department_id'],
                "status": "ACTIVE"
            })
            members = await members_cursor.to_list(length=None)
            participants = [m['user_id'] for m in members]
            
        elif event['visibility'] == 'TEAM' and event.get('team_id'):
            # Get team members
            team_members_cursor = db.work_team_members.find({
                "team_id": event['team_id']
            })
            team_members = await team_members_cursor.to_list(length=None)
            participants = [tm['user_id'] for tm in team_members]
    
    return participants


async def create_event_reminder_notification(user_id: str, event: dict, interval: str):
    """Create in-app notification for event reminder"""
    try:
        # Format time remaining message
        if interval == "15_MINUTES":
            time_msg = "через 15 минут"
        elif interval == "1_HOUR":
            time_msg = "через 1 час"
        elif interval == "1_DAY":
            time_msg = "завтра"
        else:
            time_msg = "скоро"
        
        # Get organization name
        org = await db.work_organizations.find_one({"id": event['organization_id']})
        org_name = org.get('name', 'организации') if org else 'организации'
        
        # Create notification
        notification = {
            "id": str(uuid.uuid4()),
            "organization_id": event['organization_id'],
            "user_id": user_id,
            "type": "EVENT_REMINDER",
            "title": "Напоминание о событии",
            "message": f"Событие \"{event['title']}\" начнется {time_msg}",
            "metadata": {
                "event_id": event['id'],
                "event_title": event['title'],
                "event_time": event.get('scheduled_time', ''),
                "location": event.get('location', ''),
                "organization_name": org_name,
                "interval": interval
            },
            "is_read": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.work_notifications.insert_one(notification)
        print(f"✓ Created reminder notification for user {user_id}")
        
    except Exception as e:
        print(f"Error creating reminder notification: {str(e)}")


@api_router.post("/work/events/check-reminders")
async def trigger_reminder_check(current_user: User = Depends(get_current_user)):
    """
    Manually trigger reminder check (for testing or cron job).
    In production, this should be called by a scheduler every 5 minutes.
    """
    await check_and_send_event_reminders()
    return {"success": True, "message": "Reminder check completed"}


@api_router.post("/internal/check-reminders")
async def internal_reminder_check(request: Request):
    """
    Internal endpoint for cron job (no auth required, localhost only).
    This is called by the cron script every 5 minutes.
    """
    # Security: Only allow calls from localhost
    client_host = request.client.host
    if client_host not in ["127.0.0.1", "localhost", "::1"]:
        raise HTTPException(status_code=403, detail="Access denied: Internal endpoint only")
    
    # Verify internal request header
    internal_header = request.headers.get("X-Internal-Request")
    if internal_header != "true":
        raise HTTPException(status_code=403, detail="Access denied: Missing internal header")
    
    try:
        await check_and_send_event_reminders()
        return {
            "success": True,
            "message": "Reminder check completed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# ===== END EVENT REMINDERS SYSTEM =====

# ===== WORK TASK MANAGEMENT ENDPOINTS =====

def calculate_time_remaining(deadline: datetime) -> tuple:
    """Calculate time remaining until deadline"""
    if not deadline:
        return None, False
    
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    
    diff = deadline - now
    is_overdue = diff.total_seconds() < 0
    
    if is_overdue:
        return "Просрочено", True
    
    days = diff.days
    hours = diff.seconds // 3600
    minutes = (diff.seconds % 3600) // 60
    
    if days > 0:
        return f"{days}д {hours}ч", False
    elif hours > 0:
        return f"{hours}ч {minutes}м", False
    else:
        return f"{minutes}м", False

async def build_task_response(task: dict, current_user_id: str) -> dict:
    """Build a complete task response with all related data"""
    # Get creator info
    creator = await db.users.find_one({"id": task["created_by"]}, {"_id": 0})
    
    # Get assigned user info
    assigned_user = None
    if task.get("assigned_to"):
        assigned_user = await db.users.find_one({"id": task["assigned_to"]}, {"_id": 0})
    
    # Get accepted by user info
    accepted_user = None
    if task.get("accepted_by"):
        accepted_user = await db.users.find_one({"id": task["accepted_by"]}, {"_id": 0})
    
    # Get completed by user info
    completed_user = None
    if task.get("completed_by"):
        completed_user = await db.users.find_one({"id": task["completed_by"]}, {"_id": 0})
    
    # Get team info
    team = None
    if task.get("team_id"):
        team = await db.work_teams.find_one({"id": task["team_id"]}, {"_id": 0})
    
    # Get department info
    department = None
    if task.get("department_id"):
        department = await db.work_departments.find_one({"id": task["department_id"]}, {"_id": 0})
    
    # Calculate time remaining
    time_remaining, is_overdue = calculate_time_remaining(task.get("deadline"))
    
    # Calculate subtask progress
    subtasks = task.get("subtasks", [])
    subtasks_completed = sum(1 for s in subtasks if s.get("is_completed"))
    
    # Determine permissions
    is_creator = task["created_by"] == current_user_id
    is_assigned = task.get("assigned_to") == current_user_id
    is_accepted = task.get("accepted_by") == current_user_id
    
    # Check if user is in the assigned team or department
    membership = await db.work_members.find_one({
        "organization_id": task["organization_id"],
        "user_id": current_user_id,
        "status": "ACTIVE"
    })
    
    is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"] if membership else False
    is_in_team = membership and membership.get("team_id") == task.get("team_id") if task.get("team_id") else False
    is_in_dept = membership and membership.get("department") == task.get("department_id") if task.get("department_id") else False
    
    can_accept = (
        task["status"] == "NEW" and
        not task.get("accepted_by") and
        task["assignment_type"] in ["TEAM", "DEPARTMENT"] and
        (is_in_team or is_in_dept or is_admin)
    )
    
    can_complete = (
        task["status"] in ["ACCEPTED", "IN_PROGRESS", "REVIEW"] and
        (is_assigned or is_accepted or is_creator or is_admin)
    )
    
    return {
        "id": task["id"],
        "organization_id": task["organization_id"],
        "created_by": task["created_by"],
        "created_by_name": f"{creator['first_name']} {creator['last_name']}" if creator else "Unknown",
        "created_by_avatar": creator.get("profile_picture") if creator else None,
        
        "title": task["title"],
        "description": task.get("description"),
        
        "assignment_type": task["assignment_type"],
        "assigned_to": task.get("assigned_to"),
        "assigned_to_name": f"{assigned_user['first_name']} {assigned_user['last_name']}" if assigned_user else None,
        "assigned_to_avatar": assigned_user.get("profile_picture") if assigned_user else None,
        "team_id": task.get("team_id"),
        "team_name": team["name"] if team else None,
        "department_id": task.get("department_id"),
        "department_name": department["name"] if department else None,
        "accepted_by": task.get("accepted_by"),
        "accepted_by_name": f"{accepted_user['first_name']} {accepted_user['last_name']}" if accepted_user else None,
        "accepted_at": task.get("accepted_at"),
        
        "status": task["status"],
        "priority": task["priority"],
        "deadline": task.get("deadline"),
        "time_remaining": time_remaining,
        "is_overdue": is_overdue,
        
        "subtasks": subtasks,
        "subtasks_completed": subtasks_completed,
        "subtasks_total": len(subtasks),
        
        "requires_photo_proof": task.get("requires_photo_proof", False),
        "completion_photos": task.get("completion_photos", []),
        "completion_note": task.get("completion_note"),
        "completed_at": task.get("completed_at"),
        "completed_by": task.get("completed_by"),
        "completed_by_name": f"{completed_user['first_name']} {completed_user['last_name']}" if completed_user else None,
        
        "discussion_post_id": task.get("discussion_post_id"),
        "completion_post_id": task.get("completion_post_id"),
        
        "is_template": task.get("is_template", False),
        "template_name": task.get("template_name"),
        
        "created_at": task["created_at"],
        "updated_at": task["updated_at"],
        
        "can_edit": is_creator or is_admin,
        "can_delete": is_creator or is_admin,
        "can_accept": can_accept,
        "can_complete": can_complete
    }

@api_router.post("/work/organizations/{organization_id}/tasks")
async def create_task(
    organization_id: str,
    task_data: WorkTaskCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new task in the organization"""
    try:
        # Verify user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # If creating from template
        template_data = {}
        if task_data.template_id:
            template = await db.work_task_templates.find_one({
                "id": task_data.template_id,
                "organization_id": organization_id,
                "is_active": True
            })
            if template:
                template_data = {
                    "description": template.get("description"),
                    "priority": template.get("priority", "MEDIUM"),
                    "requires_photo_proof": template.get("requires_photo_proof", False),
                    "created_from_template_id": template["id"]
                }
        
        # Build subtasks
        subtasks = []
        subtask_titles = task_data.subtasks or (template_data.get("subtasks") if template_data else [])
        for title in subtask_titles:
            subtasks.append({
                "id": str(uuid.uuid4()),
                "title": title,
                "is_completed": False
            })
        
        # Create task
        new_task = WorkTask(
            organization_id=organization_id,
            created_by=current_user.id,
            title=task_data.title,
            description=task_data.description or template_data.get("description"),
            assignment_type=task_data.assignment_type,
            assigned_to=task_data.assigned_to,
            team_id=task_data.team_id,
            department_id=task_data.department_id,
            priority=task_data.priority or template_data.get("priority", TaskPriority.MEDIUM),
            deadline=datetime.fromisoformat(task_data.deadline) if task_data.deadline else None,
            subtasks=subtasks,
            requires_photo_proof=task_data.requires_photo_proof or template_data.get("requires_photo_proof", False),
            created_from_template_id=template_data.get("created_from_template_id")
        )
        
        # If assigned to specific user, set status to ACCEPTED
        if task_data.assignment_type == TaskAssignmentType.USER and task_data.assigned_to:
            new_task.status = TaskStatus.ACCEPTED
            new_task.accepted_by = task_data.assigned_to
            new_task.accepted_at = datetime.now(timezone.utc)
        
        # If personal task, auto-accept
        if task_data.assignment_type == TaskAssignmentType.PERSONAL:
            new_task.assigned_to = current_user.id
            new_task.accepted_by = current_user.id
            new_task.accepted_at = datetime.now(timezone.utc)
            new_task.status = TaskStatus.ACCEPTED
        
        await db.work_tasks.insert_one(new_task.model_dump())
        
        # Save as template if requested
        if task_data.save_as_template and task_data.template_name:
            template = WorkTaskTemplate(
                organization_id=organization_id,
                created_by=current_user.id,
                name=task_data.template_name,
                title=task_data.title,
                description=task_data.description,
                priority=task_data.priority,
                subtasks=task_data.subtasks,
                requires_photo_proof=task_data.requires_photo_proof,
                default_assignment_type=task_data.assignment_type
            )
            await db.work_task_templates.insert_one(template.model_dump())
        
        # Send notification to assigned user
        if task_data.assigned_to and task_data.assigned_to != current_user.id:
            _org = await db.work_organizations.find_one({"id": organization_id})
            notification = WorkNotification(
                user_id=task_data.assigned_to,
                organization_id=organization_id,
                notification_type="TASK_ASSIGNED",
                title="Новая задача",
                message=f"Вам назначена задача: {task_data.title}",
                related_entity_type="task",
                related_entity_id=new_task.id
            )
            await db.work_notifications.insert_one(notification.model_dump())
        
        # Build and return response
        task_dict = new_task.model_dump()
        response = await build_task_response(task_dict, current_user.id)
        
        return {"task": response}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/tasks")
async def get_organization_tasks(
    organization_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignment_type: Optional[str] = None,
    assigned_to_me: bool = False,
    created_by_me: bool = False,
    include_completed: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get tasks for an organization with filters"""
    try:
        # Verify user is a member
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Build query
        query = {
            "organization_id": organization_id,
            "is_deleted": {"$ne": True},
            "is_template": {"$ne": True}
        }
        
        if status:
            query["status"] = status
        elif not include_completed:
            query["status"] = {"$ne": "DONE"}
        
        if priority:
            query["priority"] = priority
        
        if assignment_type:
            query["assignment_type"] = assignment_type
        
        if assigned_to_me:
            query["$or"] = [
                {"assigned_to": current_user.id},
                {"accepted_by": current_user.id}
            ]
        
        if created_by_me:
            query["created_by"] = current_user.id
        
        # Fetch tasks
        tasks = await db.work_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Build responses
        task_responses = []
        for task in tasks:
            response = await build_task_response(task, current_user.id)
            task_responses.append(response)
        
        return {"tasks": task_responses}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/tasks/my-tasks")
async def get_my_tasks(
    include_completed: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Get all tasks assigned to or created by current user across all organizations"""
    try:
        query = {
            "is_deleted": {"$ne": True},
            "is_template": {"$ne": True},
            "$or": [
                {"assigned_to": current_user.id},
                {"accepted_by": current_user.id},
                {"created_by": current_user.id}
            ]
        }
        
        if not include_completed:
            query["status"] = {"$ne": "DONE"}
        
        tasks = await db.work_tasks.find(query, {"_id": 0}).sort("deadline", 1).to_list(100)
        
        task_responses = []
        for task in tasks:
            response = await build_task_response(task, current_user.id)
            task_responses.append(response)
        
        return {"tasks": task_responses}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/tasks/calendar")
async def get_tasks_for_calendar(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    status_filter: Optional[str] = None,  # ALL, ACTIVE, COMPLETED
    priority_filter: Optional[str] = None,  # ALL, URGENT, HIGH, MEDIUM, LOW
    assignment_filter: Optional[str] = None,  # ALL, MY, TEAM, CREATED
    current_user: User = Depends(get_current_user)
):
    """Get all tasks for calendar view across user's organizations"""
    try:
        # Get user's organizations
        memberships = await db.work_organization_members.find({
            "user_id": current_user.id,
            "status": "ACTIVE"
        }, {"_id": 0}).to_list(100)
        
        org_ids = [m["organization_id"] for m in memberships]
        
        if not org_ids:
            return {"tasks": [], "month": month, "year": year, "total_count": 0}
        
        # Calculate date range for the month (naive datetimes for MongoDB compatibility)
        from calendar import monthrange
        days_in_month = monthrange(year, month)[1]
        start_date = datetime(year, month, 1, 0, 0, 0)
        end_date = datetime(year, month, days_in_month, 23, 59, 59)
        
        # Base query
        query = {
            "organization_id": {"$in": org_ids},
            "is_deleted": {"$ne": True},
            "is_template": {"$ne": True},
            "$or": [
                # Tasks with deadlines in this month
                {"deadline": {"$gte": start_date, "$lte": end_date}},
                # Tasks created in this month
                {"created_at": {"$gte": start_date, "$lte": end_date}}
            ]
        }
        
        # Apply status filter
        if status_filter and status_filter != "ALL":
            if status_filter == "ACTIVE":
                query["status"] = {"$ne": "DONE"}
            elif status_filter == "COMPLETED":
                query["status"] = "DONE"
        
        # Apply priority filter
        if priority_filter and priority_filter != "ALL":
            query["priority"] = priority_filter
        
        # Apply assignment filter
        if assignment_filter and assignment_filter != "ALL":
            if assignment_filter == "MY":
                query["$or"] = [
                    {"assigned_to": current_user.id},
                    {"accepted_by": current_user.id}
                ]
            elif assignment_filter == "TEAM":
                query["assignment_type"] = {"$in": ["TEAM", "DEPARTMENT"]}
            elif assignment_filter == "CREATED":
                query["created_by"] = current_user.id
        
        # Fetch tasks
        tasks = await db.work_tasks.find(query, {"_id": 0}).to_list(500)
        
        # Build calendar task responses
        calendar_tasks = []
        for task in tasks:
            # Get creator info
            creator = await db.users.find_one({"id": task["created_by"]}, {"_id": 0})
            
            # Get assignee info if assigned
            assignee = None
            if task.get("assigned_to"):
                assignee = await db.users.find_one({"id": task["assigned_to"]}, {"_id": 0})
            elif task.get("accepted_by"):
                assignee = await db.users.find_one({"id": task["accepted_by"]}, {"_id": 0})
            
            # Get organization info
            org = await db.work_organizations.find_one({"id": task["organization_id"]}, {"_id": 0})
            
            # Check if task is overdue (handle both naive and aware datetimes)
            is_overdue = False
            if task.get("deadline") and task.get("status") != "DONE":
                deadline = task.get("deadline")
                now = datetime.now()
                # Make comparison timezone-naive
                if hasattr(deadline, 'tzinfo') and deadline.tzinfo is not None:
                    deadline = deadline.replace(tzinfo=None)
                is_overdue = deadline < now
            
            calendar_task = {
                "id": task["id"],
                "title": task["title"],
                "description": task.get("description"),
                "organization_id": task["organization_id"],
                "organization_name": org.get("name") if org else "Unknown",
                "status": task.get("status", "NEW"),
                "priority": task.get("priority", "MEDIUM"),
                "assignment_type": task.get("assignment_type", "PERSONAL"),
                
                # Dates for calendar display
                "created_at": task.get("created_at").isoformat() if task.get("created_at") else None,
                "deadline": task.get("deadline").isoformat() if task.get("deadline") else None,
                "completed_at": task.get("completed_at").isoformat() if task.get("completed_at") else None,
                
                # Creator info
                "created_by": task["created_by"],
                "created_by_name": f"{creator.get('first_name', '')} {creator.get('last_name', '')}".strip() if creator else "Unknown",
                
                # Assignee info
                "assignee_id": assignee.get("id") if assignee else None,
                "assignee_name": f"{assignee.get('first_name', '')} {assignee.get('last_name', '')}".strip() if assignee else None,
                
                # Progress
                "subtasks_total": len(task.get("subtasks", [])),
                "subtasks_completed": len([s for s in task.get("subtasks", []) if s.get("is_completed")]),
                
                # Flags
                "requires_photo_proof": task.get("requires_photo_proof", False),
                "is_overdue": is_overdue
            }
            calendar_tasks.append(calendar_task)
        
        return {
            "tasks": calendar_tasks,
            "month": month,
            "year": year,
            "total_count": len(calendar_tasks)
        }
        
    except Exception as e:
        logger.error(f"Error fetching calendar tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/tasks/{task_id}")
async def get_task(
    organization_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific task by ID"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        }, {"_id": 0})
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        response = await build_task_response(task, current_user.id)
        return {"task": response}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/work/organizations/{organization_id}/tasks/{task_id}")
async def update_task(
    organization_id: str,
    task_id: str,
    update_data: WorkTaskUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a task"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"]
        is_creator = task["created_by"] == current_user.id
        
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Нет прав на редактирование задачи")
        
        # Build update
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        
        if "deadline" in update_dict and update_dict["deadline"]:
            update_dict["deadline"] = datetime.fromisoformat(update_dict["deadline"])
        
        update_dict["updated_at"] = datetime.now(timezone.utc)
        
        await db.work_tasks.update_one(
            {"id": task_id},
            {"$set": update_dict}
        )
        
        updated_task = await db.work_tasks.find_one({"id": task_id}, {"_id": 0})
        response = await build_task_response(updated_task, current_user.id)
        
        return {"task": response}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/tasks/{task_id}/accept")
async def accept_task(
    organization_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Accept/claim a team or department task"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        if task["status"] != "NEW":
            raise HTTPException(status_code=400, detail="Задача уже принята")
        
        if task.get("accepted_by"):
            raise HTTPException(status_code=400, detail="Задача уже принята другим пользователем")
        
        if task["assignment_type"] not in ["TEAM", "DEPARTMENT"]:
            raise HTTPException(status_code=400, detail="Эту задачу нельзя принять")
        
        # Verify user is in the team/department
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        # Update task
        await db.work_tasks.update_one(
            {"id": task_id},
            {"$set": {
                "status": "ACCEPTED",
                "accepted_by": current_user.id,
                "accepted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        # Notify creator
        if task["created_by"] != current_user.id:
            notification = WorkNotification(
                user_id=task["created_by"],
                organization_id=organization_id,
                notification_type="TASK_ACCEPTED",
                title="Задача принята",
                message=f"{current_user.first_name} {current_user.last_name} принял(а) задачу: {task['title']}",
                related_entity_type="task",
                related_entity_id=task_id
            )
            await db.work_notifications.insert_one(notification.model_dump())
        
        updated_task = await db.work_tasks.find_one({"id": task_id}, {"_id": 0})
        response = await build_task_response(updated_task, current_user.id)
        
        return {"task": response, "message": "Задача принята"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/tasks/{task_id}/status")
async def update_task_status(
    organization_id: str,
    task_id: str,
    status_update: WorkTaskStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update task status (including completion)"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Verify permissions
        is_assigned = task.get("assigned_to") == current_user.id
        is_accepted = task.get("accepted_by") == current_user.id
        is_creator = task["created_by"] == current_user.id
        
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"]
        
        if not (is_assigned or is_accepted or is_creator or is_admin):
            raise HTTPException(status_code=403, detail="Нет прав на изменение статуса")
        
        update_dict = {
            "status": status_update.status,
            "updated_at": datetime.now(timezone.utc)
        }
        
        # Handle completion
        if status_update.status == TaskStatus.DONE:
            # Check if photo proof is required
            if task.get("requires_photo_proof") and not status_update.completion_photo_ids:
                raise HTTPException(status_code=400, detail="Требуется фото подтверждение выполнения")
            
            update_dict["completed_at"] = datetime.now(timezone.utc)
            update_dict["completed_by"] = current_user.id
            update_dict["completion_note"] = status_update.completion_note
            update_dict["completion_photos"] = status_update.completion_photo_ids
            
            # Create completion post in feed
            _org = await db.work_organizations.find_one({"id": organization_id})
            
            post_content = f"✅ Задача выполнена: {task['title']}"
            if status_update.completion_note:
                post_content += f"\n\n{status_update.completion_note}"
            
            completion_post = WorkPost(
                organization_id=organization_id,
                posted_by_user_id=current_user.id,
                content=post_content,
                post_type=WorkPostType.TASK_COMPLETION,
                privacy_level="ORGANIZATION_ONLY",
                media_files=status_update.completion_photo_ids,
                task_metadata={
                    "task_id": task_id,
                    "task_title": task["title"],
                    "task_description": task.get("description"),
                    "completion_photos": status_update.completion_photo_ids,
                    "completion_note": status_update.completion_note,
                    "completed_by": current_user.id,
                    "completed_by_name": f"{current_user.first_name} {current_user.last_name}",
                    "requires_photo_proof": task.get("requires_photo_proof", False),
                    "has_photos": len(status_update.completion_photo_ids) > 0
                }
            )
            
            await db.work_posts.insert_one(completion_post.model_dump())
            update_dict["completion_post_id"] = completion_post.id
            
            # Notify creator
            if task["created_by"] != current_user.id:
                notification = WorkNotification(
                    user_id=task["created_by"],
                    organization_id=organization_id,
                    notification_type="TASK_COMPLETED",
                    title="Задача выполнена",
                    message=f"Задача '{task['title']}' выполнена",
                    related_entity_type="task",
                    related_entity_id=task_id
                )
                await db.work_notifications.insert_one(notification.model_dump())
        
        await db.work_tasks.update_one({"id": task_id}, {"$set": update_dict})
        
        updated_task = await db.work_tasks.find_one({"id": task_id}, {"_id": 0})
        response = await build_task_response(updated_task, current_user.id)
        
        return {"task": response, "message": f"Статус изменён на {status_update.status}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/tasks/{task_id}/subtasks")
async def add_subtask(
    organization_id: str,
    task_id: str,
    subtask_data: WorkTaskSubtaskAdd,
    current_user: User = Depends(get_current_user)
):
    """Add a subtask to a task"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        new_subtask = {
            "id": str(uuid.uuid4()),
            "title": subtask_data.title,
            "is_completed": False
        }
        
        await db.work_tasks.update_one(
            {"id": task_id},
            {
                "$push": {"subtasks": new_subtask},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {"subtask": new_subtask, "message": "Подзадача добавлена"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/work/organizations/{organization_id}/tasks/{task_id}/subtasks/{subtask_id}")
async def update_subtask(
    organization_id: str,
    task_id: str,
    subtask_id: str,
    update_data: WorkTaskSubtaskUpdate,
    current_user: User = Depends(get_current_user)
):
    """Toggle subtask completion status"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Update subtask
        subtasks = task.get("subtasks", [])
        for subtask in subtasks:
            if subtask["id"] == subtask_id:
                subtask["is_completed"] = update_data.is_completed
                break
        
        await db.work_tasks.update_one(
            {"id": task_id},
            {"$set": {
                "subtasks": subtasks,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"message": "Подзадача обновлена"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/work/organizations/{organization_id}/tasks/{task_id}/discuss")
async def create_task_discussion(
    organization_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create a discussion post for a task"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Check if discussion already exists
        if task.get("discussion_post_id"):
            return {"post_id": task["discussion_post_id"], "message": "Обсуждение уже существует"}
        
        # Create discussion post
        post_content = f"💬 Обсуждение задачи: {task['title']}"
        if task.get("description"):
            post_content += f"\n\n{task['description']}"
        
        discussion_post = WorkPost(
            organization_id=organization_id,
            posted_by_user_id=current_user.id,
            content=post_content,
            post_type=WorkPostType.TASK_DISCUSSION,
            privacy_level="ORGANIZATION_ONLY",
            task_metadata={
                "task_id": task_id,
                "task_title": task["title"],
                "task_status": task.get("status", "NEW"),
                "task_priority": task.get("priority", "MEDIUM"),
                "task_deadline": task.get("deadline").isoformat() if task.get("deadline") else None,
                "created_by_name": f"{current_user.first_name} {current_user.last_name}"
            }
        )
        
        await db.work_posts.insert_one(discussion_post.model_dump())
        
        # Link post to task
        await db.work_tasks.update_one(
            {"id": task_id},
            {"$set": {
                "discussion_post_id": discussion_post.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"post_id": discussion_post.id, "message": "Обсуждение создано"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/organizations/{organization_id}/tasks/{task_id}")
async def delete_task(
    organization_id: str,
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete (soft) a task"""
    try:
        task = await db.work_tasks.find_one({
            "id": task_id,
            "organization_id": organization_id,
            "is_deleted": {"$ne": True}
        })
        
        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"]
        is_creator = task["created_by"] == current_user.id
        
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Нет прав на удаление задачи")
        
        await db.work_tasks.update_one(
            {"id": task_id},
            {"$set": {
                "is_deleted": True,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"message": "Задача удалена"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === TASK TEMPLATES ===

@api_router.post("/work/organizations/{organization_id}/task-templates")
async def create_task_template(
    organization_id: str,
    template_data: WorkTaskTemplateCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a task template"""
    try:
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Вы не являетесь членом этой организации")
        
        template = WorkTaskTemplate(
            organization_id=organization_id,
            created_by=current_user.id,
            **template_data.model_dump()
        )
        
        await db.work_task_templates.insert_one(template.model_dump())
        
        return {"template": template.model_dump(), "message": "Шаблон создан"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/work/organizations/{organization_id}/task-templates")
async def get_task_templates(
    organization_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all task templates for an organization"""
    try:
        templates = await db.work_task_templates.find({
            "organization_id": organization_id,
            "is_active": True
        }, {"_id": 0}).to_list(100)
        
        # Add creator names
        for template in templates:
            creator = await db.users.find_one({"id": template["created_by"]}, {"_id": 0})
            template["created_by_name"] = f"{creator['first_name']} {creator['last_name']}" if creator else "Unknown"
        
        return {"templates": templates}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/work/organizations/{organization_id}/task-templates/{template_id}")
async def delete_task_template(
    organization_id: str,
    template_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a task template"""
    try:
        template = await db.work_task_templates.find_one({
            "id": template_id,
            "organization_id": organization_id
        })
        
        if not template:
            raise HTTPException(status_code=404, detail="Шаблон не найден")
        
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"]
        is_creator = template["created_by"] == current_user.id
        
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Нет прав на удаление шаблона")
        
        await db.work_task_templates.update_one(
            {"id": template_id},
            {"$set": {"is_active": False}}
        )
        
        return {"message": "Шаблон удалён"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/work/organizations/{organization_id}/task-templates/{template_id}")
async def update_task_template(
    organization_id: str,
    template_id: str,
    template_data: WorkTaskTemplateCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a task template"""
    try:
        template = await db.work_task_templates.find_one({
            "id": template_id,
            "organization_id": organization_id,
            "is_active": True
        })
        
        if not template:
            raise HTTPException(status_code=404, detail="Шаблон не найден")
        
        # Check permissions
        membership = await db.work_members.find_one({
            "organization_id": organization_id,
            "user_id": current_user.id,
            "status": "ACTIVE"
        })
        
        is_admin = membership and membership.get("role") in ["OWNER", "ADMIN", "MANAGER"]
        is_creator = template["created_by"] == current_user.id
        
        if not (is_admin or is_creator):
            raise HTTPException(status_code=403, detail="Нет прав на редактирование шаблона")
        
        # Update template
        update_data = {
            "name": template_data.name,
            "title": template_data.title,
            "description": template_data.description,
            "priority": template_data.priority,
            "subtasks": template_data.subtasks,
            "requires_photo_proof": template_data.requires_photo_proof,
            "default_assignment_type": template_data.default_assignment_type,
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.work_task_templates.update_one(
            {"id": template_id},
            {"$set": update_data}
        )
        
        # Get updated template
        updated_template = await db.work_task_templates.find_one({"id": template_id}, {"_id": 0})
        creator = await db.users.find_one({"id": updated_template["created_by"]}, {"_id": 0})
        updated_template["created_by_name"] = f"{creator['first_name']} {creator['last_name']}" if creator else "Unknown"
        
        return {"template": updated_template, "message": "Шаблон обновлён"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END WORK TASK MANAGEMENT ENDPOINTS =====

# ===== WEBSOCKET CHAT SYSTEM =====

async def verify_websocket_token(token: str) -> Optional[dict]:
    """Verify JWT token for WebSocket connections"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return {"user_id": user_id}
    except jwt.PyJWTError:
        return None

@app.websocket("/api/ws/chat/{chat_id}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    chat_id: str,
    token: Optional[str] = None
):
    """WebSocket endpoint for real-time chat communication
    
    Events received from client:
    - typing: { type: "typing", is_typing: bool }
    - read: { type: "read", message_ids: [str] }
    - join: { type: "join", chat_id: str }
    - leave: { type: "leave", chat_id: str }
    
    Events sent to client:
    - typing: { type: "typing", user_id: str, user_name: str, is_typing: bool }
    - message: { type: "message", message: {...} }
    - status: { type: "status", message_id: str, status: str }
    - online: { type: "online", user_id: str, is_online: bool }
    """
    # Verify token
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return
    
    token_data = await verify_websocket_token(token)
    if not token_data:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = token_data["user_id"]
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        await websocket.close(code=4001, reason="User not found")
        return
    
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    
    # Connect to WebSocket
    await chat_manager.connect(websocket, user_id, chat_id)
    
    # Update user online status
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc)}}
    )
    
    # Notify others in chat that user is online
    await chat_manager.broadcast_to_chat(chat_id, {
        "type": "online",
        "user_id": user_id,
        "user_name": user_name,
        "is_online": True
    })
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "typing":
                # Broadcast typing indicator
                is_typing = data.get("is_typing", False)
                await chat_manager.broadcast_to_chat(chat_id, {
                    "type": "typing",
                    "user_id": user_id,
                    "user_name": user_name,
                    "is_typing": is_typing,
                    "chat_id": chat_id
                })
                
                # Also update typing status in database for polling fallback
                await db.typing_status.update_one(
                    {"chat_id": chat_id, "user_id": user_id},
                    {
                        "$set": {
                            "is_typing": is_typing,
                            "updated_at": datetime.now(timezone.utc)
                        },
                        "$setOnInsert": {"chat_id": chat_id, "user_id": user_id}
                    },
                    upsert=True
                )
            
            elif event_type == "read":
                # Mark messages as read
                message_ids = data.get("message_ids", [])
                if message_ids:
                    # Update direct chat messages
                    await db.direct_chat_messages.update_many(
                        {
                            "id": {"$in": message_ids},
                            "sender_id": {"$ne": user_id}
                        },
                        {"$set": {"status": "read", "read_at": datetime.now(timezone.utc)}}
                    )
                    
                    # Broadcast read status to chat
                    for msg_id in message_ids:
                        await chat_manager.broadcast_to_chat(chat_id, {
                            "type": "status",
                            "message_id": msg_id,
                            "status": "read",
                            "reader_id": user_id
                        })
            
            elif event_type == "delivered":
                # Mark messages as delivered
                message_ids = data.get("message_ids", [])
                if message_ids:
                    await db.direct_chat_messages.update_many(
                        {
                            "id": {"$in": message_ids},
                            "sender_id": {"$ne": user_id},
                            "status": "sent"
                        },
                        {"$set": {"status": "delivered"}}
                    )
                    
                    # Broadcast delivered status
                    for msg_id in message_ids:
                        await chat_manager.broadcast_to_chat(chat_id, {
                            "type": "status",
                            "message_id": msg_id,
                            "status": "delivered"
                        })
            
            elif event_type == "join":
                # Join another chat room
                new_chat_id = data.get("chat_id")
                if new_chat_id:
                    await chat_manager.join_chat(websocket, new_chat_id)
            
            elif event_type == "leave":
                # Leave a chat room
                leave_chat_id = data.get("chat_id")
                if leave_chat_id:
                    await chat_manager.leave_chat(websocket, leave_chat_id)
            
            elif event_type == "ping":
                # Keep-alive ping
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        # Disconnect and cleanup
        await chat_manager.disconnect(websocket, user_id, chat_id)
        
        # Update user offline status
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc)}}
        )
        
        # Notify others that user is offline
        await chat_manager.broadcast_to_chat(chat_id, {
            "type": "online",
            "user_id": user_id,
            "user_name": user_name,
            "is_online": False
        })

# ===== END WEBSOCKET CHAT SYSTEM =====

# ===== NEWS MODULE - FRIENDS & FOLLOWERS ENDPOINTS =====

@api_router.post("/friends/request")
async def send_friend_request(
    receiver_id: str = Form(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """Send a friend request to another user"""
    if receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot send a friend request to yourself")
    
    # Check if receiver exists
    receiver = await db.users.find_one({"id": receiver_id}, {"_id": 0})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already friends
    existing_friendship = await db.user_friendships.find_one({
        "$or": [
            {"user1_id": min(current_user.id, receiver_id), "user2_id": max(current_user.id, receiver_id)},
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="You are already friends with this user")
    
    # Check for existing pending request
    existing_request = await db.friend_requests.find_one({
        "$or": [
            {"sender_id": current_user.id, "receiver_id": receiver_id, "status": "PENDING"},
            {"sender_id": receiver_id, "receiver_id": current_user.id, "status": "PENDING"}
        ]
    })
    if existing_request:
        if existing_request["sender_id"] == receiver_id:
            raise HTTPException(status_code=400, detail="This user has already sent you a friend request")
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Create friend request
    friend_request = FriendRequest(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=message
    )
    
    await db.friend_requests.insert_one(friend_request.model_dump())
    
    return {
        "message": "Friend request sent",
        "request_id": friend_request.id
    }

@api_router.post("/friends/request/{request_id}/accept")
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Accept a friend request"""
    friend_request = await db.friend_requests.find_one({
        "id": request_id,
        "receiver_id": current_user.id,
        "status": "PENDING"
    })
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "ACCEPTED",
            "responded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create friendship (store IDs in sorted order for consistent querying)
    user1_id = min(current_user.id, friend_request["sender_id"])
    user2_id = max(current_user.id, friend_request["sender_id"])
    
    friendship = UserFriendship(
        user1_id=user1_id,
        user2_id=user2_id,
        from_request_id=request_id
    )
    
    await db.user_friendships.insert_one(friendship.model_dump())
    
    return {
        "message": "Friend request accepted",
        "friendship_id": friendship.id
    }

@api_router.post("/friends/request/{request_id}/reject")
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Reject a friend request"""
    result = await db.friend_requests.update_one(
        {"id": request_id, "receiver_id": current_user.id, "status": "PENDING"},
        {"$set": {
            "status": "REJECTED",
            "responded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    return {"message": "Friend request rejected"}

@api_router.post("/friends/request/{request_id}/cancel")
async def cancel_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user)
):
    """Cancel a sent friend request"""
    result = await db.friend_requests.update_one(
        {"id": request_id, "sender_id": current_user.id, "status": "PENDING"},
        {"$set": {
            "status": "CANCELLED",
            "responded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    return {"message": "Friend request cancelled"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a friend"""
    user1_id = min(current_user.id, friend_id)
    user2_id = max(current_user.id, friend_id)
    
    result = await db.user_friendships.delete_one({
        "user1_id": user1_id,
        "user2_id": user2_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    return {"message": "Friend removed"}

@api_router.get("/friends")
async def get_friends(
    current_user: User = Depends(get_current_user)
):
    """Get list of friends for the current user"""
    # Find all friendships where user is either user1 or user2
    friendships = await db.user_friendships.find({
        "$or": [
            {"user1_id": current_user.id},
            {"user2_id": current_user.id}
        ]
    }, {"_id": 0}).to_list(1000)
    
    # Get friend IDs
    friend_ids = []
    for f in friendships:
        if f["user1_id"] == current_user.id:
            friend_ids.append(f["user2_id"])
        else:
            friend_ids.append(f["user1_id"])
    
    # Get friend details
    friends = []
    if friend_ids:
        friends_data = await db.users.find(
            {"id": {"$in": friend_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
        
        for friend in friends_data:
            # Find the friendship record for created_at
            friendship = next(
                (f for f in friendships if f["user1_id"] == friend["id"] or f["user2_id"] == friend["id"]),
                None
            )
            friends.append({
                **friend,
                "friends_since": friendship["created_at"] if friendship else None
            })
    
    return {
        "friends": friends,
        "total_count": len(friends)
    }

@api_router.get("/friends/requests/incoming")
async def get_incoming_friend_requests(
    current_user: User = Depends(get_current_user)
):
    """Get incoming friend requests"""
    requests = await db.friend_requests.find({
        "receiver_id": current_user.id,
        "status": "PENDING"
    }, {"_id": 0}).to_list(100)
    
    # Get sender details
    sender_ids = [r["sender_id"] for r in requests]
    senders = {}
    if sender_ids:
        senders_data = await db.users.find(
            {"id": {"$in": sender_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        senders = {s["id"]: s for s in senders_data}
    
    result = []
    for req in requests:
        result.append({
            **req,
            "sender": senders.get(req["sender_id"])
        })
    
    return {"requests": result, "total_count": len(result)}

@api_router.get("/friends/requests/outgoing")
async def get_outgoing_friend_requests(
    current_user: User = Depends(get_current_user)
):
    """Get outgoing friend requests"""
    requests = await db.friend_requests.find({
        "sender_id": current_user.id,
        "status": "PENDING"
    }, {"_id": 0}).to_list(100)
    
    # Get receiver details
    receiver_ids = [r["receiver_id"] for r in requests]
    receivers = {}
    if receiver_ids:
        receivers_data = await db.users.find(
            {"id": {"$in": receiver_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        receivers = {r["id"]: r for r in receivers_data}
    
    result = []
    for req in requests:
        result.append({
            **req,
            "receiver": receivers.get(req["receiver_id"])
        })
    
    return {"requests": result, "total_count": len(result)}

# ===== FOLLOW ENDPOINTS =====

@api_router.post("/users/{user_id}/follow")
async def follow_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Follow a user"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already following
    existing_follow = await db.user_follows.find_one({
        "follower_id": current_user.id,
        "target_id": user_id
    })
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    # Create follow
    follow = UserFollow(
        follower_id=current_user.id,
        target_id=user_id
    )
    
    await db.user_follows.insert_one(follow.model_dump())
    
    return {
        "message": "Now following user",
        "follow_id": follow.id
    }

@api_router.delete("/users/{user_id}/follow")
async def unfollow_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Unfollow a user"""
    result = await db.user_follows.delete_one({
        "follower_id": current_user.id,
        "target_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not following this user")
    
    return {"message": "Unfollowed user"}

@api_router.get("/users/{user_id}/follow/status")
async def get_user_follow_status(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check if current user follows a specific user and vice versa"""
    is_following = await db.user_follows.find_one({
        "follower_id": current_user.id,
        "target_id": user_id
    }) is not None
    
    is_followed_by = await db.user_follows.find_one({
        "follower_id": user_id,
        "target_id": current_user.id
    }) is not None
    
    is_friend = await db.user_friendships.find_one({
        "$or": [
            {"user1_id": min(current_user.id, user_id), "user2_id": max(current_user.id, user_id)}
        ]
    }) is not None
    
    return {
        "is_following": is_following,
        "is_followed_by": is_followed_by,
        "is_friend": is_friend
    }

@api_router.get("/users/me/followers")
async def get_my_followers(
    current_user: User = Depends(get_current_user)
):
    """Get users who follow the current user"""
    follows = await db.user_follows.find({
        "target_id": current_user.id
    }, {"_id": 0}).to_list(1000)
    
    follower_ids = [f["follower_id"] for f in follows]
    
    followers = []
    if follower_ids:
        followers_data = await db.users.find(
            {"id": {"$in": follower_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
        
        for follower in followers_data:
            follow_record = next((f for f in follows if f["follower_id"] == follower["id"]), None)
            followers.append({
                **follower,
                "followed_at": follow_record["created_at"] if follow_record else None
            })
    
    return {
        "followers": followers,
        "total_count": len(followers)
    }

@api_router.get("/users/me/following")
async def get_my_following(
    current_user: User = Depends(get_current_user)
):
    """Get users the current user is following"""
    follows = await db.user_follows.find({
        "follower_id": current_user.id
    }, {"_id": 0}).to_list(1000)
    
    target_ids = [f["target_id"] for f in follows]
    
    following = []
    if target_ids:
        following_data = await db.users.find(
            {"id": {"$in": target_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
        
        for user in following_data:
            follow_record = next((f for f in follows if f["target_id"] == user["id"]), None)
            following.append({
                **user,
                "followed_at": follow_record["created_at"] if follow_record else None
            })
    
    return {
        "following": following,
        "total_count": len(following)
    }

@api_router.get("/users/me/social-stats")
async def get_social_stats(
    current_user: User = Depends(get_current_user)
):
    """Get social stats for the current user"""
    # Count friends
    friends_count = await db.user_friendships.count_documents({
        "$or": [
            {"user1_id": current_user.id},
            {"user2_id": current_user.id}
        ]
    })
    
    # Count followers
    followers_count = await db.user_follows.count_documents({
        "target_id": current_user.id
    })
    
    # Count following
    following_count = await db.user_follows.count_documents({
        "follower_id": current_user.id
    })
    
    # Count pending friend requests
    pending_requests = await db.friend_requests.count_documents({
        "receiver_id": current_user.id,
        "status": "PENDING"
    })
    
    return {
        "friends_count": friends_count,
        "followers_count": followers_count,
        "following_count": following_count,
        "pending_friend_requests": pending_requests
    }

@api_router.get("/users/suggestions")
async def get_user_suggestions(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get suggested users to follow/friend (people you may know) with smart ranking - OPTIMIZED"""
    
    # Get current user's profile info for matching
    user_city = current_user.address_city
    user_country = current_user.address_country
    
    # ========== BATCH QUERY 1: Get exclusion sets ==========
    friendships, following, pending_requests = await asyncio.gather(
        db.user_friendships.find({
            "$or": [
                {"user1_id": current_user.id},
                {"user2_id": current_user.id}
            ]
        }, {"_id": 0, "user1_id": 1, "user2_id": 1}).to_list(1000),
        
        db.user_follows.find({
            "follower_id": current_user.id
        }, {"_id": 0, "target_id": 1}).to_list(1000),
        
        db.friend_requests.find({
            "$or": [
                {"sender_id": current_user.id, "status": "pending"},
                {"receiver_id": current_user.id, "status": "pending"}
            ]
        }, {"_id": 0, "sender_id": 1, "receiver_id": 1}).to_list(1000)
    )
    
    friend_ids = set()
    for f in friendships:
        if f["user1_id"] == current_user.id:
            friend_ids.add(f["user2_id"])
        else:
            friend_ids.add(f["user1_id"])
    
    following_ids = {f["target_id"] for f in following}
    pending_ids = {r["sender_id"] for r in pending_requests} | {r["receiver_id"] for r in pending_requests}
    
    # Exclude self, friends, already following, and pending requests
    exclude_ids = friend_ids | following_ids | pending_ids | {current_user.id}
    
    # ========== BATCH QUERY 2: Get user's organization/school context ==========
    user_work_memberships, user_school_memberships, user_children = await asyncio.gather(
        db.work_members.find({
            "user_id": current_user.id,
            "status": "active"
        }, {"_id": 0, "organization_id": 1}).to_list(100),
        
        db.school_memberships.find({
            "user_id": current_user.id
        }, {"_id": 0, "organization_id": 1}).to_list(100),
        
        db.family_students.find({
            "parent_ids": current_user.id
        }, {"_id": 0, "organization_id": 1}).to_list(50)
    )
    
    user_org_ids = [m["organization_id"] for m in user_work_memberships]
    user_school_ids = [m["organization_id"] for m in user_school_memberships]
    child_school_ids = [c.get("organization_id") for c in user_children if c.get("organization_id")]
    all_school_ids = list(set(user_school_ids + child_school_ids))
    
    # ========== Get candidate users ==========
    suggestions_raw = await db.users.find(
        {"id": {"$nin": list(exclude_ids)}},
        {"_id": 0, "password_hash": 0}
    ).limit(limit * 3).to_list(limit * 3)
    
    if not suggestions_raw:
        return {"suggestions": []}
    
    suggestion_ids = [s["id"] for s in suggestions_raw]
    
    # ========== BATCH QUERY 3: Get ALL related data at once ==========
    # Build queries conditionally to avoid empty $in issues
    queries = [
        # All friendships for suggested users (always needed)
        db.user_friendships.find({
            "$or": [
                {"user1_id": {"$in": suggestion_ids}},
                {"user2_id": {"$in": suggestion_ids}}
            ]
        }, {"_id": 0, "user1_id": 1, "user2_id": 1}).to_list(5000),
        
        # Users who follow current user (always needed)
        db.user_follows.find({
            "follower_id": {"$in": suggestion_ids},
            "target_id": current_user.id
        }, {"_id": 0, "follower_id": 1}).to_list(500)
    ]
    
    # Conditionally add work/school queries only if user has relevant memberships
    has_work_orgs = bool(user_org_ids)
    has_schools = bool(all_school_ids)
    
    results = await asyncio.gather(*queries)
    all_friendships = results[0]
    follows_me_list = results[1]
    
    # Run work/school queries only if needed
    all_work_memberships = []
    all_school_memberships = []
    all_children = []
    
    if has_work_orgs or has_schools:
        extra_queries = []
        if has_work_orgs:
            extra_queries.append(
                db.work_members.find({
                    "user_id": {"$in": suggestion_ids},
                    "organization_id": {"$in": user_org_ids},
                    "status": "active"
                }, {"_id": 0, "user_id": 1, "organization_id": 1}).to_list(500)
            )
        if has_schools:
            extra_queries.append(
                db.school_memberships.find({
                    "user_id": {"$in": suggestion_ids},
                    "organization_id": {"$in": all_school_ids}
                }, {"_id": 0, "user_id": 1}).to_list(500)
            )
            extra_queries.append(
                db.family_students.find({
                    "parent_ids": {"$in": suggestion_ids},
                    "organization_id": {"$in": all_school_ids}
                }, {"_id": 0, "parent_ids": 1}).to_list(500)
            )
        
        extra_results = await asyncio.gather(*extra_queries)
        idx = 0
        if has_work_orgs:
            all_work_memberships = extra_results[idx]
            idx += 1
        if has_schools:
            all_school_memberships = extra_results[idx]
            idx += 1
            all_children = extra_results[idx] if idx < len(extra_results) else []
    
    # Build lookup maps for O(1) access
    # Map: user_id -> set of their friend_ids
    user_friends_map = {}
    for f in all_friendships:
        u1, u2 = f["user1_id"], f["user2_id"]
        if u1 in suggestion_ids:
            if u1 not in user_friends_map:
                user_friends_map[u1] = set()
            user_friends_map[u1].add(u2)
        if u2 in suggestion_ids:
            if u2 not in user_friends_map:
                user_friends_map[u2] = set()
            user_friends_map[u2].add(u1)
    
    # Set of users who are colleagues
    colleague_user_ids = {m["user_id"] for m in all_work_memberships}
    
    # Set of users connected via school
    school_connected_ids = {m["user_id"] for m in all_school_memberships}
    for child in all_children:
        for parent_id in child.get("parent_ids", []):
            if parent_id in suggestion_ids:
                school_connected_ids.add(parent_id)
    
    # Set of users who follow me
    follows_me_ids = {f["follower_id"] for f in follows_me_list}
    
    # ========== Score each suggestion using cached data ==========
    scored_suggestions = []
    
    for suggestion in suggestions_raw:
        user_id = suggestion["id"]
        score = 0
        reasons = []
        
        # 1. Mutual friends (using cached data)
        their_friends = user_friends_map.get(user_id, set())
        mutual = friend_ids & their_friends
        mutual_count = len(mutual)
        if mutual_count > 0:
            score += mutual_count * 10
            if mutual_count == 1:
                reasons.append("1 общий друг")
            else:
                reasons.append(f"{mutual_count} общих друзей")
        
        # 2. Same city
        if user_city and suggestion.get("address_city") == user_city:
            score += 5
            reasons.append(f"Живёт в {user_city}")
        # 3. Same country
        elif user_country and suggestion.get("address_country") == user_country:
            score += 2
            reasons.append(f"Из {user_country}")
        
        # 4. Colleague (using cached data)
        if user_id in colleague_user_ids:
            score += 8
            reasons.append("Коллега")
        
        # 5. Same school (using cached data)
        if user_id in school_connected_ids:
            score += 7
            reasons.append("Из той же школы")
        
        # 6. They follow me (using cached data)
        if user_id in follows_me_ids:
            score += 6
            reasons.append("Подписан на вас")
        
        # Only include if there's at least one reason or we need more
        if score > 0 or len(scored_suggestions) < limit // 2:
            suggestion["score"] = score
            suggestion["mutual_friends_count"] = mutual_count
            suggestion["suggestion_reasons"] = reasons[:3]
            scored_suggestions.append(suggestion)
    
    # Sort by score (highest first)
    scored_suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    return {"suggestions": scored_suggestions[:limit]}

@api_router.get("/users/search")
async def search_users(
    query: str,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Search users by name"""
    if len(query) < 2:
        return {"users": []}
    
    # Search by first_name or last_name (case-insensitive)
    search_regex = {"$regex": query, "$options": "i"}
    
    users = await db.users.find(
        {
            "$and": [
                {"id": {"$ne": current_user.id}},  # Exclude self
                {
                    "$or": [
                        {"first_name": search_regex},
                        {"last_name": search_regex},
                        {"email": search_regex}
                    ]
                }
            ]
        },
        {"_id": 0, "password_hash": 0}
    ).limit(limit).to_list(limit)
    
    # Add relationship info to each user
    for user in users:
        # Check if friend
        is_friend = await db.user_friendships.find_one({
            "$or": [
                {"user1_id": min(current_user.id, user["id"]), "user2_id": max(current_user.id, user["id"])}
            ]
        }) is not None
        
        # Check if following
        is_following = await db.user_follows.find_one({
            "follower_id": current_user.id,
            "target_id": user["id"]
        }) is not None
        
        # Check for pending request
        pending_request = await db.friend_requests.find_one({
            "sender_id": current_user.id,
            "receiver_id": user["id"],
            "status": "PENDING"
        })
        
        user["is_friend"] = is_friend
        user["is_following"] = is_following
        user["request_sent"] = pending_request is not None
    
    return {"users": users}

@api_router.get("/users/{user_id}/profile")
async def get_user_public_profile(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get public profile of a user with social relationship info"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get relationship status
    is_friend = await db.user_friendships.find_one({
        "$or": [
            {"user1_id": min(current_user.id, user_id), "user2_id": max(current_user.id, user_id)}
        ]
    }) is not None
    
    is_following = await db.user_follows.find_one({
        "follower_id": current_user.id,
        "target_id": user_id
    }) is not None
    
    is_followed_by = await db.user_follows.find_one({
        "follower_id": user_id,
        "target_id": current_user.id
    }) is not None
    
    # Check for pending friend request
    pending_request = await db.friend_requests.find_one({
        "$or": [
            {"sender_id": current_user.id, "receiver_id": user_id, "status": "PENDING"},
            {"sender_id": user_id, "receiver_id": current_user.id, "status": "PENDING"}
        ]
    })
    
    pending_request_type = None
    pending_request_id = None
    if pending_request:
        pending_request_id = pending_request["id"]
        pending_request_type = "sent" if pending_request["sender_id"] == current_user.id else "received"
    
    # Get social stats for this user
    friends_count = await db.user_friendships.count_documents({
        "$or": [
            {"user1_id": user_id},
            {"user2_id": user_id}
        ]
    })
    
    followers_count = await db.user_follows.count_documents({
        "target_id": user_id
    })
    
    following_count = await db.user_follows.count_documents({
        "follower_id": user_id
    })
    
    return {
        **user,
        "is_friend": is_friend,
        "is_following": is_following,
        "is_followed_by": is_followed_by,
        "pending_request_type": pending_request_type,
        "pending_request_id": pending_request_id,
        "friends_count": friends_count,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_self": user_id == current_user.id
    }

# ===== LINK PREVIEW ENDPOINT =====

class LinkPreviewRequest(BaseModel):
    url: str

class LinkPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    site_name: Optional[str] = None
    is_youtube: bool = False
    youtube_id: Optional[str] = None

@api_router.post("/utils/link-preview")
async def get_link_preview(
    request: LinkPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    """Fetch OpenGraph metadata for a URL to generate link preview"""
    import aiohttp
    from urllib.parse import urlparse, parse_qs
    
    url = request.url.strip()
    
    # Check if it's a YouTube URL
    youtube_id = None
    is_youtube = False
    
    parsed_url = urlparse(url)
    
    # Check for youtube.com/watch?v=
    if 'youtube.com' in parsed_url.netloc and '/watch' in parsed_url.path:
        query_params = parse_qs(parsed_url.query)
        if 'v' in query_params:
            youtube_id = query_params['v'][0]
            is_youtube = True
    # Check for youtu.be/
    elif 'youtu.be' in parsed_url.netloc:
        youtube_id = parsed_url.path.strip('/')
        is_youtube = True
    # Check for youtube.com/embed/
    elif 'youtube.com' in parsed_url.netloc and '/embed/' in parsed_url.path:
        youtube_id = parsed_url.path.split('/embed/')[1].split('?')[0]
        is_youtube = True
    
    if is_youtube and youtube_id:
        return {
            "url": url,
            "title": "YouTube Video",
            "description": None,
            "image": f"https://img.youtube.com/vi/{youtube_id}/hqdefault.jpg",
            "site_name": "YouTube",
            "is_youtube": True,
            "youtube_id": youtube_id
        }
    
    # For non-YouTube URLs, try to fetch OpenGraph metadata
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; ZionBot/1.0)'
            }
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status != 200:
                    return {"url": url, "title": None, "description": None, "image": None, "site_name": None, "is_youtube": False, "youtube_id": None}
                
                html = await response.text()
                
                # Simple regex-based OG tag extraction
                import re
                
                def extract_og_tag(html, property_name):
                    patterns = [
                        rf'<meta[^>]*property=["\']og:{property_name}["\'][^>]*content=["\']([^"\']*)["\']',
                        rf'<meta[^>]*content=["\']([^"\']*)["\'][^>]*property=["\']og:{property_name}["\']',
                    ]
                    for pattern in patterns:
                        match = re.search(pattern, html, re.IGNORECASE)
                        if match:
                            return match.group(1)
                    return None
                
                def extract_title(html):
                    # Try og:title first
                    og_title = extract_og_tag(html, 'title')
                    if og_title:
                        return og_title
                    # Fall back to <title> tag
                    match = re.search(r'<title[^>]*>([^<]*)</title>', html, re.IGNORECASE)
                    return match.group(1) if match else None
                
                title = extract_title(html)
                description = extract_og_tag(html, 'description')
                image = extract_og_tag(html, 'image')
                site_name = extract_og_tag(html, 'site_name')
                
                return {
                    "url": url,
                    "title": title,
                    "description": description,
                    "image": image,
                    "site_name": site_name,
                    "is_youtube": False,
                    "youtube_id": None
                }
                
    except Exception as e:
        logger.error(f"Error fetching link preview: {e}")
        return {"url": url, "title": None, "description": None, "image": None, "site_name": None, "is_youtube": False, "youtube_id": None}

# ===== NEWS CHANNELS ENDPOINTS =====

class ChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    categories: List[str] = []
    organization_id: Optional[str] = None  # If creating as official org channel

class ChannelUpdate(BaseModel):
    """Model for updating channel settings"""
    name: Optional[str] = None
    description: Optional[str] = None
    categories: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None

@api_router.post("/news/channels")
async def create_channel(
    channel_data: ChannelCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new news channel. If organization_id is provided, creates as official channel."""
    is_official = False
    is_verified = False
    org_id = None
    
    # Admin roles for official channel creation
    admin_roles = ["OWNER", "ADMIN", "CEO", "CTO", "CFO", "COO", "FOUNDER", "CO_FOUNDER", "PRESIDENT"]
    
    # If creating as official organization channel
    if channel_data.organization_id:
        # Verify user is admin/owner of the organization
        org = await db.work_organizations.find_one({"id": channel_data.organization_id})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        membership = await db.work_members.find_one({
            "user_id": current_user.id,
            "organization_id": channel_data.organization_id,
            "status": "ACTIVE"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        
        is_admin = membership.get("is_admin", False) or membership.get("role") in admin_roles
        if not is_admin:
            raise HTTPException(status_code=403, detail="Must be organization admin/owner to create official channel")
        
        is_official = True
        is_verified = True
        org_id = channel_data.organization_id
    
    # Create channel
    channel = NewsChannel(
        owner_id=current_user.id,
        organization_id=org_id,
        name=channel_data.name,
        description=channel_data.description,
        categories=[NewsChannelCategory(c) for c in channel_data.categories if c in [e.value for e in NewsChannelCategory]],
        is_official=is_official,
        is_verified=is_verified
    )
    
    await db.news_channels.insert_one(channel.model_dump())
    
    return {
        "message": "Channel created successfully",
        "channel_id": channel.id,
        "channel": channel.model_dump()
    }

@api_router.get("/news/channels")
async def get_channels(
    category: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get all public channels, optionally filtered by category"""
    query = {"is_active": True}
    
    if category:
        query["categories"] = category
    
    channels = await db.news_channels.find(
        query,
        {"_id": 0}
    ).sort("subscribers_count", -1).limit(limit).to_list(limit)
    
    # Add owner info and organization info
    for channel in channels:
        owner = await db.users.find_one(
            {"id": channel["owner_id"]},
            {"_id": 0, "password_hash": 0}
        )
        if owner:
            channel["owner"] = {"first_name": owner.get("first_name"), "last_name": owner.get("last_name")}
        else:
            channel["owner"] = None
        
        # Add organization info for official channels
        if channel.get("organization_id"):
            org = await db.work_organizations.find_one(
                {"id": channel["organization_id"]},
                {"_id": 0, "id": 1, "name": 1, "logo_url": 1}
            )
            channel["organization"] = org
        else:
            channel["organization"] = None
    
    return {"channels": channels}

@api_router.get("/news/channels/my")
async def get_my_channels(
    current_user: User = Depends(get_current_user)
):
    """Get channels owned by the current user"""
    channels = await db.news_channels.find(
        {"owner_id": current_user.id},
        {"_id": 0}
    ).to_list(100)
    
    return {"channels": channels}

@api_router.get("/news/channels/subscriptions")
async def get_channel_subscriptions(
    current_user: User = Depends(get_current_user)
):
    """Get channels the user is subscribed to"""
    subscriptions = await db.channel_subscriptions.find(
        {"subscriber_id": current_user.id},
        {"_id": 0}
    ).to_list(100)
    
    # Get channel details
    for sub in subscriptions:
        channel = await db.news_channels.find_one(
            {"id": sub["channel_id"]},
            {"_id": 0}
        )
        sub["channel"] = channel
    
    return {"subscriptions": subscriptions}

@api_router.get("/news/channels/{channel_id}")
async def get_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific channel with detailed info"""
    channel = await db.news_channels.find_one(
        {"id": channel_id},
        {"_id": 0}
    )
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user is subscribed and get notification preference
    subscription = await db.channel_subscriptions.find_one({
        "channel_id": channel_id,
        "subscriber_id": current_user.id
    })
    is_subscribed = subscription is not None
    notifications_enabled = subscription.get("notifications_enabled", True) if subscription else False
    
    # Get owner info
    owner_data = await db.users.find_one(
        {"id": channel["owner_id"]},
        {"_id": 0, "password_hash": 0}
    )
    owner = {"first_name": owner_data.get("first_name"), "last_name": owner_data.get("last_name")} if owner_data else None
    
    # Check if user is moderator
    is_moderator = await db.channel_moderators.find_one({
        "channel_id": channel_id,
        "user_id": current_user.id,
        "is_active": True
    }) is not None
    
    # Get organization info if official channel
    organization = None
    if channel.get("organization_id"):
        org_data = await db.work_organizations.find_one(
            {"id": channel["organization_id"]},
            {"_id": 0, "id": 1, "name": 1, "logo_url": 1, "organization_type": 1}
        )
        organization = org_data
    
    # Get moderators count
    moderators_count = await db.channel_moderators.count_documents({
        "channel_id": channel_id,
        "is_active": True
    })
    
    return {
        **channel,
        "is_subscribed": is_subscribed,
        "notifications_enabled": notifications_enabled,
        "is_owner": channel["owner_id"] == current_user.id,
        "is_moderator": is_moderator,
        "owner": owner,
        "organization": organization,
        "moderators_count": moderators_count
    }

@api_router.post("/news/channels/{channel_id}/subscribe")
async def subscribe_to_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Subscribe to a channel"""
    # Check channel exists
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if already subscribed
    existing = await db.channel_subscriptions.find_one({
        "channel_id": channel_id,
        "subscriber_id": current_user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    # Create subscription
    subscription = ChannelSubscription(
        channel_id=channel_id,
        subscriber_id=current_user.id
    )
    
    await db.channel_subscriptions.insert_one(subscription.model_dump())
    
    # Update subscriber count
    await db.news_channels.update_one(
        {"id": channel_id},
        {"$inc": {"subscribers_count": 1}}
    )
    
    return {"message": "Subscribed successfully"}

@api_router.delete("/news/channels/{channel_id}/subscribe")
async def unsubscribe_from_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Unsubscribe from a channel"""
    result = await db.channel_subscriptions.delete_one({
        "channel_id": channel_id,
        "subscriber_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not subscribed to this channel")
    
    # Update subscriber count
    await db.news_channels.update_one(
        {"id": channel_id},
        {"$inc": {"subscribers_count": -1}}
    )
    
    return {"message": "Unsubscribed successfully"}

@api_router.put("/news/channels/{channel_id}/notifications")
async def toggle_channel_notifications(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Toggle notification settings for a subscribed channel"""
    # Check channel exists
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user is subscribed
    subscription = await db.channel_subscriptions.find_one({
        "channel_id": channel_id,
        "subscriber_id": current_user.id
    })
    
    if not subscription:
        raise HTTPException(status_code=400, detail="You must be subscribed to toggle notifications")
    
    # Toggle notifications
    new_status = not subscription.get("notifications_enabled", True)
    
    await db.channel_subscriptions.update_one(
        {"channel_id": channel_id, "subscriber_id": current_user.id},
        {"$set": {"notifications_enabled": new_status}}
    )
    
    return {
        "message": "Notification settings updated",
        "notifications_enabled": new_status
    }

@api_router.put("/news/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    channel_data: ChannelUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a channel settings (owner only)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this channel")
    
    # Build update dict with only provided fields
    update_data = {}
    if channel_data.name is not None:
        update_data["name"] = channel_data.name
    if channel_data.description is not None:
        update_data["description"] = channel_data.description
    if channel_data.categories is not None:
        update_data["categories"] = [c for c in channel_data.categories if c in [e.value for e in NewsChannelCategory]]
    if channel_data.avatar_url is not None:
        update_data["avatar_url"] = channel_data.avatar_url
    if channel_data.cover_url is not None:
        update_data["cover_url"] = channel_data.cover_url
    
    if update_data:
        await db.news_channels.update_one(
            {"id": channel_id},
            {"$set": update_data}
        )
    
    # Return updated channel data
    updated_channel = await db.news_channels.find_one({"id": channel_id}, {"_id": 0})
    return {"message": "Channel updated successfully", "channel": updated_channel}

@api_router.delete("/news/channels/{channel_id}")
async def delete_channel(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a channel (owner only)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this channel")
    
    # Delete channel and all subscriptions
    await db.news_channels.delete_one({"id": channel_id})
    await db.channel_subscriptions.delete_many({"channel_id": channel_id})
    
    return {"message": "Channel deleted successfully"}

# ===== NEWS EVENTS ENDPOINTS =====

@api_router.post("/news/events")
async def create_news_event(
    event_data: NewsEventCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new news event (personal or channel-based)"""
    # If channel_id provided, verify user is owner or moderator
    if event_data.channel_id:
        channel = await db.news_channels.find_one({"id": event_data.channel_id})
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        is_owner = channel["owner_id"] == current_user.id
        is_moderator = await db.channel_moderators.find_one({
            "channel_id": event_data.channel_id,
            "user_id": current_user.id,
            "is_active": True
        }) is not None
        
        if not is_owner and not is_moderator:
            raise HTTPException(status_code=403, detail="Not authorized to create events for this channel")
    
    # Create the event
    event = NewsEvent(
        title=event_data.title,
        description=event_data.description,
        event_type=event_data.event_type,
        event_date=event_data.event_date,
        duration_minutes=event_data.duration_minutes,
        creator_id=current_user.id,
        channel_id=event_data.channel_id,
        event_link=event_data.event_link,
        cover_url=event_data.cover_url
    )
    
    await db.news_events.insert_one(event.dict())
    
    return {"message": "Event created successfully", "event_id": event.id}

@api_router.get("/news/events")
async def get_news_events(
    channel_id: Optional[str] = None,
    event_type: Optional[str] = None,
    upcoming_only: bool = True,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get news events - personal feed or channel-specific"""
    query = {"is_active": True}
    
    if upcoming_only:
        query["event_date"] = {"$gte": datetime.now(timezone.utc)}
    
    if channel_id:
        # Get events for a specific channel
        query["channel_id"] = channel_id
    else:
        # Get events from:
        # 1. User's own events
        # 2. Events from subscribed channels
        # 3. Events from friends
        
        # Get subscribed channel IDs
        subscriptions = await db.channel_subscriptions.find(
            {"subscriber_id": current_user.id}
        ).to_list(1000)
        subscribed_channel_ids = [s["channel_id"] for s in subscriptions]
        
        # Get friend IDs
        friendships = await db.friendships.find({
            "$or": [
                {"user_id": current_user.id, "status": "ACCEPTED"},
                {"friend_id": current_user.id, "status": "ACCEPTED"}
            ]
        }).to_list(1000)
        friend_ids = [
            f["friend_id"] if f["user_id"] == current_user.id else f["user_id"]
            for f in friendships
        ]
        
        query["$or"] = [
            {"creator_id": current_user.id},  # Own events
            {"channel_id": {"$in": subscribed_channel_ids}},  # Subscribed channels
            {"creator_id": {"$in": friend_ids}, "channel_id": None}  # Friends' personal events
        ]
    
    if event_type:
        query["event_type"] = event_type
    
    events = await db.news_events.find(query, {"_id": 0}).sort("event_date", 1).limit(limit).to_list(limit)
    
    # Enrich events with creator and channel info
    enriched_events = []
    for event in events:
        # Get creator info
        creator = await db.users.find_one(
            {"id": event["creator_id"]},
            {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
        )
        
        # Get channel info if applicable
        channel = None
        if event.get("channel_id"):
            channel = await db.news_channels.find_one(
                {"id": event["channel_id"]},
                {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}
            )
        
        enriched_events.append({
            **event,
            "attendees_count": len(event.get("attendees", [])),
            "is_attending": current_user.id in event.get("attendees", []),
            "has_reminder": current_user.id in event.get("reminders", []),
            "creator": creator,
            "channel": channel
        })
    
    return {"events": enriched_events}

@api_router.get("/news/events/{event_id}")
async def get_news_event(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single news event details"""
    event = await db.news_events.find_one({"id": event_id, "is_active": True}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get creator info
    creator = await db.users.find_one(
        {"id": event["creator_id"]},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
    )
    
    # Get channel info if applicable
    channel = None
    if event.get("channel_id"):
        channel = await db.news_channels.find_one(
            {"id": event["channel_id"]},
            {"_id": 0, "id": 1, "name": 1, "avatar_url": 1}
        )
    
    # Get attendees list
    attendee_ids = event.get("attendees", [])[:10]  # First 10
    attendees = await db.users.find(
        {"id": {"$in": attendee_ids}},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1}
    ).to_list(10)
    
    return {
        **event,
        "attendees_count": len(event.get("attendees", [])),
        "is_attending": current_user.id in event.get("attendees", []),
        "has_reminder": current_user.id in event.get("reminders", []),
        "creator": creator,
        "channel": channel,
        "attendees_preview": attendees
    }

@api_router.post("/news/events/{event_id}/attend")
async def toggle_event_attendance(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Toggle attendance (RSVP) for an event"""
    event = await db.news_events.find_one({"id": event_id, "is_active": True})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    attendees = event.get("attendees", [])
    is_attending = current_user.id in attendees
    
    if is_attending:
        # Remove from attendees
        await db.news_events.update_one(
            {"id": event_id},
            {"$pull": {"attendees": current_user.id}}
        )
        return {"message": "Attendance cancelled", "is_attending": False}
    else:
        # Add to attendees
        await db.news_events.update_one(
            {"id": event_id},
            {"$addToSet": {"attendees": current_user.id}}
        )
        return {"message": "Attendance confirmed", "is_attending": True}

@api_router.post("/news/events/{event_id}/remind")
async def toggle_event_reminder(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Toggle reminder for an event"""
    event = await db.news_events.find_one({"id": event_id, "is_active": True})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    reminders = event.get("reminders", [])
    has_reminder = current_user.id in reminders
    
    if has_reminder:
        # Remove reminder
        await db.news_events.update_one(
            {"id": event_id},
            {"$pull": {"reminders": current_user.id}}
        )
        return {"message": "Reminder cancelled", "has_reminder": False}
    else:
        # Add reminder
        await db.news_events.update_one(
            {"id": event_id},
            {"$addToSet": {"reminders": current_user.id}}
        )
        return {"message": "Reminder set", "has_reminder": True}

@api_router.delete("/news/events/{event_id}")
async def delete_news_event(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a news event (creator only)"""
    event = await db.news_events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["creator_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    
    await db.news_events.update_one(
        {"id": event_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Event deleted successfully"}

# ===== NEWS POSTS ENDPOINTS =====

@api_router.post("/news/posts")
async def create_news_post(
    post_data: NewsPostCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new news post"""
    # If posting to a channel, verify ownership
    if post_data.channel_id:
        channel = await db.news_channels.find_one({"id": post_data.channel_id})
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        if channel["owner_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="You can only post to your own channels")
    
    post = NewsPost(
        user_id=current_user.id,
        channel_id=post_data.channel_id,
        content=post_data.content,
        visibility=post_data.visibility,
        media_files=post_data.media_files,
        youtube_urls=post_data.youtube_urls
    )
    
    await db.news_posts.insert_one(post.model_dump())
    
    # Check for @ERIC mention or ERIC_AI visibility and trigger AI response
    should_trigger_eric = '@eric' in post_data.content.lower() or '@ERIC' in post_data.content or post_data.visibility == 'ERIC_AI'
    if should_trigger_eric:
        asyncio.create_task(process_eric_mention_for_news_post(
            post_id=post.id,
            post_content=post_data.content,
            author_name=f"{current_user.first_name} {current_user.last_name}",
            user_id=current_user.id
        ))
    
    # Update channel post count if applicable
    if post_data.channel_id:
        await db.news_channels.update_one(
            {"id": post_data.channel_id},
            {"$inc": {"posts_count": 1}}
        )
    
    return {
        "message": "Post created successfully",
        "post_id": post.id,
        "post": post.model_dump()
    }

@api_router.get("/news/posts/feed")
async def get_news_feed(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get personalized news feed based on friends, following, and subscriptions"""
    
    # Get user's friends
    friendships = await db.user_friendships.find({
        "$or": [
            {"user1_id": current_user.id},
            {"user2_id": current_user.id}
        ]
    }).to_list(1000)
    
    friend_ids = set()
    for f in friendships:
        if f["user1_id"] == current_user.id:
            friend_ids.add(f["user2_id"])
        else:
            friend_ids.add(f["user1_id"])
    
    # Get users I'm following
    following = await db.user_follows.find({
        "follower_id": current_user.id
    }).to_list(1000)
    following_ids = {f["target_id"] for f in following}
    
    # Get subscribed channels
    subscriptions = await db.channel_subscriptions.find({
        "subscriber_id": current_user.id
    }).to_list(1000)
    subscribed_channel_ids = [s["channel_id"] for s in subscriptions]
    
    # Build query for posts I can see
    # 1. Public posts from anyone
    # 2. Friends+Followers posts from people I follow or am friends with
    # 3. Friends only posts from friends
    # 4. My own posts
    # 5. Posts from subscribed channels
    
    query = {
        "is_active": True,
        "$or": [
            # Public posts
            {"visibility": "PUBLIC"},
            # My own posts
            {"user_id": current_user.id},
            # Friends only posts from friends
            {
                "visibility": "FRIENDS_ONLY",
                "user_id": {"$in": list(friend_ids)}
            },
            # Friends and followers posts from friends or people I follow
            {
                "visibility": "FRIENDS_AND_FOLLOWERS",
                "user_id": {"$in": list(friend_ids | following_ids)}
            },
            # Posts from subscribed channels
            {"channel_id": {"$in": subscribed_channel_ids}}
        ]
    }
    
    posts = await db.news_posts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich posts with author info
    for post in posts:
        author = await db.users.find_one(
            {"id": post["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        post["author"] = {
            "id": author["id"] if author else None,
            "first_name": author.get("first_name") if author else None,
            "last_name": author.get("last_name") if author else None,
            "profile_picture": author.get("profile_picture") if author else None
        }
        
        # Add channel info if applicable
        if post.get("channel_id"):
            channel = await db.news_channels.find_one(
                {"id": post["channel_id"]},
                {"_id": 0, "name": 1, "avatar_url": 1, "is_verified": 1}
            )
            post["channel"] = channel
        
        # Check if current user liked this post
        liked = await db.news_post_likes.find_one({
            "post_id": post["id"],
            "user_id": current_user.id
        })
        post["is_liked"] = liked is not None
    
    total = await db.news_posts.count_documents(query)
    
    return {
        "posts": posts,
        "total": total,
        "has_more": offset + limit < total
    }

@api_router.get("/news/posts/channel/{channel_id}")
async def get_channel_posts(
    channel_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get posts from a specific channel"""
    channel = await db.news_channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    posts = await db.news_posts.find(
        {"channel_id": channel_id, "is_active": True},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich posts with author info
    for post in posts:
        author = await db.users.find_one(
            {"id": post["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        post["author"] = {
            "id": author["id"] if author else None,
            "first_name": author.get("first_name") if author else None,
            "last_name": author.get("last_name") if author else None,
            "profile_picture": author.get("profile_picture") if author else None
        }
        
        liked = await db.news_post_likes.find_one({
            "post_id": post["id"],
            "user_id": current_user.id
        })
        post["is_liked"] = liked is not None
    
    total = await db.news_posts.count_documents({"channel_id": channel_id, "is_active": True})
    
    return {
        "channel": channel,
        "posts": posts,
        "total": total,
        "has_more": offset + limit < total
    }

@api_router.get("/news/posts/user/{user_id}")
async def get_user_news_posts(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get posts from a specific user (respecting visibility)"""
    
    # Determine relationship
    is_friend = await db.user_friendships.find_one({
        "$or": [
            {"user1_id": min(current_user.id, user_id), "user2_id": max(current_user.id, user_id)}
        ]
    }) is not None
    
    is_following = await db.user_follows.find_one({
        "follower_id": current_user.id,
        "target_id": user_id
    }) is not None
    
    is_self = user_id == current_user.id
    
    # Build visibility query based on relationship
    visibility_conditions = [{"visibility": "PUBLIC"}]
    
    if is_self:
        # Can see all own posts
        visibility_conditions = [{}]  # No visibility filter
    elif is_friend:
        visibility_conditions.append({"visibility": "FRIENDS_ONLY"})
        visibility_conditions.append({"visibility": "FRIENDS_AND_FOLLOWERS"})
    elif is_following:
        visibility_conditions.append({"visibility": "FRIENDS_AND_FOLLOWERS"})
    
    query = {
        "user_id": user_id,
        "is_active": True,
        "channel_id": None,  # Personal posts, not channel posts
        "$or": visibility_conditions
    }
    
    posts = await db.news_posts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich posts
    for post in posts:
        liked = await db.news_post_likes.find_one({
            "post_id": post["id"],
            "user_id": current_user.id
        })
        post["is_liked"] = liked is not None
    
    return {"posts": posts}

@api_router.post("/news/posts/{post_id}/like")
async def like_news_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like a news post"""
    post = await db.news_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing = await db.news_post_likes.find_one({
        "post_id": post_id,
        "user_id": current_user.id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")
    
    await db.news_post_likes.insert_one({
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.news_posts.update_one(
        {"id": post_id},
        {"$inc": {"likes_count": 1}}
    )
    
    return {"message": "Post liked"}

@api_router.delete("/news/posts/{post_id}/like")
async def unlike_news_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Unlike a news post"""
    result = await db.news_post_likes.delete_one({
        "post_id": post_id,
        "user_id": current_user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Like not found")
    
    await db.news_posts.update_one(
        {"id": post_id},
        {"$inc": {"likes_count": -1}}
    )
    
    return {"message": "Post unliked"}

class NewsPostUpdate(BaseModel):
    content: Optional[str] = None
    visibility: Optional[str] = None

@api_router.put("/news/posts/{post_id}")
async def update_news_post(
    post_id: str,
    update_data: NewsPostUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a news post (author only)"""
    post = await db.news_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build update fields
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update_data.content is not None:
        update_fields["content"] = update_data.content
    
    if update_data.visibility is not None:
        update_fields["visibility"] = update_data.visibility
    
    # Update the post
    await db.news_posts.update_one(
        {"id": post_id},
        {"$set": update_fields}
    )
    
    # Get updated post
    updated_post = await db.news_posts.find_one({"id": post_id}, {"_id": 0})
    
    return updated_post

@api_router.delete("/news/posts/{post_id}")
async def delete_news_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a news post (author only)"""
    post = await db.news_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Soft delete
    await db.news_posts.update_one(
        {"id": post_id},
        {"$set": {"is_active": False}}
    )
    
    # Update channel post count if applicable
    if post.get("channel_id"):
        await db.news_channels.update_one(
            {"id": post["channel_id"]},
            {"$inc": {"posts_count": -1}}
        )
    
    return {"message": "Post deleted"}

# ===== NEWS POST COMMENTS =====

class NewsCommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None

@api_router.get("/news/posts/{post_id}/comments")
async def get_news_post_comments(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get comments for a news post"""
    post = await db.news_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get all comments for this post
    comments = await db.news_post_comments.find({
        "post_id": post_id,
        "is_deleted": {"$ne": True}
    }).sort("created_at", 1).to_list(None)
    
    # Build response with author info and nested replies
    comments_dict = {}
    top_level_comments = []
    
    for comment in comments:
        comment.pop("_id", None)
        
        # Get author info - handle ERIC AI special case
        if comment["user_id"] == "eric-ai":
            comment["author"] = {
                "id": "eric-ai",
                "first_name": "ERIC",
                "last_name": "AI",
                "profile_picture": "/eric-avatar.jpg"
            }
        else:
            author = await get_user_by_id(comment["user_id"])
            comment["author"] = {
                "id": author.id if author else "",
                "first_name": author.first_name if author else "Deleted",
                "last_name": author.last_name if author else "User",
                "profile_picture": author.profile_picture if author else None
            }
        
        # Check if current user liked this comment
        liked = await db.news_comment_likes.find_one({
            "comment_id": comment["id"],
            "user_id": current_user.id
        })
        comment["user_liked"] = liked is not None
        
        comment["replies"] = []
        comments_dict[comment["id"]] = comment
        
        if comment.get("parent_comment_id"):
            parent = comments_dict.get(comment["parent_comment_id"])
            if parent:
                parent["replies"].append(comment)
        else:
            top_level_comments.append(comment)
    
    return {"comments": top_level_comments, "total": len(top_level_comments)}

@api_router.post("/news/posts/{post_id}/comments")
async def create_news_post_comment(
    post_id: str,
    comment_data: NewsCommentCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a comment on a news post"""
    post = await db.news_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Validate parent comment if provided
    if comment_data.parent_comment_id:
        parent = await db.news_post_comments.find_one({"id": comment_data.parent_comment_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    
    # Create comment
    new_comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user.id,
        "content": comment_data.content,
        "parent_comment_id": comment_data.parent_comment_id,
        "likes_count": 0,
        "replies_count": 0,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.news_post_comments.insert_one(new_comment)
    
    # Update counts
    if comment_data.parent_comment_id:
        await db.news_post_comments.update_one(
            {"id": comment_data.parent_comment_id},
            {"$inc": {"replies_count": 1}}
        )
    else:
        await db.news_posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
    
    # Create notification
    notification_user_id = post["user_id"]
    if comment_data.parent_comment_id:
        parent = await db.news_post_comments.find_one({"id": comment_data.parent_comment_id})
        if parent:
            notification_user_id = parent["user_id"]
    
    if notification_user_id != current_user.id:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": notification_user_id,
            "sender_id": current_user.id,
            "type": "reply" if comment_data.parent_comment_id else "comment",
            "title": "Новый комментарий",
            "message": f"{current_user.first_name} {current_user.last_name} {'ответил на ваш комментарий' if comment_data.parent_comment_id else 'прокомментировал ваш пост'}",
            "related_post_id": post_id,
            "related_comment_id": new_comment["id"],
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    # Return with author info
    new_comment.pop("_id", None)
    new_comment["author"] = {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "profile_picture": current_user.profile_picture
    }
    new_comment["user_liked"] = False
    new_comment["replies"] = []
    
    return new_comment

@api_router.delete("/news/comments/{comment_id}")
async def delete_news_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a news post comment"""
    comment = await db.news_post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Soft delete
    await db.news_post_comments.update_one(
        {"id": comment_id},
        {"$set": {"is_deleted": True}}
    )
    
    # Update counts
    if comment.get("parent_comment_id"):
        await db.news_post_comments.update_one(
            {"id": comment["parent_comment_id"]},
            {"$inc": {"replies_count": -1}}
        )
    else:
        await db.news_posts.update_one(
            {"id": comment["post_id"]},
            {"$inc": {"comments_count": -1}}
        )
    
    return {"message": "Comment deleted"}


class EditCommentRequest(BaseModel):
    content: str


@api_router.put("/news/comments/{comment_id}")
async def edit_news_comment(
    comment_id: str,
    request: EditCommentRequest,
    current_user: User = Depends(get_current_user)
):
    """Edit a news post comment"""
    comment = await db.news_post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    
    # Update the comment
    await db.news_post_comments.update_one(
        {"id": comment_id},
        {
            "$set": {
                "content": request.content,
                "is_edited": True,
                "edited_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Return updated comment
    updated_comment = await db.news_post_comments.find_one({"id": comment_id}, {"_id": 0})
    return updated_comment


@api_router.post("/news/comments/{comment_id}/like")
async def like_news_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Like/unlike a news comment"""
    comment = await db.news_post_comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    existing_like = await db.news_comment_likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user.id
    })
    
    if existing_like:
        # Unlike
        await db.news_comment_likes.delete_one({"_id": existing_like["_id"]})
        await db.news_post_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"liked": False, "likes_count": comment["likes_count"] - 1}
    else:
        # Like
        await db.news_comment_likes.insert_one({
            "id": str(uuid.uuid4()),
            "comment_id": comment_id,
            "user_id": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.news_post_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": 1}}
        )
        return {"liked": True, "likes_count": comment["likes_count"] + 1}

# ===== OFFICIAL CHANNELS (Organization-linked) =====

@api_router.post("/news/channels/{channel_id}/link-organization")
async def link_channel_to_organization(
    channel_id: str,
    organization_id: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Link a channel to an organization for verification (must be org admin)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not channel owner")
    
    # Check if user is admin of the organization
    org = await db.work_organizations.find_one({"id": organization_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    membership = await db.work_memberships.find_one({
        "user_id": current_user.id,
        "organization_id": organization_id,
        "status": "ACTIVE"
    })
    
    if not membership or membership.get("role") not in ["OWNER", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Must be organization admin")
    
    # Link channel to organization
    await db.news_channels.update_one(
        {"id": channel_id},
        {"$set": {
            "organization_id": organization_id,
            "is_verified": True,
            "is_official": True
        }}
    )
    
    return {"message": "Channel linked to organization and verified"}

# ===== CHANNEL MODERATOR MANAGEMENT =====

class AddModeratorRequest(BaseModel):
    user_id: str
    can_post: bool = True
    can_delete_posts: bool = True
    can_pin_posts: bool = True

@api_router.get("/news/channels/{channel_id}/moderators")
async def get_channel_moderators(
    channel_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all moderators for a channel"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    moderators = await db.channel_moderators.find(
        {"channel_id": channel_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with user info
    for mod in moderators:
        user = await db.users.find_one(
            {"id": mod["user_id"]},
            {"_id": 0, "password_hash": 0}
        )
        if user:
            mod["user"] = {
                "id": user.get("id"),
                "first_name": user.get("first_name"),
                "last_name": user.get("last_name"),
                "profile_picture": user.get("profile_picture"),
                "email": user.get("email")
            }
        else:
            mod["user"] = None
    
    return {"moderators": moderators}

@api_router.post("/news/channels/{channel_id}/moderators")
async def add_channel_moderator(
    channel_id: str,
    mod_data: AddModeratorRequest,
    current_user: User = Depends(get_current_user)
):
    """Add a moderator to a channel (owner only)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only channel owner can add moderators")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": mod_data.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already a moderator
    existing = await db.channel_moderators.find_one({
        "channel_id": channel_id,
        "user_id": mod_data.user_id,
        "is_active": True
    })
    if existing:
        raise HTTPException(status_code=400, detail="User is already a moderator")
    
    # Don't add owner as moderator
    if mod_data.user_id == channel["owner_id"]:
        raise HTTPException(status_code=400, detail="Channel owner doesn't need to be added as moderator")
    
    # Create moderator entry
    moderator = ChannelModerator(
        channel_id=channel_id,
        user_id=mod_data.user_id,
        assigned_by=current_user.id,
        can_post=mod_data.can_post,
        can_delete_posts=mod_data.can_delete_posts,
        can_pin_posts=mod_data.can_pin_posts
    )
    
    await db.channel_moderators.insert_one(moderator.model_dump())
    
    return {
        "message": "Moderator added successfully",
        "moderator": moderator.model_dump()
    }

@api_router.delete("/news/channels/{channel_id}/moderators/{user_id}")
async def remove_channel_moderator(
    channel_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a moderator from a channel (owner only)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only channel owner can remove moderators")
    
    result = await db.channel_moderators.update_one(
        {"channel_id": channel_id, "user_id": user_id, "is_active": True},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Moderator not found")
    
    return {"message": "Moderator removed successfully"}

@api_router.put("/news/channels/{channel_id}/moderators/{user_id}")
async def update_moderator_permissions(
    channel_id: str,
    user_id: str,
    mod_data: AddModeratorRequest,
    current_user: User = Depends(get_current_user)
):
    """Update moderator permissions (owner only)"""
    channel = await db.news_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only channel owner can update moderator permissions")
    
    result = await db.channel_moderators.update_one(
        {"channel_id": channel_id, "user_id": user_id, "is_active": True},
        {"$set": {
            "can_post": mod_data.can_post,
            "can_delete_posts": mod_data.can_delete_posts,
            "can_pin_posts": mod_data.can_pin_posts
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Moderator not found")
    
    return {"message": "Moderator permissions updated"}

# ===== USER ADMIN ORGANIZATIONS =====

@api_router.get("/users/me/admin-organizations")
async def get_my_admin_organizations(
    current_user: User = Depends(get_current_user)
):
    """Get organizations where the current user is admin or owner"""
    # Check for admin flag or executive roles
    admin_roles = ["OWNER", "ADMIN", "CEO", "CTO", "CFO", "COO", "FOUNDER", "CO_FOUNDER", "PRESIDENT"]
    
    memberships = await db.work_members.find({
        "user_id": current_user.id,
        "status": "ACTIVE",
        "$or": [
            {"is_admin": True},
            {"role": {"$in": admin_roles}}
        ]
    }, {"_id": 0}).to_list(100)
    
    org_ids = [m["organization_id"] for m in memberships]
    
    if not org_ids:
        return {"organizations": []}
    
    organizations = await db.work_organizations.find(
        {"id": {"$in": org_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"organizations": organizations}

# ===== END NEWS MODULE ENDPOINTS =====

# ===== SERVICES MODULE =====

# Service Categories (Standard List)
SERVICE_CATEGORIES = {
    "beauty": {
        "name": "Красота и здоровье",
        "name_en": "Beauty & Wellness",
        "icon": "Sparkles",
        "subcategories": [
            {"id": "beauty_salon", "name": "Салоны красоты", "name_en": "Beauty Salons"},
            {"id": "barbershop", "name": "Барбершопы", "name_en": "Barbershops"},
            {"id": "spa_massage", "name": "СПА и массаж", "name_en": "Spa & Massage"},
            {"id": "nail_services", "name": "Маникюр/Педикюр", "name_en": "Nail Services"},
            {"id": "fitness_yoga", "name": "Фитнес и йога", "name_en": "Fitness & Yoga"}
        ]
    },
    "medical": {
        "name": "Медицина и здоровье",
        "name_en": "Medical & Health",
        "icon": "Stethoscope",
        "subcategories": [
            {"id": "dental", "name": "Стоматология", "name_en": "Dental Clinics"},
            {"id": "medical_center", "name": "Медицинские центры", "name_en": "Medical Centers"},
            {"id": "veterinary", "name": "Ветеринарные клиники", "name_en": "Veterinary"},
            {"id": "psychology", "name": "Психология", "name_en": "Psychology"},
            {"id": "optical", "name": "Оптика", "name_en": "Optical"}
        ]
    },
    "food": {
        "name": "Еда и рестораны",
        "name_en": "Food & Dining",
        "icon": "UtensilsCrossed",
        "subcategories": [
            {"id": "restaurant", "name": "Рестораны", "name_en": "Restaurants"},
            {"id": "cafe", "name": "Кафе", "name_en": "Cafes"},
            {"id": "food_delivery", "name": "Доставка еды", "name_en": "Food Delivery"},
            {"id": "catering", "name": "Кейтеринг", "name_en": "Catering"},
            {"id": "bakery", "name": "Кондитерские", "name_en": "Bakeries"}
        ]
    },
    "auto": {
        "name": "Авто услуги",
        "name_en": "Auto Services",
        "icon": "Car",
        "subcategories": [
            {"id": "auto_repair", "name": "Автосервис", "name_en": "Auto Repair"},
            {"id": "car_wash", "name": "Автомойка", "name_en": "Car Wash"},
            {"id": "tire_service", "name": "Шиномонтаж", "name_en": "Tire Service"},
            {"id": "towing", "name": "Эвакуатор", "name_en": "Towing"}
        ]
    },
    "home": {
        "name": "Дом и ремонт",
        "name_en": "Home Services",
        "icon": "Home",
        "subcategories": [
            {"id": "cleaning", "name": "Клининг", "name_en": "Cleaning"},
            {"id": "renovation", "name": "Ремонт квартир", "name_en": "Home Renovation"},
            {"id": "plumbing", "name": "Сантехника", "name_en": "Plumbing"},
            {"id": "electrical", "name": "Электрика", "name_en": "Electrical"},
            {"id": "furniture", "name": "Мебель на заказ", "name_en": "Custom Furniture"}
        ]
    },
    "education": {
        "name": "Образование",
        "name_en": "Education & Training",
        "icon": "GraduationCap",
        "subcategories": [
            {"id": "tutors", "name": "Репетиторы", "name_en": "Tutors"},
            {"id": "language_school", "name": "Языковые школы", "name_en": "Language Schools"},
            {"id": "courses", "name": "Курсы и тренинги", "name_en": "Courses & Training"},
            {"id": "children_center", "name": "Детские центры", "name_en": "Children's Centers"}
        ]
    },
    "professional": {
        "name": "Профессиональные услуги",
        "name_en": "Professional Services",
        "icon": "Briefcase",
        "subcategories": [
            {"id": "legal", "name": "Юридические услуги", "name_en": "Legal Services"},
            {"id": "accounting", "name": "Бухгалтерия", "name_en": "Accounting"},
            {"id": "notary", "name": "Нотариус", "name_en": "Notary"},
            {"id": "translation", "name": "Переводы", "name_en": "Translation"}
        ]
    },
    "events": {
        "name": "Мероприятия",
        "name_en": "Events & Entertainment",
        "icon": "PartyPopper",
        "subcategories": [
            {"id": "event_planning", "name": "Организация мероприятий", "name_en": "Event Planning"},
            {"id": "photo_video", "name": "Фото и видео", "name_en": "Photo & Video"},
            {"id": "mc_dj", "name": "Ведущие и DJ", "name_en": "MCs & DJs"},
            {"id": "venue_rental", "name": "Аренда площадок", "name_en": "Venue Rental"}
        ]
    },
    "pets": {
        "name": "Услуги для животных",
        "name_en": "Pet Services",
        "icon": "PawPrint",
        "subcategories": [
            {"id": "grooming", "name": "Груминг", "name_en": "Pet Grooming"},
            {"id": "pet_boarding", "name": "Передержка", "name_en": "Pet Boarding"},
            {"id": "pet_training", "name": "Дрессировка", "name_en": "Pet Training"}
        ]
    },
    "other": {
        "name": "Другие услуги",
        "name_en": "Other Services",
        "icon": "MoreHorizontal",
        "subcategories": [
            {"id": "it_services", "name": "IT услуги", "name_en": "IT Services"},
            {"id": "tech_repair", "name": "Ремонт техники", "name_en": "Tech Repair"},
            {"id": "courier", "name": "Курьерские услуги", "name_en": "Courier"},
            {"id": "printing", "name": "Печать и полиграфия", "name_en": "Printing"}
        ]
    }
}

# Service Listing Status
class ServiceStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ARCHIVED = "ARCHIVED"

# Booking Status
class BookingStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"

# Service Listing Model
class ServiceListing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str  # Link to WorkOrganization
    owner_user_id: str  # User who created the listing
    
    # Basic Info
    name: str
    description: str
    short_description: Optional[str] = None
    
    # Category
    category_id: str  # e.g., "beauty", "medical"
    subcategory_id: str  # e.g., "dental", "barbershop"
    
    # Pricing
    price_from: Optional[float] = None
    price_to: Optional[float] = None
    price_type: str = "fixed"  # "fixed", "hourly", "from", "negotiable"
    currency: str = "RUB"
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    accept_altyn: bool = False  # Whether to accept ALTYN COIN payment
    
    # Location
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = "Russia"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Contact
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    
    # Working Hours
    working_hours: Optional[Dict[str, Any]] = None  # {"monday": {"open": "09:00", "close": "18:00"}, ...}
    
    # Media
    images: List[str] = []
    logo: Optional[str] = None
    
    # Booking Settings
    accepts_online_booking: bool = True
    booking_duration_minutes: int = 60  # Default appointment duration
    booking_advance_days: int = 30  # How far in advance can book
    
    # Status & Stats
    status: ServiceStatus = ServiceStatus.ACTIVE
    rating: float = 0.0
    review_count: int = 0
    view_count: int = 0
    booking_count: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Tags for search
    tags: List[str] = []

class ServiceListingCreate(BaseModel):
    organization_id: str
    name: str
    description: str
    short_description: Optional[str] = None
    category_id: str
    subcategory_id: str
    price_from: Optional[float] = None
    price_to: Optional[float] = None
    price_type: str = "fixed"
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    accept_altyn: bool = False  # Whether to accept ALTYN COIN payment
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    working_hours: Optional[Dict[str, Any]] = None
    images: List[str] = []
    logo: Optional[str] = None
    accepts_online_booking: bool = True
    booking_duration_minutes: int = 60
    tags: List[str] = []

class ServiceListingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    price_from: Optional[float] = None
    price_to: Optional[float] = None
    price_type: Optional[str] = None
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    accept_altyn: Optional[bool] = None  # Whether to accept ALTYN COIN payment
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    working_hours: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    logo: Optional[str] = None
    accepts_online_booking: Optional[bool] = None
    booking_duration_minutes: Optional[int] = None
    booking_advance_days: Optional[int] = None
    status: Optional[ServiceStatus] = None
    tags: Optional[List[str]] = None

# Service Booking Model
class ServiceBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str
    organization_id: str
    client_user_id: str
    provider_user_id: str  # Owner of the service
    
    # Booking Details
    booking_date: datetime
    duration_minutes: int = 60
    
    # Client Info
    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_notes: Optional[str] = None
    
    # Status
    status: BookingStatus = BookingStatus.PENDING
    
    # Provider Notes
    provider_notes: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ServiceBookingCreate(BaseModel):
    service_id: str
    booking_date: datetime
    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_notes: Optional[str] = None

# Service Review Model
class ServiceReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    service_id: str
    organization_id: str
    user_id: str
    booking_id: Optional[str] = None  # Link to completed booking
    
    # Review Content
    rating: int  # 1-5
    title: Optional[str] = None
    content: str
    
    # Provider Response
    provider_response: Optional[str] = None
    provider_response_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceReviewCreate(BaseModel):
    service_id: str
    rating: int
    title: Optional[str] = None
    content: str
    booking_id: Optional[str] = None

# ===== SERVICES API ENDPOINTS =====

@api_router.get("/services/categories")
async def get_service_categories():
    """Get all service categories and subcategories"""
    return {"categories": SERVICE_CATEGORIES}

@api_router.post("/services/listings")
async def create_service_listing(
    listing_data: ServiceListingCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new service listing (requires organization membership)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")  # JWT uses 'sub' for user_id
        
        # Verify user is a member/admin of the organization - check both membership collection and org members list
        membership = await db.work_organization_members.find_one({
            "user_id": user_id,
            "organization_id": listing_data.organization_id,
            "status": "ACTIVE"
        }, {"_id": 0})
        
        # Also check if user is in the organization's members array
        if not membership:
            org_check = await db.work_organizations.find_one({
                "id": listing_data.organization_id,
                "members.user_id": user_id
            }, {"_id": 0, "id": 1})
            if org_check:
                membership = True  # User is a member via org's members array
        
        if not membership:
            raise HTTPException(status_code=403, detail="You must be a member of the organization to create listings")
        
        # Verify organization exists
        organization = await db.work_organizations.find_one({"id": listing_data.organization_id}, {"_id": 0, "id": 1, "name": 1})
        if not organization:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        # Create listing
        listing = ServiceListing(
            **listing_data.dict(),
            owner_user_id=user_id
        )
        
        listing_dict = listing.dict()
        listing_dict["created_at"] = listing_dict["created_at"].isoformat()
        listing_dict["updated_at"] = listing_dict["updated_at"].isoformat()
        
        await db.service_listings.insert_one(listing_dict)
        
        # Return without _id
        if "_id" in listing_dict:
            del listing_dict["_id"]
        
        return {"success": True, "listing": listing_dict}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/services/listings")
async def get_service_listings(
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    min_rating: Optional[float] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "rating"  # "rating", "price", "newest", "popular"
):
    """Search and filter service listings"""
    try:
        query = {"status": ServiceStatus.ACTIVE}
        
        if category_id:
            query["category_id"] = category_id
        if subcategory_id:
            query["subcategory_id"] = subcategory_id
        if city:
            query["city"] = {"$regex": city, "$options": "i"}
        if min_rating:
            query["rating"] = {"$gte": min_rating}
        if price_min is not None:
            query["price_from"] = {"$gte": price_min}
        if price_max is not None:
            query["$or"] = [
                {"price_to": {"$lte": price_max}},
                {"price_from": {"$lte": price_max}}
            ]
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"tags": {"$in": [search.lower()]}}
            ]
        
        # Sorting
        sort_options = {
            "rating": [("rating", -1), ("review_count", -1)],
            "price": [("price_from", 1)],
            "newest": [("created_at", -1)],
            "popular": [("view_count", -1), ("booking_count", -1)]
        }
        sort = sort_options.get(sort_by, sort_options["rating"])
        
        listings = await db.service_listings.find(query, {"_id": 0}).sort(sort).skip(skip).limit(limit).to_list(limit)
        total = await db.service_listings.count_documents(query)
        
        # Enrich with organization info
        for listing in listings:
            org = await db.work_organizations.find_one({"id": listing["organization_id"]}, {"_id": 0, "name": 1, "logo": 1})
            if org:
                listing["organization_name"] = org.get("name")
                listing["organization_logo"] = org.get("logo")
        
        return {
            "listings": listings,
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/services/listings/{listing_id}")
async def get_service_listing(listing_id: str):
    """Get a single service listing with full details"""
    try:
        listing = await db.service_listings.find_one({"id": listing_id}, {"_id": 0})
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        # Increment view count
        await db.service_listings.update_one(
            {"id": listing_id},
            {"$inc": {"view_count": 1}}
        )
        
        # Get organization info
        org = await db.work_organizations.find_one({"id": listing["organization_id"]}, {"_id": 0})
        if org:
            listing["organization"] = org
        
        # Get recent reviews
        reviews = await db.service_reviews.find(
            {"service_id": listing_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        # Enrich reviews with user info
        for review in reviews:
            user = await db.users.find_one({"id": review["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
            if user:
                review["user"] = user
        
        listing["recent_reviews"] = reviews
        
        return {"listing": listing}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/services/listings/{listing_id}")
async def update_service_listing(
    listing_id: str,
    update_data: ServiceListingUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update a service listing"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Verify ownership
        listing = await db.service_listings.find_one({"id": listing_id})
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing["owner_user_id"] != user_id:
            # Check if admin of org
            membership = await db.work_organization_members.find_one({
                "user_id": user_id,
                "organization_id": listing["organization_id"],
                "is_admin": True
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Not authorized to update this listing")
        
        # Update
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.service_listings.update_one(
            {"id": listing_id},
            {"$set": update_dict}
        )
        
        updated = await db.service_listings.find_one({"id": listing_id}, {"_id": 0})
        return {"success": True, "listing": updated}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/services/my-listings")
async def get_my_service_listings(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all service listings owned by the current user or their organizations"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get user's organizations
        memberships = await db.work_organization_members.find({
            "user_id": user_id,
            "status": "ACTIVE"
        }).to_list(100)
        
        org_ids = [m["organization_id"] for m in memberships]
        
        # Get listings from user's organizations
        listings = await db.service_listings.find(
            {"organization_id": {"$in": org_ids}},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Enrich with org info
        for listing in listings:
            org = await db.work_organizations.find_one({"id": listing["organization_id"]}, {"_id": 0, "name": 1})
            if org:
                listing["organization_name"] = org.get("name")
        
        return {"listings": listings}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===== BOOKING ENDPOINTS =====

@api_router.post("/services/bookings")
async def create_service_booking(
    booking_data: ServiceBookingCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new service booking"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get listing
        listing = await db.service_listings.find_one({"id": booking_data.service_id})
        if not listing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        if not listing.get("accepts_online_booking", True):
            raise HTTPException(status_code=400, detail="This service does not accept online booking")
        
        # Check for conflicts (same time slot)
        duration_minutes = listing.get("booking_duration_minutes", 60)
        booking_start_str = booking_data.booking_date.isoformat()
        booking_end = booking_data.booking_date + timedelta(minutes=duration_minutes)
        booking_end_str = booking_end.isoformat()
        
        # Get all bookings for this service on this day that are pending or confirmed
        existing_bookings = await db.service_bookings.find({
            "service_id": booking_data.service_id,
            "status": {"$in": [BookingStatus.PENDING, BookingStatus.CONFIRMED]}
        }, {"_id": 0, "booking_date": 1, "duration_minutes": 1}).to_list(100)
        
        # Check for overlap with existing bookings
        conflict = False
        for existing in existing_bookings:
            try:
                existing_start = datetime.fromisoformat(existing["booking_date"].replace("Z", "+00:00"))
                existing_duration = existing.get("duration_minutes", 60)
                existing_end = existing_start + timedelta(minutes=existing_duration)
                
                # Check overlap: new booking overlaps if it starts before existing ends AND ends after existing starts
                if booking_data.booking_date < existing_end and booking_end > existing_start:
                    conflict = True
                    break
            except (ValueError, TypeError):
                continue
        
        if conflict:
            raise HTTPException(status_code=400, detail="This time slot is not available")
        
        # Create booking
        booking = ServiceBooking(
            service_id=booking_data.service_id,
            organization_id=listing["organization_id"],
            client_user_id=user_id,
            provider_user_id=listing["owner_user_id"],
            booking_date=booking_data.booking_date,
            duration_minutes=listing.get("booking_duration_minutes", 60),
            client_name=booking_data.client_name,
            client_phone=booking_data.client_phone,
            client_email=booking_data.client_email,
            client_notes=booking_data.client_notes
        )
        
        booking_dict = booking.dict()
        booking_dict["booking_date"] = booking_dict["booking_date"].isoformat()
        booking_dict["created_at"] = booking_dict["created_at"].isoformat()
        booking_dict["updated_at"] = booking_dict["updated_at"].isoformat()
        
        await db.service_bookings.insert_one(booking_dict)
        
        # Remove _id added by MongoDB for response
        booking_dict.pop("_id", None)
        
        # Increment booking count
        await db.service_listings.update_one(
            {"id": booking_data.service_id},
            {"$inc": {"booking_count": 1}}
        )
        
        return {"success": True, "booking": booking_dict}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/services/bookings/my")
async def get_my_bookings(
    status: Optional[str] = None,
    as_provider: bool = False,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get bookings - either as client or as provider"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        query = {}
        if as_provider:
            query["provider_user_id"] = user_id
        else:
            query["client_user_id"] = user_id
        
        if status:
            query["status"] = status
        
        bookings = await db.service_bookings.find(query, {"_id": 0}).sort("booking_date", -1).to_list(100)
        
        # Enrich with service info
        for booking in bookings:
            listing = await db.service_listings.find_one({"id": booking["service_id"]}, {"_id": 0, "name": 1, "organization_id": 1})
            if listing:
                booking["service_name"] = listing.get("name")
                org = await db.work_organizations.find_one({"id": listing["organization_id"]}, {"_id": 0, "name": 1})
                if org:
                    booking["organization_name"] = org.get("name")
        
        return {"bookings": bookings}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.put("/services/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    new_status: BookingStatus,
    provider_notes: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update booking status (confirm, cancel, complete)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        booking = await db.service_bookings.find_one({"id": booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Check authorization
        is_provider = booking["provider_user_id"] == user_id
        is_client = booking["client_user_id"] == user_id
        
        if not is_provider and not is_client:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Status transition rules
        current_status = booking["status"]
        
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if new_status == BookingStatus.CONFIRMED:
            update_data["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        elif new_status == BookingStatus.CANCELLED:
            update_data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        elif new_status == BookingStatus.COMPLETED:
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        if provider_notes:
            update_data["provider_notes"] = provider_notes
        
        await db.service_bookings.update_one(
            {"id": booking_id},
            {"$set": update_data}
        )
        
        return {"success": True, "status": new_status}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/services/bookings/available-slots/{service_id}")
async def get_available_slots(
    service_id: str,
    date: str  # Format: YYYY-MM-DD
):
    """Get available booking slots for a service on a specific date"""
    try:
        listing = await db.service_listings.find_one({"id": service_id}, {"_id": 0})
        if not listing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Parse date
        target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        day_of_week = target_date.strftime("%A").lower()
        
        # Get working hours for this day (default to 9-18 if not set)
        working_hours = listing.get("working_hours") or {}
        default_hours = {"open": "09:00", "close": "18:00"}
        day_hours = working_hours.get(day_of_week, default_hours) if working_hours else default_hours
        
        if not day_hours or day_hours.get("closed"):
            return {"slots": [], "message": "Closed on this day"}
        
        # Generate slots
        duration = listing.get("booking_duration_minutes", 60)
        open_time = datetime.strptime(day_hours["open"], "%H:%M")
        close_time = datetime.strptime(day_hours["close"], "%H:%M")
        
        slots = []
        current = open_time
        while current + timedelta(minutes=duration) <= close_time:
            slot_start = target_date.replace(hour=current.hour, minute=current.minute)
            slots.append({
                "start": slot_start.isoformat(),
                "end": (slot_start + timedelta(minutes=duration)).isoformat(),
                "available": True
            })
            current += timedelta(minutes=duration)
        
        # Check existing bookings
        day_start = target_date.replace(hour=0, minute=0, second=0)
        day_end = target_date.replace(hour=23, minute=59, second=59)
        
        bookings = await db.service_bookings.find({
            "service_id": service_id,
            "status": {"$in": [BookingStatus.PENDING, BookingStatus.CONFIRMED]},
            "booking_date": {"$gte": day_start.isoformat(), "$lte": day_end.isoformat()}
        }, {"_id": 0, "booking_date": 1, "duration_minutes": 1}).to_list(100)
        
        # Mark unavailable slots
        for booking in bookings:
            booking_start = datetime.fromisoformat(booking["booking_date"].replace("Z", "+00:00"))
            booking_end = booking_start + timedelta(minutes=booking.get("duration_minutes", 60))
            
            for slot in slots:
                slot_start = datetime.fromisoformat(slot["start"].replace("Z", "+00:00"))
                slot_end = datetime.fromisoformat(slot["end"].replace("Z", "+00:00"))
                
                # Check overlap
                if slot_start < booking_end and slot_end > booking_start:
                    slot["available"] = False
        
        return {"slots": slots, "duration_minutes": duration}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting slots: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== REVIEW ENDPOINTS =====

@api_router.post("/services/reviews")
async def create_service_review(
    review_data: ServiceReviewCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a review for a service"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get listing
        listing = await db.service_listings.find_one({"id": review_data.service_id})
        if not listing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Check if user already reviewed
        existing = await db.service_reviews.find_one({
            "service_id": review_data.service_id,
            "user_id": user_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="You have already reviewed this service")
        
        # Create review
        review = ServiceReview(
            service_id=review_data.service_id,
            organization_id=listing["organization_id"],
            user_id=user_id,
            rating=min(5, max(1, review_data.rating)),  # Clamp 1-5
            title=review_data.title,
            content=review_data.content,
            booking_id=review_data.booking_id
        )
        
        review_dict = review.dict()
        review_dict["created_at"] = review_dict["created_at"].isoformat()
        review_dict["updated_at"] = review_dict["updated_at"].isoformat()
        
        await db.service_reviews.insert_one(review_dict)
        
        # Update service rating
        all_reviews = await db.service_reviews.find({"service_id": review_data.service_id}).to_list(1000)
        avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        
        await db.service_listings.update_one(
            {"id": review_data.service_id},
            {"$set": {"rating": round(avg_rating, 1), "review_count": len(all_reviews)}}
        )
        
        # Remove MongoDB _id field before returning
        if "_id" in review_dict:
            del review_dict["_id"]
        
        return {"success": True, "review": review_dict}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/services/reviews/{service_id}")
async def get_service_reviews(
    service_id: str,
    skip: int = 0,
    limit: int = 20
):
    """Get reviews for a service"""
    try:
        reviews = await db.service_reviews.find(
            {"service_id": service_id},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich with user info
        for review in reviews:
            user = await db.users.find_one(
                {"id": review["user_id"]},
                {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1}
            )
            if user:
                review["user"] = user
        
        total = await db.service_reviews.count_documents({"service_id": service_id})
        
        return {"reviews": reviews, "total": total}
        
    except Exception as e:
        logger.error(f"Error getting reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProviderReplyRequest(BaseModel):
    response: str

@api_router.post("/services/reviews/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    reply_data: ProviderReplyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Provider replies to a review"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get review
        review = await db.service_reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        
        # Check if user is the provider (owns the listing or organization)
        listing = await db.service_listings.find_one({"id": review["service_id"]})
        if not listing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Check if user is a member of the organization with admin rights
        member = await db.work_organization_members.find_one({
            "organization_id": listing["organization_id"],
            "user_id": user_id,
            "is_active": True
        })
        
        if not member:
            raise HTTPException(status_code=403, detail="Not authorized to reply")
        
        # Update review with provider response
        await db.service_reviews.update_one(
            {"id": review_id},
            {
                "$set": {
                    "provider_response": reply_data.response,
                    "provider_response_at": datetime.now(timezone.utc).isoformat(),
                    "provider_response_by": user_id
                }
            }
        )
        
        return {"success": True}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying to review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/services/reviews/{review_id}/helpful")
async def mark_review_helpful(
    review_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Mark a review as helpful"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get review
        review = await db.service_reviews.find_one({"id": review_id})
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        
        # Check if user already marked as helpful
        helpful_by = review.get("helpful_by", [])
        if user_id in helpful_by:
            # Remove helpful vote
            await db.service_reviews.update_one(
                {"id": review_id},
                {
                    "$pull": {"helpful_by": user_id},
                    "$inc": {"helpful_count": -1}
                }
            )
            return {"success": True, "action": "removed"}
        else:
            # Add helpful vote
            await db.service_reviews.update_one(
                {"id": review_id},
                {
                    "$push": {"helpful_by": user_id},
                    "$inc": {"helpful_count": 1}
                }
            )
            return {"success": True, "action": "added"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error marking helpful: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== END SERVICES MODULE =====

# ===== MARKETPLACE MODULE (ВЕЩИ) =====

# Marketplace Enums
class ProductCondition(str, Enum):
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"

class ProductStatus(str, Enum):
    ACTIVE = "active"
    SOLD = "sold"
    RESERVED = "reserved"
    ARCHIVED = "archived"

class SellerType(str, Enum):
    INDIVIDUAL = "individual"
    ORGANIZATION = "organization"

class InventoryCategory(str, Enum):
    SMART_THINGS = "smart_things"
    WARDROBE = "wardrobe"
    GARAGE = "garage"
    HOME = "home"
    ELECTRONICS = "electronics"
    COLLECTION = "collection"

# Marketplace Product Model
class MarketplaceProduct(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str  # User ID
    seller_type: SellerType = SellerType.INDIVIDUAL
    organization_id: Optional[str] = None  # If seller is organization
    
    # Basic Info
    title: str
    description: str
    category: str  # e.g., "electronics", "clothing", etc.
    subcategory: Optional[str] = None
    
    # Pricing
    price: float
    currency: str = "RUB"
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    accept_altyn: bool = False  # Whether to accept ALTYN COIN payment
    negotiable: bool = False
    
    # Condition
    condition: ProductCondition = ProductCondition.GOOD
    
    # Location
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Media
    images: List[str] = []
    
    # Contact
    contact_phone: Optional[str] = None
    contact_method: str = "message"  # "message", "phone", "both"
    
    # Status
    status: ProductStatus = ProductStatus.ACTIVE
    view_count: int = 0
    favorite_count: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Tags
    tags: List[str] = []

class MarketplaceProductCreate(BaseModel):
    title: str
    description: str
    category: str
    subcategory: Optional[str] = None
    price: float
    currency: str = "RUB"
    altyn_price: Optional[float] = None  # Price in ALTYN COIN (optional)
    accept_altyn: bool = False  # Whether to accept ALTYN COIN payment
    negotiable: bool = False
    condition: ProductCondition = ProductCondition.GOOD
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: List[str] = []
    contact_phone: Optional[str] = None
    contact_method: str = "message"
    tags: List[str] = []
    organization_id: Optional[str] = None  # If selling as organization

class MarketplaceProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    price: Optional[float] = None
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    accept_altyn: Optional[bool] = None  # Whether to accept ALTYN COIN payment
    negotiable: Optional[bool] = None
    condition: Optional[ProductCondition] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    images: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_method: Optional[str] = None
    status: Optional[ProductStatus] = None
    tags: Optional[List[str]] = None

# User Inventory Item Model (My Things)
class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    
    # Basic Info
    name: str
    description: Optional[str] = None
    category: InventoryCategory
    subcategory: Optional[str] = None
    
    # Purchase Info
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    purchase_location: Optional[str] = None
    
    # Warranty
    warranty_expires: Optional[datetime] = None
    warranty_info: Optional[str] = None
    
    # Value Tracking
    current_value: Optional[float] = None
    
    # Media
    images: List[str] = []
    
    # Custom Fields
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    
    # Smart Things specific
    is_smart: bool = False
    smart_platform: Optional[str] = None  # e.g., "Apple HomeKit", "Google Home"
    
    # Tags
    tags: List[str] = []
    
    # Status
    is_for_sale: bool = False
    marketplace_listing_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: InventoryCategory
    subcategory: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    purchase_location: Optional[str] = None
    warranty_expires: Optional[datetime] = None
    warranty_info: Optional[str] = None
    current_value: Optional[float] = None
    images: List[str] = []
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    is_smart: bool = False
    smart_platform: Optional[str] = None
    tags: List[str] = []

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[InventoryCategory] = None
    subcategory: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[float] = None
    purchase_location: Optional[str] = None
    warranty_expires: Optional[datetime] = None
    warranty_info: Optional[str] = None
    current_value: Optional[float] = None
    images: Optional[List[str]] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None
    is_smart: Optional[bool] = None
    smart_platform: Optional[str] = None
    tags: Optional[List[str]] = None

# Marketplace Favorites Model
class MarketplaceFavorite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Marketplace Categories
MARKETPLACE_CATEGORIES = {
    "electronics": {
        "name": "Электроника",
        "icon": "📱",
        "subcategories": ["Телефоны", "Компьютеры", "Планшеты", "Фото и видео", "Аудио", "ТВ и проекторы", "Игровые консоли", "Аксессуары"]
    },
    "clothing": {
        "name": "Одежда и Обувь",
        "icon": "👕",
        "subcategories": ["Мужская одежда", "Женская одежда", "Детская одежда", "Обувь", "Аксессуары", "Спортивная одежда"]
    },
    "home_garden": {
        "name": "Дом и Сад",
        "icon": "🏠",
        "subcategories": ["Мебель", "Бытовая техника", "Посуда", "Декор", "Освещение", "Текстиль", "Сад и огород", "Инструменты"]
    },
    "auto_moto": {
        "name": "Авто и Мото",
        "icon": "🚗",
        "subcategories": ["Автомобили", "Мотоциклы", "Запчасти", "Аксессуары", "Шины и диски", "Автозвук"]
    },
    "kids": {
        "name": "Детские товары",
        "icon": "👶",
        "subcategories": ["Игрушки", "Коляски", "Автокресла", "Мебель", "Одежда", "Питание", "Школьные товары"]
    },
    "sports_leisure": {
        "name": "Спорт и Отдых",
        "icon": "⚽",
        "subcategories": ["Тренажеры", "Велосипеды", "Туризм", "Рыбалка", "Охота", "Зимний спорт", "Водный спорт"]
    },
    "books_hobbies": {
        "name": "Книги и Хобби",
        "icon": "📚",
        "subcategories": ["Книги", "Музыкальные инструменты", "Коллекционирование", "Рукоделие", "Настольные игры", "Антиквариат"]
    }
}

# Inventory Categories Config
INVENTORY_CATEGORIES = {
    "smart_things": {
        "name": "Умные Вещи",
        "icon": "🔌",
        "description": "IoT устройства и умный дом"
    },
    "wardrobe": {
        "name": "Мой Гардероб",
        "icon": "👔",
        "description": "Одежда, обувь и аксессуары"
    },
    "garage": {
        "name": "Мой Гараж",
        "icon": "🚗",
        "description": "Транспорт, инструменты и запчасти"
    },
    "home": {
        "name": "Мой Дом",
        "icon": "🏠",
        "description": "Мебель, техника и декор"
    },
    "electronics": {
        "name": "Моя Электроника",
        "icon": "💻",
        "description": "Телефоны, компьютеры и гаджеты"
    },
    "collection": {
        "name": "Моя Коллекция",
        "icon": "🎨",
        "description": "Коллекционные предметы и хобби"
    }
}

# === MARKETPLACE API ENDPOINTS ===

@api_router.get("/marketplace/categories")
async def get_marketplace_categories():
    """Get all marketplace categories with subcategories"""
    return {"categories": MARKETPLACE_CATEGORIES}

@api_router.get("/marketplace/inventory-categories")
async def get_inventory_categories():
    """Get all inventory (My Things) categories"""
    return {"categories": INVENTORY_CATEGORIES}

@api_router.post("/marketplace/products")
async def create_marketplace_product(
    product_data: MarketplaceProductCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new marketplace product listing"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Get user info
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has family setup (required for individual sellers)
        if not product_data.organization_id:
            # Check family_profiles collection with creator_id
            family = await db.family_profiles.find_one({"creator_id": user_id}, {"_id": 0})
            # Also check family_members collection if user is a member of any family
            if not family:
                family_membership = await db.family_members.find_one({
                    "user_id": user_id, 
                    "is_active": True,
                    "invitation_accepted": True
                }, {"_id": 0})
                if family_membership:
                    family = await db.family_profiles.find_one({"id": family_membership["family_id"]}, {"_id": 0})
            if not family:
                raise HTTPException(
                    status_code=400, 
                    detail="Для продажи необходимо создать семейный профиль в разделе СЕМЬЯ"
                )
        
        # Determine seller type
        seller_type = SellerType.ORGANIZATION if product_data.organization_id else SellerType.INDIVIDUAL
        
        # If organization, verify membership
        if product_data.organization_id:
            org = await db.organizations.find_one({"id": product_data.organization_id}, {"_id": 0})
            if not org:
                raise HTTPException(status_code=404, detail="Organization not found")
            # Check if user is member
            is_member = any(m.get("user_id") == user_id for m in org.get("members", []))
            if org.get("owner_id") != user_id and not is_member:
                raise HTTPException(status_code=403, detail="Not a member of this organization")
        
        product = MarketplaceProduct(
            seller_id=user_id,
            seller_type=seller_type,
            organization_id=product_data.organization_id,
            title=product_data.title,
            description=product_data.description,
            category=product_data.category,
            subcategory=product_data.subcategory,
            price=product_data.price,
            currency=product_data.currency,
            negotiable=product_data.negotiable,
            condition=product_data.condition,
            city=product_data.city or user.get("city"),
            address=product_data.address,
            latitude=product_data.latitude,
            longitude=product_data.longitude,
            images=product_data.images,
            contact_phone=product_data.contact_phone or user.get("phone"),
            contact_method=product_data.contact_method,
            tags=product_data.tags,
            altyn_price=product_data.altyn_price,
            accept_altyn=product_data.accept_altyn
        )
        
        await db.marketplace_products.insert_one(product.dict())
        
        return {"success": True, "product": product.dict()}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/products")
async def get_marketplace_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    city: Optional[str] = None,
    condition: Optional[ProductCondition] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    seller_type: Optional[SellerType] = None,
    sort_by: str = "newest",  # newest, price_asc, price_desc, popular
    skip: int = 0,
    limit: int = 20
):
    """Get marketplace products with filters"""
    try:
        query = {"status": ProductStatus.ACTIVE}
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"tags": {"$in": [search.lower()]}}
            ]
        
        if category:
            query["category"] = category
        if subcategory:
            query["subcategory"] = subcategory
        if city:
            query["city"] = {"$regex": city, "$options": "i"}
        if condition:
            query["condition"] = condition
        if seller_type:
            query["seller_type"] = seller_type
        if min_price is not None:
            query["price"] = query.get("price", {})
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"] = query.get("price", {})
            query["price"]["$lte"] = max_price
        
        # Sorting
        sort = [("created_at", -1)]  # Default: newest
        if sort_by == "price_asc":
            sort = [("price", 1)]
        elif sort_by == "price_desc":
            sort = [("price", -1)]
        elif sort_by == "popular":
            sort = [("view_count", -1)]
        
        products = await db.marketplace_products.find(query, {"_id": 0}).sort(sort).skip(skip).limit(limit).to_list(limit)
        total = await db.marketplace_products.count_documents(query)
        
        # Enrich with seller info
        for product in products:
            seller = await db.users.find_one({"id": product["seller_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
            if seller:
                product["seller_name"] = f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip()
                product["seller_avatar"] = seller.get("profile_picture")
            
            if product.get("organization_id"):
                org = await db.organizations.find_one({"id": product["organization_id"]}, {"_id": 0, "name": 1, "logo": 1})
                if org:
                    product["organization_name"] = org.get("name")
                    product["organization_logo"] = org.get("logo")
        
        return {"products": products, "total": total}
        
    except Exception as e:
        logger.error(f"Error fetching products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/products/{product_id}")
async def get_marketplace_product(product_id: str):
    """Get a single marketplace product by ID"""
    try:
        product = await db.marketplace_products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Increment view count
        await db.marketplace_products.update_one(
            {"id": product_id},
            {"$inc": {"view_count": 1}}
        )
        
        # Enrich with seller info
        seller = await db.users.find_one({"id": product["seller_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1, "phone": 1})
        if seller:
            product["seller_name"] = f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip()
            product["seller_avatar"] = seller.get("profile_picture")
        
        if product.get("organization_id"):
            org = await db.organizations.find_one({"id": product["organization_id"]}, {"_id": 0, "name": 1, "logo": 1})
            if org:
                product["organization_name"] = org.get("name")
                product["organization_logo"] = org.get("logo")
        
        return product
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/marketplace/products/{product_id}")
async def update_marketplace_product(
    product_id: str,
    update_data: MarketplaceProductUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update a marketplace product"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        product = await db.marketplace_products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if product["seller_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update this product")
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.marketplace_products.update_one(
            {"id": product_id},
            {"$set": update_dict}
        )
        
        updated = await db.marketplace_products.find_one({"id": product_id}, {"_id": 0})
        return {"success": True, "product": updated}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/marketplace/products/{product_id}")
async def delete_marketplace_product(
    product_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a marketplace product"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        product = await db.marketplace_products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if product["seller_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this product")
        
        await db.marketplace_products.delete_one({"id": product_id})
        
        # Also remove from favorites
        await db.marketplace_favorites.delete_many({"product_id": product_id})
        
        return {"success": True}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/my-products")
async def get_my_marketplace_products(
    status: Optional[ProductStatus] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current user's marketplace products"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        query = {"seller_id": user_id}
        if status:
            query["status"] = status
        
        products = await db.marketplace_products.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        return {"products": products}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error fetching my products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Favorites
@api_router.post("/marketplace/favorites/{product_id}")
async def toggle_favorite(
    product_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Toggle favorite status for a product"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if product exists
        product = await db.marketplace_products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check existing favorite
        existing = await db.marketplace_favorites.find_one({"user_id": user_id, "product_id": product_id})
        
        if existing:
            # Remove favorite
            await db.marketplace_favorites.delete_one({"id": existing["id"]})
            await db.marketplace_products.update_one({"id": product_id}, {"$inc": {"favorite_count": -1}})
            return {"success": True, "is_favorite": False}
        else:
            # Add favorite
            favorite = MarketplaceFavorite(user_id=user_id, product_id=product_id)
            await db.marketplace_favorites.insert_one(favorite.dict())
            await db.marketplace_products.update_one({"id": product_id}, {"$inc": {"favorite_count": 1}})
            return {"success": True, "is_favorite": True}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/marketplace/favorites")
async def get_favorites(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's favorite products"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        favorites = await db.marketplace_favorites.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        
        # Get product details
        products = []
        for fav in favorites:
            product = await db.marketplace_products.find_one({"id": fav["product_id"]}, {"_id": 0})
            if product:
                product["favorited_at"] = fav["created_at"]
                products.append(product)
        
        return {"products": products}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error fetching favorites: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === INVENTORY (MY THINGS) API ENDPOINTS ===

@api_router.post("/inventory/items")
async def create_inventory_item(
    item_data: InventoryItemCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new inventory item"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        item = InventoryItem(
            user_id=user_id,
            **item_data.dict()
        )
        
        await db.inventory_items.insert_one(item.dict())
        
        return {"success": True, "item": item.dict()}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error creating inventory item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/inventory/items")
async def get_inventory_items(
    category: Optional[InventoryCategory] = None,
    search: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's inventory items"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        query = {"user_id": user_id}
        
        if category:
            query["category"] = category
        
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"brand": {"$regex": search, "$options": "i"}},
                {"model": {"$regex": search, "$options": "i"}}
            ]
        
        items = await db.inventory_items.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
        
        # Get summary by category
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$category",
                "count": {"$sum": 1},
                "total_value": {"$sum": {"$ifNull": ["$current_value", 0]}}
            }}
        ]
        summary = await db.inventory_items.aggregate(pipeline).to_list(10)
        
        return {"items": items, "summary": summary}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error fetching inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/inventory/items/{item_id}")
async def get_inventory_item(
    item_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get a single inventory item"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        item = await db.inventory_items.find_one({"id": item_id, "user_id": user_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        return item
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching inventory item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/inventory/items/{item_id}")
async def update_inventory_item(
    item_id: str,
    update_data: InventoryItemUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update an inventory item"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        item = await db.inventory_items.find_one({"id": item_id, "user_id": user_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.inventory_items.update_one(
            {"id": item_id},
            {"$set": update_dict}
        )
        
        updated = await db.inventory_items.find_one({"id": item_id}, {"_id": 0})
        return {"success": True, "item": updated}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating inventory item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/inventory/items/{item_id}")
async def delete_inventory_item(
    item_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete an inventory item"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        item = await db.inventory_items.find_one({"id": item_id, "user_id": user_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        await db.inventory_items.delete_one({"id": item_id})
        
        return {"success": True}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting inventory item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/inventory/items/{item_id}/list-for-sale")
async def list_item_for_sale(
    item_id: str,
    price: float,
    description: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """List an inventory item for sale on marketplace"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        item = await db.inventory_items.find_one({"id": item_id, "user_id": user_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        if item.get("is_for_sale"):
            raise HTTPException(status_code=400, detail="Item is already listed for sale")
        
        # Map inventory category to marketplace category
        category_map = {
            "smart_things": "electronics",
            "wardrobe": "clothing",
            "garage": "auto_moto",
            "home": "home_garden",
            "electronics": "electronics",
            "collection": "books_hobbies"
        }
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        
        # Create marketplace listing
        product = MarketplaceProduct(
            seller_id=user_id,
            seller_type=SellerType.INDIVIDUAL,
            title=item["name"],
            description=description or item.get("description", ""),
            category=category_map.get(item["category"], "home_garden"),
            price=price,
            condition=ProductCondition.GOOD,
            city=user.get("city") if user else None,
            images=item.get("images", []),
            tags=item.get("tags", [])
        )
        
        await db.marketplace_products.insert_one(product.dict())
        
        # Update inventory item
        await db.inventory_items.update_one(
            {"id": item_id},
            {"$set": {
                "is_for_sale": True,
                "marketplace_listing_id": product.id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"success": True, "product_id": product.id}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing item for sale: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/inventory/expiring-warranties")
async def get_expiring_warranties(
    days: int = 30,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get items with warranties expiring soon"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        cutoff_date = datetime.now(timezone.utc) + timedelta(days=days)
        
        items = await db.inventory_items.find({
            "user_id": user_id,
            "warranty_expires": {"$lte": cutoff_date.isoformat(), "$gte": datetime.now(timezone.utc).isoformat()}
        }, {"_id": 0}).to_list(100)
        
        return {"items": items}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error fetching expiring warranties: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== END MARKETPLACE MODULE =====

# ===== FINANCES MODULE - ALTYN BANKING SYSTEM =====

# === FINANCE MODELS ===

class AssetType(str, Enum):
    COIN = "COIN"  # ALTYN COIN - Stable currency (1 COIN = 1 USD)
    TOKEN = "TOKEN"  # ALTYN TOKEN - Equity/shares with dividend rights

class TransactionType(str, Enum):
    TRANSFER = "TRANSFER"  # P2P transfer
    PAYMENT = "PAYMENT"  # Marketplace payment
    FEE = "FEE"  # Transaction fee
    DIVIDEND = "DIVIDEND"  # Dividend payout
    EMISSION = "EMISSION"  # New coin emission
    WELCOME_BONUS = "WELCOME_BONUS"  # New user bonus

class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class Wallet(BaseModel):
    """User's digital wallet containing ALTYN COINS and TOKENS"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    coin_balance: float = 0.0  # ALTYN COIN balance
    token_balance: float = 0.0  # ALTYN TOKEN balance
    is_corporate: bool = False  # Corporate account for companies
    organization_id: Optional[str] = None  # If corporate wallet
    is_treasury: bool = False  # Platform treasury account
    total_dividends_received: float = 0.0  # Total dividends earned
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(BaseModel):
    """Record of all financial transactions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_wallet_id: str
    to_wallet_id: str
    from_user_id: str
    to_user_id: str
    amount: float
    asset_type: AssetType
    transaction_type: TransactionType
    fee_amount: float = 0.0  # 0.1% fee for COIN transfers
    status: TransactionStatus = TransactionStatus.COMPLETED
    description: Optional[str] = None
    marketplace_product_id: Optional[str] = None  # If payment for product
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Emission(BaseModel):
    """Record of ALTYN COIN emissions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    created_by_user_id: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DividendPayout(BaseModel):
    """Record of dividend distributions to TOKEN holders"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    total_fees_distributed: float
    token_holders_count: int
    distribution_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # Admin who triggered it, or "SCHEDULED"
    details: List[Dict[str, Any]] = []  # List of {user_id, amount, token_percentage}

class ExchangeRates(BaseModel):
    """Cached exchange rates"""
    base: str = "USD"
    rates: Dict[str, float] = {}
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# === FINANCE INPUT/OUTPUT MODELS ===

class TransferRequest(BaseModel):
    """Request to transfer COINS or TOKENS"""
    to_user_email: str  # Recipient email
    amount: float
    asset_type: AssetType = AssetType.COIN
    description: Optional[str] = None

class PaymentRequest(BaseModel):
    """Request to pay for marketplace product"""
    product_id: str
    amount: float

class EmissionRequest(BaseModel):
    """Admin request to create new COIN emission"""
    amount: float
    description: Optional[str] = None

class WalletResponse(BaseModel):
    """Response for wallet information"""
    id: str
    user_id: str
    user_name: Optional[str] = None
    coin_balance: float
    token_balance: float
    token_percentage: Optional[float] = None  # % of total tokens owned
    is_corporate: bool
    organization_name: Optional[str] = None
    total_dividends_received: float
    pending_dividends: float = 0.0
    created_at: datetime

class TransactionResponse(BaseModel):
    """Response for transaction information"""
    id: str
    from_user_name: str
    to_user_name: str
    amount: float
    asset_type: str
    transaction_type: str
    fee_amount: float
    status: str
    description: Optional[str]
    created_at: datetime

# === FINANCE CONSTANTS ===
TOTAL_TOKENS = 35_000_000  # Total supply of ALTYN TOKENS
TRANSACTION_FEE_RATE = 0.001  # 0.1% fee on COIN transactions
WELCOME_BONUS_COINS = 100  # New users receive 100 ALTYN COINS
TREASURY_USER_ID = "PLATFORM_TREASURY"  # Special treasury user ID

# === FINANCE HELPER FUNCTIONS ===

async def get_or_create_wallet(user_id: str, is_corporate: bool = False, organization_id: str = None) -> dict:
    """Get existing wallet or create new one for user"""
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    
    if not wallet:
        new_wallet = Wallet(
            user_id=user_id,
            is_corporate=is_corporate,
            organization_id=organization_id
        )
        wallet_dict = new_wallet.dict()
        wallet_dict["created_at"] = wallet_dict["created_at"].isoformat()
        wallet_dict["updated_at"] = wallet_dict["updated_at"].isoformat()
        await db.wallets.insert_one(wallet_dict)
        wallet = wallet_dict
        if "_id" in wallet:
            del wallet["_id"]
    
    return wallet

async def get_or_create_treasury() -> dict:
    """Get or create platform treasury wallet"""
    treasury = await db.wallets.find_one({"is_treasury": True}, {"_id": 0})
    
    if not treasury:
        treasury_wallet = Wallet(
            user_id=TREASURY_USER_ID,
            is_treasury=True,
            coin_balance=0.0,
            token_balance=0.0
        )
        treasury_dict = treasury_wallet.dict()
        treasury_dict["created_at"] = treasury_dict["created_at"].isoformat()
        treasury_dict["updated_at"] = treasury_dict["updated_at"].isoformat()
        await db.wallets.insert_one(treasury_dict)
        treasury = treasury_dict
    
    return treasury

async def fetch_exchange_rates() -> dict:
    """Fetch exchange rates from API (1 ALTYN COIN = 1 USD)"""
    import httpx
    
    try:
        # Try to get cached rates first (less than 1 hour old)
        cached = await db.exchange_rates.find_one({"base": "USD"}, {"_id": 0})
        if cached:
            fetched_at = datetime.fromisoformat(cached["fetched_at"]) if isinstance(cached["fetched_at"], str) else cached["fetched_at"]
            if datetime.now(timezone.utc) - fetched_at.replace(tzinfo=timezone.utc) < timedelta(hours=1):
                return cached["rates"]
        
        # Fetch fresh rates from ExchangeRate.host API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.exchangerate.host/latest",
                params={"base": "USD", "symbols": "RUB,KZT"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})
                
                # Cache the rates
                await db.exchange_rates.update_one(
                    {"base": "USD"},
                    {"$set": {
                        "rates": rates,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
                
                return rates
    except Exception as e:
        logger.error(f"Error fetching exchange rates: {e}")
    
    # Fallback rates if API fails
    return {"RUB": 90.0, "KZT": 450.0}

# === FINANCE API ENDPOINTS ===

@api_router.get("/finance/wallet")
async def get_my_wallet(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user's wallet with balance and stats"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        wallet = await get_or_create_wallet(user_id)
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        
        # Calculate token percentage
        total_tokens_in_circulation = await db.wallets.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$token_balance"}}}
        ]).to_list(1)
        
        total_tokens = total_tokens_in_circulation[0]["total"] if total_tokens_in_circulation else TOTAL_TOKENS
        token_percentage = (wallet["token_balance"] / total_tokens * 100) if total_tokens > 0 else 0
        
        # Get pending dividends from treasury fees
        treasury = await get_or_create_treasury()
        pending_dividends = (treasury.get("coin_balance", 0) * token_percentage / 100) if token_percentage > 0 else 0
        
        return {
            "success": True,
            "wallet": {
                **wallet,
                "user_name": f"{user['first_name']} {user['last_name']}" if user else "Unknown",
                "token_percentage": round(token_percentage, 6),
                "pending_dividends": round(pending_dividends, 2)
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting wallet: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/transfer")
async def transfer_assets(
    request: TransferRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Transfer COINS or TOKENS to another user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        sender_id = payload.get("sub")
        
        # Validate amount
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        # Find recipient by email
        recipient = await db.users.find_one({"email": request.to_user_email}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1})
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        
        if recipient["id"] == sender_id:
            raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
        
        # Get wallets
        sender_wallet = await get_or_create_wallet(sender_id)
        recipient_wallet = await get_or_create_wallet(recipient["id"])
        treasury = await get_or_create_treasury()
        
        # Check balance
        balance_field = "coin_balance" if request.asset_type == AssetType.COIN else "token_balance"
        if sender_wallet[balance_field] < request.amount:
            raise HTTPException(status_code=400, detail=f"Insufficient {request.asset_type.value} balance")
        
        # Calculate fee (only for COIN transfers)
        fee_amount = request.amount * TRANSACTION_FEE_RATE if request.asset_type == AssetType.COIN else 0
        net_amount = request.amount - fee_amount
        
        # Update balances
        await db.wallets.update_one(
            {"user_id": sender_id},
            {"$inc": {balance_field: -request.amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"user_id": recipient["id"]},
            {"$inc": {balance_field: net_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Add fee to treasury
        if fee_amount > 0:
            await db.wallets.update_one(
                {"is_treasury": True},
                {"$inc": {"coin_balance": fee_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Record transaction
        sender_user = await db.users.find_one({"id": sender_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        transaction = Transaction(
            from_wallet_id=sender_wallet["id"],
            to_wallet_id=recipient_wallet["id"],
            from_user_id=sender_id,
            to_user_id=recipient["id"],
            amount=request.amount,
            asset_type=request.asset_type,
            transaction_type=TransactionType.TRANSFER,
            fee_amount=fee_amount,
            description=request.description
        )
        
        tx_dict = transaction.dict()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        await db.transactions.insert_one(tx_dict)
        
        return {
            "success": True,
            "transaction": {
                "id": transaction.id,
                "amount": request.amount,
                "fee": fee_amount,
                "net_amount": net_amount,
                "recipient": f"{recipient['first_name']} {recipient['last_name']}",
                "asset_type": request.asset_type.value
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transferring assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/transactions")
async def get_transactions(
    limit: int = 50,
    offset: int = 0,
    asset_type: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's transaction history"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        query = {"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]}
        if asset_type:
            query["asset_type"] = asset_type
        
        transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
        total = await db.transactions.count_documents(query)
        
        # Enrich with user names
        enriched = []
        for tx in transactions:
            from_user = await db.users.find_one({"id": tx["from_user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
            to_user = await db.users.find_one({"id": tx["to_user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
            
            tx["from_user_name"] = f"{from_user['first_name']} {from_user['last_name']}" if from_user else "System"
            tx["to_user_name"] = f"{to_user['first_name']} {to_user['last_name']}" if to_user else "Treasury"
            tx["is_incoming"] = tx["to_user_id"] == user_id
            enriched.append(tx)
        
        return {
            "success": True,
            "transactions": enriched,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting transactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/exchange-rates")
async def get_exchange_rates():
    """Get current exchange rates (1 ALTYN COIN = 1 USD)"""
    try:
        rates = await fetch_exchange_rates()
        
        return {
            "success": True,
            "base": "ALTYN",
            "equivalent_to": "USD",
            "rates": {
                "USD": 1.0,
                "RUB": rates.get("RUB", 90.0),
                "KZT": rates.get("KZT", 450.0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting exchange rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/token-holders")
async def get_token_holders(
    limit: int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get list of TOKEN holders with their percentages"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Get all wallets with tokens
        holders = await db.wallets.find(
            {"token_balance": {"$gt": 0}},
            {"_id": 0}
        ).sort("token_balance", -1).limit(limit).to_list(limit)
        
        # Calculate total tokens
        total = sum(h["token_balance"] for h in holders)
        
        # Enrich with user names and percentages
        enriched = []
        for holder in holders:
            user = await db.users.find_one({"id": holder["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
            enriched.append({
                "user_id": holder["user_id"],
                "user_name": f"{user['first_name']} {user['last_name']}" if user else "Unknown",
                "token_balance": holder["token_balance"],
                "percentage": round((holder["token_balance"] / total * 100) if total > 0 else 0, 4),
                "total_dividends_received": holder.get("total_dividends_received", 0)
            })
        
        return {
            "success": True,
            "holders": enriched,
            "total_tokens": total,
            "total_supply": TOTAL_TOKENS
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting token holders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/treasury")
async def get_treasury_stats(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get platform treasury statistics"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
        if not user or user.get("role") != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        treasury = await get_or_create_treasury()
        
        # Get total coins in circulation
        coin_stats = await db.wallets.aggregate([
            {"$match": {"is_treasury": False}},
            {"$group": {"_id": None, "total": {"$sum": "$coin_balance"}}}
        ]).to_list(1)
        
        # Get emission history
        emissions = await db.emissions.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        
        # Get dividend history
        dividends = await db.dividend_payouts.find({}, {"_id": 0}).sort("distribution_date", -1).limit(10).to_list(10)
        
        return {
            "success": True,
            "treasury": {
                "collected_fees": treasury.get("coin_balance", 0),
                "total_coins_in_circulation": coin_stats[0]["total"] if coin_stats else 0,
                "total_token_supply": TOTAL_TOKENS
            },
            "recent_emissions": emissions,
            "recent_dividends": dividends
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting treasury stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/admin/emission")
async def create_emission(
    request: EmissionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin only: Create new ALTYN COIN emission"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
        if not user or user.get("role") != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        
        # Get admin's wallet
        admin_wallet = await get_or_create_wallet(user_id)
        
        # Add coins to admin's wallet
        await db.wallets.update_one(
            {"user_id": user_id},
            {"$inc": {"coin_balance": request.amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Record emission
        emission = Emission(
            amount=request.amount,
            created_by_user_id=user_id,
            description=request.description or f"Emission of {request.amount:,.0f} ALTYN COINS"
        )
        
        emission_dict = emission.dict()
        emission_dict["created_at"] = emission_dict["created_at"].isoformat()
        await db.emissions.insert_one(emission_dict)
        
        return {
            "success": True,
            "emission": {
                "id": emission.id,
                "amount": request.amount,
                "description": emission.description
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating emission: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/admin/distribute-dividends")
async def distribute_dividends(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Admin only: Distribute collected fees to TOKEN holders"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
        if not user or user.get("role") != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        treasury = await get_or_create_treasury()
        fees_to_distribute = treasury.get("coin_balance", 0)
        
        if fees_to_distribute <= 0:
            raise HTTPException(status_code=400, detail="No fees to distribute")
        
        # Get all TOKEN holders
        token_holders = await db.wallets.find(
            {"token_balance": {"$gt": 0}, "is_treasury": False},
            {"_id": 0}
        ).to_list(10000)
        
        if not token_holders:
            raise HTTPException(status_code=400, detail="No token holders found")
        
        # Calculate total tokens
        total_tokens = sum(h["token_balance"] for h in token_holders)
        
        # Distribute proportionally
        distribution_details = []
        for holder in token_holders:
            percentage = holder["token_balance"] / total_tokens
            dividend_amount = fees_to_distribute * percentage
            
            # Update holder's wallet
            await db.wallets.update_one(
                {"user_id": holder["user_id"]},
                {
                    "$inc": {
                        "coin_balance": dividend_amount,
                        "total_dividends_received": dividend_amount
                    },
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            
            # Record transaction
            tx = Transaction(
                from_wallet_id=treasury["id"],
                to_wallet_id=holder["id"],
                from_user_id=TREASURY_USER_ID,
                to_user_id=holder["user_id"],
                amount=dividend_amount,
                asset_type=AssetType.COIN,
                transaction_type=TransactionType.DIVIDEND,
                description=f"Dividend payout ({percentage*100:.4f}% of fees)"
            )
            tx_dict = tx.dict()
            tx_dict["created_at"] = tx_dict["created_at"].isoformat()
            await db.transactions.insert_one(tx_dict)
            
            distribution_details.append({
                "user_id": holder["user_id"],
                "amount": round(dividend_amount, 2),
                "token_percentage": round(percentage * 100, 4)
            })
        
        # Clear treasury
        await db.wallets.update_one(
            {"is_treasury": True},
            {"$set": {"coin_balance": 0, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Record payout
        payout = DividendPayout(
            total_fees_distributed=fees_to_distribute,
            token_holders_count=len(token_holders),
            created_by=user_id,
            details=distribution_details
        )
        payout_dict = payout.dict()
        payout_dict["distribution_date"] = payout_dict["distribution_date"].isoformat()
        await db.dividend_payouts.insert_one(payout_dict)
        
        return {
            "success": True,
            "payout": {
                "id": payout.id,
                "total_distributed": fees_to_distribute,
                "holders_count": len(token_holders),
                "distribution_details": distribution_details
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error distributing dividends: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/admin/initialize-tokens")
async def initialize_tokens(
    user_email: str,
    token_amount: float = TOTAL_TOKENS,
    coin_amount: float = 1_000_000,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin only: Initialize TOKENS and COINS for a user (first time setup)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id = payload.get("sub")
        
        # Check if user is admin
        admin = await db.users.find_one({"id": admin_id}, {"_id": 0, "role": 1})
        if not admin or admin.get("role") != "ADMIN":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Find target user
        target_user = await db.users.find_one({"email": user_email}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1})
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get or create wallet
        wallet = await get_or_create_wallet(target_user["id"])
        
        # Update wallet with tokens and coins
        await db.wallets.update_one(
            {"user_id": target_user["id"]},
            {
                "$set": {
                    "token_balance": token_amount,
                    "coin_balance": coin_amount,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Record emission
        emission = Emission(
            amount=coin_amount,
            created_by_user_id=admin_id,
            description=f"Initial emission: {coin_amount:,.0f} COINS + {token_amount:,.0f} TOKENS to {target_user['first_name']} {target_user['last_name']}"
        )
        emission_dict = emission.dict()
        emission_dict["created_at"] = emission_dict["created_at"].isoformat()
        await db.emissions.insert_one(emission_dict)
        
        return {
            "success": True,
            "message": f"Initialized {token_amount:,.0f} TOKENS and {coin_amount:,.0f} COINS for {target_user['first_name']} {target_user['last_name']}"
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initializing tokens: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/welcome-bonus/{user_id}")
async def give_welcome_bonus(user_id: str):
    """Internal: Give welcome bonus to new user (called during registration)"""
    try:
        # Check if user already has a wallet
        existing_wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
        if existing_wallet:
            return {"success": False, "message": "User already has wallet"}
        
        # Create wallet with welcome bonus
        wallet = Wallet(
            user_id=user_id,
            coin_balance=WELCOME_BONUS_COINS
        )
        wallet_dict = wallet.dict()
        wallet_dict["created_at"] = wallet_dict["created_at"].isoformat()
        wallet_dict["updated_at"] = wallet_dict["updated_at"].isoformat()
        await db.wallets.insert_one(wallet_dict)
        
        # Record transaction from treasury
        treasury = await get_or_create_treasury()
        tx = Transaction(
            from_wallet_id=treasury["id"],
            to_wallet_id=wallet.id,
            from_user_id=TREASURY_USER_ID,
            to_user_id=user_id,
            amount=WELCOME_BONUS_COINS,
            asset_type=AssetType.COIN,
            transaction_type=TransactionType.WELCOME_BONUS,
            description="Welcome bonus for new user"
        )
        tx_dict = tx.dict()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        await db.transactions.insert_one(tx_dict)
        
        return {"success": True, "coins_given": WELCOME_BONUS_COINS}
        
    except Exception as e:
        logger.error(f"Error giving welcome bonus: {e}")
        return {"success": False, "error": str(e)}

@api_router.post("/finance/marketplace/pay")
async def pay_for_product(
    request: PaymentRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Pay for a marketplace product with ALTYN COINS"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        buyer_id = payload.get("sub")
        
        # Get product
        product = await db.marketplace_products.find_one({"id": request.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if product["seller_id"] == buyer_id:
            raise HTTPException(status_code=400, detail="Cannot buy your own product")
        
        # Get wallets
        buyer_wallet = await get_or_create_wallet(buyer_id)
        seller_wallet = await get_or_create_wallet(product["seller_id"])
        treasury = await get_or_create_treasury()
        
        # Check balance
        if buyer_wallet["coin_balance"] < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient ALTYN COIN balance")
        
        # Calculate fee
        fee_amount = request.amount * TRANSACTION_FEE_RATE
        net_amount = request.amount - fee_amount
        
        # Update balances
        await db.wallets.update_one(
            {"user_id": buyer_id},
            {"$inc": {"coin_balance": -request.amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"user_id": product["seller_id"]},
            {"$inc": {"coin_balance": net_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"is_treasury": True},
            {"$inc": {"coin_balance": fee_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Record transaction
        tx = Transaction(
            from_wallet_id=buyer_wallet["id"],
            to_wallet_id=seller_wallet["id"],
            from_user_id=buyer_id,
            to_user_id=product["seller_id"],
            amount=request.amount,
            asset_type=AssetType.COIN,
            transaction_type=TransactionType.PAYMENT,
            fee_amount=fee_amount,
            marketplace_product_id=request.product_id,
            description=f"Payment for: {product.get('title', 'Product')}"
        )
        tx_dict = tx.dict()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        await db.transactions.insert_one(tx_dict)
        
        # Update product status
        await db.marketplace_products.update_one(
            {"id": request.product_id},
            {"$set": {"status": "SOLD", "buyer_id": buyer_id, "sold_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Get buyer and seller names for receipt
        buyer_user = await db.users.find_one({"id": buyer_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        seller_user = await db.users.find_one({"id": product["seller_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        
        return {
            "success": True,
            "payment": {
                "transaction_id": tx.id,
                "amount": request.amount,
                "fee": fee_amount,
                "seller_received": net_amount,
                "product_title": product.get("title"),
                "product_id": request.product_id
            },
            "receipt": {
                "receipt_id": tx.id,
                "date": datetime.now(timezone.utc).isoformat(),
                "type": "MARKETPLACE_PURCHASE",
                "buyer_name": f"{buyer_user.get('first_name', '')} {buyer_user.get('last_name', '')}".strip() if buyer_user else "Unknown",
                "seller_name": f"{seller_user.get('first_name', '')} {seller_user.get('last_name', '')}".strip() if seller_user else "Unknown",
                "item_title": product.get("title"),
                "item_price": request.amount,
                "fee_amount": fee_amount,
                "fee_rate": "0.1%",
                "total_paid": request.amount,
                "seller_received": net_amount,
                "currency": "ALTYN COIN (AC)",
                "status": "COMPLETED"
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ServicePaymentRequest(BaseModel):
    """Request to pay for a service booking"""
    service_id: str
    booking_id: Optional[str] = None
    amount: float
    description: Optional[str] = None

@api_router.post("/finance/services/pay")
async def pay_for_service(
    request: ServicePaymentRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Pay for a service with ALTYN COINS"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        buyer_id = payload.get("sub")
        
        # Get service
        service = await db.service_listings.find_one({"id": request.service_id}, {"_id": 0})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Check if service accepts ALTYN
        if not service.get("accept_altyn"):
            raise HTTPException(status_code=400, detail="This service does not accept ALTYN COIN payments")
        
        seller_id = service["owner_user_id"]
        
        if seller_id == buyer_id:
            raise HTTPException(status_code=400, detail="Cannot pay for your own service")
        
        # Get wallets
        buyer_wallet = await get_or_create_wallet(buyer_id)
        seller_wallet = await get_or_create_wallet(seller_id)
        treasury = await get_or_create_treasury()
        
        # Check balance
        if buyer_wallet["coin_balance"] < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient ALTYN COIN balance")
        
        # Calculate fee (0.1%)
        fee_amount = request.amount * TRANSACTION_FEE_RATE
        net_amount = request.amount - fee_amount
        
        # Update balances
        await db.wallets.update_one(
            {"user_id": buyer_id},
            {"$inc": {"coin_balance": -request.amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"user_id": seller_id},
            {"$inc": {"coin_balance": net_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"is_treasury": True},
            {"$inc": {"coin_balance": fee_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Record transaction
        tx = Transaction(
            from_wallet_id=buyer_wallet["id"],
            to_wallet_id=seller_wallet["id"],
            from_user_id=buyer_id,
            to_user_id=seller_id,
            amount=request.amount,
            asset_type=AssetType.COIN,
            transaction_type=TransactionType.PAYMENT,
            fee_amount=fee_amount,
            description=request.description or f"Payment for service: {service.get('name', 'Service')}"
        )
        tx_dict = tx.dict()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        tx_dict["service_id"] = request.service_id
        if request.booking_id:
            tx_dict["booking_id"] = request.booking_id
        await db.transactions.insert_one(tx_dict)
        
        # Update booking if provided
        if request.booking_id:
            await db.service_bookings.update_one(
                {"id": request.booking_id},
                {"$set": {"payment_status": "PAID", "payment_transaction_id": tx.id, "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Get buyer and seller names for receipt
        buyer_user = await db.users.find_one({"id": buyer_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        seller_user = await db.users.find_one({"id": seller_id}, {"_id": 0, "first_name": 1, "last_name": 1})
        
        return {
            "success": True,
            "payment": {
                "transaction_id": tx.id,
                "amount": request.amount,
                "fee": fee_amount,
                "seller_received": net_amount,
                "service_name": service.get("name"),
                "service_id": request.service_id,
                "booking_id": request.booking_id
            },
            "receipt": {
                "receipt_id": tx.id,
                "date": datetime.now(timezone.utc).isoformat(),
                "type": "SERVICE_PAYMENT",
                "buyer_name": f"{buyer_user.get('first_name', '')} {buyer_user.get('last_name', '')}".strip() if buyer_user else "Unknown",
                "seller_name": f"{seller_user.get('first_name', '')} {seller_user.get('last_name', '')}".strip() if seller_user else "Unknown",
                "item_title": service.get("name"),
                "item_price": request.amount,
                "fee_amount": fee_amount,
                "fee_rate": "0.1%",
                "total_paid": request.amount,
                "seller_received": net_amount,
                "currency": "ALTYN COIN (AC)",
                "status": "COMPLETED"
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing service payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/finance/corporate-wallet")
async def create_corporate_wallet(
    organization_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a corporate wallet for an organization"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin of the organization
        org = await db.work_organizations.find_one({"id": organization_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        member = await db.work_members.find_one(
            {"organization_id": organization_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if not member or not member.get("is_admin"):
            raise HTTPException(status_code=403, detail="Only organization admins can create corporate wallets")
        
        # Check if corporate wallet already exists
        existing = await db.wallets.find_one(
            {"organization_id": organization_id, "is_corporate": True},
            {"_id": 0}
        )
        
        if existing:
            return {"success": True, "wallet": existing, "message": "Corporate wallet already exists"}
        
        # Create corporate wallet
        corporate_wallet = Wallet(
            user_id=f"ORG_{organization_id}",
            is_corporate=True,
            organization_id=organization_id
        )
        
        wallet_dict = corporate_wallet.dict()
        wallet_dict["created_at"] = wallet_dict["created_at"].isoformat()
        wallet_dict["updated_at"] = wallet_dict["updated_at"].isoformat()
        await db.wallets.insert_one(wallet_dict)
        
        return {
            "success": True,
            "wallet": {
                "id": corporate_wallet.id,
                "organization_id": organization_id,
                "organization_name": org.get("name"),
                "coin_balance": 0,
                "token_balance": 0
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating corporate wallet: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/corporate/wallets")
async def get_user_corporate_wallets(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get all corporate wallets for organizations user is admin of"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Find all organizations where user is admin
        memberships = await db.work_members.find(
            {"user_id": user_id, "is_admin": True, "is_active": True},
            {"_id": 0}
        ).to_list(100)
        
        corporate_wallets = []
        for membership in memberships:
            org_id = membership.get("organization_id")
            org = await db.work_organizations.find_one({"id": org_id}, {"_id": 0})
            if not org:
                continue
                
            # Get or check corporate wallet
            wallet = await db.wallets.find_one(
                {"organization_id": org_id, "is_corporate": True},
                {"_id": 0}
            )
            
            corporate_wallets.append({
                "organization_id": org_id,
                "organization_name": org.get("name"),
                "organization_logo": org.get("logo_url"),
                "has_wallet": wallet is not None,
                "wallet": {
                    "id": wallet.get("id") if wallet else None,
                    "coin_balance": wallet.get("coin_balance", 0) if wallet else 0,
                    "created_at": wallet.get("created_at") if wallet else None
                } if wallet else None
            })
        
        return {"success": True, "corporate_wallets": corporate_wallets}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting corporate wallets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/corporate/wallet/{organization_id}")
async def get_corporate_wallet(
    organization_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get corporate wallet details for an organization"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is member of the organization
        member = await db.work_members.find_one(
            {"organization_id": organization_id, "user_id": user_id, "is_active": True},
            {"_id": 0}
        )
        
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        
        org = await db.work_organizations.find_one({"id": organization_id}, {"_id": 0})
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        wallet = await db.wallets.find_one(
            {"organization_id": organization_id, "is_corporate": True},
            {"_id": 0}
        )
        
        if not wallet:
            raise HTTPException(status_code=404, detail="Corporate wallet not found. Please create one first.")
        
        return {
            "success": True,
            "wallet": {
                "id": wallet.get("id"),
                "organization_id": organization_id,
                "organization_name": org.get("name"),
                "coin_balance": wallet.get("coin_balance", 0),
                "total_dividends_received": wallet.get("total_dividends_received", 0),
                "created_at": wallet.get("created_at"),
                "is_admin": member.get("is_admin", False)
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting corporate wallet: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CorporateTransferRequest(BaseModel):
    """Request to transfer from corporate wallet"""
    organization_id: str
    to_user_email: Optional[str] = None
    to_organization_id: Optional[str] = None
    amount: float
    description: Optional[str] = None

@api_router.post("/finance/corporate/transfer")
async def corporate_transfer(
    request: CorporateTransferRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Transfer ALTYN COINs from corporate wallet"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin of the source organization
        member = await db.work_members.find_one(
            {"organization_id": request.organization_id, "user_id": user_id, "is_admin": True},
            {"_id": 0}
        )
        
        if not member:
            raise HTTPException(status_code=403, detail="Only organization admins can make corporate transfers")
        
        # Get source corporate wallet
        source_wallet = await db.wallets.find_one(
            {"organization_id": request.organization_id, "is_corporate": True},
            {"_id": 0}
        )
        
        if not source_wallet:
            raise HTTPException(status_code=404, detail="Corporate wallet not found")
        
        if source_wallet["coin_balance"] < request.amount:
            raise HTTPException(status_code=400, detail="Insufficient corporate balance")
        
        # Determine recipient
        if request.to_user_email:
            # Transfer to personal wallet
            recipient = await db.users.find_one({"email": request.to_user_email}, {"_id": 0})
            if not recipient:
                raise HTTPException(status_code=404, detail="Recipient user not found")
            
            recipient_wallet = await get_or_create_wallet(recipient["id"])
            to_wallet_id = recipient_wallet["id"]
            to_user_id = recipient["id"]
            recipient_name = f"{recipient.get('first_name', '')} {recipient.get('last_name', '')}".strip()
            
        elif request.to_organization_id:
            # Transfer to another corporate wallet
            target_wallet = await db.wallets.find_one(
                {"organization_id": request.to_organization_id, "is_corporate": True},
                {"_id": 0}
            )
            if not target_wallet:
                raise HTTPException(status_code=404, detail="Recipient corporate wallet not found")
            
            target_org = await db.work_organizations.find_one({"id": request.to_organization_id}, {"_id": 0})
            to_wallet_id = target_wallet["id"]
            to_user_id = f"ORG_{request.to_organization_id}"
            recipient_name = target_org.get("name", "Unknown Organization")
        else:
            raise HTTPException(status_code=400, detail="Must specify either to_user_email or to_organization_id")
        
        # Calculate fee (0.1%)
        fee_amount = request.amount * TRANSACTION_FEE_RATE
        net_amount = request.amount - fee_amount
        
        # Get source organization name
        source_org = await db.work_organizations.find_one({"id": request.organization_id}, {"_id": 0})
        source_name = source_org.get("name", "Unknown Organization")
        
        # Update balances
        await db.wallets.update_one(
            {"id": source_wallet["id"]},
            {"$inc": {"coin_balance": -request.amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        await db.wallets.update_one(
            {"id": to_wallet_id},
            {"$inc": {"coin_balance": net_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Fee to treasury
        await db.wallets.update_one(
            {"is_treasury": True},
            {"$inc": {"coin_balance": fee_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Record transaction
        tx = Transaction(
            from_wallet_id=source_wallet["id"],
            to_wallet_id=to_wallet_id,
            from_user_id=f"ORG_{request.organization_id}",
            to_user_id=to_user_id,
            amount=request.amount,
            asset_type=AssetType.COIN,
            transaction_type=TransactionType.TRANSFER,
            fee_amount=fee_amount,
            description=request.description or f"Corporate transfer from {source_name}"
        )
        tx_dict = tx.dict()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        tx_dict["is_corporate_transfer"] = True
        tx_dict["source_organization_id"] = request.organization_id
        tx_dict["source_organization_name"] = source_name
        if request.to_organization_id:
            tx_dict["target_organization_id"] = request.to_organization_id
        await db.transactions.insert_one(tx_dict)
        
        return {
            "success": True,
            "transaction": {
                "id": tx.id,
                "amount": request.amount,
                "fee": fee_amount,
                "recipient_received": net_amount,
                "from": source_name,
                "to": recipient_name
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in corporate transfer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/corporate/transactions/{organization_id}")
async def get_corporate_transactions(
    organization_id: str,
    skip: int = 0,
    limit: int = 50,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get transaction history for corporate wallet"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is member of the organization
        member = await db.work_members.find_one(
            {"organization_id": organization_id, "user_id": user_id, "is_active": True},
            {"_id": 0}
        )
        
        if not member:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        
        # Get corporate wallet
        wallet = await db.wallets.find_one(
            {"organization_id": organization_id, "is_corporate": True},
            {"_id": 0}
        )
        
        if not wallet:
            raise HTTPException(status_code=404, detail="Corporate wallet not found")
        
        # Get transactions where this corporate wallet is sender or receiver
        transactions = await db.transactions.find({
            "$or": [
                {"from_wallet_id": wallet["id"]},
                {"to_wallet_id": wallet["id"]}
            ]
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Enrich transaction data
        enriched_transactions = []
        for tx in transactions:
            is_outgoing = tx.get("from_wallet_id") == wallet["id"]
            
            # Get counterparty info
            if is_outgoing:
                counterparty_id = tx.get("to_user_id", "")
            else:
                counterparty_id = tx.get("from_user_id", "")
            
            if counterparty_id.startswith("ORG_"):
                org_id = counterparty_id.replace("ORG_", "")
                org = await db.work_organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
                counterparty_name = org.get("name", "Unknown Organization") if org else "Unknown Organization"
                counterparty_type = "organization"
            elif counterparty_id == TREASURY_USER_ID:
                counterparty_name = "Казначейство платформы"
                counterparty_type = "treasury"
            else:
                user = await db.users.find_one({"id": counterparty_id}, {"_id": 0, "first_name": 1, "last_name": 1})
                counterparty_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown User"
                counterparty_type = "user"
            
            enriched_transactions.append({
                "id": tx.get("id"),
                "type": "outgoing" if is_outgoing else "incoming",
                "amount": tx.get("amount"),
                "fee_amount": tx.get("fee_amount", 0),
                "counterparty_name": counterparty_name,
                "counterparty_type": counterparty_type,
                "description": tx.get("description"),
                "created_at": tx.get("created_at"),
                "transaction_type": tx.get("transaction_type")
            })
        
        return {"success": True, "transactions": enriched_transactions}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting corporate transactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/finance/portfolio")
async def get_portfolio(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get user's complete financial portfolio"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        wallet = await get_or_create_wallet(user_id)
        rates = await fetch_exchange_rates()
        
        # Calculate values
        coin_usd = wallet["coin_balance"]
        coin_rub = coin_usd * rates.get("RUB", 90.0)
        coin_kzt = coin_usd * rates.get("KZT", 450.0)
        
        # Token stats
        total_tokens_result = await db.wallets.aggregate([
            {"$match": {"is_treasury": False}},
            {"$group": {"_id": None, "total": {"$sum": "$token_balance"}}}
        ]).to_list(1)
        total_tokens = total_tokens_result[0]["total"] if total_tokens_result else TOTAL_TOKENS
        token_percentage = (wallet["token_balance"] / total_tokens * 100) if total_tokens > 0 else 0
        
        # Recent transactions
        recent_tx = await db.transactions.find(
            {"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]},
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        # Treasury for pending dividends
        treasury = await get_or_create_treasury()
        pending_dividends = treasury.get("coin_balance", 0) * (token_percentage / 100)
        
        return {
            "success": True,
            "portfolio": {
                "coin_balance": {
                    "amount": wallet["coin_balance"],
                    "usd": coin_usd,
                    "rub": round(coin_rub, 2),
                    "kzt": round(coin_kzt, 2)
                },
                "token_balance": {
                    "amount": wallet["token_balance"],
                    "percentage": round(token_percentage, 6),
                    "total_supply": TOTAL_TOKENS
                },
                "dividends": {
                    "total_received": wallet.get("total_dividends_received", 0),
                    "pending": round(pending_dividends, 2)
                },
                "recent_transactions": recent_tx
            },
            "exchange_rates": {
                "base": "ALTYN (= USD)",
                "RUB": rates.get("RUB", 90.0),
                "KZT": rates.get("KZT", 450.0)
            }
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== END FINANCES MODULE =====

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc),
        "version": "1.0.0"
    }

# ===== GOOD WILL MODULE - ДОБРАЯ ВОЛЯ (Events & Gatherings) =====

class EventVisibility(str, Enum):
    PUBLIC = "PUBLIC"  # Anyone can see
    PRIVATE = "PRIVATE"  # Invite only
    GROUP_ONLY = "GROUP_ONLY"  # Visible to group members only

class EventStatus(str, Enum):
    DRAFT = "DRAFT"
    UPCOMING = "UPCOMING"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class RSVPStatus(str, Enum):
    GOING = "GOING"
    MAYBE = "MAYBE"
    NOT_GOING = "NOT_GOING"
    WAITLIST = "WAITLIST"

class OrganizerRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"
    HELPER = "HELPER"

# Predefined Interest Categories
INTEREST_CATEGORIES = [
    {"id": "volunteering", "name": "Волонтёрство", "icon": "🤝", "color": "#10B981"},
    {"id": "car_clubs", "name": "Автоклубы", "icon": "🚗", "color": "#EF4444"},
    {"id": "sports", "name": "Спорт и Фитнес", "icon": "🏃", "color": "#3B82F6"},
    {"id": "art", "name": "Творчество", "icon": "🎨", "color": "#8B5CF6"},
    {"id": "ecology", "name": "Экология", "icon": "🌿", "color": "#22C55E"},
    {"id": "family", "name": "Семейные", "icon": "👨‍👩‍👧‍👦", "color": "#F59E0B"},
    {"id": "education", "name": "Образование", "icon": "📚", "color": "#06B6D4"},
    {"id": "music", "name": "Музыка и Развлечения", "icon": "🎵", "color": "#EC4899"},
    {"id": "business", "name": "Бизнес и Нетворкинг", "icon": "💼", "color": "#6366F1"},
    {"id": "charity", "name": "Благотворительность", "icon": "❤️", "color": "#F43F5E"},
]

class EventOrganizerProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    organization_id: Optional[str] = None  # If company organizer
    name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    cover_image: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    social_links: Dict[str, str] = {}
    categories: List[str] = []  # Interest category IDs
    is_verified: bool = False
    is_active: bool = True
    followers_count: int = 0
    events_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrganizerTeamMember(BaseModel):
    user_id: str
    role: OrganizerRole = OrganizerRole.HELPER
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InterestGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    category_id: str  # From INTEREST_CATEGORIES
    cover_image: Optional[str] = None
    creator_id: str
    is_public: bool = True
    members_count: int = 0
    events_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventTicketType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Стандарт", "VIP"
    price: float = 0.0  # Price in RUB
    altyn_price: Optional[float] = None  # Price in ALTYN COIN
    quantity: int = 0  # 0 = unlimited
    sold: int = 0
    description: Optional[str] = None

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organizer_profile_id: str
    group_id: Optional[str] = None  # Interest group if applicable
    title: str
    description: str
    category_id: str
    cover_image: Optional[str] = None
    images: List[str] = []
    youtube_url: Optional[str] = None  # YouTube video URL
    youtube_video_id: Optional[str] = None  # Extracted YouTube video ID
    
    # Location
    city: str
    address: Optional[str] = None
    venue_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_online: bool = False
    online_link: Optional[str] = None
    
    # Date & Time
    start_date: datetime
    end_date: Optional[datetime] = None
    timezone: str = "Europe/Moscow"
    
    # Recurring Events
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # weekly, monthly, custom
    recurrence_end_date: Optional[datetime] = None
    parent_event_id: Optional[str] = None  # For recurring event instances
    
    # Settings
    visibility: EventVisibility = EventVisibility.PUBLIC
    status: EventStatus = EventStatus.UPCOMING
    capacity: int = 0  # 0 = unlimited
    enable_waitlist: bool = True
    registration_deadline: Optional[datetime] = None
    
    # Tickets
    is_free: bool = True
    ticket_types: List[EventTicketType] = []
    
    # Stats
    attendees_count: int = 0
    maybe_count: int = 0
    waitlist_count: int = 0
    view_count: int = 0
    reviews_count: int = 0
    average_rating: float = 0.0
    photos_count: int = 0
    
    # Co-organizers
    co_organizer_ids: List[str] = []
    
    # QR Check-in
    checkin_code: Optional[str] = None
    
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    user_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventPhoto(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    user_id: str
    photo_url: str
    caption: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    user_id: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventAttendee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    user_id: str
    status: RSVPStatus = RSVPStatus.GOING
    ticket_type_id: Optional[str] = None
    ticket_price_paid: float = 0.0
    payment_transaction_id: Optional[str] = None
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventInvitation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    inviter_id: str
    invitee_id: str
    message: Optional[str] = None
    status: str = "pending"  # pending, accepted, declined
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# === Pydantic Request/Response Models ===

class CreateOrganizerProfileRequest(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    categories: List[str] = []

class CreateEventRequest(BaseModel):
    organizer_profile_id: str
    group_id: Optional[str] = None
    title: str
    description: str
    category_id: str
    cover_image: Optional[str] = None
    youtube_url: Optional[str] = None
    city: str
    address: Optional[str] = None
    venue_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_online: bool = False
    online_link: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    visibility: EventVisibility = EventVisibility.PUBLIC
    capacity: int = 0
    enable_waitlist: bool = True
    registration_deadline: Optional[datetime] = None
    is_free: bool = True
    ticket_types: List[Dict] = []
    tags: List[str] = []
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    recurrence_end_date: Optional[datetime] = None
    co_organizer_ids: List[str] = []

class AddReviewRequest(BaseModel):
    rating: int
    comment: Optional[str] = None

class AddPhotoRequest(BaseModel):
    photo_url: str
    caption: Optional[str] = None

class EventChatRequest(BaseModel):
    message: str

class RSVPRequest(BaseModel):
    status: RSVPStatus
    ticket_type_id: Optional[str] = None

class PurchaseTicketRequest(BaseModel):
    event_id: str
    ticket_type_id: str
    pay_with_altyn: bool = False

class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: str
    is_public: bool = True

class InviteToEventRequest(BaseModel):
    event_id: str
    invitee_ids: List[str]
    message: Optional[str] = None

# === API Endpoints ===

@api_router.get("/goodwill/categories")
async def get_interest_categories():
    """Get all predefined interest categories"""
    return {"categories": INTEREST_CATEGORIES}

# --- Organizer Profiles ---

@api_router.post("/goodwill/organizer-profile")
async def create_organizer_profile(
    request: CreateOrganizerProfileRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create an event organizer profile"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user already has a profile
        existing = await db.event_organizer_profiles.find_one({"user_id": user_id}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="You already have an organizer profile")
        
        profile = EventOrganizerProfile(
            user_id=user_id,
            organization_id=request.organization_id,
            name=request.name,
            description=request.description,
            contact_email=request.contact_email,
            contact_phone=request.contact_phone,
            website=request.website,
            categories=request.categories
        )
        
        profile_dict = profile.dict()
        profile_dict["created_at"] = profile_dict["created_at"].isoformat()
        profile_dict["updated_at"] = profile_dict["updated_at"].isoformat()
        
        await db.event_organizer_profiles.insert_one(profile_dict)
        
        # Remove MongoDB _id before returning
        profile_dict.pop("_id", None)
        return {"success": True, "profile": profile_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/goodwill/organizer-profile")
async def get_my_organizer_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current user's organizer profile"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        profile = await db.event_organizer_profiles.find_one({"user_id": user_id}, {"_id": 0})
        
        return {"success": True, "profile": profile}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/organizer-profile/{profile_id}")
async def get_organizer_profile(profile_id: str):
    """Get a specific organizer profile by ID"""
    profile = await db.event_organizer_profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get user info
    user = await db.users.find_one({"id": profile["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
    profile["user"] = user
    
    return {"success": True, "profile": profile}

@api_router.put("/goodwill/organizer-profile")
async def update_organizer_profile(
    request: CreateOrganizerProfileRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update organizer profile"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await db.event_organizer_profiles.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": request.name,
                "description": request.description,
                "contact_email": request.contact_email,
                "contact_phone": request.contact_phone,
                "website": request.website,
                "categories": request.categories,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        profile = await db.event_organizer_profiles.find_one({"user_id": user_id}, {"_id": 0})
        return {"success": True, "profile": profile}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Interest Groups ---

@api_router.post("/goodwill/groups")
async def create_interest_group(
    request: CreateGroupRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create an interest group"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        group = InterestGroup(
            name=request.name,
            description=request.description,
            category_id=request.category_id,
            creator_id=user_id,
            is_public=request.is_public,
            members_count=1
        )
        
        group_dict = group.dict()
        group_dict["created_at"] = group_dict["created_at"].isoformat()
        
        await db.interest_groups.insert_one(group_dict)
        
        # Add creator as member
        await db.group_members.insert_one({
            "group_id": group.id,
            "user_id": user_id,
            "role": "owner",
            "joined_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Remove MongoDB _id before returning
        group_dict.pop("_id", None)
        return {"success": True, "group": group_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/groups")
async def list_interest_groups(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """List interest groups"""
    query = {"is_public": True}
    
    if category_id:
        query["category_id"] = category_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    groups = await db.interest_groups.find(query, {"_id": 0}).sort("members_count", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.interest_groups.count_documents(query)
    
    # Enrich with category info
    for group in groups:
        category = next((c for c in INTEREST_CATEGORIES if c["id"] == group.get("category_id")), None)
        group["category"] = category
    
    return {"groups": groups, "total": total}

@api_router.post("/goodwill/groups/{group_id}/join")
async def join_group(
    group_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Join an interest group"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        group = await db.interest_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if already member
        existing = await db.group_members.find_one({"group_id": group_id, "user_id": user_id})
        if existing:
            raise HTTPException(status_code=400, detail="Already a member")
        
        await db.group_members.insert_one({
            "group_id": group_id,
            "user_id": user_id,
            "role": "member",
            "joined_at": datetime.now(timezone.utc).isoformat()
        })
        
        await db.interest_groups.update_one(
            {"id": group_id},
            {"$inc": {"members_count": 1}}
        )
        
        return {"success": True, "message": "Joined group successfully"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/my-groups")
async def get_my_groups(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get groups the user is a member of"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        memberships = await db.group_members.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        group_ids = [m["group_id"] for m in memberships]
        
        groups = await db.interest_groups.find({"id": {"$in": group_ids}}, {"_id": 0}).to_list(100)
        
        for group in groups:
            category = next((c for c in INTEREST_CATEGORIES if c["id"] == group.get("category_id")), None)
            group["category"] = category
            membership = next((m for m in memberships if m["group_id"] == group["id"]), None)
            group["my_role"] = membership.get("role") if membership else None
        
        return {"groups": groups}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Events ---

@api_router.post("/goodwill/events")
async def create_event(
    request: CreateEventRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Verify organizer profile ownership
        profile = await db.event_organizer_profiles.find_one({"id": request.organizer_profile_id}, {"_id": 0})
        if not profile or profile["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to use this organizer profile")
        
        # Create ticket types
        ticket_types = []
        for tt in request.ticket_types:
            ticket_type = EventTicketType(
                name=tt.get("name", "Стандарт"),
                price=tt.get("price", 0),
                altyn_price=tt.get("altyn_price"),
                quantity=tt.get("quantity", 0),
                description=tt.get("description")
            )
            ticket_types.append(ticket_type.dict())
        
        # Extract YouTube video ID if URL provided
        youtube_video_id = None
        if request.youtube_url:
            youtube_video_id = extract_youtube_id_from_url(request.youtube_url)
        
        event = Event(
            organizer_profile_id=request.organizer_profile_id,
            group_id=request.group_id,
            title=request.title,
            description=request.description,
            category_id=request.category_id,
            cover_image=request.cover_image,
            youtube_url=request.youtube_url,
            youtube_video_id=youtube_video_id,
            city=request.city,
            address=request.address,
            venue_name=request.venue_name,
            latitude=request.latitude,
            longitude=request.longitude,
            is_online=request.is_online,
            online_link=request.online_link,
            start_date=request.start_date,
            end_date=request.end_date,
            visibility=request.visibility,
            capacity=request.capacity,
            enable_waitlist=request.enable_waitlist,
            registration_deadline=request.registration_deadline,
            is_free=request.is_free,
            ticket_types=ticket_types,
            tags=request.tags,
            is_recurring=request.is_recurring,
            recurrence_pattern=request.recurrence_pattern,
            recurrence_end_date=request.recurrence_end_date,
            co_organizer_ids=request.co_organizer_ids
        )
        
        event_dict = event.dict()
        event_dict["start_date"] = event_dict["start_date"].isoformat()
        if event_dict["end_date"]:
            event_dict["end_date"] = event_dict["end_date"].isoformat()
        if event_dict["registration_deadline"]:
            event_dict["registration_deadline"] = event_dict["registration_deadline"].isoformat()
        event_dict["created_at"] = event_dict["created_at"].isoformat()
        event_dict["updated_at"] = event_dict["updated_at"].isoformat()
        
        await db.goodwill_events.insert_one(event_dict)
        
        # Update organizer profile events count
        await db.event_organizer_profiles.update_one(
            {"id": request.organizer_profile_id},
            {"$inc": {"events_count": 1}}
        )
        
        # Remove MongoDB _id before returning
        event_dict.pop("_id", None)
        return {"success": True, "event": event_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/goodwill/events")
async def list_events(
    category_id: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    visibility: Optional[str] = None,
    group_id: Optional[str] = None,
    start_from: Optional[str] = None,
    start_to: Optional[str] = None,
    is_free: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(lambda: None)
):
    """List events with filters"""
    query = {}
    
    # Default to public events if not authenticated
    user_id = None
    user_groups = []
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            # Get user's groups for GROUP_ONLY visibility
            memberships = await db.group_members.find({"user_id": user_id}, {"_id": 0}).to_list(100)
            user_groups = [m["group_id"] for m in memberships]
        except:
            pass
    
    # Visibility filter
    if user_id:
        query["$or"] = [
            {"visibility": "PUBLIC"},
            {"visibility": "PRIVATE", "organizer_profile_id": {"$in": await get_user_organizer_ids(user_id)}},
            {"visibility": "GROUP_ONLY", "group_id": {"$in": user_groups}}
        ]
    else:
        query["visibility"] = "PUBLIC"
    
    if category_id:
        query["category_id"] = category_id
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["$and"] = query.get("$and", []) + [{"$or": [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]}]
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["UPCOMING", "ONGOING"]}
    if group_id:
        query["group_id"] = group_id
    if is_free is not None:
        query["is_free"] = is_free
    if start_from:
        query["start_date"] = {"$gte": start_from}
    if start_to:
        query.setdefault("start_date", {})["$lte"] = start_to
    
    events = await db.goodwill_events.find(query, {"_id": 0}).sort("start_date", 1).skip(offset).limit(limit).to_list(limit)
    total = await db.goodwill_events.count_documents(query)
    
    # Enrich events with organizer info and category
    for event in events:
        category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
        event["category"] = category
        
        organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0, "name": 1, "logo": 1})
        event["organizer"] = organizer
        
        # Check if user is attending
        if user_id:
            attendance = await db.event_attendees.find_one({"event_id": event["id"], "user_id": user_id}, {"_id": 0})
            event["my_rsvp"] = attendance.get("status") if attendance else None
    
    return {"events": events, "total": total}

async def get_user_organizer_ids(user_id: str) -> List[str]:
    """Get all organizer profile IDs the user owns or is part of"""
    profiles = await db.event_organizer_profiles.find({"user_id": user_id}, {"_id": 0, "id": 1}).to_list(100)
    return [p["id"] for p in profiles]

@api_router.get("/goodwill/events/{event_id}")
async def get_event(
    event_id: str,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
):
    """Get event details"""
    event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Increment view count
    await db.goodwill_events.update_one({"id": event_id}, {"$inc": {"view_count": 1}})
    
    # Get organizer info
    organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0})
    if organizer:
        user = await db.users.find_one({"id": organizer.get("user_id")}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
        organizer["user"] = user
    event["organizer"] = organizer
    
    # Get category
    category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
    event["category"] = category
    
    # Check user's RSVP status
    user_id = None
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            attendance = await db.event_attendees.find_one({"event_id": event_id, "user_id": user_id}, {"_id": 0})
            event["my_rsvp"] = attendance.get("status") if attendance else None
            event["my_attendance"] = attendance
        except:
            pass
    
    # Get attendees preview
    attendees = await db.event_attendees.find(
        {"event_id": event_id, "status": "GOING"},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    for att in attendees:
        user = await db.users.find_one({"id": att["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
        att["user"] = user
    
    event["attendees_preview"] = attendees
    
    return {"success": True, "event": event}

@api_router.post("/goodwill/events/{event_id}/rsvp")
async def rsvp_to_event(
    event_id: str,
    request: RSVPRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """RSVP to an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check capacity for GOING status
        if request.status == RSVPStatus.GOING:
            if event.get("capacity", 0) > 0 and event.get("attendees_count", 0) >= event["capacity"]:
                if event.get("enable_waitlist"):
                    request.status = RSVPStatus.WAITLIST
                else:
                    raise HTTPException(status_code=400, detail="Event is at full capacity")
        
        # Check existing RSVP
        existing = await db.event_attendees.find_one({"event_id": event_id, "user_id": user_id})
        old_status = existing.get("status") if existing else None
        
        if existing:
            await db.event_attendees.update_one(
                {"event_id": event_id, "user_id": user_id},
                {"$set": {"status": request.status.value, "ticket_type_id": request.ticket_type_id}}
            )
        else:
            attendee = EventAttendee(
                event_id=event_id,
                user_id=user_id,
                status=request.status,
                ticket_type_id=request.ticket_type_id
            )
            att_dict = attendee.dict()
            att_dict["registered_at"] = att_dict["registered_at"].isoformat()
            await db.event_attendees.insert_one(att_dict)
        
        # Update event counts
        update_ops = {}
        if request.status == RSVPStatus.GOING:
            update_ops["$inc"] = {"attendees_count": 1}
            if old_status == "MAYBE":
                update_ops["$inc"]["maybe_count"] = -1
            elif old_status == "WAITLIST":
                update_ops["$inc"]["waitlist_count"] = -1
        elif request.status == RSVPStatus.MAYBE:
            update_ops["$inc"] = {"maybe_count": 1}
            if old_status == "GOING":
                update_ops["$inc"]["attendees_count"] = -1
            elif old_status == "WAITLIST":
                update_ops["$inc"]["waitlist_count"] = -1
        elif request.status == RSVPStatus.WAITLIST:
            update_ops["$inc"] = {"waitlist_count": 1}
            if old_status == "GOING":
                update_ops["$inc"]["attendees_count"] = -1
            elif old_status == "MAYBE":
                update_ops["$inc"]["maybe_count"] = -1
        elif request.status == RSVPStatus.NOT_GOING:
            if old_status == "GOING":
                update_ops["$inc"] = {"attendees_count": -1}
            elif old_status == "MAYBE":
                update_ops["$inc"] = {"maybe_count": -1}
            elif old_status == "WAITLIST":
                update_ops["$inc"] = {"waitlist_count": -1}
        
        if update_ops:
            await db.goodwill_events.update_one({"id": event_id}, update_ops)
        
        return {"success": True, "status": request.status.value, "message": "RSVP updated"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.post("/goodwill/events/{event_id}/purchase-ticket")
async def purchase_event_ticket(
    event_id: str,
    request: PurchaseTicketRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Purchase a ticket for an event with ALTYN COIN"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if event.get("is_free"):
            raise HTTPException(status_code=400, detail="This is a free event")
        
        # Find ticket type
        ticket_type = None
        for tt in event.get("ticket_types", []):
            if tt["id"] == request.ticket_type_id:
                ticket_type = tt
                break
        
        if not ticket_type:
            raise HTTPException(status_code=404, detail="Ticket type not found")
        
        # Check availability
        if ticket_type.get("quantity", 0) > 0 and ticket_type.get("sold", 0) >= ticket_type["quantity"]:
            raise HTTPException(status_code=400, detail="Tickets sold out")
        
        # Get price
        if request.pay_with_altyn:
            if not ticket_type.get("altyn_price"):
                raise HTTPException(status_code=400, detail="ALTYN payment not available for this ticket")
            price = ticket_type["altyn_price"]
        else:
            price = ticket_type.get("price", 0)
        
        # Process ALTYN payment
        if request.pay_with_altyn and price > 0:
            buyer_wallet = await get_or_create_wallet(user_id)
            if buyer_wallet["coin_balance"] < price:
                raise HTTPException(status_code=400, detail="Insufficient ALTYN COIN balance")
            
            # Get organizer's user_id for payment
            organizer = await db.event_organizer_profiles.find_one({"id": event["organizer_profile_id"]}, {"_id": 0})
            if not organizer:
                raise HTTPException(status_code=500, detail="Organizer not found")
            
            seller_id = organizer["user_id"]
            seller_wallet = await get_or_create_wallet(seller_id)
            treasury = await get_or_create_treasury()
            
            # Calculate fee
            fee_amount = price * TRANSACTION_FEE_RATE
            net_amount = price - fee_amount
            
            # Update balances
            await db.wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"coin_balance": -price}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.wallets.update_one(
                {"user_id": seller_id},
                {"$inc": {"coin_balance": net_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            await db.wallets.update_one(
                {"is_treasury": True},
                {"$inc": {"coin_balance": fee_amount}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Record transaction
            tx_id = str(uuid.uuid4())
            tx = {
                "id": tx_id,
                "from_wallet_id": buyer_wallet["id"],
                "to_wallet_id": seller_wallet["id"],
                "from_user_id": user_id,
                "to_user_id": seller_id,
                "amount": price,
                "asset_type": "COIN",
                "transaction_type": "PAYMENT",
                "fee_amount": fee_amount,
                "description": f"Event ticket: {event['title']} - {ticket_type['name']}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.transactions.insert_one(tx)
            
            # Record attendance
            attendee = EventAttendee(
                event_id=event_id,
                user_id=user_id,
                status=RSVPStatus.GOING,
                ticket_type_id=request.ticket_type_id,
                ticket_price_paid=price,
                payment_transaction_id=tx_id
            )
            att_dict = attendee.dict()
            att_dict["registered_at"] = att_dict["registered_at"].isoformat()
            
            # Check if already registered
            existing = await db.event_attendees.find_one({"event_id": event_id, "user_id": user_id})
            if existing:
                await db.event_attendees.update_one(
                    {"event_id": event_id, "user_id": user_id},
                    {"$set": att_dict}
                )
            else:
                await db.event_attendees.insert_one(att_dict)
                await db.goodwill_events.update_one({"id": event_id}, {"$inc": {"attendees_count": 1}})
            
            # Update ticket sold count
            for i, tt in enumerate(event["ticket_types"]):
                if tt["id"] == request.ticket_type_id:
                    event["ticket_types"][i]["sold"] = tt.get("sold", 0) + 1
                    break
            await db.goodwill_events.update_one({"id": event_id}, {"$set": {"ticket_types": event["ticket_types"]}})
            
            # Get names for receipt
            buyer_user = await db.users.find_one({"id": user_id}, {"_id": 0, "first_name": 1, "last_name": 1})
            
            return {
                "success": True,
                "payment": {
                    "transaction_id": tx_id,
                    "amount": price,
                    "fee": fee_amount,
                    "organizer_received": net_amount
                },
                "receipt": {
                    "receipt_id": tx_id,
                    "date": datetime.now(timezone.utc).isoformat(),
                    "type": "EVENT_TICKET",
                    "buyer_name": f"{buyer_user.get('first_name', '')} {buyer_user.get('last_name', '')}".strip() if buyer_user else "Unknown",
                    "event_title": event["title"],
                    "ticket_type": ticket_type["name"],
                    "item_price": price,
                    "fee_amount": fee_amount,
                    "fee_rate": "0.1%",
                    "total_paid": price,
                    "currency": "ALTYN COIN (AC)",
                    "status": "COMPLETED"
                }
            }
        
        raise HTTPException(status_code=400, detail="Non-ALTYN payments not implemented yet")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/goodwill/my-events")
async def get_my_events(
    as_organizer: bool = False,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get events the user is attending or organizing"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        if as_organizer:
            # Get user's organizer profiles
            profiles = await db.event_organizer_profiles.find({"user_id": user_id}, {"_id": 0}).to_list(10)
            profile_ids = [p["id"] for p in profiles]
            
            events = await db.goodwill_events.find(
                {"organizer_profile_id": {"$in": profile_ids}},
                {"_id": 0}
            ).sort("start_date", -1).to_list(100)
        else:
            # Get events user is attending
            attendances = await db.event_attendees.find(
                {"user_id": user_id, "status": {"$in": ["GOING", "MAYBE", "WAITLIST"]}},
                {"_id": 0}
            ).to_list(100)
            event_ids = [a["event_id"] for a in attendances]
            
            events = await db.goodwill_events.find(
                {"id": {"$in": event_ids}},
                {"_id": 0}
            ).sort("start_date", 1).to_list(100)
            
            # Add attendance info
            for event in events:
                att = next((a for a in attendances if a["event_id"] == event["id"]), None)
                event["my_rsvp"] = att.get("status") if att else None
        
        # Enrich with category
        for event in events:
            category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
            event["category"] = category
        
        return {"events": events}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/calendar")
async def get_events_calendar(
    month: int,
    year: int,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(lambda: None)
):
    """Get events for calendar view"""
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    query = {
        "start_date": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()},
        "status": {"$in": ["UPCOMING", "ONGOING"]},
        "visibility": "PUBLIC"
    }
    
    events = await db.goodwill_events.find(query, {"_id": 0}).sort("start_date", 1).to_list(100)
    
    # Group by date
    calendar_data = {}
    for event in events:
        date_str = event["start_date"][:10]  # YYYY-MM-DD
        if date_str not in calendar_data:
            calendar_data[date_str] = []
        
        category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
        calendar_data[date_str].append({
            "id": event["id"],
            "title": event["title"],
            "start_date": event["start_date"],
            "category": category,
            "city": event.get("city"),
            "is_free": event.get("is_free", True)
        })
    
    return {"calendar": calendar_data, "month": month, "year": year}

# --- Invitations ---

@api_router.post("/goodwill/invitations")
async def invite_to_event(
    request: InviteToEventRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Invite users to an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": request.event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        invitations = []
        for invitee_id in request.invitee_ids:
            # Check if already invited
            existing = await db.event_invitations.find_one({
                "event_id": request.event_id,
                "invitee_id": invitee_id
            })
            if existing:
                continue
            
            invitation = EventInvitation(
                event_id=request.event_id,
                inviter_id=user_id,
                invitee_id=invitee_id,
                message=request.message
            )
            inv_dict = invitation.dict()
            inv_dict["created_at"] = inv_dict["created_at"].isoformat()
            await db.event_invitations.insert_one(inv_dict)
            invitations.append(inv_dict)
        
        return {"success": True, "invitations_sent": len(invitations)}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/my-invitations")
async def get_my_invitations(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get invitations sent to the user"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        invitations = await db.event_invitations.find(
            {"invitee_id": user_id, "status": "pending"},
            {"_id": 0}
        ).sort("created_at", -1).to_list(50)
        
        # Enrich with event and inviter info
        for inv in invitations:
            event = await db.goodwill_events.find_one({"id": inv["event_id"]}, {"_id": 0, "title": 1, "start_date": 1, "city": 1, "category_id": 1})
            if event:
                category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
                event["category"] = category
            inv["event"] = event
            
            inviter = await db.users.find_one({"id": inv["inviter_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
            inv["inviter"] = inviter
        
        return {"invitations": invitations}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.put("/goodwill/invitations/{invitation_id}")
async def respond_to_invitation(
    invitation_id: str,
    accept: bool,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Accept or decline an invitation"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        invitation = await db.event_invitations.find_one({"id": invitation_id, "invitee_id": user_id}, {"_id": 0})
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        new_status = "accepted" if accept else "declined"
        await db.event_invitations.update_one(
            {"id": invitation_id},
            {"$set": {"status": new_status}}
        )
        
        # If accepted, add to attendees
        if accept:
            event = await db.goodwill_events.find_one({"id": invitation["event_id"]}, {"_id": 0})
            if event:
                existing = await db.event_attendees.find_one({"event_id": invitation["event_id"], "user_id": user_id})
                if not existing:
                    attendee = EventAttendee(
                        event_id=invitation["event_id"],
                        user_id=user_id,
                        status=RSVPStatus.GOING
                    )
                    att_dict = attendee.dict()
                    att_dict["registered_at"] = att_dict["registered_at"].isoformat()
                    await db.event_attendees.insert_one(att_dict)
                    await db.goodwill_events.update_one({"id": invitation["event_id"]}, {"$inc": {"attendees_count": 1}})
        
        return {"success": True, "status": new_status}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/favorites")
async def get_favorite_events(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's favorite events"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        favorites = await db.event_favorites.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        event_ids = [f["event_id"] for f in favorites]
        
        events = await db.goodwill_events.find({"id": {"$in": event_ids}}, {"_id": 0}).to_list(100)
        
        for event in events:
            category = next((c for c in INTEREST_CATEGORIES if c["id"] == event.get("category_id")), None)
            event["category"] = category
        
        return {"events": events}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.post("/goodwill/favorites/{event_id}")
async def toggle_favorite_event(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Toggle favorite status for an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        existing = await db.event_favorites.find_one({"event_id": event_id, "user_id": user_id})
        
        if existing:
            await db.event_favorites.delete_one({"event_id": event_id, "user_id": user_id})
            return {"success": True, "is_favorite": False}
        else:
            await db.event_favorites.insert_one({
                "event_id": event_id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            return {"success": True, "is_favorite": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Event Reviews ---

@api_router.post("/goodwill/events/{event_id}/reviews")
async def add_event_review(
    event_id: str,
    request: AddReviewRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Add a review to an event (only after attending)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user attended the event
        attendance = await db.event_attendees.find_one({
            "event_id": event_id, 
            "user_id": user_id,
            "status": "GOING"
        })
        if not attendance:
            raise HTTPException(status_code=403, detail="You must attend the event to review it")
        
        # Check if already reviewed
        existing = await db.event_reviews.find_one({"event_id": event_id, "user_id": user_id})
        if existing:
            raise HTTPException(status_code=400, detail="You already reviewed this event")
        
        review = EventReview(
            event_id=event_id,
            user_id=user_id,
            rating=max(1, min(5, request.rating)),
            comment=request.comment
        )
        review_dict = review.dict()
        review_dict["created_at"] = review_dict["created_at"].isoformat()
        
        await db.event_reviews.insert_one(review_dict)
        
        # Update event stats
        all_reviews = await db.event_reviews.find({"event_id": event_id}, {"_id": 0, "rating": 1}).to_list(1000)
        avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews) if all_reviews else 0
        
        await db.goodwill_events.update_one(
            {"id": event_id},
            {"$set": {"reviews_count": len(all_reviews), "average_rating": round(avg_rating, 1)}}
        )
        
        review_dict.pop("_id", None)
        return {"success": True, "review": review_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/goodwill/events/{event_id}/reviews")
async def get_event_reviews(event_id: str, limit: int = 20, offset: int = 0):
    """Get reviews for an event"""
    reviews = await db.event_reviews.find(
        {"event_id": event_id}, {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with user info
    for review in reviews:
        user = await db.users.find_one({"id": review["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
        review["user"] = user
    
    return {"reviews": reviews}

# --- Event Photo Gallery ---

@api_router.post("/goodwill/events/{event_id}/photos")
async def add_event_photo(
    event_id: str,
    request: AddPhotoRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Add a photo to event gallery (attendees only)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user attended
        attendance = await db.event_attendees.find_one({
            "event_id": event_id,
            "user_id": user_id,
            "status": "GOING"
        })
        if not attendance:
            raise HTTPException(status_code=403, detail="Only attendees can add photos")
        
        photo = EventPhoto(
            event_id=event_id,
            user_id=user_id,
            photo_url=request.photo_url,
            caption=request.caption
        )
        photo_dict = photo.dict()
        photo_dict["created_at"] = photo_dict["created_at"].isoformat()
        
        await db.event_photos.insert_one(photo_dict)
        
        # Update photo count
        await db.goodwill_events.update_one(
            {"id": event_id},
            {"$inc": {"photos_count": 1}}
        )
        
        photo_dict.pop("_id", None)
        return {"success": True, "photo": photo_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/events/{event_id}/photos")
async def get_event_photos(event_id: str, limit: int = 50, offset: int = 0):
    """Get photos from event gallery"""
    photos = await db.event_photos.find(
        {"event_id": event_id}, {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    for photo in photos:
        user = await db.users.find_one({"id": photo["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
        photo["user"] = user
    
    return {"photos": photos}

# --- Event Chat ---

@api_router.post("/goodwill/events/{event_id}/chat")
async def send_chat_message(
    event_id: str,
    request: EventChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Send a message in event chat (attendees only)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is attendee or organizer
        attendance = await db.event_attendees.find_one({
            "event_id": event_id,
            "user_id": user_id
        })
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0})
        
        is_organizer = organizer and organizer.get("user_id") == user_id
        is_co_organizer = user_id in event.get("co_organizer_ids", [])
        is_attending = attendance and attendance.get("status") == "GOING"
        
        if not is_attending and not is_organizer and not is_co_organizer:
            raise HTTPException(status_code=403, detail="Only participants can chat")
        
        message = EventChatMessage(
            event_id=event_id,
            user_id=user_id,
            message=request.message
        )
        msg_dict = message.dict()
        msg_dict["created_at"] = msg_dict["created_at"].isoformat()
        
        await db.event_chat.insert_one(msg_dict)
        
        msg_dict.pop("_id", None)
        
        # Get user info
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
        msg_dict["user"] = user
        
        return {"success": True, "message": msg_dict}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/goodwill/events/{event_id}/chat")
async def get_chat_messages(
    event_id: str,
    limit: int = 50,
    offset: int = 0,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get chat messages for an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        messages = await db.event_chat.find(
            {"event_id": event_id}, {"_id": 0}
        ).sort("created_at", 1).skip(offset).limit(limit).to_list(limit)
        
        for msg in messages:
            user = await db.users.find_one({"id": msg["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "profile_picture": 1})
            msg["user"] = user
        
        return {"messages": messages}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Event Sharing ---

@api_router.post("/goodwill/events/{event_id}/share")
async def share_event_to_feed(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Share an event to user's feed"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Create a post about the event
        post = {
            "id": str(uuid.uuid4()),
            "author_id": user_id,
            "content": f"🎉 Приглашаю на мероприятие!\n\n📌 {event['title']}\n📅 {event['start_date'][:10]}\n📍 {event.get('city', 'Онлайн')}",
            "source_module": "community",
            "visibility": "PUBLIC",
            "shared_event_id": event_id,
            "likes_count": 0,
            "comments_count": 0,
            "reactions": {},
            "youtube_urls": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.posts.insert_one(post)
        post.pop("_id", None)
        
        return {"success": True, "post": post, "share_url": f"/events/{event_id}"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Event Reminders ---

@api_router.post("/goodwill/events/{event_id}/reminder")
async def set_event_reminder(
    event_id: str,
    hours_before: int = 24,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Set a reminder for an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        reminder = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "user_id": user_id,
            "hours_before": hours_before,
            "remind_at": (datetime.fromisoformat(event["start_date"].replace("Z", "+00:00")) - timedelta(hours=hours_before)).isoformat(),
            "is_sent": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove existing reminder for this event/user
        await db.event_reminders.delete_many({"event_id": event_id, "user_id": user_id})
        await db.event_reminders.insert_one(reminder)
        
        return {"success": True, "reminder": {"remind_at": reminder["remind_at"], "hours_before": hours_before}}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.delete("/goodwill/events/{event_id}/reminder")
async def remove_event_reminder(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Remove a reminder for an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        await db.event_reminders.delete_many({"event_id": event_id, "user_id": user_id})
        
        return {"success": True}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- QR Check-in ---

@api_router.get("/goodwill/events/{event_id}/qr-code")
async def get_event_qr_code(
    event_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get QR code for event check-in (organizer only)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if organizer
        organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0})
        if not organizer or (organizer.get("user_id") != user_id and user_id not in event.get("co_organizer_ids", [])):
            raise HTTPException(status_code=403, detail="Only organizers can access QR code")
        
        # Generate or get existing checkin code
        checkin_code = event.get("checkin_code")
        if not checkin_code:
            checkin_code = f"EVT-{event_id[:8].upper()}-{str(uuid.uuid4())[:4].upper()}"
            await db.goodwill_events.update_one({"id": event_id}, {"$set": {"checkin_code": checkin_code}})
        
        # Generate QR code image
        qr_data = f"goodwill://checkin/{event_id}/{checkin_code}"
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        qr_img.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "checkin_code": checkin_code,
            "qr_data": qr_data,
            "qr_image": f"data:image/png;base64,{qr_base64}",
            "event_title": event["title"]
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.post("/goodwill/events/checkin")
async def checkin_to_event(
    checkin_code: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Check in to an event using QR code"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"checkin_code": checkin_code}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Invalid check-in code")
        
        # Check if user is registered
        attendance = await db.event_attendees.find_one({
            "event_id": event["id"],
            "user_id": user_id
        })
        
        if not attendance:
            raise HTTPException(status_code=400, detail="You are not registered for this event")
        
        # Update attendance with check-in time
        await db.event_attendees.update_one(
            {"event_id": event["id"], "user_id": user_id},
            {"$set": {"checked_in_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"success": True, "message": "Check-in successful!", "event_title": event["title"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

# --- Co-organizers ---

@api_router.post("/goodwill/events/{event_id}/co-organizers")
async def add_co_organizer(
    event_id: str,
    user_id_to_add: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Add a co-organizer to an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if main organizer
        organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0})
        if not organizer or organizer.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Only main organizer can add co-organizers")
        
        co_organizers = event.get("co_organizer_ids", [])
        if user_id_to_add not in co_organizers:
            co_organizers.append(user_id_to_add)
            await db.goodwill_events.update_one(
                {"id": event_id},
                {"$set": {"co_organizer_ids": co_organizers}}
            )
        
        return {"success": True, "co_organizer_ids": co_organizers}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.delete("/goodwill/events/{event_id}/co-organizers/{co_organizer_id}")
async def remove_co_organizer(
    event_id: str,
    co_organizer_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Remove a co-organizer from an event"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        event = await db.goodwill_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        organizer = await db.event_organizer_profiles.find_one({"id": event.get("organizer_profile_id")}, {"_id": 0})
        if not organizer or organizer.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Only main organizer can remove co-organizers")
        
        co_organizers = event.get("co_organizer_ids", [])
        if co_organizer_id in co_organizers:
            co_organizers.remove(co_organizer_id)
            await db.goodwill_events.update_one(
                {"id": event_id},
                {"$set": {"co_organizer_ids": co_organizers}}
            )
        
        return {"success": True, "co_organizer_ids": co_organizers}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")


# ===== ERIC AI AGENT ENDPOINTS =====
from eric_agent import ERICAgent, ChatRequest, ChatResponse, AgentSettings, AgentConversation

# Initialize ERIC agent
eric_agent = ERICAgent(db)

# Helper function to process @ERIC mentions in posts
async def process_eric_mention_for_post(post_id: str, post_content: str, author_name: str, user_id: str):
    """Background task to process @ERIC mentions and add AI comment"""
    try:
        # Get ERIC's response
        eric_response = await eric_agent.process_post_mention(
            user_id=user_id,
            post_id=post_id,
            post_content=post_content,
            author_name=author_name
        )
        
        # Create ERIC's comment on the post
        eric_comment = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": "eric-ai",  # Special ERIC user ID
            "content": eric_response,
            "likes_count": 0,
            "liked_by": [],
            "parent_comment_id": None,
            "is_edited": False,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # ERIC's virtual author info
            "author": {
                "id": "eric-ai",
                "first_name": "ERIC",
                "last_name": "AI",
                "profile_picture": "/eric-avatar.jpg"
            }
        }
        
        # Insert the comment
        await db.post_comments.insert_one(eric_comment)
        
        # Update post's comment count
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        logging.info(f"ERIC commented on post {post_id}")
        
    except Exception as e:
        logging.error(f"Error processing ERIC mention for post {post_id}: {str(e)}")

# Helper function to process @ERIC mentions in news posts
async def process_eric_mention_for_news_post(post_id: str, post_content: str, author_name: str, user_id: str):
    """Background task to process @ERIC mentions in news posts and add AI comment"""
    try:
        # Get ERIC's response
        eric_response = await eric_agent.process_post_mention(
            user_id=user_id,
            post_id=post_id,
            post_content=post_content,
            author_name=author_name
        )
        
        # Create ERIC's comment on the news post
        eric_comment = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": "eric-ai",
            "content": eric_response,
            "likes_count": 0,
            "parent_comment_id": None,
            "is_edited": False,
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Insert the comment into news_post_comments
        await db.news_post_comments.insert_one(eric_comment)
        
        # Update news post's comment count
        await db.news_posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        logging.info(f"ERIC commented on news post {post_id}")
        
    except Exception as e:
        logging.error(f"Error processing ERIC mention for news post {post_id}: {str(e)}")

@api_router.post("/agent/chat")
async def agent_chat(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Send message to ERIC and receive AI response"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Rate limiting for AI requests
        if not await check_rate_limit(user_id, "ai_chat"):
            raise HTTPException(
                status_code=429, 
                detail="Слишком много запросов. Пожалуйста, подождите минуту."
            )
        
        response = await eric_agent.chat(user_id, request)
        return response.dict()
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/agent/conversations")
async def get_agent_conversations(
    limit: int = 20,
    offset: int = 0,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's conversation history with ERIC"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        conversations = await eric_agent.get_conversations(user_id, limit, offset)
        return {"conversations": conversations}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/agent/conversations/{conversation_id}")
async def get_agent_conversation(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get specific conversation with messages"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        conversation = await eric_agent.get_conversation(user_id, conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return conversation
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.delete("/agent/conversations/{conversation_id}")
async def delete_agent_conversation(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a conversation"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        success = await eric_agent.delete_conversation(user_id, conversation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {"success": True, "message": "Conversation deleted"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/agent/settings")
async def get_agent_settings(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user's ERIC privacy settings"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        settings = await eric_agent.get_settings(user_id)
        return settings.dict()
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.put("/agent/settings")
async def update_agent_settings(
    updates: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update user's ERIC privacy settings"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Only allow updating specific fields
        allowed_fields = [
            "allow_financial_analysis",
            "allow_health_data_access", 
            "allow_location_tracking",
            "allow_family_coordination",
            "allow_service_recommendations",
            "allow_marketplace_suggestions",
            "allow_work_context",
            "allow_calendar_context",
            "conversation_retention_days"
        ]
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        settings = await eric_agent.update_settings(user_id, filtered_updates)
        return settings.dict()
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.post("/agent/post-mention")
async def process_post_mention(
    post_id: str,
    post_content: str,
    author_name: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Process @ERIC mention in a post and generate comment"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        response = await eric_agent.process_post_mention(user_id, post_id, post_content, author_name)
        return {"comment": response}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

@api_router.get("/agent/profile")
async def get_eric_profile():
    """Get ERIC's profile information for display"""
    return {
        "id": "eric-ai",
        "name": "ERIC",
        "full_name": "Enhanced Reasoning Intelligence Core",
        "avatar": "/eric-avatar.jpg",
        "description": "Ваш персональный ИИ-помощник и финансовый советник",
        "capabilities": [
            {"icon": "👨‍👩‍👧‍👦", "name": "Семейное управление", "description": "Планирование событий, координация семьи"},
            {"icon": "💰", "name": "Финансовый советник", "description": "Анализ расходов, бюджетирование"},
            {"icon": "🛒", "name": "Подбор услуг", "description": "Поиск и сравнение услуг"},
            {"icon": "🤝", "name": "Связь с сообществом", "description": "События, маркетплейс, соседи"},
            {"icon": "📷", "name": "Анализ изображений", "description": "Распознавание и описание фото"},
            {"icon": "📄", "name": "Анализ документов", "description": "Чтение и анализ документов"}
        ],
        "status": "online"
    }

class ImageAnalysisRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"
    question: Optional[str] = None

class DocumentAnalysisRequest(BaseModel):
    document_text: str
    document_name: str
    question: Optional[str] = None

class ChatWithImageRequest(BaseModel):
    message: str
    image_base64: str
    mime_type: str = "image/jpeg"
    conversation_id: Optional[str] = None

@api_router.post("/agent/analyze-image")
async def analyze_image(
    request: ImageAnalysisRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Analyze an image using Claude Sonnet 4.5"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.analyze_image(
            user_id=user_id,
            image_base64=request.image_base64,
            mime_type=request.mime_type,
            question=request.question
        )
        
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/analyze-file-upload")
async def analyze_file_upload(
    file: UploadFile = File(None),
    file_url: str = Form(None),
    context_type: str = Form("generic"),
    context_data: str = Form("{}"),
    message: str = Form("Проанализируй этот файл"),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Smart file analysis endpoint with cost optimization.
    
    Routing:
    - Images (PNG, JPG, WEBP, etc.) -> Claude Sonnet (vision required)
    - Documents (PDF, DOCX, TXT, CSV, XLSX, etc.) -> DeepSeek (cheaper)
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Parse context data
        import json as json_module
        context = json_module.loads(context_data) if context_data else {}
        
        # Handle file upload
        if file and file.filename:
            # Read file content
            file_content = await file.read()
            mime_type = file.content_type or "application/octet-stream"
            
            # Build enhanced prompt with context
            enhanced_message = f"Контекст: {context_type}\n"
            if context:
                enhanced_message += f"Дополнительные данные: {json_module.dumps(context, ensure_ascii=False)}\n"
            enhanced_message += f"\nЗапрос: {message}"
            
            # Use smart file routing
            result = await eric_agent.analyze_file_smart(
                user_id=user_id,
                file_content=file_content,
                filename=file.filename,
                mime_type=mime_type,
                question=enhanced_message
            )
            
            print(f"[DEBUG] analyze_file_smart result - routing: {result.get('routing', {})}")
            
            # Extract analysis from result
            if result.get("success"):
                analysis_text = result.get("analysis", "Анализ завершён")
                # If analysis is a dict, try to extract text
                if isinstance(analysis_text, dict):
                    analysis_text = analysis_text.get("content", analysis_text.get("text", str(analysis_text)))
                
                return {
                    "analysis": analysis_text,
                    "routing": result.get("routing", {})  # Include routing info for debugging
                }
            else:
                return {"analysis": result.get("error", "Ошибка анализа")}
        
        elif file_url:
            # Handle file URL - return a message that we need to implement URL fetching
            return {"analysis": f"Анализ по URL пока не поддерживается. Пожалуйста, загрузите файл напрямую."}
        
        else:
            raise HTTPException(status_code=400, detail="Файл не предоставлен")
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        print(f"File analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/analyze-document")
async def analyze_document(
    request: DocumentAnalysisRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Analyze a document using Claude Sonnet 4.5"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.analyze_document(
            user_id=user_id,
            document_text=request.document_text,
            document_name=request.document_name,
            question=request.question
        )
        
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/chat-with-image")
async def chat_with_image(
    request: ChatWithImageRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Chat with ERIC while providing an image for context"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.chat_with_image(
            user_id=user_id,
            message=request.message,
            image_base64=request.image_base64,
            mime_type=request.mime_type,
            conversation_id=request.conversation_id
        )
        
        return result.dict()
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== ERIC SEARCH ENDPOINTS =====

class SearchRequestModel(BaseModel):
    query: str
    search_type: str = "all"  # "all", "services", "products", "people", "organizations"
    location: Optional[str] = None
    limit: int = 10

class ChatRequestModel(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@api_router.post("/agent/search")
async def eric_search(
    request: SearchRequestModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Search across the ZION.CITY platform using ERIC"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.search_platform(
            user_id=user_id,
            query=request.query,
            search_type=request.search_type,
            location=request.location,
            limit=request.limit
        )
        
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/chat-with-search")
async def chat_with_search(
    request: ChatRequestModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Chat with ERIC with automatic platform search capabilities"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Rate limiting for AI search requests
        if not await check_rate_limit(user_id, "ai_chat"):
            raise HTTPException(
                status_code=429, 
                detail="Слишком много запросов. Пожалуйста, подождите минуту."
            )
        
        result = await eric_agent.chat_with_search(
            user_id=user_id,
            message=request.message,
            conversation_id=request.conversation_id
        )
        
        return result.dict()
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QueryBusinessesRequest(BaseModel):
    query: str
    category: Optional[str] = None
    limit: int = 5

@api_router.post("/agent/query-businesses")
async def query_businesses(
    request: QueryBusinessesRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Query multiple business ERICs for recommendations (Inter-Agent Communication)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.query_multiple_businesses(
            user_id=user_id,
            query=request.query,
            category=request.category,
            limit=request.limit
        )
        
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== BUSINESS ERIC SETTINGS ENDPOINTS =====

class BusinessERICSettingsModel(BaseModel):
    is_active: bool = True
    share_public_data: bool = True
    share_promotions: bool = True
    share_repeat_customer_stats: bool = False
    share_ratings_reviews: bool = False
    allow_user_eric_queries: bool = True
    share_aggregated_analytics: bool = False
    business_description: Optional[str] = None
    specialties: List[str] = []

@api_router.get("/work/organizations/{organization_id}/eric-settings")
async def get_business_eric_settings(
    organization_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get ERIC AI settings for a business/organization"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin of this organization
        membership = await db.work_memberships.find_one({
            "organization_id": organization_id,
            "user_id": user_id,
            "is_admin": True
        })
        
        # Also check if user is the organization creator/owner
        org = await db.work_organizations.find_one({"id": organization_id})
        is_creator = org and (org.get("creator_id") == user_id or org.get("owner_user_id") == user_id or org.get("created_by") == user_id)
        
        if not membership and not is_creator:
            raise HTTPException(status_code=403, detail="Only admins can access ERIC settings")
        
        settings = await eric_agent.get_business_settings(organization_id)
        if settings:
            return settings.dict()
        
        # Return default settings
        from eric_agent import BusinessERICSettings
        default_settings = BusinessERICSettings(organization_id=organization_id)
        return default_settings.dict()
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/work/organizations/{organization_id}/eric-settings")
async def update_business_eric_settings(
    organization_id: str,
    settings_update: BusinessERICSettingsModel,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Update ERIC AI settings for a business/organization"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check if user is admin of this organization
        membership = await db.work_memberships.find_one({
            "organization_id": organization_id,
            "user_id": user_id,
            "is_admin": True
        })
        
        # Also check if user is the organization creator/owner
        org = await db.work_organizations.find_one({"id": organization_id})
        is_creator = org and (org.get("creator_id") == user_id or org.get("owner_user_id") == user_id or org.get("created_by") == user_id)
        
        if not membership and not is_creator:
            raise HTTPException(status_code=403, detail="Only admins can update ERIC settings")
        
        from eric_agent import BusinessERICSettings
        settings = BusinessERICSettings(
            organization_id=organization_id,
            **settings_update.dict()
        )
        
        saved_settings = await eric_agent.save_business_settings(settings)
        return saved_settings.dict()
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agent/query-business/{organization_id}")
async def query_business_eric(
    organization_id: str,
    query: str = Body(..., embed=True),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Query a business's ERIC agent for information (respects privacy settings)"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        result = await eric_agent.query_business_eric(
            user_id=user_id,
            organization_id=organization_id,
            query=query
        )
        
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== BUSINESS ANALYTICS ENDPOINTS =====

@api_router.get("/work/organizations/{organization_id}/analytics")
async def get_business_analytics(
    organization_id: str,
    period: str = "30d",  # 7d, 30d, 90d, all
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get aggregated analytics for a business/organization - admin only"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        
        # Check admin access
        membership = await db.work_memberships.find_one({
            "organization_id": organization_id,
            "user_id": user_id,
            "is_admin": True
        })
        org = await db.work_organizations.find_one({"id": organization_id})
        is_creator = org and (org.get("creator_id") == user_id or org.get("owner_user_id") == user_id or org.get("created_by") == user_id)
        
        if not membership and not is_creator:
            raise HTTPException(status_code=403, detail="Only admins can view analytics")
        
        # Calculate date range
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        if period == "7d":
            start_date = now - timedelta(days=7)
        elif period == "30d":
            start_date = now - timedelta(days=30)
        elif period == "90d":
            start_date = now - timedelta(days=90)
        else:
            start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
        
        start_date_str = start_date.isoformat()
        
        # Get service listings for this org
        services = await db.service_listings.find({
            "organization_id": organization_id
        }, {"_id": 0}).to_list(100)
        service_ids = [s.get("id") for s in services]
        
        # Analytics data aggregation
        analytics = {
            "period": period,
            "organization_id": organization_id,
            "organization_name": org.get("name") if org else "Unknown",
            "summary": {
                "total_services": len(services),
                "total_bookings": 0,
                "total_reviews": 0,
                "average_rating": 0,
                "total_messages": 0,
                "unique_customers": 0
            },
            "bookings": {
                "total": 0,
                "completed": 0,
                "cancelled": 0,
                "pending": 0,
                "by_service": []
            },
            "reviews": {
                "total": 0,
                "average_rating": 0,
                "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "recent": []
            },
            "services": {
                "most_popular": [],
                "by_status": {"active": 0, "inactive": 0}
            },
            "customers": {
                "unique": 0,
                "repeat": 0,
                "repeat_rate": 0
            },
            "trends": {
                "bookings_by_day": [],
                "revenue_estimate": 0
            }
        }
        
        if service_ids:
            # Get bookings for these services
            bookings = await db.service_bookings.find({
                "service_id": {"$in": service_ids},
                "created_at": {"$gte": start_date_str}
            }, {"_id": 0}).to_list(1000)
            
            analytics["bookings"]["total"] = len(bookings)
            analytics["summary"]["total_bookings"] = len(bookings)
            
            # Count by status
            for b in bookings:
                status = b.get("status", "pending").lower()
                if status in ["completed", "confirmed"]:
                    analytics["bookings"]["completed"] += 1
                elif status == "cancelled":
                    analytics["bookings"]["cancelled"] += 1
                else:
                    analytics["bookings"]["pending"] += 1
            
            # Unique customers
            customer_ids = set(b.get("client_id") for b in bookings if b.get("client_id"))
            analytics["customers"]["unique"] = len(customer_ids)
            analytics["summary"]["unique_customers"] = len(customer_ids)
            
            # Repeat customers (more than 1 booking)
            customer_booking_counts = {}
            for b in bookings:
                cid = b.get("client_id")
                if cid:
                    customer_booking_counts[cid] = customer_booking_counts.get(cid, 0) + 1
            repeat_customers = sum(1 for count in customer_booking_counts.values() if count > 1)
            analytics["customers"]["repeat"] = repeat_customers
            if customer_ids:
                analytics["customers"]["repeat_rate"] = round(repeat_customers / len(customer_ids) * 100, 1)
            
            # Bookings by service
            service_booking_counts = {}
            for b in bookings:
                sid = b.get("service_id")
                service_booking_counts[sid] = service_booking_counts.get(sid, 0) + 1
            
            for s in services:
                sid = s.get("id")
                analytics["bookings"]["by_service"].append({
                    "service_id": sid,
                    "service_name": s.get("name"),
                    "booking_count": service_booking_counts.get(sid, 0)
                })
            
            # Sort by popularity
            analytics["bookings"]["by_service"].sort(key=lambda x: x["booking_count"], reverse=True)
            analytics["services"]["most_popular"] = analytics["bookings"]["by_service"][:5]
            
            # Get reviews
            reviews = await db.service_reviews.find({
                "service_id": {"$in": service_ids},
                "created_at": {"$gte": start_date_str}
            }, {"_id": 0}).sort("created_at", -1).to_list(100)
            
            analytics["reviews"]["total"] = len(reviews)
            analytics["summary"]["total_reviews"] = len(reviews)
            
            if reviews:
                total_rating = 0
                for r in reviews:
                    rating = r.get("rating", 0)
                    total_rating += rating
                    if 1 <= rating <= 5:
                        analytics["reviews"]["rating_distribution"][rating] += 1
                
                analytics["reviews"]["average_rating"] = round(total_rating / len(reviews), 1)
                analytics["summary"]["average_rating"] = analytics["reviews"]["average_rating"]
                
                # Recent reviews (last 5)
                for r in reviews[:5]:
                    analytics["reviews"]["recent"].append({
                        "rating": r.get("rating"),
                        "comment": r.get("comment", "")[:100],
                        "created_at": r.get("created_at")
                    })
            
            # Service status counts
            for s in services:
                if s.get("status") == "ACTIVE":
                    analytics["services"]["by_status"]["active"] += 1
                else:
                    analytics["services"]["by_status"]["inactive"] += 1
            
            # Bookings by day (for chart)
            from collections import defaultdict
            daily_bookings = defaultdict(int)
            for b in bookings:
                date_str = b.get("created_at", "")[:10]  # Get YYYY-MM-DD
                if date_str:
                    daily_bookings[date_str] += 1
            
            analytics["trends"]["bookings_by_day"] = [
                {"date": date, "count": count}
                for date, count in sorted(daily_bookings.items())
            ][-30:]  # Last 30 days
        
        return analytics
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== END ERIC AI AGENT ENDPOINTS =====

# Include the router in the main app
app.include_router(api_router)

# Serve uploaded files
# Mount uploads directory for serving static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ============================================================
# MIDDLEWARE CONFIGURATION
# ============================================================

# CORS middleware with production-optimized settings
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins if cors_origins != ['*'] else ["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# GZip compression middleware for responses > 500 bytes
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=500)

# ============================================================
# LOGGING CONFIGURATION
# ============================================================

logging.basicConfig(
    level=logging.WARNING if IS_PRODUCTION else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Reduce noisy loggers in production
if IS_PRODUCTION:
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

# Note: shutdown is now handled via lifespan manager