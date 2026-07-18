//! DTOs for Balance-related endpoints.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserBalanceItem {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BalancesResponse {
    pub balances: Vec<UserBalanceItem>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UserBalanceResponse {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct DebtTransfer {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SimplifiedDebtsResponse {
    pub transfers: Vec<DebtTransfer>,
}

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
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentBreakdown {
    pub id: Uuid,
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub amount_cents: i32,
    pub amount_paid_cents: i32,
    pub reason: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CategoryGrossTotals {
    pub incoming: i32,
    pub outgoing: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CategoryTotals {
    pub gross: CategoryGrossTotals,
    pub net: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TotalsSection {
    pub expenses: CategoryTotals,
    pub payments: CategoryTotals,
}

#[derive(Debug, Clone, Serialize, ToSchema, Default)]
pub struct CounterpartyCategoryTotals {
    pub incoming: i32,
    pub outgoing: i32,
    pub net: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema, Default)]
pub struct CounterpartyBalance {
    pub net: i32,
    pub incoming: i32,
    pub outgoing: i32,
    pub expenses: CounterpartyCategoryTotals,
    pub payments: CounterpartyCategoryTotals,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BalancesSection {
    pub net: i32,
    pub incoming: i32,
    pub outgoing: i32,
    pub by_counterparty: HashMap<Uuid, CounterpartyBalance>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExplainBalanceResponse {
    pub user_id: Uuid,
    pub paid_cents: i32,
    pub owes_cents: i32,
    pub balance_cents: i32,
    pub expenses: Vec<ExpenseBreakdown>,
    pub payments: Vec<PaymentBreakdown>,
    pub totals: TotalsSection,
    pub balances: BalancesSection,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ExternalBalanceSummaryRequest {
    pub email: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExternalBalanceItem {
    pub title: String,
    pub amount_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExternalBalanceSummaryResponse {
    pub event_name: String,
    pub total_balance_cents: i32,
    pub items: Vec<ExternalBalanceItem>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExplainBalanceBetweenResponse {
    pub user_id: Uuid,
    pub counterparty_id: Uuid,
    pub expenses: Vec<ExpenseBreakdown>,
}
