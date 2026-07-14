//! DTOs for the Settlement aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Balance DTOs (Incoming / Outgoing) ─────────────────────────────────────────

/// A single incoming balance entry — someone owes the current user money.
/// `amount_cents` is always positive.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct IncomingBalanceItem {
    pub user_id: Uuid,
    pub amount_cents: i32,
    /// `created_at` of the most recent expense/settlement that contributed to this balance.
    pub created_at: DateTime<Utc>,
}

/// Response for the incoming balances endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct IncomingBalancesResponse {
    pub items: Vec<IncomingBalanceItem>,
    pub total_cents: i32,
}

/// A single outgoing balance entry — the current user owes someone money.
/// `amount_cents` is always positive (the absolute value of what is owed).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OutgoingBalanceItem {
    pub user_id: Uuid,
    pub amount_cents: i32,
    /// `created_at` of the most recent expense/settlement that contributed to this balance.
    pub created_at: DateTime<Utc>,
}

/// Response for the outgoing balances endpoint.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OutgoingBalancesResponse {
    pub items: Vec<OutgoingBalanceItem>,
    pub total_cents: i32,
}

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
    /// Optional expense ID this settlement is linked to.
    #[serde(default)]
    pub expense_id: Option<Uuid>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expense_id: Option<Uuid>,
}

/// Full history entry for the settle page.
/// `amount_cents` is signed: positive = they paid me (incoming), negative = I paid them (outgoing).
/// `is_outgoing` indicates direction from the current user's perspective.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettlementHistoryItem {
    pub id: Uuid,
    /// Signed amount: positive = counterparty paid current user, negative = current user paid counterparty.
    pub amount_cents: i32,
    pub counterparty_id: Uuid,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    /// True if current user paid the counterparty, false if counterparty paid current user.
    pub is_outgoing: bool,
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
    pub created_by: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expense_id: Option<Uuid>,
}
