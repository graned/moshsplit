# Sentinel Auth Integration Guide

This document provides comprehensive documentation for integrating Sentinel authentication with MoshSplit's Rust backend services (specifically `pitboss-api` / Axum).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Package Setup (sentinel-client)](#package-setup-sentinel-client)
3. [Axum Middleware Integration](#axum-middleware-integration)
4. [Protected vs Public Routes](#protected-vs-public-routes)
5. [Docker Compose Configuration](#docker-compose-configuration)
6. [Environment Variables](#environment-variables)
7. [Database Schema Design](#database-schema-design)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│  pitboss-api │─────▶│  PostgreSQL     │
│   (React)   │      │   (Axum)     │      │  (moshsplit)    │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
                            │ Token Validation
                            ▼
                     ┌──────────────┐      ┌─────────────────┐
                     │   Sentinel   │◀────▶│  PostgreSQL     │
                     │   (Auth)     │      │  (sentinel_auth)│
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

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: moshsplit

  sentinel-migrations:
    build:
      dockerfile: infra/docker/sentinel-migrate.Dockerfile
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/moshsplit

  sentinel:
    image: ghcr.io/graned/sentinel-core:v1.1.0
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/moshsplit
      PGOPTIONS: "-c search_path=auth"
      SENTINEL_URL: http://sentinel:8000

  sentinel-ui:
    image: ghcr.io/graned/sentinel-ui:v1.1.0
    volumes:
      - ./sentinel-ui-nginx.conf:/etc/nginx/conf.d/default.conf:ro

  pitboss-api:
    environment:
      SENTINEL_URL: http://sentinel:8000
      DATABASE_URL: postgres://pitboss:password@postgres:5432/moshsplit
```

### Key Services

#### sentinel-migrations

Runs Diesel migrations to create Sentinel tables in the `auth` schema before Sentinel starts. See [Database Schema Design](#database-schema-design) for why this is needed.

#### sentinel (sentinel-core)

The core auth service providing:
- User registration and login
- JWT token issuance and validation
- Role and permission management

#### sentinel-ui

Management dashboard for Sentinel. Uses Nginx to proxy API calls to sentinel-core:

```nginx
location /v1/ {
    proxy_pass http://sentinel:8000;
    # ... headers
}
```

#### pitboss-api

Your backend API that validates tokens against Sentinel.

---

## Environment Variables

### Required for pitboss-api

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTINEL_URL` | Sentinel API URL | `http://localhost:9000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `RUST_LOG` | Log level | `info` |

### Required for Sentinel

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/moshsplit` |
| `PGOPTIONS` | PostgreSQL options | `-c search_path=auth` |
| `HEX_KEY` | Encryption key for secrets | (32-byte hex) |
| `CONFIG_ENCRYPTION_KEY` | Config encryption key | (32-byte hex) |
| `OIDC_ISSUER_URL` | OIDC issuer URL | `http://localhost:9000` |
| `FRONTEND_URL` | Frontend origin | `http://localhost:5173` |
| `CORS_ALLOWED_ORIGINS` | CORS allowed origins | Comma-separated URLs |

### Required for Sentinel UI

| Variable | Description |
|----------|-------------|
| `API_URL` | Sentinel API URL (for proxy) |

---

## Database Schema Design

### Why Separate Database/Schema?

We use a **separate `auth` schema** within the same PostgreSQL database rather than sharing the `public` schema with application tables. This decision was made after encountering schema incompatibility issues with the pre-built Sentinel binary.

### Schema Separation

| Component | Schema | Search Path |
|-----------|--------|--------------|
| pitboss-api | `app` | `search_path=app` |
| Sentinel | `auth` | `search_path=auth` |
| Shared tables | `public` | (default) |

### Migration Service

The `sentinel-migrations` service runs Diesel migrations against the `auth` schema:

```dockerfile
# diesel.toml configuration
[print_schema]
schema = "auth"

[migrations_directory]
dir = "migrations/"
```

The migration service:
1. Creates the `auth` schema
2. Runs Sentinel's table migrations
3. Exits (one-time job)

### Connection Configuration

Sentinel connects with `search_path=auth` so queries default to the auth schema:

```yaml
sentinel:
  environment:
    PGOPTIONS: "-c search_path=auth"
```

pitboss-api uses its own schema:

```yaml
pitboss-api:
  environment:
    PGOPTIONS: "-c search_path=app"
```

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
- Wrong search path

**Solutions**:
```bash
# Verify auth schema exists
psql -c "\dn"

# Check tables in auth schema
psql -c "\dt auth.*"
```

#### 6. Sentinel Migrations Fail

**Symptom**: Migration errors or tables not created

**Solutions**:
```bash
# Manual migration run
docker compose up sentinel-migrations

# Check migration logs
docker compose logs sentinel-migrations
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

## Additional Resources

- [Sentinel GitHub](https://github.com/graned/sentinel)
- [sentinel-client package](./packages/sentinel-client/)
- [Axum Middleware](https://docs.rs/axum/latest/axum/middleware/index.html)
- [tower-http CORS](https://docs.rs/tower-http/latest/tower_http/cors/index.html)

---

*Last updated: May 2026*