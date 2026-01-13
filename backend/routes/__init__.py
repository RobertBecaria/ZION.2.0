"""
ZION.CITY API Routes Module
===========================

This module contains domain-specific routers that handle API endpoints.
Routes are organized by domain (auth, users, posts, etc.) for better
maintainability and separation of concerns.

Usage in main app:
    from routes import auth_router, users_router

    app.include_router(auth_router, prefix="/api")
    app.include_router(users_router, prefix="/api")

Migration Guide:
    Routes are being incrementally migrated from server.py to this module.
    When adding new endpoints, add them to the appropriate router file here.
"""

from .auth import router as auth_router
from .health import router as health_router

# Export all routers for easy import
__all__ = [
    'auth_router',
    'health_router',
]

# Routers to be added as migration progresses:
# - users_router: User profile and search endpoints
# - posts_router: Social feed posts
# - chat_router: Direct and group messaging
# - family_router: Family profiles and management
# - work_router: Organization and work-related endpoints
# - media_router: File uploads and media management
# - notifications_router: User notifications
# - services_router: Service marketplace
# - marketplace_router: Product marketplace
# - news_router: News channels and events
# - events_router: Goodwill events
