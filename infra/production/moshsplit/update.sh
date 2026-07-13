#!/bin/bash
cd /opt/moshsplit
echo "Pulling latest images..."
docker compose pull
echo "Restarting services..."
docker compose up -d --force-recreate
echo "Update complete!"
docker compose ps
