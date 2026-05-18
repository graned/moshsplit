//! DTOs for the Event Stats endpoint.

use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// Event-level statistics summary.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventStats {
    /// Sum of all expense amounts (latest versions only, non-deleted).
    pub total_spent_cents: i64,
    /// Sum of all confirmed settlement amounts.
    pub total_settled_cents: i64,
    /// `total_spent_cents - total_settled_cents` (event-wide).
    pub outstanding_cents: i64,
    /// Current user's total share across all expenses.
    pub your_share_cents: i64,
    /// Total the current user paid directly (sum of expenses where user = paid_by).
    pub your_paid_cents: i64,
    /// Current user's outstanding: what they still owe (share - paid - settled).
    /// Zero if they don't owe anything.
    pub your_outstanding_cents: i64,
    /// What others owe the user (sum of others' shares in expenses user paid).
    pub your_incoming_cents: i64,
    /// How much of incoming has been settled (confirmed settlements to user).
    pub your_incoming_settled_cents: i64,
    /// Settlement progress as a ratio from 0.0 to 1.0.
    /// 1.0 means all expenses are fully settled.
    pub settlement_progress: f64,
    /// UUID of the user who paid the most (by expense amount).
    /// `None` if there are no expenses.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_spender_id: Option<Uuid>,
    /// Amount paid by the top spender in cents.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_spender_amount_cents: Option<i64>,
}
