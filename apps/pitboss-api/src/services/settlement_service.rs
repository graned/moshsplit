//! SettlementService — proposes, confirms, and lists settlements.

use chrono::Utc;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::settlement_repo::{SettlementRepository, SettlementStatusUpdate};
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::settlement_dtos::{
    ApproveSettlementRequest, CreateSettlementRequest, RejectSettlementRequest,
    SettlementHistoryItem, SettlementListItem, SettlementResponse, UpdateSettlementStatusRequest,
};
use crate::schema_enums::SettlementStatus;
use crate::schema_models::Settlement;
use std::str::FromStr;

pub struct SettlementService {
    event_repo: EventRepository,
    settlement_repo: SettlementRepository,
    member_repo: EventMemberRepository,
}

impl SettlementService {
    pub fn new(
        event_repo: EventRepository,
        settlement_repo: SettlementRepository,
        member_repo: EventMemberRepository,
    ) -> Self {
        Self {
            event_repo,
            settlement_repo,
            member_repo,
        }
    }

    /// Propose a new settlement (status = pending).
    pub fn propose_settlement(
        &self,
        event_id: Uuid,
        req: CreateSettlementRequest,
        created_by: Uuid,
    ) -> Result<SettlementResponse, ServiceError> {
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
        let settlement = Settlement {
            id: Uuid::new_v4(),
            event_id,
            from_user: req.from_user,
            to_user: req.to_user,
            amount_cents: req.amount_cents,
            status: SettlementStatus::Pending,
            settled_at: None,
            created_by,
            created_at: now,
            note: req.note,
            proof_url: req.proof_url,
            reviewed_by: None,
            reviewed_at: None,
            rejection_note: None,
            expense_id: req.expense_id,
            deleted_at: None,
        };

        self.settlement_repo.create(&settlement)?;

        Ok(settlement_to_response(&settlement))
    }

    /// Approve a settlement request. Only the recipient (to_user) can approve.
    pub fn approve_settlement(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
        reviewer_id: Uuid,
        _req: ApproveSettlementRequest,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Settlement {} not found", settlement_id))
            })?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Settlement not found in this event".into(),
            ));
        }

        if settlement.status != SettlementStatus::Pending {
            return Err(ServiceError::Validation(format!(
                "Settlement is already {}",
                settlement.status.to_string()
            )));
        }

        // Only the recipient (to_user) can approve
        if settlement.to_user != reviewer_id {
            return Err(ServiceError::Forbidden(
                "Only the recipient can approve this settlement".into(),
            ));
        }

        self.settlement_repo
            .approve_settlement(settlement_id, reviewer_id)?;

        // Fetch updated settlement
        self.get_settlement(event_id, settlement_id)
    }

    /// Reject a settlement request. Only the recipient (to_user) can reject.
    pub fn reject_settlement(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
        reviewer_id: Uuid,
        req: RejectSettlementRequest,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Settlement {} not found", settlement_id))
            })?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Settlement not found in this event".into(),
            ));
        }

        if settlement.status != SettlementStatus::Pending {
            return Err(ServiceError::Validation(format!(
                "Settlement is already {}",
                settlement.status.to_string()
            )));
        }

        // Only the recipient (to_user) can reject
        if settlement.to_user != reviewer_id {
            return Err(ServiceError::Forbidden(
                "Only the recipient can reject this settlement".into(),
            ));
        }

        self.settlement_repo
            .reject_settlement(settlement_id, reviewer_id, req.rejection_note)?;

        // Fetch updated settlement
        self.get_settlement(event_id, settlement_id)
    }

    /// Withdraw a settlement request. Only the requester (created_by) can withdraw.
    pub fn withdraw_settlement(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
        user_id: Uuid,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Settlement {} not found", settlement_id))
            })?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Settlement not found in this event".into(),
            ));
        }

        if settlement.status != SettlementStatus::Pending {
            return Err(ServiceError::Validation(format!(
                "Settlement is already {}",
                settlement.status.to_string()
            )));
        }

        if settlement.created_by != user_id {
            return Err(ServiceError::Forbidden(
                "Only the requester can withdraw this settlement".into(),
            ));
        }

        let changes = SettlementStatusUpdate {
            status: Some(SettlementStatus::Disputed),
            settled_at: None,
        };

        self.settlement_repo
            .update_status(settlement_id, &changes)?;

        self.get_settlement(event_id, settlement_id)
    }

    /// Update settlement status (legacy).
    pub fn update_settlement_status(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
        req: UpdateSettlementStatusRequest,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Settlement {} not found", settlement_id))
            })?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Settlement not found in this event".into(),
            ));
        }

        let now = Utc::now();
        let valid_statuses = ["pending", "confirmed", "disputed", "rejected"];
        if !valid_statuses.contains(&req.status.as_str()) {
            return Err(ServiceError::Validation(format!(
                "Invalid status '{}'. Must be one of: pending, confirmed, disputed, rejected",
                req.status
            )));
        }

        let parsed_status =
            SettlementStatus::from_str(&req.status).map_err(ServiceError::Validation)?;

        let settled_at = if parsed_status == SettlementStatus::Confirmed {
            Some(now)
        } else {
            None
        };

        let changes = SettlementStatusUpdate {
            status: Some(parsed_status),
            settled_at,
        };

        self.settlement_repo
            .update_status(settlement_id, &changes)?;

        // Fetch updated settlement
        self.get_settlement(event_id, settlement_id)
    }

    /// List settlements for an event.
    pub fn list_settlements(
        &self,
        event_id: Uuid,
        status_filter: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<SettlementListItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more) = self.settlement_repo.list_by_event_id_paginated(
            event_id,
            status_filter,
            cursor,
            limit,
        )?;

        let items: Vec<SettlementListItem> =
            rows.into_iter().map(settlement_to_list_item).collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    /// List settlements involving a specific user (as either from_user or to_user).
    pub fn list_settlements_for_user(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        status_filter: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<SettlementListItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more) = self.settlement_repo.list_by_event_user_paginated(
            event_id,
            Some(user_id),
            status_filter,
            cursor,
            limit,
        )?;

        let items: Vec<SettlementListItem> =
            rows.into_iter().map(settlement_to_list_item).collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    /// List confirmed settlement history for a user (paginated).
    pub fn list_history_for_user(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<SettlementHistoryItem>, bool, Option<String>), ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let (rows, has_more, next_cursor) = self
            .settlement_repo
            .list_confirmed_for_user_paginated(event_id, user_id, cursor, limit)?;

        let items: Vec<SettlementHistoryItem> = rows
            .into_iter()
            .map(|r| {
                let is_outgoing = r.from_user == user_id;
                let counterparty_id = if is_outgoing { r.to_user } else { r.from_user };
                let amount_cents = if is_outgoing {
                    -r.amount_cents
                } else {
                    r.amount_cents
                };
                SettlementHistoryItem {
                    id: r.id,
                    amount_cents,
                    counterparty_id,
                    created_at: r.settled_at,
                    note: r.note,
                    is_outgoing,
                }
            })
            .collect();

        Ok((items, has_more, next_cursor))
    }

    /// Get a single settlement by ID.
    pub fn get_settlement(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!("Settlement {} not found", settlement_id))
            })?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound(
                "Settlement not found in this event".into(),
            ));
        }

        Ok(settlement_to_response(&settlement))
    }
}

fn settlement_to_response(s: &Settlement) -> SettlementResponse {
    SettlementResponse {
        id: s.id,
        event_id: s.event_id,
        from_user: s.from_user,
        to_user: s.to_user,
        amount_cents: s.amount_cents,
        status: s.status.to_string(),
        settled_at: s.settled_at,
        created_by: s.created_by,
        created_at: s.created_at,
        note: s.note.clone(),
        proof_url: s.proof_url.clone(),
        reviewed_by: s.reviewed_by,
        reviewed_at: s.reviewed_at,
        rejection_note: s.rejection_note.clone(),
        expense_id: s.expense_id,
    }
}

fn settlement_to_list_item(s: Settlement) -> SettlementListItem {
    SettlementListItem {
        id: s.id,
        from_user: s.from_user,
        to_user: s.to_user,
        amount_cents: s.amount_cents,
        status: s.status.to_string(),
        created_at: s.created_at,
        note: s.note,
        proof_url: s.proof_url,
        created_by: s.created_by,
        reviewed_by: s.reviewed_by,
        reviewed_at: s.reviewed_at,
        rejection_note: s.rejection_note,
        expense_id: s.expense_id,
    }
}
