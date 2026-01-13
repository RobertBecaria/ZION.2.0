"""
ZION.CITY Utility Functions
Common helper functions used throughout the application
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import re


def get_utc_now() -> datetime:
    """Get current UTC datetime - standardized timestamp function"""
    return datetime.now(timezone.utc)


def clean_mongo_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Remove MongoDB _id field from a document for API responses.
    Returns None if doc is None.
    """
    if doc:
        doc.pop("_id", None)
    return doc


def clean_mongo_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove MongoDB _id field from multiple documents.
    """
    return [clean_mongo_doc(doc) for doc in docs if doc]


def safe_regex(pattern: str) -> str:
    """
    Escape special regex characters to prevent NoSQL injection.
    Use this when building MongoDB regex queries from user input.

    Example:
        query = {"name": {"$regex": f".*{safe_regex(user_input)}.*", "$options": "i"}}
    """
    if not pattern:
        return ""
    return re.escape(pattern)


def paginate_results(
    items: List[Any],
    page: int = 1,
    page_size: int = 20,
    max_page_size: int = 100
) -> Dict[str, Any]:
    """
    Paginate a list of items with standardized response format.

    Args:
        items: List of items to paginate
        page: Page number (1-indexed)
        page_size: Number of items per page
        max_page_size: Maximum allowed page size

    Returns:
        Dict with 'items', 'total', 'page', 'page_size', 'total_pages'
    """
    # Validate and cap page_size
    page_size = min(max(1, page_size), max_page_size)
    page = max(1, page)

    total = len(items)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    # Calculate slice indices
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size

    return {
        "items": items[start_idx:end_idx],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


def format_user_name(first_name: Optional[str], last_name: Optional[str]) -> str:
    """Format user's full name, handling None values."""
    parts = [p for p in [first_name, last_name] if p]
    return " ".join(parts) if parts else "Unknown User"


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to max_length, adding suffix if truncated."""
    if not text or len(text) <= max_length:
        return text or ""
    return text[:max_length - len(suffix)] + suffix
