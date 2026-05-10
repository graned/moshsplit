//! EventService — orchestrates event CRUD and member management.

use chrono::Utc;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::event_dtos::{CreateEventRequest, EventListItem, EventResponse, UpdateEventRequest};
use crate::infrastructure::persistence::event_repo::{EventRepository, EventUpdateChangeset};
use crate::infrastructure::persistence::member_repo::EventMemberRepository;
use crate::schema_enums::{EventMemberRole, EventStatus};
use crate::schema_models::{Event, EventMember};

pub struct EventService {
    event_repo: EventRepository,
    member_repo: EventMemberRepository,
}

impl EventService {
    pub fn new(event_repo: EventRepository, member_repo: EventMemberRepository) -> Self {
        Self { event_repo, member_repo }
    }

    /// Create a new event and automatically add the creator as an admin member.
    pub fn create_event(&self, req: CreateEventRequest, created_by: Uuid) -> Result<EventResponse, ServiceError> {
        let now = Utc::now();
        let event_id = Uuid::new_v4();

        let event = Event {
            id: event_id,
            name: req.name,
            description: req.description,
            currency: req.currency.unwrap_or_else(|| "USD".to_string()),
            status: EventStatus::Active,
            created_by,
            created_at: now,
            updated_at: now,
        };

        self.event_repo.create(&event)?;

        // Add creator as admin member
        let member = EventMember {
            id: Uuid::new_v4(),
            event_id,
            user_id: created_by,
            role: EventMemberRole::Admin,
            joined_at: now,
            left_at: None,
        };
        self.member_repo.create(&member)?;

        Ok(EventResponse {
            id: event.id,
            name: event.name,
            description: event.description,
            currency: event.currency,
            status: event.status.to_string(),
            created_by: event.created_by,
            created_at: event.created_at,
            updated_at: event.updated_at,
            member_count: 1,
        })
    }

    /// List events, optionally filtered by status.
    pub fn list_events(
        &self,
        status: Option<&str>,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<(Vec<EventListItem>, bool, Option<String>), ServiceError> {
        let (rows, has_more) = self.event_repo.list_by_status_paginated(status, cursor, limit)?;

        let items: Vec<EventListItem> = rows
            .into_iter()
            .map(|r| EventListItem {
                id: r.id,
                name: r.name,
                currency: r.currency,
                status: r.status.to_string(),
                member_count: r.member_count,
                created_at: r.created_at,
            })
            .collect();

        let next_cursor = if has_more {
            items.last().map(|i| i.created_at.to_rfc3339())
        } else {
            None
        };

        Ok((items, has_more, next_cursor))
    }

    /// Get a single event by ID.
    pub fn get_event(&self, event_id: Uuid) -> Result<EventResponse, ServiceError> {
        let row = self
            .event_repo
            .find_by_id_with_member_count(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        Ok(EventResponse {
            id: row.id,
            name: row.name,
            description: row.description,
            currency: row.currency,
            status: row.status.to_string(),
            created_by: row.created_by,
            created_at: row.created_at,
            updated_at: row.updated_at,
            member_count: row.member_count,
        })
    }

    /// Partially update an event.
    pub fn patch_event(&self, event_id: Uuid, req: UpdateEventRequest) -> Result<EventResponse, ServiceError> {
        // Verify event exists
        let _existing = self
            .event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let now = Utc::now();

        let status = req.status
            .map(|s| s.parse::<EventStatus>().map_err(|_| ServiceError::Validation(format!("Invalid status: {}", s))))
            .transpose()?;

        let changes = EventUpdateChangeset {
            name: req.name,
            description: req.description,
            currency: req.currency,
            status,
            updated_at: Some(now),
        };

        self.event_repo.patch(event_id, &changes)?;

        // Fetch updated event
        self.get_event(event_id)
    }

    /// Soft-delete (archive) an event.
    pub fn delete_event(&self, event_id: Uuid) -> Result<(), ServiceError> {
        let existing = self
            .event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        if existing.status == EventStatus::Deleted {
            return Err(ServiceError::BusinessRule("Event is already deleted".into()));
        }

        let now = Utc::now();
        let changes = EventUpdateChangeset {
            name: None,
            description: None,
            currency: None,
            status: Some(EventStatus::Deleted),
            updated_at: Some(now),
        };
        self.event_repo.patch(event_id, &changes)?;
        Ok(())
    }
}
