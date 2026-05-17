//! DTOs for the Settlement aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to propose a new settlement (honor request).
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateSettlementRequest {
    pub from_user: Uuid,
    pub to_user: Uuid,
    pub amount_cents: i32,
    /// Optional note from the requester.
    #[serde(default)]
    pub note: Option<String>,
    /// Optional proof URL (receipt screenshot, etc.).
    #[serde(default)]
    pub proof_url: Option<String>,
}

/// Payload to approve a settlement request.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct ApproveSettlementRequest {}

/// Payload to reject a settlement request.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct RejectSettlementRequest {
    /// Optional reason for rejection.
    #[serde(default)]
    pub rejection_note: Option<String>,
}

/// Payload to update settlement status (legacy).
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_note: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_note: Option<String>,
}
