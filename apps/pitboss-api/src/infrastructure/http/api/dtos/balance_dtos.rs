//! DTOs for Balance-related endpoints.

use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// A single user's balance within an event.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserBalanceItem {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
}

/// Wrapper for the full list of balances.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BalancesResponse {
    pub balances: Vec<UserBalanceItem>,
}

/// Single user balance response.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserBalanceResponse {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
}

/// One debt transfer in the simplified-debts result.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DebtTransfer {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}

/// Simplified debts — minimal set of transfers to settle all balances.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SimplifiedDebtsResponse {
    pub transfers: Vec<DebtTransfer>,
}

/// Breakdown of a single expense for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseBreakdown {
    pub title: String,
    pub amount_cents: i32,
    pub paid_cents: i32,
    pub share_cents: i32,
    pub paid_by: Uuid,
    pub expense_type: Option<String>,
    pub participants: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// Breakdown of a single payment for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentBreakdown {
    pub id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub recorded_at: DateTime<Utc>,
    pub description: Option<String>,
    pub payment_method: Option<String>,
}

/// Breakdown of a single settlement for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettlementBreakdown {
    pub id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub settled_at: Option<DateTime<Utc>>,
    pub note: Option<String>,
}

/// Full breakdown explaining a user's balance.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExplainBalanceResponse {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
    pub expenses: Vec<ExpenseBreakdown>,
    pub payments: Vec<PaymentBreakdown>,
    pub settlements: Vec<SettlementBreakdown>,
}
