//! PaymentService — records and lists payments (immutable once created).

use chrono::Utc;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::payment_dtos::{
    CreatePaymentRequest, PaymentListItem, PaymentResponse,
};
use crate::schema_models::Payment;

pub struct PaymentService {
    event_repo: EventRepository,
    payment_repo: PaymentRepository,
    member_repo: EventMemberRepository,
}

impl PaymentService {
    pub fn new(
        event_repo: EventRepository,
        payment_repo: PaymentRepository,
        member_repo: EventMemberRepository,
    ) -> Self {
        Self {
            event_repo,
            payment_repo,
            member_repo,
        }
    }

    /// Create a new payment (immutable).
    pub fn create_payment(
        &self,
        event_id: Uuid,
        req: CreatePaymentRequest,
        recorded_by: Uuid,
    ) -> Result<PaymentResponse, ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        // Verify both users are active members
        if !self.member_repo.is_active_member(event_id, req.from_user)? {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                req.from_user
            )));
        }
        if !self.member_repo.is_active_member(event_id, req.to_user)? {
            return Err(ServiceError::Validation(format!(
                "User {} is not an active member of this event",
                req.to_user
            )));
        }

        if req.amount_cents <= 0 {
            return Err(ServiceError::Validation("Amount must be positive".into()));
        }

        let now = Utc::now();
        let payment = Payment {
            id: Uuid::new_v4(),
            event_id,
            from_user: req.from_user,
            to_user: req.to_user,
            amount_cents: req.amount_cents,
            currency: req.currency.unwrap_or_else(|| "USD".to_string()),
            description: req.description,
            payment_method: req.payment_method,
            external_ref: req.external_ref,
            recorded_by,
            recorded_at: now,
        };

        self.payment_repo.create(&payment)?;

        Ok(PaymentResponse {
            id: payment.id,
            event_id: payment.event_id,
            from_user: payment.from_user,
            to_user: payment.to_user,
            amount_cents: payment.amount_cents,
            currency: payment.currency,
            description: payment.description,
            payment_method: payment.payment_method,
            external_ref: payment.external_ref,
            recorded_by: payment.recorded_by,
            recorded_at: payment.recorded_at,
        })
    }

    /// List payments for an event.
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

        let items: Vec<PaymentListItem> = rows
            .into_iter()
            .map(|p| PaymentListItem {
                id: p.id,
                from_user: p.from_user,
                to_user: p.to_user,
                amount_cents: p.amount_cents,
                currency: p.currency,
                recorded_at: p.recorded_at,
            })
            .collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.recorded_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    /// Get a single payment by ID.
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

        Ok(PaymentResponse {
            id: payment.id,
            event_id: payment.event_id,
            from_user: payment.from_user,
            to_user: payment.to_user,
            amount_cents: payment.amount_cents,
            currency: payment.currency,
            description: payment.description,
            payment_method: payment.payment_method,
            external_ref: payment.external_ref,
            recorded_by: payment.recorded_by,
            recorded_at: payment.recorded_at,
        })
    }
}
