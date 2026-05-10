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
| **Balances are computed** | Balances are never stored. They are derived from the difference between expenses and payments. | No sync bugs, no stale state, no "the app says I owe €50 but I swear I paid." Balances are always correct by construction. |

> **Trust through explainability.** Every number in MoshSplit can be traced back to its source. If someone asks "why do I owe €47.32?", the app can show the exact chain of expenses, payments, and splits that produced that number.

---

## Primary Use Case

- **Group:** Vira Latas
- **Event:** Wacken 2026
- **Members:** ~10 friends sharing fuel, food, camping, merch, and chaos
- **Goal:** Zero arguments about money, maximum fun at Wacken

---

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌────────────┐
│   React PWA  │────▶│  Pitboss API │────▶│ PostgreSQL │
│  (apps/web/) │     │ (Rust/Axum)  │     │            │
└──────────────┘     └──────────────┘     └────────────┘
        │                    │
        │                    │
        ▼                    ▼
┌──────────────┐     ┌──────────────┐
│  Service     │     │   Sentinel   │
│  Worker      │     │   (Auth)     │
│  (offline)   │     │  (vendored)  │
└──────────────┘     └──────────────┘
```

- **Frontend:** React SPA with PWA offline support. State managed with Zustand, server state cached with TanStack Query. Service worker handles offline mutations with a sync queue.
- **Backend:** Axum REST API. Domain-driven design with clean module boundaries. SQLx for compile-time checked SQL against PostgreSQL.
- **Auth:** Sentinel — a vendored auth service running as a separate Docker container. Handles registration, login, session management.
- **Infra:** Fully Dockerized for development. Pulumi for production deployments. Everything runs in Compose locally.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS |
| PWA | Vite PWA plugin, Service Worker, IndexedDB (Dexie) |
| Backend | Rust, Axum, SQLx, tokio, serde |
| Database | PostgreSQL 16 |
| Auth | Sentinel (vendored) |
| Container | Docker, Docker Compose |
| Infra (prod) | Pulumi (AWS) |
| Package mgmt | pnpm (workspaces), Cargo |

### Currency Model

- **Base currency:** EUR
- **All amounts stored as integer cents** (€47.32 → `4732`)
- Other currencies are display-only via real-time exchange rates
- No multi-currency splitting — simplifies the math and avoids floating-point disasters

---

## Quick Start

```bash
# Clone and start everything
git clone <repo-url> moshsplit
cd moshsplit
docker compose up
```

This starts:
- **PostgreSQL** on `:5432`
- **Pitboss API** on `:3000`
- **Web frontend** on `:5173` (with HMR)
- **Sentinel auth** on `:8080`

See [`infra/compose/`](./infra/compose/) for Compose files.

---

## Monorepo Structure

```
moshsplit/
├── apps/
│   ├── web/                    # React PWA (Vite + TypeScript)
│   └── pitboss-api/            # Axum REST API (Rust)
├── packages/                   # Shared packages (TypeScript, configs, etc.)
├── docs/
│   ├── architecture/           # ADRs, system design docs
│   ├── decisions/              # Decision records
│   └── integrations/           # Third-party integration docs
├── infra/
│   ├── compose/                # Docker Compose files
│   ├── docker/                 # Dockerfiles
│   ├── pulumi/                 # Pulumi IaC (AWS)
│   └── scripts/                # Infra helper scripts
├── scripts/                    # Development scripts
├── vendor/                     # Vendored dependencies (gitignored)
│   └── sentinel/               # Auth service
└── .opencode/                  # AI agent configuration
```

---

## Key Principles

1. **Trust through explainability** — Every number is traceable. No black-box calculations.
2. **Offline-first** — The PWA must work without internet. Mutations queue and sync when connectivity returns.
3. **Integer cents** — No floating-point money. Store `4732`, display `€47.32`.
4. **EUR base** — Single currency for calculations. Display-only conversions.
5. **Immutable payments** — Payments are audit logs. Corrections are new entries.
6. **Computed balances** — Never store what can be derived. Balances = expenses − payments.
7. **Structured monolith** — DDD boundaries within a single deployable backend. No premature microservices.
8. **Stable, versioned APIs** — API changes are additive and versioned. No breaking changes without a new version.

---

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Rust (latest stable)
- Docker & Docker Compose
- PostgreSQL 16 (optional — Docker handles this)

### Local (without Docker)

```bash
# Install frontend dependencies
pnpm install

# Start PostgreSQL (or use Docker)
docker compose up -d postgres

# Run database migrations
cd apps/pitboss-api
cargo sqlx migrate run

# Start backend
cargo run

# In another terminal, start frontend
cd apps/web
pnpm dev
```

### Environment Variables

See `.env.example` files in each app directory. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SENTINEL_URL` | Sentinel auth service URL |
| `JWT_SECRET` | JWT signing secret |

### Commit Conventions

This project uses conventional commits:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code restructuring
- `test:` — adding/updating tests
- `chore:` — maintenance tasks

---

## License

MIT — because splitting expenses shouldn't cost money.
