#!/bin/bash

# MoshSplit Droplet Setup Script
# ================================
# This script sets up a DigitalOcean Droplet for MoshSplit deployment.
# It installs Docker, copies configuration files, and deploys the application.
#
# Usage:
#   ./setup-droplet.sh <droplet-ip> <user> [ssh-key-path]
#
# Examples:
#   ./setup-droplet.sh 123.45.67.89 root
#   ./setup-droplet.sh 123.45.67.89 root ~/.ssh/dio_dev_droplet

set -e

# ── Configuration ─────────────────────────────────────────────────────────────
DROPLET_IP="${1:-}"
DROPLET_USER="${2:-root}"
SSH_KEY_PATH="${3:-}"
PROJECT_NAME="moshsplit"
REMOTE_DIR="/opt/$PROJECT_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────────────────
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v ssh &> /dev/null; then
        log_error "SSH is not installed. Please install SSH and try again."
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        log_error "SCP is not installed. Please install SSH tools and try again."
        exit 1
    fi
    
    if [ -z "$DROPLET_IP" ]; then
        log_error "Droplet IP address is required."
        echo "Usage: $0 <droplet-ip> <user> [ssh-key-path]"
        exit 1
    fi
    
    # Set SSH options
    SSH_OPTS=""
    SCP_OPTS=""
    if [ -n "$SSH_KEY_PATH" ]; then
        if [ ! -f "$SSH_KEY_PATH" ]; then
            log_error "SSH key not found: $SSH_KEY_PATH"
            exit 1
        fi
        SSH_OPTS="-i $SSH_KEY_PATH -o IdentitiesOnly=yes"
        SCP_OPTS="-i $SSH_KEY_PATH"
        log_info "Using SSH key: $SSH_KEY_PATH"
    fi
    
    log_info "Requirements met!"
}

# ── Main Script ───────────────────────────────────────────────────────────────
check_requirements

log_info "Starting MoshSplit Droplet Setup"
echo "====================================="
echo "Droplet IP:   $DROPLET_IP"
echo "User:         $DROPLET_USER"
echo "SSH Key:      ${SSH_KEY_PATH:-default}"
echo "Project:      $PROJECT_NAME"
echo "Remote Dir:   $REMOTE_DIR"
echo "====================================="
echo

# Step 1: Test SSH connection
log_info "Testing SSH connection..."
if ! ssh $SSH_OPTS -o ConnectTimeout=10 -o BatchMode=yes "$DROPLET_USER@$DROPLET_IP" "echo 'Connection successful'" > /dev/null 2>&1; then
    log_error "Cannot connect to Droplet via SSH."
    log_info "Make sure:"
    echo "  1. The Droplet is running"
    echo "  2. SSH is enabled (port 22)"
    echo "  3. Your SSH key is added to the Droplet"
    if [ -z "$SSH_KEY_PATH" ]; then
        echo "  4. Or specify your SSH key:"
        echo "     $0 $DROPLET_IP $DROPLET_USER ~/.ssh/dio_dev_droplet"
    fi
    echo ""
    echo "To add your SSH key to the Droplet:"
    echo "  1. Go to https://cloud.digitalocean.com/droplets"
    echo "  2. Click on your Droplet"
    echo "  3. Click 'Console'"
    echo "  4. Login and run:"
    echo "     mkdir -p /root/.ssh"
    echo "     echo '<your-public-key>' >> /root/.ssh/authorized_keys"
    echo "     chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys"
    exit 1
fi
log_info "SSH connection successful!"
echo

# Step 2: Create remote directory
log_info "Creating remote directory..."
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "sudo mkdir -p $REMOTE_DIR && sudo chown $DROPLET_USER:$DROPLET_USER $REMOTE_DIR"
log_info "Directory created: $REMOTE_DIR"
echo

# Step 3: Copy Docker Compose files
log_info "Copying Docker Compose files..."
scp $SCP_OPTS infra/compose/prod-caddy.yml "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/docker-compose.yml"
scp $SCP_OPTS infra/docker/Caddyfile "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/Caddyfile"
scp $SCP_OPTS infra/compose/.env.example "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/.env.example"
log_info "Docker Compose files copied!"
echo

# Step 4: Create .env file template
log_info "Creating .env configuration..."
cat > /tmp/moshsplit-env << 'EOF'
# ==========================================
# MoshSplit Production Configuration
# ==========================================
# Edit this file with your actual values before deploying!

# ── Domain / URL (REQUIRED) ───────────────────────────────────────────────────
# Your domain name (e.g., moshsplit.example.com)
# DNS A record must point to this Droplet's IP
MOSHSPLIT_URL=your-domain.com

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD
POSTGRES_DB=moshsplit
DATABASE_URL=postgres://postgres:CHANGE_ME_TO_SECURE_PASSWORD@postgres:5432/moshsplit

# ── Sentinel Auth (REQUIRED) ──────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
HEX_KEY=CHANGE_ME_TO_64_CHAR_HEX_KEY
CONFIG_ENCRYPTION_KEY=CHANGE_ME_TO_64_CHAR_HEX_KEY

# Sentinel public key (get after first setup)
SENTINEL_PUBLIC_KEY=

# Sentinel version
SENTINEL_VERSION=v1.1.0

# ── OIDC / Auth URLs ──────────────────────────────────────────────────────────
OIDC_ISSUER_URL=https://${MOSHSPLIT_URL}/auth
FRONTEND_URL=https://${MOSHSPLIT_URL}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=https://${MOSHSPLIT_URL}

# ── Logging ───────────────────────────────────────────────────────────────────
RUST_LOG=info

# ── Application Version ───────────────────────────────────────────────────────
# Matches git tag (e.g., v1.0.0) or 'latest'
MOSHSPLIT_VERSION=latest
EOF

scp $SCP_OPTS /tmp/moshsplit-env "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/.env"
rm /tmp/moshsplit-env
log_info ".env file created!"
log_warn "IMPORTANT: Edit .env with your actual values!"
echo

# Step 5: Install Docker and dependencies
log_info "Installing Docker and dependencies..."
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" << 'ENDSSH'
#!/bin/bash
set -e

# Update system
echo "Updating system packages..."
apt-get update

# Install prerequisites
echo "Installing prerequisites..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw

# Install Docker
echo "Installing Docker..."
curl -fsSL https://get.docker.com | sh

# Add user to docker group (avoid sudo)
echo "Adding user to docker group..."
usermod -aG docker $USER

# Install Docker Compose plugin
echo "Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

# Configure firewall
echo "Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (for SSL)
ufw allow 443/tcp   # HTTPS

echo "Docker installation complete!"
docker --version
docker compose version
ENDSSH
log_info "Docker installed successfully!"
echo

# Step 6: Create deployment script on Droplet
log_info "Creating deployment script..."
cat > /tmp/deploy-script << 'EOF'
#!/bin/bash
# MoshSplit Deployment Script
# Run this after editing .env with your values

set -e

echo "====================================="
echo "MoshSplit Deployment"
echo "====================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please edit .env with your configuration first."
    exit 1
fi

# Check if MOSHSPLIT_URL is set
if grep -q "MOSHSPLIT_URL=your-domain.com" .env || grep -q "MOSHSPLIT_URL=CHANGE_ME" .env; then
    echo "ERROR: Please edit .env and set MOSHSPLIT_URL to your actual domain!"
    exit 1
fi

# Pull latest images
echo "Pulling Docker images..."
docker compose pull

# Start services
echo "Starting services..."
docker compose up -d

# Show status
echo ""
echo "====================================="
echo "Deployment Complete!"
echo "====================================="
echo ""
echo "Service Status:"
docker compose ps
echo ""
echo "Logs (press Ctrl+C to exit):"
docker compose logs -f caddy
EOF

scp $SCP_OPTS /tmp/deploy-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/deploy.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/deploy.sh"
rm /tmp/deploy-script
log_info "Deployment script created!"
echo

# Step 7: Create management scripts
log_info "Creating management scripts..."

# Status script
cat > /tmp/status-script << 'EOF'
#!/bin/bash
cd /opt/moshsplit
docker compose ps
echo ""
echo "Resource Usage:"
docker stats --no-stream
EOF
scp $SCP_OPTS /tmp/status-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/status.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/status.sh"

# Logs script
cat > /tmp/logs-script << 'EOF'
#!/bin/bash
cd /opt/moshsplit
docker compose logs -f "$@"
EOF
scp $SCP_OPTS /tmp/logs-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/logs.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/logs.sh"

# Update script
cat > /tmp/update-script << 'EOF'
#!/bin/bash
cd /opt/moshsplit
echo "Pulling latest images..."
docker compose pull
echo "Restarting services..."
docker compose up -d --force-recreate
echo "Update complete!"
docker compose ps
EOF
scp $SCP_OPTS /tmp/update-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/update.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/update.sh"

# Backup script
cat > /tmp/backup-script << 'EOF'
#!/bin/bash
cd /opt/moshsplit
BACKUP_DIR="/opt/moshsplit/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL database..."
docker compose exec -T postgres pg_dump -U postgres moshsplit > "$BACKUP_DIR/database.sql"

echo "Backing up .env file..."
cp .env "$BACKUP_DIR/"

echo "Backup complete: $BACKUP_DIR"
ls -la "$BACKUP_DIR"
EOF
scp $SCP_OPTS /tmp/backup-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/backup.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/backup.sh"

# Migration script
cat > /tmp/migrate-script << 'EOF'
#!/bin/bash
cd /opt/moshsplit
export $(grep -v '^#' .env | xargs)

echo "Starting database..."
docker compose up -d postgres
sleep 10

echo "Running Sentinel migrations..."
docker run --rm \
  --network moshsplit_app-net \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SENTINEL_VERSION="${SENTINEL_VERSION:-v1.1.0}" \
  ghcr.io/graned/sentinel-core:$SENTINEL_VERSION \
  sentinel migrations run

echo "Migrations complete!"
EOF
scp $SCP_OPTS /tmp/migrate-script "$DROPLET_USER@$DROPLET_IP:$REMOTE_DIR/migrate.sh"
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "chmod +x $REMOTE_DIR/migrate.sh"

rm /tmp/status-script /tmp/logs-script /tmp/update-script /tmp/backup-script /tmp/migrate-script
log_info "Management scripts created!"
echo

# Step 8: Print instructions
echo "====================================="
echo -e "${GREEN}Droplet Setup Complete!${NC}"
echo "====================================="
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. SSH into your Droplet:"
echo "   ssh ${SSH_OPTS:+-i $SSH_KEY_PATH} $DROPLET_USER@$DROPLET_IP"
echo ""
echo "2. Navigate to project directory:"
echo "   cd $REMOTE_DIR"
echo ""
echo "3. Edit .env with your actual values:"
echo "   nano .env"
echo "   - Set MOSHSPLIT_URL to your domain"
echo "   - Generate secure passwords (openssl rand -hex 32)"
echo "   - Configure database credentials"
echo ""
echo "4. Deploy MoshSplit:"
echo "   ./deploy.sh"
echo ""
echo "5. Check status:"
echo "   ./status.sh"
echo ""
echo "6. View logs:"
echo "   ./logs.sh caddy"
echo ""
echo "Management Commands:"
echo "--------------------"
echo "  ./deploy.sh    - Deploy/restart all services"
echo "  ./status.sh    - Show service status and resource usage"
echo "  ./logs.sh      - View logs (optionally specify service)"
echo "  ./update.sh    - Pull latest images and update"
echo "  ./backup.sh    - Backup database and config"
echo ""
echo "DNS Configuration:"
echo "------------------"
echo "Point your domain's A record to: $DROPLET_IP"
echo "Example: moshsplit.example.com → $DROPLET_IP"
echo ""
echo "After DNS propagates, Caddy will automatically provision SSL certificates."
echo ""
echo "Access URLs (after deployment):"
echo "  Web:    https://$DROPLET_IP/moshsplit/"
echo "  API:    https://$DROPLET_IP/pitboss/health"
echo "  Auth:   https://$DROPLET_IP/auth/"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} Replace $DROPLET_IP with your actual domain name!"
echo ""
