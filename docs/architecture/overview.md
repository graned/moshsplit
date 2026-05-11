# MoshSplit Architecture Overview

> **Status**: Draft  
> **Last Updated**: 2026-05-10

---

## 1. System Context & Purpose

MoshSplit is a **transparent shared-expense management platform** designed for chaotic friend groups — trips, festivals, and group events where expenses are messy, plans change, and clarity matters.

Unlike Splitwise and similar tools that treat balances as opaque snapshots, MoshSplit's core philosophy is:

> **Never hide the math.** Every balance must be explainable. Every debt must be traceable to its source expense, payment, or settlement.

### Primary Use Case

- **Group**: Vira Latas
- **Event**: Wacken 2026
- **Problem**: 15 friends splitting festival costs across hotels, tickets, gear, food runs, and last-minute changes — with full transparency on who owes whom what and why.

---

## 2. Architectural Principles

### The Three Invariants

These three rules govern every data decision in the system:

| # | Invariant | Meaning | Implication |
|---|-----------|---------|-------------|
| 1 | **Expenses can change** | An expense record may be edited after creation. All changes are **versioned** — history is preserved, never overwritten. | Each expense has a version chain. Current state is the latest approved version. |
| 2 | **Payments are immutable** | Once a payment is recorded, it can never be altered, deleted, or reverted. A correction is a **new payment**. | Payments form an append-only ledger. No `UPDATE` or `DELETE` on payments. |
| 3 | **Balances are computed** | Net balances are never stored as a source of truth. They are **derived on demand** from current expense versions, immutable payments, and settlements. | No `balance` column on user or event tables. Balance is a query/function result. |

### Core Philosophy

> **This is NOT an accounting application.**
> This is a **transparent shared-expense coordination app** for friend groups and trips.
> The most important feature is: **Trust through explainability.**

### Derived Principles

- **Explainability**: Every balance view must answer: who owes whom, how much, why, which expense created the debt, how the debt changed over time, and which payments modified the balance.
- **Append-only audit trail**: All financial state changes are recorded as immutable or versioned rows. Nothing is truly deleted.
- **Offline-first**: The PWA must function without connectivity for reads and queued mutations. Users must be able to open the app, create/edit expenses, and view balances offline — queueing all changes for sync when connectivity returns.
- **Monetary precision only**: All money values are integer cents. No floats, no rounding errors.

---

## 3. High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             Browser (PWA)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   React + Vite + TypeScript                      │   │
│  │                                                                  │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────┐  ┌─────────────┐  │   │
│  │  │ TanStack │  │   Zustand    │  │  PWA    │  │   Service   │  │   │
│  │  │  Query   │  │  Auth Store  │  │  Cache  │  │   Worker    │  │   │
│  │  └──────────┘  └──────────────┘  └─────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                     │                                   │
│                           HTTP (TLS) │                                   │
│                    ┌─────────────────┼──────────────────┐               │
│                    ▼                 ▼                   ▼               │
│          ┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐   │
│          │   Sentinel      │ │   pitboss-api    │ │    Object     │   │
│          │   Auth Service  │ │   (Axum/Rust)    │ │    Storage     │   │
│          │   Port 9000     │ │   Port 8080      │ │   (future)     │   │
│          └────────┬────────┘ └────────┬─────────┘ └────────────────┘   │
│                   │                   │                                 │
│                   └────────┬──────────┘                                 │
│                            ▼                                            │
│                  ┌──────────────────┐                                   │
│                  │   PostgreSQL     │                                   │
│                  │   ┌──────────┐   │                                   │
│                  │   │  auth    │   │  (managed by Sentinel)            │
│                  │   │  schema  │   │                                   │
│                  │   ├──────────┤   │                                   │
│                  │   │  app     │   │  (managed by pitboss-api)         │
│                  │   │  schema  │   │                                   │
│                  │   └──────────┘   │                                   │
│                  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘

                            Docker Compose (dev) / Pulumi (prod)
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Browser (PWA)** | Offline-first React app. Caches events, expenses, and balances. Queues mutations offline. |
| **Sentinel** | External vendored auth service. Manages users, sessions, MFA, RBAC, OIDC. PASETO tokens. |
| **pitboss-api** | Axum/Rust backend. Domain logic for events, expenses, payments, settlements, balance computation. Enforces event membership. |
| **PostgreSQL (`auth`)** | User accounts, identities, sessions, MFA secrets. Managed exclusively by Sentinel. |
| **PostgreSQL (`app`)** | Events, expense versions, payments, settlements, event membership. Managed exclusively by pitboss-api. |

---

## 4. Technology Rationale

### Why Rust + Axum

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Language | **Rust** | Memory safety, performance for balance computation, strong typing to prevent monetary errors, excellent async ecosystem. |
| Web framework | **Axum** | Ergonomic, tower-based middleware, strong typing with extractors, great async support. |
| ORM / DB | **SQLx** | Compile-time checked SQL, no ORM overhead, direct control over queries, excellent PostgreSQL support. |
| Auth | **Sentinel** (vendored) | Externalized auth means zero custom auth code. PASETO tokens (safer than JWT). MFA, RBAC, OIDC out of the box. |

### Why React + Vite + TypeScript

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Framework | **React** | Mature ecosystem, excellent PWA/offline support, large community. |
| Build tool | **Vite** | Fast HMR, native TypeScript, modern ESM-based dev server. |
| State/cache | **TanStack Query** | Server state synchronization, caching, background refetch, offline mutation queue. |
| Client state | **Zustand** | Lightweight, TypeScript-native, persist middleware for auth tokens. |
| PWA | **Workbox / vite-plugin-pwa** | Service worker caching, offline fallback, mutation queue sync. |

### Currency Philosophy

- **Base currency is EUR** — all accounting and calculations are performed in EUR cents
- **Other currencies (BRL, USD, COP, MXN, etc.) are cosmetic display estimates only** — they are converted for user convenience but have no effect on balances, debts, settlements, payments, or expense history
- **Exchange rates must NEVER affect balances** — changing rates are a display concern only; the canonical financial record is always in EUR cents
- **No floating point** — avoids `0.1 + 0.2 = 0.30000000000000004` bugs
- **Deterministic balance computation** — division yields remainders, which are handled via rounding rules (e.g., "penny rounding" — distribute remainder to earliest/largest share)
- **Simple serialization** — transmit as `{ "amount_cents": 1234, "currency": "EUR" }`, display formatted per locale

### Why Separate `auth` and `app` DB Schemas

- **Security boundary**: Sentinel's user data is never directly touched by pitboss-api
- **Ownership clarity**: Each service owns its schema, migrates independently
- **Defense in depth**: Even if pitboss-api is compromised, auth data is in a separate schema with different connection credentials
- **Clean migration paths**: Schema-level isolation means zero migration conflicts between auth and app

---

## 5. Deployment Architecture

### Development (Docker Compose)

```
┌─────────────────────────────────────────────────────┐
│                  Docker Compose                       │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  nginx   │  │ sentinel  │  │  postgres │           │
│  │  (proxy) │  │  :8000   │  │  :5432    │           │
│  └────┬─────┘  └──────────┘  └──────────┘           │
│       │                                              │
│  ┌────▼─────┐  ┌──────────┐                          │
│  │ pitboss  │  │   web    │                          │
│  │  :8080   │  │  :5173   │                          │
│  └──────────┘  └──────────┘                          │
│                                                       │
│  Volumes: postgres_data                               │
│  Networks: app-net (bridge)                           │
└─────────────────────────────────────────────────────┘
```

### Production (Pulumi — target)

```
┌────────────────────────────────────────────────────────────┐
│                      Cloud Provider                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  ALB / NLB   │  │  PostgreSQL  │  │  Object      │      │
│  │  (TLS term)  │  │  (managed)   │  │  Storage     │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│    ┌────┴────┐                                              │
│    │  ECS /  │                                              │
│    │  Fargate│                                              │
│    │ ┌──────┐│                                              │
│    │ │ nginx││                                              │
│    │ ├──────┤│                                              │
│    │ │pitboss│                                              │
│    │ ├──────┤│                                              │
│    │ │sentinel│                                             │
│    │ └──────┘│                                              │
│    └─────────┘                                              │
│                                                              │
│  CDN: CloudFront (static assets)                            │
│  DNS: Route53 / Cloudflare                                  │
│  Monitoring: CloudWatch / Sentry                            │
└────────────────────────────────────────────────────────────┘
```

### Container Architecture

| Service | Image | Port(s) | Dependencies |
|---------|-------|---------|--------------|
| `postgres` | `postgres:16-alpine` | 5432 | — |
| `sentinel` | Custom (vendored) | 9000→8000 | postgres |
| `pitboss-api` | Custom (build from `apps/pitboss-api`) | 8080 | postgres, sentinel |
| `web` | Custom (build from `apps/web`) | 5173 | pitboss-api, sentinel |
| `nginx` (prod) | `nginx:alpine` | 443, 80 | pitboss-api, web |

### Environment Configuration

| Variable | Scope | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | pitboss-api, sentinel | PostgreSQL connection |
| `HEX_KEY` | sentinel | PASETO token encryption (32-byte hex) |
| `CONFIG_ENCRYPTION_KEY` | sentinel | Sentinel config encryption (32-byte hex) |
| `SENTINEL_PUBLIC_KEY` | pitboss-api | Verify PASETO tokens issued by sentinel |
| `CORS_ALLOWED_ORIGINS` | sentinel, pitboss-api | CORS origin whitelist |
| `RUST_LOG` | pitboss-api, sentinel | Logging verbosity |

---

## 6. Monorepo Structure

```
moshsplit/
├── apps/
│   ├── web/                        # React PWA (frontend)
│   │   ├── src/
│   │   │   ├── api/                # API client, TanStack Query hooks
│   │   │   ├── components/         # UI components
│   │   │   ├── pages/              # Route pages
│   │   │   ├── stores/             # Zustand stores (auth)
│   │   │   ├── hooks/              # Custom hooks
│   │   │   ├── lib/                # Utility functions
│   │   │   └── types/              # TypeScript types
│   │   ├── public/                 # Static assets, service worker
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── pitboss-api/                # Axum backend (Rust)
│       ├── src/
│       │   ├── main.rs
│       │   ├── routes/             # Axum route handlers
│       │   ├── domain/             # Domain logic (entities, errors)
│       │   ├── db/                 # Database queries, migrations
│       │   ├── auth/               # Sentinel token verification
│       │   └── api/                # Request/response types
│       ├── migrations/             # SQLx migrations (app schema)
│       ├── Cargo.toml
│       └── Dockerfile
│
├── packages/                       # Shared packages (future)
│   ├── types/                      # Shared TypeScript types
│   └── config/                     # Shared config
│
├── docs/                           # Architecture documentation
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── data-model.md
│   │   ├── api-design.md
│   │   └── security.md
│   ├── decisions/
│   │   └── README.md
│   └── integrations/
│       └── sentinel-integration-guide.md
│
├── infra/
│   ├── compose/                    # Docker Compose files
│   │   ├── dev.yml                 # Development compose
│   │   └── prod.yml                # Production compose
│   ├── docker/                     # Dockerfiles
│   │   ├── pitboss-api.Dockerfile
│   │   ├── web.Dockerfile
│   │   └── nginx.conf
│   ├── pulumi/                     # Pulumi IaC (future)
│   └── scripts/                    # Infrastructure scripts
│
├── scripts/                        # Dev scripts
│   ├── starter.sh
│   └── create-opencode-agents.sh
│
├── vendor/                         # Vendored dependencies (gitignored)
│   └── sentinel/                   # Sentinel auth service
│
└── .opencode/                      # AI agent configuration
```

---

## 7. Key Architectural Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monolith vs microservices | **Structured monolith** (pitboss-api) | Single deployable. Domain boundaries in code, not networks. Avoids distributed system complexity for a small team. |
| Auth service | **Vendored (Sentinel)** | Zero custom auth code. Well-tested, security-audited auth. Decoupled from app logic. |
| Frontend offline | **PWA + TanStack Query** | Creates/resolves mutations offline. Sync on reconnect. Cached balance views work without internet. |
| Database schemas | **auth + app** (same PG instance) | Cheaper than separate DBs, still provides schema-level isolation. Different connection credentials per schema. |
| Balance computation | **On-demand query** | No stale balance cache. Always derived from current data. Performance is acceptable for group-scale (tens of users, hundreds of expenses). |
| Monetary precision | **Integer cents** | No floating point errors. Deterministic, auditable. Standard in financial systems. |
| API versioning | **URL prefix (`/v1/`)** | Simple, explicit, cache-friendly. Easy to deprecate old versions. |
| API style | **RESTful** | Familiar, cacheable, good tooling. Not GraphQL — balances are computed server-side with a fixed schema. |

---

## 8. Tradeoffs & Risks

| Risk | Mitigation |
|------|------------|
| Balance computation performance at scale | Index expense_versions, payments, settlements on event_id + created_at. Consider materialized view if query time exceeds 200ms for >500 expenses. |
| Offline mutation conflicts | Use optimistic concurrency (version field on expenses). Last-write-wins for non-conflicting fields; flag conflicts for manual resolution. |
| Sentinel as external dependency | Vendored in repo. Dockerized. Pinned version. Integration tests against real sentinel container. |
| PWA complexity | Ship PWA features incrementally. Phase 1: online-only with caching. Phase 2: offline reads. Phase 3: offline mutations. |
| Integer cents UX | Frontend must format cents to display currency correctly. Consistent use of `formatCents()` utility. |

---

## 9. Related Documentation

- [Branding & Theme](../branding.md) — Logo configuration, color palette, metal/rock theme design

---

*Next: [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)*
