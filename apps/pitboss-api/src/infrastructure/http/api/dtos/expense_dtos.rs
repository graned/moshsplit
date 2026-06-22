//! DTOs for the Expense aggregate.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to create a new expense.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateExpenseRequest {
    /// Short title / description.
    pub title: String,
    /// Optional longer description.
    pub description: Option<String>,
    /// Total amount in cents.
    pub amount_cents: i32,
    /// UUID of the member who paid.
    pub paid_by: Uuid,
    /// Split strategy: "equal", "custom", "percentage", "shares".
    pub split_type: String,
    /// Split configuration (depends on split_type).
    pub split_data: serde_json::Value,
    /// Optional notes.
    pub notes: Option<String>,
    /// Expense category.
    pub expense_type: Option<String>,
}

/// Payload to update an expense (creates a new version).
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateExpenseRequest {
    pub title: String,
    pub description: Option<String>,
    pub amount_cents: i32,
    pub paid_by: Uuid,
    pub split_type: String,
    pub split_data: serde_json::Value,
    pub notes: Option<String>,
    pub expense_type: Option<String>,
}

/// Query params for listing expenses.
#[derive(Debug, Clone, Deserialize, utoipa::IntoParams)]
pub struct ListExpensesParams {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
    /// If true, include soft-deleted expenses.
    pub include_deleted: Option<bool>,
    /// Filter by expense category (food, beer, gas, transport, merch, camping).
    pub expense_type: Option<String>,
    /// Filter to show only expenses paid by the user (War Chest).
    pub user_id: Option<Uuid>,
}

impl ListExpensesParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
    pub fn include_deleted(&self) -> bool {
        self.include_deleted.unwrap_or(false)
    }
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Full expense returned by GET /expenses/:id.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub current_version: Option<ExpenseVersionResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
}

/// An expense row in a list.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseListItem {
    pub id: Uuid,
    pub event_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub current_version_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub version_number: Option<i32>,
    pub title: Option<String>,
    pub amount_cents: Option<i32>,
    pub paid_by: Option<Uuid>,
    pub split_type: Option<String>,
    /// Expense category (food, beer, gas, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expense_type: Option<String>,
    /// UUIDs of all participants in this expense
    #[serde(skip_serializing_if = "Option::is_none")]
    pub participant_ids: Option<Vec<Uuid>>,
    /// Optional notes from the current version
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// A single version of an expense.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseVersionResponse {
    pub id: Uuid,
    pub expense_id: Uuid,
    pub version_number: i32,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub amount_cents: i32,
    pub paid_by: Uuid,
    pub split_type: String,
    pub split_data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub shares: Vec<ExpenseVersionShareItem>,
}

/// Full version with shares list.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseVersionDetail {
    pub id: Uuid,
    pub expense_id: Uuid,
    pub version_number: i32,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub amount_cents: i32,
    pub paid_by: Uuid,
    pub split_type: String,
    pub split_data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub shares: Vec<ExpenseVersionShareItem>,
}

/// A single share row.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ExpenseVersionShareItem {
    pub user_id: Uuid,
    pub share_cents: i32,
}
