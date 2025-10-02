"""
New Family Profile System Models
NODE and SUPER NODE Architecture
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid

# === ENUMS ===

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

# === ADDRESS MODEL ===

class Address(BaseModel):
    """Structured address for matching"""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    
    def get_matching_key(self) -> str:
        """Generate matching key for intelligent search"""
        return f"{self.street}|{self.city}|{self.country}".lower()

# === USER PROFILE EXTENSION ===

class UserProfileExtension(BaseModel):
    """Extended user profile fields for family system"""
    address: Optional[Address] = None
    marriage_status: Optional[MarriageStatus] = None
    spouse_user_id: Optional[str] = None  # If spouse is registered user
    spouse_name: Optional[str] = None  # If spouse not registered
    spouse_phone: Optional[str] = None  # For matching purposes
    profile_completed: bool = False  # Has user completed family questionnaire

# === FAMILY UNIT (NODE) ===

class FamilyUnit(BaseModel):
    """Nuclear family unit - NODE"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_name: str  # e.g., "Smith Family"
    family_surname: str  # "Smith"
    
    # Address
    address: Address
    
    # Node Information
    node_type: NodeType = NodeType.NODE
    parent_household_id: Optional[str] = None  # If part of a household (SUPER NODE)
    
    # Creator & Metadata
    creator_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Statistics
    member_count: int = 1
    is_active: bool = True

# === FAMILY UNIT MEMBER ===

class FamilyUnitMember(BaseModel):
    """Junction table linking users to family units"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    family_unit_id: str
    user_id: str
    
    role: FamilyUnitRole
    
    # Metadata
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

# === HOUSEHOLD (SUPER NODE) ===

class HouseholdProfile(BaseModel):
    """Household containing multiple family units - SUPER NODE"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    household_name: str  # e.g., "Smith Household"
    
    # Shared Address
    address: Address
    
    # Node Information
    node_type: NodeType = NodeType.SUPER_NODE
    member_family_unit_ids: List[str] = []  # List of FamilyUnit IDs
    
    # Creator & Metadata
    creator_id: str  # User who initiated household
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    is_active: bool = True

# === FAMILY JOIN REQUEST & VOTING ===

class Vote(BaseModel):
    """Individual vote on join request"""
    user_id: str  # Family unit head user ID
    family_unit_id: str  # Which family they represent
    vote: VoteChoice
    voted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FamilyJoinRequest(BaseModel):
    """Request to join a family/household with voting system"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Request Details
    requesting_user_id: str  # User making the request
    requesting_family_unit_id: Optional[str] = None  # If user has existing family
    target_family_unit_id: Optional[str] = None  # Specific family to join
    target_household_id: Optional[str] = None  # Household to join
    
    request_type: str = "JOIN_HOUSEHOLD"  # "JOIN_HOUSEHOLD", "JOIN_FAMILY"
    message: Optional[str] = None
    
    # Voting System
    votes: List[Vote] = []
    total_voters: int  # Total number of family unit heads who can vote
    votes_required: int  # Majority threshold
    
    # Status
    status: JoinRequestStatus = JoinRequestStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    resolved_at: Optional[datetime] = None
    
    is_active: bool = True
    
    def check_majority_reached(self) -> bool:
        """Check if majority approval reached"""
        approve_count = sum(1 for v in self.votes if v.vote == VoteChoice.APPROVE)
        return approve_count >= self.votes_required

# === FAMILY POST ===

class FamilyPost(BaseModel):
    """Posts created on behalf of family unit"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Family Context
    family_unit_id: str
    posted_by_user_id: str  # Individual who created the post
    
    # Content
    content: str
    media_files: List[str] = []  # MediaFile IDs
    
    # Visibility
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_published: bool = True

# === REQUEST/RESPONSE MODELS ===

class ProfileCompletionRequest(BaseModel):
    """Request to complete user profile for family system"""
    address: Address
    marriage_status: MarriageStatus
    spouse_name: Optional[str] = None
    spouse_phone: Optional[str] = None

class MatchingFamilyResult(BaseModel):
    """Result from intelligent family matching"""
    family_unit_id: str
    family_name: str
    family_surname: str
    address: Address
    member_count: int
    match_score: int  # 1-3 based on matching criteria

class FamilyUnitCreateRequest(BaseModel):
    """Request to create new family unit"""
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

class FamilyPostCreateRequest(BaseModel):
    """Create post on behalf of family"""
    content: str
    visibility: PostVisibility = PostVisibility.FAMILY_ONLY
    media_files: List[str] = []

class FamilyUnitResponse(BaseModel):
    """Response model for family unit"""
    id: str
    family_name: str
    family_surname: str
    address: Address
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
    address: Address
    member_family_units: List[FamilyUnitResponse]
    created_at: datetime