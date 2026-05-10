//! DTOs for the Event aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to create a new event.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateEventRequest {
    /// Event name (required).
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// ISO 4217 currency code (e.g. "USD"). Defaults to "USD".
    pub currency: Option<String>,
}

/// Payload to partially update an event.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateEventRequest {
    /// New name.
    pub name: Option<String>,
    /// New description (set to `""` to clear).
    pub description: Option<String>,
    /// New currency code.
    pub currency: Option<String>,
    /// New status.
    pub status: Option<String>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full event representation returned by GET /events/:id.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventResponse {
    pub id: Uuid,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub currency: String,
    pub status: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub member_count: i64,
}

/// Lightweight event row used in list responses.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventListItem {
    pub id: Uuid,
    pub name: String,
    pub currency: String,
    pub status: String,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}
