use chrono::Utc;
use uuid::Uuid;

use crate::domain::repositories::credit_repo::{CreditRepository, CreditUpdate};
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::credit_dtos::{CreditResponse, CreditSummary};
use crate::schema_enums::CreditStatus;
use crate::schema_models::Credit;

pub struct CreditService {
    event_repo: EventRepository,
    credit_repo: CreditRepository,
    member_repo: EventMemberRepository,
}

impl CreditService {
    pub fn new(
        event_repo: EventRepository,
        credit_repo: CreditRepository,
        member_repo: EventMemberRepository,
    ) -> Self {
        Self {
            event_repo,
            credit_repo,
            member_repo,
        }
    }

    pub fn create_credit(
        &self,
        event_id: Uuid,
        creditor_id: Uuid,
        debtor_id: Uuid,
        amount_cents: i32,
        source_expense_id: Option<Uuid>,
    ) -> Result<Credit, ServiceError> {
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

        let now = Utc::now();
        let credit = Credit {
            id: Uuid::new_v4(),
            event_id,
            creditor_id,
            debtor_id,
            amount_cents,
            amount_used_cents: 0,
            source_expense_id,
            status: CreditStatus::Active,
            version: 1,
            parent_credit_id: None,
            created_at: now,
            updated_at: now,
        };

        self.credit_repo.create(&credit)?;

        Ok(credit)
    }

    pub fn convert_credit_to_payment(
        &self,
        credit_id: Uuid,
        user_id: Uuid,
    ) -> Result<Credit, ServiceError> {
        let credit = self
            .credit_repo
            .find_by_id(credit_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Credit {} not found", credit_id)))?;

        if credit.creditor_id != user_id {
            return Err(ServiceError::Forbidden(
                "Only the creditor can convert credit to payment".into(),
            ));
        }

        if credit.status != CreditStatus::Active && credit.status != CreditStatus::PartiallyUsed {
            return Err(ServiceError::BusinessRule(
                "Credit cannot be converted in its current status".into(),
            ));
        }

        let available = credit.amount_cents - credit.amount_used_cents;
        if available <= 0 {
            return Err(ServiceError::BusinessRule(
                "Credit has no available amount to convert".into(),
            ));
        }

        let now = Utc::now();
        let changes = CreditUpdate {
            amount_used_cents: None,
            status: Some(CreditStatus::ConvertedToPayment),
            updated_at: Some(now),
        };
        self.credit_repo.update_credit(credit_id, &changes)?;

        let updated = self
            .credit_repo
            .find_by_id(credit_id)?
            .ok_or_else(|| ServiceError::Internal("Failed to fetch updated credit".into()))?;

        Ok(updated)
    }

    pub fn apply_credit_to_payment(
        &self,
        credit_id: Uuid,
        amount_cents: i32,
    ) -> Result<Credit, ServiceError> {
        let credit = self
            .credit_repo
            .find_by_id(credit_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Credit {} not found", credit_id)))?;

        if credit.status != CreditStatus::Active && credit.status != CreditStatus::PartiallyUsed {
            return Err(ServiceError::BusinessRule(
                "Credit cannot be applied in its current status".into(),
            ));
        }

        let available = credit.amount_cents - credit.amount_used_cents;
        if amount_cents > available {
            return Err(ServiceError::Validation(format!(
                "Requested amount {} exceeds available credit {}",
                amount_cents, available
            )));
        }

        let new_used = credit.amount_used_cents + amount_cents;
        let new_status = if new_used >= credit.amount_cents {
            CreditStatus::FullyUsed
        } else {
            CreditStatus::PartiallyUsed
        };

        let now = Utc::now();
        let changes = CreditUpdate {
            amount_used_cents: Some(new_used),
            status: Some(new_status),
            updated_at: Some(now),
        };
        self.credit_repo.update_credit(credit_id, &changes)?;

        let updated = self
            .credit_repo
            .find_by_id(credit_id)?
            .ok_or_else(|| ServiceError::Internal("Failed to fetch updated credit".into()))?;

        Ok(updated)
    }

    pub fn get_available_credits(
        &self,
        event_id: Uuid,
        debtor_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<Vec<CreditResponse>, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let credits = self.credit_repo.get_available_credits(debtor_id, creditor_id)?;

        Ok(credits.into_iter().map(credit_to_response).collect())
    }

    pub fn get_credit_summary(
        &self,
        event_id: Uuid,
        debtor_id: Uuid,
        creditor_id: Uuid,
    ) -> Result<CreditSummary, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let total_available = self
            .credit_repo
            .sum_available_credits(debtor_id, creditor_id)?;

        Ok(CreditSummary {
            debtor_id,
            creditor_id,
            total_available_cents: total_available,
        })
    }
}

fn credit_to_response(c: Credit) -> CreditResponse {
    CreditResponse {
        id: c.id,
        event_id: c.event_id,
        creditor_id: c.creditor_id,
        debtor_id: c.debtor_id,
        amount_cents: c.amount_cents,
        amount_used_cents: c.amount_used_cents,
        source_expense_id: c.source_expense_id,
        status: c.status.to_string(),
        version: c.version,
        parent_credit_id: c.parent_credit_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
    }
}
