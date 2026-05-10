//! PaymentRepository — CRUD + paginated listing for `app::payment`.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::payment;
use crate::schema_models::Payment;

crate::impl_repository!(
    PaymentRepository for Payment,
    table: payment::table,
    pk_column: payment::id,
    pk_type: Uuid,
);

impl PaymentRepository {
    /// List payments for an event with cursor-based pagination.
    /// Returns `(rows, has_more)`.
    pub fn list_by_event_id_paginated(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<Payment>, bool), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let fetch_limit = std::cmp::min(limit, 100) + 1;

        let mut query = payment::table
            .filter(payment::event_id.eq(event_id))
            .into_boxed();

        if let Some(c) = cursor {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(c) {
                query = query.filter(payment::recorded_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(payment::recorded_at.desc())
            .limit(fetch_limit);

        let results: Vec<Payment> = query.load(&mut conn).map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let rows = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        Ok((rows, has_more))
    }
}
