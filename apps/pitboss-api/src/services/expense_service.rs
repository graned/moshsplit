//! ExpenseService — creates, updates, and lists expenses with versioning.

use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::expense_repo::ExpenseRepository;
use crate::domain::repositories::expense_version_repo::ExpenseVersionRepository;
use crate::domain::repositories::expense_version_share_repo::ExpenseVersionShareRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::domain::repositories::settlement_repo::SettlementRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::expense_dtos::{
    CreateExpenseRequest, ExpenseListItem, ExpenseResponse, ExpenseVersionDetail,
    ExpenseVersionResponse, ExpenseVersionShareItem, UpdateExpenseRequest,
};
use crate::schema_enums::{ExpenseType, SplitType};
use crate::schema_models::{Expense, ExpenseVersion, ExpenseVersionShare};
use moshsplit_balance_engine::redistribute_shares;

pub struct ExpenseService {
    event_repo: EventRepository,
    expense_repo: ExpenseRepository,
    version_repo: ExpenseVersionRepository,
    share_repo: ExpenseVersionShareRepository,
    payment_repo: PaymentRepository,
    settlement_repo: SettlementRepository,
}

impl ExpenseService {
    pub fn new(
        event_repo: EventRepository,
        expense_repo: ExpenseRepository,
        version_repo: ExpenseVersionRepository,
        share_repo: ExpenseVersionShareRepository,
        payment_repo: PaymentRepository,
        settlement_repo: SettlementRepository,
    ) -> Self {
        Self {
            event_repo,
            expense_repo,
            version_repo,
            share_repo,
            payment_repo,
            settlement_repo,
        }
    }

    /// Parse a split_type string into a SplitType enum.
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

    /// Parse an expense_type string into an ExpenseType enum.
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

    /// Extract member IDs from split_data based on split_type.
    /// "equal"     → split_data.shares is an array of UUID strings.
    /// "custom"/"shares" → split_data.shares is an object keyed by UUID.
    /// "percentage" → split_data.percentages is an object keyed by UUID.
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

    /// Compute per-member shares based on split type and data.
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

        // Validate sum matches
        let sum: i32 = result.iter().map(|(_, s)| s).sum();
        if sum != amount_cents {
            return Err(ServiceError::BusinessRule(format!(
                "Computed shares sum {} does not match amount_cents {}",
                sum, amount_cents
            )));
        }

        Ok(result)
    }

    /// Create an expense with version 1 and computed shares.
    pub fn create_expense(
        &self,
        event_id: Uuid,
        req: CreateExpenseRequest,
        created_by: Uuid,
    ) -> Result<ExpenseResponse, ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let split_type = Self::parse_split_type(&req.split_type)?;
        let expense_type = req
            .expense_type
            .as_deref()
            .map(Self::parse_expense_type)
            .transpose()?;

        // Extract member IDs from split_data (subset of event members)
        let member_ids = Self::extract_member_ids(&split_type, &req.split_data)?;

        // F4: Allow payer not in split — paid_by can be any event member
        // The paid_by user does not need to be in the split member list.

        // Compute shares
        let shares =
            Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

        let now = Utc::now();
        let expense_id = Uuid::new_v4();
        let version_id = Uuid::new_v4();

        // Create expense
        let expense = Expense {
            id: expense_id,
            event_id,
            created_by,
            created_at: now,
            current_version_id: Some(version_id),
            deleted_at: None,
        };
        self.expense_repo.create(&expense)?;

        // Create version 1
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

        // Create shares
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

        Ok(self.get_expense(expense_id)?)
    }

    /// Update an expense by creating a new version.
    pub fn update_expense(
        &self,
        event_id: Uuid,
        expense_id: Uuid,
        req: UpdateExpenseRequest,
        created_by: Uuid,
    ) -> Result<ExpenseResponse, ServiceError> {
        // Verify expense exists and belongs to event
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

        let split_type = Self::parse_split_type(&req.split_type)?;
        let expense_type = req
            .expense_type
            .as_deref()
            .map(Self::parse_expense_type)
            .transpose()?;

        // Extract member IDs from split_data (subset of event members)
        let member_ids = Self::extract_member_ids(&split_type, &req.split_data)?;

        // F4: Allow payer not in split
        // Compute shares
        let shares =
            Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

        let now = Utc::now();
        let version_id = Uuid::new_v4();
        let next_version = self.version_repo.next_version_number(expense_id)?;

        // Create new version
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

        // Create shares for this version
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

        // Update current_version_id on expense
        self.expense_repo
            .set_current_version(expense_id, version_id)?;

        Ok(self.get_expense(expense_id)?)
    }

    /// List expenses for an event.
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

    /// Get a single expense with latest version.
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
        })
    }

    /// Get expense with full version details.
    pub fn get_expense_with_versions(
        &self,
        expense_id: Uuid,
    ) -> Result<Vec<ExpenseVersionDetail>, ServiceError> {
        // Validate expense exists
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
                "Only the expense creator can delete this expense".into(),
            ));
        }

        let expense_owner = expense_row.created_by;
        let original_title = expense_row
            .title
            .unwrap_or_else(|| "Deleted Expense".to_string());
        let now = Utc::now();

        let participant_ids = expense_row.participant_ids.unwrap_or_default();

        let reimbursement_amount = self
            .settlement_repo
            .sum_confirmed_settlements_for_expense_owner(expense_id, expense_owner)?;

        if reimbursement_amount > 0 {
            let mut shares: Vec<(Uuid, i32)> = Vec::new();
            shares.push((expense_owner, 0));

            for participant_id in &participant_ids {
                if *participant_id != expense_owner {
                    shares.push((*participant_id, reimbursement_amount as i32));
                }
            }

            let reimbursement_expense_id = Uuid::new_v4();
            let version_id = Uuid::new_v4();

            let expense = Expense {
                id: reimbursement_expense_id,
                event_id,
                created_by: expense_owner,
                created_at: now,
                current_version_id: Some(version_id),
                deleted_at: None,
            };
            self.expense_repo.create(&expense)?;

            let split_data = serde_json::json!({
                "shares": shares
                    .iter()
                    .map(|(uid, _)| uid.to_string())
                    .collect::<Vec<_>>()
            });

            let version = ExpenseVersion {
                id: version_id,
                expense_id: reimbursement_expense_id,
                version_number: 1,
                title: format!("Reimbursement for {}", original_title),
                description: Some("Original expense deleted by owner".to_string()),
                amount_cents: reimbursement_amount as i32,
                paid_by: expense_owner,
                split_type: SplitType::Equal,
                split_data,
                notes: None,
                created_by: expense_owner,
                created_at: now,
                expense_type: Some(ExpenseType::Reimburse),
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
                    "Failed to insert reimbursement shares: expected {}, got {}",
                    share_rows.len(),
                    affected
                )));
            }
        }

        self.settlement_repo.soft_delete_for_expense(expense_id)?;

        self.expense_repo.soft_delete(expense_id, now)?;
        Ok(())
    }

    /// When a member is removed from an event, redistribute their share
    /// of each expense they participate in among the remaining participants.
    ///
    /// For each expense where the departing user is a participant, a new
    /// version is created with the user removed from the split and the
    /// total amount redistributed equally among the rest.
    ///
    /// Returns the number of expenses that were redistributed.
    pub fn redistribute_expenses_for_member_removal(
        &self,
        event_id: Uuid,
        departing_user_id: Uuid,
        actor_id: Uuid,
    ) -> Result<usize, ServiceError> {
        // Find all expense IDs where the departing user is a participant
        let expense_ids = self
            .expense_repo
            .find_expense_ids_by_participant(event_id, departing_user_id)?;

        let now = Utc::now();
        let mut redistributed = 0usize;

        for expense_id in &expense_ids {
            // Get current version info
            let current = self.version_repo.find_by_expense_id(*expense_id)?;

            // Get the latest version (highest version_number)
            let latest_version = current.into_iter().max_by_key(|v| v.version_number);
            let version = match latest_version {
                Some(v) => v,
                None => continue,
            };

            // Get current shares
            let shares = self.share_repo.find_by_expense_version_id(version.id)?;

            // Filter out the departing user, keep remaining participants
            let remaining: Vec<(Uuid, i32)> = shares
                .iter()
                .filter(|s| s.user_id != departing_user_id)
                .map(|s| (s.user_id, s.share_cents))
                .collect();

            if remaining.is_empty() {
                // All participants are leaving — nothing to redistribute
                continue;
            }

            // Compute new shares using the balance-engine
            let new_shares = redistribute_shares(&remaining, version.amount_cents);

            // Create new version
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

            // Create new share rows
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

            // Update expense's current version
            self.expense_repo
                .set_current_version(*expense_id, version_id)?;
            redistributed += 1;
        }

        Ok(redistributed)
    }
}
