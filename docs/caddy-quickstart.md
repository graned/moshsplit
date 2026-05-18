# Caddy Reverse Proxy — Quick Reference

## Files Created

| File | Purpose |
|------|---------|
| `infra/docker/Caddyfile` | Caddy reverse proxy configuration |
| `infra/compose/prod-caddy.yml` | Production Docker Compose with Caddy |
| `infra/compose/.env.example.caddy` | Environment variables example |
| `docs/caddy-architecture.md` | Network architecture documentation |
| `docs/caddy-migration.md` | Migration guide from direct ports to Caddy |

## Files Modified

| File | Change |
|------|--------|
| `infra/docker/web.Dockerfile` | Updated default VITE_* URLs to relative paths |

---

## Quick Start

```bash
# 1. Copy environment template
cp infra/compose/.env.example.caddy .env

# 2. Edit required variables
# - MOSHSPLIT_URL=moshsplit.example.com
# - DATABASE_URL, passwords, keys, etc.

# 3. Deploy
docker compose -f infra/compose/prod-caddy.yml up -d

# 4. Verify
curl -I https://moshsplit.example.com/
```

---

## URL Routing

| Path | Service | Description |
|------|---------|-------------|
| `/` | → `/moshsplit/` | Root redirect |
| `/moshsplit/*` | Web (port 80) | React PWA |
| `/pitboss/*` | Pitboss API (port 8080) | REST API |
| `/sentinel/*` | Sentinel (port 8000) | Auth API |
| `/auth/*` | Sentinel UI (port 80) | Admin dashboard |

---

## Environment Variables

### Required
```bash
MOSHSPLIT_URL=moshsplit.example.com
DATABASE_URL=postgres://user:pass@postgres:5432/moshsplit
POSTGRES_PASSWORD=secure_password
HEX_KEY=<64-char-hex>
CONFIG_ENCRYPTION_KEY=<64-char-hex>
SENTINEL_PUBLIC_KEY=<from-sentinel>
```

### Frontend (build-time)
```bash
VITE_API_BASE_URL=/pitboss
VITE_SENTINEL_URL=/sentinel
```

---

## Network Architecture

```
Internet (80/443)
    │
    ▼
┌─────────────┐
│   Caddy     │ ← Only exposed service
└──────┬──────┘
       │ app-net (internal)
       ├─────────────┬─────────────┬─────────────┐
       ▼             ▼             ▼             ▼
  ┌────────┐   ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  web   │   │pitboss   │  │sentinel  │  │ postgres │
  │ :80    │   │api :8080 │  │   :8000  │  │  :5432   │
  └────────┘   └──────────┘  └──────────┘  └──────────┘
```

---

## Security Features

- ✅ Automatic HTTPS (Let's Encrypt)
- ✅ SSL termination at Caddy
- ✅ HSTS headers
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ Internal network isolation
- ✅ No direct service exposure
- ✅ Gzip compression

---

## Common Commands

```bash
# View Caddy logs
docker compose -f infra/compose/prod-caddy.yml logs -f caddy

# Check SSL certificate status
docker compose -f infra/compose/prod-caddy.yml exec caddy \
  caddy list-certificates

# Reload Caddy config (no downtime)
docker compose -f infra/compose/prod-caddy.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile

# Health check all services
docker compose -f infra/compose/prod-caddy.yml ps

# Restart a single service
docker compose -f infra/compose/prod-caddy.yml restart pitboss-api
```

---

## Troubleshooting

### SSL Certificate Issues
```bash
# Check Caddy logs
docker compose -f infra/compose/prod-caddy.yml logs caddy

# Ensure DNS points to server
dig moshsplit.example.com

# Check ports 80/443 are open
nc -zv moshsplit.example.com 80
nc -zv moshsplit.example.com 443
```

### Service Communication
```bash
# Test internal connectivity from Caddy
docker compose -f infra/compose/prod-caddy.yml exec caddy \
  wget -qO- pitboss-api:8080/health

# Check service health
docker compose -f infra/compose/prod-caddy.yml ps
```

### CORS Errors
- Ensure frontend uses relative URLs (`/pitboss/` not full URL)
- Check CORS_ALLOWED_ORIGINS includes your domain
