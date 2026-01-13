"""
ZION.CITY Security Utilities
Centralized security functions for input validation and protection
"""
import re
from typing import Tuple, Set
from urllib.parse import urlparse
import ipaddress
import logging

logger = logging.getLogger("zion")


# === INPUT VALIDATION ===

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


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password meets security requirements.

    Requirements:
    - At least 12 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    return True, ""


# === SSRF PROTECTION ===

# Private IP ranges that should not be accessed
PRIVATE_IP_RANGES = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),  # Link-local
    ipaddress.ip_network('::1/128'),  # IPv6 localhost
    ipaddress.ip_network('fc00::/7'),  # IPv6 private
    ipaddress.ip_network('fe80::/10'),  # IPv6 link-local
]

# Blocked hostnames
BLOCKED_HOSTNAMES: Set[str] = {
    'localhost',
    'localhost.localdomain',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',  # GCP metadata
    '169.254.169.254',  # AWS/Azure/GCP metadata
}

# Allowed URL schemes
ALLOWED_SCHEMES: Set[str] = {'http', 'https'}


def is_safe_url_for_fetch(url: str) -> Tuple[bool, str]:
    """
    Validate URL is safe to fetch (SSRF prevention).

    Blocks:
    - Private/internal IP addresses
    - Localhost and metadata endpoints
    - Non-HTTP(S) schemes
    - Invalid URLs

    Args:
        url: The URL to validate

    Returns:
        Tuple of (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)

        # Check scheme
        if parsed.scheme not in ALLOWED_SCHEMES:
            return False, f"URL scheme '{parsed.scheme}' is not allowed"

        # Check hostname
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: no hostname"

        hostname_lower = hostname.lower()

        # Check blocked hostnames
        if hostname_lower in BLOCKED_HOSTNAMES:
            return False, f"Access to '{hostname}' is not allowed"

        # Try to parse as IP address
        try:
            ip = ipaddress.ip_address(hostname)
            for network in PRIVATE_IP_RANGES:
                if ip in network:
                    return False, "Access to private IP addresses is not allowed"
        except ValueError:
            # Not an IP address, check for localhost patterns
            if 'localhost' in hostname_lower or hostname_lower.endswith('.local'):
                return False, "Access to localhost is not allowed"

        return True, ""

    except Exception as e:
        logger.warning(f"URL validation error: {e}")
        return False, f"Invalid URL: {str(e)}"


# === FILE UPLOAD VALIDATION ===

# Magic bytes for file type detection
FILE_SIGNATURES = {
    b'\x89PNG\r\n\x1a\n': ('image/png', '.png'),
    b'\xff\xd8\xff': ('image/jpeg', '.jpg'),
    b'GIF87a': ('image/gif', '.gif'),
    b'GIF89a': ('image/gif', '.gif'),
    b'%PDF': ('application/pdf', '.pdf'),
    b'PK\x03\x04': ('application/zip', '.zip'),  # Also covers docx, xlsx
    b'\x00\x00\x00\x1cftyp': ('video/mp4', '.mp4'),
    b'\x00\x00\x00\x18ftyp': ('video/mp4', '.mp4'),
    b'\x00\x00\x00\x20ftyp': ('video/mp4', '.mp4'),
    b'OggS': ('audio/ogg', '.ogg'),
    b'RIFF': ('audio/wav', '.wav'),  # or video/avi
    b'ID3': ('audio/mpeg', '.mp3'),
    b'\xff\xfb': ('audio/mpeg', '.mp3'),
    b'\x1aE\xdf\xa3': ('video/webm', '.webm'),
}

# Maximum file sizes by type (in bytes)
MAX_FILE_SIZES = {
    'image': 10 * 1024 * 1024,      # 10 MB
    'document': 50 * 1024 * 1024,   # 50 MB
    'video': 500 * 1024 * 1024,     # 500 MB
    'audio': 50 * 1024 * 1024,      # 50 MB
    'default': 10 * 1024 * 1024,    # 10 MB
}


def validate_file_upload(
    content: bytes,
    filename: str,
    claimed_content_type: str,
    max_size: int = None
) -> Tuple[bool, str, str]:
    """
    Validate uploaded file content and type.

    Args:
        content: File content bytes
        filename: Original filename
        claimed_content_type: Content-Type header value
        max_size: Maximum allowed size (uses defaults if None)

    Returns:
        Tuple of (is_valid, error_message, detected_type)
    """
    # Check file size
    file_size = len(content)
    file_category = 'default'
    if 'image' in claimed_content_type:
        file_category = 'image'
    elif 'video' in claimed_content_type:
        file_category = 'video'
    elif 'audio' in claimed_content_type:
        file_category = 'audio'
    elif 'pdf' in claimed_content_type or 'document' in claimed_content_type:
        file_category = 'document'

    size_limit = max_size or MAX_FILE_SIZES.get(file_category, MAX_FILE_SIZES['default'])
    if file_size > size_limit:
        return False, f"File size ({file_size} bytes) exceeds maximum ({size_limit} bytes)", ""

    # Detect actual file type from magic bytes
    detected_type = None
    for signature, (mime_type, ext) in FILE_SIGNATURES.items():
        if content.startswith(signature):
            detected_type = mime_type
            break

    # If we couldn't detect, check extension
    if not detected_type:
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext in ['txt', 'csv', 'json', 'xml', 'html', 'css', 'js']:
            detected_type = f'text/{ext}'
        else:
            # Unknown type - could be dangerous
            return False, "Could not verify file type", ""

    # Verify claimed type matches (loosely)
    claimed_base = claimed_content_type.split('/')[0] if '/' in claimed_content_type else ''
    detected_base = detected_type.split('/')[0] if detected_type and '/' in detected_type else ''

    if claimed_base and detected_base and claimed_base != detected_base:
        logger.warning(f"File type mismatch: claimed {claimed_content_type}, detected {detected_type}")
        return False, "File type does not match content", detected_type

    return True, "", detected_type or claimed_content_type


# === SANITIZATION ===

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other attacks.
    """
    # Remove path separators
    filename = filename.replace('/', '_').replace('\\', '_')
    # Remove null bytes
    filename = filename.replace('\x00', '')
    # Remove leading/trailing dots and spaces
    filename = filename.strip('. ')
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:250] + ('.' + ext if ext else '')
    return filename or 'unnamed'
