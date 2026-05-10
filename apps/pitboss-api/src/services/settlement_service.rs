//! SettlementService — proposes, confirms, and lists settlements.

use chrono::Utc;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::settlement_dtos::{
    CreateSettlementRequest, SettlementListItem, SettlementResponse, UpdateSettlementStatusRequest,
};
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::settlement_repo::{SettlementRepository, SettlementStatusUpdate};
use crate::schema_enums::SettlementStatus;
use std::str::FromStr;
use crate::schema_models::Settlement;

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
        Self { event_repo, settlement_repo, member_repo }
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
        };

        self.settlement_repo.create(&settlement)?;

        Ok(SettlementResponse {
            id: settlement.id,
            event_id: settlement.event_id,
            from_user: settlement.from_user,
            to_user: settlement.to_user,
            amount_cents: settlement.amount_cents,
            status: settlement.status.to_string(),
            settled_at: None,
            created_by: settlement.created_by,
            created_at: settlement.created_at,
        })
    }

    /// Update settlement status (confirm, dispute, etc.).
    pub fn update_settlement_status(
        &self,
        event_id: Uuid,
        settlement_id: Uuid,
        req: UpdateSettlementStatusRequest,
    ) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Settlement {} not found", settlement_id)))?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound("Settlement not found in this event".into()));
        }

        let now = Utc::now();
        let valid_statuses = ["pending", "confirmed", "disputed"];
        if !valid_statuses.contains(&req.status.as_str()) {
            return Err(ServiceError::Validation(format!(
                "Invalid status '{}'. Must be one of: pending, confirmed, disputed",
                req.status
            )));
        }

        let parsed_status = SettlementStatus::from_str(&req.status)
            .map_err(ServiceError::Validation)?;

        let settled_at = if parsed_status == SettlementStatus::Confirmed { Some(now) } else { None };

        let changes = SettlementStatusUpdate {
            status: Some(parsed_status),
            settled_at,
        };

        self.settlement_repo.update_status(settlement_id, &changes)?;

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

        let (rows, has_more) =
            self.settlement_repo.list_by_event_id_paginated(event_id, status_filter, cursor, limit)?;

        let items: Vec<SettlementListItem> = rows
            .into_iter()
            .map(|s| SettlementListItem {
                id: s.id,
                from_user: s.from_user,
                to_user: s.to_user,
                amount_cents: s.amount_cents,
                status: s.status.to_string(),
                created_at: s.created_at,
            })
            .collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    /// Get a single settlement by ID.
    pub fn get_settlement(&self, event_id: Uuid, settlement_id: Uuid) -> Result<SettlementResponse, ServiceError> {
        let settlement = self
            .settlement_repo
            .find_by_id(settlement_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Settlement {} not found", settlement_id)))?;

        if settlement.event_id != event_id {
            return Err(ServiceError::NotFound("Settlement not found in this event".into()));
        }

        Ok(SettlementResponse {
            id: settlement.id,
            event_id: settlement.event_id,
            from_user: settlement.from_user,
            to_user: settlement.to_user,
            amount_cents: settlement.amount_cents,
            status: settlement.status.to_string(),
            settled_at: settlement.settled_at,
            created_by: settlement.created_by,
            created_at: settlement.created_at,
        })
    }
}
