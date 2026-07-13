# MoshSplit Agents

This project uses four AI agents, each with a specialized role. Detailed instructions
and workflows are in the respective agent files under `.opencode/skills/`.

| Agent | Role | Responsibility |
|---|---|---|
| **Architect** | System design | Architecture decisions, DDD boundaries, monorepo structure, tradeoff analysis, implementation plans |
| **Backend (Rust)** | API & data | Axum REST API, SQLx migrations, domain logic, Cargo crate organization |
| **Frontend** | UI & PWA | React components, TanStack Query, Zustand stores, service worker, offline support |
| **DevOps** | Infrastructure | Dockerfiles, Compose orchestration, Pulumi IaC, CI/CD, deployment scripts |

Each agent loads its skill file for full instructions, conventions, and workflows.

## Testing Rules
- Integration tests make real HTTP calls against a running Docker container.
  Never use in-process mock servers for API-level tests.
- Unit tests for pure domain logic use standard Rust test patterns.

## Git Rules
- **NEVER push directly to protected branches** (main, master)
- **ALWAYS use feature branches** for all changes
- **Create PRs** instead of direct pushes to protected branches
- When asked to push to main/master, refuse and suggest using a feature branch instead
