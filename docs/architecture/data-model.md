# MoshSplit Data Model

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Overview](./overview.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)

---

## 1. Domain Overview

```
┌─────────────────┐       ┌─────────────────┐
│      User       │       │    Event (aka   │
│  (managed by    │◄──────┤    "Group")     │
│   Sentinel)     │       │                 │
└─────────────────┘       │  - name         │
                          │  - description  │
                          │  - currency     │
                          │  - status       │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
          ┌────────────────┐ ┌──────────┐ ┌──────────────┐
          │   Expense      │ │ Payment  │ │ Settlement   │
          │  (versioned)   │ │(immutable)││(immutable,   │
          │                │ │          │ │ status-tracking)
          │  - 1+ versions │ │ - amount │ │              │
          │  - split rules │ │ - from   │ │ - from       │
          │  - paid by     │ │ - to     │ │ - to         │
          │  - amount_cents│ │ - method │ │ - amount     │
          └────────────────┘ └──────────┘ └──────────────┘
```

### Core Entities

| Entity | Mutability | Key Constraint |
|--------|-----------|----------------|
| **User** | Managed by Sentinel | Identity, email, MFA — never directly mutated by MoshSplit |
| **Event** | Mutable (name, description, etc.) | Users must be members to participate |
| **EventMember** | Append/remove only | Links user to event with a role |
| **Expense** | **Versioned** — each edit creates a new version | Always has a `paid_by` payer and a split configuration |
| **ExpenseVersion** | **Immutable** — once written, never changed | Linked to an expense. Contains the actual financial data. |
| **Payment** | **Immutable** — append-only ledger | Records real money movement between two members |
| **Settlement** | Mostly immutable — status can transition | Confirms that a debt has been settled (e.g., "paid back") |

---

## 2. Entity Details

### 2.1 User (managed by Sentinel, `auth` schema)

Sentinel manages users in the `auth` schema. MoshSplit references users by their Sentinel UUID but never stores user details directly in the `app` schema.

```sql
-- auth schema (managed by Sentinel — READ ONLY from pitboss-api)
-- Key columns MoshSplit cares about:
--   users.id          UUID PRIMARY KEY
--   users.first_name  TEXT
--   users.last_name   TEXT
--   users.avatar_url  TEXT
```

**Rule**: MoshSplit (`pitboss-api`) never writes to `auth` schema tables. User profile data is fetched from Sentinel's API or, with explicit permission, via a read-only database role.

### 2.2 Event — `app.event`

An Event (also called a "Group") is the top-level container for all financial activity.

```sql
CREATE TABLE app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',  -- ISO 4217; other currencies are display estimates
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,       -- references auth.users.id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.3 EventMember — `app.event_member`

Links a user to an event. All operations (creating expenses, making payments) require active membership.

```sql
CREATE TABLE app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,       -- references auth.users.id
    role        TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,         -- NULL while active, set on removal
    UNIQUE (event_id, user_id, left_at)
);
```

**Membership Rules**:
- A user can be a member of an event multiple times if they leave and rejoin (different `left_at` periods).
- Active membership = `left_at IS NULL`.
- Only active members can create expenses, record payments, or view balances.
- `admin` role can modify event settings, add/remove members, and delete expenses.

### 2.4 Expense — `app.expense` + `app.expense_version`

Expenses are the core financial entity. They are **versioned** — every modification creates a new `expense_version` row. The `expense` table itself is a stable identifier and container.

```sql
CREATE TABLE app.expense (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL,       -- references auth.users.id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id UUID,             -- FK to expense_version, updated on each change
    deleted_at      TIMESTAMPTZ          -- soft delete
);

CREATE TABLE app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    paid_by         UUID NOT NULL,       -- references auth.users.id (the payer)
    split_type      TEXT NOT NULL CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
    split_data      JSONB NOT NULL,      -- see section 2.4.1
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expense_id, version_number)
);
```

#### 2.4.1 Split Types (`split_data` JSONB)

**Equal split**:
```json
{
  "type": "equal",
  "shares": ["user-a-uuid", "user-b-uuid", "user-c-uuid"]
}
```
Each member pays `amount_cents / len(shares)`. Remainder (penny rounding) is assigned to the first member(s) in the list.

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
Each member owes the specified amount. Must sum to `amount_cents`.

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
Each member owes `amount_cents * percentage / 100`. Remainder assigned to the first member.

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
Each member owes `amount_cents * their_shares / total_shares`. Remainder assigned to the first member.

### 2.5 Payment — `app.payment`

Payments represent actual money changing hands between two event members. **Immutable** — once recorded, never altered.

```sql
CREATE TABLE app.payment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,       -- references auth.users.id (sender)
    to_user         UUID NOT NULL,       -- references auth.users.id (receiver)
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    currency        TEXT NOT NULL DEFAULT 'EUR',
    description     TEXT,
    payment_method  TEXT,                -- e.g., 'cash', 'bank_transfer', 'venmo', 'pix'
    external_ref    TEXT,                -- external payment reference (e.g., Venmo transaction ID)
    recorded_by     UUID NOT NULL,       -- who recorded this payment
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)         -- cannot pay yourself
);
```

**Immutability Rule**: `app.payment` has no `UPDATE` or `DELETE` in the application layer. Corrections require a reversing payment (a new payment in the opposite direction).

### 2.6 Settlement — `app.settlement`

A Settlement confirms that a calculated debt was discharged. It represents the acknowledgment that "the balance between X and Y is now zero because Y paid X back."

```sql
CREATE TABLE app.settlement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'disputed')),
    settled_at      TIMESTAMPTZ,         -- when status became 'confirmed'
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);
```

**Status Transitions**:
- `pending` → `confirmed` (both parties agree)
- `pending` → `disputed` (one party disagrees)
- `confirmed` is terminal (no further transitions)
- `disputed` can go back to `pending` for renegotiation

---

## 3. Key Relationships & Constraints

```mermaid
erDiagram
    Event ||--o{ Expense : contains
    Event ||--o{ Payment : records
    Event ||--o{ Settlement : settles
    Event ||--o{ EventMember : has
    EventMember }o--|| User : references
    Expense ||--o{ ExpenseVersion : versioned-by
    ExpenseVersion }o--|| User : paid-by
    Payment }o--|| User : from
    Payment }o--|| User : to
    Settlement }o--|| User : from
    Settlement }o--|| User : to
```

### Critical Constraints

1. **Expense belongs to one event** — An expense cannot be shared across events.
2. **Payment participants must be active event members** — Both `from_user` and `to_user` must have an active `event_member` record at the time of payment.
3. **Payer must be an active member** — `paid_by` in `expense_version` must have an active membership.
4. **No self-payments** — `from_user != to_user` for payments and settlements.
5. **Expense version chain is contiguous** — `version_number` starts at 1 and increments by 1 for each new version.
6. **Soft delete only** — Expenses are soft-deleted by setting `deleted_at`. Payments and settlements are never deleted.

---

## 4. Money as Integer Cents

### Storage

```sql
amount_cents INT NOT NULL CHECK (amount_cents > 0)
```

- `1234` cents = `€12.34`
- `0` is not allowed for payments/expenses (a zero-amount transaction is not meaningful)
- Negative amounts are not stored — corrections use new transactions

### Base Currency: EUR

All accounting and calculations are in **EUR cents**. Other currencies (BRL, USD, COP, MXN) are **cosmetic display estimates only**.

**Critical rule**: Exchange rates must NEVER affect balances, debts, settlements, payments, or expense history. The canonical financial record is always in EUR cents. Currency conversion is a frontend display concern only.

### Display Conventions

| Stored (cents) | Display |
|----------------|---------|
| `0` | `€0.00` |
| `1` | `€0.01` |
| `100` | `€1.00` |
| `1234` | `€12.34` |
| `999999` | `€9,999.99` |
| `-500` | `-€5.00` |

### API Serialization

```json
{
  "amount_cents": 1234,
  "currency": "EUR",
  "display": "€12.34"
}
```

### Rounding (Penny Handling)

Splits often produce remainders. MoshSplit uses a deterministic approach:

1. Compute each share as integer division: `share = amount_cents / count`
2. Compute remainder: `remainder = amount_cents % count`
3. Distribute remainder one cent at a time to the first `remainder` members in the split order

**Example**: Splitting $10.00 (1000¢) among 3 people equally:
- Base share: `1000 / 3 = 333`¢
- Remainder: `1000 % 3 = 1`¢
- Person A: 334¢, Person B: 333¢, Person C: 333¢
- Total: 334 + 333 + 333 = 1000¢ ✓

---

## 5. Balance Computation

**Core principle**: Balances are never stored. They are computed on-demand from the current state of expense versions, payments, and settlements.

### 5.1 Per-Event Balance Computation

For a given event, compute the net balance for each member:

```
For each active expense (latest expense_version):
  Add amount_cents to payer's "is_owed" total

For each expense_version split entry:
  Subtract share amount from each participant's "owes" total

For each payment:
  Subtract amount_cents from sender's "is_owed"
  Add amount_cents to receiver's "is_owed"

For each confirmed settlement:
  Subtract amount_cents from sender's "is_owed"
  Add amount_cents to receiver's "is_owed"

Net balance = is_owed - owes
```

### 5.2 SQL Implementation (Conceptual)

```sql
WITH expense_totals AS (
    SELECT
        ev.paid_by AS user_id,
        SUM(ev.amount_cents) AS paid
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    WHERE e.event_id = $1 AND e.deleted_at IS NULL
    GROUP BY ev.paid_by
),
split_totals AS (
    SELECT
        split_member.user_id,
        SUM(split_member.share_cents) AS owes
    FROM app.expense e
    JOIN app.expense_version ev ON ev.id = e.current_version_id
    CROSS JOIN LATERAL jsonb_each(ev.split_data->'amounts') AS split_member(user_id, share_cents)
    WHERE e.event_id = $1 AND e.deleted_at IS NULL
    GROUP BY split_member.user_id
),
payment_totals AS (
    SELECT
        p.from_user AS user_id,
        -SUM(p.amount_cents) AS net
    FROM app.payment p
    WHERE p.event_id = $1
    GROUP BY p.from_user
    UNION ALL
    SELECT
        p.to_user AS user_id,
        SUM(p.amount_cents) AS net
    FROM app.payment p
    WHERE p.event_id = $1
    GROUP BY p.to_user
),
settlement_totals AS (
    SELECT
        s.from_user AS user_id,
        -SUM(s.amount_cents) AS net
    FROM app.settlement s
    WHERE s.event_id = $1 AND s.status = 'confirmed'
    GROUP BY s.from_user
    UNION ALL
    SELECT
        s.to_user AS user_id,
        SUM(s.amount_cents) AS net
    FROM app.settlement s
    WHERE s.event_id = $1 AND s.status = 'confirmed'
    GROUP BY s.to_user
)
SELECT
    m.user_id,
    COALESCE(et.paid, 0) AS total_paid,
    COALESCE(st.owes, 0) AS total_owes,
    COALESCE(et.paid, 0) - COALESCE(st.owes, 0) AS balance
FROM app.event_member m
LEFT JOIN expense_totals et ON et.user_id = m.user_id
LEFT JOIN split_totals st ON st.user_id = m.user_id
WHERE m.event_id = $1 AND m.left_at IS NULL;
```

> **Note**: The actual implementation will use SQLx parameterized queries. The split calculation will need dynamic JSONB extraction based on `split_type`.

### 5.3 Membership-Aware Computation

Only **active members** (those who haven't left the event) appear in balance calculations. However, past expenses created by former members remain in the computation — their debts to the event don't disappear when they leave.

### 5.4 Explainability

Each balance can be "drilled into" to show its derivation:

```
GET /v1/events/:id/balances/:user_id/explain
→ {
    "user_id": "...",
    "net_balance_cents": 1234,
    "breakdown": {
      "expenses_paid": [
        { "expense_id": "...", "title": "Hotel", "amount_cents": 5000 }
      ],
      "expenses_owed": [
        { "expense_id": "...", "title": "Hotel", "my_share_cents": 1667 }
      ],
      "payments_sent": [
        { "to_user": "...", "amount_cents": 2000 }
      ],
      "payments_received": [],
      "settlements": []
    }
  }
```

---

## 6. Database Schema Summary

### Schema: `auth` (managed by Sentinel)

| Table | Managed By | Notes |
|-------|-----------|-------|
| `users` | Sentinel | User identities, names, avatar |
| `user_identities` | Sentinel | Emails, verification status |
| `sessions` | Sentinel | PASETO session tokens |
| `user_mfa_totp` | Sentinel | MFA TOTP secrets |
| `user_recovery_codes` | Sentinel | MFA recovery codes |
| `roles` | Sentinel | RBAC roles |
| `user_roles` | Sentinel | User-role assignments |

### Schema: `app` (managed by pitboss-api)

| Table | Nature | Rows Immutable? |
|-------|--------|-----------------|
| `event` | Mutable | No |
| `event_member` | Append/remove | Membership history is append-only |
| `expense` | Mutable (stable identifier) | No |
| `expense_version` | Immutable | **Yes** |
| `payment` | Immutable | **Yes** |
| `settlement` | Mostly immutable | Status only can change |

### Migration Strategy

- **auth schema migrations** are run by Sentinel (Diesel based)
- **app schema migrations** are run by pitboss-api (SQLx based)
- Each service only connects to its own schema with appropriate `search_path`
- Migrations are versioned, sequential SQL files in each service's migration directory

---

## 7. Future Considerations

| Feature | Data Model Impact |
|---------|------------------|
| **Multi-currency display** | Frontend-only concern. Store amounts in EUR cents only. Add optional `original_currency` and `original_amount_cents` for display. Exchange rates are never stored — they are a display-layer conversion only. |
| **Recurring expenses** | Add `recurring_rule` to `expense`. Each occurrence creates a new expense + version. |
| **Attachments** | Add `expense_attachment` table referencing object storage. |
| **Comments** | Add `expense_comment` table (append-only). |
| **Categories/tags** | Add `expense_category` table, reference from `expense`. |
| **Invite codes** | Add `event_invite` table with token, expiry, usage limit. |

---

*Next: [Overview](./overview.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)*
