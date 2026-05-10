//! ExpenseRepository — CRUD + paginated listing + soft-delete for `app::expense`.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::expense;
use crate::schema_enums::SplitType;
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
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub current_version_id: Option<Uuid>,
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    pub version_number: Option<i32>,
    pub title: Option<String>,
    pub amount_cents: Option<i32>,
    pub paid_by: Option<Uuid>,
    pub split_type: Option<SplitType>,
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
    ) -> Result<(Vec<ExpenseListItem>, bool), RepositoryError> {
        use crate::schema::app::expense_version;

        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let mut query = expense::table
            .left_join(expense_version::table.on(expense::current_version_id
                .eq(expense_version::id.nullable())))
            .select((
                expense::id,
                expense::event_id,
                expense::created_by,
                expense::created_at,
                expense::current_version_id,
                expense::deleted_at,
                expense_version::version_number.nullable(),
                expense_version::title.nullable(),
                expense_version::amount_cents.nullable(),
                expense_version::paid_by.nullable(),
                expense_version::split_type.nullable(),
            ))
            .filter(expense::event_id.eq(event_id))
            .into_boxed();

        if !include_deleted {
            query = query.filter(expense::deleted_at.is_null());
        }

        if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                query = query.filter(expense::created_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(expense::created_at.desc())
            .limit(fetch_limit);

        let results: Vec<ExpenseListItem> = query
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let rows = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        Ok((rows, has_more))
    }

    /// Find an expense with its latest version info.
    pub fn find_by_id_with_latest_version(
        &self,
        expense_id: Uuid,
    ) -> Result<Option<ExpenseListItem>, RepositoryError> {
        use crate::schema::app::expense_version;

        let mut conn = self.db_client.get_conn()?;

        let result = expense::table
            .left_join(expense_version::table.on(expense::current_version_id
                .eq(expense_version::id.nullable())))
            .select((
                expense::id,
                expense::event_id,
                expense::created_by,
                expense::created_at,
                expense::current_version_id,
                expense::deleted_at,
                expense_version::version_number.nullable(),
                expense_version::title.nullable(),
                expense_version::amount_cents.nullable(),
                expense_version::paid_by.nullable(),
                expense_version::split_type.nullable(),
            ))
            .filter(expense::id.eq(expense_id))
            .first::<ExpenseListItem>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result)
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
