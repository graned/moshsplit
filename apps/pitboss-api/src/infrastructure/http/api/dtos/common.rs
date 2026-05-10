//! Shared DTO types — cursor-based pagination params and response wrapper.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Query parameters for cursor-based pagination.
#[derive(Debug, Clone, Deserialize)]
pub struct CursorParams {
    /// ISO 8601 timestamp cursor — rows with `created_at` < this value are returned.
    pub cursor: Option<String>,
    /// Maximum number of rows to return (default 20, max 100).
    pub limit: Option<i64>,
}

impl CursorParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

/// Query parameters for listing events.
#[derive(Debug, Clone, Deserialize)]
pub struct ListEventsParams {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
    /// Filter by event status (e.g. "active", "archived", "deleted").
    pub status: Option<String>,
}

impl ListEventsParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

/// Query parameters for listing settlements.
#[derive(Debug, Clone, Deserialize)]
pub struct ListSettlementsParams {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
    /// Filter by settlement status.
    pub status: Option<String>,
}

impl ListSettlementsParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

/// Metadata included in paginated list responses.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaginationMeta {
    /// Cursor to pass to the next page request, if `has_more` is true.
    pub next_cursor: Option<String>,
    /// Whether there are more results beyond this page.
    pub has_more: bool,
    /// The limit that was applied to this page.
    pub limit: i64,
}

/// Paginated list wrapper.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub pagination: PaginationMeta,
}
