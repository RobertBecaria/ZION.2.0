# ZION.CITY Deployment Fixes Documentation

This document describes all the fixes that were applied to successfully deploy the ZION.CITY application on the VPS server.

## Server Information
- **Server IP**: 212.41.8.199
- **OS**: Linux (Debian-based)
- **Deployment Method**: Docker Compose
- **Application Directory**: `/opt/zion-city`

---

## Issues Fixed

### 1. Missing Python Package: `emergentintegrations`

**Problem**: The `backend/requirements.txt` contained a package `emergentintegrations==0.1.0` that doesn't exist on PyPI. This is a private/custom package from the AI agent that built the project.

**Solution**: 
- Removed `emergentintegrations==0.1.0` from `backend/requirements.txt`
- Commented out the import in `backend/eric_agent.py`:
  ```python
  # from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
  ```

**Impact**: The AI agent chat functionality may not work without this package. If you have access to this package, you'll need to configure a private PyPI index or install it manually.

---

### 2. Supervisord Configuration Error

**Problem**: The `supervisord.conf` file contained an invalid `eventlistener:process_exit` section with an unsupported variable `%(exit_code)s`.

**Solution**: Removed the problematic eventlistener section from `supervisord.conf`:
```
# Removed these lines:
[eventlistener:process_exit]
command=sh -c 'echo "Process exited with code %(exit_code)s"'
events=PROCESS_STATE_EXITED
```

---

### 3. Nginx Configuration Issues

Multiple issues were found in `nginx.conf`:

#### 3.1 User Not Found
**Problem**: `user nginx;` directive referenced a user that doesn't exist in the container.

**Solution**: Changed to `user www-data;`

#### 3.2 Unsupported Directive
**Problem**: `upstream_keepalive_timeout 60s;` is not supported by the nginx version in the container.

**Solution**: Commented out the line:
```nginx
# upstream_keepalive_timeout 60s;
```

#### 3.3 Unsupported Regex Pattern
**Problem**: Location block with regex `{8,}` quantifier:
```nginx
location ~* \.[a-f0-9]{8,}\.(js|css)$ {
```

**Solution**: Commented out the entire location block (lines 251-257).

#### 3.4 Missing Cache Directory
**Problem**: `proxy_cache_path /var/cache/nginx/api` referenced a directory that doesn't exist.

**Solution**: Commented out the `proxy_cache_path` directive on line 113:
```nginx
# proxy_cache_path /var/cache/nginx/api ...
```

#### 3.5 Missing Admin Route
**Problem**: The nginx SPA routes regex didn't include `/admin`, causing 404 errors.

**Solution**: Added `admin` to the location regex on line 288:
```nginx
location ~ ^/(admin|dashboard|family|work|news|services|marketplace|finance|events|journal|profile|settings|chat|notifications|media|auth|login|register) {
```

---

### 4. Frontend API URL Configuration

**Problem**: The React frontend used `process.env.REACT_APP_BACKEND_URL` for API calls, but this was `undefined` at build time, causing API requests to go to `/undefined/api/auth/register` instead of `/api/auth/register`.

**Solution**: Added environment variable in `Dockerfile` before the frontend build:
```dockerfile
# Build the frontend (craco build)
ENV REACT_APP_BACKEND_URL=""
RUN npm run build
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/requirements.txt` | Removed `emergentintegrations==0.1.0` |
| `backend/eric_agent.py` | Commented out `emergentintegrations` import |
| `supervisord.conf` | Removed `eventlistener:process_exit` section |
| `nginx.conf` | Fixed user, commented unsupported directives, added admin route |
| `Dockerfile` | Added `ENV REACT_APP_BACKEND_URL=""` before npm build |
| `frontend/.env` | Created with `REACT_APP_BACKEND_URL=` |
| `frontend/src/components/auth/AuthContext.js` | Added fallback `|| ''` for BACKEND_URL |

---

## Port Conflict Note

The host server runs ISPmanager which uses nginx on port 80. Before starting the Docker containers, you may need to stop the host nginx:

```bash
systemctl stop nginx
```

Alternatively, configure the Docker containers to use different ports.

---

## Current Working State

After all fixes, the following is working:
- ✅ User registration
- ✅ User login
- ✅ Admin panel access (`/admin`)
- ✅ All SPA routes
- ✅ API endpoints
- ✅ MongoDB database
- ✅ Redis cache

---

## Date of Deployment
January 16, 2026
