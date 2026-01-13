"""
Utility helper functions for ZION.CITY backend.

This module contains commonly used helper functions that are used throughout
the application. Centralizing these reduces code duplication and makes
maintenance easier.
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def get_utc_now() -> datetime:
    """Get current UTC datetime.

    Use this instead of datetime.now(timezone.utc) throughout the codebase
    for consistency.

    Returns:
        datetime: Current UTC datetime
    """
    return datetime.now(timezone.utc)


def clean_mongo_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Remove MongoDB _id field from a document.

    Args:
        doc: MongoDB document dict

    Returns:
        Document with _id removed, or None if input was None
    """
    if doc:
        doc.pop("_id", None)
    return doc


def clean_mongo_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove MongoDB _id field from multiple documents.

    Args:
        docs: List of MongoDB document dicts

    Returns:
        List of documents with _id removed
    """
    return [clean_mongo_doc(doc) for doc in docs if doc]


def safe_regex(pattern: str) -> str:
    """Escape special regex characters for safe MongoDB queries.

    Use this for any user-provided search terms to prevent NoSQL injection
    via regex patterns.

    Args:
        pattern: User-provided search string

    Returns:
        Escaped string safe for use in MongoDB $regex queries
    """
    return re.escape(pattern)


def truncate_string(s: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate a string to a maximum length.

    Args:
        s: String to truncate
        max_length: Maximum length including suffix
        suffix: String to append if truncated

    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[:max_length - len(suffix)] + suffix


def generate_slug(text: str) -> str:
    """Generate a URL-friendly slug from text.

    Args:
        text: Text to convert to slug

    Returns:
        URL-friendly slug
    """
    # Convert to lowercase
    slug = text.lower()
    # Replace spaces with hyphens
    slug = re.sub(r'\s+', '-', slug)
    # Remove special characters
    slug = re.sub(r'[^a-z0-9\-]', '', slug)
    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug


def parse_bool(value: Any) -> bool:
    """Parse various representations of boolean values.

    Args:
        value: Value to parse (str, int, bool, etc.)

    Returns:
        Boolean interpretation of value
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    return bool(value)


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format.

    Args:
        size_bytes: File size in bytes

    Returns:
        Human-readable string (e.g., "2.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def mask_email(email: str) -> str:
    """Mask email address for privacy (e.g., j***@example.com).

    Args:
        email: Email address to mask

    Returns:
        Masked email address
    """
    if not email or '@' not in email:
        return email

    local, domain = email.rsplit('@', 1)
    if len(local) <= 2:
        masked_local = local[0] + '*' * (len(local) - 1)
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]

    return f"{masked_local}@{domain}"


def mask_phone(phone: str) -> str:
    """Mask phone number for privacy (e.g., +1***456).

    Args:
        phone: Phone number to mask

    Returns:
        Masked phone number
    """
    if not phone or len(phone) < 4:
        return phone

    # Keep first 2 and last 3 characters
    return phone[:2] + '*' * (len(phone) - 5) + phone[-3:]


def is_valid_email(email: str) -> bool:
    """Basic email validation.

    Args:
        email: Email address to validate

    Returns:
        True if email format is valid
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def extract_mentions(text: str) -> List[str]:
    """Extract @mentions from text.

    Args:
        text: Text containing @mentions

    Returns:
        List of mentioned usernames (without @)
    """
    mentions = re.findall(r'@(\w+)', text)
    return list(set(mentions))


def extract_hashtags(text: str) -> List[str]:
    """Extract #hashtags from text.

    Args:
        text: Text containing #hashtags

    Returns:
        List of hashtags (without #)
    """
    hashtags = re.findall(r'#(\w+)', text)
    return list(set(hashtags))
