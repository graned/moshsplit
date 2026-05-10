//! EventRepository — CRUD + filtered paginated listing for the `app::event` table.

use diesel::dsl::sql;
use diesel::prelude::*;
use diesel::sql_types::BigInt;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::event;
use crate::schema_enums::EventStatus;
use crate::schema_models::Event;

crate::impl_repository!(
    EventRepository for Event,
    table: event::table,
    pk_column: event::id,
    pk_type: Uuid,
);

/// A row from the event table plus the count of active members.
#[derive(Debug, Clone, Queryable)]
pub struct EventWithMemberCount {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub currency: String,
    pub status: EventStatus,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub member_count: i64,
}

/// Changeset for partial event updates (PATCH).
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = event)]
#[diesel(treat_none_as_null = false)]
pub struct EventUpdateChangeset {
    pub name: Option<String>,
    pub description: Option<String>,
    pub currency: Option<String>,
    pub status: Option<EventStatus>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl EventRepository {
    /// List events with optional status filter, cursor-based pagination.
    /// `cursor` is an ISO 8601 timestamp (created_at); returns up to `limit` rows.
    /// Returns `(rows, has_more)`.
    pub fn list_by_status_paginated(
        &self,
        status_filter: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<EventWithMemberCount>, bool), RepositoryError> {
        use crate::schema::app::event_member;

        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        // We use raw SQL for the count expression to avoid the mixed-aggregate
        // error that Diesel's type system raises when mixing count() with
        // non-aggregate columns even with GROUP BY.
        let count_expr = sql::<BigInt>("COUNT(event_member.id)");

        let mut query = event::table
            .left_join(event_member::table)
            .select((
                event::id,
                event::name,
                event::description,
                event::currency,
                event::status,
                event::created_by,
                event::created_at,
                event::updated_at,
                count_expr,
            ))
            .group_by((
                event::id,
                event::name,
                event::description,
                event::currency,
                event::status,
                event::created_by,
                event::created_at,
                event::updated_at,
            ))
            .into_boxed();

        if let Some(s) = status_filter {
            if let Ok(st) = s.parse::<EventStatus>() {
                query = query.filter(event::status.eq(st));
            }
        }

        if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                query = query.filter(event::created_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(event::created_at.desc())
            .limit(fetch_limit);

        let results: Vec<EventWithMemberCount> = query
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

    /// Fetch a single event with its active member count.
    pub fn find_by_id_with_member_count(
        &self,
        event_id: Uuid,
    ) -> Result<Option<EventWithMemberCount>, RepositoryError> {
        use crate::schema::app::event_member;

        let mut conn = self.db_client.get_conn()?;
        let count_expr = sql::<BigInt>("COUNT(event_member.id)");

        let result = event::table
            .left_join(event_member::table)
            .select((
                event::id,
                event::name,
                event::description,
                event::currency,
                event::status,
                event::created_by,
                event::created_at,
                event::updated_at,
                count_expr,
            ))
            .filter(event::id.eq(event_id))
            .group_by((
                event::id,
                event::name,
                event::description,
                event::currency,
                event::status,
                event::created_by,
                event::created_at,
                event::updated_at,
            ))
            .first::<EventWithMemberCount>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result)
    }

    /// Partial update — only provided fields are changed.
    /// Returns the number of affected rows.
    pub fn patch(
        &self,
        event_id: Uuid,
        changes: &EventUpdateChangeset,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(event::table.filter(event::id.eq(event_id)))
            .set(changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }
}
