# MoshSplit Deployment Guide

This guide covers building, deploying, and running MoshSplit using Docker and GitHub Container Registry (GHCR).

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Docker Images](#docker-images)
3. [GitHub Actions CI/CD](#github-actions-cicd)
4. [Running in Production](#running-in-production)
5. [Caddy Reverse Proxy](#caddy-reverse-proxy)
6. [Environment Variables](#environment-variables)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Pull and Run Pre-built Images

```bash
# Clone the repository
git clone https://github.com/moshsplit/moshsplit.git
cd moshsplit

# Copy environment example and configure
cp infra/compose/.env.example .env
# Edit .env with your values (especially passwords and keys!)

# Start all services
docker compose -f infra/compose/prod-ghcr.yml up -d
```

### Access Services

With Caddy reverse proxy, all services are accessed through a single domain:

| Service | URL Path | Description |
|---------|----------|-------------|
| Web Frontend | `https://your-domain.com/` | React PWA (default route) |
| Web Frontend | `https://your-domain.com/moshsplit/*` | React PWA (explicit path) |
| Pitboss API | `https://your-domain.com/pitboss/*` | REST API |
| Sentinel Auth | `https://your-domain.com/auth/*` | Auth service |
| Sentinel UI | Internal only | Admin dashboard (configure separately) |
| PostgreSQL | Internal only | Database |

**Note:** Only Caddy exposes ports 80 and 443. All other services are internal-only.

---

## Docker Images

MoshSplit produces the following Docker images:

| Image | Description | Dockerfile |
|-------|-------------|------------|
| `ghcr.io/moshsplit/moshsplit/pitboss-api` | Rust/Axum backend API | `infra/docker/pitboss-api.Dockerfile` |
| `ghcr.io/moshsplit/moshsplit/web` | React frontend (nginx) | `infra/docker/web.Dockerfile` |
| `ghcr.io/moshsplit/moshsplit/sentinel-migrate` | Database migration runner | `infra/docker/sentinel-migrate.Dockerfile` |

### Image Tags

Each image is tagged with:
- **Semantic version**: `v1.2.3`, `v1.2`, `v1`
- **Git SHA**: `sha-abc1234`
- **Latest**: `latest` (only from `main` branch)

### Pulling Images

```bash
# Latest version
docker pull ghcr.io/moshsplit/moshsplit/pitboss-api:latest
docker pull ghcr.io/moshsplit/moshsplit/web:latest
docker pull ghcr.io/moshsplit/moshsplit/sentinel-migrate:latest

# Specific version
docker pull ghcr.io/moshsplit/moshsplit/pitboss-api:v1.2.3
```

### Running Individual Images

```bash
# Run pitboss-api
docker run -d \
  --name pitboss-api \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e SENTINEL_URL="http://sentinel:8000" \
  ghcr.io/moshsplit/moshsplit/pitboss-api:latest

# Run web frontend
docker run -d \
  --name web \
  -p 80:80 \
  -e VITE_API_BASE_URL="http://pitboss-api:8080" \
  ghcr.io/moshsplit/moshsplit/web:latest
```

---

## GitHub Actions CI/CD

### Automatic Builds

Docker images are automatically built and pushed when:
- A tag matching `v*.*.*` is pushed (e.g., `v1.2.3`)
- Manual workflow dispatch is triggered

### Triggering a Build

```bash
# 1. Update version in Cargo.toml and package.json
# 2. Commit changes
git add .
git commit -m "Release v1.2.3"

# 3. Create and push tag
git tag v1.2.3
git push origin v1.2.3

# This triggers the GitHub Actions workflow automatically
```

### Manual Build Dispatch

1. Go to **Actions** tab on GitHub
2. Select **Build and Push Docker Images** workflow
3. Click **Run workflow**
4. Enter the tag name (e.g., `v1.2.3`)
5. Click **Run workflow**

### Workflow Details

The workflow (`.github/workflows/build-and-push.yml`):
- Builds images for `linux/amd64` and `linux/arm64`
- Uses GitHub Actions cache for faster builds
- Pushes to GitHub Container Registry (GHCR)
- Generates a build summary with all image tags

---

## Running in Production

### Prerequisites

1. **Docker** and **Docker Compose** installed
2. **GitHub account** with access to the container registry
3. **Environment variables** configured (see below)

### Step 1: Configure Environment

```bash
cd moshsplit
cp infra/compose/.env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD` - Secure database password
- `DATABASE_URL` - Full PostgreSQL connection string
- `HEX_KEY` - 64-char hex string for Sentinel (`openssl rand -hex 32`)
- `CONFIG_ENCRYPTION_KEY` - 64-char hex string (`openssl rand -hex 32`)
- `SENTINEL_PUBLIC_KEY` - Get from Sentinel after initial setup

### Step 2: Generate Secure Keys

```bash
# Generate HEX_KEY
openssl rand -hex 32

# Generate CONFIG_ENCRYPTION_KEY
openssl rand -hex 32
```

### Step 3: Start Services

```bash
# Start all services
docker compose -f infra/compose/prod-ghcr.yml up -d

# Check status
docker compose -f infra/compose/prod-ghcr.yml ps

# View logs
docker compose -f infra/compose/prod-ghcr.yml logs -f
```

### Step 4: Verify Health

```bash
# Check API health
curl http://localhost:8080/health

# Check Sentinel health
curl http://localhost:9000/v1/api/system/health

# Check database
docker compose -f infra/compose/prod-ghcr.yml exec postgres pg_isready
```

### Step 5: Access Sentinel UI

1. Open https://your-domain.com/sentinel-ui (if configured)
2. Default credentials: `admin` / `admin`
3. **Change the admin password immediately!**

---

## Caddy Reverse Proxy

MoshSplit uses [Caddy](https://caddyserver.com/) as a reverse proxy to handle all external traffic. Caddy provides:

- **Automatic SSL/TLS** - Certificates from Let's Encrypt, auto-renewed
- **HTTP/2 support** - Modern protocol with better performance
- **Path-based routing** - Clean URL structure for all services
- **Compression** - gzip and zstd compression enabled
- **Security headers** - Proper headers for production security

### Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Caddy (ports 80/443)        │
                    │  - SSL/TLS termination               │
                    │  - Reverse proxy                     │
                    │  - Compression                       │
                    └─────────────┬───────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │   Sentinel  │        │ Pitboss API │        │    Web      │
   │  :8000      │        │  :8080      │        │   :80       │
   │  /auth/*    │        │ /pitboss/*  │        │  /moshsplit/*
   └─────────────┘        └─────────────┘        └─────────────┘
```

### Configuring MOSHSPLIT_URL

The `MOSHSPLIT_URL` environment variable tells Caddy which domain to serve:

1. **Set your domain** in `.env`:
   ```bash
   MOSHSPLIT_URL=moshsplit.example.com
   ```

2. **DNS Configuration**: Point your domain's A record to your server's IP:
   ```
   moshsplit.example.com.  IN  A  <your-server-ip>
   ```

3. **Firewall**: Ensure ports 80 and 443 are open:
   ```bash
   # Example for UFW
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```

### URL Routing

| Request Path | Routes To | Prefix Stripped |
|--------------|-----------|-----------------|
| `/auth/*` | Sentinel | Yes (`/auth`) |
| `/pitboss/*` | Pitboss API | Yes (`/pitboss`) |
| `/moshsplit/*` | Web frontend | Yes (`/moshsplit`) |
| `/` (default) | Web frontend | No |

### Example API Calls

```bash
# Health check via Caddy
curl https://moshsplit.example.com/pitboss/health

# Auth endpoints
curl https://moshsplit.example.com/auth/v1/api/system/health

# Web frontend
curl https://moshsplit.example.com/
```

### SSL/TLS Certificates

Caddy automatically handles SSL/TLS:

- **First startup**: Caddy obtains certificates from Let's Encrypt
- **Renewal**: Automatic renewal before expiration
- **Storage**: Certificates stored in `caddy_data` volume

**Requirements for SSL:**
- Domain must resolve to your server
- Port 80 must be accessible (for ACME challenge)
- Valid email in Caddy config (optional but recommended)

### Caddy Volumes

| Volume | Purpose |
|--------|---------|
| `caddy_data` | SSL certificates, site data |
| `caddy_config` | Caddy configuration cache |

### Customizing Caddy

To customize the Caddy configuration, edit `infra/docker/Caddyfile`:

```bash
# Edit the Caddyfile
nano infra/docker/Caddyfile

# Restart Caddy to apply changes
docker compose -f infra/compose/prod-ghcr.yml restart caddy
```

### Testing SSL

```bash
# Check certificate info
curl -vI https://moshsplit.example.com/

# Verify SSL grade (requires ssl-labs or similar)
# Visit: https://www.ssllabs.com/ssltest/
```

### Troubleshooting Caddy

```bash
# View Caddy logs
docker compose -f infra/compose/prod-ghcr.yml logs caddy

# Check Caddy admin API
curl http://localhost:2019/metrics

# Reload Caddy config
docker compose -f infra/compose/prod-ghcr.yml restart caddy
```

### Local Development Without SSL

For local development, you can:

1. Use the `dev.yml` compose file (no Caddy)
2. Or configure Caddy for local domains with self-signed certs

---

## Environment Variables

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `MOSHSPLIT_URL` | Caddy | Your production domain (e.g., `moshsplit.example.com`) |
| `POSTGRES_PASSWORD` | PostgreSQL | Database password |
| `DATABASE_URL` | All | Full connection string |
| `HEX_KEY` | Sentinel | 64-char hex encryption key |
| `CONFIG_ENCRYPTION_KEY` | Sentinel | 64-char hex config key |
| `SENTINEL_PUBLIC_KEY` | pitboss-api | Sentinel's public key for token verification |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_DB` | `moshsplit` | Database name |
| `RUST_LOG` | `info` | Log level |
| `MOSHSPLIT_VERSION` | `latest` | Image version tag |
| `CORS_ALLOWED_ORIGINS` | `https://${MOSHSPLIT_URL}` | Comma-separated CORS origins |
| `SENTINEL_VERSION` | `v1.1.0` | Sentinel version for migrations |

**Note:** Port variables (`PITBOSS_API_PORT`, `SENTINEL_PORT`, etc.) are no longer used in production with Caddy, as all services are internal-only.

### Frontend Build-Time Variables

These are baked into the frontend image at build time:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | API URL for frontend |
| `VITE_SENTINEL_URL` | Sentinel URL for auth |

To change these, rebuild the image with:
```bash
docker build -f infra/docker/web.Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_SENTINEL_URL=https://auth.example.com \
  -t my-registry/web:custom .
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f infra/compose/prod-ghcr.yml logs <service-name>

# Check if ports are in use
lsof -i :8080
lsof -i :5432
```

### Database Connection Issues

```bash
# Test database connectivity
docker compose -f infra/compose/prod-ghcr.yml exec postgres \
  psql -U postgres -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgres://user:password@host:port/database
```

### Sentinel Authentication Issues

1. Ensure `HEX_KEY` and `CONFIG_ENCRYPTION_KEY` are 64 hex characters
2. Check that migrations completed successfully
3. Verify `SENTINEL_PUBLIC_KEY` matches Sentinel's current key

### Clear and Restart

```bash
# Stop all services
docker compose -f infra/compose/prod-ghcr.yml down

# Remove volumes (WARNING: deletes all data!)
docker compose -f infra/compose/prod-ghcr.yml down -v

# Start fresh
docker compose -f infra/compose/prod-ghcr.yml up -d
```

### Pull Latest Images

```bash
# Pull latest images
docker compose -f infra/compose/prod-ghcr.yml pull

# Recreate containers
docker compose -f infra/compose/prod-ghcr.yml up -d --force-recreate
```

---

## Local Development

For local development with hot-reload, use the dev compose file:

```bash
# Start development environment
docker compose -f infra/compose/dev.yml up

# This provides:
# - Hot-reload for pitboss-api (cargo-watch)
# - HMR for web frontend (Vite)
# - Pre-configured Sentinel with default keys
```

See the main [README.md](../README.md) for development setup.

---

## Security Notes

1. **Never commit `.env` files** - They contain secrets
2. **Change default passwords** - Especially for Sentinel UI admin
3. **Use HTTPS in production** - Configure a reverse proxy (nginx, traefik)
4. **Rotate keys periodically** - Especially `HEX_KEY` and `CONFIG_ENCRYPTION_KEY`
5. **Restrict database access** - Don't expose PostgreSQL port publicly

---

## Support

- **Documentation**: [docs/](../docs/)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
