//! DTOs for the EventMember aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to add a member to an event.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AddMemberRequest {
    /// The user to add.
    pub user_id: Uuid,
    /// Role — "member" or "admin". Defaults to "member".
    pub role: Option<String>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// A single member in the list.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MemberListItem {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}
