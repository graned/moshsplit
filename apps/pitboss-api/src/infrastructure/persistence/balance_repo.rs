//! BalanceRepository — hand-written aggregation queries for computing
//! per-user balances within an event.
//!
//! We use raw SQL for the complex aggregation because Diesel's type-safe
//! query builder cannot express the `DISTINCT ON` / window-function
//! patterns needed to efficiently compute latest-expense-version data.

use diesel::deserialize::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Integer, Text, Uuid as DUuid};
use diesel::OptionalExtension;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::infrastructure::clients::DbClient;

/// Per-user balance row.
#[derive(Debug, Clone, QueryableByName)]
pub struct UserBalanceRow {
    #[diesel(sql_type = DUuid)]
    pub user_id: Uuid,
    #[diesel(sql_type = Integer)]
    pub paid_cents: i32,
    #[diesel(sql_type = Integer)]
    pub owes_cents: i32,
    #[diesel(sql_type = Integer)]
    pub balance_cents: i32,
}

/// An individual expense breakdown entry for the "explain" endpoint.
#[derive(Debug, Clone, QueryableByName)]
pub struct ExpenseBreakdownRow {
    #[diesel(sql_type = Text)]
    pub title: String,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Integer)]
    pub paid_cents: i32,
    #[diesel(sql_type = Integer)]
    pub share_cents: i32,
    #[diesel(sql_type = DUuid)]
    pub paid_by: Uuid,
}

/// A payment breakdown entry.
#[derive(Debug, Clone, QueryableByName)]
pub struct PaymentBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
}

/// A settlement breakdown entry.
#[derive(Debug, Clone, QueryableByName)]
pub struct SettlementBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Text)]
    pub status: String,
}

#[derive(Clone, Debug)]
pub struct BalanceRepository {
    db_client: DbClient,
}

impl BalanceRepository {
    pub fn new(db_client: DbClient) -> Self {
        Self { db_client }
    }

    pub fn db_client(&self) -> &DbClient {
        &self.db_client
    }

    /// Compute the net balance for every active member in an event.
    pub fn all_balances_for_event(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<UserBalanceRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            WITH active_members AS (
                SELECT user_id FROM app.event_member
                WHERE event_id = $1 AND left_at IS NULL
            ),
            latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.expense_id,
                    ev.amount_cents, ev.paid_by
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            )
            SELECT
                m.user_id,
                COALESCE(SUM(paid.amount_cents), 0)::INTEGER AS paid_cents,
                COALESCE(SUM(share.share_cents), 0)::INTEGER AS owes_cents,
                (COALESCE(SUM(paid.amount_cents), 0) - COALESCE(SUM(share.share_cents), 0)
                 - COALESCE(pmts_out.amount, 0) + COALESCE(pmts_in.amount, 0)
                 - COALESCE(stlmts_out.amount, 0) + COALESCE(stlmts_in.amount, 0)
                )::INTEGER AS balance_cents
            FROM active_members m
            LEFT JOIN latest_versions paid ON paid.paid_by = m.user_id
            LEFT JOIN app.expense_version_share share ON share.expense_version_id = paid.id AND share.user_id = m.user_id
            LEFT JOIN (
                SELECT from_user, SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1
                GROUP BY from_user
            ) pmts_out ON pmts_out.from_user = m.user_id
            LEFT JOIN (
                SELECT to_user, SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1
                GROUP BY to_user
            ) pmts_in ON pmts_in.to_user = m.user_id
            LEFT JOIN (
                SELECT from_user, SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND status = 'confirmed'
                GROUP BY from_user
            ) stlmts_out ON stlmts_out.from_user = m.user_id
            LEFT JOIN (
                SELECT to_user, SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND status = 'confirmed'
                GROUP BY to_user
            ) stlmts_in ON stlmts_in.to_user = m.user_id
            GROUP BY m.user_id, pmts_out.amount, pmts_in.amount, stlmts_out.amount, stlmts_in.amount
            ORDER BY m.user_id
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .load::<UserBalanceRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Compute balance for a single user in an event.
    pub fn user_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<UserBalanceRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            WITH latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.expense_id,
                    ev.amount_cents, ev.paid_by
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            )
            SELECT
                $2::uuid AS user_id,
                COALESCE(SUM(paid.amount_cents), 0)::INTEGER AS paid_cents,
                COALESCE(SUM(share.share_cents), 0)::INTEGER AS owes_cents,
                (COALESCE(SUM(paid.amount_cents), 0) - COALESCE(SUM(share.share_cents), 0)
                 - COALESCE(pmts_out.amount, 0) + COALESCE(pmts_in.amount, 0)
                 - COALESCE(stlmts_out.amount, 0) + COALESCE(stlmts_in.amount, 0)
                )::INTEGER AS balance_cents
            FROM (SELECT $2::uuid AS user_id) m
            LEFT JOIN latest_versions paid ON paid.paid_by = m.user_id
            LEFT JOIN app.expense_version_share share ON share.expense_version_id = paid.id AND share.user_id = m.user_id
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND from_user = $2
            ) pmts_out ON 1=1
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND to_user = $2
            ) pmts_in ON 1=1
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND from_user = $2 AND status = 'confirmed'
            ) stlmts_out ON 1=1
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND to_user = $2 AND status = 'confirmed'
            ) stlmts_in ON 1=1
            GROUP BY pmts_out.amount, pmts_in.amount, stlmts_out.amount, stlmts_in.amount
        "#;

        let result = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .get_result::<UserBalanceRow>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result)
    }

    /// Get expense breakdown for explaining a single user's balance.
    pub fn expense_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<ExpenseBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            WITH latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.expense_id,
                    ev.title, ev.amount_cents, ev.paid_by
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            )
            SELECT
                lv.title,
                lv.amount_cents,
                CASE WHEN lv.paid_by = $2 THEN lv.amount_cents ELSE 0 END AS paid_cents,
                COALESCE(sh.share_cents, 0) AS share_cents,
                lv.paid_by
            FROM latest_versions lv
            LEFT JOIN app.expense_version_share sh
                ON sh.expense_version_id = lv.id AND sh.user_id = $2
            ORDER BY lv.expense_id
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<ExpenseBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Get payment breakdown for a user.
    pub fn payment_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<PaymentBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT from_user, to_user, amount_cents
            FROM app.payment
            WHERE event_id = $1 AND (from_user = $2 OR to_user = $2)
            ORDER BY recorded_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<PaymentBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Get settlement breakdown for a user.
    pub fn settlement_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<SettlementBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT from_user, to_user, amount_cents, status
            FROM app.settlement
            WHERE event_id = $1 AND (from_user = $2 OR to_user = $2)
            ORDER BY created_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<SettlementBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }
}
