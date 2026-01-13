"""
ZION.CITY Health Check Routes

Simple health check endpoints for monitoring and load balancers.
"""

from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/")
async def root():
    """Root endpoint - API health check."""
    return {"status": "ok", "message": "ZION.CITY API is running"}


@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}
