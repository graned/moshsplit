//! DTOs for Balance-related endpoints.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
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
    pub expense_id: Uuid,
    pub title: String,
    pub amount_cents: i32,
    pub paid_cents: i32,
    pub share_cents: i32,
    pub paid_by: Uuid,
    pub expense_type: Option<String>,
    pub participants: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
    /// "incoming" if the current user paid (others owe them), "outgoing" otherwise.
    pub direction: String,
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

/// Breakdown of a single reimbursement for the "explain" endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReimbursementBreakdown {
    pub id: Uuid,
    pub ref_expense_id: Uuid,
    pub settlement_id: Option<Uuid>,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub original_expense_title: String,
    pub created_at: DateTime<Utc>,
}

// ── Totals & Balances ─────────────────────────────────────────────────────────

/// Gross incoming/outgoing totals for a single category.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CategoryGrossTotals {
    pub incoming: i32,
    pub outgoing: i32,
}

/// Category totals with gross amounts and net.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CategoryTotals {
    pub gross: CategoryGrossTotals,
    pub net: i32,
}

/// Aggregated totals across all categories.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TotalsSection {
    pub expenses: CategoryTotals,
    pub payments: CategoryTotals,
    pub settlements: CategoryTotals,
    pub reimbursements: CategoryTotals,
}

/// Per-counterparty breakdown for a single category.
#[derive(Debug, Clone, Serialize, ToSchema, Default)]
pub struct CounterpartyCategoryTotals {
    pub incoming: i32,
    pub outgoing: i32,
    pub net: i32,
}

/// Full balance breakdown for a single counterparty.
#[derive(Debug, Clone, Serialize, ToSchema, Default)]
pub struct CounterpartyBalance {
    pub net: i32,
    pub incoming: i32,
    pub outgoing: i32,
    pub expenses: CounterpartyCategoryTotals,
    pub payments: CounterpartyCategoryTotals,
    pub settlements: CounterpartyCategoryTotals,
    pub reimbursements: CounterpartyCategoryTotals,
}

/// Per-counterparty balance section.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BalancesSection {
    pub net: i32,
    pub incoming: i32,
    pub outgoing: i32,
    pub by_counterparty: HashMap<Uuid, CounterpartyBalance>,
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
    pub reimbursements: Vec<ReimbursementBreakdown>,
    pub totals: TotalsSection,
    pub balances: BalancesSection,
}

// ── External Balance Summary ──────────────────────────────────────────────────

/// Request body for the external balance summary endpoint.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ExternalBalanceSummaryRequest {
    pub email: String,
}

/// A single per-expense balance item.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExternalBalanceItem {
    pub title: String,
    pub amount_cents: i32,
}

/// Response for the external balance summary endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExternalBalanceSummaryResponse {
    pub event_name: String,
    pub total_balance_cents: i32,
    pub items: Vec<ExternalBalanceItem>,
}

/// Expenses breakdown between the current user and a counterparty.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExplainBalanceBetweenResponse {
    pub user_id: Uuid,
    pub counterparty_id: Uuid,
    pub expenses: Vec<ExpenseBreakdown>,
    pub reimbursements: Vec<ReimbursementBreakdown>,
}
