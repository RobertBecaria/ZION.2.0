# 🏙️ ZION.CITY

> A comprehensive personal AI assistant platform for family, work, and community management.

![Version](https://img.shields.io/badge/version-2.0-blue.svg)
![License](https://img.shields.io/badge/license-Private-red.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![React](https://img.shields.io/badge/react-18+-61DAFB.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

ZION.CITY is a modular platform that combines family management, work organization, social networking, marketplace, and AI assistance into one unified experience. The platform features ERIC, an intelligent AI assistant that can answer questions, analyze documents, and help manage daily tasks.

### Key Modules:
- **👨‍👩‍👧‍👦 Family** - Family profiles, posts, and household management
- **💼 Work** - Organization management, departments, and announcements
- **📰 News** - Social feed, channels, and people discovery
- **🛠️ Services** - Service listings, bookings, and reviews
- **🛒 Marketplace** - Buy/sell items and inventory management
- **💰 Finance** - Wallet and transaction tracking
- **🎉 Events** - Good will events and community activities
- **📓 Journal** - School management, schedules, and gradebooks
- **🤖 ERIC** - AI assistant with document analysis

---

## ✨ Features

- 🔐 JWT-based authentication
- 🌐 Multi-language support (Russian primary)
- 📱 Responsive design
- 🤖 AI-powered assistant (DeepSeek + Claude)
- 📸 Media uploads and management
- 💬 Real-time chat (WebSocket ready)
- 📊 Analytics dashboards
- 🔔 Push notifications
- 📅 Calendar integration

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Shadcn/UI |
| **Backend** | FastAPI (Python 3.11+) |
| **Database** | MongoDB 7 |
| **Cache** | Redis 7 |
| **AI** | DeepSeek API, Claude (Anthropic) |
| **Server** | Nginx, Gunicorn, Uvicorn |
| **Container** | Docker, Docker Compose |

---

## 📦 Prerequisites

### For Development:
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or Atlas)
- Redis (optional for dev)

### For Production:
- Docker and Docker Compose
- Linux server (Ubuntu 22.04 recommended)
- Domain name (for SSL)
- 4GB+ RAM (16GB+ recommended)

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/zion-city.git
cd zion-city

# Copy environment template
cp .env.production .env

# Generate secure secrets
echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" >> .env
echo "MONGO_PASSWORD=$(openssl rand -base64 32)" >> .env

# Edit .env with your API keys
nano .env

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

Access the application at: `http://localhost`

### Option 2: Manual Setup

See [Development Setup](#development-setup) below.

---

## 💻 Development Setup

### Backend

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=zion_city
JWT_SECRET_KEY=dev-secret-key-change-in-production
DEEPSEEK_API_KEY=your-api-key
EMERGENT_LLM_KEY=your-emergent-key
ENVIRONMENT=development
EOF

# Run development server
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
# Navigate to frontend
cd frontend

# Install dependencies
yarn install

# Create .env file
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# Run development server
yarn start
```

Access at: `http://localhost:3000`

---

## 🏭 Production Deployment

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 16+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| OS | Ubuntu 20.04 | Ubuntu 22.04 |

### Step-by-Step Deployment

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Logout and login for changes to take effect
```

#### 2. Deploy Application

```bash
# Create app directory
sudo mkdir -p /opt/zion-city
cd /opt/zion-city

# Clone repository
git clone https://github.com/YOUR_USERNAME/zion-city.git .

# Configure environment
cp .env.production .env
nano .env  # Fill in your values
```

**Required environment variables:**

```env
# Security (CHANGE THESE!)
JWT_SECRET_KEY=your-secure-key-here
MONGO_PASSWORD=your-mongo-password

# AI Services
DEEPSEEK_API_KEY=sk-xxx
EMERGENT_LLM_KEY=xxx

# Domain
DOMAIN=yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

#### 3. Start Services

```bash
# Build and start
docker compose up -d

# Verify health
curl http://localhost/api/health
```

#### 4. Setup SSL (Optional but Recommended)

```bash
# Install certbot
sudo apt install certbot -y

# Stop services temporarily
docker compose down

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx.conf to enable HTTPS (uncomment SSL section)
nano nginx.conf

# Restart services
docker compose up -d
```

### Management Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Update and redeploy
git pull origin main
docker compose up -d --build

# Database shell
docker compose exec mongodb mongosh

# Application shell
docker compose exec app bash
```

---

## 📁 Project Structure

```
zion-city/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── eric_agent.py          # AI assistant logic
│   ├── gunicorn.conf.py       # Production server config
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend environment
│
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Module page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── config/            # Configuration files
│   │   └── App.js             # Main application
│   ├── public/                # Static assets
│   ├── package.json           # Node dependencies
│   └── .env                   # Frontend environment
│
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Service orchestration
├── nginx.conf                 # Web server configuration
├── mongo-init.js              # Database initialization
├── deploy.sh                  # Deployment script
├── .env.production            # Production env template
└── README.md                  # This file
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB connection string | Yes |
| `DB_NAME` | Database name | Yes |
| `JWT_SECRET_KEY` | JWT signing key | Yes |
| `DEEPSEEK_API_KEY` | DeepSeek API key | Yes |
| `EMERGENT_LLM_KEY` | Emergent Universal Key | Yes |
| `ENVIRONMENT` | `development` or `production` | Yes |
| `CORS_ORIGINS` | Allowed CORS origins | Production |
| `REDIS_URL` | Redis connection string | Optional |

### Performance Tuning

For high-traffic deployments, adjust in `docker-compose.yml`:

```yaml
environment:
  - GUNICORN_WORKERS=13      # (2 × CPU cores) + 1
  - GUNICORN_THREADS=4       # Threads per worker
```

---

## 📚 API Documentation

Once running, access the API documentation at:

- **Swagger UI**: `http://localhost/api/docs`
- **ReDoc**: `http://localhost/api/redoc`

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/posts` | GET | Get posts feed |
| `/api/family-profiles` | GET | Get family profiles |
| `/api/agent/chat` | POST | Chat with ERIC AI |
| `/api/health` | GET | Health check |

---

## 🔧 Troubleshooting

### Build fails with memory error

```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
yarn build
```

### MongoDB connection refused

```bash
# Check MongoDB is running
docker compose ps mongodb

# View MongoDB logs
docker compose logs mongodb
```

### Frontend not loading

```bash
# Check nginx logs
docker compose logs app | grep nginx

# Verify build exists
docker compose exec app ls -la /app/frontend/build
```

### Permission denied errors

```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/zion-city
```

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

---

## 🗺️ Roadmap

- [ ] Mobile applications (iOS/Android)
- [ ] Video calling integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support expansion
- [ ] Blockchain integration for finance module

---

**Built with ❤️ for families and communities**
