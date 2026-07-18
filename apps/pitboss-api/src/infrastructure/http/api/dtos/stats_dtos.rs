//! DTOs for the Event Stats endpoint.

use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventStats {
    pub total_spent_cents: i64,
    pub total_paid_cents: i64,
    pub outstanding_cents: i64,
    pub your_share_cents: i64,
    pub your_paid_cents: i64,
    pub your_outstanding_cents: i64,
    pub your_incoming_cents: i64,
    pub your_incoming_paid_cents: i64,
    pub your_outgoing_paid_cents: i64,
    pub payment_progress: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_spender_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_spender_amount_cents: Option<i64>,
}
