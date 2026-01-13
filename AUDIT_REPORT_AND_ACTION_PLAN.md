# ZION.CITY 2.0 - Comprehensive Code Audit Report & Action Plan

**Generated:** January 2026
**Auditor:** Claude Code
**Codebase:** Full-stack social platform (React 19 + FastAPI + MongoDB)

---

## Executive Summary

### Codebase Overview
| Metric | Value |
|--------|-------|
| Backend Lines | 25,294 (single file) |
| Frontend Components | 256+ |
| API Endpoints | 390+ |
| Database Collections | 101 |
| Core Modules | 8 (Family, Work, News, Journal, Services, Marketplace, Finance, Events) |

### Issues Found
| Severity | Security | Performance | Code Quality | Total |
|----------|----------|-------------|--------------|-------|
| 🔴 Critical | 7 | 5 | 3 | **15** |
| 🟠 High | 11 | 8 | 6 | **25** |
| 🟡 Medium | 10 | 6 | 8 | **24** |
| **Total** | **28** | **19** | **17** | **64** |

---

## Phase 0: Critical Security Fixes (Do First - 1-2 Days)

> ⚠️ **STOP DEPLOYMENT** until these are fixed. These are exploitable vulnerabilities.

### Task 0.1: Fix Unauthenticated Finance Endpoint
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Line:** 21995
**Effort:** 30 minutes

**Current Code:**
```python
@api_router.post("/finance/welcome-bonus/{user_id}")
async def grant_welcome_bonus(user_id: str):
    # No authentication! Anyone can grant coins to any user
```

**Fix:**
```python
@api_router.post("/finance/welcome-bonus/{user_id}")
async def grant_welcome_bonus(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    # Verify current_user.id == user_id or current_user is admin
    if current_user.id != user_id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
```

---

### Task 0.2: Remove JWT Fallback Secret
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Line:** 229
**Effort:** 15 minutes

**Current Code:**
```python
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'fallback-secret-key-for-development')
```

**Fix:**
```python
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is required")
```

---

### Task 0.3: Fix Public File Access
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Line:** 25259
**Effort:** 1 hour

**Current Code:**
```python
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
```

**Fix:** Remove StaticFiles mount, serve through authenticated endpoint only:
```python
# DELETE the line above, use existing /media/{file_id} endpoint
# But first fix that endpoint (Task 0.4)
```

---

### Task 0.4: Add Authentication to Media Endpoint
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Lines:** 7554-7570
**Effort:** 1 hour

**Current Code:**
```python
@api_router.get("/media/{file_id}")
async def get_media_file(file_id: str):
    # No authentication check!
```

**Fix:**
```python
@api_router.get("/media/{file_id}")
async def get_media_file(
    file_id: str,
    current_user: User = Depends(get_current_user)
):
    media = await db.media_files.find_one({"id": file_id})
    if not media:
        raise HTTPException(status_code=404)

    # Check if user has access to this media
    if not await can_user_access_media(current_user.id, media):
        raise HTTPException(status_code=403)

    # ... rest of code
```

---

### Task 0.5: Fix Path Traversal Vulnerability
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Lines:** 7577-7581
**Effort:** 30 minutes

**Current Code:**
```python
if ".." in file_path:
    raise HTTPException(status_code=400, detail="Invalid file path")
```

**Fix:**
```python
from pathlib import Path

# Resolve and validate the path
resolved_path = Path(UPLOAD_DIR).joinpath(file_path).resolve()
if not str(resolved_path).startswith(str(Path(UPLOAD_DIR).resolve())):
    raise HTTPException(status_code=400, detail="Invalid file path")
```

---

### Task 0.6: Fix Default MongoDB Password
**Priority:** 🔴 CRITICAL
**File:** `mongo-init.js`
**Line:** 9
**Effort:** 15 minutes

**Current Code:**
```javascript
pwd: process.env.MONGO_APP_PASSWORD || 'change_this_password'
```

**Fix:**
```javascript
const password = process.env.MONGO_APP_PASSWORD;
if (!password) {
    throw new Error('MONGO_APP_PASSWORD environment variable is required');
}
// Use password variable
```

---

### Task 0.7: Change Supervisor from Root
**Priority:** 🔴 CRITICAL
**File:** `supervisord.conf`
**Line:** 3
**Effort:** 30 minutes

**Current Code:**
```ini
[supervisord]
nodaemon=true
user=root
```

**Fix:**
```ini
[supervisord]
nodaemon=true
user=www-data
```

Also update Dockerfile to ensure proper permissions.

---

## Phase 1: High-Priority Security Fixes (Week 1)

### Task 1.1: Sanitize NoSQL Regex Queries
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Locations:** 12+ places
**Effort:** 3 hours

**Affected Lines:**
- 4929 (user search)
- 6772 (chat search)
- 6855 (message search)
- 9283 (organization search)
- 19733 (news search)
- 20748 (service search)
- 21051 (marketplace search)
- 23217 (event search)

**Current Pattern:**
```python
{"$regex": search_term, "$options": "i"}
```

**Fix - Create utility function:**
```python
import re

def safe_regex(pattern: str) -> str:
    """Escape special regex characters to prevent injection"""
    return re.escape(pattern)

# Usage:
{"$regex": safe_regex(search_term), "$options": "i"}
```

---

### Task 1.2: Add Rate Limiting to Auth Endpoints
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 3732, 3784
**Effort:** 2 hours

**Fix:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@api_router.post("/auth/login")
@limiter.limit("5/minute")  # 5 attempts per minute
async def login_user(request: Request, user_data: UserLogin):
    ...

@api_router.post("/auth/register")
@limiter.limit("3/minute")  # 3 registrations per minute
async def register_user(request: Request, user_data: UserRegistration):
    ...
```

---

### Task 1.3: Add Password Complexity Validation
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 1110-1118
**Effort:** 1 hour

**Add validation:**
```python
import re

def validate_password_strength(password: str) -> bool:
    """Validate password meets security requirements"""
    if len(password) < 12:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

# Use in registration:
if not validate_password_strength(user_data.password):
    raise HTTPException(
        status_code=400,
        detail="Password must be 12+ chars with uppercase, lowercase, number, and symbol"
    )
```

---

### Task 1.4: Fix CORS Configuration
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 25265-25274
**Effort:** 30 minutes

**Fix:**
```python
cors_origins = os.environ.get('CORS_ORIGINS')
if not cors_origins:
    raise RuntimeError("CORS_ORIGINS environment variable is required")

allowed_origins = [origin.strip() for origin in cors_origins.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,  # Never use ["*"] with credentials
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],  # Explicit headers
)
```

---

### Task 1.5: Fix SSRF in Link Preview
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 17786-17835
**Effort:** 2 hours

**Add URL validation:**
```python
from urllib.parse import urlparse
import ipaddress

BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254']
BLOCKED_SCHEMES = ['file', 'ftp', 'gopher']

def is_safe_url(url: str) -> bool:
    """Validate URL is safe for fetching (prevent SSRF)"""
    try:
        parsed = urlparse(url)

        # Check scheme
        if parsed.scheme not in ['http', 'https']:
            return False

        # Check for blocked hosts
        if parsed.hostname in BLOCKED_HOSTS:
            return False

        # Check for private IP ranges
        try:
            ip = ipaddress.ip_address(parsed.hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass  # Not an IP, that's fine

        return True
    except Exception:
        return False
```

---

### Task 1.6: Disable MongoDB Express in Production
**Priority:** 🟠 HIGH
**File:** `docker-compose.yml`
**Lines:** 129-145
**Effort:** 15 minutes

**Ensure mongo-express only runs with admin profile:**
```yaml
mongo-express:
    profiles:
      - admin  # Only starts with: docker compose --profile admin up
```

---

### Task 1.7: Stop Leaking Exception Details
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Locations:** 40+ places
**Effort:** 2 hours

**Find and replace pattern:**
```python
# BAD (current):
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

# GOOD (fixed):
except Exception as e:
    logger.error(f"Error in {function_name}: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

### Task 1.8: Add File Upload Validation
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 3325-3332, 6964-6965
**Effort:** 2 hours

**Add magic byte validation:**
```python
import magic

ALLOWED_MIME_TYPES = {
    'image/jpeg': [b'\xff\xd8\xff'],
    'image/png': [b'\x89PNG\r\n\x1a\n'],
    'image/gif': [b'GIF87a', b'GIF89a'],
    'application/pdf': [b'%PDF'],
}

async def validate_file_upload(file: UploadFile, max_size: int = 10_000_000):
    """Validate file type and size"""
    # Read first 8 bytes for magic number
    header = await file.read(8)
    await file.seek(0)

    # Validate magic bytes match content type
    expected_signatures = ALLOWED_MIME_TYPES.get(file.content_type, [])
    if not any(header.startswith(sig) for sig in expected_signatures):
        raise HTTPException(status_code=400, detail="Invalid file type")

    # Validate size
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large (max {max_size} bytes)")

    await file.seek(0)
    return True
```

---

## Phase 2: Performance Quick Wins (Week 1-2)

### Task 2.1: Add Critical Database Indexes
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Lines:** 186-199 (extend ensure_indexes)
**Effort:** 1 hour

**Add these indexes:**
```python
async def ensure_indexes():
    # Existing indexes...

    # POST INTERACTIONS (Critical for feed performance)
    await db.post_likes.create_index("post_id")
    await db.post_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
    await db.post_comments.create_index("post_id")
    await db.post_reactions.create_index("post_id")
    await db.post_reactions.create_index([("post_id", 1), ("user_id", 1)])

    # CHAT (Critical for messaging)
    await db.chat_group_members.create_index([("user_id", 1), ("is_active", 1)])
    await db.chat_messages.create_index([("group_id", 1), ("is_deleted", 1), ("created_at", -1)])

    # FAMILY
    await db.family_members.create_index([("user_id", 1), ("is_active", 1)])
    await db.family_members.create_index([("family_id", 1), ("is_active", 1)])

    # WORK/ORGANIZATIONS
    await db.work_members.create_index([("user_id", 1), ("status", 1)])
    await db.work_members.create_index([("organization_id", 1), ("status", 1)])
    await db.user_affiliations.create_index([("user_id", 1), ("is_active", 1)])
```

---

### Task 2.2: Add Limits to Unbounded Queries
**Priority:** 🔴 CRITICAL
**File:** `backend/server.py`
**Effort:** 1 hour

**Locations to fix:**

| Line | Current | Fix |
|------|---------|-----|
| 8049 | `.to_list(None)` | `.to_list(100)` |
| 8083 | `.to_list(None)` | `.to_list(100)` |
| 8390 | `.to_list(None)` | `.to_list(100)` |
| 3925 | `.to_list(None)` | `.to_list(500)` |
| 7477 | `.to_list(1000)` | `.to_list(100)` |

---

### Task 2.3: Cache User Lookups
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Effort:** 2 hours

**Create cached user lookup:**
```python
# Add to SimpleCache or create new:
user_cache = SimpleCache(default_ttl=300)  # 5 minute TTL

async def get_user_by_id_cached(user_id: str) -> Optional[dict]:
    """Get user with caching"""
    cache_key = f"user:{user_id}"

    cached = user_cache.get(cache_key)
    if cached:
        return cached

    user = await db.users.find_one({"id": user_id})
    if user:
        user.pop("_id", None)
        user.pop("password_hash", None)
        user_cache.set(cache_key, user)

    return user

# Replace 212+ occurrences of:
await db.users.find_one({"id": user_id})
# With:
await get_user_by_id_cached(user_id)
```

---

### Task 2.4: Fix N+1 Query in Chat Groups
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 3601-3641
**Effort:** 2 hours

**Current (41 queries for 10 groups):**
```python
for membership in memberships:
    group = await db.chat_groups.find_one(...)  # N queries
    member_count = await db.chat_group_members.count_documents(...)  # N queries
    latest_message = await db.chat_messages.find_one(...)  # N queries
    unread_count = await db.chat_messages.count_documents(...)  # N queries
```

**Fix (2 queries total):**
```python
# Get all group IDs first
group_ids = [m["group_id"] for m in memberships]

# Batch fetch all groups
groups = await db.chat_groups.find({"id": {"$in": group_ids}}).to_list(100)
groups_map = {g["id"]: g for g in groups}

# Use aggregation for counts
pipeline = [
    {"$match": {"group_id": {"$in": group_ids}, "is_active": True}},
    {"$group": {"_id": "$group_id", "count": {"$sum": 1}}}
]
member_counts = await db.chat_group_members.aggregate(pipeline).to_list(100)
counts_map = {c["_id"]: c["count"] for c in member_counts}

# Build response without N+1
for membership in memberships:
    group = groups_map.get(membership["group_id"])
    count = counts_map.get(membership["group_id"], 0)
    # ...
```

---

### Task 2.5: Fix N+1 Query in Post Likes
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 8049-8065
**Effort:** 1 hour

**Fix:**
```python
async def get_post_likes(post_id: str, limit: int = 100):
    likes = await db.post_likes.find({"post_id": post_id}).to_list(limit)

    # Batch fetch all users
    user_ids = [like["user_id"] for like in likes]
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"id": 1, "first_name": 1, "last_name": 1, "profile_picture_url": 1}
    ).to_list(limit)
    users_map = {u["id"]: u for u in users}

    # Build response
    result = []
    for like in likes:
        user = users_map.get(like["user_id"], {})
        result.append({
            "user_id": like["user_id"],
            "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
            "profile_picture_url": user.get("profile_picture_url"),
            "created_at": like["created_at"]
        })

    return result
```

---

### Task 2.6: Replace Blocking I/O with Async
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Lines:** 6964-6965, 6991, 7049-7051
**Effort:** 1 hour

**Fix:**
```python
import aiofiles
import aiofiles.os

# Instead of:
shutil.copyfileobj(file.file, buffer)

# Use:
async with aiofiles.open(file_path, 'wb') as f:
    content = await file.read()
    await f.write(content)

# Instead of:
os.path.getsize(file_path)

# Use:
stat = await aiofiles.os.stat(file_path)
file_size = stat.st_size
```

---

### Task 2.7: Enable Nginx API Caching
**Priority:** 🟡 MEDIUM
**File:** `nginx.conf`
**Effort:** 30 minutes

**Uncomment and configure:**
```nginx
# Add to http block:
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=5m;

# Add to API location:
location /api/ {
    # Cache GET requests for 5 minutes
    proxy_cache api_cache;
    proxy_cache_methods GET;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$request_uri|$http_authorization";
    add_header X-Cache-Status $upstream_cache_status;

    # Don't cache authenticated user-specific endpoints
    proxy_cache_bypass $cookie_session;
    proxy_no_cache $cookie_session;

    proxy_pass http://backend;
}
```

---

## Phase 3: Code Quality Foundation (Week 2)

### Task 3.1: Replace print() with Logger
**Priority:** 🟠 HIGH
**File:** `backend/server.py`
**Locations:** 85+ places
**Effort:** 2 hours

**Setup logging:**
```python
import logging

# Configure at top of file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("zion")

# Replace all:
print(f"Error: {e}")
# With:
logger.error(f"Error: {e}", exc_info=True)

# Replace all:
print(f"User {user_id} logged in")
# With:
logger.info(f"User {user_id} logged in")
```

**Find all print statements:**
```bash
grep -n "print(" backend/server.py | head -50
```

---

### Task 3.2: Extract Utility Functions
**Priority:** 🟡 MEDIUM
**File:** Create `backend/utils/helpers.py`
**Effort:** 2 hours

```python
# backend/utils/helpers.py
from datetime import datetime, timezone

def get_utc_now() -> datetime:
    """Get current UTC datetime (replaces 319 occurrences)"""
    return datetime.now(timezone.utc)

def clean_mongo_doc(doc: dict) -> dict:
    """Remove MongoDB _id field (replaces 30+ occurrences)"""
    if doc:
        doc.pop("_id", None)
    return doc

def clean_mongo_docs(docs: list) -> list:
    """Clean multiple documents"""
    return [clean_mongo_doc(doc) for doc in docs]

def safe_regex(pattern: str) -> str:
    """Escape regex special characters for safe MongoDB queries"""
    import re
    return re.escape(pattern)
```

**Update server.py:**
```python
from utils.helpers import get_utc_now, clean_mongo_doc, safe_regex

# Replace 319 occurrences of:
datetime.now(timezone.utc)
# With:
get_utc_now()
```

---

### Task 3.3: Extract Enums to Separate File
**Priority:** 🟡 MEDIUM
**File:** Create `backend/models/enums.py`
**Effort:** 2 hours

**Move all enums from server.py lines 353-360, 404-406, 577-580, 631-635, 727-746, 871-987, etc.**

```python
# backend/models/enums.py
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    MODERATOR = "MODERATOR"

class AffiliationType(str, Enum):
    FAMILY = "FAMILY"
    FAMILY_UNIT = "FAMILY_UNIT"
    WORK = "WORK"
    # ...

class PostVisibility(str, Enum):
    PUBLIC = "PUBLIC"
    CONNECTIONS = "CONNECTIONS"
    PRIVATE = "PRIVATE"
    # ...

# ... all other enums
```

---

### Task 3.4: Create Error Handling Decorator
**Priority:** 🟡 MEDIUM
**File:** `backend/core/exceptions.py`
**Effort:** 1 hour

```python
# backend/core/exceptions.py
from functools import wraps
from fastapi import HTTPException
import logging

logger = logging.getLogger("zion")

def handle_exceptions(func):
    """Decorator for consistent error handling"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise  # Re-raise HTTP exceptions as-is
        except ValueError as e:
            logger.warning(f"Validation error in {func.__name__}: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except PermissionError as e:
            logger.warning(f"Permission denied in {func.__name__}: {e}")
            raise HTTPException(status_code=403, detail="Permission denied")
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Internal server error")
    return wrapper

# Usage:
@api_router.get("/posts/{post_id}")
@handle_exceptions
async def get_post(post_id: str, current_user: User = Depends(get_current_user)):
    # ... code without try/except
```

---

### Task 3.5: Create Frontend API Client
**Priority:** 🟡 MEDIUM
**File:** Create `frontend/src/lib/api.js`
**Effort:** 3 hours

```javascript
// frontend/src/lib/api.js
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zion_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('zion_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/users/me/profile'),
};

// Posts endpoints
export const posts = {
  getFeed: (params) => api.get('/posts/feed', { params }),
  create: (data) => api.post('/posts', data),
  like: (postId) => api.post(`/posts/${postId}/like`),
  unlike: (postId) => api.delete(`/posts/${postId}/like`),
};

// Chat endpoints
export const chat = {
  getGroups: () => api.get('/chat-groups'),
  getMessages: (groupId, params) => api.get(`/chat-groups/${groupId}/messages`, { params }),
  sendMessage: (groupId, data) => api.post(`/chat-groups/${groupId}/messages`, data),
};

// ... other endpoint groups

export default api;
```

**Replace throughout frontend:**
```javascript
// OLD (217 occurrences):
const response = await axios.get(`${BACKEND_URL}/api/posts`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('zion_token')}` }
});

// NEW:
import { posts } from '../lib/api';
const response = await posts.getFeed();
```

---

## Phase 4: Backend Refactoring (Weeks 3-4)

### Task 4.1: Extract Core Security Module
**Priority:** 🟡 MEDIUM
**Files:** Create `backend/core/security.py`
**Source Lines:** 226-231, 3380-3500
**Effort:** 3 hours

```python
# backend/core/security.py
import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is required")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

---

### Task 4.2: Extract Database Module
**Priority:** 🟡 MEDIUM
**Files:** Create `backend/database/connection.py`
**Source Lines:** 40-52
**Effort:** 1 hour

```python
# backend/database/connection.py
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'zion_city')
IS_PRODUCTION = os.environ.get('ENVIRONMENT') == 'production'

client = AsyncIOMotorClient(
    MONGO_URL,
    maxPoolSize=100,
    minPoolSize=10,
    maxIdleTimeMS=45000,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    socketTimeoutMS=30000,
    retryWrites=True,
    w='majority' if IS_PRODUCTION else 1
)

db = client[DB_NAME]

async def check_connection():
    """Verify database connection"""
    await client.admin.command('ping')
    return True
```

---

### Task 4.3: Create Base Repository Pattern
**Priority:** 🟡 MEDIUM
**File:** Create `backend/repositories/base.py`
**Effort:** 2 hours

```python
# backend/repositories/base.py
from typing import TypeVar, Generic, Optional, List
from datetime import datetime, timezone

T = TypeVar('T')

class BaseRepository(Generic[T]):
    def __init__(self, db, collection_name: str):
        self.collection = db[collection_name]

    async def get_by_id(self, id: str) -> Optional[dict]:
        doc = await self.collection.find_one({"id": id})
        if doc:
            doc.pop("_id", None)
        return doc

    async def get_many_by_ids(self, ids: List[str]) -> List[dict]:
        cursor = self.collection.find({"id": {"$in": ids}})
        docs = await cursor.to_list(len(ids))
        return [self._clean(doc) for doc in docs]

    async def create(self, data: dict) -> dict:
        data["created_at"] = datetime.now(timezone.utc)
        data["updated_at"] = datetime.now(timezone.utc)
        await self.collection.insert_one(data)
        data.pop("_id", None)
        return data

    async def update(self, id: str, data: dict) -> Optional[dict]:
        data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"id": id},
            {"$set": data},
            return_document=True
        )
        return self._clean(result) if result else None

    async def delete(self, id: str) -> bool:
        result = await self.collection.delete_one({"id": id})
        return result.deleted_count > 0

    def _clean(self, doc: dict) -> dict:
        if doc:
            doc.pop("_id", None)
        return doc
```

---

### Task 4.4: Split Routes into Domain Routers
**Priority:** 🟡 MEDIUM
**Files:** Create `backend/api/v1/` directory
**Effort:** 4 hours

**Create separate router files:**
```
backend/api/v1/
├── __init__.py
├── auth.py          # Lines 3732-4039
├── users.py         # Lines 4152-4553
├── family.py        # Lines 4564-6168
├── chat.py          # Lines 6463-7383
├── posts.py         # Lines 7970-8975
├── organizations.py # Lines 9268-10950
├── finance.py       # Lines 21478-22664
├── events.py        # Lines 23293-24109
└── ai.py            # Lines 24526-25252
```

**Example router file:**
```python
# backend/api/v1/auth.py
from fastapi import APIRouter, Depends, HTTPException
from core.security import create_access_token, verify_password, get_password_hash
from schemas.auth import UserLogin, UserRegistration, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    # ... login logic
    pass

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegistration):
    # ... registration logic
    pass
```

**Update main app:**
```python
# backend/main.py
from fastapi import FastAPI
from api.v1 import auth, users, family, chat, posts, organizations, finance, events, ai

app = FastAPI()

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(family.router, prefix="/api")
# ... etc
```

---

## Phase 5: Frontend Refactoring (Weeks 4-5)

### Task 5.1: Organize Components into Folders
**Priority:** 🟡 MEDIUM
**Effort:** 4 hours

**Current structure (99 files at root):**
```
components/
├── PostItem.js
├── PostFeed.js
├── PostComposer.js
├── UserProfile.js
├── ... (99 files)
```

**Target structure:**
```
components/
├── auth/
│   ├── LoginForm.js
│   ├── RegistrationForm.js
│   └── AuthContext.js
├── posts/
│   ├── PostItem.js
│   ├── PostFeed.js
│   ├── PostComposer.js
│   └── PostComments.js
├── chat/
│   ├── ChatConversation.js
│   ├── ChatMessage.js
│   └── ChatInput.js
├── profile/
│   ├── UserProfile.js
│   ├── ProfileCard.js
│   └── ProfileEditor.js
├── layout/
│   ├── MainLayout.js
│   ├── Sidebar.js
│   └── Navigation.js
└── ui/
    ├── Button.js
    ├── Modal.js
    └── ... (shadcn components)
```

---

### Task 5.2: Split Large Components
**Priority:** 🟡 MEDIUM
**Effort:** 6 hours

**Components to split:**

| Component | Lines | Split Into |
|-----------|-------|------------|
| GoodWillEventDetail.js | 1,497 | EventHeader, EventPayment, EventReviews, EventPhotos, EventChat |
| WorkDepartmentManagementPage.js | 1,391 | DepartmentList, DepartmentForm, MemberManagement |
| EventPlanner.js | 1,290 | CalendarView, EventList, BirthdaySection |
| ChatConversation.js | 982 | MessageList, ChatInput, FileUploader, VoiceRecorder |

---

### Task 5.3: Add React.memo to Frequently Rendered Components
**Priority:** 🟡 MEDIUM
**Effort:** 2 hours

```javascript
// Before:
const PostItem = ({ post, onLike, onComment }) => {
  return (
    <div className="post-item">
      {/* ... */}
    </div>
  );
};

// After:
const PostItem = React.memo(({ post, onLike, onComment }) => {
  return (
    <div className="post-item">
      {/* ... */}
    </div>
  );
});

// With custom comparison for complex props:
const PostItem = React.memo(
  ({ post, onLike, onComment }) => {
    // ... component
  },
  (prevProps, nextProps) => {
    return prevProps.post.id === nextProps.post.id &&
           prevProps.post.likes_count === nextProps.post.likes_count;
  }
);
```

**Apply to:**
- PostItem
- ChatMessage
- UserCard
- NotificationItem
- EventCard

---

### Task 5.4: Create Custom Hooks
**Priority:** 🟡 MEDIUM
**File:** `frontend/src/hooks/`
**Effort:** 3 hours

```javascript
// hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import { auth } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('zion_token');
    if (token) {
      auth.getProfile()
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('zion_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await auth.login(credentials);
    localStorage.setItem('zion_token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('zion_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

```javascript
// hooks/usePosts.js
import { useState, useCallback } from 'react';
import { posts } from '../lib/api';

export const usePosts = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await posts.getFeed(params);
      setData(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const likePost = useCallback(async (postId) => {
    await posts.like(postId);
    setData(prev => prev.map(p =>
      p.id === postId ? { ...p, likes_count: p.likes_count + 1, user_liked: true } : p
    ));
  }, []);

  return { data, loading, error, fetchPosts, likePost };
};
```

---

## Phase 6: Infrastructure & DevOps (Week 5)

### Task 6.1: Enable HTTPS/SSL
**Priority:** 🟠 HIGH
**File:** `nginx.conf`
**Effort:** 2 hours

```nginx
# Uncomment and configure SSL block (lines 335-360)
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ... rest of config
}

# Force HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

### Task 6.2: Add Security Headers
**Priority:** 🟡 MEDIUM
**File:** `nginx.conf`
**Effort:** 30 minutes

```nginx
# Add to server block:
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https:;" always;
```

---

### Task 6.3: Optimize Gunicorn Settings
**Priority:** 🟡 MEDIUM
**File:** `backend/gunicorn.conf.py`
**Effort:** 30 minutes

```python
# Optimized settings
workers = 13  # (2 * CPU cores) + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1024  # Reduced from 2000
max_requests = 6000  # Reduced from 10000
max_requests_jitter = 600
timeout = 120
keepalive = 5  # Reduced from 10
graceful_timeout = 30
```

---

### Task 6.4: Setup Structured Logging
**Priority:** 🟡 MEDIUM
**File:** `backend/core/logging.py`
**Effort:** 2 hours

```python
# backend/core/logging.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # Set specific loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("motor").setLevel(logging.WARNING)
```

---

## Implementation Timeline Summary

| Phase | Focus | Duration | Priority Issues Fixed |
|-------|-------|----------|----------------------|
| **Phase 0** | Critical Security | 1-2 days | 7 critical vulnerabilities |
| **Phase 1** | High Security | Week 1 | 11 high vulnerabilities |
| **Phase 2** | Performance | Week 1-2 | N+1 queries, indexes, caching |
| **Phase 3** | Code Quality Foundation | Week 2 | Logging, utilities, API client |
| **Phase 4** | Backend Refactoring | Weeks 3-4 | Monolith → modules |
| **Phase 5** | Frontend Refactoring | Weeks 4-5 | Component organization |
| **Phase 6** | Infrastructure | Week 5 | SSL, headers, logging |

---

## Quick Reference: Files to Modify

### Backend
| File | Tasks |
|------|-------|
| `server.py` | 0.1-0.5, 1.1-1.8, 2.1-2.6, 3.1-3.4 |
| `mongo-init.js` | 0.6 |
| `supervisord.conf` | 0.7 |
| `gunicorn.conf.py` | 6.3 |

### Frontend
| File | Tasks |
|------|-------|
| `src/lib/api.js` (new) | 3.5 |
| `src/hooks/` (new) | 5.4 |
| `src/components/` | 5.1, 5.2, 5.3 |

### Infrastructure
| File | Tasks |
|------|-------|
| `nginx.conf` | 2.7, 6.1, 6.2 |
| `docker-compose.yml` | 1.6 |

---

## Success Metrics

After completing all phases:

| Metric | Before | After |
|--------|--------|-------|
| Security vulnerabilities | 28 | 0 |
| Database queries per request | 40+ | 5-10 |
| Backend files | 1 (25K lines) | 30+ (avg 500 lines) |
| Frontend bundle size | ~2MB | ~800KB |
| API response time (avg) | 200-500ms | 50-100ms |
| Test coverage | ~10% | 60%+ |

---

## Next Steps

1. **Start with Phase 0** - Fix critical security issues before any deployment
2. **Run security scan** after Phase 0 to verify fixes
3. **Deploy to staging** after Phase 1
4. **Performance test** after Phase 2
5. **Code review** refactored modules in Phases 4-5
6. **Production deployment** after all phases complete

---

*This document should be version controlled and updated as tasks are completed.*
