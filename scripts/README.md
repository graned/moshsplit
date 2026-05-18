# MoshSplit Droplet Deployment Guide

## Quick Start

### 1. Prerequisites
- DigitalOcean Droplet (Ubuntu 22.04 recommended)
- Domain name pointing to Droplet IP
- SSH access to Droplet

### 2. Run Setup Script

```bash
# From your local machine
chmod +x scripts/setup-droplet.sh
./scripts/setup-droplet.sh <droplet-ip> <user>

# Example
./scripts/setup-droplet.sh 123.45.67.89 root
```

The script will:
- ✅ Install Docker and Docker Compose
- ✅ Configure firewall (ports 22, 80, 443)
- ✅ Copy configuration files
- ✅ Create deployment scripts

### 3. Configure Environment

SSH into your Droplet:
```bash
ssh root@<droplet-ip>
cd /opt/moshsplit
nano .env
```

**Required values to set:**
```bash
# Your domain (REQUIRED)
MOSHSPLIT_URL=moshsplit.yourdomain.com

# Database password (generate secure password)
POSTGRES_PASSWORD=<secure-password>
DATABASE_URL=postgres://postgres:<secure-password>@postgres:5432/moshsplit

# Auth keys (generate with: openssl rand -hex 32)
HEX_KEY=<64-character-hex-key>
CONFIG_ENCRYPTION_KEY=<64-character-hex-key>
```

### 4. Deploy

```bash
./deploy.sh
```

### 5. Verify

```bash
./status.sh
./logs.sh caddy
```

---

## Management Commands

| Command | Description |
|---------|-------------|
| `./deploy.sh` | Deploy or restart all services |
| `./status.sh` | Show service status and resource usage |
| `./logs.sh [service]` | View logs (optionally specify service) |
| `./update.sh` | Pull latest images and update |
| `./backup.sh` | Backup database and configuration |

---

## DNS Configuration

Point your domain's A record to the Droplet's IP:

```
Type: A
Name: @ (or moshsplit)
Value: <droplet-ip>
TTL: 3600
```

**Wait for DNS propagation** (usually 5-30 minutes).

Caddy will automatically provision SSL certificates once DNS is ready.

---

## Access URLs

After deployment and DNS propagation:

| Service | URL |
|---------|-----|
| Web Frontend | `https://your-domain.com/moshsplit/` |
| Pitboss API | `https://your-domain.com/pitboss/` |
| Sentinel Auth | `https://your-domain.com/auth/` |
| Health Check | `https://your-domain.com/pitboss/health` |

---

## Troubleshooting

### Caddy logs (SSL issues)
```bash
./logs.sh caddy
```

### Check if services are running
```bash
./status.sh
```

### Restart a specific service
```bash
cd /opt/moshsplit
docker compose restart <service-name>
```

### View all logs
```bash
./logs.sh
```

### Check Docker resources
```bash
docker stats
docker system df
```

---

## Updating MoshSplit

### Option 1: Use update script
```bash
./update-droplet.sh <droplet-ip> <user>
```

### Option 2: SSH and update manually
```bash
ssh root@<droplet-ip>
cd /opt/moshsplit
./update.sh
```

---

## Backups

### Create backup
```bash
ssh root@<droplet-ip>
cd /opt/moshsplit
./backup.sh
```

Backups are stored in `/opt/moshsplit/backups/`.

### Restore from backup
```bash
# Stop services
docker compose down

# Restore database
cat /opt/moshsplit/backups/YYYYMMDD_HHMMSS/database.sql | \
  docker compose exec -T postgres psql -U postgres moshsplit

# Restart services
docker compose up -d
```

---

## Security

### Firewall status
```bash
ssh root@<droplet-ip>
ufw status
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

### Update system packages
```bash
ssh root@<droplet-ip>
apt update && apt upgrade -y
```

### Docker security best practices
- Keep Docker updated: `apt install docker-ce docker-compose-plugin`
- Review container logs regularly
- Use strong passwords in `.env`
- Enable Droplet backups (DigitalOcean feature)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MOSHSPLIT_URL` | ✅ | Your domain (e.g., `moshsplit.example.com`) |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `DATABASE_URL` | ✅ | Database connection string |
| `HEX_KEY` | ✅ | Sentinel token signing key (64 hex chars) |
| `CONFIG_ENCRYPTION_KEY` | ✅ | Sentinel config encryption key (64 hex chars) |
| `SENTINEL_PUBLIC_KEY` | ⚠️ | Generated after first Sentinel setup |
| `MOSHSPLIT_VERSION` | ❌ | App version (default: `latest`) |
| `RUST_LOG` | ❌ | Log level (default: `info`) |

---

## Support

For issues or questions:
1. Check logs: `./logs.sh caddy`
2. Review status: `./status.sh`
3. See full documentation in `/docs/` folder
