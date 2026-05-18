# MoshSplit Caddy Migration Guide

## Summary of Required Changes

This document outlines the changes needed to integrate Caddy reverse proxy into MoshSplit production deployment.

---

## 1. Frontend (Web) Changes

### Current Configuration
```env
VITE_API_BASE_URL=http://pitboss-api:8080
VITE_SENTINEL_URL=http://sentinel:8000
```

### Required Changes
```env
VITE_API_BASE_URL=/pitboss
VITE_SENTINEL_URL=/sentinel
```

### Why?
- With Caddy, all services are same-origin (no CORS issues)
- Relative paths allow Caddy to route requests appropriately
- Works in both production (Caddy) and development (Vite proxy)

### Files to Update
1. **apps/web/.env.production** (if exists)
2. **infra/docker/web.Dockerfile** - Update default values
3. **infra/compose/.env.example** - Update example values

### Vite Development Proxy
Ensure `apps/web/vite.config.ts` has proxy configuration for local development:

```typescript
// vite.config.ts
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/pitboss': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/sentinel': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 2. Pitboss API Changes

### Current Configuration
```env
CORS_ALLOWED_ORIGINS=http://localhost:80,http://localhost:5173
```

### Required Changes
```env
CORS_ALLOWED_ORIGINS=https://${MOSHSPLIT_URL},http://localhost:80,http://localhost:5173
```

### Why?
- In production, all requests come from the same origin (Caddy domain)
- Keep localhost origins for development
- Caddy handles the routing, so CORS is only needed for direct API access

### Files to Update
1. **infra/compose/prod-caddy.yml** - Already updated
2. **apps/pitboss-api/src/config.rs** (or similar) - Ensure CORS config reads env var

---

## 3. Sentinel Configuration Changes

### Current Configuration
```env
OIDC_ISSUER_URL=http://localhost:9000
FRONTEND_URL=http://localhost:80
CORS_ALLOWED_ORIGINS=http://localhost:80,http://localhost:5173
```

### Required Changes
```env
OIDC_ISSUER_URL=https://${MOSHSPLIT_URL}/sentinel
FRONTEND_URL=https://${MOSHSPLIT_URL}/moshsplit
CORS_ALLOWED_ORIGINS=https://${MOSHSPLIT_URL},http://localhost:80,http://localhost:5173
```

### Why?
- OIDC issuer must match the public URL for token validation
- Frontend URL used for auth redirects
- CORS aligned with production domain

### Files to Update
1. **infra/compose/prod-caddy.yml** - Already updated
2. **infra/compose/.env.example** - Document the change

---

## 4. Sentinel UI Configuration

### Current Configuration
```nginx
# sentinel-ui-nginx.conf
location /v1/ {
    proxy_pass http://sentinel:8000;
}
```

### Required Changes
**None** - The existing nginx config works correctly because:
- Sentinel UI is container-internal only
- Caddy handles the external routing
- Internal proxy to Sentinel remains the same

---

## 5. Docker Compose Changes

### Ports - Before vs After

| Service | Before (prod-ghcr.yml) | After (prod-caddy.yml) |
|---------|----------------------|----------------------|
| Caddy | N/A | 80:80, 443:443 |
| Web | 80:80 | (none) |
| Pitboss API | 8080:8080 | (none) |
| Sentinel | 9000:8000 | (none) |
| Sentinel UI | 3000:80 | (none) |
| PostgreSQL | 5432:5432 | (none) |

### Networks - Before vs After

| Network | Before | After |
|---------|--------|-------|
| app-net | All services | All services except Caddy |
| proxy-net | N/A | Caddy only |

---

## 6. Migration Checklist

### Pre-Migration
- [ ] Backup current production data
- [ ] Test Caddy configuration in staging
- [ ] Update DNS records (if changing domains)
- [ ] Generate SSL certificate test with staging ACME

### Migration Steps
1. **Update Environment**
   ```bash
   cp infra/compose/.env.example.caddy .env
   # Edit MOSHSPLIT_URL and other values
   ```

2. **Rebuild Frontend** (if needed)
   ```bash
   # Frontend needs rebuild with new VITE_* values
   docker compose -f infra/compose/prod-caddy.yml build web
   ```

3. **Deploy New Compose File**
   ```bash
   docker compose -f infra/compose/prod-caddy.yml up -d
   ```

4. **Verify Services**
   ```bash
   # Check all services are healthy
   docker compose -f infra/compose/prod-caddy.yml ps
   
   # Check Caddy obtained SSL certificate
   docker compose -f infra/compose/prod-caddy.yml logs caddy
   
   # Test endpoints
   curl -I https://moshsplit.example.com/
   curl -I https://moshsplit.example.com/pitboss/health
   ```

5. **Update Sentinel Public Key** (if needed)
   - Access Sentinel UI at https://moshsplit.example.com/auth/
   - Get the new public key
   - Update SENTINEL_PUBLIC_KEY in .env
   - Restart pitboss-api

### Post-Migration
- [ ] Verify all routes work (/moshsplit/, /pitboss/, /auth/, /sentinel/)
- [ ] Test authentication flow
- [ ] Check SSL certificate is valid
- [ ] Monitor logs for errors
- [ ] Update documentation with new URLs

---

## 7. Development vs Production

### Development (dev.yml)
- Direct port access (no Caddy)
- Hot reload enabled
- HTTP only
- CORS from multiple origins

### Production (prod-caddy.yml)
- Caddy reverse proxy only
- Static builds
- HTTPS enforced
- Same-origin (no CORS issues)

---

## 8. Rollback Plan

If issues occur after migration:

```bash
# 1. Stop new deployment
docker compose -f infra/compose/prod-caddy.yml down

# 2. Start old deployment
docker compose -f infra/compose/prod-ghcr.yml up -d

# 3. Or restore from backup
# (depends on your backup strategy)
```

---

## 9. Testing Checklist

### Functional Tests
- [ ] Home page loads at `/moshsplit/`
- [ ] API calls work at `/pitboss/health`
- [ ] Auth flow works via `/sentinel/`
- [ ] Sentinel UI accessible at `/auth/`
- [ ] Redirect from `/` to `/moshsplit/` works

### Security Tests
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] No direct access to internal services

### Performance Tests
- [ ] Response times acceptable
- [ ] Static assets cached correctly
- [ ] Gzip compression enabled
