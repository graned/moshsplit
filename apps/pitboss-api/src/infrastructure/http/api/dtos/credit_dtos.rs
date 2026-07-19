use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreditResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub amount_cents: i32,
    pub amount_used_cents: i32,
    pub source_expense_id: Option<Uuid>,
    pub status: String,
    pub version: i32,
    pub parent_credit_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreditSummary {
    pub debtor_id: Uuid,
    pub creditor_id: Uuid,
    pub total_available_cents: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateCreditRequest {
    pub creditor_id: Uuid,
    pub debtor_id: Uuid,
    pub amount_cents: i32,
    pub source_expense_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ConvertCreditRequest {
    pub user_id: Uuid,
}
