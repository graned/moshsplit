//! BalanceRepository — hand-written aggregation queries for computing
//! per-user balances within an event.
//!
//! We use raw SQL for the complex aggregation because Diesel's type-safe
//! query builder cannot express the `DISTINCT ON` / window-function
//! patterns needed to efficiently compute latest-expense-version data.

use chrono::{DateTime, Utc};
use diesel::deserialize::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Array, Integer, Nullable, Text, Timestamptz, Uuid as DUuid};
use diesel::OptionalExtension;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::infrastructure::clients::DbClient;

/// Per-user raw balance components.
///
/// Balance computation is done in the service layer via
/// `moshsplit_balance_engine::compute_balance`.
#[derive(Debug, Clone, QueryableByName)]
pub struct UserBalanceRow {
    #[diesel(sql_type = DUuid)]
    pub user_id: Uuid,
    #[diesel(sql_type = Integer)]
    pub paid_cents: i32,
    #[diesel(sql_type = Integer)]
    pub owes_cents: i32,
    #[diesel(sql_type = Integer)]
    pub payments_out_cents: i32,
    #[diesel(sql_type = Integer)]
    pub payments_in_cents: i32,
    #[diesel(sql_type = Integer)]
    pub settlements_out_cents: i32,
    #[diesel(sql_type = Integer)]
    pub settlements_in_cents: i32,
    #[diesel(sql_type = Integer)]
    pub reimbursements_out_cents: i32,
    #[diesel(sql_type = Integer)]
    pub reimbursements_in_cents: i32,
}

/// An individual expense breakdown entry for the "explain" endpoint.
#[derive(Debug, Clone, QueryableByName)]
pub struct ExpenseBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub expense_id: Uuid,
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
    #[diesel(sql_type = Nullable<Text>)]
    pub expense_type: Option<String>,
    #[diesel(sql_type = Array<DUuid>)]
    pub participants: Vec<Uuid>,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
}

/// A payment breakdown entry.
#[derive(Debug, Clone, QueryableByName)]
pub struct PaymentBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Timestamptz)]
    pub recorded_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<Text>)]
    pub description: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub payment_method: Option<String>,
}

/// A settlement breakdown entry.
#[derive(Debug, Clone, QueryableByName)]
pub struct SettlementBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Text)]
    pub status: String,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    pub settled_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<Text>)]
    pub note: Option<String>,
}

/// A reimbursement breakdown entry.
#[derive(Debug, Clone, QueryableByName)]
pub struct ReimbursementBreakdownRow {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = DUuid)]
    pub ref_expense_id: Uuid,
    #[diesel(sql_type = Nullable<DUuid>)]
    pub settlement_id: Option<Uuid>,
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Text)]
    pub original_expense_title: String,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: DateTime<Utc>,
}

/// A per-expense balance row for the external-summary endpoint.
#[derive(Debug, Clone, QueryableByName)]
pub struct ExternalExpenseBalanceRow {
    #[diesel(sql_type = DUuid)]
    pub event_id: Uuid,
    #[diesel(sql_type = Text)]
    pub event_name: String,
    #[diesel(sql_type = Text)]
    pub title: String,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
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
            ),
            expense_paid AS (
                SELECT lv.paid_by AS user_id, SUM(lv.amount_cents) AS amount
                FROM latest_versions lv
                GROUP BY lv.paid_by
            ),
            expense_shares AS (
                SELECT sh.user_id, SUM(sh.share_cents) AS amount
                FROM latest_versions lv
                JOIN app.expense_version_share sh ON sh.expense_version_id = lv.id
                GROUP BY sh.user_id
            ),
            payments_out AS (
                SELECT from_user AS user_id, SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1
                GROUP BY from_user
            ),
            payments_in AS (
                SELECT to_user AS user_id, SUM(amount_cents) AS amount
                FROM app.payment WHERE event_id = $1
                GROUP BY to_user
            ),
            settlements_out AS (
                SELECT from_user AS user_id, SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND status = 'confirmed'
                GROUP BY from_user
            ),
            settlements_in AS (
                SELECT to_user AS user_id, SUM(amount_cents) AS amount
                FROM app.settlement WHERE event_id = $1 AND status = 'confirmed'
                GROUP BY to_user
            ),
            reimbursements_out AS (
                SELECT from_user AS user_id, SUM(amount_cents) AS amount
                FROM app.reimbursement WHERE event_id = $1 AND deleted_at IS NULL
                GROUP BY from_user
            ),
            reimbursements_in AS (
                SELECT to_user AS user_id, SUM(amount_cents) AS amount
                FROM app.reimbursement WHERE event_id = $1 AND deleted_at IS NULL
                GROUP BY to_user
            )
            SELECT
                m.user_id,
                COALESCE(ep.amount, 0)::INTEGER AS paid_cents,
                COALESCE(es.amount, 0)::INTEGER AS owes_cents,
                COALESCE(po.amount, 0)::INTEGER AS payments_out_cents,
                COALESCE(pi.amount, 0)::INTEGER AS payments_in_cents,
                COALESCE(so.amount, 0)::INTEGER AS settlements_out_cents,
                COALESCE(si.amount, 0)::INTEGER AS settlements_in_cents,
                COALESCE(ro.amount, 0)::INTEGER AS reimbursements_out_cents,
                COALESCE(ri.amount, 0)::INTEGER AS reimbursements_in_cents
            FROM active_members m
            LEFT JOIN expense_paid ep ON ep.user_id = m.user_id
            LEFT JOIN expense_shares es ON es.user_id = m.user_id
            LEFT JOIN payments_out po ON po.user_id = m.user_id
            LEFT JOIN payments_in pi ON pi.user_id = m.user_id
            LEFT JOIN settlements_out so ON so.user_id = m.user_id
            LEFT JOIN settlements_in si ON si.user_id = m.user_id
            LEFT JOIN reimbursements_out ro ON ro.user_id = m.user_id
            LEFT JOIN reimbursements_in ri ON ri.user_id = m.user_id
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
                COALESCE(paid.amount, 0)::INTEGER AS paid_cents,
                COALESCE(shares.amount, 0)::INTEGER AS owes_cents,
                COALESCE(pmts_out.amount, 0)::INTEGER AS payments_out_cents,
                COALESCE(pmts_in.amount, 0)::INTEGER AS payments_in_cents,
                COALESCE(stlmts_out.amount, 0)::INTEGER AS settlements_out_cents,
                COALESCE(stlmts_in.amount, 0)::INTEGER AS settlements_in_cents,
                COALESCE(reimb_out.amount, 0)::INTEGER AS reimbursements_out_cents,
                COALESCE(reimb_in.amount, 0)::INTEGER AS reimbursements_in_cents
            FROM (SELECT $2::uuid AS user_id) m
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM latest_versions WHERE paid_by = $2
            ) paid ON 1=1
            LEFT JOIN (
                SELECT SUM(sh.share_cents) AS amount
                FROM latest_versions lv
                JOIN app.expense_version_share sh ON sh.expense_version_id = lv.id
                WHERE sh.user_id = $2
            ) shares ON 1=1
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
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.reimbursement WHERE event_id = $1 AND from_user = $2 AND deleted_at IS NULL
            ) reimb_out ON 1=1
            LEFT JOIN (
                SELECT SUM(amount_cents) AS amount
                FROM app.reimbursement WHERE event_id = $1 AND to_user = $2 AND deleted_at IS NULL
            ) reimb_in ON 1=1
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
                    ev.title, ev.amount_cents, ev.paid_by, ev.expense_type, ev.created_at
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            ),
            participants AS (
                SELECT sh.expense_version_id,
                       array_agg(sh.user_id) AS user_ids
                FROM app.expense_version_share sh
                GROUP BY sh.expense_version_id
            )
            SELECT
                lv.expense_id,
                lv.title,
                lv.amount_cents,
                CASE WHEN lv.paid_by = $2 THEN lv.amount_cents ELSE 0 END AS paid_cents,
                COALESCE(sh.share_cents, 0) AS share_cents,
                lv.paid_by,
                lv.expense_type::TEXT,
                COALESCE(p.user_ids, ARRAY[]::uuid[]) AS participants,
                lv.created_at
            FROM latest_versions lv
            LEFT JOIN app.expense_version_share sh
                ON sh.expense_version_id = lv.id AND sh.user_id = $2
            LEFT JOIN participants p
                ON p.expense_version_id = lv.id
            ORDER BY lv.expense_id
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<ExpenseBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Get expense breakdown between a user and a counterparty.
    ///
    /// Returns only expenses where the counterparty is either the payer or a participant.
    /// The `user_id` parameter controls the LEFT JOIN on shares (to get the calling user's
    /// share_cents and paid_cents), while `counterparty_id` filters which expenses appear.
    pub fn expense_breakdown_between(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        counterparty_id: Uuid,
    ) -> Result<Vec<ExpenseBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            WITH latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.expense_id,
                    ev.title, ev.amount_cents, ev.paid_by, ev.expense_type, ev.created_at
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                WHERE e.event_id = $1 AND e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            ),
            participants AS (
                SELECT sh.expense_version_id,
                       array_agg(sh.user_id) AS user_ids
                FROM app.expense_version_share sh
                GROUP BY sh.expense_version_id
            )
            SELECT
                lv.expense_id,
                lv.title,
                lv.amount_cents,
                CASE WHEN lv.paid_by = $2 THEN lv.amount_cents ELSE 0 END AS paid_cents,
                COALESCE(sh.share_cents, 0) AS share_cents,
                lv.paid_by,
                lv.expense_type::TEXT,
                COALESCE(p.user_ids, ARRAY[]::uuid[]) AS participants,
                lv.created_at
            FROM latest_versions lv
            LEFT JOIN app.expense_version_share sh
                ON sh.expense_version_id = lv.id AND sh.user_id = $2
            LEFT JOIN participants p
                ON p.expense_version_id = lv.id
            WHERE (lv.paid_by = $3 OR $3 = ANY(COALESCE(p.user_ids, ARRAY[]::uuid[])))
            ORDER BY lv.expense_id
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .bind::<DUuid, _>(counterparty_id)
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
            SELECT id, from_user, to_user, amount_cents, recorded_at, description, payment_method
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

    /// Get per-expense balance summary for a user in their first active event.
    ///
    /// Returns the event name and a list of (title, amount_cents) for each expense
    /// where the user's net balance is non-zero.
    pub fn external_expense_breakdown(
        &self,
        user_id: Uuid,
    ) -> Result<(Uuid, String, Vec<ExternalExpenseBalanceRow>), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        // Find the user's first active event (by creation date) and compute per-expense balances
        let sql = r#"
            WITH user_event AS (
                SELECT e.id, e.name
                FROM app.event e
                JOIN app.event_member em ON em.event_id = e.id
                WHERE em.user_id = $1
                  AND em.left_at IS NULL
                  AND e.status = 'active'
                ORDER BY e.created_at ASC
                LIMIT 1
            ),
            latest_versions AS (
                SELECT DISTINCT ON (ev.expense_id) ev.id, ev.title,
                    ev.amount_cents, ev.paid_by
                FROM app.expense_version ev
                JOIN app.expense e ON e.id = ev.expense_id
                JOIN user_event ue ON ue.id = e.event_id
                WHERE e.deleted_at IS NULL
                ORDER BY ev.expense_id, ev.version_number DESC
            )
            SELECT
                ue.id AS event_id,
                ue.name AS event_name,
                lv.title,
                (CASE WHEN lv.paid_by = $1 THEN lv.amount_cents ELSE 0 END - COALESCE(sh.share_cents, 0))::INTEGER AS amount_cents
            FROM user_event ue
            JOIN latest_versions lv ON ue.id IS NOT NULL
            LEFT JOIN app.expense_version_share sh
                ON sh.expense_version_id = lv.id AND sh.user_id = $1
            WHERE (CASE WHEN lv.paid_by = $1 THEN lv.amount_cents ELSE 0 END - COALESCE(sh.share_cents, 0)) != 0
            ORDER BY lv.title
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(user_id)
            .load::<ExternalExpenseBalanceRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        // Extract the event ID and name from the first row (all rows share the same event)
        let event_id = results.first().map(|r| r.event_id).unwrap_or_default();
        let event_name = results
            .first()
            .map(|r| r.event_name.clone())
            .unwrap_or_default();

        Ok((event_id, event_name, results))
    }

    /// Get settlement breakdown for a user.
    pub fn settlement_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<SettlementBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT id, from_user, to_user, amount_cents, status, created_at, settled_at, note
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

    /// Get reimbursement breakdown for a user.
    pub fn reimbursement_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<ReimbursementBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT
                r.id,
                r.ref_expense_id,
                r.settlement_id,
                r.from_user,
                r.to_user,
                r.amount_cents,
                COALESCE(ev.title, 'Deleted Expense') AS original_expense_title,
                r.created_at
            FROM app.reimbursement r
            LEFT JOIN app.expense_version ev ON ev.expense_id = r.ref_expense_id
            WHERE r.event_id = $1
              AND (r.from_user = $2 OR r.to_user = $2)
              AND r.deleted_at IS NULL
            ORDER BY r.created_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<ReimbursementBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }
}
