//! PaymentRepository — CRUD + custom queries for `app::payment`.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::payment;
use crate::schema_enums::PaymentStatus;
use crate::schema_models::Payment;

crate::impl_repository!(
    PaymentRepository for Payment,
    table: payment::table,
    pk_column: payment::id,
    pk_type: Uuid,
);

#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = payment)]
#[diesel(treat_none_as_null = false)]
pub struct PaymentStatusUpdate {
    pub status: Option<PaymentStatus>,
    pub amount_paid_cents: Option<i32>,
    pub updated_at: Option<DateTime<Utc>>,
}

impl PaymentRepository {
    pub fn find_by_event_and_creditor(
        &self,
        event_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<Vec<Payment>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment::table
            .filter(payment::event_id.eq(event_id))
            .filter(payment::creditor_id.eq(creditor_id))
            .order_by(payment::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn find_by_event_and_debtor(
        &self,
        event_id: Uuid,
        debtor_id: Uuid,
    ) -> Result<Vec<Payment>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment::table
            .filter(payment::event_id.eq(event_id))
            .filter(payment::debtor_id.eq(debtor_id))
            .order_by(payment::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn find_open_by_expense(&self, expense_id: Uuid) -> Result<Vec<Payment>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment::table
            .filter(payment::expense_id.eq(expense_id))
            .filter(
                payment::status
                    .eq(PaymentStatus::Open)
                    .or(payment::status.eq(PaymentStatus::Ongoing)),
            )
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }

    pub fn update_status(
        &self,
        payment_id: Uuid,
        changes: &PaymentStatusUpdate,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let affected = diesel::update(payment::table.filter(payment::id.eq(payment_id)))
            .set(changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(affected)
    }

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
                query = query.filter(payment::created_at.lt(ts.with_timezone(&chrono::Utc)));
            }
        }

        query = query
            .order_by(payment::created_at.desc())
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

    pub fn find_by_event_and_users(
        &self,
        event_id: Uuid,
        creditor_id: Uuid,
        debtor_id: Uuid,
    ) -> Result<Vec<Payment>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;

        let results = payment::table
            .filter(payment::event_id.eq(event_id))
            .filter(payment::creditor_id.eq(creditor_id))
            .filter(payment::debtor_id.eq(debtor_id))
            .order_by(payment::created_at.desc())
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(results)
    }
}
