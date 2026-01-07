"""
ZION.CITY Production Configuration
===================================

This file contains recommended production settings for deployment.
Copy these settings to your deployment environment.

Usage:
  1. Set ENVIRONMENT=production in your .env file
  2. Configure all required environment variables
  3. Use a process manager (gunicorn, supervisor, systemd)
  4. Place behind a reverse proxy (nginx, cloudflare)
"""

# ============================================================
# REQUIRED ENVIRONMENT VARIABLES
# ============================================================

REQUIRED_ENV_VARS = {
    # Database
    "MONGO_URL": "MongoDB connection string (e.g., mongodb+srv://user:pass@cluster.mongodb.net)",
    "DB_NAME": "Database name (e.g., zion_city)",
    
    # Security
    "JWT_SECRET_KEY": "Strong random string (32+ characters). Generate with: openssl rand -hex 32",
    
    # AI Services
    "DEEPSEEK_API_KEY": "DeepSeek API key for ERIC chat",
    "EMERGENT_LLM_KEY": "Emergent Universal Key for Claude vision",
    
    # Environment
    "ENVIRONMENT": "Set to 'production' for production mode",
    "CORS_ORIGINS": "Comma-separated list of allowed origins (e.g., https://yourdomain.com)",
}

# ============================================================
# RECOMMENDED PRODUCTION .ENV FILE
# ============================================================

SAMPLE_PRODUCTION_ENV = """
# === Production Environment Variables ===

# Environment
ENVIRONMENT=production

# Database (MongoDB Atlas recommended)
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=zion_city

# Security (CHANGE THIS!)
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production

# CORS (your domain only)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# AI Services
DEEPSEEK_API_KEY=sk-xxx
EMERGENT_LLM_KEY=xxx
"""

# ============================================================
# GUNICORN CONFIGURATION
# ============================================================

GUNICORN_CONFIG = """
# gunicorn.conf.py - Place in /app/backend/

import multiprocessing

# Worker configuration
workers = multiprocessing.cpu_count() * 2 + 1  # (2 * CPU cores) + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 5000  # Restart workers after this many requests (prevents memory leaks)
max_requests_jitter = 500  # Add randomness to prevent all workers restarting at once

# Timeouts
timeout = 120  # Worker timeout
graceful_timeout = 30  # Time for graceful shutdown
keepalive = 5  # Keep-alive connections

# Server socket
bind = "0.0.0.0:8001"
backlog = 2048

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "warning"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "zion-city-api"

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190
"""

# ============================================================
# NGINX CONFIGURATION (Reverse Proxy)
# ============================================================

NGINX_CONFIG = """
# nginx.conf - Sample reverse proxy configuration

upstream zion_backend {
    server 127.0.0.1:8001;
    keepalive 32;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL configuration (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml;

    # API backend
    location /api {
        proxy_pass http://zion_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_buffering off;
    }

    # WebSocket support
    location /api/ws {
        proxy_pass http://zion_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Static files (frontend)
    location / {
        root /var/www/zion-city/frontend/build;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Uploaded files
    location /uploads {
        alias /app/backend/uploads;
        expires 7d;
        add_header Cache-Control "public";
    }
}
"""

# ============================================================
# SYSTEMD SERVICE CONFIGURATION
# ============================================================

SYSTEMD_SERVICE = """
# /etc/systemd/system/zion-city-api.service

[Unit]
Description=ZION.CITY API Server
After=network.target mongodb.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/app/backend
Environment="PATH=/app/backend/venv/bin"
Environment="ENVIRONMENT=production"
ExecStart=/app/backend/venv/bin/gunicorn server:app -c gunicorn.conf.py
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=30
PrivateTmp=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""

# ============================================================
# DOCKER CONFIGURATION
# ============================================================

DOCKERFILE = """
# Dockerfile for ZION.CITY Backend

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    libffi-dev \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads && chown -R nobody:nogroup uploads

# Switch to non-root user
USER nobody

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8001/api/health || exit 1

# Start server
CMD ["gunicorn", "server:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8001"]
"""

DOCKER_COMPOSE = """
# docker-compose.yml

version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - ENVIRONMENT=production
      - MONGO_URL=${MONGO_URL}
      - DB_NAME=${DB_NAME}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
    volumes:
      - uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  uploads:
"""

# ============================================================
# MONITORING RECOMMENDATIONS
# ============================================================

MONITORING_SETUP = """
# Recommended monitoring stack:

1. Application Monitoring:
   - Endpoint: GET /api/health/detailed
   - Endpoint: GET /api/metrics
   - Poll every 30 seconds

2. Error Tracking:
   - Sentry (https://sentry.io) - Free tier available
   - Add to server.py:
     import sentry_sdk
     sentry_sdk.init(dsn="your-sentry-dsn", environment="production")

3. Log Aggregation:
   - Better Stack / Logtail (https://betterstack.com)
   - Or: ELK Stack (self-hosted)

4. Uptime Monitoring:
   - UptimeRobot (https://uptimerobot.com) - Free
   - Monitor: /api/health endpoint

5. Database Monitoring:
   - MongoDB Atlas includes built-in monitoring
   - Alert on: High query times, connection count, disk usage

6. Performance Metrics to Track:
   - Response time (p50, p95, p99)
   - Error rate (5xx responses)
   - Database query time
   - AI API latency
   - Active WebSocket connections
"""

if __name__ == "__main__":
    print("=" * 60)
    print("ZION.CITY Production Configuration Guide")
    print("=" * 60)
    print("\nRequired Environment Variables:")
    for var, desc in REQUIRED_ENV_VARS.items():
        print(f"  {var}: {desc}")
    print("\nRun 'cat production_config.py' to see all configurations.")
