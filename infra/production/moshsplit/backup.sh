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
