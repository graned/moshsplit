# moshsplit-balance-engine

**Pure Rust balance computation engine — zero database, zero HTTP, zero infrastructure dependencies.**

This crate implements the core math that powers every balance, debt, and settlement in MoshSplit. It is deliberately decoupled from any database, HTTP framework, or storage layer. All functions are pure transformations of input data: give it the numbers, get back the truth.

---

## Core Philosophy

**Never hide the math.**

Every balance in MoshSplit must be explainable — traceable to the individual expenses, payments, and splits that produced it. This crate enforces that transparency at the lowest level. There are no stored balances, no cached snapshots, no "black box" computations. The numbers you get are the numbers you put in, transformed by a deterministic formula you can read in under 20 lines.

This crate also enforces the **conservation invariant**: the sum of all user balances in any event is always zero. Every cent is accounted for.

---

## Core Types

| Type | Fields | Description |
|---|---|---|
| `ExpenseShare` | `user_id`, `amount_cents` | A single user's share of an expense |
| `Payment` | `from_user`, `to_user`, `amount_cents` | A transfer of money between two users |
| `UserBalance` | `user_id`, `paid_cents`, `owes_cents`, `balance_cents` | A user's computed balance summary |
| `SimplifiedTransfer` | `from_user`, `to_user`, `amount_cents` | One leg of a simplified settlement plan |

All amounts are in integer cents (`i32`). There is never floating-point money.

---

## Balance Formula

```rust
pub fn compute_balance(
    paid_cents: i32,
    owes_cents: i32,
    payments_out: i32,
    payments_in: i32,
) -> i32;
```

```
balance = paid − owes + payments_out − payments_in
```

| Term | Effect | Why |
|---|---|---|
| `paid_cents` | **+** balance | You put money into the expense |
| `owes_cents` | **−** balance | You owe your share of the expense |
| `payments_out` | **+** balance | You sent money to someone — your debt decreases |
| `payments_in` | **−** balance | Someone sent you money — what you're owed decreases |

### Sign convention (the F6 fix)

This is the corrected formula. A prior version had `payments_out` and `payments_in` signs flipped, which caused counter-intuitive results. The corrected sign convention can be verified intuitively:

- **Alice** pays €20 for a group dinner split equally between Alice and Bob. Each owes €10.
  - Alice: `balance = 2000 − 1000 + 0 − 0 = +1000` (she's owed €10)
  - Bob: `balance = 0 − 1000 + 0 − 0 = −1000` (he owes €10)

- **Bob** sends Alice €3 as a partial payment.
  - Alice: `balance = 2000 − 1000 + 0 − 300 = +700` (she's now owed €7)
  - Bob: `balance = 0 − 1000 + 300 − 0 = −700` (he now owes €7)

Alice's balance decreased because she received money (her claim against the group shrunk). Bob's balance increased because he sent money (his debt shrunk). That's the correct intuition.

### Conservation invariant

```
sum(balance) over all users = 0
```

Every cent paid by someone is owed by someone else. Every payment between users simply redistributes who owes whom. The sum never deviates from zero. This is verified in the test suite.

---

## Simplified Debts (Greedy Settlement)

```rust
pub fn simplified_debts(balances: &[UserBalance]) -> Vec<SimplifiedTransfer>;
```

Given a set of user balances, produces the minimal set of transfers needed to settle all debts.

### Algorithm

1. **Split** users into creditors (balance > 0) and debtors (balance < 0).
2. **Sort** both lists by absolute balance descending.
3. **Match** the largest debtor with the largest creditor, transferring `min(debt, credit)`.
4. **Repeat** until all debts are settled.

This produces **at most n−1 transfers** where n is the number of non-zero-balance users. The algorithm is deterministic: ties are broken by user_id order (via stable sort).

### Example

```
Balances: A=+500¢, B=+200¢, C=−700¢

Step 1:  C(−700¢) → A(+500¢):  transfer 500¢,  C now owes 200¢
Step 2:  C(−200¢) → B(+200¢):  transfer 200¢,  all settled

Result: 2 transfers instead of the naive 3.
```

Zero-balance users are ignored entirely — they never appear in the output.

---

## Redistribution

```rust
pub fn redistribute_shares(
    remaining_participants: &[(Uuid, i32)],
    total_amount_cents: i32,
) -> Vec<(Uuid, i32)>;
```

When participants are added to or removed from an expense, the total amount is redistributed proportionally among the new set of participants.

### Algorithm

Equal split with remainder rounding: the first `remainder` participants receive `base + 1` cent, all others receive `base`. This is the same rounding strategy used by `compute_shares` in the main application.

### Example

```
Total: €10.00 (1000¢)
Participants: A, B, C  →  base = 333, remainder = 1

A gets 334¢
B gets 333¢
C gets 333¢
━━━━━━━━━━━━
Total: 1000¢ ✓
```

---

## Test Scenarios

The crate includes **27 unit tests** across 13 scenario families. Every test is a pure function call — no DB, no Docker, no I/O. These tests serve as the executable specification for the balance engine.

| Scenario | What it covers | Tests |
|---|---|---|
| **S1** | Basic 2-user balance and settlement | 1 |
| **S2** | Core 5-user scenario with multiple expenses | 1 |
| **S3** | Payer not in split (host pays for others) | 1 |
| **S4** | Custom (unequal) splits | 1 |
| **S5** | Percentage splits with rounding | 1 |
| **S6** | Multiple overlapping expenses per user | 1 |
| **S7** | Payment sign (F6 fix verification) + multiple payments | 2 |
| **S8** | Simplified debts greedy algorithm (complex + all-debtors edge case) | 2 |
| **S9** | Zero-balance users ignored in settlement | 1 |
| **S10** | Rounding edge cases (1¢ splits, negative amounts) | 1 |
| **S11** | Single member (self-split produces zero balance) | 1 |
| **S12** | Redistribution (add member + remove member) | 2 |
| **S13** | Redistribution with existing payments + odd amount removal | 2 |

---

## Usage

Add to your `Cargo.toml`:

```toml
[dependencies]
moshsplit-balance-engine = { path = "../packages/moshsplit-balance-engine" }
```

### Computing balances for an event

```rust
use moshsplit_balance_engine::compute_balance;

// Alice paid €20, split equally with Bob. Each owes €10.
let alice = compute_balance(2000, 1000, 0, 0);   // +1000
let bob   = compute_balance(0, 1000, 0, 0);      // -1000
assert_eq!(alice + bob, 0);  // conservation invariant
```

### Generating a settlement plan

```rust
use uuid::Uuid;
use moshsplit_balance_engine::{UserBalance, simplified_debts};

let a = Uuid::new_v4();
let b = Uuid::new_v4();

let balances = vec![
    UserBalance { user_id: a, paid_cents: 2000, owes_cents: 1000, balance_cents: 1000 },
    UserBalance { user_id: b, paid_cents: 0, owes_cents: 1000, balance_cents: -1000 },
];

let transfers = simplified_debts(&balances);
assert_eq!(transfers.len(), 1);
assert_eq!(transfers[0].from_user, b);
assert_eq!(transfers[0].to_user, a);
assert_eq!(transfers[0].amount_cents, 1000);
```

### Redistributing after removing a participant

```rust
use uuid::Uuid;
use moshsplit_balance_engine::redistribute_shares;

let a = Uuid::new_v4();
let b = Uuid::new_v4();

// 1000¢ originally split among A, B, C. C removed.
let shares = redistribute_shares(&[(a, 333), (b, 333)], 1000);
assert_eq!(shares[0].1, 500);  // A gets 500¢
assert_eq!(shares[1].1, 500);  // B gets 500¢
```

---

## Dependencies

| Dependency | Version | Why |
|---|---|---|
| `serde` | 1.0 (with `derive`) | Serialization for API boundary types |
| `uuid` | 1.0 (with `v4`, `serde`) | User and event identifiers |

That's it. The crate has zero database, HTTP, or framework dependencies. It is a pure computation engine.

---

## Relationship to MoshSplit

```
apps/pitboss-api (Rust/Axum)
    │
    │  calls balance engine with real data from PostgreSQL
    ▼
packages/moshsplit-balance-engine  ← YOU ARE HERE
    │
    │  pure functions, zero I/O
    ▼
[math]

```

The balance engine is the foundation. The application layer (pitboss-api) queries expenses and payments from the database, passes them through `compute_balance` and `simplified_debts`, and returns the results to the frontend. The balance engine never touches a database — it doesn't need to. It only needs numbers.

---

## Testing

Run the full test suite (all 27 scenario tests plus module-level unit tests):

```bash
cargo test
```

All tests are pure in-memory — they complete in milliseconds with zero external setup.

---

## License

MIT — because splitting expenses shouldn't cost money.
