//! PaymentTransactionRepository — CRUD + custom queries for `app::payment_transaction`.

use chrono::{DateTime, Utc};
use diesel::dsl::sum;
use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::payment_transaction;
use crate::schema_enums::PaymentTransactionStatus;
use crate::schema_models::PaymentTransaction;

crate::impl_repository!(
    PaymentTransactionRepository for PaymentTransaction,
    table: payment_transaction::table,
    pk_column: payment_transaction::id,
    pk_type: Uuid,
);

#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = payment_transaction)]
#[diesel(treat_none_as_null = false)]
pub struct TransactionConfirmUpdate {
    pub status: Option<PaymentTransactionStatus>,
    pub confirmed_by: Option<Uuid>,
    pub confirmed_at: Option<DateTime<Utc>>,
}

impl PaymentTransactionRepository {
    pub fn find_pending_by_payment(
        &self,
        payment_id: Uuid,
    ) -> Result<Vec<PaymentTransaction>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment_transaction::table
            .filter(payment_transaction::payment_id.eq(payment_id))
            .filter(payment_transaction::status.eq(PaymentTransactionStatus::Pending))
            .order_by(payment_transaction::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn find_confirmed_by_payment(
        &self,
        payment_id: Uuid,
    ) -> Result<Vec<PaymentTransaction>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment_transaction::table
            .filter(payment_transaction::payment_id.eq(payment_id))
            .filter(payment_transaction::status.eq(PaymentTransactionStatus::Confirmed))
            .order_by(payment_transaction::confirmed_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn confirm_transaction(
        &self,
        transaction_id: Uuid,
        confirmed_by: Uuid,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let now = Utc::now();

        let changes = TransactionConfirmUpdate {
            status: Some(PaymentTransactionStatus::Confirmed),
            confirmed_by: Some(confirmed_by),
            confirmed_at: Some(now),
        };

        let affected = diesel::update(
            payment_transaction::table.filter(payment_transaction::id.eq(transaction_id)),
        )
        .set(&changes)
        .execute(&mut conn)
        .map_err(RepositoryError::from)?;

        Ok(affected)
    }

    pub fn sum_confirmed_by_payment(&self, payment_id: Uuid) -> Result<i32, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let total: Option<i64> = payment_transaction::table
            .filter(payment_transaction::payment_id.eq(payment_id))
            .filter(payment_transaction::status.eq(PaymentTransactionStatus::Confirmed))
            .select(sum(payment_transaction::amount_cents))
            .first(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(total.unwrap_or(0) as i32)
    }

    pub fn find_by_payment(
        &self,
        payment_id: Uuid,
    ) -> Result<Vec<PaymentTransaction>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment_transaction::table
            .filter(payment_transaction::payment_id.eq(payment_id))
            .order_by(payment_transaction::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn reject_transaction(
        &self,
        transaction_id: Uuid,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let changes = TransactionConfirmUpdate {
            status: Some(PaymentTransactionStatus::Rejected),
            confirmed_by: None,
            confirmed_at: None,
        };

        let affected = diesel::update(
            payment_transaction::table.filter(payment_transaction::id.eq(transaction_id)),
        )
        .set(&changes)
        .execute(&mut conn)
        .map_err(RepositoryError::from)?;

        Ok(affected)
    }

    pub fn find_by_event(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<(PaymentTransaction, crate::schema_models::Payment)>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment_transaction::table
            .inner_join(crate::schema::app::payment::table)
            .filter(crate::schema::app::payment::event_id.eq(event_id))
            .order_by(payment_transaction::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }
}
