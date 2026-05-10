# Rust ↔ PostgreSQL Mapping Reference

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)

---

## Table of Contents

1. [Rust Type Mapping](#1-rust-type-mapping)
   - [1.1 Type Conventions](#11-type-conventions)
   - [1.2 Event → `EventRow`](#12-event--eventrow)
   - [1.3 EventMember → `EventMemberRow`](#13-eventmember--eventmemberrow)
   - [1.4 Expense → `ExpenseRow`](#14-expense--expenserow)
   - [1.5 ExpenseVersion → `ExpenseVersionRow`](#15-expenseversion--expenseversionrow)
   - [1.6 Payment → `PaymentRow`](#16-payment--paymentrow)
   - [1.7 Settlement → `SettlementRow`](#17-settlement--settlementrow)
   - [1.8 Domain Types vs Row Types](#18-domain-types-vs-row-types)
2. [SQLx Query Patterns](#2-sqlx-query-patterns)
   - [2.1 Macro Selection Guide](#21-macro-selection-guide)
   - [2.2 Basic CRUD Patterns](#22-basic-crud-patterns)
   - [2.3 Transaction Patterns](#23-transaction-patterns)
   - [2.4 JSONB Extraction Patterns](#24-jsonb-extraction-patterns)
   - [2.5 Cursor-Based Pagination](#25-cursor-based-pagination)
   - [2.6 Balance Computation](#26-balance-computation)
   - [2.7 Membership Enforcement](#27-membership-enforcement)
3. [Migration Conventions](#3-migration-conventions)
   - [3.1 File Naming](#31-file-naming)
   - [3.2 Schema Search Path](#32-schema-search-path)
   - [3.3 Idempotent Migrations](#33-idempotent-migrations)
   - [3.4 Initial Migration](#34-initial-migration)
4. [Error Handling Patterns](#4-error-handling-patterns)
   - [4.1 SQLx Error Variants](#41-sqlx-error-variants)
   - [4.2 PG Error Code Mapping](#42-pg-error-code-mapping)
   - [4.3 Domain Error Wrapping](#43-domain-error-wrapping)
   - [4.4 Constraint Naming Convention](#44-constraint-naming-convention)
5. [Connection Pooling](#5-connection-pooling)
   - [5.1 Pool Configuration](#51-pool-configuration)
   - [5.2 App State Wiring](#52-app-state-wiring)
   - [5.3 Health Checks](#53-health-checks)
   - [5.4 Multi-Schema Connections](#54-multi-schema-connections)
6. [Testing Strategy](#6-testing-strategy)
   - [6.1 Test Infrastructure](#61-test-infrastructure)
   - [6.2 Test Database Lifecycle](#62-test-database-lifecycle)
   - [6.3 Test Fixtures / Seeds](#63-test-fixtures--seeds)
   - [6.4 Rollback Between Tests](#64-rollback-between-tests)
   - [6.5 Balance Computation Tests](#65-balance-computation-tests)

---

## 1. Rust Type Mapping

### 1.1 Type Conventions

| PostgreSQL Type | Rust Type | Crate / Module |
|----------------|-----------|----------------|
| `UUID` | `uuid::Uuid` | `sqlx::types::Uuid` (re-export) |
| `TIMESTAMPTZ` | `chrono::DateTime<chrono::Utc>` | `sqlx::types::chrono` |
| `TIMESTAMPTZ` (nullable) | `Option<chrono::DateTime<chrono::Utc>>` | `sqlx::types::chrono` |
| `TEXT` / `VARCHAR(n)` | `String` | std |
| `INT` / `INTEGER` | `i32` | std |
| `BIGINT` | `i64` | std |
| `BOOLEAN` | `bool` | std |
| `JSONB` | `serde_json::Value` | `sqlx::types::Json<T>` |
| `JSONB` (typed) | `T` where `T: DeserializeOwned` | `sqlx::types::Json<T>` |
| `NUMERIC` | **AVOID** | Use integer cents instead |

#### Why `i32` for `amount_cents`

| Factor | Value |
|--------|-------|
| PG type | `INTEGER` / `INT` (4 bytes, signed) |
| i32 max | 2,147,483,647 cents = **€21,474,836.47** |
| i32 min | -2,147,483,647 cents = **-€21,474,836.47** |
| Realistic max expense | ~€100,000 = 10,000,000 cents (well within i32) |
| Event total (1000 expenses × €10k) | ~€10M = 1,000,000,000 cents (within i32) |
| Domain safety cap | €1,000,000 (100,000,000 cents) enforced in validation layer |

**Decision**: Use `i32` for `amount_cents` because:
- It matches PG `INTEGER` exactly — no casting needed
- The domain maximum (friends splitting expenses) is far below i32 limits
- Signed `i32` allows for future reconciliation entries (negative corrections) if needed
- If the platform scales beyond €21M in a single event, migrate to `BIGINT`/`i64` via a migration

For **sum/aggregate** queries (balance computation), use `i64` or `BigDecimal`-equivalent in intermediate calculations to avoid overflow. PG `SUM(INTEGER)` returns `BIGINT`, so SQLx will expose it as `i64`.

#### Cargo Dependencies

```toml
# In apps/pitboss-api/Cargo.toml
[dependencies]
sqlx = { version = "0.8", features = [
    "runtime-tokio",
    "postgres",
    "uuid",
    "chrono",
    "json",
    "migrate",
] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

#### Module Organization

```
src/
├── db/
│   ├── mod.rs              # Pool initialization, re-exports
│   ├── models/             # Row types (FromRow structs)
│   │   ├── mod.rs
│   │   ├── event.rs
│   │   ├── event_member.rs
│   │   ├── expense.rs
│   │   ├── expense_version.rs
│   │   ├── payment.rs
│   │   └── settlement.rs
│   └── queries/            # Query functions organized by domain
│       ├── mod.rs
│       ├── event.rs
│       ├── expense.rs
│       ├── payment.rs
│       ├── settlement.rs
│       └── balance.rs
├── domain/                 # Domain logic (entity types, errors)
│   ├── mod.rs
│   ├── event.rs
│   ├── expense.rs
│   ├── payment.rs
│   └── balance.rs
└── api/                    # API request/response types
    ├── mod.rs
    └── ...
```

**Key distinction**: `db::models` contains raw row types that mirror the DB schema exactly (`sqlx::FromRow`). `domain` contains business-logic types that may differ from persistence format. `api` contains serialization types for HTTP requests/responses.

---

### 1.2 Event → `EventRow`

```rust
// src/db/models/event.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.event` table.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct EventRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub currency: String,
    pub status: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

**Notes**:
- `description` is nullable → `Option<String>`
- `status` is a `String` (could be an enum with `serde`/`sqlx` integration for stricter typing; see tip below)
- `created_by` is a raw `Uuid` — no FK enforcement in Rust, only in PG

#### Enum Integration (Optional but Recommended)

```rust
/// Domain enum for event status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]   // Maps to PG TEXT for custom enum avoidance
#[serde(rename_all = "snake_case")]
pub enum EventStatus {
    Active,
    Archived,
    Deleted,
}

impl std::fmt::Display for EventStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventStatus::Active => write!(f, "active"),
            EventStatus::Archived => write!(f, "archived"),
            EventStatus::Deleted => write!(f, "deleted"),
        }
    }
}
```

**Caution**: SQLx's `#[sqlx(type_name = "...")]` derive works well for simple text-based enums but can produce confusing compile-time errors if the SQL type doesn't match. The simpler approach is to use `String` in rows and convert to enums in the domain layer.

---

### 1.3 EventMember → `EventMemberRow`

```rust
// src/db/models/event_member.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.event_member` table.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct EventMemberRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub role: String,           // "admin" | "member"
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,  // NULL = active member
}

/// Convenience: active members only.
impl EventMemberRow {
    pub fn is_active(&self) -> bool {
        self.left_at.is_none()
    }
}
```

**Membership query pattern**: Always filter on `left_at IS NULL` for active membership checks.

---

### 1.4 Expense → `ExpenseRow`

```rust
// src/db/models/expense.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.expense` table.
/// This is the stable identifier container — version history lives in expense_version.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct ExpenseRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub current_version_id: Option<Uuid>,  // NULL if expense has no versions (unlikely)
    pub deleted_at: Option<DateTime<Utc>>, // NULL = not deleted
}
```

**Note**: `current_version_id` is a `Option<Uuid>` foreign key to `expense_version.id`. It is set after the first version is created and updated on each new version.

---

### 1.5 ExpenseVersion → `ExpenseVersionRow`

```rust
// src/db/models/expense_version.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.expense_version` table.
/// IMMUTABLE — once inserted, never modified.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct ExpenseVersionRow {
    pub id: Uuid,
    pub expense_id: Uuid,
    pub version_number: i32,
    pub title: String,
    pub description: Option<String>,
    pub amount_cents: i32,
    pub paid_by: Uuid,
    pub split_type: String,        // "equal" | "custom" | "percentage" | "shares"
    pub split_data: serde_json::Value,  // JSONB — raw JSON value
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}
```

#### Typed Split Data (Domain Layer)

```rust
// src/domain/expense.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Typed representation of the JSONB `split_data` column,
/// parsed from `serde_json::Value` based on `split_type`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SplitData {
    Equal {
        shares: Vec<Uuid>,
    },
    Custom {
        amounts: HashMap<Uuid, i32>,
    },
    Percentage {
        percentages: HashMap<Uuid, i32>,
    },
    Shares {
        shares: HashMap<Uuid, i32>,
    },
}

impl SplitData {
    /// Validate that split amounts sum to total amount_cents.
    pub fn validates_to(&self, total_cents: i32) -> Result<(), SplitValidationError> {
        match self {
            SplitData::Equal { shares } => {
                if shares.is_empty() {
                    return Err(SplitValidationError::NoShares);
                }
                Ok(())
            }
            SplitData::Custom { amounts } => {
                let sum: i32 = amounts.values().sum();
                if sum != total_cents {
                    return Err(SplitValidationError::DoesNotSum {
                        expected: total_cents,
                        actual: sum,
                    });
                }
                Ok(())
            }
            SplitData::Percentage { percentages } => {
                let sum: i32 = percentages.values().sum();
                if sum != 100 {
                    return Err(SplitValidationError::PercentagesDoNotSum100(sum));
                }
                Ok(())
            }
            SplitData::Shares { shares } => {
                if shares.values().any(|&s| s <= 0) {
                    return Err(SplitValidationError::InvalidShareValue);
                }
                Ok(())
            }
        }
    }
}
```

---

### 1.6 Payment → `PaymentRow`

```rust
// src/db/models/payment.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.payment` table.
/// IMMUTABLE — never UPDATE or DELETE after insert.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct PaymentRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub currency: String,
    pub description: Option<String>,
    pub payment_method: Option<String>,
    pub external_ref: Option<String>,
    pub recorded_by: Uuid,
    pub recorded_at: DateTime<Utc>,
}
```

**Immutability enforcement**: The application layer **never exposes** `PATCH` or `DELETE` endpoints for payments. The DB has no `ON UPDATE CASCADE` or `ON DELETE CASCADE` issues because no application code performs those operations. A DB trigger can be added for defense-in-depth:

```sql
-- Optional: prevent any UPDATE or DELETE on app.payment
CREATE OR REPLACE FUNCTION app.prevent_payment_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'payments are immutable: update/delete on app.payment is forbidden'
        USING ERRCODE = 'MODIFYING_SQL_DATA_NOT_PERMITTED';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_immutable
    BEFORE UPDATE OR DELETE ON app.payment
    FOR EACH ROW EXECUTE FUNCTION app.prevent_payment_mutation();
```

---

### 1.7 Settlement → `SettlementRow`

```rust
// src/db/models/settlement.rs

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

/// Mirrors `app.settlement` table.
/// Mostly immutable — status can transition: pending → confirmed | disputed.
#[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
pub struct SettlementRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub status: String,                       // "pending" | "confirmed" | "disputed"
    pub settled_at: Option<DateTime<Utc>>,    // NULL until confirmed
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}
```

**Status transition domain logic**:

```rust
// src/domain/settlement.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettlementStatus {
    Pending,
    Confirmed,
    Disputed,
}

impl SettlementStatus {
    /// Valid transitions:
    ///   pending   → confirmed  (terminal)
    ///   pending   → disputed
    ///   disputed  → pending    (re-negotiation)
    ///   confirmed → *none*     (terminal)
    pub fn can_transition_to(self, target: SettlementStatus) -> bool {
        use SettlementStatus::*;
        matches!(
            (self, target),
            (Pending, Confirmed) | (Pending, Disputed) | (Disputed, Pending)
        )
    }
}
```

---

### 1.8 Domain Types vs Row Types

| Concern | `db::models::*Row` | `domain::*` | `api::*` |
|---------|-------------------|-------------|----------|
| Purpose | DB persistence | Business logic | HTTP I/O |
| Derives | `FromRow`, `Serialize`, `Deserialize` | `Serialize`, `Deserialize` | `Serialize`, `Deserialize`, `Debug` |
| Field names | Exactly match PG columns | Domain-meaningful names | API contract names |
| Nullability | `Option<T>` for nullable columns | Domain-appropriate | `Option<T>` for optional fields |
| Types | Raw `String`, `i32`, `serde_json::Value` | Enums, `SplitData`, `Money` | Formatted strings, enums |
| SQLx usage | Used directly in `query_as!` | Never used in queries | Never used in queries |

```rust
// Example mapping: Row → Domain → API response

// 1. DB Row (FromRow)
let row: ExpenseVersionRow = sqlx::query_as!(...).fetch_one(&pool).await?;

// 2. Domain model (business logic)
let expense = Expense::try_from(row)?;
let shares = expense.compute_shares()?;

// 3. API response (serialization)
let response: ExpenseResponse = ExpenseResponse::from(expense);
```

---

## 2. SQLx Query Patterns

### 2.1 Macro Selection Guide

| Macro | When to Use | Example |
|-------|-------------|---------|
| `query_as!<T>` | Fetch rows into a `FromRow` struct. **Compile-time** checked. | `query_as!(EventRow, "SELECT ...")` |
| `query!` | Fetch raw rows, access fields by name. Compile-time checked. | `query!("SELECT id, name FROM ...")` |
| `query_scalar!` | Fetch a single column value. Compile-time checked. | `query_scalar!("SELECT COUNT(*) FROM ...")` |
| `query_as::<_, T>()` | Runtime SQL (dynamic queries). No compile-time check. | `query_as::<_, EventRow>("SELECT ...")` |
| `sqlx::query("...")` | Execute a statement, no rows returned. Compile-time checked. | `query("INSERT INTO ...").execute(&pool)` |

**Compile-time checking** requires a running PostgreSQL database during compilation (set `DATABASE_URL` env var). For CI, use `SQLX_OFFLINE=true` with a generated `sqlx-data.json`.

```bash
# Generate offline data for CI
cargo sqlx prepare --database-url postgres://... -- --lib

# In CI, use:
SQLX_OFFLINE=true cargo build
```

### 2.2 Basic CRUD Patterns

#### Insert with Returning

```rust
use sqlx::PgPool;
use uuid::Uuid;

pub async fn create_event(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    created_by: Uuid,
) -> Result<EventRow, sqlx::Error> {
    sqlx::query_as!(
        EventRow,
        r#"
        INSERT INTO app.event (name, description, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, currency, status, created_by, created_at, updated_at
        "#,
        name,
        description,
        created_by,
    )
    .fetch_one(pool)
    .await
}
```

**Important**: When using `RETURNING`, the column list must match the struct fields exactly, in order. `query_as!` validates this at compile time.

#### Conditional Update

```rust
pub async fn update_event(
    pool: &PgPool,
    event_id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<EventRow, sqlx::Error> {
    sqlx::query_as!(
        EventRow,
        r#"
        UPDATE app.event
        SET name = $1,
            description = $2,
            updated_at = now()
        WHERE id = $3
        RETURNING id, name, description, currency, status, created_by, created_at, updated_at
        "#,
        name,
        description,
        event_id,
    )
    .fetch_one(pool)
    .await
}
```

#### Soft Delete

```rust
pub async fn soft_delete_expense(
    pool: &PgPool,
    expense_id: Uuid,
) -> Result<(), sqlx::Error> {
    let affected = sqlx::query!(
        r#"
        UPDATE app.expense
        SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        expense_id,
    )
    .execute(pool)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(sqlx::Error::RowNotFound);  // or custom error
    }
    Ok(())
}
```

#### Creating a New Expense Version (Version Chain)

```rust
pub async fn create_expense_version(
    pool: &PgPool,
    expense_id: Uuid,
    title: &str,
    description: Option<&str>,
    amount_cents: i32,
    paid_by: Uuid,
    split_type: &str,
    split_data: &serde_json::Value,
    notes: Option<&str>,
    created_by: Uuid,
) -> Result<ExpenseVersionRow, sqlx::Error> {
    // Use a transaction to atomically:
    // 1. Determine next version_number
    // 2. Insert the new version
    // 3. Update expense.current_version_id
    let mut tx = pool.begin().await?;

    let next_version: i32 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
        FROM app.expense_version
        WHERE expense_id = $1
        "#,
        expense_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    let version = sqlx::query_as!(
        ExpenseVersionRow,
        r#"
        INSERT INTO app.expense_version
            (expense_id, version_number, title, description, amount_cents,
             paid_by, split_type, split_data, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
            id, expense_id, version_number, title, description,
            amount_cents, paid_by, split_type, split_data::jsonb AS "split_data: serde_json::Value",
            notes, created_by, created_at
        "#,
        expense_id,
        next_version,
        title,
        description,
        amount_cents,
        paid_by,
        split_type,
        split_data as _,
        notes,
        created_by,
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        UPDATE app.expense
        SET current_version_id = $1
        WHERE id = $2
        "#,
        version.id,
        expense_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(version)
}
```

**JSONB binding note**: `split_data` is passed as `&serde_json::Value`. The cast `split_data::jsonb AS "split_data: serde_json::Value"` in the `RETURNING` clause tells SQLx to treat the column as JSONB. The `as _` in the `VALUES` clause tells SQLx to infer the parameter type from the Rust type.

### 2.3 Transaction Patterns

#### Read-Only Transaction for Balance Computation

```rust
use sqlx::{PgConnection, PgPool};

pub async fn compute_user_balance(
    pool: &PgPool,
    event_id: Uuid,
    user_id: Uuid,
) -> Result<UserBalance, BalanceError> {
    // Read-only transaction: ensures consistent snapshot across queries
    let mut tx = pool.begin().await.map_err(BalanceError::Database)?;

    // Set transaction to read-only for safety
    sqlx::query("SET TRANSACTION READ ONLY")
        .execute(&mut *tx)
        .await
        .map_err(BalanceError::Database)?;

    // Step 1: Total paid (as payer in latest expense versions)
    let total_paid: Option<i64> = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(ev.amount_cents), 0)::BIGINT
        FROM app.expense e
        JOIN app.expense_version ev ON ev.id = e.current_version_id
        WHERE e.event_id = $1
          AND e.deleted_at IS NULL
          AND ev.paid_by = $2
        "#,
        event_id,
        user_id,
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(BalanceError::Database)?;

    // Step 2: Total owed (determined by split logic)
    // (See §2.6 for the full balance computation pattern)

    // ...
    tx.commit().await.map_err(BalanceError::Database)?;

    Ok(UserBalance { /* ... */ })
}
```

**Why `SUM(...)::BIGINT`**? PG `SUM(INTEGER)` returns `BIGINT`. SQLx exposes this as `i64`. The `COALESCE` ensures the result is `0` rather than `NULL` when no rows match, and `0::BIGINT` is handled correctly.

#### Optimistic Locking (Expense Version Conflict)

```rust
// Not needed for MoshSplit — expense versioning uses an append-only
// version chain. "Conflicts" are resolved by creating a new version.
// If two users edit the same expense concurrently, both versions are
// preserved. The latest version (max version_number) wins as "current."
//
// For PATCH endpoints, use a last-write-wins strategy: always create
// a new version. The frontend should refresh after mutation to show
// the latest state.
```

### 2.4 JSONB Extraction Patterns

#### Type-Based Split Data Dispatch

```rust
/// Extract split entries with their computed shares, handling ALL split types.
/// Returns a list of (user_id, share_cents) for the latest version of each expense.
pub async fn get_split_shares_for_event(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<SplitShare>, sqlx::Error> {
    // For equal splits: share = amount_cents / count, remainder to first members
    // For custom splits: amounts are explicit in JSONB
    // For percentage splits: share = amount_cents * pct / 100
    // For shares splits: share = amount_cents * share / total_shares

    // This logic is complex enough to warrant processing in Rust after fetching.
    // Fetch the raw data and compute shares in the application layer.
    let rows = sqlx::query_as!(
        ExpenseSplitRaw,
        r#"
        SELECT
            e.id AS expense_id,
            ev.title,
            ev.amount_cents,
            ev.split_type,
            ev.split_data::jsonb AS "split_data: serde_json::Value",
            ev.paid_by
        FROM app.expense e
        JOIN app.expense_version ev ON ev.id = e.current_version_id
        WHERE e.event_id = $1 AND e.deleted_at IS NULL
        "#,
        event_id,
    )
    .fetch_all(pool)
    .await?;

    // Process in Rust: dispatch on split_type
    let shares = rows
        .into_iter()
        .flat_map(|row| compute_shares_for_expense(row))
        .collect();

    Ok(shares)
}

fn compute_shares_for_expense(row: ExpenseSplitRaw) -> Vec<SplitShare> {
    match row.split_type.as_str() {
        "equal" => compute_equal_shares(row),
        "custom" => compute_custom_shares(row),
        "percentage" => compute_percentage_shares(row),
        "shares" => compute_shares_based(row),
        _ => vec![],
    }
}
```

#### JSONB Querying Inside SQL (when performance matters)

```rust
/// Extract a specific user's custom amount from split_data.
/// Only works for 'custom' split type.
pub async fn get_user_custom_amount(
    pool: &PgPool,
    expense_id: Uuid,
    user_id: Uuid,
) -> Result<Option<i32>, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT
            (ev.split_data->'amounts'->>$1)::INTEGER AS user_amount
        FROM app.expense_version ev
        JOIN app.expense e ON e.current_version_id = ev.id
        WHERE ev.expense_id = $2
          AND ev.split_type = 'custom'
        ORDER BY ev.version_number DESC
        LIMIT 1
        "#,
        user_id.to_string(),   // JSONB key is the UUID as a string
        expense_id,
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.flatten())  // NULL in SQL → None in Rust → Option<Option<i32>> → Option<i32>
}
```

**Key JSONB operators**:

| Operator | Purpose | Example |
|----------|---------|---------|
| `->` | JSON object field → JSON | `split_data->'type'` → `"equal"` (as JSON string) |
| `->>` | JSON object field → TEXT | `split_data->>'type'` → `equal` (as SQL text) |
| `#>>` | JSON path → TEXT | `split_data#>>'{amounts,uuid}'` |
| `?` | Does key exist? | `split_data ? 'shares'` |
| `jsonb_each` | Expand top-level JSON object | `CROSS JOIN LATERAL jsonb_each(split_data->'amounts')` |
| `@>` | Contains? | `split_data @> '{"type":"equal"}'::jsonb` |

#### Lateral Join for Split Expansion

```rust
/// Expand custom splits into per-user rows using a lateral join.
/// This is the most efficient approach for balance computation at the SQL level.
pub async fn get_custom_split_shares(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<CustomSplitRow>, sqlx::Error> {
    sqlx::query_as!(
        CustomSplitRow,
        r#"
        SELECT
            e.id AS expense_id,
            ev.title,
            ev.amount_cents AS total_cents,
            u.user_id::uuid AS "user_id: Uuid",
            u.amount::int AS "share_cents: i32"
        FROM app.expense e
        JOIN app.expense_version ev ON ev.id = e.current_version_id
        CROSS JOIN LATERAL jsonb_each_text(ev.split_data->'amounts') AS u(user_id, amount)
        WHERE e.event_id = $1
          AND e.deleted_at IS NULL
          AND ev.split_type = 'custom'
        "#,
        event_id,
    )
    .fetch_all(pool)
    .await
}
```

**Note**: `jsonb_each_text` returns `TEXT` values, so `amount::int` casts to integer. The `user_id::uuid` cast converts the JSONB text key to `UUID`. Type annotations (`"share_cents: i32"`) help SQLx with type inference in complex queries.

### 2.5 Cursor-Based Pagination

```rust
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Generic paginated query result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<DateTime<Utc>>,
    pub has_more: bool,
}

/// List expenses with cursor-based pagination.
pub async fn list_expenses(
    pool: &PgPool,
    event_id: Uuid,
    cursor: Option<DateTime<Utc>>,   // created_at of the last item from previous page
    limit: i64,                       // max items (default 20, max 100)
    include_deleted: bool,
) -> Result<Paginated<ExpenseWithLatestVersion>, sqlx::Error> {
    // Fetch one extra item to determine has_more
    let query_limit = limit + 1;

    let rows = if let Some(cursor) = cursor {
        // Page after cursor
        sqlx::query_as!(
            ExpenseWithLatestVersion,
            r#"
            SELECT
                e.id, e.event_id, e.created_by, e.created_at,
                e.current_version_id, e.deleted_at,
                ev.title, ev.description, ev.amount_cents,
                ev.paid_by, ev.split_type,
                ev.split_data::jsonb AS "split_data: serde_json::Value",
                ev.version_number
            FROM app.expense e
            JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND ($3 OR e.deleted_at IS NULL)
              AND e.created_at < $2
            ORDER BY e.created_at DESC
            LIMIT $4
            "#,
            event_id,
            cursor,
            include_deleted,
            query_limit,  // i64 for SQLx compatibility
        )
        .fetch_all(pool)
        .await?
    } else {
        // First page
        sqlx::query_as!(
            ExpenseWithLatestVersion,
            r#"
            SELECT
                e.id, e.event_id, e.created_by, e.created_at,
                e.current_version_id, e.deleted_at,
                ev.title, ev.description, ev.amount_cents,
                ev.paid_by, ev.split_type,
                ev.split_data::jsonb AS "split_data: serde_json::Value",
                ev.version_number
            FROM app.expense e
            JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND ($2 OR e.deleted_at IS NULL)
            ORDER BY e.created_at DESC
            LIMIT $3
            "#,
            event_id,
            include_deleted,
            query_limit,
        )
        .fetch_all(pool)
        .await?
    };

    let has_more = rows.len() as i64 > limit;
    let items = if has_more {
        rows.into_iter().take(limit as usize).collect()
    } else {
        rows
    };

    let next_cursor = items.last().map(|item| item.created_at);

    Ok(Paginated {
        items,
        next_cursor,
        has_more,
    })
}
```

**Design notes**:
- `created_at` is the cursor — it must be unique within the result set. If two items can have the same `created_at`, add a tiebreaker (e.g., `ORDER BY created_at DESC, id DESC`).
- The `WHERE created_at < $2` pattern is for **keyset pagination** using `DESC` ordering. For `ASC`, use `>`.
- Always fetch `limit + 1` items to determine `has_more` without an extra count query.

### 2.6 Balance Computation

#### Full Per-Event Balance Query

```rust
/// Raw result for balance computation query.
#[derive(Debug, FromRow)]
pub struct BalanceRow {
    pub user_id: Uuid,
    pub total_paid_cents: i64,    // SUM returns BIGINT
    pub total_owed_cents: i64,
}

/// Compute balances for all active members of an event.
/// Uses a single SQL query with CTEs for efficiency.
pub async fn compute_event_balances(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<BalanceRow>, sqlx::Error> {
    // This uses the conceptual query from data-model.md §5.2,
    // adapted for SQLx compatibility.

    // Because the split logic is dynamic (equal vs custom vs percentage vs shares),
    // the simplest correct approach is to:
    //   1. Fetch all current expense versions with their split_data
    //   2. Compute shares in Rust (handling rounding deterministically)
    //   3. Combine with payment and settlement totals

    // Alternative: push ALL the complexity into SQL. Recommended for performance
    // only when profiling shows the Rust approach is too slow.

    // See the multi-step approach below for the recommended implementation.
    todo!("See balance module for implementation")
}

/// Recommended approach: compute splits in Rust, then combine with PG aggregates.
pub async fn compute_event_balances_rust_splits(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<MemberBalance>, BalanceError> {
    // Step 1: Fetch all active members
    let members = get_active_members(pool, event_id).await?;

    // Step 2: Fetch all current expense versions
    let expenses = get_current_expenses(pool, event_id).await?;

    // Step 3: Compute per-user totals in Rust
    let mut paid: HashMap<Uuid, i64> = HashMap::new();
    let mut owed: HashMap<Uuid, i64> = HashMap::new();

    for expense in &expenses {
        // Payer is owed the full amount
        *paid.entry(expense.paid_by).or_insert(0) += expense.amount_cents as i64;

        // Each participant owes their share
        let shares = compute_shares(expense);  // domain function
        for (user_id, share_cents) in shares {
            *owed.entry(user_id).or_insert(0) += share_cents as i64;
        }
    }

    // Step 4: Fetch payment totals
    let payments = get_payment_totals(pool, event_id).await?;
    for (user_id, net) in payments {
        *paid.entry(user_id).or_insert(0) += net;
    }

    // Step 5: Fetch confirmed settlement totals
    let settlements = get_settlement_totals(pool, event_id).await?;
    for (user_id, net) in settlements {
        *paid.entry(user_id).or_insert(0) += net;
    }

    // Step 6: Build result for each active member
    let balances = members
        .into_iter()
        .map(|m| {
            let p = paid.get(&m.user_id).copied().unwrap_or(0);
            let o = owed.get(&m.user_id).copied().unwrap_or(0);
            MemberBalance {
                user_id: m.user_id,
                total_paid_cents: p,
                total_owed_cents: o,
                net_balance_cents: p - o,
            }
        })
        .collect();

    Ok(balances)
}
```

#### Payment Totals Sub-Query

```rust
async fn get_payment_totals(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<(Uuid, i64)>, sqlx::Error> {
    // Returns (user_id, net_effect) where:
    //   sender (from_user): -amount_cents
    //   receiver (to_user): +amount_cents
    let rows = sqlx::query!(
        r#"
        SELECT from_user AS "from_user: Uuid", amount_cents
        FROM app.payment
        WHERE event_id = $1
        UNION ALL
        SELECT to_user AS "to_user: Uuid", amount_cents
        FROM app.payment
        WHERE event_id = $1
        "#,
        event_id,
    )
    .fetch_all(pool)
    .await?;

    let mut totals: HashMap<Uuid, i64> = HashMap::new();
    for row in rows {
        // The query! macro provides named fields
        let user_id = row.from_user;  // or to_user — both map to the same column alias
        // Actually UNION ALL returns two columns; let's be more explicit:
    }

    todo!("Implement properly")
}
```

**Better approach**: Use `query_as!` with a struct for the UNION ALL query:

```rust
#[derive(FromRow)]
struct PaymentEffect {
    pub user_id: Uuid,
    pub amount_cents: i32,  // positive for received, negative for sent
}

async fn get_payment_effects(
    pool: &PgPool,
    event_id: Uuid,
) -> Result<Vec<PaymentEffect>, sqlx::Error> {
    sqlx::query_as!(
        PaymentEffect,
        r#"
        SELECT
            from_user AS "user_id",
            (-amount_cents) AS "amount_cents"
        FROM app.payment
        WHERE event_id = $1
        UNION ALL
        SELECT
            to_user AS "user_id",
            amount_cents
        FROM app.payment
        WHERE event_id = $1
        "#,
        event_id,
    )
    .fetch_all(pool)
    .await
}
```

### 2.7 Membership Enforcement

```rust
// In authentication middleware or a reusable query:

/// Verify that a user is an active member of an event.
/// Returns `true` if the user has an active (left_at IS NULL) membership.
pub async fn is_active_member(
    pool: &PgPool,
    event_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM app.event_member
            WHERE event_id = $1
              AND user_id = $2
              AND left_at IS NULL
        )
        "#,
        event_id,
        user_id,
    )
    .fetch_one(pool)
    .await
}
```

#### Composite Membership + Role Check

```rust
#[derive(Debug, FromRow)]
pub struct MembershipInfo {
    pub is_active: bool,
    pub role: Option<String>,
}

pub async fn get_membership(
    pool: &PgPool,
    event_id: Uuid,
    user_id: Uuid,
) -> Result<MembershipInfo, sqlx::Error> {
    sqlx::query_as!(
        MembershipInfo,
        r#"
        SELECT
            (left_at IS NULL) AS "is_active!",
            role AS "role?"
        FROM app.event_member
        WHERE event_id = $1 AND user_id = $2
        ORDER BY joined_at DESC
        LIMIT 1
        "#,
        event_id,
        user_id,
    )
    .fetch_optional(pool)
    .await
    .map(|opt| opt.unwrap_or(MembershipInfo {
        is_active: false,
        role: None,
    }))
}
```

**Note**: `"is_active!"` tells SQLx the column is `NOT NULL` (boolean). `"role?"` tells SQLx the column is nullable (`Option<String>`).

---

## 3. Migration Conventions

### 3.1 File Naming

SQLx discovers migrations in a configured directory (default: `migrations/`). File naming convention:

```
migrations/
├── 20260510000001_create_app_schema.sql
├── 20260510000002_create_event_tables.sql
├── 20260510000003_create_expense_tables.sql
├── 20260510000004_create_payment_tables.sql
├── 20260510000005_create_settlement_tables.sql
├── 20260510000006_add_payment_immutability_trigger.sql
└── 20260510000007_create_indexes.sql
```

**Format**: `<YYYYMMDDHHMMSS>_<description>.sql`

SQLx does **not** use separate up/down files (unlike Diesel). Down migrations must be written manually if needed. SQLx tracks applied migrations in a `_sqlx_migrations` table.

**Add down migrations as companion files** (convention, not enforced by SQLx):

```
migrations/
├── 20260510000001_create_event_tables.up.sql
├── 20260510000001_create_event_tables.down.sql
├── ...
```

Then configure SQLx to run `.up.sql` files. However, SQLx out of the box only supports single-file migrations. If down migrations are needed, implement a custom runner or maintain them as documentation only.

**Recommendation**: Keep it simple. Use single-file migrations (`<timestamp>_<name>.sql`) and write down migrations as separate SQL scripts in a `migrations/down/` directory for disaster recovery.

### 3.2 Schema Search Path

SQLx migrations run with the connection's `search_path`. Configure it in the `DATABASE_URL` or in a pre-migration query.

#### Option A: In `DATABASE_URL`

```
DATABASE_URL=postgres://pitboss:password@localhost:5432/moshsplit?search_path=app,public
```

#### Option B: In Each Migration (Recommended)

```sql
-- migrations/20260510000001_create_app_schema.sql
--! Migration will fail if search_path is not app
SET search_path TO app;

CREATE TABLE IF NOT EXISTS app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reset search_path
SET search_path TO DEFAULT;
```

#### Option C: Connection Initialization in Rust

```rust
// src/db/mod.rs
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::migrate::Migrator;
use std::time::Duration;

pub async fn init_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;

    // Set search_path for this pool
    sqlx::query("SET search_path TO app, public")
        .execute(&pool)
        .await?;

    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = Migrator::new(std::path::Path::new("./migrations")).await?;
    migrator.run(pool).await
}
```

**Important**: `SET search_path` on a pool applies to new connections acquired from the pool. For absolute safety, set it in a before-connect hook or in each transaction.

### 3.3 Idempotent Migrations

Always use `IF NOT EXISTS` / `IF EXISTS` and idempotent patterns:

```sql
-- Good
CREATE TABLE IF NOT EXISTS app.event ( ... );
CREATE INDEX IF NOT EXISTS idx_expense_event_id ON app.expense(event_id);

-- For columns that may already exist (PG 9.6+)
ALTER TABLE app.event
    ADD COLUMN IF NOT EXISTS description TEXT;
```

### 3.4 Initial Migration

```sql
-- migrations/20260510000001_create_app_schema.sql
-- Creates the app schema used by pitboss-api.
-- The auth schema is managed separately by Sentinel.

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION pitboss;

-- Set search_path for subsequent migrations
SET search_path TO app;

-----
-- Tables
-----

CREATE TABLE IF NOT EXISTS app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,
    UNIQUE (event_id, user_id, left_at)
);

CREATE TABLE IF NOT EXISTS app.expense (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id  UUID,
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    paid_by         UUID NOT NULL,
    split_type      TEXT NOT NULL CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
    split_data      JSONB NOT NULL,
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expense_id, version_number)
);

CREATE TABLE IF NOT EXISTS app.payment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    currency        TEXT NOT NULL DEFAULT 'EUR',
    description     TEXT,
    payment_method  TEXT,
    external_ref    TEXT,
    recorded_by     UUID NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);

CREATE TABLE IF NOT EXISTS app.settlement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'disputed')),
    settled_at      TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);

-----
-- Indexes
-----

CREATE INDEX IF NOT EXISTS idx_event_member_user_id ON app.event_member(user_id);
CREATE INDEX IF NOT EXISTS idx_event_member_event_id ON app.event_member(event_id);
CREATE INDEX IF NOT EXISTS idx_event_member_active ON app.event_member(event_id, user_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expense_event_id ON app.expense(event_id);
CREATE INDEX IF NOT EXISTS idx_expense_current_version ON app.expense(current_version_id);

CREATE INDEX IF NOT EXISTS idx_expense_version_expense_id ON app.expense_version(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_version_created_at ON app.expense_version(expense_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_event_id ON app.payment(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_recorded_at ON app.payment(event_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_event_id ON app.settlement(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON app.settlement(event_id, status);

-----
-- Optional: payment immutability trigger (defense-in-depth)
-----

CREATE OR REPLACE FUNCTION app.prevent_payment_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'payments are immutable: update/delete on app.payment is forbidden'
        USING ERRCODE = 'MODIFYING_SQL_DATA_NOT_PERMITTED';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_immutable'
    ) THEN
        CREATE TRIGGER trg_payment_immutable
            BEFORE UPDATE OR DELETE ON app.payment
            FOR EACH ROW EXECUTE FUNCTION app.prevent_payment_mutation();
    END IF;
END $$;

SET search_path TO DEFAULT;
```

---

## 4. Error Handling Patterns

### 4.1 SQLx Error Variants

SQLx errors relevant to MoshSplit:

| `sqlx::Error` Variant | When It Occurs | HTTP Mapping |
|----------------------|----------------|--------------|
| `Database(PgDatabaseError)` | Any SQL-level error (constraint violations, type mismatches) | See §4.2 |
| `RowNotFound` | `.fetch_one()` returns 0 rows | 404 Not Found |
| `Decode(_)` | Rust type doesn't match PG column type | 500 Internal (programmer error) |
| `PoolClosed` | Pool was closed/shutdown | 503 Service Unavailable |
| `Protocol(_)` | Connection/protocol error | 500 Internal |
| `Io(_)` | Network error, connection dropped | 500 Internal (retryable) |

### 4.2 PG Error Code Mapping

PostgreSQL error codes are available via `PgDatabaseError.code()`:

```rust
use sqlx::postgres::PgDatabaseError;
use sqlx::Error as SqlxError;

/// Map a SQLx error to a domain error with the appropriate HTTP status code.
pub fn map_database_error(err: SqlxError, context: &str) -> AppError {
    match &err {
        SqlxError::RowNotFound => {
            AppError::NotFound(format!("{} not found", context))
        }
        SqlxError::Database(db_err) => {
            if let Some(pg_err) = db_err.try_downcast_ref::<PgDatabaseError>() {
                match pg_err.code() {
                    // 23503: foreign_key_violation
                    "23503" => {
                        // Inspect constraint name for context
                        let constraint = pg_err.constraint().unwrap_or("unknown");
                        if constraint.contains("event_member") {
                            AppError::MembershipError(
                                "Referenced user is not an event member".into()
                            )
                        } else {
                            AppError::ForeignKeyViolation(format!(
                                "Referenced record does not exist: {}", constraint
                            ))
                        }
                    }
                    // 23505: unique_violation
                    "23505" => {
                        let constraint = pg_err.constraint().unwrap_or("unknown");
                        AppError::Conflict(format!(
                            "Resource already exists ({})", constraint
                        ))
                    }
                    // 23514: check_violation
                    "23514" => {
                        let constraint = pg_err.constraint().unwrap_or("unknown");
                        AppError::ValidationError(format!(
                            "Constraint violation: {}", constraint
                        ))
                    }
                    // 2D000: SERIALIZATION_FAILURE
                    "40001" | "2D000" => {
                        AppError::RetryableConflict("Transaction conflict, retry".into())
                    }
                    // 25006: MODIFYING_SQL_DATA_NOT_PERMITTED
                    "25006" => {
                        AppError::ImmutableViolation(
                            "Cannot modify immutable record (payment)".into()
                        )
                    }
                    _ => {
                        tracing::error!(
                            error.code = %pg_err.code(),
                            error.message = %pg_err.message(),
                            error.detail = ?pg_err.detail(),
                            "Unhandled database error"
                        );
                        AppError::Internal("Database error".into())
                    }
                }
            } else {
                AppError::Internal("Database error".into())
            }
        }
        _ => AppError::Internal("Unexpected database error".into()),
    }
}
```

### 4.3 Domain Error Wrapping

```rust
// src/domain/error.rs

use std::fmt;

/// Top-level application error enum.
/// Converted to HTTP responses in the Axum error handler.
#[derive(Debug)]
pub enum AppError {
    // --- 400 ---
    ValidationError(String),
    InvalidSplit(String),

    // --- 403 ---
    MembershipError(String),
    Forbidden(String),

    // --- 404 ---
    NotFound(String),

    // --- 409 ---
    Conflict(String),
    RetryableConflict(String),

    // --- 422 ---
    SelfPayment,
    ImmutableViolation(String),

    // --- 500 ---
    Internal(String),
    Database(String),
    ForeignKeyViolation(String),
}

impl fmt::Display for AppError { /* ... */ }

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        map_database_error(err, "Resource")
    }
}

// IntoResponse for Axum
impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, code, message) = match &self {
            AppError::ValidationError(msg) => {
                (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg)
            }
            AppError::NotFound(msg) => {
                (StatusCode::NOT_FOUND, "NOT_FOUND", msg)
            }
            AppError::MembershipError(msg) => {
                (StatusCode::FORBIDDEN, "NOT_A_MEMBER", msg)
            }
            AppError::SelfPayment => {
                (StatusCode::UNPROCESSABLE_ENTITY, "SELF_PAYMENT", "Cannot pay yourself")
            }
            // ... etc
        };

        let body = serde_json::json!({
            "success": false,
            "data": null,
            "error": {
                "code": code,
                "message": message,
                "details": []
            },
            "meta": {
                "request_id": /* from tracing */ "",
                "timestamp": /* now */ "",
                "version": "1.0"
            }
        });

        (status, Json(body)).into_response()
    }
}
```

### 4.4 Constraint Naming Convention

To make error mapping reliable, name all constraints explicitly:

```sql
-- Good: named constraints
CREATE TABLE app.event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ...
    CONSTRAINT chk_event_status CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE TABLE app.event_member (
    -- ...
    CONSTRAINT fk_event_member_event
        FOREIGN KEY (event_id) REFERENCES app.event(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_member_active
        UNIQUE (event_id, user_id, left_at),
    CONSTRAINT chk_event_member_role
        CHECK (role IN ('admin', 'member'))
);

CREATE TABLE app.payment (
    -- ...
    CONSTRAINT chk_payment_no_self
        CHECK (from_user <> to_user)
);
```

**Naming convention**: `{fk|uq|chk|idx}_{table}_{description}`

This enables pattern matching on constraint names in error handling:

```rust
fn constraint_to_error(constraint: &str) -> AppError {
    match constraint {
        "chk_payment_no_self" => AppError::SelfPayment,
        "chk_event_status" => AppError::ValidationError("Invalid event status".into()),
        "fk_expense_event" => AppError::NotFound("Referenced event not found".into()),
        s if s.starts_with("fk_event_member") => {
            AppError::MembershipError("Membership reference error".into())
        }
        s if s.starts_with("uq_") => AppError::Conflict("Duplicate resource".into()),
        s if s.starts_with("chk_") => AppError::ValidationError(format!("Constraint: {}", s)),
        _ => AppError::Internal("Database constraint violation".into()),
    }
}
```

---

## 5. Connection Pooling

### 5.1 Pool Configuration

```rust
// src/db/mod.rs

use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions, PgSslMode};
use std::time::Duration;

/// Configuration for the pitboss-api database pool.
#[derive(Debug, Clone)]
pub struct DbConfig {
    pub url: String,
    pub max_connections: u32,
    pub acquire_timeout: Duration,
    pub idle_timeout: Duration,
    pub max_lifetime: Duration,
    pub ssl_mode: PgSslMode,
}

impl Default for DbConfig {
    fn default() -> Self {
        Self {
            url: String::new(),  // Must be set from env
            max_connections: 20,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(30 * 60),   // 30 min
            max_lifetime: Duration::from_secs(60 * 60),   // 60 min
            ssl_mode: PgSslMode::Prefer,
        }
    }
}

impl DbConfig {
    /// Load from environment.
    /// DATABASE_URL is required; all others have defaults.
    pub fn from_env() -> Result<Self, DbConfigError> {
        let url = std::env::var("DATABASE_URL")
            .map_err(|_| DbConfigError::MissingEnvVar("DATABASE_URL"))?;

        Ok(Self {
            url,
            max_connections: std::env::var("DB_MAX_CONNECTIONS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(20),
            acquire_timeout: Duration::from_secs(
                std::env::var("DB_ACQUIRE_TIMEOUT_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(5),
            ),
            ..Default::default()
        })
    }
}

/// Create a connection pool from configuration.
pub fn create_pool(config: &DbConfig) -> PgPool {
    let connect_options = config
        .url
        .parse::<PgConnectOptions>()
        .expect("Invalid DATABASE_URL")
        .ssl_mode(config.ssl_mode);

    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .acquire_timeout(config.acquire_timeout)
        .idle_timeout(config.idle_timeout)
        .max_lifetime(config.max_lifetime)
        .connect_lazy_with(connect_options)
}
```

**Why `connect_lazy_with` vs `connect`**:
- `connect_lazy_with`: Returns immediately; connections established lazily. Startup won't fail if DB is temporarily down (useful for container orchestration).
- `connect` / `connect_with`: Blocks startup until a connection is established. Use when the app must not start without a database.

**Recommendation**: Use `connect_lazy_with` in development, `connect_with` in production with retries.

### 5.2 App State Wiring

```rust
// src/main.rs (conceptual)

use axum::{extract::FromRef, Router};
use sqlx::PgPool;

/// Shared application state available to all handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    // Other shared state: sentinel client, rate limiter, etc.
}

// Allows Axum extractors to access PgPool directly
impl FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.db.clone()
    }
}

#[tokio::main]
async fn main() {
    // Load config
    let db_config = DbConfig::from_env().expect("Failed to load DB config");
    let pool = create_pool(&db_config);

    // Run migrations
    run_migrations(&pool).await.expect("Failed to run migrations");

    let state = AppState { db: pool };

    let app = Router::new()
        .nest("/v1", api_routes())
        .with_state(state);

    // ...
}
```

### 5.3 Health Checks

```rust
// src/routes/health.rs

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use sqlx::PgPool;
use std::time::Instant;

pub async fn health_check(State(pool): State<PgPool>) -> impl IntoResponse {
    let start = Instant::now();

    let db_ok = sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .is_ok();

    let elapsed = start.elapsed();

    if db_ok {
        (
            StatusCode::OK,
            Json(json!({
                "status": "healthy",
                "database": "connected",
                "latency_ms": elapsed.as_millis(),
            })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "unhealthy",
                "database": "disconnected",
            })),
        )
    }
}
```

### 5.4 Multi-Schema Connections

If pitboss-api needs read-only access to the `auth` schema for user profiles:

```rust
/// Two-pool configuration.
/// app_pool: read/write access to app schema
/// auth_pool: read-only access to auth schema (via Sentinel's read-only user)
#[derive(Clone)]
pub struct AppState {
    pub app_pool: PgPool,
    pub auth_pool: Option<PgPool>,   // None if using Sentinel API for user profiles
}

// impl FromRef for both pools would conflict. Instead, extract AppState directly
// and access individual pools:
//
// async fn handler(
//     State(state): State<AppState>,
// ) -> impl IntoResponse {
//     let app_pool = &state.app_pool;
//     let auth_pool = &state.auth_pool;  // Option<PgPool>
// }
```

**Recommendation**: Prefer fetching user profiles via Sentinel's API over direct DB access. This maintains a clean service boundary and avoids credential management for cross-schema access.

---

## 6. Testing Strategy

### 6.1 Test Infrastructure

#### Option A: Testcontainers (Recommended)

```rust
// tests/common/mod.rs

use sqlx::PgPool;
use testcontainers::{core::IntoContainerName, runners::AsyncRunner, ContainerAsync};
use testcontainers_modules::postgres::Postgres;

/// Spin up a PostgreSQL container for integration tests.
pub async fn setup_test_db() -> (ContainerAsync<Postgres>, PgPool) {
    let container = Postgres::default()
        .start()
        .await
        .expect("Failed to start Postgres container");

    let host_port = container
        .get_host_port_ipv4(5432)
        .await
        .expect("Failed to get host port");

    let database_url = format!(
        "postgres://postgres:postgres@127.0.0.1:{}/postgres?search_path=app,public",
        host_port
    );

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test Postgres");

    // Run migrations
    let migrator = sqlx::migrate::Migrator::new(std::path::Path::new("../migrations"))
        .await
        .expect("Failed to load migrations");
    migrator.run(&pool).await.expect("Failed to run migrations");

    (container, pool)
}
```

#### Option B: Docker Compose with Test DB

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pitboss
      POSTGRES_PASSWORD: pitboss_test
      POSTGRES_DB: moshsplit_test
    ports:
      - "5433:5432"
    tmpfs: /var/lib/postgresql/data  # Ephemeral, no persistence
```

```bash
# In CI or locally:
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgres://pitboss:pitboss_test@localhost:5433/moshsplit_test cargo test
docker compose -f docker-compose.test.yml down
```

#### Option C: SQLx `sqlx::test` (Built-in)

```rust
// Use SQLx's test attribute with a test database
#[sqlx::test(migrations = "../migrations")]
async fn test_create_event(pool: PgPool) -> sqlx::Result<()> {
    // pool is automatically provided with a fresh database
    // migrations are run automatically
    // database is dropped after test
}
```

**Important**: `sqlx::test` creates a new database per test (by appending a suffix to `DATABASE_URL`). This requires `CREATE DATABASE` privileges.

**Recommendation**: Use **Option A (testcontainers)** for local development and CI. It's self-contained, doesn't require external services, and each test run gets a fresh database.

### 6.2 Test Database Lifecycle

```rust
// tests/common/mod.rs

use once_cell::sync::OnceCell;
use sqlx::PgPool;
use std::sync::Arc;

/// Global test pool, initialized once per test binary run.
static TEST_POOL: OnceCell<Arc<TestContext>> = OnceCell::new();

pub struct TestContext {
    pub pool: PgPool,
    // Container handle kept alive for the duration of test run
    _container: ContainerAsync<Postgres>,
}

impl TestContext {
    /// Get or initialize the test context.
    pub async fn global() -> &'static Arc<TestContext> {
        TEST_POOL
            .get_or_init(|| async {
                let (container, pool) = setup_test_db().await;
                Arc::new(TestContext {
                    pool,
                    _container: container,
                })
            })
            .await
    }
}

// In each test module:
// use common::*;
//
// async fn test_something() {
//     let ctx = TestContext::global().await;
//     let pool = &ctx.pool;
//     // ... test logic
// }
```

### 6.3 Test Fixtures / Seeds

```rust
// tests/fixtures/mod.rs

use sqlx::PgPool;
use uuid::Uuid;

/// Helper to insert seed data for tests.
pub struct Fixtures;

impl Fixtures {
    /// Create a test event. Returns the event's UUID.
    pub async fn create_event(pool: &PgPool, created_by: Uuid) -> Uuid {
        sqlx::query_scalar!(
            r#"
            INSERT INTO app.event (name, created_by)
            VALUES ('Test Event', $1)
            RETURNING id
            "#,
            created_by,
        )
        .fetch_one(pool)
        .await
        .expect("Failed to create test event")
    }

    /// Add a member to an event.
    pub async fn add_member(
        pool: &PgPool,
        event_id: Uuid,
        user_id: Uuid,
        role: &str,
    ) {
        sqlx::query!(
            r#"
            INSERT INTO app.event_member (event_id, user_id, role)
            VALUES ($1, $2, $3)
            "#,
            event_id,
            user_id,
            role,
        )
        .execute(pool)
        .await
        .expect("Failed to add test member");
    }

    /// Create an expense with one version and update current_version_id.
    pub async fn create_expense(
        pool: &PgPool,
        event_id: Uuid,
        amount_cents: i32,
        paid_by: Uuid,
        split_data: serde_json::Value,
        created_by: Uuid,
    ) -> (Uuid, Uuid) {  // (expense_id, version_id)
        // Use the domain function directly or inline the logic
        let expense_id = Uuid::new_v4();
        let version_id = Uuid::new_v4();

        sqlx::query!(
            r#"
            INSERT INTO app.expense (id, event_id, created_by)
            VALUES ($1, $2, $3)
            "#,
            expense_id,
            event_id,
            created_by,
        )
        .execute(pool)
        .await
        .expect("Failed to create test expense");

        sqlx::query!(
            r#"
            INSERT INTO app.expense_version
                (id, expense_id, version_number, title, amount_cents, paid_by,
                 split_type, split_data, created_by)
            VALUES ($1, $2, 1, 'Test Expense', $3, $4, 'equal', $5, $6)
            "#,
            version_id,
            expense_id,
            amount_cents,
            paid_by,
            split_data as _,
            created_by,
        )
        .execute(pool)
        .await
        .expect("Failed to create test expense version");

        sqlx::query!(
            r#"
            UPDATE app.expense SET current_version_id = $1 WHERE id = $2
            "#,
            version_id,
            expense_id,
        )
        .execute(pool)
        .await
        .expect("Failed to update current_version_id");

        (expense_id, version_id)
    }

    /// Create a payment.
    pub async fn create_payment(
        pool: &PgPool,
        event_id: Uuid,
        from_user: Uuid,
        to_user: Uuid,
        amount_cents: i32,
        recorded_by: Uuid,
    ) -> Uuid {
        sqlx::query_scalar!(
            r#"
            INSERT INTO app.payment (event_id, from_user, to_user, amount_cents, recorded_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
            event_id,
            from_user,
            to_user,
            amount_cents,
            recorded_by,
        )
        .fetch_one(pool)
        .await
        .expect("Failed to create test payment")
    }
}
```

#### Seed Data as SQL Files

```sql
-- tests/fixtures/three_member_event.sql
-- Seed data for balance computation tests.
-- Usage: sqlx::query(include_str!("../fixtures/three_member_event.sql")).execute(&pool)

-- Create event
INSERT INTO app.event (id, name, created_by)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Event', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Add members
INSERT INTO app.event_member (event_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
    ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member'),
    ('00000000-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member');

-- Create expense: A paid €30, split equally among 3
INSERT INTO app.expense (id, event_id, created_by)
    VALUES ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
INSERT INTO app.expense_version (id, expense_id, version_number, title, amount_cents, paid_by, split_type, split_data, created_by)
    VALUES ('v0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1,
            'Hotel', 3000, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'equal', '{"type":"equal","shares":["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","cccccccc-cccc-cccc-cccc-cccccccccccc"]}'::jsonb,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
UPDATE app.expense SET current_version_id = 'v0000000-0000-0000-0000-000000000001'
    WHERE id = 'e0000000-0000-0000-0000-000000000001';
```

### 6.4 Rollback Between Tests

#### Transaction-Based Rollback (Recommended)

```rust
// Each test runs inside a transaction that is rolled back at the end.
// This is fast and doesn't require database creation per test.

use sqlx::PgPool;

async fn run_test<F, Fut>(pool: &PgPool, test_fn: F)
where
    F: FnOnce(&PgPool) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let mut tx = pool.begin().await.expect("Failed to start test transaction");

    // Run the test with the transaction handle
    // The test uses `&*tx` or `&mut *tx` as a connection
    // But the test function expects a PgPool, not a transaction...
    // Solution: have test functions accept &PgConnection or use a wrapper.

    // Option: Savepoint approach
    // 1. Create a pool-level PG savepoint
    // 2. Run test
    // 3. ROLLBACK TO savepoint

    sqlx::query("SAVEPOINT test_start")
        .execute(&mut *tx)
        .await
        .unwrap();

    // We need to pass the tx as a connection. This requires changing
    // test function signatures. Alternative: use database-per-test.
}
```

**Simpler approach**: Use `sqlx::test` with database-per-test, or create/truncate tables between tests.

#### Database-Per-Test Pattern

```rust
// Cargo.toml
[dev-dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono", "json", "migrate"] }
testcontainers = "0.23"
testcontainers-modules = "0.11"
uuid = { version = "1", features = ["v4"] }

// tests/integration/balance_tests.rs

mod common;

#[tokio::test]
async fn test_balance_computation() {
    let ctx = common::TestContext::global().await;
    let pool = &ctx.pool;

    // Arrange: seed data
    let alice = Uuid::new_v4();
    let bob = Uuid::new_v4();
    let event_id = common::fixtures::create_event(pool, alice).await;
    common::fixtures::add_member(pool, event_id, alice, "admin").await;
    common::fixtures::add_member(pool, event_id, bob, "member").await;

    // Alice pays €30, split equally between Alice and Bob
    let split_data = serde_json::json!({
        "type": "equal",
        "shares": [alice, bob],
    });
    common::fixtures::create_expense(pool, event_id, 3000, alice, split_data, alice).await;

    // Act: compute balances
    let balances = compute_event_balances(pool, event_id).await.unwrap();

    // Assert
    let alice_balance = balances.iter().find(|b| b.user_id == alice).unwrap();
    let bob_balance = balances.iter().find(|b| b.user_id == bob).unwrap();

    // Alice paid 3000, owes 1500 → net +1500 (is owed 1500)
    assert_eq!(alice_balance.net_balance_cents, 1500);
    assert_eq!(alice_balance.total_paid_cents, 3000);
    assert_eq!(alice_balance.total_owed_cents, 1500);

    // Bob paid 0, owes 1500 → net -1500 (owes 1500)
    assert_eq!(bob_balance.net_balance_cents, -1500);
    assert_eq!(bob_balance.total_paid_cents, 0);
    assert_eq!(bob_balance.total_owed_cents, 1500);
}
```

### 6.5 Balance Computation Tests

Critical test scenarios for balance computation:

```rust
#[tokio::test]
async fn test_empty_event_balances_are_zero() {
    // Event with members but no expenses/payments → all balances are 0
}

#[tokio::test]
async fn test_single_expense_equal_split() {
    // One person pays, split equally → payer has positive balance, others negative
}

#[tokio::test]
async fn test_penny_rounding_equal_split() {
    // €10 split 3 ways → 334, 333, 333
}

#[tokio::test]
async fn test_custom_split_matches_amount() {
    // Custom splits must sum to expense total
}

#[tokio::test]
async fn test_percentage_split() {
    // Percentage split with proper rounding
}

#[tokio::test]
async fn test_shares_split() {
    // Shares-based split (e.g., 3:2:1)
}

#[tokio::test]
async fn test_payment_reduces_balance() {
    // A payment from debtor to creditor reduces the net balance
}

#[tokio::test]
async fn test_settlement_confirmed_reduces_balance() {
    // A confirmed settlement affects balances; pending does not
}

#[tokio::test]
async fn test_soft_deleted_expense_excluded() {
    // Soft-deleted expenses should not appear in balance computation
}

#[tokio::test]
async fn test_expense_version_history() {
    // Creating a new version replaces the old one in balance computation
}

#[tokio::test]
async fn test_former_member_debts_persist() {
    // If a member leaves, their past expenses still affect balances
}

#[tokio::test]
async fn test_conservation_of_money() {
    // Sum of all net balances is always 0
}

#[tokio::test]
async fn test_multiple_expenses_same_payer() {
    // One person pays for multiple expenses
}

#[tokio::test]
async fn test_complex_scenario() {
    // Multiple expenses, payments, settlements — verify full reconciliation
}

#[tokio::test]
async fn test_balance_explainability() {
    // Each balance must be traceable to individual expense/payment/settlement
}
```

#### Test Directory Structure

```
tests/
├── common/
│   ├── mod.rs           # TestContext, setup_test_db
│   ├── fixtures.rs      # Seed data helpers
│   └── fixtures/
│       ├── three_member_event.sql
│       └── complex_event.sql
├── integration/
│   ├── event_tests.rs
│   ├── expense_tests.rs
│   ├── payment_tests.rs
│   ├── settlement_tests.rs
│   └── balance_tests.rs
└── queries/
    ├── pagination_tests.rs
    └── membership_tests.rs
```

---

## Appendix A: SQLx Compile-Time Checking Checklist

| Item | Required? | Notes |
|------|-----------|-------|
| `DATABASE_URL` at compile time | Yes | Set in `.env` or shell; otherwise use `SQLX_OFFLINE=true` |
| Rust struct matches query columns | Yes | Checked by `query_as!` — struct fields must match SELECT columns |
| Type compatibility (Rust ↔ PG) | Yes | Checked at compile time |
| Correct schema reference (`app.*`) | Yes | Need `search_path=app` in `DATABASE_URL` |
| JSONB type annotations | Yes | Use `AS "field: serde_json::Value"` in RETURNING |
| UUID annotations | Yes | Use `AS "field: Uuid"` or `AS "field?"` for nullable |
| Timestamp annotations | Auto | `DateTime<Utc>` inferred from `TIMESTAMPTZ` |

## Appendix B: Key Indexes for Query Performance

```sql
-- Active membership lookups (used on every API call)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_active
    ON app.event_member(event_id, user_id) WHERE left_at IS NULL;

-- Latest expense version lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_current_ver
    ON app.expense(current_version_id) WHERE current_version_id IS NOT NULL;

-- Cursor-based pagination on expenses (sorted by created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_event_created
    ON app.expense(event_id, created_at DESC) WHERE deleted_at IS NULL;

-- Cursor-based pagination on payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_event_recorded
    ON app.payment(event_id, recorded_at DESC);

-- Balance computation: expense lookup by event
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_version_event
    ON app.expense_version(expense_id, version_number DESC);

-- Settlement status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlement_event_status
    ON app.settlement(event_id, status);
```

## Appendix C: Database User Setup

```sql
-- Run as superuser
CREATE USER pitboss WITH PASSWORD 'your_secure_password';
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION pitboss;

-- Grant necessary privileges
GRANT USAGE ON SCHEMA app TO pitboss;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO pitboss;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO pitboss;

-- Future tables will be owned by pitboss
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT ALL ON TABLES TO pitboss;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
    GRANT ALL ON SEQUENCES TO pitboss;
```

---

*Next: [Data Model](./data-model.md) · [API Design](./api-design.md) · [Security Architecture](./security.md)*
