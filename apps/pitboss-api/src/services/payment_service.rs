//! PaymentService — unified payment model.
//!
//! Payment represents debts/obligations that get paid down over time via
//! PaymentTransaction records.

use chrono::Utc;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::payment_repo::{PaymentRepository, PaymentStatusUpdate};
use crate::domain::repositories::payment_transaction_repo::PaymentTransactionRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::payment_dtos::{
    BalanceSummary, PaymentBreakdown, PaymentListItem, PaymentResponse, PaymentTransactionResponse,
    TransactionWithPaymentContext,
};
use crate::schema_enums::{PaymentStatus, PaymentTransactionStatus};
use crate::schema_models::{Payment, PaymentTransaction};

pub struct PaymentService {
    event_repo: EventRepository,
    payment_repo: PaymentRepository,
    payment_transaction_repo: PaymentTransactionRepository,
    member_repo: EventMemberRepository,
}

impl PaymentService {
    pub fn new(
        event_repo: EventRepository,
        payment_repo: PaymentRepository,
        payment_transaction_repo: PaymentTransactionRepository,
        member_repo: EventMemberRepository,
    ) -> Self {
        Self {
            event_repo,
            payment_repo,
            payment_transaction_repo,
            member_repo,
        }
    }

    pub fn create_payment(
        &self,
        event_id: Uuid,
        creditor_id: Uuid,
        debtor_id: Uuid,
        expense_id: Option<Uuid>,
        amount_cents: i32,
        reason: String,
    ) -> Result<Payment, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        if !self.member_repo.is_active_member(event_id, creditor_id)? {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                creditor_id
            )));
        }
        if !self.member_repo.is_active_member(event_id, debtor_id)? {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                debtor_id
            )));
        }

        if creditor_id == debtor_id {
            return Err(ServiceError::Validation(
                "Creditor and debtor cannot be the same user".into(),
            ));
        }

        if amount_cents <= 0 {
            return Err(ServiceError::Validation("Amount must be positive".into()));
        }

        if reason.is_empty() || reason.len() > 50 {
            return Err(ServiceError::Validation(
                "Reason must be between 1 and 50 characters".into(),
            ));
        }

        let now = Utc::now();
        let payment = Payment {
            id: Uuid::new_v4(),
            event_id,
            creditor_id,
            debtor_id,
            expense_id,
            amount_cents,
            amount_paid_cents: 0,
            reason,
            status: PaymentStatus::Open,
            created_at: now,
            updated_at: now,
        };

        self.payment_repo.create(&payment)?;

        Ok(payment)
    }

    pub fn propose_payment_transaction(
        &self,
        payment_id: Uuid,
        amount_cents: i32,
        proposed_by: Uuid,
    ) -> Result<PaymentTransaction, ServiceError> {
        let payment = self
            .payment_repo
            .find_by_id(payment_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Payment {} not found", payment_id)))?;

        if payment.status == PaymentStatus::Completed {
            return Err(ServiceError::BusinessRule(
                "Cannot propose transaction for completed payment".into(),
            ));
        }

        if amount_cents <= 0 {
            return Err(ServiceError::Validation("Amount must be positive".into()));
        }

        let remaining = payment.amount_cents - payment.amount_paid_cents;
        if amount_cents > remaining {
            return Err(ServiceError::Validation(format!(
                "Transaction amount {} exceeds remaining balance {}",
                amount_cents, remaining
            )));
        }

        if !self
            .member_repo
            .is_active_member(payment.event_id, proposed_by)?
        {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                proposed_by
            )));
        }

        let transaction = PaymentTransaction {
            id: Uuid::new_v4(),
            payment_id,
            amount_cents,
            status: PaymentTransactionStatus::Pending,
            proposed_by,
            confirmed_by: None,
            created_at: Utc::now(),
            confirmed_at: None,
            payment_method: "cash".to_string(),
            credit_id: None,
        };

        self.payment_transaction_repo.create(&transaction)?;

        if payment.status == PaymentStatus::Open {
            let changes = PaymentStatusUpdate {
                status: Some(PaymentStatus::Ongoing),
                amount_paid_cents: None,
                updated_at: Some(Utc::now()),
            };
            self.payment_repo.update_status(payment_id, &changes)?;
        }

        Ok(transaction)
    }

    pub fn confirm_payment_transaction(
        &self,
        transaction_id: Uuid,
        confirmed_by: Uuid,
    ) -> Result<PaymentTransaction, ServiceError> {
        let transaction = self
            .payment_transaction_repo
            .find_by_id(transaction_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Transaction {} not found", transaction_id))
            })?;

        if transaction.status == PaymentTransactionStatus::Confirmed {
            return Err(ServiceError::BusinessRule(
                "Transaction is already confirmed".into(),
            ));
        }

        let payment = self
            .payment_repo
            .find_by_id(transaction.payment_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Payment {} not found", transaction.payment_id))
            })?;

        if !self
            .member_repo
            .is_active_member(payment.event_id, confirmed_by)?
        {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                confirmed_by
            )));
        }

        if confirmed_by != payment.creditor_id {
            return Err(ServiceError::Forbidden(
                "Only the creditor can confirm a payment transaction".into(),
            ));
        }

        self.payment_transaction_repo
            .confirm_transaction(transaction_id, confirmed_by)?;

        let new_paid = payment.amount_paid_cents + transaction.amount_cents;
        let new_status = if new_paid >= payment.amount_cents {
            PaymentStatus::Completed
        } else {
            PaymentStatus::Ongoing
        };

        let changes = PaymentStatusUpdate {
            status: Some(new_status),
            amount_paid_cents: Some(new_paid),
            updated_at: Some(Utc::now()),
        };
        self.payment_repo
            .update_status(transaction.payment_id, &changes)?;

        let updated = self
            .payment_transaction_repo
            .find_by_id(transaction_id)?
            .ok_or_else(|| ServiceError::Internal("Failed to fetch updated transaction".into()))?;

        Ok(updated)
    }

    pub fn get_payment(
        &self,
        event_id: Uuid,
        payment_id: Uuid,
    ) -> Result<PaymentResponse, ServiceError> {
        let payment = self
            .payment_repo
            .find_by_id(payment_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Payment {} not found", payment_id)))?;

        if payment.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Payment not found in this event".into(),
            ));
        }

        Ok(payment_to_response(&payment))
    }

    pub fn list_payments(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<PaymentListItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more) = self
            .payment_repo
            .list_by_event_id_paginated(event_id, cursor, limit)?;

        let items: Vec<PaymentListItem> = rows.into_iter().map(payment_to_list_item).collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    pub fn get_incoming_payments(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<PaymentListItem>, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let payments = self
            .payment_repo
            .find_by_event_and_creditor(event_id, user_id)?;

        Ok(payments.into_iter().map(payment_to_list_item).collect())
    }

    pub fn get_outgoing_payments(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<PaymentListItem>, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let payments = self
            .payment_repo
            .find_by_event_and_debtor(event_id, user_id)?;

        Ok(payments.into_iter().map(payment_to_list_item).collect())
    }

    pub fn get_payment_breakdown(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<PaymentBreakdown, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let incoming = self
            .payment_repo
            .find_by_event_and_creditor(event_id, user_id)?;
        let outgoing = self
            .payment_repo
            .find_by_event_and_debtor(event_id, user_id)?;

        Ok(PaymentBreakdown {
            incoming: incoming.into_iter().map(payment_to_list_item).collect(),
            outgoing: outgoing.into_iter().map(payment_to_list_item).collect(),
        })
    }

    pub fn calculate_balance(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<BalanceSummary, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let incoming_payments = self
            .payment_repo
            .find_by_event_and_creditor(event_id, user_id)?;
        let outgoing_payments = self
            .payment_repo
            .find_by_event_and_debtor(event_id, user_id)?;

        let total_owed_cents: i32 = incoming_payments
            .iter()
            .map(|p| p.amount_cents - p.amount_paid_cents)
            .sum();

        let total_owing_cents: i32 = outgoing_payments
            .iter()
            .map(|p| p.amount_cents - p.amount_paid_cents)
            .sum();

        let net_balance_cents = total_owed_cents - total_owing_cents;

        Ok(BalanceSummary {
            user_id,
            total_owed_cents,
            total_owing_cents,
            net_balance_cents,
        })
    }

    pub fn list_payment_transactions(
        &self,
        payment_id: Uuid,
    ) -> Result<Vec<PaymentTransactionResponse>, ServiceError> {
        self.payment_repo
            .find_by_id(payment_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Payment {} not found", payment_id)))?;

        let transactions = self.payment_transaction_repo.find_by_payment(payment_id)?;

        Ok(transactions
            .into_iter()
            .map(transaction_to_response)
            .collect())
    }

    pub fn reject_payment_transaction(
        &self,
        transaction_id: Uuid,
        rejected_by: Uuid,
    ) -> Result<PaymentTransaction, ServiceError> {
        let transaction = self
            .payment_transaction_repo
            .find_by_id(transaction_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Transaction {} not found", transaction_id))
            })?;

        if transaction.status != PaymentTransactionStatus::Pending {
            return Err(ServiceError::BusinessRule(
                "Only pending transactions can be rejected".into(),
            ));
        }

        let payment = self
            .payment_repo
            .find_by_id(transaction.payment_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Payment {} not found", transaction.payment_id))
            })?;

        if rejected_by != payment.creditor_id {
            return Err(ServiceError::Forbidden(
                "Only the creditor can reject a payment transaction".into(),
            ));
        }

        self.payment_transaction_repo
            .reject_transaction(transaction_id)?;

        let updated = self
            .payment_transaction_repo
            .find_by_id(transaction_id)?
            .ok_or_else(|| ServiceError::Internal("Failed to fetch rejected transaction".into()))?;

        Ok(updated)
    }

    pub fn list_transactions_by_event(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<TransactionWithPaymentContext>, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let rows = self.payment_transaction_repo.find_by_event(event_id)?;

        Ok(rows
            .into_iter()
            .map(|(t, p)| TransactionWithPaymentContext {
                id: t.id,
                payment_id: t.payment_id,
                amount_cents: t.amount_cents,
                status: t.status.to_string(),
                proposed_by: t.proposed_by,
                confirmed_by: t.confirmed_by,
                created_at: t.created_at,
                confirmed_at: t.confirmed_at,
                creditor_id: p.creditor_id,
                debtor_id: p.debtor_id,
                payment_amount_cents: p.amount_cents,
                payment_reason: p.reason.clone(),
            })
            .collect())
    }
}

fn payment_to_response(p: &Payment) -> PaymentResponse {
    PaymentResponse {
        id: p.id,
        event_id: p.event_id,
        creditor_id: p.creditor_id,
        debtor_id: p.debtor_id,
        expense_id: p.expense_id,
        amount_cents: p.amount_cents,
        amount_paid_cents: p.amount_paid_cents,
        reason: p.reason.clone(),
        status: p.status.to_string(),
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn payment_to_list_item(p: Payment) -> PaymentListItem {
    PaymentListItem {
        id: p.id,
        creditor_id: p.creditor_id,
        debtor_id: p.debtor_id,
        amount_cents: p.amount_cents,
        amount_paid_cents: p.amount_paid_cents,
        reason: p.reason.clone(),
        status: p.status.to_string(),
        created_at: p.created_at,
    }
}

fn transaction_to_response(t: PaymentTransaction) -> PaymentTransactionResponse {
    PaymentTransactionResponse {
        id: t.id,
        payment_id: t.payment_id,
        amount_cents: t.amount_cents,
        status: t.status.to_string(),
        proposed_by: t.proposed_by,
        confirmed_by: t.confirmed_by,
        created_at: t.created_at,
        confirmed_at: t.confirmed_at,
    }
}
