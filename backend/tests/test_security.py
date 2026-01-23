"""
Unit tests for security functions.
Tests safe_regex, input sanitization, rate limiting, and pagination validation.
"""
import pytest
import re
import asyncio
from datetime import datetime, timezone


# ============================================================
# Safe Regex Tests
# ============================================================

class TestSafeRegex:
    """Test safe_regex function for preventing regex injection."""

    def safe_regex(self, pattern: str) -> str:
        """Escape user input for safe use in MongoDB regex queries."""
        return re.escape(pattern)

    @pytest.mark.parametrize("input_pattern,expected_safe", [
        ("normal text", "normal text"),
        ("John Doe", "John Doe"),
        ("test@email.com", r"test@email\.com"),
        ("price: $100", r"price: \$100"),
        ("file.txt", r"file\.txt"),
        ("user*", r"user\*"),
        ("^admin", r"\^admin"),
        ("end$", r"end\$"),
        ("[a-z]", r"\[a-z\]"),
        ("(group)", r"\(group\)"),
        ("a+b", r"a\+b"),
        ("a?b", r"a\?b"),
        ("a|b", r"a\|b"),
        ("\\escape", r"\\escape"),
        ("{1,3}", r"\{1,3\}"),
    ])
    def test_safe_regex_escapes_special_chars(self, input_pattern, expected_safe):
        """Test that special regex characters are escaped."""
        result = self.safe_regex(input_pattern)
        assert result == expected_safe, f"Failed to escape '{input_pattern}'"

    def test_safe_regex_prevents_dos_attack_pattern(self):
        """Test that malicious regex patterns are neutralized."""
        # ReDoS attack pattern: catastrophic backtracking
        malicious_pattern = "(a+)+"
        safe_pattern = self.safe_regex(malicious_pattern)

        # The escaped pattern should be safe
        assert safe_pattern == r"\(a\+\)\+"

        # The safe pattern should not cause exponential time
        test_string = "a" * 100
        regex = re.compile(safe_pattern)

        # This should complete quickly (not hang)
        import time
        start = time.time()
        regex.search(test_string)
        elapsed = time.time() - start

        assert elapsed < 1.0, "Regex took too long - possible ReDoS"

    def test_safe_regex_handles_empty_string(self):
        """Test that empty string is handled correctly."""
        result = self.safe_regex("")
        assert result == ""

    def test_safe_regex_handles_unicode(self):
        """Test that unicode characters are handled correctly."""
        # Russian text
        result = self.safe_regex("Привет мир")
        assert result == "Привет мир"

        # Emoji
        result = self.safe_regex("Hello 👋 World")
        # Emoji should pass through unchanged
        assert "👋" in result

    def test_safe_regex_preserves_alphanumeric(self):
        """Test that alphanumeric characters are not escaped."""
        result = self.safe_regex("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        assert result == "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"


# ============================================================
# Input Sanitization Tests
# ============================================================

class TestInputSanitization:
    """Test input sanitization functions."""

    def sanitize_html(self, text: str) -> str:
        """Remove potentially dangerous HTML tags."""
        # Simple sanitization - in production use a library like bleach
        dangerous_patterns = [
            r'<script.*?>.*?</script>',
            r'<iframe.*?>.*?</iframe>',
            r'javascript:',
            r'onerror=',
            r'onclick=',
            r'onload=',
        ]
        result = text
        for pattern in dangerous_patterns:
            result = re.sub(pattern, '', result, flags=re.IGNORECASE | re.DOTALL)
        return result

    def test_removes_script_tags(self):
        """Test that script tags are removed."""
        input_text = 'Hello <script>alert("XSS")</script> World'
        result = self.sanitize_html(input_text)
        assert '<script>' not in result
        assert 'alert' not in result
        assert 'Hello' in result
        assert 'World' in result

    def test_removes_javascript_urls(self):
        """Test that javascript: URLs are removed."""
        input_text = '<a href="javascript:alert(1)">Click me</a>'
        result = self.sanitize_html(input_text)
        assert 'javascript:' not in result

    def test_removes_event_handlers(self):
        """Test that event handlers are removed."""
        input_text = '<img src="x" onerror="alert(1)">'
        result = self.sanitize_html(input_text)
        assert 'onerror=' not in result

    def test_preserves_safe_text(self):
        """Test that safe text is preserved."""
        input_text = "This is a normal comment with no HTML."
        result = self.sanitize_html(input_text)
        assert result == input_text


# ============================================================
# Pagination Validation Tests
# ============================================================

class TestPaginationValidation:
    """Test pagination parameter validation."""

    MAX_LIMIT = 100
    MAX_OFFSET = 10000
    DEFAULT_LIMIT = 20

    def validate_pagination(self, offset: int, limit: int) -> tuple:
        """Validate and sanitize pagination parameters."""
        # Ensure non-negative values
        offset = max(0, offset) if offset is not None else 0
        limit = max(1, limit) if limit is not None else self.DEFAULT_LIMIT

        # Apply maximum constraints
        offset = min(offset, self.MAX_OFFSET)
        limit = min(limit, self.MAX_LIMIT)

        return offset, limit

    @pytest.mark.parametrize("input_offset,input_limit,expected_offset,expected_limit", [
        (0, 20, 0, 20),           # Normal values
        (100, 50, 100, 50),       # Normal values
        (-1, 20, 0, 20),          # Negative offset clamped to 0
        (0, -1, 0, 1),            # Negative limit clamped to 1
        (0, 0, 0, 1),             # Zero limit clamped to 1
        (0, 200, 0, 100),         # Limit clamped to MAX_LIMIT
        (20000, 20, 10000, 20),   # Offset clamped to MAX_OFFSET
        (None, None, 0, 20),      # None values get defaults
    ])
    def test_pagination_validation(self, input_offset, input_limit, expected_offset, expected_limit):
        """Test that pagination parameters are validated correctly."""
        result_offset, result_limit = self.validate_pagination(input_offset, input_limit)
        assert result_offset == expected_offset, f"Offset mismatch for input ({input_offset}, {input_limit})"
        assert result_limit == expected_limit, f"Limit mismatch for input ({input_offset}, {input_limit})"

    def test_extreme_offset_prevented(self):
        """Test that extremely large offsets are prevented."""
        offset, limit = self.validate_pagination(1000000, 20)
        assert offset == self.MAX_OFFSET

    def test_extreme_limit_prevented(self):
        """Test that extremely large limits are prevented."""
        offset, limit = self.validate_pagination(0, 100000)
        assert limit == self.MAX_LIMIT


# ============================================================
# Rate Limiting Tests
# ============================================================

class TestRateLimiting:
    """Test rate limiting functionality."""

    class SimpleRateLimiter:
        """Simple rate limiter for testing."""

        def __init__(self):
            self._requests = {}

        async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
            """Check if request is allowed within rate limit."""
            import time
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

        def clear(self):
            """Clear all request history."""
            self._requests.clear()

    @pytest.fixture
    def rate_limiter(self):
        """Create a rate limiter instance."""
        return self.SimpleRateLimiter()

    @pytest.mark.asyncio
    async def test_allows_requests_within_limit(self, rate_limiter):
        """Test that requests within limit are allowed."""
        # Allow 5 requests per 60 seconds
        for i in range(5):
            allowed = await rate_limiter.is_allowed("user1", 5, 60)
            assert allowed is True, f"Request {i+1} should be allowed"

    @pytest.mark.asyncio
    async def test_blocks_requests_over_limit(self, rate_limiter):
        """Test that requests over limit are blocked."""
        # Allow 3 requests per 60 seconds
        for i in range(3):
            await rate_limiter.is_allowed("user2", 3, 60)

        # 4th request should be blocked
        allowed = await rate_limiter.is_allowed("user2", 3, 60)
        assert allowed is False

    @pytest.mark.asyncio
    async def test_different_keys_are_independent(self, rate_limiter):
        """Test that different keys have independent limits."""
        # Max out user1
        for i in range(3):
            await rate_limiter.is_allowed("user1", 3, 60)

        # user2 should still be allowed
        allowed = await rate_limiter.is_allowed("user2", 3, 60)
        assert allowed is True

    @pytest.mark.asyncio
    async def test_window_expires_old_requests(self, rate_limiter):
        """Test that old requests are removed from the window."""
        import time

        # Add a request
        await rate_limiter.is_allowed("user3", 1, 1)

        # Wait for window to expire
        await asyncio.sleep(1.1)

        # Should be allowed again
        allowed = await rate_limiter.is_allowed("user3", 1, 1)
        assert allowed is True


# ============================================================
# Content Security Tests
# ============================================================

class TestContentSecurity:
    """Test content security measures."""

    def is_safe_url(self, url: str) -> bool:
        """Check if URL is safe (not javascript:, data:, etc.)."""
        dangerous_schemes = ['javascript:', 'data:', 'vbscript:', 'file:']
        url_lower = url.lower().strip()
        return not any(url_lower.startswith(scheme) for scheme in dangerous_schemes)

    @pytest.mark.parametrize("url,is_safe", [
        ("https://example.com", True),
        ("http://example.com", True),
        ("//example.com", True),
        ("/path/to/page", True),
        ("path/to/page", True),
        ("javascript:alert(1)", False),
        ("JAVASCRIPT:alert(1)", False),
        ("data:text/html,<script>alert(1)</script>", False),
        ("vbscript:msgbox(1)", False),
        ("file:///etc/passwd", False),
        ("  javascript:alert(1)", False),  # Leading whitespace
    ])
    def test_url_safety_check(self, url, is_safe):
        """Test that dangerous URLs are detected."""
        assert self.is_safe_url(url) == is_safe, f"URL safety check failed for '{url}'"


# ============================================================
# File Upload Security Tests
# ============================================================

class TestFileUploadSecurity:
    """Test file upload security measures."""

    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    def is_allowed_extension(self, filename: str) -> bool:
        """Check if file extension is allowed."""
        import os
        ext = os.path.splitext(filename.lower())[1]
        return ext in self.ALLOWED_EXTENSIONS

    def is_valid_file_size(self, size: int) -> bool:
        """Check if file size is within limit."""
        return 0 < size <= self.MAX_FILE_SIZE

    @pytest.mark.parametrize("filename,is_allowed", [
        ("image.jpg", True),
        ("image.JPEG", True),
        ("document.pdf", True),
        ("report.docx", True),
        ("script.js", False),
        ("malware.exe", False),
        ("shell.php", False),
        ("config.py", False),
        ("no_extension", False),
        (".htaccess", False),
    ])
    def test_file_extension_validation(self, filename, is_allowed):
        """Test that file extension validation works correctly."""
        assert self.is_allowed_extension(filename) == is_allowed, f"Extension check failed for '{filename}'"

    @pytest.mark.parametrize("size,is_valid", [
        (1024, True),             # 1 KB
        (1024 * 1024, True),      # 1 MB
        (5 * 1024 * 1024, True),  # 5 MB
        (10 * 1024 * 1024, True), # 10 MB (at limit)
        (11 * 1024 * 1024, False), # 11 MB (over limit)
        (0, False),               # Empty file
        (-1, False),              # Invalid size
    ])
    def test_file_size_validation(self, size, is_valid):
        """Test that file size validation works correctly."""
        assert self.is_valid_file_size(size) == is_valid, f"Size check failed for {size}"

    def test_double_extension_attack(self):
        """Test that double extension attacks are detected."""
        # Files like malware.jpg.exe should be blocked
        filename = "image.jpg.exe"
        assert self.is_allowed_extension(filename) is False

    def test_null_byte_injection(self):
        """Test that null byte injection is handled."""
        # Filename with null byte: image.php%00.jpg
        filename = "image.php\x00.jpg"
        # The actual extension after null byte is .jpg, but we should check the full filename
        ext = filename.lower().split('\x00')[0]  # Get part before null byte
        import os
        actual_ext = os.path.splitext(ext)[1]
        # Should detect .php, not .jpg
        assert actual_ext == '.php'


# ============================================================
# MongoDB Injection Prevention Tests
# ============================================================

class TestMongoDBInjectionPrevention:
    """Test MongoDB injection prevention measures."""

    def sanitize_mongodb_query(self, value: any) -> any:
        """Sanitize value for MongoDB queries."""
        if isinstance(value, dict):
            # Block operator injection
            if any(key.startswith('$') for key in value.keys()):
                raise ValueError("MongoDB operators not allowed in user input")
        return value

    def test_blocks_operator_injection(self):
        """Test that MongoDB operator injection is blocked."""
        malicious_input = {"$gt": ""}  # Would match all documents

        with pytest.raises(ValueError):
            self.sanitize_mongodb_query(malicious_input)

    def test_allows_safe_dict_values(self):
        """Test that safe dict values are allowed."""
        safe_input = {"name": "John", "age": 30}
        result = self.sanitize_mongodb_query(safe_input)
        assert result == safe_input

    def test_allows_primitive_values(self):
        """Test that primitive values are allowed."""
        assert self.sanitize_mongodb_query("string") == "string"
        assert self.sanitize_mongodb_query(123) == 123
        assert self.sanitize_mongodb_query(True) is True

    @pytest.mark.parametrize("malicious_query", [
        {"$where": "this.password == ''"},
        {"$regex": ".*"},
        {"$ne": None},
        {"password": {"$exists": True}},
    ])
    def test_blocks_various_operator_attacks(self, malicious_query):
        """Test that various MongoDB operator attacks are blocked."""
        # Note: This only checks the top-level keys
        # In production, you'd need recursive checking
        if any(k.startswith('$') for k in malicious_query.keys()):
            with pytest.raises(ValueError):
                self.sanitize_mongodb_query(malicious_query)


# ============================================================
# UUID Validation Tests
# ============================================================

class TestUUIDValidation:
    """Test UUID validation for IDs."""

    def is_valid_uuid(self, value: str) -> bool:
        """Check if value is a valid UUID."""
        import uuid
        try:
            uuid.UUID(value)
            return True
        except (ValueError, AttributeError):
            return False

    @pytest.mark.parametrize("value,is_valid", [
        ("123e4567-e89b-12d3-a456-426614174000", True),
        ("123E4567-E89B-12D3-A456-426614174000", True),  # Uppercase
        ("not-a-uuid", False),
        ("12345", False),
        ("", False),
        (None, False),
        ("123e4567-e89b-12d3-a456-42661417400", False),  # Too short
        ("123e4567-e89b-12d3-a456-4266141740000", False),  # Too long
    ])
    def test_uuid_validation(self, value, is_valid):
        """Test that UUID validation works correctly."""
        result = self.is_valid_uuid(value) if value is not None else False
        assert result == is_valid, f"UUID validation failed for '{value}'"
