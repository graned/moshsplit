//! ExpenseRepository — CRUD + paginated listing + soft-delete for `app::expense`.

use chrono::DateTime;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Array, Integer, Nullable, Text, Timestamptz, Uuid as DUuid};
use diesel::OptionalExtension;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::expense;
use crate::schema_enums::{ExpenseType, SplitType};
use crate::schema_models::Expense;

crate::impl_repository!(
    ExpenseRepository for Expense,
    table: expense::table,
    pk_column: expense::id,
    pk_type: Uuid,
);

/// An expense row joined with its latest version title and amount.
#[derive(Debug, Clone, Queryable)]
pub struct ExpenseListItem {
    pub id: Uuid,
    pub event_id: Uuid,
    pub created_by: Uuid,
    pub created_at: DateTime<chrono::Utc>,
    pub current_version_id: Option<Uuid>,
    pub deleted_at: Option<DateTime<chrono::Utc>>,
    pub deletion_status: Option<String>,
    pub version_number: Option<i32>,
    pub title: Option<String>,
    pub amount_cents: Option<i32>,
    pub paid_by: Option<Uuid>,
    pub split_type: Option<SplitType>,
    pub expense_type: Option<ExpenseType>,
    pub participant_ids: Option<Vec<Uuid>>,
    pub notes: Option<String>,
}

/// Raw SQL result row for paginated listing.
#[derive(Debug, Clone, QueryableByName)]
struct ExpenseListItemRow {
    #[diesel(sql_type = DUuid)]
    id: Uuid,
    #[diesel(sql_type = DUuid)]
    event_id: Uuid,
    #[diesel(sql_type = DUuid)]
    created_by: Uuid,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<chrono::Utc>,
    #[diesel(sql_type = Nullable<DUuid>)]
    current_version_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    deleted_at: Option<DateTime<chrono::Utc>>,
    #[diesel(sql_type = Nullable<Text>)]
    deletion_status: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    version_number: Option<i32>,
    #[diesel(sql_type = Nullable<Text>)]
    title: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    amount_cents: Option<i32>,
    #[diesel(sql_type = Nullable<DUuid>)]
    paid_by: Option<Uuid>,
    #[diesel(sql_type = Nullable<Text>)]
    split_type: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    expense_type: Option<String>,
    #[diesel(sql_type = Nullable<Array<DUuid>>)]
    participant_ids: Option<Vec<Uuid>>,
    #[diesel(sql_type = Nullable<Text>)]
    notes: Option<String>,
}

impl ExpenseListItemRow {
    fn into_expense_list_item(self) -> ExpenseListItem {
        ExpenseListItem {
            id: self.id,
            event_id: self.event_id,
            created_by: self.created_by,
            created_at: self.created_at,
            current_version_id: self.current_version_id,
            deleted_at: self.deleted_at,
            deletion_status: self.deletion_status,
            version_number: self.version_number,
            title: self.title,
            amount_cents: self.amount_cents,
            paid_by: self.paid_by,
            split_type: self.split_type.and_then(|s| s.parse().ok()),
            expense_type: self.expense_type.and_then(|s| s.parse().ok()),
            participant_ids: self.participant_ids,
            notes: self.notes,
        }
    }
}

impl ExpenseRepository {
    /// List expenses for an event with cursor-based pagination.
    /// Optionally includes soft-deleted expenses when `include_deleted` is true.
    /// Optionally filters by user_id (shows expenses where user is payer or participant).
    /// Returns `(rows, has_more)`.
    pub fn list_by_event_id_paginated(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
        include_deleted: bool,
        expense_type: Option<&str>,
        user_id: Option<Uuid>,
    ) -> Result<(Vec<ExpenseListItem>, bool), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let sql = r#"
            SELECT
                e.id,
                e.event_id,
                e.created_by,
                e.created_at,
                e.current_version_id,
                e.deleted_at,
                e.deletion_status,
                ev.version_number,
                ev.title,
                ev.amount_cents,
                ev.paid_by,
                ev.split_type::TEXT,
                ev.expense_type::TEXT,
                (
                    SELECT array_agg(sh.user_id)
                    FROM app.expense_version_share sh
                    WHERE sh.expense_version_id = e.current_version_id
                ) AS participant_ids,
                ev.notes
            FROM app.expense e
            LEFT JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND ($2 OR e.deleted_at IS NULL)
              AND ($3::timestamptz IS NULL OR e.created_at < $3)
              AND ($4::TEXT IS NULL OR ev.expense_type::TEXT = $4)
              AND ($5::UUID IS NULL OR ev.paid_by = $5)
            ORDER BY e.created_at DESC
            LIMIT $6
        "#;

        let cursor_ts: Option<DateTime<chrono::Utc>> = cursor
            .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
            .map(|ts| ts.with_timezone(&chrono::Utc));

        let results: Vec<ExpenseListItemRow> = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<diesel::sql_types::Bool, _>(include_deleted)
            .bind::<Nullable<Timestamptz>, _>(cursor_ts)
            .bind::<Nullable<Text>, _>(expense_type)
            .bind::<Nullable<DUuid>, _>(user_id)
            .bind::<Integer, _>(fetch_limit as i32)
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let rows: Vec<ExpenseListItem> = if has_more {
            results
                .into_iter()
                .take(limit as usize)
                .map(|r| r.into_expense_list_item())
                .collect()
        } else {
            results
                .into_iter()
                .map(|r| r.into_expense_list_item())
                .collect()
        };

        Ok((rows, has_more))
    }

    /// Find an expense with its latest version info.
    pub fn find_by_id_with_latest_version(
        &self,
        expense_id: Uuid,
    ) -> Result<Option<ExpenseListItem>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT
                e.id,
                e.event_id,
                e.created_by,
                e.created_at,
                e.current_version_id,
                e.deleted_at,
                e.deletion_status,
                ev.version_number,
                ev.title,
                ev.amount_cents,
                ev.paid_by,
                ev.split_type::TEXT,
                ev.expense_type::TEXT,
                (
                    SELECT array_agg(sh.user_id)
                    FROM app.expense_version_share sh
                    WHERE sh.expense_version_id = e.current_version_id
                ) AS participant_ids,
                ev.notes
            FROM app.expense e
            LEFT JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.id = $1
        "#;

        let result: Option<ExpenseListItemRow> = sql_query(sql)
            .bind::<DUuid, _>(expense_id)
            .get_result(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result.map(|r| r.into_expense_list_item()))
    }

    /// Soft-delete an expense by setting deleted_at.
    pub fn soft_delete(
        &self,
        expense_id: Uuid,
        deleted_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(expense::table.filter(expense::id.eq(expense_id)))
            .set(expense::deleted_at.eq(deleted_at))
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Set the deletion_status on an expense (e.g., "pending_deletion" or null to clear).
    pub fn set_deletion_status(
        &self,
        expense_id: Uuid,
        status: Option<String>,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(expense::table.filter(expense::id.eq(expense_id)))
            .set(expense::deletion_status.eq(status))
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Update the current_version_id on an expense.
    pub fn set_current_version(
        &self,
        expense_id: Uuid,
        version_id: Uuid,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(expense::table.filter(expense::id.eq(expense_id)))
            .set(expense::current_version_id.eq(version_id))
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Find all expense IDs in an event where the given user is a participant
    /// (appears in the latest version's shares).
    pub fn find_expense_ids_by_participant(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Uuid>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT e.id
            FROM app.expense e
            JOIN app.expense_version ev ON ev.id = e.current_version_id
            JOIN app.expense_version_share sh ON sh.expense_version_id = ev.id
            WHERE e.event_id = $1
              AND e.deleted_at IS NULL
              AND sh.user_id = $2
        "#;

        let results = diesel::sql_query(sql)
            .bind::<diesel::sql_types::Uuid, _>(event_id)
            .bind::<diesel::sql_types::Uuid, _>(user_id)
            .load::<ExpenseIdRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results.into_iter().map(|r| r.id).collect())
    }

    /// Find an expense paid by the given user in an event, if any.
    /// Returns the most recently created one (by created_at).
    pub fn find_paid_by_expense(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Uuid>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT e.id
            FROM app.expense e
            JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND e.deleted_at IS NULL
              AND ev.paid_by = $2
            ORDER BY e.created_at DESC
            LIMIT 1
        "#;

        let result = diesel::sql_query(sql)
            .bind::<diesel::sql_types::Uuid, _>(event_id)
            .bind::<diesel::sql_types::Uuid, _>(user_id)
            .get_result::<ExpenseIdRow>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result.map(|r| r.id))
    }

    /// Find all active (non-deleted) expenses in an event with paid_by and version info.
    /// Used for reimbursement netting to match expenses against reimbursements.
    pub fn find_all_active_for_netting(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<ActiveExpenseForNetting>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT e.id, ev.paid_by, e.current_version_id, e.created_at
            FROM app.expense e
            LEFT JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND e.deleted_at IS NULL
            ORDER BY e.created_at ASC
        "#;

        let results = diesel::sql_query(sql)
            .bind::<diesel::sql_types::Uuid, _>(event_id)
            .load::<ActiveExpenseForNetting>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }
}

/// Helper row for simple expense ID queries.
#[derive(Debug, Clone, QueryableByName)]
struct ExpenseIdRow {
    #[diesel(sql_type = diesel::sql_types::Uuid)]
    id: Uuid,
}

/// Lightweight row for reimbursement netting: expense ID, payer, version, creation time.
#[derive(Debug, Clone, QueryableByName)]
pub struct ActiveExpenseForNetting {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = Nullable<DUuid>)]
    pub paid_by: Option<Uuid>,
    #[diesel(sql_type = Nullable<DUuid>)]
    pub current_version_id: Option<Uuid>,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<chrono::Utc>,
}
