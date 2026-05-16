//! DTOs for Admin endpoints — audit log and system stats.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Audit Log DTOs ───────────────────────────────────────────────────────────

/// A single entry in the audit log.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AuditEntry {
    /// Unique identifier for the audit entry.
    pub id: Uuid,
    /// The action that was performed (e.g. "create_event", "delete_expense").
    pub action: String,
    /// The type of entity affected (e.g. "event", "expense", "settlement").
    pub entity_type: String,
    /// The UUID of the entity that was affected.
    pub entity_id: Uuid,
    /// The UUID of the user who performed the action.
    pub user_id: Uuid,
    /// Additional details about the action, stored as JSON.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    /// When the action was recorded.
    pub created_at: DateTime<Utc>,
}

/// Query parameters for listing audit log entries.
#[derive(Debug, Clone, Deserialize)]
pub struct ListAuditParams {
    /// Cursor for pagination — encodes `(created_at, id)` of the last entry.
    pub cursor: Option<String>,
    /// Maximum number of entries to return (default 20, max 100).
    pub limit: Option<i64>,
}

impl ListAuditParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

/// Response envelope for the audit log.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AuditLogResponse {
    pub entries: Vec<AuditEntry>,
    /// Cursor to fetch the next page, or `None` if no more results.
    pub next_cursor: Option<String>,
    /// Whether there are more results beyond this page.
    pub has_more: bool,
}

// ── Admin Stats DTOs ─────────────────────────────────────────────────────────

/// System health status indicator.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SystemHealth {
    /// All systems operational.
    Healthy,
    /// Degraded performance or partial outage.
    Degraded,
    /// Critical failure.
    Unhealthy,
}

/// System-wide statistics for admin dashboard.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct AdminStats {
    /// Total number of events in the system.
    pub total_events: i64,
    /// Number of users with at least one active event membership.
    pub active_users: i64,
    /// Total number of expenses (including deleted).
    pub total_expenses: i64,
    /// Overall system health status.
    pub system_health: SystemHealth,
}
