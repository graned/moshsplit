//! MemberService — manages event membership.

use chrono::Utc;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::member_dtos::{AddMemberRequest, MemberListItem};
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::schema_enums::EventMemberRole;
use crate::schema_models::EventMember;

pub struct MemberService {
    event_repo: EventRepository,
    member_repo: EventMemberRepository,
}

impl MemberService {
    pub fn new(event_repo: EventRepository, member_repo: EventMemberRepository) -> Self {
        Self { event_repo, member_repo }
    }

    /// List active members of an event.
    pub fn list_members(&self, event_id: Uuid) -> Result<Vec<MemberListItem>, ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let members = self.member_repo.find_active_by_event_id(event_id)?;

        let items = members
            .into_iter()
            .map(|m| MemberListItem {
                id: m.id,
                event_id: m.event_id,
                user_id: m.user_id,
                role: m.role.to_string(),
                joined_at: m.joined_at,
            })
            .collect();

        Ok(items)
    }

    /// Add a new member to an event.
    pub fn add_member(
        &self,
        event_id: Uuid,
        req: AddMemberRequest,
        _added_by: Uuid,
    ) -> Result<MemberListItem, ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        // Check if already a member
        if self.member_repo.find_active_by_event_id_and_user_id(event_id, req.user_id)?.is_some() {
            return Err(ServiceError::BusinessRule(format!(
                "User {} is already a member of event {}",
                req.user_id, event_id
            )));
        }

        let now = Utc::now();
        let role = match req.role.as_deref() {
            Some("admin") => EventMemberRole::Admin,
            _ => EventMemberRole::Member,
        };

        let member = EventMember {
            id: Uuid::new_v4(),
            event_id,
            user_id: req.user_id,
            role,
            joined_at: now,
            left_at: None,
        };

        self.member_repo.create(&member)?;

        Ok(MemberListItem {
            id: member.id,
            event_id: member.event_id,
            user_id: member.user_id,
            role: member.role.to_string(),
            joined_at: member.joined_at,
        })
    }

    /// Auto-join a first-time user to the first active event.
    ///
    /// Checks if the user has any existing membership records. If none exist,
    /// finds the first active event (ordered by `created_at`) and adds the
    /// user as a regular member. This is idempotent — subsequent calls are no-ops.
    ///
    /// # Errors
    ///
    /// Returns `ServiceError::NotFound` if no active event exists in the system.
    /// Returns repository errors on database failures.
    pub fn auto_join_first_event(&self, user_id: Uuid) -> Result<bool, ServiceError> {
        // Check if user already has any membership (across all events)
        if self.member_repo.has_any_membership(user_id)? {
            return Ok(false);
        }

        // Find the first active event
        let event = self
            .event_repo
            .find_first_active()?
            .ok_or_else(|| ServiceError::NotFound("No active event found to join".into()))?;

        let now = Utc::now();
        let member = EventMember {
            id: Uuid::new_v4(),
            event_id: event.id,
            user_id,
            role: EventMemberRole::Member,
            joined_at: now,
            left_at: None,
        };

        self.member_repo.create(&member)?;

        Ok(true)
    }

    /// Remove a member from an event (soft-delete by setting left_at).
    pub fn remove_member(&self, event_id: Uuid, user_id: Uuid) -> Result<(), ServiceError> {
        // Verify event exists
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

        let affected = self.member_repo.soft_remove(event_id, user_id, Utc::now())?;

        if affected == 0 {
            return Err(ServiceError::NotFound(format!(
                "Active membership not found for user {} in event {}",
                user_id, event_id
            )));
        }

        Ok(())
    }
}
