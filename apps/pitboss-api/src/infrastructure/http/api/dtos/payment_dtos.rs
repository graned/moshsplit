//! DTOs for the Payment aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to record a new payment.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreatePaymentRequest {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub currency: Option<String>,
    pub description: Option<String>,
    pub payment_method: Option<String>,
    pub external_ref: Option<String>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full payment representation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub currency: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_ref: Option<String>,
    pub recorded_by: Uuid,
    pub recorded_at: DateTime<Utc>,
}

/// Lightweight payment row for list views.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaymentListItem {
    pub id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub currency: String,
    pub recorded_at: DateTime<Utc>,
}
