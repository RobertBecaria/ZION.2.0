# =============================================================================
# ZION.CITY VPS Deployment Guide
# =============================================================================

## 📋 Quick Start (5 minutes)

### 1. On your VPS, run initial setup:
```bash
# Download and run setup
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy.sh -o deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh setup
```

### 2. Copy your code to the server:
```bash
# Option A: Using Git (Recommended)
cd /opt/zion-city
git clone https://github.com/YOUR_REPO/zion-city.git .

# Option B: Using SCP
scp -r ./app/* user@your-vps:/opt/zion-city/
```

### 3. Configure environment:
```bash
cd /opt/zion-city
cp .env.production .env
nano .env  # Fill in your actual values
```

### 4. Deploy:
```bash
./deploy.sh deploy
```

### 5. Setup SSL (optional but recommended):
```bash
DOMAIN=yourdomain.com ./deploy.sh ssl
```

---

## 🖥️ Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 | Ubuntu 22.04 |

---

## 📁 File Structure

```
/opt/zion-city/
├── backend/
│   ├── server.py
│   ├── eric_agent.py
│   ├── gunicorn.conf.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── build/          # Generated after build
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── supervisord.conf
├── deploy.sh
├── .env               # Your secrets (don't commit!)
├── .env.production    # Template
├── logs/
└── uploads/
```

---

## 🔧 Configuration Details

### MongoDB Options

**Option 1: MongoDB Atlas (Recommended)**
- Free tier available (512MB)
- Automatic backups
- No server maintenance
- Get connection string from: https://cloud.mongodb.com

**Option 2: Self-hosted MongoDB**
Uncomment the mongodb service in `docker-compose.yml`

### Resource Optimization for 4GB RAM

The configuration is optimized for your 2 vCPU / 4GB RAM setup:

| Service | Memory Limit | Workers |
|---------|--------------|---------|
| Backend (Gunicorn) | ~1.5 GB | 3 workers |
| Frontend (static) | ~100 MB | - |
| Nginx | ~50 MB | auto |
| Redis | 256 MB | - |
| System/Swap | ~2 GB | - |

### Swap Configuration
The setup script creates 2GB swap for memory overflow protection:
```bash
# Verify swap
free -h
```

---

## 🛡️ Security Checklist

- [x] UFW Firewall configured (ports 22, 80, 443 only)
- [x] Fail2ban for SSH brute-force protection
- [x] Non-root user recommended
- [x] SSL/TLS with Let's Encrypt
- [x] Security headers in Nginx
- [x] Rate limiting on API endpoints
- [ ] Change default SSH port (optional)
- [ ] Setup monitoring (optional)

---

## 📊 Monitoring Commands

```bash
# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# System resources
htop

# Docker stats
docker stats

# Nginx access logs
tail -f /opt/zion-city/logs/nginx-access.log
```

---

## 🔄 Updates & Maintenance

### Deploy new version:
```bash
cd /opt/zion-city
git pull origin main
./deploy.sh update
```

### Restart services:
```bash
./deploy.sh restart
```

### View container logs:
```bash
docker compose logs -f app
docker compose logs -f redis
```

### Enter container shell:
```bash
docker compose exec app bash
```

---

## 🆘 Troubleshooting

### Build fails with memory error
```bash
# Increase Node.js memory (in .env)
NODE_OPTIONS=--max-old-space-size=3072

# Or build locally and copy:
npm run build
scp -r build/ user@vps:/opt/zion-city/frontend/
```

### Container won't start
```bash
# Check logs
docker compose logs app

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Database connection issues
```bash
# Test MongoDB connection
docker compose exec app python -c "
from pymongo import MongoClient
import os
client = MongoClient(os.environ['MONGO_URL'])
print(client.server_info())
"
```

### SSL certificate renewal
```bash
# Manual renewal
certbot renew

# Check certificate
certbot certificates
```

---

## 📈 Scaling Tips

When you need more performance:

1. **Upgrade VPS** to 4 vCPU / 8GB RAM
2. **Increase workers**: `GUNICORN_WORKERS=7`
3. **Add CDN** (Cloudflare) for static assets
4. **Use MongoDB Atlas M10+** for dedicated DB
5. **Separate services** (DB on different server)

---

## 🔗 Useful Links

- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Atlas](https://cloud.mongodb.com/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Cloudflare](https://cloudflare.com/)

---

## 📞 Support

For deployment issues:
1. Check logs: `./deploy.sh logs`
2. Check status: `./deploy.sh status`
3. Review this guide
4. Contact support with logs attached
