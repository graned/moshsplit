# MoshSplit Caddy Network Architecture

## Overview

This document describes the network architecture for MoshSplit production deployment using Caddy as the reverse proxy.

## Architecture Diagram

```
                                    ┌─────────────────────────────────────────┐
                                    │           Public Internet               │
                                    └─────────────────┬───────────────────────┘
                                                      │
                                                      │ HTTPS (443)
                                                      │ HTTP  (80)
                                                      ▼
                                    ┌─────────────────────────────────────────┐
                                    │         Caddy Reverse Proxy            │
                                    │  - Automatic HTTPS (Let's Encrypt)     │
                                    │  - SSL Termination                     │
                                    │  - Path-based Routing                  │
                                    │  - Security Headers                    │
                                    └─────────────────┬───────────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
        ┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
        │    /auth/* routes     │         │   /pitboss/* routes   │         │  /moshsplit/* routes  │
        └───────────┬───────────┘         └───────────┬───────────┘         └───────────┬───────────┘
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
        ┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
        │     sentinel-ui       │         │     pitboss-api       │         │         web           │
        │   (nginx, port 80)    │         │   (Rust/Axum, 8080)   │         │   (nginx, port 80)    │
        └───────────┬───────────┘         └───────────┬───────────┘         └───────────┬───────────┘
                    │                                 │                                 │
                    └─────────────────────────────────┼─────────────────────────────────┘
                                                      │
                                                      ▼
                                    ┌─────────────────────────────────────────┐
                                    │         Internal App Network            │
                                    │         (Docker bridge network)         │
                                    └─────────────────┬───────────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
        ┌───────────────────────┐         ┌───────────────────────┐         ┌───────────────────────┐
        │       sentinel        │         │   sentinel-migrations │         │       postgres        │
        │   (auth service)      │         │   (one-time runner)   │         │   (port 5432)         │
        └───────────────────────┘         └───────────────────────┘         └───────────────────────┘
```

## Network Segments

### 1. External Network (Public)
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Exposed Service**: Caddy only
- **Purpose**: Public-facing traffic, SSL termination

### 2. Proxy Network (`proxy-net`)
- **Type**: Docker bridge network
- **Members**: Caddy
- **Purpose**: Caddy's external-facing network interface

### 3. Application Network (`app-net`)
- **Type**: Docker bridge network
- **Members**: All internal services (pitboss-api, sentinel, sentinel-ui, web, postgres)
- **Purpose**: Internal service-to-service communication
- **Security**: No direct external access

## Service Communication Flow

### Request Flow Example: User accesses Web Frontend

```
1. User Browser
   └─> HTTPS request to https://moshsplit.example.com/moshsplit/

2. Caddy (SSL Termination)
   ├─> Validates SSL certificate
   ├─> Matches route /moshsplit/*
   └─> Strips prefix, forwards to web:80

3. Web (React PWA)
   └─> Serves static files

4. Frontend makes API call
   └─> Request to /pitboss/api/expenses

5. Caddy (API Routing)
   ├─> Matches route /pitboss/*
   ├─> Strips prefix, forwards to pitboss-api:8080
   └─> Adds X-Forwarded-* headers

6. Pitboss API
   ├─> Processes request
   └─> May query postgres or sentinel

7. Response flows back through Caddy to user
```

## Port Mapping

| Service | Internal Port | External Port | Accessed Via |
|---------|--------------|---------------|--------------|
| Caddy | 80, 443 | 80, 443 | Direct |
| Web | 80 | - | Caddy (/moshsplit/*) |
| Pitboss API | 8080 | - | Caddy (/pitboss/*) |
| Sentinel | 8000 | - | Caddy (/sentinel/*) |
| Sentinel UI | 80 | - | Caddy (/auth/*) |
| PostgreSQL | 5432 | - | Internal only |

## URL Routing Table

| URL Path | Target Service | Internal URL | Notes |
|----------|---------------|--------------|-------|
| `/` | Redirect | - | Redirects to /moshsplit/ |
| `/moshsplit/*` | Web Frontend | `web:80` | React PWA |
| `/pitboss/*` | Pitboss API | `pitboss-api:8080` | REST API |
| `/sentinel/*` | Sentinel API | `sentinel:8000` | Auth endpoints |
| `/auth/*` | Sentinel UI | `sentinel-ui:80` | Admin dashboard |

## Security Considerations

### 1. Network Isolation
- Only Caddy is exposed to the public internet
- All internal services communicate via Docker's internal DNS
- PostgreSQL is never directly accessible from outside

### 2. SSL/TLS
- Caddy automatically obtains and renews Let's Encrypt certificates
- All external traffic is encrypted
- HSTS headers enforce HTTPS

### 3. Headers
Caddy adds security headers to all responses:
- `X-Frame-Options: SAMEORIGIN` - Clickjacking protection
- `X-Content-Type-Options: nosniff` - MIME sniffing prevention
- `Strict-Transport-Security` - HSTS
- `Content-Security-Policy` - XSS protection

### 4. CORS
With Caddy proxying all services under the same origin:
- No CORS issues in production (same-origin policy)
- CORS only needed for local development

## Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `MOSHSPLIT_URL` | Public domain | `moshsplit.example.com` |
| `DATABASE_URL` | PostgreSQL connection | `postgres://...` |
| `POSTGRES_PASSWORD` | Database password | (secure random) |
| `HEX_KEY` | Sentinel encryption key | 64-char hex |
| `CONFIG_ENCRYPTION_KEY` | Sentinel config key | 64-char hex |
| `SENTINEL_PUBLIC_KEY` | Sentinel public key | (from Sentinel) |

### Caddy Volumes
| Volume | Purpose |
|--------|---------|
| `caddy_data` | SSL certificates, ACME account |
| `caddy_config` | Caddy configuration state |
| `caddy_logs` | Access and error logs |

## Deployment Commands

```bash
# 1. Configure environment
cp infra/compose/.env.example.caddy .env
# Edit .env with your values

# 2. Start all services
docker compose -f infra/compose/prod-caddy.yml up -d

# 3. Check status
docker compose -f infra/compose/prod-caddy.yml ps

# 4. View Caddy logs
docker compose -f infra/compose/prod-caddy.yml logs -f caddy

# 5. Verify SSL certificate
curl -I https://moshsplit.example.com/
```

## Troubleshooting

### Caddy won't obtain certificates
- Ensure DNS points to the server
- Check port 80/443 are not blocked by firewall
- Review Caddy logs: `docker compose logs caddy`

### Services can't communicate
- Verify all services are on `app-net`
- Check service health: `docker compose ps`
- Test internal connectivity: `docker compose exec caddy wget pitboss-api:8080/health`

### CORS errors in browser
- Ensure frontend uses relative URLs (`/pitboss/` not `http://localhost:8080/`)
- Check Caddy routing is stripping prefixes correctly
