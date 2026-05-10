#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="moshsplit"

mkdir -p "$PROJECT_NAME"/{apps,docs,infra,packages,scripts,vendor}
mkdir -p "$PROJECT_NAME"/apps/{web,pitboss-api}
mkdir -p "$PROJECT_NAME"/infra/{compose,docker,pulumi,scripts}

mkdir -p "$PROJECT_NAME"/.opencode/{agents,memory,skills,prompts}
mkdir -p "$PROJECT_NAME"/.opencode/agents/{architect,backend-rust,frontend,devops}
mkdir -p "$PROJECT_NAME"/.opencode/memory/{architecture,product,decisions,experiments}
mkdir -p "$PROJECT_NAME"/.opencode/skills/{architect,backend-rust,frontend,devops}

cat > "$PROJECT_NAME/.gitignore" <<'EOF'
# Dependencies
node_modules/
target/

# Env
.env
.env.*
!.env.example

# Build outputs
dist/
build/
coverage/

# Vendor is local-only
vendor/

# Editor
.idea/
.vscode/
.DS_Store

# Logs
*.log

# Local database/data
.data/
tmp/
EOF

cat > "$PROJECT_NAME/.opencode/AGENTS.md" <<'EOF'
# MoshSplit Agent Instructions

MoshSplit is a transparent shared-expense coordination app for friend groups, festivals, and trips.

Core rule:

Expenses can change.
Payments are immutable.
Balances are computed.

Never hide balance logic. Always preserve explainability.
EOF

cat > "$PROJECT_NAME/.opencode/context.md" <<'EOF'
# MoshSplit Context

Primary use case:

- Group: Vira Latas
- Event: Wacken 2026

MoshSplit helps users understand:

- who owes whom
- how much
- why
- which expense caused the debt
- how the debt changed over time

The app is offline-first PWA and fully dockerized.

Backend service name:

- pitboss-api

Database schemas:

- auth: managed by Sentinel
- app: managed by MoshSplit
EOF

cat > "$PROJECT_NAME/README.md" <<'EOF'
# MoshSplit

Transparent shared-expense management for chaotic friend groups.

## Structure

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
EOF
