use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::credit;
use crate::schema_enums::CreditStatus;
use crate::schema_models::Credit;

crate::impl_repository!(
    CreditRepository for Credit,
    table: credit::table,
    pk_column: credit::id,
    pk_type: Uuid,
);

#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = credit)]
#[diesel(treat_none_as_null = false)]
pub struct CreditUpdate {
    pub amount_used_cents: Option<i32>,
    pub status: Option<CreditStatus>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl CreditRepository {
    pub fn get_available_credits(
        &self,
        debtor_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<Vec<Credit>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = credit::table
            .filter(credit::debtor_id.eq(debtor_id))
            .filter(credit::creditor_id.eq(creditor_id))
            .filter(credit::status.eq(CreditStatus::Active).or(credit::status.eq(CreditStatus::PartiallyUsed)))
            .order_by(credit::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn get_latest_version(
        &self,
        parent_credit_id: Uuid,
    ) -> Result<Option<Credit>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let result = credit::table
            .filter(credit::parent_credit_id.eq(parent_credit_id))
            .order_by(credit::version.desc())
            .first::<Credit>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;

        Ok(result)
    }

    pub fn get_by_event_and_users(
        &self,
        event_id: Uuid,
        debtor_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<Vec<Credit>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = credit::table
            .filter(credit::event_id.eq(event_id))
            .filter(credit::debtor_id.eq(debtor_id))
            .filter(credit::creditor_id.eq(creditor_id))
            .order_by(credit::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn update_credit(
        &self,
        credit_id: Uuid,
        changes: &CreditUpdate,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let affected = diesel::update(credit::table.filter(credit::id.eq(credit_id)))
            .set(changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(affected)
    }

    pub fn sum_available_credits(
        &self,
        debtor_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<i64, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let total: Option<i64> = credit::table
            .filter(credit::debtor_id.eq(debtor_id))
            .filter(credit::creditor_id.eq(creditor_id))
            .filter(credit::status.eq(CreditStatus::Active).or(credit::status.eq(CreditStatus::PartiallyUsed)))
            .select(diesel::dsl::sum(credit::amount_cents - credit::amount_used_cents))
            .first(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(total.unwrap_or(0))
    }
}
