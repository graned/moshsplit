//! DTOs for the Activity Feed (Battle Log).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct ListActivityParams {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

impl ListActivityParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(20).clamp(1, 100)
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActivityItem {
    Expense {
        id: Uuid,
        title: String,
        amount_cents: i32,
        paid_by: Uuid,
        participant_count: i32,
        created_at: DateTime<Utc>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expense_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        deletion_status: Option<String>,
    },
    Payment {
        id: Uuid,
        creditor_id: Uuid,
        debtor_id: Uuid,
        amount_cents: i32,
        created_at: DateTime<Utc>,
    },
    PaymentConfirmed {
        id: Uuid,
        creditor_id: Uuid,
        debtor_id: Uuid,
        amount_cents: i32,
        approved_by: Uuid,
        created_at: DateTime<Utc>,
        reviewed_at: DateTime<Utc>,
    },
    ExpenseUpdated {
        id: Uuid,
        expense_id: Uuid,
        title: String,
        amount_cents: i32,
        paid_by: Uuid,
        participant_count: i32,
        created_at: DateTime<Utc>,
        #[serde(skip_serializing_if = "Option::is_none")]
        expense_type: Option<String>,
    },
    MemberJoin {
        id: Uuid,
        user_id: Uuid,
        #[serde(skip_serializing_if = "Option::is_none")]
        user_name: Option<String>,
        created_at: DateTime<Utc>,
    },
    ExpenseDeleted {
        id: Uuid,
        expense_id: Uuid,
        title: String,
        amount_cents: i32,
        paid_by: Uuid,
        created_at: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ActivityResponse {
    pub items: Vec<ActivityItem>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}
