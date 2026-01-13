"""
ZION.CITY API v1 Routers

This module exports all API routers for inclusion in the main application.

Usage in main.py:
    from api.v1 import auth, health
    app.include_router(auth.router, prefix="/api")
    app.include_router(health.router, prefix="/api")

Future routers (to be extracted from server.py):
    - users: User profile management
    - family: Family module endpoints
    - chat: Chat and messaging
    - posts: Social posts and feed
    - organizations: Work/organization management
    - education: School and education endpoints
    - services: Service listings
    - marketplace: Marketplace products
    - finance: Finance and wallets
    - events: Events management
    - ai: AI agent endpoints
"""

from .auth import router as auth_router
from .health import router as health_router

__all__ = [
    "auth_router",
    "health_router",
]
