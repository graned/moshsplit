//! SettlementRepository — CRUD + paginated listing for `app::settlement`.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Integer, Timestamptz, Uuid as DUuid};
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::settlement;
use crate::schema_enums::SettlementStatus;
use crate::schema_models::Settlement;

crate::impl_repository!(
    SettlementRepository for Settlement,
    table: settlement::table,
    pk_column: settlement::id,
    pk_type: Uuid,
);

/// A confirmed settlement row for the history endpoint.
#[derive(Debug, Clone, diesel::QueryableByName)]
pub struct SettlementHistoryRow {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Timestamptz)]
    pub settled_at: DateTime<Utc>,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
    #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Text>)]
    pub note: Option<String>,
}

/// Changeset for updating settlement status.
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = settlement)]
#[diesel(treat_none_as_null = false)]
pub struct SettlementStatusUpdate {
    pub status: Option<SettlementStatus>,
    pub settled_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Changeset for approving a settlement (includes reviewer info).
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = settlement)]
#[diesel(treat_none_as_null = false)]
pub struct SettlementApproveUpdate {
    pub status: Option<SettlementStatus>,
    pub settled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Changeset for rejecting a settlement.
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = settlement)]
#[diesel(treat_none_as_null = false)]
pub struct SettlementRejectUpdate {
    pub status: Option<SettlementStatus>,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub rejection_note: Option<String>,
}

impl SettlementRepository {
    /// List settlements for an event with optional status filter + cursor.
    /// Returns `(rows, has_more)`.
    pub fn list_by_event_id_paginated(
        &self,
        event_id: Uuid,
        status_filter: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<Settlement>, bool), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let mut query = settlement::table
            .filter(settlement::event_id.eq(event_id))
            .into_boxed();

        if let Some(s) = status_filter {
            if let Ok(st) = s.parse::<SettlementStatus>() {
                query = query.filter(settlement::status.eq(st));
            }
        }

        if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                query = query.filter(settlement::created_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(settlement::created_at.desc())
            .limit(fetch_limit);

        let results: Vec<Settlement> = query.load(&mut conn).map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let rows = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        Ok((rows, has_more))
    }

    /// Update settlement status.
    pub fn update_status(
        &self,
        settlement_id: Uuid,
        changes: &SettlementStatusUpdate,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(settlement::table.filter(settlement::id.eq(settlement_id)))
            .set(changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Approve a settlement (sets status to confirmed, records reviewer).
    pub fn approve_settlement(
        &self,
        settlement_id: Uuid,
        reviewer_id: Uuid,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let now = chrono::Utc::now();
        let changes = SettlementApproveUpdate {
            status: Some(SettlementStatus::Confirmed),
            settled_at: Some(now),
            reviewed_by: Some(reviewer_id),
            reviewed_at: Some(now),
        };

        let affected = diesel::update(settlement::table.filter(settlement::id.eq(settlement_id)))
            .set(&changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Reject a settlement (sets status to rejected, records reviewer and optional note).
    pub fn reject_settlement(
        &self,
        settlement_id: Uuid,
        reviewer_id: Uuid,
        rejection_note: Option<String>,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let now = chrono::Utc::now();
        let changes = SettlementRejectUpdate {
            status: Some(SettlementStatus::Rejected),
            reviewed_by: Some(reviewer_id),
            reviewed_at: Some(now),
            rejection_note,
        };

        let affected = diesel::update(settlement::table.filter(settlement::id.eq(settlement_id)))
            .set(&changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// List confirmed settlements for a specific user (as either from_user or to_user).
    /// Used for the settle page history tab.
    pub fn list_confirmed_for_user_paginated(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<SettlementHistoryRow>, bool, Option<String>), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let (sql, params): (String, Vec<String>) = if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                let cursor_ts = ts.with_timezone(&chrono::Utc);
                (
                    format!(
                        "SELECT id, amount_cents, from_user, to_user, settled_at, created_at, note
                         FROM app.settlement
                         WHERE event_id = $1
                           AND (from_user = $2 OR to_user = $2)
                           AND status = 'confirmed'
                           AND settled_at < $3
                         ORDER BY settled_at DESC
                         LIMIT {}",
                        fetch_limit
                    ),
                    vec![event_id.to_string(), user_id.to_string(), cursor_ts.to_rfc3339()],
                )
            } else {
                (
                    format!(
                        "SELECT id, amount_cents, from_user, to_user, settled_at, created_at, note
                         FROM app.settlement
                         WHERE event_id = $1
                           AND (from_user = $2 OR to_user = $2)
                           AND status = 'confirmed'
                         ORDER BY settled_at DESC
                         LIMIT {}",
                        fetch_limit
                    ),
                    vec![event_id.to_string(), user_id.to_string()],
                )
            }
        } else {
            (
                format!(
                    "SELECT id, amount_cents, from_user, to_user, settled_at, created_at, note
                     FROM app.settlement
                     WHERE event_id = $1
                       AND (from_user = $2 OR to_user = $2)
                       AND status = 'confirmed'
                     ORDER BY settled_at DESC
                     LIMIT {}",
                    fetch_limit
                ),
                vec![event_id.to_string(), user_id.to_string()],
            )
        };

        let mut results: Vec<SettlementHistoryRow> = if params.len() == 3 {
            let cursor_ts = chrono::DateTime::parse_from_rfc3339(&params[2])
                .unwrap()
                .with_timezone(&chrono::Utc);
            sql_query(&sql)
                .bind::<DUuid, _>(event_id)
                .bind::<DUuid, _>(user_id)
                .bind::<Timestamptz, _>(cursor_ts)
                .load(&mut conn)
                .map_err(RepositoryError::from)?
        } else {
            sql_query(&sql)
                .bind::<DUuid, _>(event_id)
                .bind::<DUuid, _>(user_id)
                .load(&mut conn)
                .map_err(RepositoryError::from)?
        };

        let has_more = results.len() as i64 > limit;
        if has_more {
            results.truncate(limit as usize);
        }

        let next_cursor = results
            .last()
            .map(|r| r.settled_at.to_rfc3339());

        Ok((results, has_more, next_cursor))
    }

    /// List settlements for an event optionally filtered by user (as either from_user or to_user).
    /// Used for the settle page requests tab.
    pub fn list_by_event_user_paginated(
        &self,
        event_id: Uuid,
        user_id: Option<Uuid>,
        status_filter: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<Settlement>, bool), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let mut query = settlement::table
            .filter(settlement::event_id.eq(event_id))
            .into_boxed();

        if let Some(uid) = user_id {
            query = query.filter(settlement::from_user.eq(uid).or(settlement::to_user.eq(uid)));
        }

        if let Some(s) = status_filter {
            if let Ok(st) = s.parse::<SettlementStatus>() {
                query = query.filter(settlement::status.eq(st));
            }
        }

        if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                query = query.filter(settlement::created_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(settlement::created_at.desc())
            .limit(fetch_limit);

        let results: Vec<Settlement> = query.load(&mut conn).map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let rows = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        Ok((rows, has_more))
    }
}
