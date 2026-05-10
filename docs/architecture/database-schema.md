# MoshSplit Database Schema — `app` Schema

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Overview](./overview.md) · [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)

---

## 1. Schema Ownership & Boundaries

### 1.1 Two Schemas, Two Services

```
PostgreSQL Instance
├── auth schema (managed by Sentinel)
│   ├── users              ─┐
│   ├── user_identities     │ Read-only reference from pitboss-api
│   ├── sessions            │ via Sentinel API or read-only DB role
│   └── ...                ─┘
│
└── app schema (managed by pitboss-api)
    ├── event
    ├── event_member
    ├── expense
    ├── expense_version
    ├── expense_version_share   ← NEW (split normalization)
    ├── payment
    └── settlement
```

### 1.2 Rules

| Rule | Detail |
|------|--------|
| **No user/auth tables** | All user data lives in `auth` schema. `app` schema references users by UUID only. |
| **pitboss-api owns `app`** | Full CRUD on `app` schema. Runs SQLx migrations. |
| **pitboss-api never writes `auth`** | Read-only access via Sentinel API or read-only DB role. |
| **search_path** | `app, public` — ensures `app` is the default schema. |

---

## 2. Entity-Relationship Diagram

```mermaid
erDiagram
    %% ── External Entity (auth schema) ──
    User {
        uuid   id           PK
        text   first_name
        text   last_name
        text   avatar_url
    }

    %% ── Core Entities (app schema) ──
    Event {
        uuid        id          PK
        text        name
        text        description
        text        currency
        text        status
        uuid        created_by  FK(User)
        timestamptz created_at
        timestamptz updated_at
    }

    EventMember {
        uuid        id          PK
        uuid        event_id    FK(Event)
        uuid        user_id     FK(User)
        text        role
        timestamptz joined_at
        timestamptz left_at
    }

    Expense {
        uuid id              PK
        uuid event_id        FK(Event)
        uuid created_by      FK(User)
        uuid current_version_id FK(ExpenseVersion)
        timestamptz created_at
        timestamptz deleted_at
    }

    ExpenseVersion {
        uuid        id              PK
        uuid        expense_id      FK(Expense)
        int         version_number
        text        title
        text        description
        int         amount_cents
        uuid        paid_by         FK(User)
        text        split_type
        jsonb       split_data
        text        notes
        uuid        created_by      FK(User)
        timestamptz created_at
    }

    ExpenseVersionShare {
        uuid id                  PK
        uuid expense_version_id  FK(ExpenseVersion)
        uuid user_id             FK(User)
        int  share_cents
        int  share_order
    }

    Payment {
        uuid        id              PK
        uuid        event_id        FK(Event)
        uuid        from_user       FK(User)
        uuid        to_user         FK(User)
        int         amount_cents
        text        currency
        text        description
        text        payment_method
        text        external_ref
        uuid        recorded_by     FK(User)
        timestamptz recorded_at
    }

    Settlement {
        uuid        id              PK
        uuid        event_id        FK(Event)
        uuid        from_user       FK(User)
        uuid        to_user         FK(User)
        int         amount_cents
        text        status
        timestamptz settled_at
        uuid        created_by      FK(User)
        timestamptz created_at
    }

    %% ── Relationships ──
    Event  ||--o{ EventMember        : "has"
    Event  ||--o{ Expense            : "contains"
    Event  ||--o{ Payment            : "records"
    Event  ||--o{ Settlement         : "settles"

    Expense ||--o{ ExpenseVersion     : "versioned-by"
    Expense ||--o| ExpenseVersion     : "current-version (FK)"

    ExpenseVersion ||--o{ ExpenseVersionShare : "split-into"

    %% External (auth schema) references
    EventMember         }o--|| User  : "references"
    Expense             }o--|| User  : "created by"
    ExpenseVersion      }o--|| User  : "paid by"
    ExpenseVersionShare }o--|| User  : "owes"
    Payment             }o--|| User  : "from"
    Payment             }o--|| User  : "to"
    Settlement          }o--|| User  : "from"
    Settlement          }o--|| User  : "to"
```

> **Note**: `User` is an **external entity** managed by Sentinel in the `auth` schema. The `app` schema stores only UUID references — no user profile data. Relationships to `User` are conceptual/logical, not enforced as foreign keys to an `app`-schema table.

---

## 3. Table Definitions

### 3.1 `event` — Top-level group container

```sql
CREATE TABLE app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR'
                        CHECK (currency ~ '^[A-Z]{3}$'),
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,              -- references auth.users.id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_event_created_by` | `CREATE INDEX ON app.event (created_by);` | List events created by a user |
| `idx_event_status` | `CREATE INDEX ON app.event (status);` | Filter by status (active/archived/deleted) |
| `idx_event_updated_at` | `CREATE INDEX ON app.event (updated_at DESC);` | Sort by last activity |

**Business rules**:
- `currency` is a display preference only. All monetary amounts are stored in EUR cents.
- `status` transitions: `active` → `archived`, `active` → `deleted`. Archived and deleted are terminal.
- `created_by` is a logical FK to `auth.users.id` — no DB constraint, enforced at application layer via Sentinel token.

---

### 3.2 `event_member` — User-event membership

```sql
CREATE TABLE app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,              -- references auth.users.id
    role        TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,                -- NULL = active, set on leave/removal
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_event_member_event_user` | `CREATE INDEX ON app.event_member (event_id, user_id);` | Membership check + join queries |
| `idx_event_member_active` | `CREATE UNIQUE INDEX ON app.event_member (event_id, user_id) WHERE left_at IS NULL;` | **One active membership per user per event** |
| `idx_event_member_user` | `CREATE INDEX ON app.event_member (user_id);` | List events for a user |

**Business rules**:
- **Active membership**: `left_at IS NULL`. Only active members can create expenses, record payments, view balances, or participate in settlements.
- **Single active membership**: The partial unique index ensures a user cannot have two concurrent active memberships in the same event. Historical memberships (with non-NULL `left_at`) are not constrained.
- **Role**: `admin` can modify event settings, add/remove members, delete expenses. `member` can create/edit own expenses and record payments.
- `ON DELETE CASCADE` on `event_id`: if an event is deleted, all memberships are removed. This is safe because expenses/payments are also cascade-deleted.
- No FK to `auth.users` — enforced at application layer. The user UUID is validated via Sentinel token extraction.

---

### 3.3 `expense` — Stable expense identifier (versioned container)

```sql
CREATE TABLE app.expense (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL,              -- references auth.users.id
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id  UUID,                       -- FK to expense_version, set after first version
    deleted_at          TIMESTAMPTZ                 -- NULL = active, set on soft-delete
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_expense_event` | `CREATE INDEX ON app.expense (event_id);` | List all expenses for an event |
| `idx_expense_event_active` | `CREATE INDEX ON app.expense (event_id) WHERE deleted_at IS NULL;` | List **active** (non-deleted) expenses for an event |
| `idx_expense_created_by` | `CREATE INDEX ON app.expense (created_by);` | Find expenses created by a user |
| `idx_expense_created_at` | `CREATE INDEX ON app.expense (event_id, created_at DESC) WHERE deleted_at IS NULL;` | Cursor-based pagination of active expenses |

**Business rules**:
- **Soft delete only**: Setting `deleted_at` marks the expense as deleted. The version history is preserved.
- **current_version_id**: Points to the latest `expense_version` row. Updated atomically each time a new version is created. Nullable to break the circular dependency at creation time (see Section 3.3a).
- `ON DELETE CASCADE` on `event_id`: safe because expense versions cascade too.

#### 3.3a Circular Dependency Resolution

`expense.current_version_id` references `expense_version(id)`, and `expense_version.expense_id` references `expense(id)`. This is resolved by a **three-step transaction**:

```sql
-- Step 1: Create expense (current_version_id IS NULL at this point)
INSERT INTO app.expense (event_id, created_by)
VALUES ($1, $2)
RETURNING id;

-- Step 2: Create first version
INSERT INTO app.expense_version (expense_id, version_number, title, amount_cents, paid_by, split_type, split_data, created_by)
VALUES ($3, 1, $4, $5, $6, $7, $8, $9)
RETURNING id;

-- Step 3: Update expense to point to its first version
UPDATE app.expense
SET current_version_id = $10
WHERE id = $3;
```

All three steps happen in a single serializable transaction. The FK constraint from `expense.current_version_id` to `expense_version.id` is checked at **commit time**, by which point both rows exist.

---

### 3.4 `expense_version` — Immutable version record (append-only chain)

```sql
CREATE TABLE app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 255),
    description     TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    paid_by         UUID NOT NULL,              -- references auth.users.id (the payer)
    split_type      TEXT NOT NULL
                        CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
    split_data      JSONB NOT NULL,             -- see Section 3.4a for schema
    notes           TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
    created_by      UUID NOT NULL,              -- who created this version
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_expense_version UNIQUE (expense_id, version_number)
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_ev_expense_id` | `CREATE INDEX ON app.expense_version (expense_id, version_number DESC);` | Get version history for an expense (newest first) |
| `idx_ev_paid_by` | `CREATE INDEX ON app.expense_version (paid_by);` | Balance computation — find expenses paid by a user |
| `idx_ev_current` | `CREATE INDEX ON app.expense_version (id) WHERE id IN (SELECT current_version_id FROM app.expense WHERE current_version_id IS NOT NULL);` | Quick lookup of current versions (for balance queries) |

**Business rules**:
- **Immutable**: Once inserted, `expense_version` rows are never updated or deleted. No `UPDATE` or `DELETE` at the application layer.
- **Version chain**: `version_number` starts at 1 and increments by 1 for each new version of the same expense. Contiguous sequence enforced by application logic.
- **amount_cents**: Positive integer, max ~€10M (999,999,999¢).
- **paid_by**: Must be an active event member at the time of creation. Enforced by application logic.
- `ON DELETE CASCADE` on `expense_id`: if an expense is deleted (cascade), all its versions are removed.

#### 3.4a Split Types — `split_data` JSONB Schemas

**Equal split**:
```json
{
  "type": "equal",
  "shares": ["user-a-uuid", "user-b-uuid", "user-c-uuid"]
}
```
Each member pays `amount_cents / len(shares)`. Remainder distributed 1¢ at a time to the first N members.

**Custom split**:
```json
{
  "type": "custom",
  "amounts": {
    "user-a-uuid": 500,
    "user-b-uuid": 300,
    "user-c-uuid": 200
  }
}
```
Each member owes the specified amount. Must sum to `amount_cents`. Enforced by application logic.

**Percentage split**:
```json
{
  "type": "percentage",
  "percentages": {
    "user-a-uuid": 50,
    "user-b-uuid": 30,
    "user-c-uuid": 20
  }
}
```
Each member owes `amount_cents * percentage / 100`. Remainder assigned to first member. Must sum to 100%.

**Shares split**:
```json
{
  "type": "shares",
  "shares": {
    "user-a-uuid": 3,
    "user-b-uuid": 2,
    "user-c-uuid": 1
  }
}
```
Each member owes `amount_cents * their_shares / total_shares`. Remainder assigned to first member.

---

### 3.5 `expense_version_share` — Normalized per-user split amounts (immutable)

This table is the **computed result** of applying the split rule in `split_data` to `amount_cents`. It is populated in the same transaction that creates a version, using the deterministic rounding rules defined in Section 4 of the Data Model.

```sql
CREATE TABLE app.expense_version_share (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_version_id  UUID NOT NULL REFERENCES app.expense_version(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,              -- references auth.users.id
    share_cents         INT NOT NULL CHECK (share_cents >= 0),
    share_order         INT NOT NULL,               -- ordering for remainder distribution

    CONSTRAINT uq_expense_version_share UNIQUE (expense_version_id, user_id)
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_evs_version_id` | `CREATE INDEX ON app.expense_version_share (expense_version_id);` | Look up shares for a version (explain endpoint) |
| `idx_evs_user_id` | `CREATE INDEX ON app.expense_version_share (user_id);` | Balance computation — total owed by a user |
| `idx_evs_event_current` | `CREATE INDEX ON app.expense_version_share (expense_version_id) WHERE expense_version_id IN (SELECT current_version_id FROM app.expense WHERE current_version_id IS NOT NULL);` | Fast balance computation — only current versions |

**Business rules**:
- **Immutable**: Rows are created alongside their parent `expense_version` and never modified.
- **Computed deterministically**: For each expense version:
  1. Total of all `share_cents` for that version must equal `expense_version.amount_cents`.
  2. `share_order` records the priority order for remainder distribution (for reproduceability).
- **Zero shares allowed**: A user can have `share_cents = 0` in theoretically edge cases (e.g., someone included in the split but with 0% share). This is allowed but rare.
- **Rationale for this table**: Avoids JSONB decomposition in hot-path balance queries. Makes the balance computation a simple `SUM`/`GROUP BY` over indexed integer columns rather than lateral JSONB function calls.

---

### 3.6 `payment` — Immutable money transfer ledger

```sql
CREATE TABLE app.payment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,              -- references auth.users.id
    to_user         UUID NOT NULL,              -- references auth.users.id
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    currency        TEXT NOT NULL DEFAULT 'EUR'
                        CHECK (currency ~ '^[A-Z]{3}$'),
    description     TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
    payment_method  TEXT CHECK (payment_method IS NULL OR char_length(payment_method) <= 50),
    external_ref    TEXT CHECK (external_ref IS NULL OR char_length(external_ref) <= 255),
    recorded_by     UUID NOT NULL,              -- who recorded this payment
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_payment_no_self CHECK (from_user <> to_user),
    CONSTRAINT chk_payment_no_refund CHECK (amount_cents > 0)
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_payment_event` | `CREATE INDEX ON app.payment (event_id);` | List payments for an event |
| `idx_payment_event_recorded` | `CREATE INDEX ON app.payment (event_id, recorded_at DESC);` | Cursor-based pagination |
| `idx_payment_from` | `CREATE INDEX ON app.payment (event_id, from_user);` | Balance computation — payments sent |
| `idx_payment_to` | `CREATE INDEX ON app.payment (event_id, to_user);` | Balance computation — payments received |

**Business rules**:
- **Immutable**: No `UPDATE` or `DELETE` at the application layer. Corrections require a reversing payment (a new payment in the opposite direction).
- **No self-payments**: `from_user <> to_user` enforced by CHECK constraint.
- **Positive amounts**: All payments transfer a positive amount. Zero or negative payments are not valid — reversing payments are new rows with swapped parties.
- **Both parties must be active members**: Enforced at application level at the time of recording.
- `recorded_at` is the immutable timestamp of when the payment was recorded. Use this for audit and ordering, not `created_at`.

---

### 3.7 `settlement` — Debt discharge acknowledgement

```sql
CREATE TABLE app.settlement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,              -- references auth.users.id
    to_user         UUID NOT NULL,              -- references auth.users.id
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'disputed')),
    settled_at      TIMESTAMPTZ,                -- set when status becomes 'confirmed'
    created_by      UUID NOT NULL,              -- who proposed the settlement
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_settlement_no_self CHECK (from_user <> to_user)
);
```

**Indexes**:

| Name | Definition | Purpose |
|------|-----------|---------|
| `idx_settlement_event` | `CREATE INDEX ON app.settlement (event_id);` | List settlements for an event |
| `idx_settlement_event_created` | `CREATE INDEX ON app.settlement (event_id, created_at DESC);` | Cursor-based pagination |
| `idx_settlement_from` | `CREATE INDEX ON app.settlement (event_id, from_user);` | Balance computation — settlements sent |
| `idx_settlement_to` | `CREATE INDEX ON app.settlement (event_id, to_user);` | Balance computation — settlements received |
| `idx_settlement_status` | `CREATE INDEX ON app.settlement (event_id, status);` | Filter confirmed settlements for balance computation |

**Business rules**:
- **Status transitions**:
  - `pending` → `confirmed` (both parties agree). Sets `settled_at`.
  - `pending` → `disputed` (one party disagrees).
  - `confirmed` is **terminal** — no further transitions.
  - `disputed` → `pending` (renegotiation).
- **Only `from_user` or `to_user`** can confirm a settlement. Enforced at application layer.
- **Only confirmed settlements** affect balance computation. Pending and disputed settlements are excluded.
- **No self-settlement**: `from_user <> to_user` enforced by CHECK constraint.

---

## 4. Key Queries

### 4.1 Balance Computation — All Members for an Event

This is the most important query. It computes net balances for all active members of an event.

```sql
WITH paid AS (
    -- What each user paid (via current version of active expenses)
    SELECT
        ev.paid_by AS user_id,
        SUM(ev.amount_cents)::BIGINT AS total_paid_cents
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    WHERE e.event_id = $1
      AND e.deleted_at IS NULL
    GROUP BY ev.paid_by
),
owed AS (
    -- What each user owes (via current version shares)
    SELECT
        evs.user_id,
        SUM(evs.share_cents)::BIGINT AS total_owed_cents
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    JOIN app.expense_version_share evs ON evs.expense_version_id = ev.id
    WHERE e.event_id = $1
      AND e.deleted_at IS NULL
    GROUP BY evs.user_id
),
payment_net AS (
    -- Net effect of payments: sent reduces balance, received increases it
    SELECT
        p.from_user AS user_id,
        -SUM(p.amount_cents)::BIGINT AS net_cents
    FROM app.payment p
    WHERE p.event_id = $1
    GROUP BY p.from_user
    UNION ALL
    SELECT
        p.to_user AS user_id,
        SUM(p.amount_cents)::BIGINT AS net_cents
    FROM app.payment p
    WHERE p.event_id = $1
    GROUP BY p.to_user
),
settlement_net AS (
    -- Net effect of confirmed settlements
    SELECT
        s.from_user AS user_id,
        -SUM(s.amount_cents)::BIGINT AS net_cents
    FROM app.settlement s
    WHERE s.event_id = $1 AND s.status = 'confirmed'
    GROUP BY s.from_user
    UNION ALL
    SELECT
        s.to_user AS user_id,
        SUM(s.amount_cents)::BIGINT AS net_cents
    FROM app.settlement s
    WHERE s.event_id = $1 AND s.status = 'confirmed'
    GROUP BY s.to_user
),
combined AS (
    -- Combine all contributions per user
    SELECT
        COALESCE(paid.user_id, owed.user_id, pn.user_id, sn.user_id) AS user_id,
        COALESCE(paid.total_paid_cents, 0) AS total_paid_cents,
        COALESCE(owed.total_owed_cents, 0) AS total_owed_cents,
        (COALESCE(pn.net_cents, 0) + COALESCE(sn.net_cents, 0)) AS transfer_net_cents
    FROM paid
    FULL OUTER JOIN owed ON owed.user_id = paid.user_id
    FULL OUTER JOIN (
        SELECT user_id, SUM(net_cents) AS net_cents
        FROM payment_net
        GROUP BY user_id
    ) pn ON pn.user_id = COALESCE(paid.user_id, owed.user_id)
    FULL OUTER JOIN (
        SELECT user_id, SUM(net_cents) AS net_cents
        FROM settlement_net
        GROUP BY user_id
    ) sn ON sn.user_id = COALESCE(paid.user_id, owed.user_id, pn.user_id)
)
SELECT
    m.user_id,
    COALESCE(c.total_paid_cents, 0) AS total_paid_cents,
    COALESCE(c.total_owed_cents, 0) AS total_owed_cents,
    (COALESCE(c.total_paid_cents, 0)
     - COALESCE(c.total_owed_cents, 0)
     + COALESCE(c.transfer_net_cents, 0)
    ) AS balance_cents
FROM app.event_member m
LEFT JOIN combined c ON c.user_id = m.user_id
WHERE m.event_id = $1
  AND m.left_at IS NULL
ORDER BY m.user_id;
```

**How it works**:
1. **`paid` CTE**: Sums `amount_cents` for each payer across all current (non-deleted) expense versions.
2. **`owed` CTE**: Sums `share_cents` for each user from the normalized shares table.
3. **`payment_net` CTE**: Payments sent reduce balance, payments received increase it.
4. **`settlement_net` CTE**: Confirmed settlements sent reduce balance, received increase it.
5. **`combined`**: Full outer join to handle users who only appear in one category.
6. **Final SELECT**: Join against active members, compute `balance_cents = paid - owed + payment_net + settlement_net`.

**Performance note**: With the indexes defined above, this query executes as a series of index-only scans. For an event with 50 members and 500 expenses, expected execution time: < 50ms.

---

### 4.2 Single User Balance Within an Event

Same logic as above, but filtered to a single user:

```sql
WITH paid AS (
    SELECT COALESCE(SUM(ev.amount_cents), 0)::BIGINT AS total_paid_cents
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    WHERE e.event_id = $1
      AND e.deleted_at IS NULL
      AND ev.paid_by = $2       -- target user
),
owed AS (
    SELECT COALESCE(SUM(evs.share_cents), 0)::BIGINT AS total_owed_cents
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    JOIN app.expense_version_share evs ON evs.expense_version_id = ev.id
    WHERE e.event_id = $1
      AND e.deleted_at IS NULL
      AND evs.user_id = $2      -- target user
),
payment_net AS (
    SELECT COALESCE(
        SUM(CASE WHEN p.from_user = $2 THEN -p.amount_cents
                 WHEN p.to_user   = $2 THEN  p.amount_cents
            END), 0
    )::BIGINT AS net_cents
    FROM app.payment p
    WHERE p.event_id = $1
      AND ($2 IN (p.from_user, p.to_user))
),
settlement_net AS (
    SELECT COALESCE(
        SUM(CASE WHEN s.from_user = $2 AND s.status = 'confirmed' THEN -s.amount_cents
                 WHEN s.to_user   = $2 AND s.status = 'confirmed' THEN  s.amount_cents
            END), 0
    )::BIGINT AS net_cents
    FROM app.settlement s
    WHERE s.event_id = $1
      AND ($2 IN (s.from_user, s.to_user))
)
SELECT
    $2 AS user_id,
    (SELECT total_paid_cents FROM paid) AS total_paid_cents,
    (SELECT total_owed_cents FROM owed) AS total_owed_cents,
    ((SELECT total_paid_cents FROM paid)
     - (SELECT total_owed_cents FROM owed)
     + (SELECT net_cents FROM payment_net)
     + (SELECT net_cents FROM settlement_net)
    ) AS balance_cents;
```

---

### 4.3 Explain Endpoint — Breakdown of a User's Balance

```sql
-- === EXPENSES PAID (by this user) ===
SELECT
    e.id AS expense_id,
    ev.title,
    ev.amount_cents,
    ev.version_number AS current_version,
    ev.created_at
FROM app.expense e
JOIN app.expense_version ev ON ev.id = e.current_version_id
WHERE e.event_id = $1
  AND e.deleted_at IS NULL
  AND ev.paid_by = $2       -- target user
ORDER BY ev.created_at DESC;

-- === EXPENSES OWED (shares this user is responsible for) ===
SELECT
    e.id AS expense_id,
    ev.title,
    ev.amount_cents AS total_cents,
    evs.share_cents AS my_share_cents,
    ev.split_type,
    ev.version_number AS current_version
FROM app.expense e
JOIN app.expense_version ev ON ev.id = e.current_version_id
JOIN app.expense_version_share evs ON evs.expense_version_id = ev.id
WHERE e.event_id = $1
  AND e.deleted_at IS NULL
  AND evs.user_id = $2      -- target user
ORDER BY ev.created_at DESC;

-- === PAYMENTS SENT ===
SELECT
    p.id AS payment_id,
    p.to_user,
    p.amount_cents,
    p.description,
    p.recorded_at
FROM app.payment p
WHERE p.event_id = $1
  AND p.from_user = $2      -- target user sent money
ORDER BY p.recorded_at DESC;

-- === PAYMENTS RECEIVED ===
SELECT
    p.id AS payment_id,
    p.from_user,
    p.amount_cents,
    p.description,
    p.recorded_at
FROM app.payment p
WHERE p.event_id = $1
  AND p.to_user = $2        -- target user received money
ORDER BY p.recorded_at DESC;

-- === SETTLEMENTS SENT ===
SELECT
    s.id AS settlement_id,
    s.to_user,
    s.amount_cents,
    s.status,
    s.settled_at
FROM app.settlement s
WHERE s.event_id = $1
  AND s.from_user = $2
  AND s.status = 'confirmed'
ORDER BY s.settled_at DESC NULLS LAST;

-- === SETTLEMENTS RECEIVED ===
SELECT
    s.id AS settlement_id,
    s.from_user,
    s.amount_cents,
    s.status,
    s.settled_at
FROM app.settlement s
WHERE s.event_id = $1
  AND s.to_user = $2
  AND s.status = 'confirmed'
ORDER BY s.settled_at DESC NULLS LAST;
```

These six queries are run independently and assembled into the explain response by the application layer. Each query uses the indexes on `event_id` + the relevant user column, ensuring index-only scans.

---

### 4.4 Active Expense Listing with Latest Version

```sql
SELECT
    e.id AS expense_id,
    ev.version_number,
    ev.title,
    ev.description,
    ev.amount_cents,
    ev.paid_by,
    ev.split_type,
    ev.split_data,
    ev.created_at AS updated_at,
    e.created_at
FROM app.expense e
JOIN app.expense_version ev ON ev.id = e.current_version_id
WHERE e.event_id = $1
  AND e.deleted_at IS NULL
  AND (e.created_at < $2 OR ($2 IS NULL))   -- cursor-based pagination
ORDER BY e.created_at DESC
LIMIT $3;                                    -- default 20, max 100
```

**Pagination**: The cursor is the `created_at` of the last item in the previous page. On first request, cursor is NULL (fetch first page).

---

### 4.5 Event Membership Check

```sql
SELECT EXISTS(
    SELECT 1
    FROM app.event_member
    WHERE event_id = $1
      AND user_id = $2
      AND left_at IS NULL
) AS is_active_member;
```

**Index used**: `idx_event_member_event_user` — exact lookup on (event_id, user_id), filtered by `left_at IS NULL`.

---

### 4.6 Version History for an Expense

```sql
SELECT
    ev.id,
    ev.version_number,
    ev.title,
    ev.description,
    ev.amount_cents,
    ev.paid_by,
    ev.split_type,
    ev.split_data,
    ev.notes,
    ev.created_by,
    ev.created_at
FROM app.expense_version ev
WHERE ev.expense_id = $1
ORDER BY ev.version_number DESC;   -- newest first for display, but ASC for audit
```

**Index used**: `idx_ev_expense_id` on `(expense_id, version_number DESC)` — index-only scan.

To show what changed between versions (diff), the application layer compares consecutive rows. There is no dedicated diff table — the version chain itself is the diff source.

---

## 5. Migration Strategy

### 5.1 SQLx Convention

All `app` schema migrations live in `apps/pitboss-api/migrations/`.

**Naming convention**:
```
YYYYMMDDHHMMSS_descriptive_name.sql
```

**Examples**:
```
20260510000001_create_event.sql
20260510000002_create_event_member.sql
20260510000003_create_expense.sql
20260510000004_create_expense_version.sql
20260510000005_create_expense_version_share.sql
20260510000006_create_payment.sql
20260510000007_create_settlement.sql
20260510000008_create_indexes.sql
```

Each file is a single migration. SQLx applies them sequentially based on the timestamp prefix. Migrations are **idempotent** — if a migration fails, the transaction is rolled back and the error is reported. Run `sqlx migrate run` to apply pending migrations.

### 5.2 search_path Configuration

The pitboss-api database connection must set `search_path = 'app, public'`:

```sql
ALTER ROLE pitboss_user SET search_path TO app, public;
```

This ensures that unqualified table names resolve to `app` first. The `public` schema fallback is needed for extensions (e.g., `uuid-ossp`, `pgcrypto`, `citext`) if installed.

### 5.3 Schema Bootstrapping

The first migration (`00000000000000_bootstrap.sql`) creates the `app` schema if it doesn't exist:

```sql
CREATE SCHEMA IF NOT EXISTS app;
```

This file has timestamp `00000000000000` to ensure it runs first. Subsequent migrations assume the schema exists.

### 5.4 Migration File Template

```sql
-- Migration: YYYYMMDDHHMMSS_descriptive_name.sql
-- Description: What this migration does

BEGIN;

-- DDL goes here

COMMIT;
```

All migrations are wrapped in explicit transactions. SQLx runs each migration in a transaction by default, but being explicit is good practice.

### 5.5 Migration Safety

| Rule | Rationale |
|------|-----------|
| **No destructive changes in reversible migrations** | SQLx does not support reversible migrations natively. All `CREATE` statements should be `CREATE IF NOT EXISTS` where practical. |
| **No data loss** | Never drop a column in a migration. Add columns as nullable or with defaults, then backfill. |
| **One logical change per migration** | Makes it easy to identify which change caused an issue. |
| **Test down migrations manually** | Keep a comment block with the rollback SQL for manual use during development. |

### 5.6 Baseline Migration

If deploying to an existing database with tables already created by a previous version, create a **baseline migration**:

```sql
-- Migration: YYYYMMDDHHMMSS_baseline.sql
-- Description: Baseline migration for production database
-- Note: Tables already exist. This migration is a no-op.

SELECT 1;  -- SQLx requires at least one statement
```

And mark it as applied: `sqlx migrate apply --baseline YYYYMMDDHHMMSS`

---

## 6. Performance Considerations

### 6.1 Expected Scale

| Dimension | Expected | Maximum Before Optimization |
|-----------|----------|---------------------------|
| Events per user | 10–50 | 500 |
| Members per event | 5–50 | 200 |
| Expenses per event | 50–500 | 5,000 |
| Versions per expense | 1–5 | 50 |
| Payments per event | 20–200 | 2,000 |
| Settlements per event | 5–50 | 500 |
| Total users | 100–1,000 | 10,000 |

At maximum scale, the largest table is `expense_version` with ~250,000 rows (5,000 expenses × 50 versions). `expense_version_share` would have ~2.5M rows (250,000 versions × 10 avg members). This is comfortably within PostgreSQL's capabilities with proper indexing.

### 6.2 Index Strategy Summary

| Table | Index | Type | Justification |
|-------|-------|------|---------------|
| `event` | `(created_by)` | B-tree | List user's events |
| `event` | `(status)` | B-tree | Filter active events |
| `event` | `(updated_at DESC)` | B-tree | Sort by activity |
| `event_member` | `(event_id, user_id)` | B-tree | Membership check (the most frequent query) |
| `event_member` | `(event_id, user_id) WHERE left_at IS NULL` | **Partial unique** | Enforce single active membership |
| `event_member` | `(user_id)` | B-tree | List user's events (backward lookup) |
| `expense` | `(event_id) WHERE deleted_at IS NULL` | **Partial** | List active expenses for event |
| `expense` | `(event_id, created_at DESC) WHERE deleted_at IS NULL` | **Covering partial** | Pagination of active expenses |
| `expense` | `(created_by)` | B-tree | Find expenses by creator |
| `expense_version` | `(expense_id, version_number DESC)` | B-tree | Version history list |
| `expense_version` | `(paid_by)` | B-tree | Balance computation |
| `expense_version_share` | `(expense_version_id)` | B-tree | Lookup shares for version |
| `expense_version_share` | `(user_id)` | B-tree | Balance computation — total owed |
| `payment` | `(event_id, recorded_at DESC)` | B-tree | Pagination |
| `payment` | `(event_id, from_user)` | B-tree | Balance — payments sent |
| `payment` | `(event_id, to_user)` | B-tree | Balance — payments received |
| `settlement` | `(event_id, created_at DESC)` | B-tree | Pagination |
| `settlement` | `(event_id, status)` | B-tree | Filter confirmed for balance |
| `settlement` | `(event_id, from_user)` | B-tree | Balance — settlements sent |
| `settlement` | `(event_id, to_user)` | B-tree | Balance — settlements received |

### 6.3 Query Performance Notes

**Balance computation** (the heaviest query):
- The `paid` CTE scans `expense_version` joined with `expense` on `current_version_id`. Both columns are indexed.
- The `owed` CTE joins through `expense` → `expense_version` → `expense_version_share`. Each join uses indexed columns. The `expense_version_share` table is filtered by `user_id` index.
- `payment_net` and `settlement_net` each do two index scans (from and to), then aggregate.
- All CTEs filter on `event_id` first, ensuring each scan is limited to the event's data.
- For an event with 50 members and 500 expenses, this query should complete in < 100ms on moderate hardware.

**Membership check** (the most frequent query):
- Every authenticated request performs one `EXISTS` query against `event_member(event_id, user_id)`.
- This is an exact index lookup — O(1) to O(log n). Expected latency: < 1ms.

**Pagination**:
- All list endpoints use cursor-based pagination on `(event_id, created_at DESC)` or `(event_id, recorded_at DESC)`.
- The cursor comparison `WHERE created_at < $cursor` uses the index B-tree for efficient fetch of the next page.
- `LIMIT N+1` is used to detect `has_more` — if N+1 rows are returned, `has_more = true` and the extra row is discarded.

### 6.4 Potential Bottlenecks & Mitigations

| Bottleneck | When | Mitigation |
|------------|------|------------|
| Balance query on large events | > 500 expenses, > 50 members | Add covering indexes for CTEs. Consider a materialized view refreshed on version/payment/settlement creation. |
| `expense_version_share` write amplification | High-edit-expense events (unlikely) | Each expense version insert writes N rows to the shares table. For 50 members, that's 50 rows. At 10 edits/second, this is 500 rows/second — well within PG capacity. |
| JSONB `split_data` validation | Every expense create/update | Validation is application-level (Rust). DB stores whatever is passed. No DB-level JSONB schema validation — rely on application logic. |
| Concurrent balance queries | Many users viewing balances simultaneously | Balance queries are read-only — no lock contention. PG handles concurrent reads well. |
| Soft-delete accumulation | Years of usage | `expense` rows with `deleted_at IS NOT NULL` are excluded from most queries by partial indexes. No performance impact. |

### 6.5 Future Performance Enhancements

If balance query performance becomes a concern (> 200ms for realistic events):

1. **Materialized view**: Create `app.mv_event_balance` refreshed on each mutation (or periodically). Tradeoff: staleness window.
2. **Covering indexes**: Add `INCLUDE` columns to index-only scans:
   ```sql
   CREATE INDEX idx_ev_covering ON app.expense_version (paid_by) INCLUDE (amount_cents);
   ```
3. **Partitioning**: Not needed at expected scale. If needed, partition `expense_version` by `event_id` (list partitioning) or by time (range partitioning).
4. **Caching**: Application-level cache with Redis for balance results with a TTL (e.g., 30 seconds). Invalidated on any write to the event.

---

## 7. Summary of Constraints & Business Rules

| # | Rule | Enforced By |
|---|------|------------|
| 1 | Expenses belong to one event | FK `expense.event_id → event.id` |
| 2 | Payment and settlement participants must differ | CHECK `from_user <> to_user` |
| 3 | All monetary amounts are positive integers | CHECK `amount_cents > 0` |
| 4 | Expenses are versioned (1, 2, 3...) | UNIQUE `(expense_id, version_number)` + application logic |
| 5 | Only active members can participate | Application layer (EXISTS query) |
| 6 | One active membership per user per event | Partial unique index `(event_id, user_id) WHERE left_at IS NULL` |
| 7 | Payments are immutable | No UPDATE/DELETE in application layer |
| 8 | Expense versions are immutable | No UPDATE/DELETE in application layer |
| 9 | Balances are never stored | Schema has no `balance` column |
| 10 | Split shares must sum to amount_cents | Application logic + the `expense_version_share` total matches `amount_cents` |

---

## 8. Appendices

### A. Full DDL (for reference)

```sql
-- Schema
CREATE SCHEMA IF NOT EXISTS app;

-- Tables
CREATE TABLE app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app.expense (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id  UUID,
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 255),
    description     TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    paid_by         UUID NOT NULL,
    split_type      TEXT NOT NULL CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
    split_data      JSONB NOT NULL,
    notes           TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_expense_version UNIQUE (expense_id, version_number)
);

CREATE TABLE app.expense_version_share (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_version_id  UUID NOT NULL REFERENCES app.expense_version(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    share_cents         INT NOT NULL CHECK (share_cents >= 0),
    share_order         INT NOT NULL,
    CONSTRAINT uq_expense_version_share UNIQUE (expense_version_id, user_id)
);

CREATE TABLE app.payment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
    description     TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
    payment_method  TEXT CHECK (payment_method IS NULL OR char_length(payment_method) <= 50),
    external_ref    TEXT CHECK (external_ref IS NULL OR char_length(external_ref) <= 255),
    recorded_by     UUID NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payment_no_self CHECK (from_user <> to_user)
);

CREATE TABLE app.settlement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 999999999),
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
    settled_at      TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_settlement_no_self CHECK (from_user <> to_user)
);

-- Indexes
CREATE INDEX idx_event_created_by ON app.event (created_by);
CREATE INDEX idx_event_status ON app.event (status);
CREATE INDEX idx_event_updated_at ON app.event (updated_at DESC);

CREATE INDEX idx_event_member_event_user ON app.event_member (event_id, user_id);
CREATE UNIQUE INDEX uq_event_member_active ON app.event_member (event_id, user_id) WHERE left_at IS NULL;
CREATE INDEX idx_event_member_user ON app.event_member (user_id);

CREATE INDEX idx_expense_event ON app.expense (event_id);
CREATE INDEX idx_expense_event_active ON app.expense (event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_created_by ON app.expense (created_by);
CREATE INDEX idx_expense_pagination ON app.expense (event_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_ev_expense_id ON app.expense_version (expense_id, version_number DESC);
CREATE INDEX idx_ev_paid_by ON app.expense_version (paid_by);

CREATE INDEX idx_evs_version_id ON app.expense_version_share (expense_version_id);
CREATE INDEX idx_evs_user_id ON app.expense_version_share (user_id);

CREATE INDEX idx_payment_event ON app.payment (event_id);
CREATE INDEX idx_payment_event_recorded ON app.payment (event_id, recorded_at DESC);
CREATE INDEX idx_payment_from ON app.payment (event_id, from_user);
CREATE INDEX idx_payment_to ON app.payment (event_id, to_user);

CREATE INDEX idx_settlement_event ON app.settlement (event_id);
CREATE INDEX idx_settlement_event_created ON app.settlement (event_id, created_at DESC);
CREATE INDEX idx_settlement_from ON app.settlement (event_id, from_user);
CREATE INDEX idx_settlement_to ON app.settlement (event_id, to_user);
CREATE INDEX idx_settlement_status ON app.settlement (event_id, status);
```

### B. Foreign Key Reference (Conceptual)

The `app` schema has no direct foreign keys to `auth` schema tables. The following FKs are **logical** — enforced by the application layer, not the database:

| `app` Column | References (`auth` schema) | Enforcement |
|-------------|---------------------------|-------------|
| `event.created_by` | `users.id` | Application (Sentinel token) |
| `event_member.user_id` | `users.id` | Application (Sentinel token) |
| `expense.created_by` | `users.id` | Application |
| `expense_version.paid_by` | `users.id` | Application + membership check |
| `expense_version.created_by` | `users.id` | Application |
| `expense_version_share.user_id` | `users.id` | Application |
| `payment.from_user` | `users.id` | Application + membership check |
| `payment.to_user` | `users.id` | Application + membership check |
| `payment.recorded_by` | `users.id` | Application |
| `settlement.from_user` | `users.id` | Application + membership check |
| `settlement.to_user` | `users.id` | Application + membership check |
| `settlement.created_by` | `users.id` | Application |

This design avoids cross-schema foreign keys, keeping the two schemas fully independent. pitboss-api validates user UUIDs by extracting them from the PASETO token (for the authenticated user) or by cross-referencing with Sentinel's API (for other users being added to events).

### C. Design Decisions

| Decision | Rationale |
|----------|-----------|
| **`expense_version_share` normalized table** | Avoids JSONB decomposition in hot-path balance queries. Makes balance computation a simple integer SUM/GROUP BY. Shares are computed once at version creation time using deterministic rounding, and never recomputed. |
| **Partial indexes for active/deleted filtering** | Most queries filter on `deleted_at IS NULL` or `left_at IS NULL`. Partial indexes keep the index size small and query plans efficient. |
| **UUID PKs everywhere** | UUIDv4 generated client-side enables offline-first (no sequence dependency), avoids ID enumeration attacks, and enables future sharding. |
| **`recorded_at` vs `created_at` on payments** | `recorded_at` is the timestamp chosen by the user (or the system) for when the payment happened. `created_at` is when the row was inserted. They may differ for offline-queued payments. |
| **No cross-schema FKs** | Keeps `app` and `auth` schemas fully independent. Owner cannot reference `auth` tables without a DB link permission grant. |
| **`settled_at` on settlement** | Only set when status transitions to `confirmed`. Provides a definitive timestamp for when the debt was discharged. |
| **`version_number` vs `created_at` for ordering** | Version number is a monotonically increasing integer that makes it easy to detect gaps. `created_at` is subject to clock skew, especially with offline mutations. Both are stored; `version_number` is the authoritative ordering. |

---

*Next: [Overview](./overview.md) · [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)*
