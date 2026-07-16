//! StatsRepository — aggregation queries for event statistics.
//!
//! Uses raw SQL for efficient single-query aggregation.

use diesel::deserialize::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Nullable, Uuid as DUuid};
use diesel::OptionalExtension;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::infrastructure::clients::DbClient;

/// Aggregated stats row for an event.
#[derive(Debug, Clone, QueryableByName)]
pub struct EventStatsRow {
    #[diesel(sql_type = BigInt)]
    pub total_spent_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub total_settled_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_share_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_paid_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_outstanding_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_incoming_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_incoming_settled_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub your_outgoing_settled_cents: i64,
    #[diesel(sql_type = Nullable<DUuid>)]
    pub top_spender_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub top_spender_amount_cents: Option<i64>,
}

#[derive(Clone, Debug)]
pub struct StatsRepository {
    db_client: DbClient,
}

impl StatsRepository {
    pub fn new(db_client: DbClient) -> Self {
        Self { db_client }
    }

    /// Compute event-level statistics in a single efficient query.
    ///
    /// Aggregates:
    /// - Total spent (sum of latest expense versions, non-deleted)
    /// - Total settled (sum of confirmed settlements)
    /// - User's share (sum of user's shares in latest expense versions)
    /// - Top spender (user who paid the most via expenses)
    pub fn get_event_stats(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<EventStatsRow, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            WITH latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.amount_cents, ev.paid_by
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            ),
            total_spent AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM latest_versions
            ),
            total_settled AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM app.settlement
                WHERE event_id = $1 AND status = 'confirmed'
            ),
            user_share AS (
                SELECT COALESCE(SUM(sh.share_cents), 0) AS amount
                FROM latest_versions lv
                JOIN app.expense_version_share sh ON sh.expense_version_id = lv.id
                WHERE sh.user_id = $2
            ),
            user_paid_directly AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM latest_versions
                WHERE paid_by = $2
            ),
            user_settled_out AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM app.settlement
                WHERE event_id = $1 AND from_user = $2 AND status = 'confirmed'
            ),
            user_outstanding AS (
                SELECT GREATEST(
                    us.amount - upd.amount - uso.amount,
                    0
                ) AS amount
                FROM user_share us
                CROSS JOIN user_paid_directly upd
                CROSS JOIN user_settled_out uso
            ),
            user_incoming_expected AS (
                SELECT COALESCE(SUM(sh.share_cents), 0) AS amount
                FROM latest_versions lv
                JOIN app.expense_version_share sh ON sh.expense_version_id = lv.id
                WHERE lv.paid_by = $2
                  AND sh.user_id != $2
            ),
            user_incoming_settled AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM app.settlement
                WHERE event_id = $1 AND to_user = $2 AND status = 'confirmed'
            ),
            user_outgoing_settled AS (
                SELECT COALESCE(SUM(amount_cents), 0) AS amount
                FROM app.settlement
                WHERE event_id = $1 AND from_user = $2 AND status = 'confirmed'
            ),
            top_spender AS (
                SELECT paid_by AS user_id, SUM(amount_cents) AS total_paid
                FROM latest_versions
                GROUP BY paid_by
                ORDER BY total_paid DESC
                LIMIT 1
            )
            SELECT
                ts.amount AS total_spent_cents,
                tset.amount AS total_settled_cents,
                us.amount AS your_share_cents,
                upd.amount AS your_paid_cents,
                uo.amount AS your_outstanding_cents,
                uie.amount AS your_incoming_cents,
                uis.amount AS your_incoming_settled_cents,
                uos.amount AS your_outgoing_settled_cents,
                tsp.user_id AS top_spender_id,
                tsp.total_paid AS top_spender_amount_cents
            FROM total_spent ts
            CROSS JOIN total_settled tset
            CROSS JOIN user_share us
            CROSS JOIN user_paid_directly upd
            CROSS JOIN user_outstanding uo
            CROSS JOIN user_incoming_expected uie
            CROSS JOIN user_incoming_settled uis
            CROSS JOIN user_outgoing_settled uos
            LEFT JOIN top_spender tsp ON 1=1
        "#;

        let result = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .get_result::<EventStatsRow>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        result.ok_or_else(|| RepositoryError::Database("Failed to compute event stats".into()))
    }
}
