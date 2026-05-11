# MoshSplit

**Transparent shared-expense management for chaotic friend groups.**

Never hide the math.

---

## Core Philosophy

MoshSplit is built around three invariants that make expense tracking trustworthy for groups of friends:

| Invariant | Principle | Why it matters |
|---|---|---|
| **Expenses can change** | Expenses are mutable until settled. Splits can be edited, amounts corrected, details updated. The group always sees the latest intent. | Real life is messy — people forget costs, prices change, someone buys an extra round. Don't lock people into wrong numbers. |
| **Payments are immutable** | Once a payment is recorded, it is never deleted or altered. Corrections are new payments. | Immutability creates an auditable trail. No one can "unpay" or rewrite history. Trust comes from transparency. |
| **Balances are computed** | Balances are never stored. They are derived from the difference between expenses and payments. | No sync bugs, no stale state, no "the app says I owe EUR 50 but I swear I paid." Balances are always correct by construction. |

> **Trust through explainability.** Every number in MoshSplit can be traced back to its source. If someone asks "why do I owe EUR 47.32?", the app can show the exact chain of expenses, payments, and splits that produced that number.

> **This is not an accounting application.** This is a transparent shared-expense coordination app for friend groups, trips, and festivals. The most important feature is explainability.

---

## Primary Use Case

- **Group:** Vira Latas
- **Event:** Wacken 2026
- **Members:** ~15 friends sharing fuel, food, camping, merch, and chaos
- **Goal:** Zero arguments about money, maximum fun at Wacken

---

## Quick Start

```bash
# Clone and start everything
git clone <repo-url> moshsplit
cd moshsplit
docker compose -f infra/compose/dev.yml up
```

This starts:
- **PostgreSQL 16** on `:5432` (with `auth` and `app` schemas)
- **Pitboss API** (Rust/Axum) on `:8080` (hot-reload via cargo-watch)
- **Sentinel** (auth service) on `:9000` (PASETO tokens, RBAC, MFA)
- **Sentinel UI** (admin dashboard) on `:3000`
- **Web frontend** (React PWA) on `:5173` (Vite HMR) — commented out by default

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Pitboss API | http://localhost:8080 | Main REST API |
| Sentinel | http://localhost:9000 | Auth service (v1 API) |
| Sentinel UI | http://localhost:3000 | Admin dashboard (login: admin/admin) |
| PostgreSQL | localhost:5432 | Database (user: postgres, password: password, db: moshsplit) |

For production: `docker compose -f infra/compose/prod.yml up` (requires `.env` file, see below).

---

## Project Structure

```
moshsplit/
├── apps/
│   ├── pitboss-api/                    # Rust Axum backend
│   │   ├── src/
│   │   │   ├── main.rs                 # Binary entrypoint
│   │   │   ├── lib.rs                  # Library root, public modules
│   │   │   ├── errors.rs               # 4-layer error hierarchy
│   │   │   ├── applications/           # Use-case orchestrators (thin)
│   │   │   ├── domain/                 # Domain logic
│   │   │   │   └── repositories/       # Repository implementations
│   │   │   ├── schema_enums.rs        # Database enums (at src root)
│   │   │   ├── schema_models.rs        # Diesel-generated models (at src root)
│   │   │   ├── services/               # Domain services (stateless logic)
│   │   │   ├── infrastructure/
│   │   │   │   ├── clients/
│   │   │   │   │   └── pg_client.rs    # PgPool wrapper (max 20 connections)
│   │   │   │   └── http/
│   │   │   │       ├── app.rs          # build_app() DI container
│   │   │   │       ├── server.rs       # HttpServer with graceful shutdown
│   │   │   │       ├── api/
│   │   │   │           ├── handlers/   # 27 REST endpoint handlers
│   │   │   │           ├── middlewares/ # RequestId + ResponseWrapper layers
│   │   │   │           ├── routes/     # api_router with full middleware stack
│   │   │   │           ├── types/      # ApiResponse<T> envelope + RequestId
│   │   │   │           └── dtos/       # Request/response DTOs
│   │   │   └── utils/
│   │   │       └── impl_repository.rs  # Diesel CRUD macro
│   │   ├── tests/                      # 62 integration tests
│   │   │   ├── common/mod.rs           # Test helpers
│   │   │   ├── balances_api.rs         # 5 tests
│   │   │   ├── events_api.rs           # 15 tests
│   │   │   ├── expenses_api.rs         # 14 tests
│   │   │   ├── payments_api.rs         # 9 tests
│   │   │   └── settlements_api.rs      # 12 tests
│   │   ├── scripts/
│   │   │   ├── gen_diesel_types.sh     # Diesel schema/models/enums generator
│   │   │   └── update_schema_patch.sh  # schema.patch regeneration
│   │   ├── Cargo.toml
│   │   ├── Cargo.lock
│   │   ├── diesel.toml                 # Diesel config for app schema
│   │   └── .env.example
│   │
│   └── web/                            # React PWA (scaffold — not yet implemented)
│
├── packages/                           # Shared TypeScript packages (future)
│
├── docs/
│   ├── architecture/                   # System design documentation
│   │   ├── overview.md                 # Context, principles, component diagram
│   │   ├── data-model.md               # Core entities, relationships, balance computation
│   │   ├── api-design.md               # REST conventions, endpoints, error handling
│   │   ├── security.md                 # Sentinel auth, authorization, data isolation
│   │   ├── database-schema.md          # Full DDL, Mermaid ERD, indexes, query patterns
│   │   ├── rust-db-mapping.md          # Type mapping, SQLx patterns, error handling
│   │   └── pitboss-api-scaffold.md     # Project structure following Clean Architecture
│   ├── decisions/
│   │   └── README.md                   # ADR index and template
│   └── integrations/                   # Third-party integration docs (future)
│
├── infra/
│   ├── compose/
│   │   ├── dev.yml                     # Dev compose (hot-reload, bind mounts)
│   │   ├── prod.yml                    # Prod compose (healthchecks, restart)
│   │   └── init/
│   │       └── 01-init-schemas.sql     # DB init: auth + moshsplit schemas, roles
│   ├── docker/
│   │   ├── pitboss-api.Dockerfile      # Multi-stage (dev: cargo-watch, prod: release)
│   │   └── web.Dockerfile              # Multi-stage (dev: HMR, prod: nginx)
│   └── pulumi/                         # Pulumi IaC for AWS (future)
│
├── scripts/
│   ├── starter.sh                      # Dev environment setup
│   └── create-opencode-agents.sh       # AI agent scaffolding
│
├── vendor/
│   └── sentinel/                       # Vendored auth service (gitignored, pending)
│
├── .opencode/                          # AI agent configuration
│   ├── AGENTS.md
│   ├── agents/
│   ├── skills/
│   └── ...
│
├── .gitignore                          # 11 categories (Node, Rust, IDE, etc.)
├── .dockerignore
├── .npmrc
├── package.json                        # pnpm workspace root
├── pnpm-workspace.yaml                 # apps/* and packages/*
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 6, TanStack Query, Zustand, Tailwind CSS |
| PWA | vite-plugin-pwa, Service Worker, IndexedDB (Dexie) |
| Backend | Rust (edition 2021), Axum 0.8, Diesel 2.x, tokio, serde, thiserror, tower-http |
| Database | PostgreSQL 16 (two schemas: `auth` + `moshsplit`) |
| Auth | Sentinel (Docker container — PASETO tokens, RBAC, MFA, OIDC) |
| Container | Docker, Docker Compose (multi-stage Dockerfiles) |
| Infrastructure (prod) | Pulumi (AWS — target) |
| Package management | pnpm 9+ (workspaces), Cargo |
| Tooling | diesel-cli (schema/models), cargo-watch (dev hot-reload) |

### Currency Model

- **Base currency:** EUR — all calculations in integer cents
- **Exchange rates NEVER affect balances** — display-layer conversion only
- **No floating-point money** — store `4732`, display `EUR 47.32`
- **Deterministic rounding** — penny rounding distributes remainder

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   React PWA  │────▶│  Pitboss API │────▶│   PostgreSQL 16      │
│  (apps/web/) │     │ (Rust/Axum)  │     │  ┌────────┐          │
└──────────────┘     └──────────────┘     │  │ auth   │ Sentinel │
        │                    │            │  │ schema │ (Docker) │
        │                    │            │  ├────────┤──────────┤
        ▼                    ▼            │  │  app   │ pitboss  │
┌──────────────┐     ┌──────────────┐     │  │ schema │  API     │
│  Service     │     │   Sentinel   │     └──┴────────┴──────────┘
│  Worker      │     │   (Auth)     │
│  (offline)   │     │  (container)│
└──────────────┘     └──────────────┘
```

- **Frontend:** React SPA with PWA offline support. Zustand for client state, TanStack Query for server state caching and offline mutation queue.
- **Backend:** Axum REST API with Clean Architecture (services -> repositories -> infrastructure). Diesel for type-safe SQL. All 27 endpoints implemented with OpenAPI/Swagger docs.
- **Auth:** Sentinel — auth service running as a Docker container. PASETO tokens, RBAC, MFA, OIDC. Zero custom auth code.
- **Infra:** Fully Dockerized (dev: hot-reload bind mounts, prod: healthchecks, restart policies). Pulumi target for AWS production.
- **Structured monolith:** Domain boundaries in code, not networks. No premature microservices.

See [Architecture Overview](docs/architecture/overview.md) for full details.

---

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Rust (latest stable, edition 2021)
- Docker & Docker Compose
- PostgreSQL 16 (optional — Docker handles this)

### Run with Docker (recommended)

```bash
# Full stack (includes Sentinel auth)
docker compose -f infra/compose/dev.yml up

# Rebuild after Cargo.toml changes
docker compose -f infra/compose/dev.yml build pitboss-api
docker compose -f infra/compose/dev.yml up

# View logs for a specific service
docker compose -f infra/compose/dev.yml logs -f sentinel
docker compose -f infra/compose/dev.yml logs -f pitboss-api
```

### First-time Sentinel Setup

The Sentinel auth service runs on port 9000. On first start:

1. Open http://localhost:3000 (Sentinel UI)
2. Login with default credentials: `admin` / `admin`
3. Create an API key for the pitboss-api service
4. Update the pitboss-api configuration with the Sentinel public key

For development, a pre-configured HEX_KEY is provided in `dev.yml`.

### Run locally (without Docker)

```bash
# Install frontend dependencies
pnpm install

# Start PostgreSQL (or use Docker)
docker compose -f infra/compose/dev.yml up postgres

# Run pitboss-api
cd apps/pitboss-api
cp .env.example .env          # edit DATABASE_URL if needed
cargo run

# In another terminal, start frontend
cd apps/web
pnpm dev
```

### Run tests

```bash
# Start Docker services first
docker compose -f infra/compose/dev.yml up -d

# pitboss-api integration tests (against real Docker API)
cd apps/pitboss-api
cargo test

# Run specific test file
cargo test --test events_api
```

**Test Suite:** 62 tests across 6 test files covering:
- Events CRUD (15 tests)
- Expenses with versioning (14 tests)
- Payments (9 tests)
- Settlements with status workflow (12 tests)
- Balances with greedy debt simplification (5 tests)
- Envelope structure (2 tests)
- Health checks (5 tests)

### Environment Variables

#### pitboss-api (Backend)

See `apps/pitboss-api/.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgres://pitboss:password@postgres:5432/moshsplit`) |
| `HOST` | Server bind address (default: `0.0.0.0`) |
| `PORT` | Server port (default: `8080`) |
| `RUST_LOG` | Logging verbosity (default: `info`) |
| `SENTINEL_URL` | Sentinel auth service URL (default: `http://sentinel:8000`) |
| `SENTINEL_PUBLIC_KEY` | Sentinel public key for token validation (production) |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins (comma-separated) |

#### Sentinel (Auth Service)

For production, set these environment variables (e.g., in `.env`):

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (shared with pitboss-api) |
| `HEX_KEY` | 64-character hex key for token signing (generate with `openssl rand -hex 32`) |
| `CONFIG_ENCRYPTION_KEY` | 64-character hex key for config encryption |
| `OIDC_ISSUER_URL` | OIDC issuer URL (e.g., `https://auth.yourdomain.com`) |
| `FRONTEND_URL` | Frontend URL for CORS and redirects |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins |
| `SENTINEL_PORT` | Sentinel API port (default: `9000`) |
| `SENTINEL_UI_PORT` | Sentinel UI port (default: `3000`) |

Example `.env` file for production:

```bash
# Database
DATABASE_URL=postgres://pitboss:${PITBOSS_PASSWORD}@postgres:5432/moshsplit
POSTGRES_PASSWORD=your_secure_password
POSTGRES_USER=postgres

# Sentinel
HEX_KEY=$(openssl rand -hex 32)
CONFIG_ENCRYPTION_KEY=$(openssl rand -hex 32)
OIDC_ISSUER_URL=https://auth.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Application
RUST_LOG=info
PITBOSS_API_PORT=8080
SENTINEL_PORT=9000
SENTINEL_UI_PORT=3000
```

### Commit Conventions

```
feat:     new feature
fix:      bug fix
docs:     documentation
refactor: code restructuring
test:     adding/updating tests
chore:    maintenance tasks
```

---

## Key Principles

1. **Trust through explainability** — Every number is traceable. No black-box calculations.
2. **Offline-first** — The PWA must work without internet. Mutations queue and sync when connectivity returns.
3. **Integer cents** — No floating-point money. Store `4732`, display `EUR 47.32`.
4. **EUR base, display-only conversions** — Single currency for calculations. Exchange rates never affect balances.
5. **Immutable payments** — Payments are audit logs. Corrections are new entries.
6. **Computed balances** — Never store what can be derived. Balances = expenses - payments.
7. **Expense versioning** — Expenses are versioned, never overwritten. Full change history.
8. **Structured monolith** — DDD boundaries within a single deployable backend. No premature microservices.
9. **Stable, versioned APIs** — API changes are additive and URL-prefix versioned.
10. **Schema-level isolation** — `auth` schema (Sentinel) and `moshsplit` schema (pitboss-api) in the same database with separate credentials.
11. **Input validation at API boundary** — Invalid UUIDs, negative amounts, empty names, non-member payers all rejected with 400 errors.

---

## Documentation

### Architecture

| Document | Description |
|---|---|
| [Overview](docs/architecture/overview.md) | System context, principles, component diagram, technology rationale, deployment |
| [Data Model](docs/architecture/data-model.md) | Core entities, relationships, balance computation, currency model |
| [API Design](docs/architecture/api-design.md) | REST conventions, endpoint catalog, error handling, rate limiting |
| [Security](docs/architecture/security.md) | Sentinel auth, authorization model, data isolation, CORS |
| [Database Schema](docs/architecture/database-schema.md) | Full DDL, Mermaid ERD, 17 indexes, 6 critical query patterns |
| [Rust-PG Mapping](docs/architecture/rust-db-mapping.md) | Rust type mapping, SQLx query patterns, error handling, testing strategy |
| [pitboss-api Scaffold](docs/architecture/pitboss-api-scaffold.md) | Project structure design following Sentinel's Clean Architecture |

### Decisions

- [ADR Index](docs/decisions/README.md) — ADR catalog with template and pending decisions

---

## License

MIT — because splitting expenses shouldn't cost money.
