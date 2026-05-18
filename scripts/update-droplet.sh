#!/bin/bash

# MoshSplit Update Script
# ========================
# Updates an existing MoshSplit deployment on a remote Droplet.
# Pulls latest Docker images and restarts services.
#
# Usage:
#   ./update-droplet.sh <droplet-ip> <user> [ssh-key-path]
#
# Examples:
#   ./update-droplet.sh 123.45.67.89 root
#   ./update-droplet.sh 123.45.67.89 root ~/.ssh/dio_dev_droplet

set -e

DROPLET_IP="${1:-}"
DROPLET_USER="${2:-root}"
SSH_KEY_PATH="${3:-}"
REMOTE_DIR="/opt/moshsplit"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

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
fi

log_info "Connecting to Droplet..."
ssh -o BatchMode=yes $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" "echo 'Connection successful'" > /dev/null 2>&1 || {
    log_error "Cannot connect to Droplet via SSH."
    exit 1
}

log_info "Updating MoshSplit deployment..."
ssh $SSH_OPTS "$DROPLET_USER@$DROPLET_IP" << ENDSSH
cd $REMOTE_DIR

echo "Pulling latest Docker images..."
docker compose pull

echo "Restarting services..."
docker compose up -d --force-recreate

echo ""
echo "Update complete! Service status:"
docker compose ps
ENDSSH

log_info "Update completed successfully!"
