//! DTOs for the Activity Feed (Battle Log).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Query Params ───────────────────────────────────────────────────────────────

/// Query parameters for listing activity items.
#[derive(Debug, Clone, Deserialize)]
pub struct ListActivityParams {
    /// Cursor for pagination — encodes `(created_at, id)` of the last item.
    pub cursor: Option<String>,
    /// Maximum number of items to return (default 20, max 100).
    pub limit: Option<i64>,
}

impl ListActivityParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// A single item in the activity feed.
/// Uses a tagged enum so the `type` field discriminates the variant.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActivityItem {
    /// An expense was created.
    Expense {
        id: Uuid,
        title: String,
        amount_cents: i32,
        paid_by: Uuid,
        participant_count: i32,
        created_at: DateTime<Utc>,
        /// Expense category (food, beer, gas, etc.)
        #[serde(skip_serializing_if = "Option::is_none")]
        expense_type: Option<String>,
    },
    /// A settlement was proposed.
    Settlement {
        id: Uuid,
        from_user: Uuid,
        to_user: Uuid,
        amount_cents: i32,
        created_at: DateTime<Utc>,
    },
    /// A member joined the event.
    MemberJoin {
        id: Uuid,
        user_id: Uuid,
        /// Display name — may be `None` if not resolvable.
        #[serde(skip_serializing_if = "Option::is_none")]
        user_name: Option<String>,
        created_at: DateTime<Utc>,
    },
}

/// Response envelope for the activity feed.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ActivityResponse {
    pub items: Vec<ActivityItem>,
    /// Cursor to fetch the next page, or `None` if no more results.
    pub next_cursor: Option<String>,
    /// Whether there are more results beyond this page.
    pub has_more: bool,
}
