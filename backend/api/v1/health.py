"""
ZION.CITY Health Check Router
System health and status endpoints
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from database.connection import health_check as db_health_check, get_database

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint.

    Returns service status for load balancer health checks.
    """
    return {
        "status": "healthy",
        "service": "zion-api",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check with database status.

    Returns comprehensive system health information.
    """
    db_status = await db_health_check()

    overall_status = "healthy" if db_status["status"] == "healthy" else "degraded"

    return {
        "status": overall_status,
        "service": "zion-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "database": db_status
        }
    }


@router.get("/health/ready")
async def readiness_check():
    """
    Kubernetes-style readiness probe.

    Returns 200 if the service is ready to accept traffic.
    """
    try:
        db = get_database()
        await db.command("ping")
        return {"ready": True}
    except Exception as e:
        return {"ready": False, "error": str(e)}
