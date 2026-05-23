use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A single user's share of an expense.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseShare {
    pub user_id: Uuid,
    pub amount_cents: i32,
}

/// A payment from one user to another.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}

/// A user's balance summary within an event.
///
/// - `balance_cents` > 0: the user is owed money (a creditor).
/// - `balance_cents` < 0: the user owes money (a debtor).
#[derive(Debug, Clone)]
pub struct UserBalance {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
}

/// A simplified transfer that settles part of a debt.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifiedTransfer {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}
