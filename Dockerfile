# ZION.CITY Deployment Guide
# ===========================
# Complete deployment setup for VPS with Docker (Recommended)

# =============================================================================
# OPTION A: DOCKER DEPLOYMENT (RECOMMENDED)
# =============================================================================
# Benefits:
# - Consistent environment across dev/staging/production
# - Easy scaling and updates
# - Isolated dependencies
# - Simple rollbacks
# - Better resource management for 2 vCPU / 4GB RAM

FROM python:3.11-slim as backend-builder

WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn uvicorn[standard]

# Copy backend code
COPY backend/ .

# =============================================================================
# Frontend Build Stage
# =============================================================================
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --network-timeout 100000

# Copy frontend source
COPY frontend/ .

# Build frontend (production optimized)
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN yarn build

# =============================================================================
# Production Image
# =============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install nginx and supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin/gunicorn /usr/local/bin/gunicorn
COPY --from=backend-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy backend code
COPY --from=backend-builder /app/backend /app/backend

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start supervisor (manages nginx + gunicorn)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
