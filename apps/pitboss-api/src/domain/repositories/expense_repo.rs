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
    /// Returns `(rows, has_more)`.
    pub fn list_by_event_id_paginated(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
        include_deleted: bool,
        expense_type: Option<&str>,
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
            ORDER BY e.created_at DESC
            LIMIT $5
        "#;

        let cursor_ts: Option<DateTime<chrono::Utc>> = cursor
            .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
            .map(|ts| ts.with_timezone(&chrono::Utc));

        let results: Vec<ExpenseListItemRow> = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<diesel::sql_types::Bool, _>(include_deleted)
            .bind::<Nullable<Timestamptz>, _>(cursor_ts)
            .bind::<Nullable<Text>, _>(expense_type)
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
                ) AS participant_ids
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
}
