# Architecture Decision Records

> **Last Updated**: 2026-05-10

This directory contains Architecture Decision Records (ADRs) for MoshSplit. ADRs document significant architectural choices, including the context, decision, consequences, and tradeoffs.

## What is an ADR?

An Architecture Decision Record is a short document capturing:

- **Context**: What is the situation that requires a decision?
- **Decision**: What was chosen?
- **Consequences**: What are the tradeoffs, risks, and implications?
- **Status**: Proposed, Accepted, Deprecated, Superseded

## How to Write an ADR

1. Create a new file: `docs/decisions/NNNN-title-with-dashes.md`
2. Use the template below
3. Assign the next sequential number
4. Open a PR for review

## Template

```markdown
# ADR-NNNN: Title

> **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
> **Date**: YYYY-MM-DD
> **Deciders**: @username

## Context

What is the issue motivating this decision? What constraints exist?

## Decision

What was decided and why? Be specific.

## Consequences

- Positive: ...
- Negative: ...
- Risks: ...
- Mitigations: ...

## Alternatives Considered

- **Option A**: Why not chosen
- **Option B**: Why not chosen
```

---

## Index of ADRs

> ADRs are numbered sequentially. This index will be updated as ADRs are created.

| # | Title | Status | Date |
|---|-------|--------|------|
| — | No ADRs yet | — | — |

---

## Pending Decisions (To Be Documented as ADRs)

The following architectural decisions need formal ADRs. They are currently documented in other architecture documents and should be promoted to ADRs as they are finalized:

| # | Title | Referenced In | Priority |
|---|-------|---------------|----------|
| — | EUR as Base Accounting Currency | [Data Model](../architecture/data-model.md) | High |
| — | Structured Monolith over Microservices | [Overview](../architecture/overview.md) | High |
| — | Integer Cents for Monetary Values | [Data Model](../architecture/data-model.md) | High |
| — | On-Demand Balance Computation | [Data Model](../architecture/data-model.md) | High |
| — | Expense Versioning Strategy | [Data Model](../architecture/data-model.md) | High |
| — | Immutable Payments | [Data Model](../architecture/data-model.md) | High |
| — | Sentinel for Authentication | [Security](../architecture/security.md) | High |
| — | Exchange Rates Are Display-Only (Never Affect Balances) | [Overview](../architecture/overview.md) | High |
| — | Offline-First PWA as First-Class Requirement | [Overview](../architecture/overview.md) | High |
| — | Cursor-Based Pagination | [API Design](../architecture/api-design.md) | Medium |
| — | URL-Prefix API Versioning | [API Design](../architecture/api-design.md) | Medium |
| — | PASETO over JWT for Tokens | [Security](../architecture/security.md) | Medium |
| — | Full Dockerization (`docker compose up`) | [DevOps Agent](../.opencode/agents/devops/AGENT.md) | Medium |
| — | Docker Compose for Dev, Pulumi for Prod | [DevOps Agent](../.opencode/agents/devops/AGENT.md) | Low |

---

## How ADRs Relate to Architecture Documents

```
docs/
├── architecture/          # Living reference documents (updated as system evolves)
│   ├── overview.md        # High-level system picture
│   ├── data-model.md      # Entities, relationships, balance computation
│   ├── api-design.md      # Endpoints, conventions, error handling
│   └── security.md        # Auth, authorization, data isolation
│
├── decisions/             # Immutable decision records (never edited after acceptance)
│   ├── README.md          # This file — index and instructions
│   └── NNNN-*.md          # Individual ADRs
│
└── integrations/          # External system integration guides
    └── sentinel-integration-guide.md
```

**Key distinction**:
- **Architecture documents** are living references. They are updated as the system evolves to reflect current state.
- **ADRs** are immutable snapshots of decisions at the time they were made. They are never edited — if a decision changes, a new ADR supersedes the old one.

---

*Next: [Architecture Overview](../architecture/overview.md)*
