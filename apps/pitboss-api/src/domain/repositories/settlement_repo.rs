//! SettlementRepository — CRUD + paginated listing for `app::settlement`.

use diesel::prelude::*;
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

/// Changeset for updating settlement status.
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = settlement)]
#[diesel(treat_none_as_null = false)]
pub struct SettlementStatusUpdate {
    pub status: Option<SettlementStatus>,
    pub settled_at: Option<chrono::DateTime<chrono::Utc>>,
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
}
