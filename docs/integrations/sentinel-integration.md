# Sentinel Auth Integration Guide

This document provides comprehensive documentation for integrating Sentinel authentication with MoshSplit's Rust backend services (specifically `pitboss-api` / Axum).

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Package Setup (sentinel-client)](#package-setup-sentinel-client)
4. [Axum Middleware Integration](#axum-middleware-integration)
5. [Protected vs Public Routes](#protected-vs-public-routes)
6. [Docker Compose Configuration](#docker-compose-configuration)
   - [Service Overview](#service-overview)
   - [Service Dependencies](#service-dependencies)
   - [Full Configuration](#full-configuration)
   - [Key Services](#key-services)
   - [Database Initialization Scripts](#database-initialization-scripts)
7. [Environment Variables](#environment-variables)
8. [Database Schema Design](#database-schema-design)
9. [Frontend Integration (sentinel-auth-react)](#frontend-integration-sentinel-auth-react)
   - [Package Overview](#package-overview)
   - [Provider Setup](#provider-setup)
   - [Theme Customization](#theme-customization)
   - [Auth Flow Details](#auth-flow-details)
   - [API Endpoints Reference](#api-endpoints-reference)
   - [Database Schema](#database-schema)
   - [Known Issues](#known-issues)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

To set up the complete development environment with Sentinel authentication:

```bash
# 1. Navigate to the compose directory
cd infra/compose

# 2. Start all services
docker compose -f dev.yml up -d

# 3. Verify all services are running
docker compose -f dev.yml ps

# 4. Check service health
# - PostgreSQL:     docker compose exec postgres pg_isready
# - Sentinel:      curl http://localhost:9000/v1/api/system/health
# - pitboss-api:   curl http://localhost:8080/health
# - Web:           http://localhost:5173
# - Sentinel UI:   http://localhost:3000

# 5. View logs
docker compose -f dev.yml logs -f
```

**Access URLs**:

| Service | URL | Description |
|---------|-----|-------------|
| Web (React) | http://localhost:5173 | Main application |
| Sentinel UI | http://localhost:3000 | Auth management dashboard |
| pitboss-api | http://localhost:8080 | API backend |
| Sentinel API | http://localhost:9000 | Auth service |
| PostgreSQL | localhost:5432 | Database |

**Reset the environment**:

```bash
# Stop and remove volumes (resets databases)
docker compose -f dev.yml down -v

# Rebuild specific service
docker compose -f dev.yml build pitboss-api
docker compose -f dev.yml up -d pitboss-api
```

---

## Architecture Overview

### System Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│  pitboss-api │─────▶│  PostgreSQL     │
│   (React)   │      │   (Axum)     │      │  (moshsplit)    │
└─────────────┘      └──────────────┘      │  - app schema   │
                            │              └─────────────────┘
                            │ Token Validation
                            ▼              ┌─────────────────┐
                      ┌──────────────┐      │  PostgreSQL     │
                      │   Sentinel   │─────▶│  (sentinel_auth)│
                      │   (Auth)     │      │  - public schema│
                      └──────────────┘      └─────────────────┘
                            │
                            ▼
                      ┌──────────────┐
                      │ Sentinel UI  │
                      │  (Dashboard) │
                      └──────────────┘
```

### Authentication Flow

1. **User Login**: Frontend authenticates with Sentinel using credentials
2. **Token Reception**: Sentinel returns JWT access token to frontend
3. **API Requests**: Frontend includes token in `Authorization: Bearer <token>` header
4. **Token Validation**: `pitboss-api` validates token with Sentinel on each protected request
5. **Request Processing**: Valid requests proceed with authenticated user context

---

## Package Setup (sentinel-client)

### Overview

The `sentinel-client` package (`packages/sentinel-client/`) provides a Rust SDK for communicating with the Sentinel Auth service. It includes:

- **`SentinelClient`**: HTTP client for Sentinel API communication
- **`AuthMiddleware`**: Axum middleware for protecting routes
- **`AuthenticatedUser`**: User data extracted from validated tokens
- **Error types**: Comprehensive error hierarchy matching the TypeScript SDK

### Adding to Your Project

Add to your `Cargo.toml`:

```toml
[dependencies]
sentinel-client = { path = "../../packages/sentinel-client" }
```

### Key Types and Usage

#### SentinelClient

```rust
use sentinel_client::{SentinelClient, SentinelConfig};

// Create client with custom URL
let config = SentinelConfig::new("http://localhost:9000")
    .with_timeout(5000); // 5 second timeout
let client = SentinelClient::new(config)?;

// Or use default (localhost:9000)
let client = SentinelClient::default()?;
```

#### Token Validation

```rust
// Validate a token and get user info
match client.authenticate("Bearer <token>").await {
    Ok(user) => {
        println!("Authenticated: {} ({})", user.email, user.user_id);
        // Access roles and permissions
        for role in &user.roles {
            println!("  Role: {}", role);
        }
    }
    Err(e) => {
        eprintln!("Auth failed: {}", e);
    }
}
```

---

## Axum Middleware Integration

### Middleware Architecture

The `AuthMiddleware` validates Bearer tokens and stores the authenticated user in request extensions:

```rust
use sentinel_client::{AuthMiddleware, SentinelClient, SentinelConfig};

let sentinel_client = SentinelClient::new(SentinelConfig::default())?;
let auth_middleware = AuthMiddleware::new(sentinel_client);
```

### Integration with pitboss-api

The middleware is integrated in `api_router.rs`:

```rust
// Create Sentinel auth middleware using the client from app state
let sentinel_client = state.sentinel_client.clone();
let auth_middleware = Arc::new(AuthMiddleware::new(sentinel_client));

// Apply auth middleware to all protected routes
let protected_routes = protected_api.layer(middleware::from_fn(move |req, next| {
    let auth = auth_middleware.clone();
    async move { auth.authenticate(req, next).await }
}));
```

### Extracting Current User

Use the `CurrentUser` extractor in your handlers:

```rust
use crate::infrastructure::http::api::extractors::CurrentUser;

async fn my_handler(current_user: CurrentUser) -> Result<Json<Response>, ApiError> {
    let user_id = current_user.0;
    // Use user_id for authorization
}
```

The extractor returns `ApiError::unauthorized()` if no authenticated user is found (which should only happen for public routes).

### Optional Authentication

For routes that may or may not require authentication:

```rust
use crate::infrastructure::http::api::extractors::OptionalCurrentUser;

async fn handler(user: OptionalCurrentUser) {
    match user.0 {
        Some(user_id) => println!("Authenticated user: {}", user_id),
        None => println!("Anonymous access"),
    }
}
```

---

## Protected vs Public Routes

### Route Classification

```rust
// Public routes (no auth required)
let public_routes = Router::new()
    .route("/health", get(system_handlers::health_check))
    .route("/livez", get(system_handlers::livez));

// Protected routes (require Sentinel auth)
let protected_api = event_routes
    .merge(member_routes)
    .merge(expense_routes)
    // ... other protected routes
    .layer(middleware::from_fn(|req, next| {
        // Auth middleware here
    }));
```

### Middleware Stack Order

The middleware order (outermost to innermost) in `api_router.rs`:

1. **CorsLayer** - Handles CORS for frontend access
2. **AuthMiddleware** - Validates Sentinel tokens (protects `/v1/*`)
3. **RequestId middleware** - Injects `X-Request-Id` into extensions
4. **CatchPanicLayer** - Catches panics and returns 500
5. **TraceLayer** - Request/response logging
6. **ResponseWrapper** - Wraps responses in `ApiResponse` envelope

### URL Patterns

| Pattern | Auth Required | Purpose |
|---------|---------------|---------|
| `/health` | No | Health check |
| `/livez` | No | Liveness probe |
| `/v1/events` | Yes | Event CRUD |
| `/v1/events/{id}/members` | Yes | Member management |
| `/v1/events/{id}/expenses` | Yes | Expense tracking |
| `/v1/events/{id}/payments` | Yes | Payment recording |
| `/v1/events/{id}/settlements` | Yes | Settlement proposals |
| `/v1/events/{id}/balances` | Yes | Balance calculations |

---

## Docker Compose Configuration

### Development Setup (`infra/compose/dev.yml`)

The development environment uses a multi-service Docker Compose setup with hot-reloading for `pitboss-api` and `web`.

#### Service Overview

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `sentinel-migrations` | Custom build | — | Runs Sentinel schema migrations |
| `sentinel` | ghcr.io/graned/sentinel-core:v1.1.0 | 9000 (external) → 8000 (internal) | Authentication service |
| `sentinel-ui` | ghcr.io/graned/sentinel-ui:v1.1.0 | 3000 | Sentinel dashboard |
| `pitboss-api` | Custom build | 8080 | MoshSplit API |
| `web` | Custom build | 5173 | React PWA frontend |

#### Service Dependencies

```
postgres (healthy)
    │
    ├─► sentinel-migrations ──► sentinel (started) ──► sentinel-ui (healthy)
    │
    ├─► pitboss-api-migrations ──► pitboss-api (started)
    │
    └─► web (started)
```

The startup order ensures:
1. PostgreSQL is healthy before any service connects
2. `sentinel-migrations` completes before `sentinel` starts
3. `sentinel` is running before `sentinel-ui` becomes healthy
4. `pitboss-api` waits for both migrations and Sentinel
5. `web` starts after `pitboss-api` is running

#### Healthcheck Configurations

| Service | Endpoint | Interval | Timeout | Retries | Start Period |
|---------|----------|----------|---------|---------|--------------|
| `postgres` | `pg_isready -U postgres` | 5s | 5s | 5 | — |
| `sentinel` | `http://localhost:8000/v1/api/system/health` | 10s | 5s | 5 | 30s |
| `sentinel-ui` | Relies on sentinel health | — | — | — | — |
| `pitboss-api` | `http://localhost:8080/health` | — | — | — | — |

**Notes**:
- `sentinel-ui` doesn't have its own healthcheck — it depends on `sentinel` being healthy
- `pitboss-api` doesn't have a Docker healthcheck in dev mode; use `curl http://localhost:8080/health` manually
- The `start_period` of 30s for Sentinel accounts for database connection time on first boot

#### Full Configuration

```yaml
services:

  # ── PostgreSQL ──────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: moshsplit-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: moshsplit
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d
    networks:
      - app-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ── pitboss-api migrations ─────────────────────────────────────────────────
  pitboss-api-migrations:
    build:
      context: ../../
      dockerfile: infra/docker/pitboss-api.Dockerfile
      target: dev
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/moshsplit
    command: ["cargo", "run", "--manifest-path", "/app/apps/pitboss-api/Cargo.toml", "--", "--migrate"]
    depends_on:
      postgres:
        condition: service_healthy

  # ── pitboss-api (Rust / Axum) ──────────────────────────────────────────────
  pitboss-api:
    build:
      context: ../../
      dockerfile: infra/docker/pitboss-api.Dockerfile
      target: dev
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://pitboss:password@postgres:5432/moshsplit
      PGOPTIONS: "-c search_path=app"
      RUST_LOG: debug
      SENTINEL_URL: http://sentinel:8000
    depends_on:
      pitboss-api-migrations:
        condition: service_completed_successfully
      sentinel:
        condition: service_started

  # ── Sentinel migrations ─────────────────────────────────────────────────────
  sentinel-migrations:
    build:
      context: ../../
      dockerfile: infra/docker/sentinel-migrate.Dockerfile
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/sentinel_auth
      PGOPTIONS: "-c search_path=public"
    depends_on:
      postgres:
        condition: service_healthy

  # ── Sentinel (auth service) ─────────────────────────────────────────────────
  sentinel:
    image: ghcr.io/graned/sentinel-core:v1.1.0
    container_name: moshsplit-sentinel
    ports:
      - "9000:8000"
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/sentinel_auth
      HEX_KEY: 32a8c0fc962ce0299e8f5dedb1ff75b7e8789416db8f6836fb91c6e7bd2e58fe
      CONFIG_ENCRYPTION_KEY: 02b96ece27c893f176d52139c17ef97db53283a3b0a75e185c2a9da7c1855db5
      RUST_LOG: debug
      OIDC_ISSUER_URL: http://localhost:9000
      FRONTEND_URL: http://localhost:5173
      CORS_ALLOWED_ORIGINS: http://localhost:5173,http://localhost:3000
      APP_HOST: 0.0.0.0
      APP_PORT: "8000"
    depends_on:
      sentinel-migrations:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "--fail", "http://localhost:8000/v1/api/system/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ── Sentinel UI (management dashboard) ──────────────────────────────────────
  sentinel-ui:
    image: ghcr.io/graned/sentinel-ui:v1.1.0
    container_name: moshsplit-sentinel-ui
    ports:
      - "3000:80"
    volumes:
      - ../../infra/docker/sentinel-ui-nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      sentinel:
        condition: service_healthy

  # ── Web (React PWA / Vite) ─────────────────────────────────────────────────
  web:
    build:
      context: ../../
      dockerfile: infra/docker/web.Dockerfile
      target: dev
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://pitboss-api:8080
      VITE_SENTINEL_URL: http://sentinel:8000
    depends_on:
      pitboss-api:
        condition: service_started

volumes:
  pgdata:

networks:
  app-net:
    driver: bridge
```

### Key Services

#### postgres

The PostgreSQL database container that stores both application data and Sentinel authentication data:

- **Database**: Single PostgreSQL instance with two databases: `moshsplit` (app) and `sentinel_auth` (auth)
- **Init Scripts**: Runs SQL scripts from `./init` directory on first start to create schemas and roles
- **Healthcheck**: Uses `pg_isready` to verify database is accepting connections

#### sentinel-migrations

Runs Diesel migrations to create Sentinel tables in the `sentinel_auth` database before Sentinel starts:

- Connects to `sentinel_auth` database with `search_path=public`
- Creates the `auth` schema and all Sentinel tables
- Runs as a one-time job that exits on completion
- Must complete successfully before `sentinel` starts

#### sentinel (sentinel-core)

The core auth service providing:

- User registration and login
- JWT token issuance and validation
- Role and permission management

Important configuration:

- **Port mapping**: Exposes internal port 8000 as external port 9000 (so `http://localhost:9000` works)
- **Database**: Connects to `sentinel_auth` database
- **Healthcheck**: Polls `/v1/api/system/health` every 10 seconds

#### sentinel-ui

Management dashboard for Sentinel. Uses Nginx to proxy API calls to sentinel-core:

```nginx
location /v1/ {
    proxy_pass http://sentinel:8000;
    # ... headers
}
```

#### pitboss-api

Your MoshSplit backend API that validates tokens against Sentinel:

- Connects to `moshsplit` database with `search_path=app`
- Uses `search_path=app` to access application tables
- Validates tokens with Sentinel at `http://sentinel:8000`

#### web

React PWA frontend with Vite hot module replacement:

- Connects to `pitboss-api` at `http://pitboss-api:8080`
- Development proxies are configured in Vite for `/api/*` requests

### Database Initialization Scripts

The `infra/compose/init/` directory contains SQL scripts that run automatically when PostgreSQL first starts (via `docker-entrypoint-initdb.d`).

#### `01-init-schemas.sql`

This script runs first and performs the following:

1. **Creates roles** (idempotent):
   - `pitboss` — used by pitboss-api (password: `password`)
   - `sentinel` — used by Sentinel auth service (password: `sentinel_dev`)

2. **Creates schemas**:
   - `auth` — for Sentinel authentication tables
   - `app` — for MoshSplit application tables

3. **Grants permissions**:
   - Full access on `auth` schema to `sentinel` role
   - Full access on `app` schema to `pitboss` role
   - Default privileges for future objects

4. **Sets search paths**:
   - `sentinel` role: `search_path = auth`
   - `pitboss` role: `search_path = app, public`
   - `postgres` role: `search_path = app, auth, public`

5. **Creates sentinel_auth database**:
   ```sql
   SELECT 'CREATE DATABASE sentinel_auth' WHERE NOT EXISTS (...) \gexec
   ```

#### `02-create-databases.sql`

This script ensures both databases exist:
- `moshsplit` — main application database
- `sentinel_auth` — dedicated database for Sentinel

#### How They Work Together

```
PostgreSQL container starts
    │
    ├─► Runs 01-init-schemas.sql
    │       - Creates roles and schemas
    │       - Sets up permissions
    │       - Creates sentinel_auth DB
    │
    ├─► Runs 02-create-databases.sql
    │       - Ensures both DBs exist
    │
    └─► Container ready!
            │
            ├─► sentinel-migrations connects to sentinel_auth
            │       └─► Creates auth schema tables
            │
            └─► pitboss-api-migrations connects to moshsplit
                    └─► Creates app schema tables
```

> **Note**: These scripts only run on the **first** start of the PostgreSQL container. To re-run them, you must remove the volume: `docker compose down -v`

---

## Environment Variables

### postgres

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database superuser | `postgres` |
| `POSTGRES_PASSWORD` | Superuser password | `password` |
| `POSTGRES_DB` | Default database | `moshsplit` |

### pitboss-api

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string for moshsplit DB | `postgres://pitboss:password@postgres:5432/moshsplit` |
| `PGOPTIONS` | PostgreSQL session options | `-c search_path=app` |
| `SENTINEL_URL` | Sentinel API URL (internal) | `http://sentinel:8000` |
| `RUST_LOG` | Log level | `debug`, `info` |

### sentinel

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string for sentinel_auth DB | `postgres://postgres:password@postgres:5432/sentinel_auth` |
| `HEX_KEY` | Encryption key for internal secrets (32-byte hex) | `32a8c0fc962ce0299e8f5dedb1ff75b7e8789416db8f6836fb91c6e7bd2e58fe` |
| `CONFIG_ENCRYPTION_KEY` | Configuration encryption key (32-byte hex) | `02b96ece27c893f176d52139c17ef97db53283a3b0a75e185c2a9da7c1855db5` |
| `OIDC_ISSUER_URL` | OIDC issuer URL (for token validation) | `http://localhost:9000` |
| `FRONTEND_URL` | Frontend origin for redirects | `http://localhost:5173` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `http://localhost:5173,http://localhost:3000` |
| `APP_HOST` | Server bind host | `0.0.0.0` |
| `APP_PORT` | Server bind port | `8000` |
| `RUST_LOG` | Log level | `debug`, `info` |

### sentinel-ui

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Sentinel API URL (baked into JS bundle at build time) | `http://localhost:9000` |

> **Note**: The sentinel-ui uses a pre-built image that expects Sentinel at `http://localhost:9000`. The Nginx config proxies `/v1/*` requests to `http://sentinel:8000` (internal Sentinel port). For production, rebuild the image with custom `VITE_API_URL`.

### web

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | pitboss-api URL for frontend | `http://pitboss-api:8080` |
| `VITE_SENTINEL_URL` | Sentinel URL (for auth compatibility) | `http://sentinel:8000` |

> **Note**: `VITE_*` variables are prefixed because Vite embeds them at build time. They are not available at runtime.

---

## Database Schema Design

### Why Separate Database?

We use a **separate `sentinel_auth` database** rather than sharing the `moshsplit` database with the application. This approach was determined after encountering issues with the pre-built Sentinel binary, which:

1. Does not run migrations automatically
2. Expects tables in the `public` schema (not a custom schema)
3. Requires manual migration execution before service startup

### Database Separation

| Database | Schema | Owner | Purpose |
|----------|--------|-------|---------|
| `moshsplit` | `app` | pitboss | Application data (events, expenses, etc.) |
| `sentinel_auth` | `public` | postgres | Sentinel authentication tables |

### Migration Service

The `sentinel-migrations` service runs Diesel migrations against the `sentinel_auth` database:

```dockerfile
# sentinel-migrate.Dockerfile
# Clone Sentinel repo to get migrations
RUN git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel && \
    cp -r /tmp/sentinel/apps/sentinel-core/migrations /tmp/sentinel_migrations

# Use default public schema (what Sentinel expects)
CMD ["sh", "-c", "PGOPTIONS='-c search_path=public' diesel migration run"]
```

The migration service:
1. Clones the Sentinel repository to access migration scripts
2. Runs Diesel migrations against the `public` schema in `sentinel_auth`
3. Uses `PGOPTIONS="-c search_path=public"` to ensure correct schema targeting
4. Exits (one-time job - does not stay running)

### Connection Configuration

Sentinel connects to the dedicated `sentinel_auth` database (uses default `public` schema):

```yaml
sentinel:
  environment:
    DATABASE_URL: postgres://postgres:password@postgres:5432/sentinel_auth
    # No PGOPTIONS needed - public is the default schema
```

pitboss-api connects to `moshsplit` with its own schema:

```yaml
pitboss-api:
  environment:
    DATABASE_URL: postgres://pitboss:password@postgres:5432/moshsplit
    PGOPTIONS: "-c search_path=app"
```

### Initialization Scripts

The init scripts (`01-init-schemas.sql` and `02-create-databases.sql`) set up:

1. **Roles**: Create `pitboss` and `sentinel` users with appropriate passwords
2. **Schemas**: Create `app` schema in `moshsplit` database (for pitboss-api)
3. **Databases**: Create `sentinel_auth` database for Sentinel
4. **Permissions**: Grant appropriate access to each role

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused to Sentinel

**Symptom**: `SentinelError::Network(...)` - connection refused

**Causes**:
- Sentinel not running
- Wrong `SENTINEL_URL`
- Network connectivity issues

**Solutions**:
```bash
# Check Sentinel is running
docker compose ps

# Check Sentinel health
curl http://localhost:9000/v1/api/system/health

# Verify URL in pitboss-api logs
```

#### 2. Invalid Token

**Symptom**: `SentinelError::Api { code: InvalidToken, ... }`

**Causes**:
- Malformed token
- Token not issued by this Sentinel instance
- Token was revoked

**Solutions**:
- Frontend should obtain fresh token via login
- Check token format (should be JWT)
- Verify `OIDC_ISSUER_URL` matches

#### 3. 401 on Protected Routes

**Symptom**: All `/v1/*` routes return 401

**Causes**:
- Missing `Authorization` header
- Middleware not applied correctly

**Solutions**:
- Ensure request includes `Authorization: Bearer <token>`
- Check middleware is applied to protected router
- Verify `AuthMiddleware` is properly constructed

#### 4. CORS Errors

**Symptom**: CORS policy errors in browser console

**Solutions**:
```rust
// In router configuration
.layer(CorsLayer::permit_all())  // development
// or configure specific origins
.layer(CorsLayer::new()
    .allow_origin("http://localhost:5173")
    .allow_methods(...)
    .allow_headers(...))
```

#### 5. Database Schema Errors

**Symptom**: `relation "users" does not exist` for Sentinel

**Causes**:
- Migrations not run
- Wrong database (connecting to `moshsplit` instead of `sentinel_auth`)

**Solutions**:
```bash
# Verify sentinel_auth database exists
psql -l | grep sentinel_auth

# Check tables in sentinel_auth database
psql -d sentinel_auth -c "\dt"

# Verify sentinel-migrations ran successfully
docker compose logs sentinel-migrations
```

#### 6. Pre-built Sentinel Image Doesn't Run Migrations

**Symptom**: Sentinel starts but tables don't exist, or "relation does not exist" errors

**Root Cause**: The pre-built Sentinel binary (`ghcr.io/graned/sentinel-core:v1.1.0`) does **not** automatically run database migrations. This is a known limitation of the pre-built image.

**Solution**: The `sentinel-migrations` service must run BEFORE Sentinel starts:

```yaml
# docker-compose.yml ensures proper ordering
sentinel-migrations:
  build:
    dockerfile: infra/docker/sentinel-migrate.Dockerfile
  depends_on:
    postgres:
      condition: service_healthy

sentinel:
  image: ghcr.io/graned/sentinel-core:v1.1.0
  depends_on:
    sentinel-migrations:
      condition: service_completed_successfully  # Critical!
```

**Debugging**:
```bash
# Check sentinel-migrations completed successfully
docker compose ps sentinel-migrations

# Re-run migrations manually if needed
docker compose up sentinel-migrations
docker compose up -d sentinel  # restart sentinel after migrations
```

### Debugging Tips

1. **Enable debug logging**:
   ```yaml
   environment:
     RUST_LOG: debug
   ```

2. **Check Sentinel logs**:
   ```bash
   docker compose logs sentinel
   ```

3. **Test authentication manually**:
   ```bash
   # Login to get token
   curl -X POST http://localhost:9000/v1/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "..."}'

   # Validate token
   curl http://localhost:9000/v1/api/auth/authenticate \
     -H "Authorization: Bearer <token>"
   ```

4. **Verify database connections**:
   ```bash
   # List active connections
   psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'moshsplit';"
   ```

### Health Check Endpoints

| Service | Endpoint |
|---------|----------|
| pitboss-api | `GET /health` |
| pitboss-api (live) | `GET /livez` |
| Sentinel | `GET /v1/api/system/health` |

---

## Frontend Integration (sentinel-auth-react)

### Package Overview

MoshSplit uses `@moshsplit/sentinel-auth-react` — a React component library providing pre-built authentication pages with MoshSplit branding theming.

### Installation

```bash
cd apps/web
npm install @moshsplit/sentinel-auth-react @moshsplit/sentinel-sdk
```

### Provider Setup

Wrap your application with `SentinelAuthProvider` in your router configuration:

```tsx
// apps/web/src/App.tsx
import { SentinelAuthProvider, SentinelAuthRoutes } from '@moshsplit/sentinel-auth-react';
import { AuthClient } from '@moshsplit/sentinel-sdk';
import '@moshsplit/sentinel-auth-react/dist/style.css';

const sentinelUrl = import.meta.env.VITE_SENTINEL_URL || 'http://localhost:9000';
const sentinelClient = new AuthClient(sentinelUrl);

function App() {
  return (
    <SentinelAuthProvider
      client={sentinelClient}
      redirects={{
        afterLogin: '/events',
        afterLogout: '/login',
        afterRegister: '/verify-email',
      }}
      theme={{
        appName: 'MoshSplit',
        tagline: 'Split expenses with friends',
        primaryColor: '#06b6d4', // cyan-500
        secondaryColor: '#3b82f6', // blue-500
        logo: '/logo.svg',
        copyright: '© 2026 MoshSplit. All rights reserved.',
      }}
    >
      <Routes>
        {/* Your app routes */}
        <Route path="/events" element={<EventsPage />} />

        {/* Sentinel auth routes - catch all auth paths */}
        <Route path="/*" element={<SentinelAuthRoutes />} />
      </Routes>
    </SentinelAuthProvider>
  );
}
```

### Theme Customization

The `SentinelTheme` interface supports the following customizations:

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `primaryColor` | `string` | Primary accent color (CSS var: `--accent-primary`) | Sentinel cyan |
| `secondaryColor` | `string` | Secondary accent color (CSS var: `--accent-blue`) | Sentinel blue |
| `appName` | `string` | App name displayed in branding panel | "Sentinel" |
| `tagline` | `string` | Auth page tagline (Login/Register only) | — |
| `logo` | `string \| ReactNode` | Custom logo (img URL or JSX) | Sentinel shield |
| `copyright` | `string` | Footer copyright text | "© 2026 Sentinel Auth" |

### Auth Flow Details

The authentication flow requires careful handling of the `email_verified` status:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTH FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. User submits credentials                                        │
│          │                                                           │
│          ▼                                                           │
│   2. POST /v1/api/auth/login                                        │
│          │                                                           │
│          ▼                                                           │
│   3. Login response received                                         │
│      ⚠️ IMPORTANT: Login response does NOT include email_verified! │
│          │                                                           │
│          ▼                                                           │
│   4. MUST call GET /v1/api/user/me with access token                 │
│          │                                                           │
│          ▼                                                           │
│   5. Extract email_verified from profile response                    │
│          │                                                           │
│          ▼                                                           │
│   6. Store email_verified in auth state                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this matters**: The login endpoint returns session tokens but does not include the `email_verified` boolean. You must fetch the user profile to determine verification status.

**Implementation pattern**:

```typescript
// In your auth store or provider
const handleLogin = async (email: string, password: string) => {
  // Step 1: Login
  const loginResult = await sentinelClient.login({ email, password });

  if (loginResult.type === 'mfa') {
    // Handle MFA flow separately
    return { mfaRequired: true, sessionToken: loginResult.mfaSessionToken };
  }

  const { accessToken } = loginResult.session;

  // Step 2: Fetch profile to get email_verified
  const profile = await sentinelClient.user.getMe(accessToken);

  // Step 3: Store session with email_verified status
  setSession(
    loginResult.session.userId,
    accessToken,
    loginResult.session.refreshToken,
    profile.email_verified  // ← This is the critical field!
  );
};
```

### API Endpoints Reference

All Sentinel API endpoints use the `/v1/api/` prefix and return responses wrapped in an envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-05-11T10:00:00.000Z",
  "request_id": "uuid"
}
```

#### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/api/auth/login` | No | Login with email/password. Returns session tokens or MFA challenge |
| POST | `/v1/api/auth/register` | No | Register new user |
| POST | `/v1/api/auth/verify-email` | No | **POST with JSON body** — Verify email from link token |
| POST | `/v1/api/auth/resend-verification` | No | Resend verification email (NOT `/verify-email/resend`) |
| POST | `/v1/api/auth/password/forgot` | No | Request password reset email |
| POST | `/v1/api/auth/password/reset` | No | Reset password with reset token |
| POST | `/v1/api/auth/token/refresh` | No | Refresh access token |
| POST | `/v1/api/auth/logout` | Bearer | Logout current session |
| POST | `/v1/api/auth/mfa/verify` | No | Verify MFA code |
| POST | `/v1/api/auth/mfa/totp/start` | Bearer | Start MFA enrollment |
| POST | `/v1/api/auth/mfa/totp/confirm` | Bearer | Confirm MFA enrollment |

#### User Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/api/user/me` | Bearer | **Returns email_verified** — Get current user profile |
| PATCH | `/v1/api/user/me` | Bearer | Update profile (first_name, last_name, avatar_url) |
| POST | `/v1/api/user/password/change` | Bearer | Change password |
| GET | `/v1/api/user/sessions` | Bearer | List all sessions |
| GET | `/v1/api/user/permissions` | Bearer | Get user roles and permissions |

#### Request/Response Examples

**Login Request**:
```bash
curl -X POST http://localhost:9000/v1/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
```

**Login Response (success)**:
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "access_token": "v2.local.xxx",
    "refresh_token": "v2.local.yyy",
    "expires_at": "2026-05-11T11:00:00.000Z",
    "mfa_required": false,
    "email_verified": true
  }
}
```

**Login Response (MFA required)**:
```json
{
  "success": true,
  "data": {
    "mfa_required": true,
    "mfa_session_token": "mfa_session_xxx"
  }
}
```

**Verify Email** (POST with JSON body):
```bash
curl -X POST http://localhost:9000/v1/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "ver_xxx"}'
```

**Resend Verification**:
```bash
curl -X POST http://localhost:9000/v1/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Get Profile (includes email_verified)**:
```bash
curl -X GET http://localhost:9000/v1/api/user/me \
  -H "Authorization: Bearer v2.local.xxx"
```

**Profile Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": null,
    "email_verified": true,
    "status": "Active",
    "created_at": "2026-01-01T00:00:00.000Z"
  }
}
```

### Database Schema

The `sentinel_auth` database uses the `auth` schema for Sentinel tables:

| Table | Description |
|-------|-------------|
| `auth.users` | User accounts (first_name, last_name, avatar_url, status) |
| `auth.user_identities` | Email/identity records with email_verified flag |
| `auth.sessions` | Active sessions with PASETO tokens |
| `auth.user_mfa_totp` | MFA TOTP secrets |
| `auth.user_recovery_codes` | MFA recovery codes |

**Important**: MoshSplit uses a separate database (`sentinel_auth`) rather than sharing the `moshsplit` database. The `sentinel-migrations` service runs Diesel migrations against the `auth` schema before Sentinel starts.

### Known Issues

#### 1. Login Response Does Not Include email_verified

**Problem**: The login endpoint (`POST /v1/api/auth/login`) returns session tokens but does not include the `email_verified` boolean in the response body.

**Impact**: If you rely on the login response alone, you won't know if the user's email is verified.

**Solution**: Always fetch the user profile after login to get the `email_verified` status:

```typescript
const loginResult = await sentinelClient.login(credentials);
if (loginResult.type === 'session') {
  const profile = await sentinelClient.user.getMe(loginResult.session.accessToken);
  // Use profile.email_verified for verification checks
}
```

#### 2. Email Verification State Not Updated After Verification

**Problem**: The `email_verified` flag is "baked into" the session at login time. If a user verifies their email, the existing session still shows `email_verified: false` until they log out and log back in.

**Solution**: After successful email verification, prompt the user to log out and log back in, or implement a session refresh mechanism.

#### 3. Pre-built Sentinel Image Doesn't Run Migrations

This is documented in the Troubleshooting section — the `sentinel-migrations` service must run before Sentinel starts.

---

## Additional Resources

- [Sentinel GitHub](https://github.com/graned/sentinel)
- [sentinel-client package](./packages/sentinel-client/)
- [Axum Middleware](https://docs.rs/axum/latest/axum/middleware/index.html)
- [tower-http CORS](https://docs.rs/tower-http/latest/tower_http/cors/index.html)

---

## Known Limitations and TODOs

### Current Limitations

1. **No Token Caching**: Each request to protected routes makes a synchronous call to Sentinel for token validation. This adds latency to every authenticated request and increases load on the Sentinel service. A future improvement would be to cache validated tokens with a TTL.

2. **All-or-Nothing Authorization**: The current middleware only verifies that a token is valid. There is no built-in support for role-based or permission-based route protection at the middleware level. All `/v1/*` routes require authentication, but handlers must manually implement authorization checks (e.g., checking if a user is a member of an event).

3. **No Refresh Token Handling**: The middleware validates access tokens but does not handle token refresh flows. If an access token expires, the client must re-authenticate to obtain a new token.

4. **Synchronous Validation**: The authentication call to Sentinel is blocking within the middleware. For high-throughput scenarios, consider running the Sentinel client in a separate task or implementing connection pooling.

### Planned Improvements

| Item | Description | Priority |
|------|-------------|----------|
| Token caching | Implement in-memory cache for validated tokens to reduce Sentinel load | Medium |
| Role-based middleware | Add middleware that checks specific roles/permissions before routing | Medium |
| Connection pooling | Configure HTTP client with connection pooling for Sentinel | Low |
| Metrics/observability | Add metrics for auth success/failure rates | Low |

### Workarounds for Current Limitations

**Authorization in Handlers**: While the middleware only checks authentication, you can implement authorization in your handlers:

```rust
async fn delete_event(
    current_user: CurrentUser,
    Path(event_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<()>>, ApiError> {
    // Fetch event to check ownership/membership
    let event = state.event_repo.find(event_id).await?;
    
    // Manual authorization check
    if !event.is_member(&current_user.0) {
        return Err(ApiError::forbidden("Not a member of this event"));
    }
    
    // Proceed with deletion
}
```

---

*Last updated: May 11, 2026*