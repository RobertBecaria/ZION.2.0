# ZION.CITY Code Update Instructions

This document provides step-by-step instructions for updating the ZION.CITY application when new code is pushed to the GitHub repository.

## Prerequisites

- SSH access to the server (212.41.8.199)
- Root or sudo privileges
- Docker and Docker Compose installed

---

## Quick Update (Recommended)

For most code updates, use this quick method:

```bash
# 1. Connect to the server
ssh root@212.41.8.199

# 2. Navigate to the project directory
cd /opt/zion-city

# 3. Pull the latest code
git fetch origin
git reset --hard origin/main

# 4. Rebuild and restart containers
docker compose down
docker compose up -d --build

# 5. Check status
docker ps
docker logs zion-city-app --tail=50
```

---

## Full Update (With Cache Clear)

If you encounter issues or made significant changes:

```bash
# 1. Connect to the server
ssh root@212.41.8.199

# 2. Navigate to the project directory
cd /opt/zion-city

# 3. Stop the host nginx (if running)
systemctl stop nginx

# 4. Pull the latest code
git fetch origin
git reset --hard origin/main

# 5. Stop and remove all containers
docker compose down

# 6. Rebuild without cache
docker compose build --no-cache

# 7. Start containers
docker compose up -d

# 8. Wait for health checks (30-60 seconds)
sleep 30

# 9. Verify all containers are healthy
docker ps

# 10. Check application logs
docker logs zion-city-app --tail=100

# 11. Test the application
curl http://localhost/api/health
```

---

## Verify Deployment

After updating, verify the deployment:

```bash
# Check all containers are running
docker ps

# Expected output:
# - zion-city-app (healthy)
# - zion-redis (healthy)
# - zion-mongodb (healthy)

# Check API health
curl http://localhost/api/health

# Expected output:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}

# Check application logs for errors
docker logs zion-city-app 2>&1 | grep -i error
```

---

## Troubleshooting

### Port 80 Already in Use

If you see "port 80 already in use" error:

```bash
# Stop host nginx
systemctl stop nginx

# Or check what's using port 80
ss -tlnp | grep :80

# Then restart containers
docker compose up -d
```

### Container Keeps Restarting

Check the logs for errors:

```bash
docker logs zion-city-app --tail=100
```

Common issues:
- Missing environment variables
- Database connection errors
- Nginx configuration errors

### Frontend Not Loading

1. Check nginx is running inside the container:
   ```bash
   docker exec zion-city-app supervisorctl status
   ```

2. Check nginx error log:
   ```bash
   docker exec zion-city-app cat /var/log/supervisor/nginx.stderr.log
   ```

### API Returning 404

1. Check backend is running:
   ```bash
   docker exec zion-city-app supervisorctl status
   ```

2. Check backend logs:
   ```bash
   docker logs zion-city-app 2>&1 | grep -i "gunicorn\|backend"
   ```

---

## Database Backup (Before Major Updates)

Before major updates, backup the database:

```bash
# Backup MongoDB
docker exec zion-mongodb mongodump --out /dump
docker cp zion-mongodb:/dump ./backup-$(date +%Y%m%d)

# Or use docker compose profile
docker compose --profile backup up -d backup
```

---

## Rollback Procedure

If an update breaks the application:

```bash
# 1. Check git log for previous commits
git log --oneline -10

# 2. Reset to a previous commit
git reset --hard <commit-hash>

# 3. Rebuild and restart
docker compose down
docker compose up -d --build
```

---

## Environment Variables

Important environment variables (in `.env` file):

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Secret key for JWT tokens |
| `ADMIN_PASSWORD` | Admin panel password |

---

## Docker Commands Reference

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs <container-name>
docker logs -f <container-name>  # Follow logs

# Enter container shell
docker exec -it zion-city-app bash
docker exec -it zion-mongodb mongosh

# Restart a specific container
docker compose restart <service-name>

# Remove all containers and volumes (CAUTION: deletes data!)
docker compose down -v

# View resource usage
docker stats
```

---

## Contact

For issues not covered in this guide, check the `DEPLOYMENT_FIXES.md` file for known issues and solutions.

---

## Update History

| Date | Changes |
|------|---------|
| 2026-01-16 | Initial deployment and fixes |

