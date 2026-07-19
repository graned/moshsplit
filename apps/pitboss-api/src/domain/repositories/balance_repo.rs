//! BalanceRepository — hand-written aggregation queries for computing
//! per-user balances within an event.

use chrono::{DateTime, Utc};
use diesel::deserialize::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::{Array, Integer, Nullable, Text, Timestamptz, Uuid as DUuid};
use diesel::OptionalExtension;
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::infrastructure::clients::DbClient;

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
}

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
}

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
                    AND (e.deletion_status IS NULL OR e.deletion_status != 'pending_deletion')
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
                SELECT debtor_id AS user_id, SUM(amount_paid_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND status != 'converted_to_credit' AND status != 'cancelled'
                GROUP BY debtor_id
            ),
            payments_in AS (
                SELECT creditor_id AS user_id, SUM(amount_paid_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND status != 'converted_to_credit' AND status != 'cancelled'
                GROUP BY creditor_id
            )
            SELECT
                m.user_id,
                COALESCE(ep.amount, 0)::INTEGER AS paid_cents,
                COALESCE(es.amount, 0)::INTEGER AS owes_cents,
                COALESCE(po.amount, 0)::INTEGER AS payments_out_cents,
                COALESCE(pi.amount, 0)::INTEGER AS payments_in_cents
            FROM active_members m
            LEFT JOIN expense_paid ep ON ep.user_id = m.user_id
            LEFT JOIN expense_shares es ON es.user_id = m.user_id
            LEFT JOIN payments_out po ON po.user_id = m.user_id
            LEFT JOIN payments_in pi ON pi.user_id = m.user_id
            ORDER BY m.user_id
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .load::<UserBalanceRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

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
                    AND (e.deletion_status IS NULL OR e.deletion_status != 'pending_deletion')
                ORDER BY ev.expense_id, ev.version_number DESC
            )
            SELECT
                $2::uuid AS user_id,
                COALESCE(paid.amount, 0)::INTEGER AS paid_cents,
                COALESCE(shares.amount, 0)::INTEGER AS owes_cents,
                COALESCE(pmts_out.amount, 0)::INTEGER AS payments_out_cents,
                COALESCE(pmts_in.amount, 0)::INTEGER AS payments_in_cents
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
                SELECT SUM(amount_paid_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND debtor_id = $2
                    AND status != 'converted_to_credit' AND status != 'cancelled'
            ) pmts_out ON 1=1
            LEFT JOIN (
                SELECT SUM(amount_paid_cents) AS amount
                FROM app.payment WHERE event_id = $1 AND creditor_id = $2
                    AND status != 'converted_to_credit' AND status != 'cancelled'
            ) pmts_in ON 1=1
        "#;

        let result = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .get_result::<UserBalanceRow>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result)
    }

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
                    AND (e.deletion_status IS NULL OR e.deletion_status != 'pending_deletion')
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
                    AND (e.deletion_status IS NULL OR e.deletion_status != 'pending_deletion')
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

    pub fn payment_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<PaymentBreakdownRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT p.id, p.debtor_id as from_user, p.creditor_id as to_user, 
                   p.amount_paid_cents as amount_cents, p.created_at as recorded_at, 
                   p.reason as description
            FROM app.payment p
            LEFT JOIN app.expense e ON e.id = p.expense_id
            WHERE p.event_id = $1 AND (p.debtor_id = $2 OR p.creditor_id = $2)
                AND p.status != 'converted_to_credit'
                AND p.status != 'cancelled'
                AND (e.deletion_status IS NULL OR e.deletion_status != 'pending_deletion')
            ORDER BY p.created_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<PaymentBreakdownRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn external_expense_breakdown(
        &self,
        user_id: Uuid,
    ) -> Result<(Uuid, String, Vec<ExternalExpenseBalanceRow>), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

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

        let event_id = results.first().map(|r| r.event_id).unwrap_or_default();
        let event_name = results
            .first()
            .map(|r| r.event_name.clone())
            .unwrap_or_default();

        Ok((event_id, event_name, results))
    }
}
