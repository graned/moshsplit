//! DTOs for the Settlement aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to propose a new settlement.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateSettlementRequest {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
}

/// Payload to update settlement status.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateSettlementStatusRequest {
    pub status: String,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full settlement representation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettlementResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<DateTime<Utc>>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Lightweight settlement row for list views.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettlementListItem {
    pub id: Uuid,
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    pub status: String,
    pub created_at: DateTime<Utc>,
}
