//! ExpenseService — creates, updates, and lists expenses with versioning.

use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::repositories::credit_repo::CreditRepository;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::expense_repo::ExpenseRepository;
use crate::domain::repositories::expense_version_repo::ExpenseVersionRepository;
use crate::domain::repositories::expense_version_share_repo::ExpenseVersionShareRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::domain::repositories::payment_transaction_repo::PaymentTransactionRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::expense_dtos::{
    CreateExpenseRequest, DeletionRequiresChoiceResponse, ExpenseListItem, ExpenseResponse,
    ExpenseVersionDetail, ExpenseVersionResponse, ExpenseVersionShareItem, OpenPaymentInfo,
    UpdateExpenseRequest,
};
use crate::schema_enums::{CreditStatus, ExpenseType, SplitType};
use crate::schema_models::{Expense, ExpenseVersion, ExpenseVersionShare};
use moshsplit_balance_engine::redistribute_shares;

pub struct ExpenseService {
    event_repo: EventRepository,
    expense_repo: ExpenseRepository,
    version_repo: ExpenseVersionRepository,
    share_repo: ExpenseVersionShareRepository,
    payment_repo: PaymentRepository,
    payment_transaction_repo: PaymentTransactionRepository,
    credit_repo: CreditRepository,
}

impl ExpenseService {
    pub fn new(
        event_repo: EventRepository,
        expense_repo: ExpenseRepository,
        version_repo: ExpenseVersionRepository,
        share_repo: ExpenseVersionShareRepository,
        payment_repo: PaymentRepository,
        payment_transaction_repo: PaymentTransactionRepository,
        credit_repo: CreditRepository,
    ) -> Self {
        Self {
            event_repo,
            expense_repo,
            version_repo,
            share_repo,
            payment_repo,
            payment_transaction_repo,
            credit_repo,
        }
    }

    fn parse_split_type(s: &str) -> Result<SplitType, ServiceError> {
        match s {
            "equal" => Ok(SplitType::Equal),
            "custom" => Ok(SplitType::Custom),
            "percentage" => Ok(SplitType::Percentage),
            "shares" => Ok(SplitType::Shares),
            _ => Err(ServiceError::Validation(format!(
                "Unknown split_type: {}",
                s
            ))),
        }
    }

    fn parse_expense_type(s: &str) -> Result<ExpenseType, ServiceError> {
        match s {
            "food" => Ok(ExpenseType::Food),
            "beer" => Ok(ExpenseType::Beer),
            "gas" => Ok(ExpenseType::Gas),
            "transport" => Ok(ExpenseType::Transport),
            "merch" => Ok(ExpenseType::Merch),
            "camping" => Ok(ExpenseType::Camping),
            "other" => Ok(ExpenseType::Other),
            "reimburse" => Ok(ExpenseType::Reimburse),
            _ => Err(ServiceError::Validation(format!(
                "Unknown expense_type: {}",
                s
            ))),
        }
    }

    fn extract_member_ids(
        split_type: &SplitType,
        split_data: &Value,
    ) -> Result<Vec<Uuid>, ServiceError> {
        match split_type {
            SplitType::Equal => {
                let arr = split_data
                    .get("shares")
                    .and_then(|s| s.as_array())
                    .ok_or_else(|| {
                        ServiceError::Validation("equal split requires 'shares' array".into())
                    })?;
                arr.iter()
                    .map(|v| {
                        v.as_str()
                            .and_then(|s| Uuid::parse_str(s).ok())
                            .ok_or_else(|| {
                                ServiceError::Validation("Invalid UUID in shares array".into())
                            })
                    })
                    .collect()
            }
            SplitType::Custom | SplitType::Shares => {
                let obj = split_data
                    .get("shares")
                    .and_then(|s| s.as_object())
                    .ok_or_else(|| {
                        ServiceError::Validation(
                            "split requires 'shares' object with member UUID keys".into(),
                        )
                    })?;
                Ok(obj.keys().filter_map(|k| Uuid::parse_str(k).ok()).collect())
            }
            SplitType::Percentage => {
                let obj = split_data
                    .get("percentages")
                    .and_then(|s| s.as_object())
                    .ok_or_else(|| {
                        ServiceError::Validation(
                            "percentage split requires 'percentages' object".into(),
                        )
                    })?;
                Ok(obj.keys().filter_map(|k| Uuid::parse_str(k).ok()).collect())
            }
        }
    }

    fn compute_shares(
        amount_cents: i32,
        split_type: &SplitType,
        split_data: &Value,
        member_ids: &[Uuid],
    ) -> Result<Vec<(Uuid, i32)>, ServiceError> {
        let n = member_ids.len();
        if n == 0 {
            return Err(ServiceError::Validation("No members to split among".into()));
        }

        let result: Vec<(Uuid, i32)> = match split_type {
            SplitType::Equal => {
                if amount_cents < n as i32 {
                    return Err(ServiceError::Validation(format!(
                        "Amount ({}¢) is too small to split equally among {} people. Minimum {}¢ required.",
                        amount_cents, n, n
                    )));
                }
                let base = amount_cents / n as i32;
                let remainder = amount_cents % n as i32;
                member_ids
                    .iter()
                    .enumerate()
                    .map(|(i, uid)| {
                        let extra = if (i as i32) < remainder { 1 } else { 0 };
                        (*uid, base + extra)
                    })
                    .collect()
            }
            SplitType::Custom => {
                let shares = split_data
                    .get("shares")
                    .and_then(|s| s.as_object())
                    .ok_or_else(|| {
                        ServiceError::Validation("custom split requires 'shares' object".into())
                    })?;

                let total_custom: i32 = shares
                    .values()
                    .filter_map(|v| v.as_i64())
                    .map(|v| v as i32)
                    .sum();
                if total_custom != amount_cents {
                    return Err(ServiceError::Validation(format!(
                        "Custom shares sum {} does not match amount_cents {}",
                        total_custom, amount_cents
                    )));
                }

                member_ids
                    .iter()
                    .map(|uid| {
                        let amt = shares
                            .get(&uid.to_string())
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0) as i32;
                        (*uid, amt)
                    })
                    .collect()
            }
            SplitType::Percentage => {
                let pcts = split_data
                    .get("percentages")
                    .and_then(|s| s.as_object())
                    .ok_or_else(|| {
                        ServiceError::Validation(
                            "percentage split requires 'percentages' object".into(),
                        )
                    })?;

                let mut allocated: i32 = 0;
                let result: Vec<(Uuid, i32)> = member_ids
                    .iter()
                    .enumerate()
                    .map(|(i, uid)| {
                        let pct = pcts
                            .get(&uid.to_string())
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        let share = if i == n - 1 {
                            amount_cents - allocated
                        } else {
                            let amt = (amount_cents as f64 * pct / 100.0).round() as i32;
                            allocated += amt;
                            amt
                        };
                        (*uid, share)
                    })
                    .collect();

                result
            }
            SplitType::Shares => {
                let shrs = split_data
                    .get("shares")
                    .and_then(|s| s.as_object())
                    .ok_or_else(|| {
                        ServiceError::Validation("shares split requires 'shares' object".into())
                    })?;

                let total_shares: f64 = shrs.values().filter_map(|v| v.as_f64()).sum();
                if total_shares <= 0.0 {
                    return Err(ServiceError::Validation(
                        "Total shares must be positive".into(),
                    ));
                }

                let mut allocated: i32 = 0;
                let result: Vec<(Uuid, i32)> = member_ids
                    .iter()
                    .enumerate()
                    .map(|(i, uid)| {
                        let s = shrs
                            .get(&uid.to_string())
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        let share = if i == n - 1 {
                            amount_cents - allocated
                        } else {
                            let amt = (amount_cents as f64 * s / total_shares).round() as i32;
                            allocated += amt;
                            amt
                        };
                        (*uid, share)
                    })
                    .collect();

                result
            }
        };

        let sum: i32 = result.iter().map(|(_, s)| s).sum();
        if sum != amount_cents {
            return Err(ServiceError::BusinessRule(format!(
                "Computed shares sum {} does not match amount_cents {}",
                sum, amount_cents
            )));
        }

        Ok(result)
    }

    pub fn create_expense(
        &self,
        event_id: Uuid,
        req: CreateExpenseRequest,
        created_by: Uuid,
    ) -> Result<ExpenseResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let split_type = Self::parse_split_type(&req.split_type)?;
        let expense_type = req
            .expense_type
            .as_deref()
            .map(Self::parse_expense_type)
            .transpose()?;

        let member_ids = Self::extract_member_ids(&split_type, &req.split_data)?;

        let shares =
            Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

        let now = Utc::now();
        let expense_id = Uuid::new_v4();
        let version_id = Uuid::new_v4();

        let expense = Expense {
            id: expense_id,
            event_id,
            created_by,
            created_at: now,
            current_version_id: Some(version_id),
            deleted_at: None,
            deletion_status: Some("none".to_string()),
        };
        self.expense_repo.create(&expense)?;

        let version = ExpenseVersion {
            id: version_id,
            expense_id,
            version_number: 1,
            title: req.title,
            description: req.description,
            amount_cents: req.amount_cents,
            paid_by: req.paid_by,
            split_type,
            split_data: req.split_data,
            notes: req.notes,
            created_by,
            created_at: now,
            expense_type,
        };
        self.version_repo.create(&version)?;

        let share_rows: Vec<ExpenseVersionShare> = shares
            .into_iter()
            .map(|(user_id, share_cents)| ExpenseVersionShare {
                id: Uuid::new_v4(),
                expense_version_id: version_id,
                user_id,
                share_cents,
            })
            .collect();
        let affected = self.share_repo.bulk_insert(&share_rows)?;
        if affected != share_rows.len() {
            return Err(ServiceError::Internal(format!(
                "Failed to insert all shares: expected {}, got {}",
                share_rows.len(),
                affected
            )));
        }

        // Create payment records for each participant (except the payer)
        for share in &share_rows {
            if share.user_id != req.paid_by && share.share_cents > 0 {
                let payment = crate::schema_models::Payment {
                    id: Uuid::new_v4(),
                    event_id,
                    creditor_id: req.paid_by,
                    debtor_id: share.user_id,
                    expense_id: Some(expense_id),
                    amount_cents: share.share_cents,
                    amount_paid_cents: 0,
                    reason: "expense".to_string(),
                    status: crate::schema_enums::PaymentStatus::Open,
                    created_at: now,
                    updated_at: now,
                };
                self.payment_repo.create(&payment)?;
            }
        }

        Ok(self.get_expense(expense_id)?)
    }

    pub fn update_expense(
        &self,
        event_id: Uuid,
        expense_id: Uuid,
        req: UpdateExpenseRequest,
        created_by: Uuid,
    ) -> Result<ExpenseResponse, ServiceError> {
        let expense = self
            .expense_repo
            .find_by_id(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        if expense.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Expense not found in this event".into(),
            ));
        }
        if expense.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule(
                "Cannot update a deleted expense".into(),
            ));
        }
        if expense.deletion_status.as_deref() == Some("pending_deletion") {
            return Err(ServiceError::BusinessRule(
                "Cannot update an expense that is pending deletion".into(),
            ));
        }

        let split_type = Self::parse_split_type(&req.split_type)?;
        let expense_type = req
            .expense_type
            .as_deref()
            .map(Self::parse_expense_type)
            .transpose()?;

        let member_ids = Self::extract_member_ids(&split_type, &req.split_data)?;

        let shares =
            Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

        let now = Utc::now();
        let version_id = Uuid::new_v4();
        let next_version = self.version_repo.next_version_number(expense_id)?;

        let version = ExpenseVersion {
            id: version_id,
            expense_id,
            version_number: next_version,
            title: req.title,
            description: req.description,
            amount_cents: req.amount_cents,
            paid_by: req.paid_by,
            split_type,
            split_data: req.split_data,
            notes: req.notes,
            created_by,
            created_at: now,
            expense_type,
        };
        self.version_repo.create(&version)?;

        let share_rows: Vec<ExpenseVersionShare> = shares
            .into_iter()
            .map(|(user_id, share_cents)| ExpenseVersionShare {
                id: Uuid::new_v4(),
                expense_version_id: version_id,
                user_id,
                share_cents,
            })
            .collect();
        let affected = self.share_repo.bulk_insert(&share_rows)?;
        if affected != share_rows.len() {
            return Err(ServiceError::Internal(format!(
                "Failed to insert all shares: expected {}, got {}",
                share_rows.len(),
                affected
            )));
        }

        self.expense_repo
            .set_current_version(expense_id, version_id)?;

        Ok(self.get_expense(expense_id)?)
    }

    pub fn list_expenses(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
        include_deleted: bool,
        expense_type: Option<&str>,
        user_id: Option<Uuid>,
    ) -> Result<(Vec<ExpenseListItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more) = self.expense_repo.list_by_event_id_paginated(
            event_id,
            cursor,
            limit,
            include_deleted,
            expense_type,
            user_id,
        )?;

        let items: Vec<ExpenseListItem> = rows
            .into_iter()
            .map(|r| ExpenseListItem {
                id: r.id,
                event_id: r.event_id,
                created_by: r.created_by,
                created_at: r.created_at,
                current_version_id: r.current_version_id,
                deleted_at: r.deleted_at,
                deletion_status: r.deletion_status,
                version_number: r.version_number,
                title: r.title,
                amount_cents: r.amount_cents,
                paid_by: r.paid_by,
                split_type: r.split_type.map(|s| s.to_string()),
                expense_type: r.expense_type.map(|et| et.to_string()),
                participant_ids: r.participant_ids,
                notes: r.notes,
            })
            .collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    pub fn get_expense(&self, expense_id: Uuid) -> Result<ExpenseResponse, ServiceError> {
        let row = self
            .expense_repo
            .find_by_id_with_latest_version(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        let latest_version = if let Some(version_id) = row.current_version_id {
            let version = self.version_repo.find_by_id(version_id)?;
            version.map(|v| {
                let shares = self
                    .share_repo
                    .find_by_expense_version_id(v.id)
                    .unwrap_or_default();
                let share_items: Vec<ExpenseVersionShareItem> = shares
                    .into_iter()
                    .map(|s| ExpenseVersionShareItem {
                        user_id: s.user_id,
                        share_cents: s.share_cents,
                    })
                    .collect();
                ExpenseVersionResponse {
                    id: v.id,
                    expense_id: v.expense_id,
                    version_number: v.version_number,
                    title: v.title,
                    description: v.description,
                    amount_cents: v.amount_cents,
                    paid_by: v.paid_by,
                    split_type: v.split_type.to_string(),
                    split_data: v.split_data,
                    notes: v.notes,
                    created_by: v.created_by,
                    created_at: v.created_at,
                    shares: share_items,
                }
            })
        } else {
            None
        };

        Ok(ExpenseResponse {
            id: row.id,
            event_id: row.event_id,
            created_by: row.created_by,
            created_at: row.created_at,
            current_version: latest_version,
            deleted_at: row.deleted_at,
            deletion_status: row.deletion_status,
        })
    }

    pub fn get_expense_with_versions(
        &self,
        expense_id: Uuid,
    ) -> Result<Vec<ExpenseVersionDetail>, ServiceError> {
        self.expense_repo
            .find_by_id(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        let versions = self.version_repo.find_by_expense_id(expense_id)?;

        let details: Vec<ExpenseVersionDetail> = versions
            .into_iter()
            .map(|v| {
                let shares = self
                    .share_repo
                    .find_by_expense_version_id(v.id)
                    .unwrap_or_default();
                let share_items: Vec<ExpenseVersionShareItem> = shares
                    .into_iter()
                    .map(|s| ExpenseVersionShareItem {
                        user_id: s.user_id,
                        share_cents: s.share_cents,
                    })
                    .collect();
                ExpenseVersionDetail {
                    id: v.id,
                    expense_id: v.expense_id,
                    version_number: v.version_number,
                    title: v.title,
                    description: v.description,
                    amount_cents: v.amount_cents,
                    paid_by: v.paid_by,
                    split_type: v.split_type.to_string(),
                    split_data: v.split_data,
                    notes: v.notes,
                    created_by: v.created_by,
                    created_at: v.created_at,
                    shares: share_items,
                }
            })
            .collect();

        Ok(details)
    }

    pub fn delete_expense(
        &self,
        event_id: Uuid,
        expense_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<DeletionRequiresChoiceResponse>, ServiceError> {
        let expense_row = self
            .expense_repo
            .find_by_id_with_latest_version(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        if expense_row.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Expense not found in this event".into(),
            ));
        }
        if expense_row.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule(
                "Expense is already deleted".into(),
            ));
        }

        if expense_row.created_by != user_id {
            return Err(ServiceError::Forbidden(
                "Only the expense creator can delete this expense".into(),
            ));
        }

        let open_payments = self.payment_repo.find_open_by_expense(expense_id)?;
        let is_pending = expense_row.deletion_status.as_deref() == Some("pending_deletion");

        if is_pending && !open_payments.is_empty() {
            return Err(ServiceError::BusinessRule(
                "Expense is pending deletion but still has open payments. Complete or cancel payments first."
                    .into(),
            ));
        }

        if !is_pending && !open_payments.is_empty() {
            self.expense_repo
                .set_deletion_status(expense_id, Some("pending_deletion".to_string()))?;

            let open_payment_infos: Vec<OpenPaymentInfo> = open_payments
                .iter()
                .map(|p| OpenPaymentInfo {
                    payment_id: p.id,
                    creditor_id: p.creditor_id,
                    debtor_id: p.debtor_id,
                    amount_cents: p.amount_cents,
                    reason: p.reason.clone(),
                })
                .collect();

            let total_cents = open_payments.iter().map(|p| p.amount_cents).sum();

            return Ok(Some(DeletionRequiresChoiceResponse {
                expense_id,
                requires_choice: true,
                open_payments: open_payment_infos,
                total_cents,
            }));
        }

        let now = Utc::now();
        self.expense_repo.soft_delete(expense_id, now)?;

        Ok(None)
    }

    pub fn cancel_pending_deletion(
        &self,
        event_id: Uuid,
        expense_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), ServiceError> {
        let expense_row = self
            .expense_repo
            .find_by_id_with_latest_version(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        if expense_row.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Expense not found in this event".into(),
            ));
        }

        if expense_row.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule(
                "Expense is already deleted".into(),
            ));
        }

        if expense_row.created_by != user_id {
            return Err(ServiceError::Forbidden(
                "Only the expense creator can cancel pending deletion".into(),
            ));
        }

        if expense_row.deletion_status.as_deref() != Some("pending_deletion") {
            return Err(ServiceError::BusinessRule(
                "Expense is not pending deletion".into(),
            ));
        }

        self.expense_repo
            .set_deletion_status(expense_id, None)?;

        Ok(())
    }

    pub fn claim_reimbursement(
        &self,
        event_id: Uuid,
        expense_id: Uuid,
        user_id: Uuid,
        choice: &str,
    ) -> Result<(), ServiceError> {
        let expense_row = self
            .expense_repo
            .find_by_id_with_latest_version(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        if expense_row.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Expense not found in this event".into(),
            ));
        }

        if expense_row.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule(
                "Expense is already deleted".into(),
            ));
        }

        if expense_row.deletion_status.as_deref() != Some("pending_deletion") {
            return Err(ServiceError::BusinessRule(
                "Expense is not pending deletion".into(),
            ));
        }

        let open_payments = self.payment_repo.find_open_by_expense(expense_id)?;

        if open_payments.is_empty() {
            return Err(ServiceError::BusinessRule(
                "No open payments found for this expense".into(),
            ));
        }

        for payment in &open_payments {
            if payment.creditor_id != user_id {
                return Err(ServiceError::Forbidden(
                    "Only the creditor can claim reimbursement".into(),
                ));
            }
        }

        match choice {
            "credit" => {
                for payment in &open_payments {
                    let remaining = payment.amount_cents - payment.amount_paid_cents;
                    if remaining > 0 {
                        self.credit_repo.create(&crate::schema_models::Credit {
                            id: uuid::Uuid::new_v4(),
                            event_id,
                            creditor_id: payment.creditor_id,
                            debtor_id: payment.debtor_id,
                            amount_cents: remaining,
                            amount_used_cents: 0,
                            source_expense_id: Some(expense_id),
                            status: CreditStatus::Active,
                            version: 1,
                            parent_credit_id: None,
                            created_at: Utc::now(),
                            updated_at: Utc::now(),
                        })?;
                    }
                }
            }
            "payment" => {}
            _ => {
                return Err(ServiceError::Validation(
                    "Invalid choice. Must be 'credit' or 'payment'".into(),
                ));
            }
        }

        let now = Utc::now();

        let linked_payments = self.payment_repo.find_all_by_expense(expense_id)?;
        for linked_payment in &linked_payments {
            self.payment_transaction_repo
                .reject_pending_by_payment(linked_payment.id)?;
        }

        if choice == "credit" {
            self.payment_repo.cancel_all_by_expense(expense_id)?;
        }

        self.expense_repo
            .set_deletion_status(expense_id, Some("deleted".to_string()))?;

        if choice == "credit" {
            self.expense_repo.soft_delete(expense_id, now)?;
        }

        Ok(())
    }

    pub fn redistribute_expenses_for_member_removal(
        &self,
        event_id: Uuid,
        departing_user_id: Uuid,
        actor_id: Uuid,
    ) -> Result<usize, ServiceError> {
        let expense_ids = self
            .expense_repo
            .find_expense_ids_by_participant(event_id, departing_user_id)?;

        let now = Utc::now();
        let mut redistributed = 0usize;

        for expense_id in &expense_ids {
            let current = self.version_repo.find_by_expense_id(*expense_id)?;

            let latest_version = current.into_iter().max_by_key(|v| v.version_number);
            let version = match latest_version {
                Some(v) => v,
                None => continue,
            };

            let shares = self.share_repo.find_by_expense_version_id(version.id)?;

            let remaining: Vec<(Uuid, i32)> = shares
                .iter()
                .filter(|s| s.user_id != departing_user_id)
                .map(|s| (s.user_id, s.share_cents))
                .collect();

            if remaining.is_empty() {
                continue;
            }

            let new_shares = redistribute_shares(&remaining, version.amount_cents);

            let next_version = self.version_repo.next_version_number(*expense_id)?;
            let version_id = Uuid::new_v4();

            let new_version = ExpenseVersion {
                id: version_id,
                expense_id: *expense_id,
                version_number: next_version,
                title: version.title,
                description: version.description,
                amount_cents: version.amount_cents,
                paid_by: version.paid_by,
                split_type: version.split_type,
                split_data: version.split_data,
                notes: version.notes,
                created_by: actor_id,
                created_at: now,
                expense_type: version.expense_type,
            };
            self.version_repo.create(&new_version)?;

            let share_rows: Vec<ExpenseVersionShare> = new_shares
                .into_iter()
                .map(|(user_id, share_cents)| ExpenseVersionShare {
                    id: Uuid::new_v4(),
                    expense_version_id: version_id,
                    user_id,
                    share_cents,
                })
                .collect();
            let affected = self.share_repo.bulk_insert(&share_rows)?;
            if affected != share_rows.len() {
                return Err(ServiceError::Internal(format!(
                    "Failed to insert all shares during redistribution: expected {}, got {}",
                    share_rows.len(),
                    affected
                )));
            }

            self.expense_repo
                .set_current_version(*expense_id, version_id)?;
            redistributed += 1;
        }

        Ok(redistributed)
    }
}
