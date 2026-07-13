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
