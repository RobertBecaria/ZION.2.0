# =============================================================================
# ZION.CITY Dockerfile
# =============================================================================
# Multi-stage build for optimal image size and build caching
# Optimized for: i7-8700 (6c/12t) | 64GB RAM | 2x 480GB SSD

# =============================================================================
# Stage 1: Backend Builder
# =============================================================================
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend

# Install system dependencies for Python packages
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
# Stage 2: Frontend Builder
# =============================================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy package.json first (for better caching)
COPY frontend/package.json ./

# Copy ALL config files BEFORE npm install (craco needs its config)
COPY frontend/craco.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/jsconfig.json ./
COPY frontend/components.json ./

# Install dependencies with legacy peer deps (for date-fns compatibility)
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend source code
COPY frontend/public/ ./public/
COPY frontend/src/ ./src/

# Build the frontend (craco build)
RUN npm run build

# =============================================================================
# Stage 3: Production Image
# =============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/supervisor /var/log/nginx /app/logs /app/uploads

# Copy Python packages from backend-builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin/gunicorn /usr/local/bin/gunicorn
COPY --from=backend-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy backend code
COPY --from=backend-builder /app/backend /app/backend

# Copy frontend build artifacts
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Copy configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set permissions for non-root execution
# Backend runs as www-data user for security
RUN chown -R www-data:www-data /app/frontend/build \
    && chown -R www-data:www-data /app/uploads \
    && chown -R www-data:www-data /app/logs \
    && chown -R www-data:www-data /app/backend \
    && chown -R www-data:www-data /var/log/supervisor \
    && chown -R www-data:www-data /var/log/nginx \
    && chmod 755 /var/log/supervisor /var/log/nginx

# Expose port
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start supervisor (manages nginx + gunicorn)
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
