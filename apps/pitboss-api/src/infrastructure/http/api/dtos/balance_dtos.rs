//! DTOs for Balance-related endpoints.

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
}

/// Breakdown of a single payment for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentBreakdown {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}

/// Breakdown of a single settlement for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettlementBreakdown {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub status: String,
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
