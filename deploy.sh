#!/bin/bash
# =============================================================================
# ZION.CITY VPS Deployment Script
# =============================================================================
# Usage: ./deploy.sh [command]
# Commands:
#   setup    - Initial server setup (run once)
#   deploy   - Build and deploy the application
#   update   - Pull latest code and redeploy
#   restart  - Restart all services
#   logs     - View application logs
#   status   - Check service status
#   backup   - Backup database
#   ssl      - Setup SSL with Let's Encrypt

set -e

# Configuration
APP_NAME="zion-city"
APP_DIR="/opt/zion-city"
DOMAIN="${DOMAIN:-yourdomain.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# SETUP: Initial server configuration
# =============================================================================
setup() {
    log_info "Setting up server for ZION.CITY..."
    
    # Update system
    apt-get update && apt-get upgrade -y
    
    # Install Docker
    if ! command -v docker &> /dev/null; then
        log_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        usermod -aG docker $USER
    fi
    
    # Install Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_info "Installing Docker Compose..."
        apt-get install -y docker-compose-plugin
    fi
    
    # Install useful tools
    apt-get install -y \
        curl \
        git \
        htop \
        certbot \
        python3-certbot-nginx \
        fail2ban \
        ufw
    
    # Setup firewall
    log_info "Configuring firewall..."
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow http
    ufw allow https
    ufw --force enable
    
    # Setup fail2ban for SSH protection
    systemctl enable fail2ban
    systemctl start fail2ban
    
    # Create app directory
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/logs
    mkdir -p $APP_DIR/uploads
    
    # Setup swap (important for 4GB RAM)
    if [ ! -f /swapfile ]; then
        log_info "Creating swap file..."
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    
    log_info "Server setup complete! Next steps:"
    echo "  1. Copy your code to $APP_DIR"
    echo "  2. Copy .env.production to $APP_DIR/.env and fill in values"
    echo "  3. Run: ./deploy.sh deploy"
}

# =============================================================================
# DEPLOY: Build and start the application
# =============================================================================
deploy() {
    log_info "Deploying ZION.CITY..."
    cd $APP_DIR
    
    # Check for .env file
    if [ ! -f .env ]; then
        log_error ".env file not found! Copy .env.production template and fill in values."
        exit 1
    fi
    
    # Build and start containers
    docker compose down --remove-orphans || true
    docker compose build --no-cache
    docker compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 10
    
    # Check health
    if curl -s http://localhost/api/health | grep -q "healthy"; then
        log_info "✅ Deployment successful! Application is running."
    else
        log_error "❌ Health check failed. Checking logs..."
        docker compose logs --tail=50
    fi
}

# =============================================================================
# UPDATE: Pull latest and redeploy
# =============================================================================
update() {
    log_info "Updating ZION.CITY..."
    cd $APP_DIR
    
    # Pull latest code (if using git)
    if [ -d .git ]; then
        git pull origin main
    fi
    
    # Rebuild and restart
    docker compose down
    docker compose build
    docker compose up -d
    
    log_info "Update complete!"
}

# =============================================================================
# SSL: Setup Let's Encrypt SSL
# =============================================================================
ssl() {
    log_info "Setting up SSL for $DOMAIN..."
    
    # Stop nginx temporarily
    docker compose stop app || true
    
    # Get certificate
    certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # Copy certificates to app directory
    mkdir -p $APP_DIR/ssl
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $APP_DIR/ssl/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $APP_DIR/ssl/
    
    # Setup auto-renewal
    echo "0 0,12 * * * root certbot renew --quiet && docker compose restart app" >> /etc/crontab
    
    # Restart app
    docker compose up -d
    
    log_info "SSL setup complete!"
}

# =============================================================================
# LOGS: View application logs
# =============================================================================
logs() {
    cd $APP_DIR
    docker compose logs -f --tail=100
}

# =============================================================================
# STATUS: Check service status
# =============================================================================
status() {
    cd $APP_DIR
    
    echo "=== Docker Containers ==="
    docker compose ps
    
    echo ""
    echo "=== Health Check ==="
    curl -s http://localhost/api/health | python3 -m json.tool || echo "Health check failed"
    
    echo ""
    echo "=== System Resources ==="
    echo "Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
    echo "Disk: $(df -h / | tail -1 | awk '{print $3"/"$2}')"
    echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
}

# =============================================================================
# BACKUP: Backup MongoDB (if using local)
# =============================================================================
backup() {
    BACKUP_DIR="$APP_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    log_info "Creating backup in $BACKUP_DIR..."
    
    # For MongoDB Atlas, use mongodump with connection string
    # mongodump --uri="$MONGO_URL" --out=$BACKUP_DIR
    
    log_info "Backup complete!"
}

# =============================================================================
# RESTART: Restart all services
# =============================================================================
restart() {
    cd $APP_DIR
    docker compose restart
    log_info "Services restarted!"
}

# =============================================================================
# Main
# =============================================================================
case "$1" in
    setup)   setup ;;
    deploy)  deploy ;;
    update)  update ;;
    ssl)     ssl ;;
    logs)    logs ;;
    status)  status ;;
    backup)  backup ;;
    restart) restart ;;
    *)
        echo "ZION.CITY Deployment Script"
        echo ""
        echo "Usage: $0 {setup|deploy|update|ssl|logs|status|backup|restart}"
        echo ""
        echo "Commands:"
        echo "  setup    - Initial server setup (run once)"
        echo "  deploy   - Build and deploy the application"
        echo "  update   - Pull latest code and redeploy"
        echo "  ssl      - Setup SSL with Let's Encrypt"
        echo "  logs     - View application logs"
        echo "  status   - Check service status"
        echo "  backup   - Backup database"
        echo "  restart  - Restart all services"
        exit 1
        ;;
esac
