//! ExpenseService — creates, updates, and lists expenses with versioning.

use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::expense_dtos::{
    CreateExpenseRequest, ExpenseListItem, ExpenseResponse, ExpenseVersionDetail,
    ExpenseVersionResponse, ExpenseVersionShareItem, UpdateExpenseRequest,
};
use crate::infrastructure::persistence::event_repo::EventRepository;
use crate::infrastructure::persistence::expense_repo::ExpenseRepository;
use crate::infrastructure::persistence::expense_version_repo::ExpenseVersionRepository;
use crate::infrastructure::persistence::expense_version_share_repo::ExpenseVersionShareRepository;
use crate::infrastructure::persistence::member_repo::EventMemberRepository;
use crate::schema_enums::SplitType;
use crate::schema_models::{Expense, ExpenseVersion, ExpenseVersionShare};

pub struct ExpenseService {
    event_repo: EventRepository,
    expense_repo: ExpenseRepository,
    version_repo: ExpenseVersionRepository,
    share_repo: ExpenseVersionShareRepository,
    member_repo: EventMemberRepository,
}

impl ExpenseService {
    pub fn new(
        event_repo: EventRepository,
        expense_repo: ExpenseRepository,
        version_repo: ExpenseVersionRepository,
        share_repo: ExpenseVersionShareRepository,
        member_repo: EventMemberRepository,
    ) -> Self {
        Self { event_repo, expense_repo, version_repo, share_repo, member_repo }
    }

    /// Parse a split_type string into a SplitType enum.
    fn parse_split_type(s: &str) -> Result<SplitType, ServiceError> {
        match s {
            "equal" => Ok(SplitType::Equal),
            "custom" => Ok(SplitType::Custom),
            "percentage" => Ok(SplitType::Percentage),
            "shares" => Ok(SplitType::Shares),
            _ => Err(ServiceError::Validation(format!("Unknown split_type: {}", s))),
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
                    .ok_or_else(|| ServiceError::Validation("custom split requires 'shares' object".into()))?;

                let total_custom: i32 = shares.values().filter_map(|v| v.as_i64()).map(|v| v as i32).sum();
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
                        ServiceError::Validation("percentage split requires 'percentages' object".into())
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
                    .ok_or_else(|| ServiceError::Validation("shares split requires 'shares' object".into()))?;

                let total_shares: f64 = shrs.values().filter_map(|v| v.as_f64()).sum();
                if total_shares <= 0.0 {
                    return Err(ServiceError::Validation("Total shares must be positive".into()));
                }

                let mut allocated: i32 = 0;
                let result: Vec<(Uuid, i32)> = member_ids
                    .iter()
                    .enumerate()
                    .map(|(i, uid)| {
                        let s = shrs.get(&uid.to_string()).and_then(|v| v.as_f64()).unwrap_or(0.0);
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

        // Get active members
        let members = self.member_repo.find_active_by_event_id(event_id)?;
        let member_ids: Vec<Uuid> = members.iter().map(|m| m.user_id).collect();

        let split_type = Self::parse_split_type(&req.split_type)?;

        // Compute shares
        let shares = Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

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
        self.share_repo.bulk_insert(&share_rows)?;

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
            return Err(ServiceError::NotFound("Expense not found in this event".into()));
        }
        if expense.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule("Cannot update a deleted expense".into()));
        }

        // Get active members
        let members = self.member_repo.find_active_by_event_id(event_id)?;
        let member_ids: Vec<Uuid> = members.iter().map(|m| m.user_id).collect();

        let split_type = Self::parse_split_type(&req.split_type)?;

        // Compute shares
        let shares = Self::compute_shares(req.amount_cents, &split_type, &req.split_data, &member_ids)?;

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
        self.share_repo.bulk_insert(&share_rows)?;

        // Update current_version_id on expense
        self.expense_repo.set_current_version(expense_id, version_id)?;

        Ok(self.get_expense(expense_id)?)
    }

    /// List expenses for an event.
    pub fn list_expenses(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
        include_deleted: bool,
    ) -> Result<(Vec<ExpenseListItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more) = self
            .expense_repo
            .list_by_event_id_paginated(event_id, cursor, limit, include_deleted)?;

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
                let _shares = self
                    .share_repo
                    .find_by_expense_version_id(v.id)
                    .unwrap_or_default();
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
    pub fn get_expense_with_versions(&self, expense_id: Uuid) -> Result<Vec<ExpenseVersionDetail>, ServiceError> {
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

    /// Soft-delete an expense.
    pub fn delete_expense(&self, event_id: Uuid, expense_id: Uuid) -> Result<(), ServiceError> {
        let expense = self
            .expense_repo
            .find_by_id(expense_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Expense {} not found", expense_id)))?;

        if expense.event_id != event_id {
            return Err(ServiceError::NotFound("Expense not found in this event".into()));
        }
        if expense.deleted_at.is_some() {
            return Err(ServiceError::BusinessRule("Expense is already deleted".into()));
        }

        self.expense_repo.soft_delete(expense_id, Utc::now())?;
        Ok(())
    }
}
