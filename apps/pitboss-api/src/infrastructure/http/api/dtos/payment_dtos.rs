//! DTOs for the unified Payment aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreatePaymentRequest {
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub expense_id: Option<Uuid>,
    pub amount_cents: i32,
    pub reason: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ProposeTransactionRequest {
    pub amount_cents: i32,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ConfirmTransactionRequest {}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct RejectTransactionRequest {}

// ── Response DTOs ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub expense_id: Option<Uuid>,
    pub amount_cents: i32,
    pub amount_paid_cents: i32,
    pub reason: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentListItem {
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
pub struct PaymentTransactionResponse {
    pub id: Uuid,
    pub payment_id: Uuid,
    pub amount_cents: i32,
    pub status: String,
    pub proposed_by: Uuid,
    pub confirmed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub confirmed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentTransactionListItem {
    pub id: Uuid,
    pub payment_id: Uuid,
    pub amount_cents: i32,
    pub status: String,
    pub proposed_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BalanceSummary {
    pub user_id: Uuid,
    pub total_owed_cents: i32,
    pub total_owing_cents: i32,
    pub net_balance_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentBreakdown {
    pub incoming: Vec<PaymentListItem>,
    pub outgoing: Vec<PaymentListItem>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TransactionWithPaymentContext {
    pub id: Uuid,
    pub payment_id: Uuid,
    pub amount_cents: i32,
    pub status: String,
    pub proposed_by: Uuid,
    pub confirmed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub payment_amount_cents: i32,
    pub payment_reason: String,
}
