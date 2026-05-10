# pitboss-api Scaffold Design — Sentinel Clean Architecture

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Overview](./overview.md) · [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security](./security.md) · [Rust↔PG Mapping](./rust-db-mapping.md)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Full Directory Structure](#2-full-directory-structure)
3. [Module Responsibilities](#3-module-responsibilities)
4. [Cargo.toml Dependencies](#4-cargotoml-dependencies)
5. [Scaffold Implementation Plan](#5-scaffold-implementation-plan)
6. [Connection Pool Configuration](#6-connection-pool-configuration)
7. [Error Hierarchy Design](#7-error-hierarchy-design)
8. [Response Envelope & Middleware Design](#8-response-envelope--middleware-design)
9. [impl_repository! Macro Design (SQLx)](#9-impl_repository-macro-design-sqlx)
10. [Test Structure](#10-test-structure)
11. [Tradeoffs & Risks](#11-tradeoffs--risks)

---

## 1. Architecture Overview

pitboss-api follows **Sentinel's Clean Architecture pattern** — a structured monolith with strict dependency layering:

```
Infrastructure (HTTP handlers, DB pool, router, middleware, external clients)
      ↑  dependency
Application  (use-case orchestrators: EventApplication, ExpenseApplication, …)
      ↑  dependency
Services     (single-responsibility business logic: balance computation, split validation)
      ↑  dependency
Domain       (entities, enums, repository trait definitions, error definitions)
```

**Key differences from Sentinel** (which uses Diesel + bb8):

| Aspect | Sentinel | pitboss-api |
|--------|----------|-------------|
| ORM | Diesel (sync + async) | SQLx (compile-time checked queries) |
| Pool | bb8 + diesel-async | SQLx `PgPool` (built-in) |
| Schema files | Auto-generated Diesel DSL | None — SQLx uses raw SQL |
| Auth | Built-in user/token tables | Delegated to Sentinel (PASETO validation) |
| DB schema | `public` | `app` |
| Currency | N/A | EUR cents (`INTEGER`, no floats) |

### Dependency Rule

- Inner layers **never import** from outer layers
- `Domain` knows nothing about HTTP, databases, or external services
- `Services` depend only on `Domain` traits
- `Applications` orchestrate `Services` and manage transaction boundaries
- `Infrastructure` wires everything together (DI in `build_app`)

---

## 2. Full Directory Structure

```
apps/pitboss-api/
├── Cargo.toml
├── .env.example
├── .sqlx/                              # Offline query data for CI (generated)
│   └── sqlx-data.json
├── migrations/                         # SQLx migration files
│   ├── 20260510000001_create_app_schema.sql
│   ├── 20260510000002_create_event_tables.sql
│   ├── 20260510000003_create_expense_tables.sql
│   ├── 20260510000004_create_payment_tables.sql
│   ├── 20260510000005_create_settlement_tables.sql
│   ├── 20260510000006_add_payment_immutability_trigger.sql
│   └── 20260510000007_create_indexes.sql
├── src/
│   ├── main.rs                         # Binary entry — env vars, build_app(), server.start()
│   ├── lib.rs                          # Library entry — module declarations + re-exports
│   ├── errors.rs                       # Error hierarchy: DomainError → ServiceError → ApiError
│   │
│   ├── applications/                   # Use-case orchestrators (multi-service flows, tx boundaries)
│   │   ├── mod.rs
│   │   ├── event_application.rs
│   │   ├── expense_application.rs
│   │   ├── payment_application.rs
│   │   ├── settlement_application.rs
│   │   └── balance_application.rs
│   │
│   ├── services/                       # Single-responsibility business logic
│   │   ├── mod.rs
│   │   ├── event_service.rs
│   │   ├── expense_service.rs          # Version chain management, split computation
│   │   ├── payment_service.rs
│   │   ├── settlement_service.rs       # Status transition validation
│   │   ├── balance_service.rs          # Balance computation engine
│   │   ├── membership_service.rs       # Active membership checks
│   │   └── sentinel_service.rs         # PASETO token validation + remote user lookup
│   │
│   ├── domain/                         # Entities, repository traits, enums
│   │   ├── mod.rs
│   │   ├── entities/
│   │   │   ├── mod.rs
│   │   │   ├── event.rs                # Event domain entity
│   │   │   ├── event_member.rs         # EventMember domain entity
│   │   │   ├── expense.rs              # Expense + ExpenseVersion entities
│   │   │   ├── payment.rs              # Payment domain entity
│   │   │   ├── settlement.rs           # Settlement domain entity + status enum
│   │   │   └── balance.rs              # BalanceRow, MemberBalance, SplitData enum
│   │   ├── repositories/               # Repository trait definitions
│   │   │   ├── mod.rs
│   │   │   ├── event_repository.rs
│   │   │   ├── expense_repository.rs
│   │   │   ├── payment_repository.rs
│   │   │   └── settlement_repository.rs
│   │   └── value_objects/              # Domain primitives (future: Money, SplitType)
│   │       └── mod.rs
│   │
│   ├── infrastructure/                 # HTTP layer + DB client + external integrations
│   │   ├── mod.rs
│   │   ├── clients/
│   │   │   ├── mod.rs
│   │   │   ├── pg_client.rs            # SQLx PgPool wrapper (init_pool, run_migrations)
│   │   │   └── sentinel_client.rs      # HTTP client for Sentinel user profile API
│   │   └── http/
│   │       ├── mod.rs
│   │       ├── app.rs                  # build_app() — DI container wiring all repos/services/apps
│   │       ├── server.rs              # AppState struct + HttpServer (TCP bind, graceful shutdown)
│   │       └── api/
│   │           ├── mod.rs
│   │           ├── types/
│   │           │   └── mod.rs          # ApiResponse<T> envelope, RequestId, RawResponse<T>
│   │           ├── dtos/               # Request/response DTOs (serialization types)
│   │           │   ├── mod.rs
│   │           │   ├── event_dtos.rs
│   │           │   ├── expense_dtos.rs
│   │           │   ├── payment_dtos.rs
│   │           │   ├── settlement_dtos.rs
│   │           │   └── balance_dtos.rs
│   │           ├── handlers/           # Axum handler functions (thin, delegate to applications)
│   │           │   ├── mod.rs
│   │           │   ├── system_handlers.rs   # health_check, canary
│   │           │   ├── event_handlers.rs
│   │           │   ├── expense_handlers.rs
│   │           │   ├── payment_handlers.rs
│   │           │   ├── settlement_handlers.rs
│   │           │   ├── balance_handlers.rs
│   │           │   └── error_handlers.rs    # not_found_handler (fallback)
│   │           ├── middlewares/         # Tower middleware layers
│   │           │   ├── mod.rs
│   │           │   ├── request_id.rs        # RequestIdLayer — assign/propagate X-Request-Id
│   │           │   ├── response_wrapper.rs  # ResponseWrapperLayer — wrap in ApiResponse<T>
│   │           │   ├── auth.rs              # AuthLayer — validate PASETO token, extract AuthUser
│   │           │   ├── membership.rs        # MembershipLayer — extract event_id, verify membership
│   │           │   └── rate_limit.rs        # RateLimitLayer — in-memory sliding window
│   │           └── routes/
│   │               ├── mod.rs
│   │               └── api_router.rs        # build_router() — nest routes, apply middleware stack
│   │
│   ├── utils/
│   │   ├── mod.rs
│   │   ├── impl_repository.rs          # SQLx-based CRUD macro (adapted from Sentinel's Diesel macro)
│   │   ├── pagination.rs               # Cursor-based pagination helpers
│   │   ├── money.rs                    # Cents arithmetic helpers (penny rounding, display)
│   │   └── idempotency.rs             # Idempotency-Key support (future)
│   │
│   └── config.rs                       # Environment configuration struct (load from env vars)
│
├── tests/                              # Integration tests (one file per domain)
│   ├── mod.rs                          # Test helpers: init_test_db, seed_data, cleanup
│   ├── health_check_tests.rs
│   ├── event_tests.rs
│   ├── expense_tests.rs
│   ├── payment_tests.rs
│   ├── settlement_tests.rs
│   └── balance_tests.rs
│
├── benches/                            # Benchmarks (future)
│   └── balance_benchmark.rs
│
└── Dockerfile
```

---

## 3. Module Responsibilities

### 3.1 `src/main.rs` — Binary Entry Point

Reads environment variables, decodes the Sentinel public key, calls `build_app()` to wire the DI container, and starts `HttpServer`.

**Specific responsibilities**:
- Initialize `tracing-subscriber` with `RUST_LOG` env filter
- Load config from environment (via `config.rs`)
- Decode `SENTINEL_PUBLIC_KEY` (hex → bytes → `paseto` key struct)
- Call `build_app(database_url, sentinel_public_key)` → `Router`
- Create `HttpServer::new(router)` and call `.start().await`
- Handle graceful shutdown (SIGINT)

**Sentinel reference**: `apps/sentinel-core/src/main.rs`

### 3.2 `src/lib.rs` — Library Entry

Module declarations and re-exports. Every module is declared here. Re-exports flatten the hierarchy so `applications::*`, `services::*`, etc. are accessible at the crate root.

**Sentinel reference**: `apps/sentinel-core/src/lib.rs`

### 3.3 `src/errors.rs` — Error Hierarchy

Four-layer error hierarchy adapted for MoshSplit:

```
DomainError    — pure business-rule violations
    ↓ From
ServiceError   — service-layer errors (wraps DomainError + SQLx errors)
    ↓ From
ApiError       — HTTP-facing error; carries status code + error code string
```

(See [Section 7](#7-error-hierarchy-design) for full variant design.)

**Sentinel reference**: `apps/sentinel-core/src/errors.rs`

### 3.4 `src/applications/` — Use-Case Orchestrators

Each application struct takes `Arc<PostgresClient>` and `Arc<*Service>` dependencies. They manage:
- Transaction boundaries (begin/commit/rollback)
- Cross-service coordination
- Authorization checks before delegation
- Mapping service results to DTOs

| File | Application | Key Operations |
|------|-------------|----------------|
| `event_application.rs` | `EventApplication` | Create/update/list/archive event + auto-add creator as admin |
| `expense_application.rs` | `ExpenseApplication` | Create version, list versions, soft-delete, ownership checks |
| `payment_application.rs` | `PaymentApplication` | Record payment, list payments, membership enforcement |
| `settlement_application.rs` | `SettlementApplication` | Propose/confirm/dispute settlement, status validation |
| `balance_application.rs` | `BalanceApplication` | Compute balances, compute simplified debts, explain breakdown |

**Sentinel reference**: `apps/sentinel-core/src/applications/`

### 3.5 `src/services/` — Single-Responsibility Business Logic

Services are pure business logic — they receive dependencies as trait objects/structs and call repositories.

| File | Service | Key Logic |
|------|---------|-----------|
| `event_service.rs` | `EventService` | Event CRUD validation, status transitions |
| `expense_service.rs` | `ExpenseService` | Version chain (next_version_number), split computation |
| `payment_service.rs` | `PaymentService` | Payment immutability check (never update/delete) |
| `settlement_service.rs` | `SettlementService` | Status transition validation (pending→confirmed/disputed→pending) |
| `balance_service.rs` | `BalanceService` | Per-event balance computation, explain breakdown, simplified debts (greedy algorithm) |
| `membership_service.rs` | `MembershipService` | `is_active_member()`, `require_admin()`, `require_member()` |
| `sentinel_service.rs` | `SentinelService` | PASETO token validation, fetch user profile from Sentinel API |

**Sentinel reference**: `apps/sentinel-core/src/services/`

### 3.6 `src/domain/` — Entities, Enums, Repository Traits

**Entities** (`entities/`):

| Entity | Fields (domain) | Notes |
|--------|-----------------|-------|
| `Event` | `id, name, description, currency, status, created_by, created_at, updated_at` | Mutable |
| `EventMember` | `id, event_id, user_id, role, joined_at, left_at` | Append/remove |
| `Expense` | `id, event_id, created_by, created_at, current_version_id, deleted_at` | Stable identifier |
| `ExpenseVersion` | `id, expense_id, version_number, title, description, amount_cents, paid_by, split_type, split_data, notes, created_by, created_at` | Immutable |
| `Payment` | `id, event_id, from_user, to_user, amount_cents, currency, description, payment_method, external_ref, recorded_by, recorded_at` | Immutable |
| `Settlement` | `id, event_id, from_user, to_user, amount_cents, status, settled_at, created_by, created_at` | Status only changes |

**Value objects** (`value_objects/`):
- `Money { amount_cents: i32, currency: String }`
- `SplitType` enum: `Equal`, `Custom`, `Percentage`, `Shares`
- `SplitData` typed enum (from `serde_json::Value`)
- `EventStatus`: `Active`, `Archived`, `Deleted`
- `SettlementStatus`: `Pending`, `Confirmed`, `Disputed`
- `MemberRole`: `Admin`, `Member`

**Repositories** (`repositories/`):

Each file defines a **trait** (not a struct) that the repository must implement:

```rust
// Example: event_repository.rs
#[async_trait]
pub trait EventRepository: Send + Sync {
    async fn create(&self, pool: &PgPool, event: &NewEvent) -> Result<EventRow, RepositoryError>;
    async fn find_by_id(&self, pool: &PgPool, id: Uuid) -> Result<Option<EventRow>, RepositoryError>;
    async fn find_by_user(&self, pool: &PgPool, user_id: Uuid) -> Result<Vec<EventRow>, RepositoryError>;
    async fn update(&self, pool: &PgPool, id: Uuid, changes: &UpdateEvent) -> Result<EventRow, RepositoryError>;
    async fn soft_delete(&self, pool: &PgPool, id: Uuid) -> Result<(), RepositoryError>;
}
```

The concrete implementations are generated by the `impl_repository!` macro (or written manually for complex queries).

**Sentinel reference**: `apps/sentinel-core/src/domain/` — Note: Sentinel inlines the Diesel-based macro expansions. pitboss-api will use traits + macro-generated SQLx implementations.

### 3.7 `src/infrastructure/clients/` — External Clients

| File | Client | Purpose |
|------|--------|---------|
| `pg_client.rs` | `PostgresClient` | SQLx `PgPool` wrapper — `init_pool()`, `run_migrations()`, `health_check()` |
| `sentinel_client.rs` | `SentinelClient` | HTTP client for Sentinel API (`GET /v1/api/user/me` profile fetch) |

**Sentinel reference**: `apps/sentinel-core/src/infrastructure/clients/pg_client.rs` (Diesel version — pitboss-api adapts for SQLx)

### 3.8 `src/infrastructure/http/` — HTTP Layer

See [Section 8](#8-response-envelope--middleware-design) for middleware design.

| File | Component | Responsibility |
|------|-----------|----------------|
| `app.rs` | `build_app()` | DI container — constructs every repository, service, application, wires them together |
| `server.rs` | `AppState` + `HttpServer` | Shared state struct + TCP bind with graceful shutdown |
| `api/types/mod.rs` | `ApiResponse<T>`, `RequestId`, `RawResponse<T>` | Response envelope types |
| `api/dtos/*` | DTOs | Serde request/response structs per domain |
| `api/handlers/*` | Handlers | Thin Axum handlers delegating to applications |
| `api/middlewares/*` | Middleware layers | RequestId, ResponseWrapper, Auth, Membership, RateLimit |
| `api/routes/api_router.rs` | `build_router()` | Route definitions + middleware stack |

**Sentinel reference**: `apps/sentinel-core/src/infrastructure/http/`

### 3.9 `src/config.rs` — Environment Configuration

```rust
pub struct Config {
    pub database_url: String,
    pub sentinel_public_key: [u8; 32],      // Hex-decoded PASETO key
    pub sentinel_base_url: String,           // e.g. http://sentinel:8000
    pub cors_allowed_origins: Vec<String>,
    pub host: String,                        // default 0.0.0.0
    pub port: u16,                           // default 8080
    pub log_level: String,                   // default "info"
    pub rate_limit_requests: u32,            // default 100
    pub rate_limit_window_secs: u64,         // default 60
}
```

**Environment variables**:
- `DATABASE_URL` — required
- `SENTINEL_PUBLIC_KEY` — required (64-char hex, 32 bytes)
- `SENTINEL_BASE_URL` — required (e.g. `http://sentinel:8000`)
- `CORS_ALLOWED_ORIGINS` — optional (comma-separated)
- `APP_HOST` — optional (default `0.0.0.0`)
- `APP_PORT` — optional (default `8080`)
- `RUST_LOG` — optional (default `info`)

### 3.10 `src/utils/` — Utilities

| File | Utility | Purpose |
|------|---------|---------|
| `impl_repository.rs` | `impl_repository!` macro | SQLx-based CRUD + pagination generator (see [Section 9](#9-impl_repository-macro-design-sqlx)) |
| `pagination.rs` | `Paginated<T>`, cursor helpers | Cursor-based pagination types + query builders |
| `money.rs` | `Money`, `split_equally()` helpers | Integer cents arithmetic, penny rounding, display formatting |
| `idempotency.rs` | `IdempotencyStore` | In-memory idempotency key tracking (future) |

**Sentinel reference**: `apps/sentinel-core/src/utils/impl_repository.rs` (Diesel version — pitboss-api adapts for SQLx)

---

## 4. Cargo.toml Dependencies

```toml
[package]
name = "pitboss-api"
version = "0.1.0"
edition = "2021"
description = "MoshSplit backend API — shared-expense management"
license = "AGPL-3.0-only"

[dependencies]
# Async runtime
tokio = { version = "1", features = ["full"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Web framework
axum = { version = "0.8", features = ["tokio", "macros"] }
axum-extra = { version = "0.12", features = ["typed-header"] }
tower = "0.5"
tower-http = { version = "0.6", features = [
    "cors",
    "trace",
    "catch-panic",
    "set-header",
    "request-id",
    "timeout",
] }

# Database — SQLx (replaces Diesel from Sentinel)
sqlx = { version = "0.8", features = [
    "runtime-tokio",
    "postgres",
    "uuid",
    "chrono",
    "json",
    "migrate",
] }

# Connection pool — SQLx PgPool is built-in (no separate bb8/diesel-async needed)

# UUID
uuid = { version = "1", features = ["v4", "serde"] }

# Time handling
chrono = { version = "0.4", features = ["serde"] }

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Configuration
dotenvy = "0.15"
config = "0.14"              # Environment variable loading

# Error handling
thiserror = "2"

# Validation
validator = { version = "0.19", features = ["derive"] }

# Caching / rate limiting
dashmap = "6"                # Concurrent HashMap for in-memory rate limiter

# HTTP client (for Sentinel API calls)
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }

# PASETO token validation
rusty_paseto = { version = "0.9", features = ["batteries_included", "v4_local"] }

# Hex decoding for public key
hex = "0.4"

# Utilities
futures = "0.3"
async-trait = "0.1"          # For repository trait async methods

[dev-dependencies]
reqwest = { version = "0.12", features = ["json", "blocking"] }
tokio = { version = "1", features = ["full", "test-util"] }
testcontainers = "0.23"       # Docker-based test DB management
serde_json = "1"
tracing-test = "0.2"

[[bin]]
name = "pitboss-api"
path = "src/main.rs"
```

### Dependency Rationale

| Dependency | Why | Sentinel Equivalent |
|-----------|-----|---------------------|
| `sqlx` 0.8 | Compile-time checked SQL, native async, no ORM overhead | `diesel` + `diesel-async` + `bb8` |
| `axum` 0.8 | Ergonomic web framework, tower middleware | Same |
| `tower-http` | CORS, tracing, catch-panic, set-header, request-id | Same (Sentinel uses CORS, trace, catch-panic, set-header) |
| `reqwest` | HTTP client for Sentinel user profile API | Same (Sentinel uses for policy probe) |
| `rusty_paseto` | PASETO v4.local token validation | Same |
| `dashmap` | In-memory rate limiter (no Redis needed for single instance) | `governor` (Sentinel uses governor) |
| `async-trait` | Repository trait definitions with async methods | Not needed (Diesel is sync) |
| `config` 0.14 | Structured environment loading | Manual `env::var()` calls |
| `validator` | JSON body validation in Axum extractors | Same |
| `thiserror` | Derive Error for error enums | Same |

### Omitted Sentinel Dependencies

| Sentinel Dependency | Why Omitted |
|--------------------|-------------|
| `diesel-derive-enum` | SQLx uses `#[sqlx(type_name)]` derive or String enums |
| `bb8` | SQLx PgPool is self-contained |
| `diesel-async` | SQLx is natively async |
| `governor` | Simpler dashmap-based rate limiter for single-instance |
| `lettre` | Email not needed (no password reset, no verification) |
| `totp-rs` | MFA not needed (delegated to Sentinel) |
| `jsonwebtoken` + `rsa` | OIDC not needed (delegated to Sentinel) |
| `chacha20poly1305` | Encryption not needed (no stored secrets) |
| `utoipa` + `utoipa-swagger-ui` | Optional — add in later phase if API docs desired |
| `subtle` | Not needed (no password comparison) |

---

## 5. Scaffold Implementation Plan

The implementation plan is organized into **phases** for the backend-rust agent. Each phase is a self-contained step that builds on the previous one.

### Phase 0: Project Initialization

**Step 0.1**: Create the `apps/pitboss-api/` directory structure (all directories listed in Section 2).

**Step 0.2**: Create `.env.example`:
```
DATABASE_URL=postgres://pitboss:password@localhost:5432/moshsplit?search_path=app,public
SENTINEL_PUBLIC_KEY=<64-char-hex-string>
SENTINEL_BASE_URL=http://sentinel:8000
CORS_ALLOWED_ORIGINS=http://localhost:5173
APP_HOST=0.0.0.0
APP_PORT=8080
RUST_LOG=info
```

**Step 0.3**: Create `migrations/` directory with initial bootstrap migration (app schema, all tables, indexes, payment immutability trigger) — this is already defined in `docs/architecture/database-schema.md` §8.

### Phase 1: Foundation (Cargo.toml + core files)

**Step 1.1 — `Cargo.toml`**: Write the full Cargo.toml from Section 4.

**Step 1.2 — `src/config.rs`**: Implement `Config` struct with `load()` that reads from env vars. Use `dotenvy::dotenv()` to load `.env` file. Validate required fields at startup.

**Step 1.3 — `src/errors.rs`**: Implement the four-layer error hierarchy (see Section 7).

**Step 1.4 — `src/lib.rs`**: Declare all top-level modules. No re-exports yet (phased in as modules are created).

**Step 1.5 — `src/main.rs`**: Entry point skeleton:
- `tracing_subscriber::fmt()` initialization
- `Config::load()`
- Database migration run
- `build_app()` call
- `HttpServer::start()`

### Phase 2: Infrastructure — Database Client

**Step 2.1 — `src/infrastructure/clients/pg_client.rs`**:

Replace Sentinel's Diesel-based `PostgresClient` with a SQLx-based version:

```rust
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::migrate::Migrator;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct PostgresClient {
    pub pool: PgPool,
}

impl PostgresClient {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(5)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await?;
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn health_check(&self) -> Result<String, sqlx::Error> {
        sqlx::query_scalar::<_, i32>("SELECT 1")
            .fetch_one(&self.pool)
            .await?;
        Ok("Database is healthy".to_string())
    }

    pub async fn run_migrations(&self) -> Result<(), sqlx::migrate::MigrateError> {
        let migrator = Migrator::new(std::path::Path::new("./migrations")).await?;
        migrator.run(&self.pool).await
    }
}
```

### Phase 3: Infrastructure — HTTP Foundation

**Step 3.1 — `src/infrastructure/http/api/types/mod.rs`**:

Implement:
- `RequestId` — transparent UUID wrapper with `Default`, `From` impls
- `ApiResponse<T>` — generic envelope with `success()`, `error()` constructors, `IntoResponse`
- `RawResponse<T>` — marker type for handlers that return unwrapped data (middleware wraps later)

Sentinel pattern to replicate exactly (adapted for MoshSplit's `ApiError`).

**Step 3.2 — `src/infrastructure/http/api/middlewares/request_id.rs`**:

Implement `request_id_middleware` as an Axum `middleware::from_fn`:
- Extract `X-Request-Id` from request headers (if present, valid ASCII ≤ 128 chars)
- Generate new UUID v4 if absent
- Insert `RequestId` into request extensions
- Echo back as `X-Request-Id` response header

**Step 3.3 — `src/infrastructure/http/api/middlewares/response_wrapper.rs`**:

Implement `ResponseWrapperLayer` as a Tower `Layer` + `Service`:
- Intercept all responses
- Skip if already enveloped (detect `success`, `request_id`, `timestamp` fields)
- Check for non-2xx status → wrap as error response
- Parse response body as JSON → wrap in `ApiResponse::success()`
- Handle empty/string/binary bodies gracefully

**Step 3.4 — `src/infrastructure/http/api/middlewares/auth.rs`**:

Implement `authenticate_middleware`:
- Extract `Authorization: Bearer <token>` header
- Validate PASETO v4.local token using `SENTINEL_PUBLIC_KEY`
- Extract claims: `user_id`, `session_id`, `roles`
- Insert `AuthUser { user_id, roles }` into request extensions
- Return 401 on missing/invalid/expired token

### Phase 4: Infrastructure — HTTP Server + App

**Step 4.1 — `src/infrastructure/http/server.rs`**:

Implement:
- `AppState` struct — holds `Arc<*Application>` handles for all application structs
- `HttpServer` — new(), start() with TCP bind + graceful shutdown

**Step 4.2 — `src/infrastructure/http/api/handlers/system_handlers.rs`**:

Implement health check endpoint:
```rust
pub async fn health_check() -> &'static str {
    "Okiley Dokiley!"
}
```

Also implement `canary` endpoint (protected, returns auth context info).

**Step 4.3 — `src/infrastructure/http/api/routes/api_router.rs`**:

Implement `build_router(app_state: Arc<AppState>) -> Router`:
- CORS layer from `CORS_ALLOWED_ORIGINS`
- `middleware::from_fn(request_id_middleware)`
- Security response headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- `CatchPanicLayer`
- `TraceLayer` (structured logging)
- `Extension(app_state)`
- `ResponseWrapperLayer`
- Health check route: `GET /v1/system/health`
- Protected canary route: `GET /v1/system/canary`
- Fallback `not_found_handler`

For now, mount system routes only. Domain routes will be added in Phase 6.

**Step 4.4 — `src/infrastructure/http/app.rs`**:

Implement `build_app()`:
- Create `PostgresClient` (run migrations)
- Create `SentinelClient` (if needed — for now, stub)
- Wire all repositories → services → applications → `AppState`
- Return `build_router(app_state)`

For now, repositories can be empty structs (no query implementations yet). The wire-up is the important part.

### Phase 5: Utils + Macro

**Step 5.1 — `src/utils/money.rs`**:

Implement:
- `Money` struct (amount_cents: i32, currency: String)
- `fn split_equally(amount_cents: i32, n_participants: usize) -> Vec<i32>` — penny rounding
- `fn display_cents(amount_cents: i32) -> String` — "€12.34"

**Step 5.2 — `src/utils/pagination.rs`**:

Implement:
- `Paginated<T>` struct (items, next_cursor, has_more, limit)
- `PaginatedResponse<T>` — wraps `Paginated<T>` for API response

**Step 5.3 — `src/utils/impl_repository.rs`**:

Implement SQLx-based `impl_repository!` macro (see Section 9).

### Phase 6: Domain Entities + Repository Traits

**Step 6.1**: Implement all domain entities in `src/domain/entities/`:
- Event, EventMember, Expense, ExpenseVersion, Payment, Settlement
- Value objects: SplitData enum, EventStatus, SettlementStatus, MemberRole, SplitType

**Step 6.2**: Implement repository trait definitions in `src/domain/repositories/`.

### Phase 7: Wire Domain Routes

**Step 7.1**: Implement DTOs in `src/infrastructure/http/api/dtos/`.

**Step 7.2**: Implement handlers for each domain (initially as stubs returning `todo!()`).

**Step 7.3**: Add domain routes to `api_router.rs`.

### Phase 8: Implement Services

**Step 8.1**: Implement each service with full business logic.

### Phase 9: Implement Applications

**Step 9.1**: Wire services together in application structs with transaction boundaries.

### Phase 10: Tests

**Step 10.1**: Implement integration tests (see Section 10).

**Step 10.2**: Implement unit tests for services (especially balance computation).

---

## 6. Connection Pool Configuration

### SQLx PgPool Configuration

```rust
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

let pool = PgPoolOptions::new()
    .max_connections(20)              // Max concurrent DB connections
    .min_connections(5)               // Maintain at least 5 idle connections
    .acquire_timeout(Duration::from_secs(30))  // Fail fast if pool is exhausted
    .max_lifetime(Duration::from_secs(1800))   // Recycle connections every 30 min
    .idle_timeout(Duration::from_secs(600))    // Close idle connections after 10 min
    .test_before_acquire(true)        // Validate connection before handing it out
    .connect(database_url)
    .await?;
```

| Setting | Value | Rationale |
|---------|-------|-----------|
| `max_connections` | 20 | Sufficient for single-instance. Each connection is ~3 MB. 20 × 3 = 60 MB. |
| `min_connections` | 5 | Keep a warm pool ready for traffic bursts. |
| `acquire_timeout` | 30s | If all 20 connections are busy for 30s, fail fast rather than queue indefinitely. |
| `max_lifetime` | 30 min | Prevents stale connection accumulation (PG may close idle connections after some time). |
| `idle_timeout` | 10 min | Close idle connections during low traffic to free PG resources. |
| `test_before_acquire` | true | Ensures connections are alive before handing them out. |
| `search_path` | `app, public` | Set via `DATABASE_URL` query parameter or pool-level `SET search_path`. |

### Connection String

```
DATABASE_URL=postgres://pitboss:password@localhost:5432/moshsplit?search_path=app,public
```

### Why Not bb8?

SQLx's built-in `PgPool` already provides:
- Connection pooling (bb8-like)
- Connection health checking (test_on_acquire)
- Connection lifetime management
- Graceful shutdown (close all connections on drop)

No need for a separate bb8 + diesel-async combination. This is the primary difference from Sentinel's stack.

### Health Check Query

```rust
// Used in health_check endpoint
sqlx::query_scalar::<_, i32>("SELECT 1")
    .fetch_one(&pool)
    .await?;
```

---

## 7. Error Hierarchy Design

pitboss-api uses a 3-layer error hierarchy (Sentinel uses 4 layers, but MoshSplit merges `RepositoryError` into `ServiceError` since SQLx errors map directly):

```
DomainError  — pure business-rule violations (no I/O)
    ↓ From impl
ServiceError — service-layer errors (wraps DomainError + SQLx errors + external client errors)
    ↓ From impl
ApiError     — HTTP-facing error; carries status code + error code string
```

### 7.1 DomainError

```rust
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Business rule violation: {0}")]
    BusinessRule(String),

    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Membership error: {0}")]
    MembershipError(String),

    #[error("Domain error: {0}")]
    Generic(String),
}
```

### 7.2 ServiceError

```rust
#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    // ── 400 ──
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Invalid split: {0}")]
    InvalidSplit(String),
    #[error("Invalid status transition: {0}")]
    InvalidStatusTransition(String),
    #[error("Self payment not allowed")]
    SelfPayment,

    // ── 401 ──
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    #[error("Invalid token: {0}")]
    InvalidTokenError(String),
    #[error("Token expired")]
    ExpiredTokenError(String),
    #[error("Missing token")]
    MissingTokenError(String),

    // ── 403 ──
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Not an event member: {0}")]
    NotAMember(String),
    #[error("Insufficient role: {0}")]
    InsufficientRole(String),

    // ── 404 ──
    #[error("Not found: {0}")]
    NotFoundError(String),

    // ── 409 ──
    #[error("Conflict: {0}")]
    Conflict(String),

    // ── 422 ──
    #[error("Immutable violation: {0}")]
    ImmutableViolation(String),

    // ── 429 ──
    #[error("Rate limited: {0}")]
    RateLimited(String),

    // ── 500 ──
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Internal error: {0}")]
    InternalError(String),
}
```

### 7.3 ApiError

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip)]
    pub status: StatusCode,
}
```

### 7.4 From Implementations

| From | To | Mapping |
|------|----|---------|
| `sqlx::Error` | `ServiceError` | `RowNotFound` → `NotFoundError`, `Database(PgDatabaseError)` → `DatabaseError` with error code analysis, others → `InternalError` |
| `DomainError` | `ServiceError` | `Validation` → `ValidationError`, `NotFound` → `NotFoundError`, `MembershipError` → `NotAMember`, others → `InternalError` |
| `ServiceError` | `ApiError` | Each variant maps to HTTP status + error code string (see Sentinel's pattern) |
| `ApiError` | `axum::response::Response` | Via `IntoResponse` impl — returns JSON with status |

### 7.5 PG Error Code Mapping (in `sqlx::Error` → `ServiceError`)

| PG Error | Code | Maps To |
|----------|------|---------|
| `foreign_key_violation` | `23503` | `NotAMember` (if `event_member` constraint) or `NotFoundError` |
| `unique_violation` | `23505` | `Conflict` |
| `check_violation` | `23514` | `ValidationError` |
| `serialization_failure` | `40001` | `Conflict` (retryable) |
| `MODIFYING_SQL_DATA_NOT_PERMITTED` | `25006` | `ImmutableViolation` |

---

## 8. Response Envelope & Middleware Design

### 8.1 ApiResponse Envelope

Every API response follows this envelope (matching the API design in `api-design.md`):

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-05-10T10:00:00.000Z",
    "version": "1.0"
  }
}
```

**Rust type** (in `types/mod.rs`):

```rust
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub meta: ResponseMeta,
}

#[derive(Debug, Serialize)]
pub struct ResponseMeta {
    pub request_id: RequestId,
    pub timestamp: DateTime<Utc>,
    pub version: String,
}
```

### 8.2 Middleware Stack

Layers applied in `build_router()`, outermost first:

| Layer | Type | Purpose |
|-------|------|---------|
| CORS | `CorsLayer` | Handle preflight, add allowed-origin headers |
| RequestId | `middleware::from_fn` | Assign/propagate `X-Request-Id` **before** tracing |
| Security headers | `SetResponseHeaderLayer` (×3) | X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| CatchPanic | `CatchPanicLayer` | Panic → 500 |
| Trace | `TraceLayer` | Structured request/response logging |
| Extension(AppState) | `Extension` | Share application state |
| Auth (selective) | `middleware::from_fn` | PASETO token validation (applied per-route-group) |
| ResponseWrapper | `ResponseWrapperLayer` | Wrap all responses in envelope |

**Layer order rationale**:
- CORS is outermost so preflight requests don't hit any other middleware
- RequestId is second-outermost so the trace layer sees it
- Security headers don't depend on anything
- CatchPanic ensures panics don't bypass ResponseWrapper
- Trace logs before/after processing
- Extension makes state available to all handlers
- Auth is per-route-group and runs before the handler
- ResponseWrapper is innermost so it captures the final response

### 8.3 Handler Pattern

Handlers return `Result<RawResponse<T>, ApiError>`:

```rust
pub async fn list_events(
    Extension(state): Extension<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<RawResponse<Vec<EventResponse>>, ApiError> {
    let events = state
        .event_application
        .list_user_events(auth_user.user_id)
        .await
        .map_err(ApiError::from)?;
    Ok(RawResponse(events))
}
```

The `RawResponse<T>` is caught by `ResponseWrapperLayer` and wrapped in the envelope. This avoids double-wrapping.

### 8.4 Auth Middleware Flow

```
Request → [RequestId middleware] → [Auth middleware] → [Membership middleware] → Handler
                 │                        │                       │
                 │                  Extracts Bearer          Extracts event_id
                 │                  Validates PASETO         Verifies event_member
                 │                  Inserts AuthUser         left_at IS NULL
                 ▼                        ▼                       ▼
            X-Request-Id          user_id + roles          is_active_member?
            in extensions         in extensions            in extensions
```

---

## 9. impl_repository! Macro Design (SQLx)

### 9.1 Sentinel's Diesel Version (Reference)

Sentinel's macro generates:
- `new()` constructor
- `create()`, `create_many()` — insert with get_result/get_results
- `find_by_id()` — filter by PK, `.first().optional()`
- `find_where()` — filter by expression
- `update()` — filter by PK, set changeset, get_result
- `update_where()` — filter by expression
- `delete()` — filter by PK
- `count()` — count all
- `paginate_all()` — order by PK desc, limit/offset
- `paginate_where()` — filter + order by PK desc, limit/offset

### 9.2 SQLx Adaptation Design

The SQLx version must work differently because SQLx uses compile-time checked SQL string queries rather than Diesel's type-safe query builder:

```rust
/// SQLx-based CRUD repository macro
///
/// Generates:
/// - `Repository` struct with `new()` constructor
/// - `create()` — INSERT with RETURNING
/// - `find_by_id()` — SELECT by PK
/// - `find_all()` — SELECT all
/// - `update()` — UPDATE by PK with RETURNING
/// - `delete()` — DELETE by PK with RETURNING
/// - `count()` — COUNT all
///
/// Unlike Diesel's version, the SQLx version requires explicit column lists
/// in the macro invocation (since SQLx can't derive them from table schema).
///
/// # Parameters
/// - `$repo_name` — struct name (e.g. `EventRepository`)
/// - `$row_type` — the `FromRow` type (e.g. `EventRow`)
/// - `$table` — schema-qualified table name as string (e.g. `"app.event"`)
/// - `$pk_col` — primary key column name as string (e.g. `"id"`)
/// - `$pk_type` — Rust type of the PK (e.g. `uuid::Uuid`)
/// - `$columns` — comma-separated column names (e.g. `"id, name, description, ..."`)
///
/// # Example
/// ```rust
/// impl_repository!(
///     EventRepository,
///     EventRow,
///     "app.event",
///     "id",
///     Uuid,
///     "id, name, description, currency, status, created_by, created_at, updated_at"
/// );
/// ```
macro_rules! impl_repository {
    (
        $repo_name:ident,
        $row_type:ty,
        $table:expr,
        $pk_col:expr,
        $pk_type:ty,
        $columns:expr
    ) => {
        #[derive(Default)]
        pub struct $repo_name {}

        impl $repo_name {
            pub fn new() -> Self { Self {} }

            pub async fn create(
                &self,
                pool: &sqlx::PgPool,
                // Accepts a parameterised INSERT
                // This is a simplified pattern — real usage may need
                // explicit parameter binding
            ) -> Result<$row_type, sqlx::Error> {
                // Uses sqlx::query_as! with compile-time-checked SQL
                todo!("Generated by macro expansion")
            }

            pub async fn find_by_id(
                &self,
                pool: &sqlx::PgPool,
                id: $pk_type,
            ) -> Result<Option<$row_type>, sqlx::Error> {
                let query_str = format!(
                    "SELECT {} FROM {} WHERE {} = $1",
                    $columns, $table, $pk_col
                );
                // Use sqlx::query_as with runtime SQL (not query_as!)
                sqlx::query_as::<_, $row_type>(&query_str)
                    .bind(id)
                    .fetch_optional(pool)
                    .await
            }

            pub async fn count(
                &self,
                pool: &sqlx::PgPool,
            ) -> Result<i64, sqlx::Error> {
                let query_str = format!("SELECT COUNT(*) FROM {}", $table);
                sqlx::query_scalar::<_, i64>(&query_str)
                    .fetch_one(pool)
                    .await
            }
        }
    };
}
```

### 9.3 SQLx Macro Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Runtime SQL** (`query_as`, not `query_as!`) | The macro generates SQL strings — `query_as!` requires compile-time literal strings |
| **Explicit column list required** | SQLx can't auto-discover table schema like Diesel. Users must specify columns. |
| **One macro per table** | Simpler than generic CRUD with type-safe query building |
| **No paginate_* in macro** | Pagination is complex and domain-specific. Use custom queries instead. |
| **Uses `sqlx::Error` directly** | The caller converts to `ServiceError` via `From` impl |

### 9.4 When NOT to Use the Macro

The macro is only appropriate for simple CRUD with single-PK lookups. Write custom SQLx queries for:

- Balance computation (complex CTEs with multiple joins)
- Expense version chain (transactional insert + update)
- Cursor-based pagination (dynamic WHERE clauses)
- Membership checks (EXISTS query)
- Any query with JSONB operators

---

## 10. Test Structure

### 10.1 Integration Test Setup

Integration tests in `tests/` use `testcontainers` to spin up a disposable PostgreSQL instance:

```rust
// tests/mod.rs — shared test helpers

use sqlx::PgPool;
use testcontainers::runners::AsyncRunner;
use testcontainers::GenericImage;

/// Spin up a test PostgreSQL container, run migrations, return pool.
pub async fn init_test_db() -> (PgPool, impl AsyncRunner) {
    let container = GenericImage::new("postgres", "16-alpine")
        .with_env_var("POSTGRES_USER", "pitboss")
        .with_env_var("POSTGRES_PASSWORD", "password")
        .with_env_var("POSTGRES_DB", "moshsplit_test")
        .start()
        .await
        .expect("Failed to start PostgreSQL container");

    let port = container.get_host_port_ipv4(5432).await.unwrap();
    let database_url = format!(
        "postgres://pitboss:password@localhost:{}/moshsplit_test?search_path=app,public",
        port
    );

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test DB");

    sqlx::query("CREATE SCHEMA IF NOT EXISTS app")
        .execute(&pool)
        .await
        .unwrap();

    // Run migrations
    let migrator = sqlx::migrate::Migrator::new(std::path::Path::new("./migrations"))
        .await
        .unwrap();
    migrator.run(&pool).await.unwrap();

    (pool, container)
}

/// Seed test data for a specific domain.
pub mod seeds {
    use sqlx::PgPool;
    use uuid::Uuid;

    pub async fn create_test_event(pool: &PgPool, created_by: Uuid) -> (Uuid, /* EventRow */) {
        todo!()
    }

    pub async fn create_test_member(
        pool: &PgPool,
        event_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) {
        todo!()
    }
}
```

### 10.2 Integration Test Files

| File | Tests |
|------|-------|
| `health_check_tests.rs` | `GET /v1/system/health` returns 200, `GET /v1/system/canary` returns auth info |
| `event_tests.rs` | CRUD lifecycle: create, list, get, update, archive. Membership enforcement. |
| `expense_tests.rs` | Create expense with version 1, update creates version 2, list versions, soft delete. Split validation. |
| `payment_tests.rs` | Create payment, list, get. Verify immutable (no update/delete). Self-payment rejected. |
| `settlement_tests.rs` | Propose, confirm, dispute, re-negotiate. Status transition validation. |
| `balance_tests.rs` | Balance computation correctness, penny rounding, explain breakdown, simplified debts. |

### 10.3 Test Patterns

```rust
// tests/expense_tests.rs

use crate::{init_test_db, seeds};
use uuid::Uuid;

#[tokio::test]
async fn test_create_expense() {
    let (pool, _container) = init_test_db().await;
    let user_id = Uuid::new_v4();
    let event_id = seeds::create_test_event(&pool, user_id).await;
    seeds::create_test_member(&pool, event_id, user_id, "member").await;

    // Create expense via application layer
    // Assert response contains expected fields
    // Assert version_number == 1
    // Assert current_version_id is set
}

#[tokio::test]
async fn test_expense_versioning() {
    let (pool, _container) = init_test_db().await;
    // Create expense → version 1
    // Update expense → version 2
    // Update expense → version 3
    // Assert version_history returns 3 versions
    // Assert current_version_id points to version 3
}

#[tokio::test]
async fn test_split_penny_rounding() {
    // €10.00 split 3 ways equally
    // Verify: [334, 333, 333] cents
}
```

### 10.4 Unit Test Structure

Unit tests live alongside the code they test (Rust convention):

```rust
// src/services/balance_service.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_equal_split_no_remainder() {
        let shares = split_equally(1000, 5);
        assert_eq!(shares, vec![200, 200, 200, 200, 200]);
    }

    #[test]
    fn test_equal_split_with_remainder() {
        let shares = split_equally(1000, 3);
        assert_eq!(shares, vec![334, 333, 333]);
    }

    #[test]
    fn test_simplified_debts_simple() {
        // Alice is owed 500 by Bob
        // Bob owes 500
        // Simplified: Bob pays Alice 500
    }
}
```

### 10.5 Test Database Lifecycle

```
Per test file (or test module):
  1. testcontainers starts PostgreSQL 16-alpine container
  2. Create app schema
  3. Run all migrations (idempotent)
  4. Seed test data as needed
  5. Run test assertions against application layer
  6. Container is dropped on test completion (via Drop impl)
```

> **Note**: Using `testcontainers` requires Docker. For CI without Docker, use `SQLX_OFFLINE=true` for compile checks and run integration tests against a shared PG service.

---

## 11. Tradeoffs & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **SQLx compile-time checking requires live DB** | CI needs PostgreSQL | Use `SQLX_OFFLINE=true` with pre-generated `sqlx-data.json` via `cargo sqlx prepare` |
| **Runtime SQL in `impl_repository!` macro** | No compile-time SQL validation for generated queries | Limit macro to simple CRUD. All complex queries use `query_as!` with compile-time checks. |
| **No Diesel schema DSL** | No auto-generated Rust types from DB schema | Write `FromRow` structs manually. Use `sqlx::query_as!` for compile-time validation. |
| **PASETO key management** | Invalid/missing key at startup | Fail-fast in `main.rs` — panic if key is missing or wrong length |
| **Rate limiter is in-memory** | Lost on restart, doesn't work across multiple instances | Acceptable for single-instance MVP. Add Redis-backed limiter when scaling. |
| **Balance computation complexity** | JSONB split evaluation in Rust may be slower than pure SQL | See performance notes in `data-model.md`. Expected: < 100ms for realistic events. |
| **Multiple PgPool configurations** | Two pools (app schema + auth schema read-only) | Start with one pool (app schema). Add read-only auth pool only when needed. |
| **Sentinel public key rotation** | If Sentinel rotates its key, all tokens become invalid until pitboss-api is restarted | Monitor Sentinel's JWKS endpoint and support hot-reload of public key in Phase 2. |
| **Missing Diesel's `schema.rs`** | Hand-written `FromRow` structs may drift from actual DB schema | Every migration adds/removes columns → update the corresponding `FromRow` struct. Migration review checklist. |
| **Dependency version mismatches** | Axum 0.8 + tower-http 0.6 + sqlx 0.8 may have compatibility issues | Pin exact versions in Cargo.toml and verify with `cargo check` after initial setup. |

---

*Next: backend-rust agent begins implementation at [Phase 1](#phase-1-foundation-cargotoml--core-files)*
