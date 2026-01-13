"""
ZION.CITY Enums

This module contains all enum definitions used throughout the application.
Centralizing enums improves code organization and makes it easier to
understand the valid values for various fields.

Note: These enums are also defined in server.py for backwards compatibility.
Future refactoring should import from this module instead.
"""

from enum import Enum


# ============================================================
# USER ENUMS
# ============================================================

class UserRole(str, Enum):
    """User roles for access control."""
    ADMIN = "ADMIN"
    FAMILY_ADMIN = "FAMILY_ADMIN"
    ADULT = "ADULT"
    CHILD = "CHILD"
    BUSINESS = "BUSINESS"
    GOVERNMENT = "GOVERNMENT"


class Gender(str, Enum):
    """User gender options."""
    MALE = "MALE"
    FEMALE = "FEMALE"
    IT = "IT"  # AI Agents, Smart Devices, IoT


class VerificationLevel(str, Enum):
    """User verification levels."""
    SELF_DECLARED = "SELF_DECLARED"
    ORGANIZATION_VERIFIED = "ORGANIZATION_VERIFIED"
    GOVERNMENT_VERIFIED = "GOVERNMENT_VERIFIED"


class ProfileFieldVisibility(str, Enum):
    """Privacy settings for profile fields."""
    PUBLIC = "PUBLIC"  # Everyone can see
    ORGANIZATION_ONLY = "ORGANIZATION_ONLY"  # Only org members can see
    PRIVATE = "PRIVATE"  # Only me


# ============================================================
# AFFILIATION ENUMS
# ============================================================

class AffiliationType(str, Enum):
    """Types of user affiliations."""
    WORK = "WORK"
    SCHOOL = "SCHOOL"
    UNIVERSITY = "UNIVERSITY"
    MEDICAL = "MEDICAL"
    GOVERNMENT = "GOVERNMENT"
    BUSINESS = "BUSINESS"
    CLUB = "CLUB"
    OTHER = "OTHER"


# ============================================================
# POST/CONTENT ENUMS
# ============================================================

class PostVisibility(str, Enum):
    """Post visibility options."""
    PUBLIC = "PUBLIC"                      # Everyone can see
    FAMILY_ONLY = "FAMILY_ONLY"           # All family members
    HOUSEHOLD_ONLY = "HOUSEHOLD_ONLY"     # Same household members
    FATHERS_ONLY = "FATHERS_ONLY"         # Male parents only
    MOTHERS_ONLY = "MOTHERS_ONLY"         # Female parents only
    CHILDREN_ONLY = "CHILDREN_ONLY"       # Children only
    PARENTS_ONLY = "PARENTS_ONLY"         # All parents (fathers + mothers)
    EXTENDED_FAMILY_ONLY = "EXTENDED_FAMILY_ONLY"  # Extended family members
    ONLY_ME = "ONLY_ME"                   # Creator only


class WorkPostType(str, Enum):
    """Work post types."""
    REGULAR = "REGULAR"
    TASK_COMPLETION = "TASK_COMPLETION"
    TASK_DISCUSSION = "TASK_DISCUSSION"


# ============================================================
# FAMILY ENUMS
# ============================================================

class FamilyRole(str, Enum):
    """Family member roles."""
    CREATOR = "CREATOR"        # Original creator
    ADMIN = "ADMIN"           # Spouses and co-admins
    ADULT_MEMBER = "ADULT_MEMBER"    # Adult family members
    CHILD = "CHILD"           # Children in the family


class FamilyContentType(str, Enum):
    """Types of family content."""
    ANNOUNCEMENT = "ANNOUNCEMENT"      # Family announcements & news
    PHOTO_ALBUM = "PHOTO_ALBUM"      # Family photo albums
    EVENT = "EVENT"                   # Family events/reunions
    MILESTONE = "MILESTONE"           # Family milestones (births, marriages, etc.)
    BUSINESS_UPDATE = "BUSINESS_UPDATE"  # Family business updates


class FamilyPostPrivacy(str, Enum):
    """Family post privacy settings."""
    PUBLIC = "PUBLIC"         # Visible to all subscribed families
    FAMILY_ONLY = "FAMILY_ONLY"  # Visible only to family members
    ADMIN_ONLY = "ADMIN_ONLY"     # Visible only to family admins


# ============================================================
# WORK/ORGANIZATION ENUMS
# ============================================================

class WorkRole(str, Enum):
    """Organization member roles."""
    OWNER = "OWNER"  # Organization owner (creator)
    ADMIN = "ADMIN"  # Organization administrator
    CEO = "CEO"
    CTO = "CTO"
    CFO = "CFO"
    COO = "COO"
    FOUNDER = "FOUNDER"
    CO_FOUNDER = "CO_FOUNDER"
    PRESIDENT = "PRESIDENT"
    VP = "VP"  # Vice President
    DIRECTOR = "DIRECTOR"
    MANAGER = "MANAGER"
    TEAM_LEAD = "TEAM_LEAD"
    SENIOR = "SENIOR"
    EMPLOYEE = "EMPLOYEE"
    INTERN = "INTERN"
    CONTRACTOR = "CONTRACTOR"
    MEMBER = "MEMBER"  # Generic member role


class OrganizationType(str, Enum):
    """Organization types."""
    COMPANY = "COMPANY"
    STARTUP = "STARTUP"
    NGO = "NGO"
    NON_PROFIT = "NON_PROFIT"
    GOVERNMENT = "GOVERNMENT"
    EDUCATIONAL = "EDUCATIONAL"
    HEALTHCARE = "HEALTHCARE"
    OTHER = "OTHER"


class OrganizationSize(str, Enum):
    """Organization size ranges."""
    SIZE_1_10 = "1-10"
    SIZE_11_50 = "11-50"
    SIZE_51_200 = "51-200"
    SIZE_201_500 = "201-500"
    SIZE_500_PLUS = "500+"


# ============================================================
# EDUCATION ENUMS
# ============================================================

class SchoolLevel(str, Enum):
    """School levels (Russian system)."""
    PRIMARY = "PRIMARY"  # Начальная школа (1-4 классы)
    BASIC = "BASIC"  # Основная школа (5-9 классы)
    SECONDARY = "SECONDARY"  # Средняя школа (10-11 классы)
    VOCATIONAL = "VOCATIONAL"  # Техникум/Колледж


class AcademicStatus(str, Enum):
    """Student academic status."""
    ACTIVE = "ACTIVE"
    GRADUATED = "GRADUATED"
    TRANSFERRED = "TRANSFERRED"


# ============================================================
# SERVICE/MARKETPLACE ENUMS
# ============================================================

class ServiceStatus(str, Enum):
    """Service listing status."""
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ARCHIVED = "ARCHIVED"


class ProductStatus(str, Enum):
    """Marketplace product status."""
    ACTIVE = "ACTIVE"
    SOLD = "SOLD"
    RESERVED = "RESERVED"
    ARCHIVED = "ARCHIVED"


class ProductCondition(str, Enum):
    """Product condition."""
    NEW = "NEW"
    LIKE_NEW = "LIKE_NEW"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"


class SellerType(str, Enum):
    """Seller type."""
    INDIVIDUAL = "INDIVIDUAL"
    BUSINESS = "BUSINESS"


# ============================================================
# EVENT ENUMS
# ============================================================

class EventStatus(str, Enum):
    """Event status."""
    DRAFT = "DRAFT"
    UPCOMING = "UPCOMING"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class EventVisibility(str, Enum):
    """Event visibility."""
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"
    GROUP_ONLY = "GROUP_ONLY"


# ============================================================
# CHAT ENUMS
# ============================================================

class MessageType(str, Enum):
    """Chat message types."""
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    FILE = "FILE"
    VOICE = "VOICE"
    VIDEO = "VIDEO"
    SYSTEM = "SYSTEM"


class MessageStatus(str, Enum):
    """Chat message status."""
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


# ============================================================
# NOTIFICATION ENUMS
# ============================================================

class NotificationType(str, Enum):
    """Notification types."""
    POST_LIKE = "POST_LIKE"
    POST_COMMENT = "POST_COMMENT"
    MENTION = "MENTION"
    FOLLOW = "FOLLOW"
    MESSAGE = "MESSAGE"
    EVENT_REMINDER = "EVENT_REMINDER"
    SYSTEM = "SYSTEM"
