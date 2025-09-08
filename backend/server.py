from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
    family_role: str = "MEMBER"  # ADMIN, MEMBER, CHILD
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

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

# === UTILITY FUNCTIONS ===

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

# Family Management Endpoints
@api_router.post("/families", response_model=Family)
async def create_family(
    family_name: str,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Create a new family"""
    new_family = Family(
        name=family_name,
        admin_id=current_user.id,
        description=description
    )
    
    await db.families.insert_one(new_family.dict())
    
    # Add creator as family admin
    family_member = FamilyMember(
        family_id=new_family.id,
        user_id=current_user.id,
        family_role="ADMIN"
    )
    await db.family_members.insert_one(family_member.dict())
    
    return new_family

@api_router.get("/families")
async def get_user_families(current_user: User = Depends(get_current_user)):
    """Get families where user is a member"""
    family_memberships = await db.family_members.find({"user_id": current_user.id, "is_active": True}).to_list(100)
    
    families = []
    for membership in family_memberships:
        family = await db.families.find_one({"id": membership["family_id"]})
        if family:
            families.append({
                "family": family,
                "role": membership["family_role"],
                "joined_at": membership["joined_at"]
            })
    
    return {"families": families}

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