"""
ZION.CITY Enumeration Definitions
Centralized enums for type safety and consistency across the application

Note: These enums are duplicated in server.py for backward compatibility.
Future refactoring should migrate all imports to use this module.
"""
from enum import Enum


# === USER & AUTHENTICATION ENUMS ===

class UserRole(str, Enum):
    """User role within the platform"""
    ADMIN = "ADMIN"
    FAMILY_ADMIN = "FAMILY_ADMIN"
    ADULT = "ADULT"
    CHILD = "CHILD"
    BUSINESS = "BUSINESS"
    GOVERNMENT = "GOVERNMENT"


class VerificationLevel(str, Enum):
    """Level of user/organization verification"""
    SELF_DECLARED = "SELF_DECLARED"
    ORGANIZATION_VERIFIED = "ORGANIZATION_VERIFIED"
    GOVERNMENT_VERIFIED = "GOVERNMENT_VERIFIED"


class Gender(str, Enum):
    """User gender options"""
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


# === AFFILIATION & ORGANIZATION ENUMS ===

class AffiliationType(str, Enum):
    """Types of organizational affiliations"""
    WORK = "WORK"
    SCHOOL = "SCHOOL"
    UNIVERSITY = "UNIVERSITY"
    MEDICAL = "MEDICAL"
    GOVERNMENT = "GOVERNMENT"
    BUSINESS = "BUSINESS"
    CLUB = "CLUB"
    OTHER = "OTHER"


class OrganizationType(str, Enum):
    """Types of organizations"""
    CORPORATE = "CORPORATE"
    STARTUP = "STARTUP"
    NON_PROFIT = "NON_PROFIT"
    EDUCATIONAL = "EDUCATIONAL"
    GOVERNMENT = "GOVERNMENT"
    HEALTHCARE = "HEALTHCARE"
    RELIGIOUS = "RELIGIOUS"
    COMMUNITY = "COMMUNITY"
    OTHER = "OTHER"


class OrganizationSize(str, Enum):
    """Organization size categories"""
    SOLO = "SOLO"
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"
    ENTERPRISE = "ENTERPRISE"


class WorkRole(str, Enum):
    """Roles within a work organization"""
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"
    CONTRACTOR = "CONTRACTOR"
    INTERN = "INTERN"


# === POST & CONTENT ENUMS ===

class PostVisibility(str, Enum):
    """Visibility settings for posts"""
    PUBLIC = "PUBLIC"
    FAMILY_ONLY = "FAMILY_ONLY"
    HOUSEHOLD_ONLY = "HOUSEHOLD_ONLY"
    FATHERS_ONLY = "FATHERS_ONLY"
    MOTHERS_ONLY = "MOTHERS_ONLY"
    CHILDREN_ONLY = "CHILDREN_ONLY"
    PARENTS_ONLY = "PARENTS_ONLY"
    EXTENDED_FAMILY_ONLY = "EXTENDED_FAMILY_ONLY"
    ONLY_ME = "ONLY_ME"


class ProfileFieldVisibility(str, Enum):
    """Visibility settings for profile fields"""
    PUBLIC = "PUBLIC"
    CONNECTIONS = "CONNECTIONS"
    FAMILY = "FAMILY"
    ORGANIZATION = "ORGANIZATION"
    PRIVATE = "PRIVATE"


# === FAMILY ENUMS ===

class FamilyRole(str, Enum):
    """Roles within a family unit"""
    HEAD = "HEAD"
    ADMIN = "ADMIN"
    ADULT = "ADULT"
    CHILD = "CHILD"


class FamilyContentType(str, Enum):
    """Types of family content"""
    POST = "POST"
    EVENT = "EVENT"
    ALBUM = "ALBUM"
    DOCUMENT = "DOCUMENT"


class FamilyPostPrivacy(str, Enum):
    """Privacy settings for family posts"""
    FAMILY_ONLY = "FAMILY_ONLY"
    EXTENDED_FAMILY = "EXTENDED_FAMILY"
    PUBLIC = "PUBLIC"


class MarriageStatus(str, Enum):
    """Marriage status options"""
    SINGLE = "SINGLE"
    MARRIED = "MARRIED"
    DIVORCED = "DIVORCED"
    WIDOWED = "WIDOWED"
    SEPARATED = "SEPARATED"


class FamilyUnitRole(str, Enum):
    """Roles within a family unit"""
    FATHER = "FATHER"
    MOTHER = "MOTHER"
    CHILD = "CHILD"
    GUARDIAN = "GUARDIAN"


# === EDUCATION ENUMS ===

class SchoolLevel(str, Enum):
    """Educational institution levels"""
    PRESCHOOL = "PRESCHOOL"
    PRIMARY = "PRIMARY"
    SECONDARY = "SECONDARY"
    HIGH_SCHOOL = "HIGH_SCHOOL"
    VOCATIONAL = "VOCATIONAL"
    UNIVERSITY = "UNIVERSITY"
    GRADUATE = "GRADUATE"


class AcademicStatus(str, Enum):
    """Student academic status"""
    ACTIVE = "ACTIVE"
    GRADUATED = "GRADUATED"
    TRANSFERRED = "TRANSFERRED"
    EXPELLED = "EXPELLED"
    ON_LEAVE = "ON_LEAVE"


class EnrollmentRequestStatus(str, Enum):
    """Status of enrollment requests"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class DayOfWeek(str, Enum):
    """Days of the week"""
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class GradeType(str, Enum):
    """Types of academic grades"""
    HOMEWORK = "HOMEWORK"
    TEST = "TEST"
    EXAM = "EXAM"
    PROJECT = "PROJECT"
    PARTICIPATION = "PARTICIPATION"


# === NOTIFICATION & MESSAGING ENUMS ===

class NotificationType(str, Enum):
    """Types of notifications"""
    SYSTEM = "SYSTEM"
    MESSAGE = "MESSAGE"
    MENTION = "MENTION"
    LIKE = "LIKE"
    COMMENT = "COMMENT"
    FOLLOW = "FOLLOW"
    REMINDER = "REMINDER"
    EVENT = "EVENT"
    TASK = "TASK"


class FriendRequestStatus(str, Enum):
    """Status of friend/connection requests"""
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    BLOCKED = "BLOCKED"


# === TASK & PROJECT ENUMS ===

class TaskStatus(str, Enum):
    """Status of tasks"""
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class TaskPriority(str, Enum):
    """Priority levels for tasks"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


# === EVENT ENUMS ===

class EventVisibility(str, Enum):
    """Visibility settings for events"""
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"
    ORGANIZATION = "ORGANIZATION"
    INVITE_ONLY = "INVITE_ONLY"


class EventStatus(str, Enum):
    """Status of events"""
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class RSVPStatus(str, Enum):
    """RSVP response options"""
    PENDING = "PENDING"
    GOING = "GOING"
    NOT_GOING = "NOT_GOING"
    MAYBE = "MAYBE"


# === SERVICE & MARKETPLACE ENUMS ===

class ServiceStatus(str, Enum):
    """Status of service listings"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    ARCHIVED = "ARCHIVED"


class BookingStatus(str, Enum):
    """Status of service bookings"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"


class ProductCondition(str, Enum):
    """Condition of marketplace products"""
    NEW = "NEW"
    LIKE_NEW = "LIKE_NEW"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"


class ProductStatus(str, Enum):
    """Status of marketplace products"""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SOLD = "SOLD"
    RESERVED = "RESERVED"
    ARCHIVED = "ARCHIVED"


# === FINANCE ENUMS ===

class TransactionType(str, Enum):
    """Types of financial transactions"""
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    TRANSFER = "TRANSFER"
    PAYMENT = "PAYMENT"
    REFUND = "REFUND"


class TransactionStatus(str, Enum):
    """Status of financial transactions"""
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
