//! ReimbursementRepository — CRUD for `app.reimbursement`.
//!
//! Reimbursements are created when an expense is deleted to preserve balance
//! consistency. They track how much the expense owner owes to each person who
//! paid them via confirmed settlements.

use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Timestamptz, Uuid as DUuid};
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::infrastructure::clients::DbClient;
use crate::schema::app::reimbursement;
use crate::schema_models::Reimbursement;

/// Reimbursement row for queries.
#[derive(Debug, Clone, QueryableByName)]
pub struct ReimbursementRow {
    #[diesel(sql_type = DUuid)]
    pub id: Uuid,
    #[diesel(sql_type = DUuid)]
    pub ref_expense_id: Uuid,
    #[diesel(sql_type = Nullable<DUuid>)]
    pub settlement_id: Option<Uuid>,
    #[diesel(sql_type = DUuid)]
    pub event_id: Uuid,
    #[diesel(sql_type = DUuid)]
    pub from_user: Uuid,
    #[diesel(sql_type = DUuid)]
    pub to_user: Uuid,
    #[diesel(sql_type = Integer)]
    pub amount_cents: i32,
    #[diesel(sql_type = Timestamptz)]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone, Debug)]
pub struct ReimbursementRepository {
    db_client: DbClient,
}

impl ReimbursementRepository {
    pub fn new(db_client: DbClient) -> Self {
        Self { db_client }
    }

    pub fn db_client(&self) -> &DbClient {
        &self.db_client
    }

    /// Insert a new reimbursement record.
    pub fn create(&self, reimbursement: &Reimbursement) -> Result<(), RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        diesel::insert_into(reimbursement::table)
            .values(reimbursement)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(())
    }

    /// Find all reimbursements for an event.
    pub fn find_by_event_id(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<ReimbursementRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT id, ref_expense_id, settlement_id, event_id,
                   from_user, to_user, amount_cents, created_at
            FROM app.reimbursement
            WHERE event_id = $1 AND deleted_at IS NULL
            ORDER BY created_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .load::<ReimbursementRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Find all reimbursements involving a user (as either from_user or to_user).
    pub fn find_by_user(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<ReimbursementRow>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let sql = r#"
            SELECT id, ref_expense_id, settlement_id, event_id,
                   from_user, to_user, amount_cents, created_at
            FROM app.reimbursement
            WHERE event_id = $1
              AND deleted_at IS NULL
              AND (from_user = $2 OR to_user = $2)
            ORDER BY created_at
        "#;

        let results = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<DUuid, _>(user_id)
            .load::<ReimbursementRow>(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    /// Soft-delete all reimbursements linked to a specific expense.
    /// Sets deleted_at to now() for all reimbursements with the given ref_expense_id.
    pub fn soft_delete_for_expense(&self, expense_id: Uuid) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let now = chrono::Utc::now();

        let affected = diesel::update(
            reimbursement::table
                .filter(reimbursement::ref_expense_id.eq(expense_id))
                .filter(reimbursement::deleted_at.is_null()),
        )
        .set(reimbursement::deleted_at.eq(now))
        .execute(&mut conn)
        .map_err(RepositoryError::from)?;

        Ok(affected)
    }
}
