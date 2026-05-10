#!/usr/bin/env bash
set -euo pipefail

mkdir -p .opencode/agents/{architect,backend-rust,frontend,devops}
mkdir -p .opencode/skills/{architect,backend-rust,frontend,devops}
mkdir -p .opencode/memory/{architecture,product,decisions,experiments}

cat > .opencode/agents/architect/AGENT.md <<'EOF'
# Architect Agent

You are the architecture agent for MoshSplit.

## Responsibility

Design and protect the project architecture.

MoshSplit is a transparent shared-expense coordination app for friend groups, festivals, and trips.

## Core Rules

- Expenses can change.
- Payments are immutable.
- Balances are computed.
- Never store final balances as source of truth.
- Every balance must be explainable.
- Every debt must be traceable to its source expense, payment, or settlement.
- The app must be offline-first.
- The whole project must be fully dockerized.

## Architecture

Monorepo:

```text
moshsplit/
├── .opencode/
├── apps/
│   ├── web/
│   └── pitboss-api/
├── docs/
├── infra/
├── packages/
├── scripts/
└── vendor/
```

## Database

PostgreSQL schemas:

```text
auth - managed by Sentinel
app  - managed by MoshSplit
```

MoshSplit must not mutate Sentinel-managed tables directly.
EOF

cat > .opencode/agents/backend-rust/AGENT.md <<'EOF'
# Backend Rust Agent

You are the Rust backend agent for MoshSplit.

## Responsibility

Build `apps/pitboss-api`.

## Stack

- Rust
- Axum
- PostgreSQL
- SQLx
- Sentinel auth
- tracing
- Docker-first development

## Rules

- Use integer cents for money.
- Never use floating point for money.
- Expenses are versioned.
- Payments are immutable.
- Settlements are immutable except status transition.
- Balances are computed from current expense versions, payments, and settlements.
- All APIs must enforce event membership.
- Use clean modules and explicit domain boundaries.
EOF

cat > .opencode/agents/frontend/AGENT.md <<'EOF'
# Frontend Agent

You are the frontend agent for MoshSplit.

## Responsibility

Build `apps/web`.

## Stack

- React
- Vite
- TypeScript
- TanStack Query
- Zustand
- PWA
- Mobile-first UI

## UX Rules

The UI must always explain:

- who owes whom
- how much
- why
- which expense caused the debt
- what changed
- who already paid

## Offline Rules

The frontend must support:

- opening offline
- creating expenses offline
- editing expenses offline
- viewing cached balances offline
- queueing mutations
- syncing when online again

## UI Principle

No hidden Splitwise-style magic.

Every balance should have an expandable explanation.
EOF

cat > .opencode/agents/devops/AGENT.md <<'EOF'
# DevOps Agent

You are the DevOps agent for MoshSplit.

## Responsibility

Maintain Docker, local development, deployment, and infrastructure.

## Rules

- Everything must be dockerized.
- Development must run through Docker Compose.
- Compose files live in `infra/compose`.
- Dockerfiles live in `infra/docker`.
- Infrastructure scripts live in `infra/scripts`.
- Project scripts live in `scripts`.
- Pulumi lives in `infra/pulumi` if needed.
- `vendor/` is gitignored and local-only.
EOF

cat > .opencode/skills/architect/SKILL.md <<'EOF'
---
name: moshsplit-architect
description: Architecture guidance for MoshSplit shared-expense platform
---

# MoshSplit Architect Skill

Use this skill when designing domains, data flow, APIs, database structure, or app behavior.

## Core Product Rule

MoshSplit exists to make group expenses explainable.

Never hide the math.
EOF

cat > .opencode/skills/backend-rust/SKILL.md <<'EOF'
---
name: moshsplit-backend-rust
description: Rust Axum backend implementation guidance for MoshSplit
---

# MoshSplit Backend Rust Skill

Use this skill when working on `apps/pitboss-api`.

## Stack

- Rust
- Axum
- SQLx
- PostgreSQL
- Sentinel auth
- tracing
EOF

cat > .opencode/skills/frontend/SKILL.md <<'EOF'
---
name: moshsplit-frontend
description: React PWA frontend implementation guidance for MoshSplit
---

# MoshSplit Frontend Skill

Use this skill when working on `apps/web`.

## Stack

- React
- Vite
- TypeScript
- TanStack Query
- Zustand
- PWA
EOF

cat > .opencode/skills/devops/SKILL.md <<'EOF'
---
name: moshsplit-devops
description: Docker and infrastructure guidance for MoshSplit
---

# MoshSplit DevOps Skill

Use this skill for Docker, Compose, deployment, and environment setup.

## Rules

- Fully dockerized.
- Docker Compose for local development.
- Keep Dockerfiles in `infra/docker`.
- Keep compose files in `infra/compose`.
EOF

cat > .opencode/memory/product/core-principles.md <<'EOF'
# Core Product Principles

MoshSplit is not a Splitwise clone.

The product exists because Splitwise hides too much magic.

Main invariant:

```text
Expenses can change.
Payments are immutable.
Balances are computed.
```
EOF

echo "OpenCode agents, skills, and memory created."
