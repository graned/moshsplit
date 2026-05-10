//! EventMemberRepository — CRUD + queries for the `app::event_member` table.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::event_member;
use crate::schema_models::EventMember;

crate::impl_repository!(
    EventMemberRepository for EventMember,
    table: event_member::table,
    pk_column: event_member::id,
    pk_type: Uuid,
);

impl EventMemberRepository {
    /// List all active (non-left) members for an event.
    pub fn find_active_by_event_id(
        &self,
        event_id: Uuid,
    ) -> Result<Vec<EventMember>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let results = event_member::table
            .filter(event_member::event_id.eq(event_id))
            .filter(event_member::left_at.is_null())
            .order_by(event_member::joined_at.asc())
            .load::<EventMember>(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(results)
    }

    /// Find a specific active member by event_id and user_id.
    pub fn find_active_by_event_id_and_user_id(
        &self,
        event_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<EventMember>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let result = event_member::table
            .filter(event_member::event_id.eq(event_id))
            .filter(event_member::user_id.eq(user_id))
            .filter(event_member::left_at.is_null())
            .first::<EventMember>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;
        Ok(result)
    }

    /// Soft-delete (set left_at) for a member.
    pub fn soft_remove(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        left_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<usize, RepositoryError> {
        use diesel::ExpressionMethods;

        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(event_member::table)
            .filter(event_member::event_id.eq(event_id))
            .filter(event_member::user_id.eq(user_id))
            .filter(event_member::left_at.is_null())
            .set(event_member::left_at.eq(left_at))
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Count active members in an event.
    pub fn count_active_by_event_id(&self, event_id: Uuid) -> Result<i64, RepositoryError> {
        use diesel::dsl::count_star;

        let mut conn = self.db_client.get_conn()?;
        let count: i64 = event_member::table
            .filter(event_member::event_id.eq(event_id))
            .filter(event_member::left_at.is_null())
            .select(count_star())
            .first(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(count)
    }

    /// Check if a user is an active member of an event.
    pub fn is_active_member(&self, event_id: Uuid, user_id: Uuid) -> Result<bool, RepositoryError> {
        use diesel::dsl::exists;

        let mut conn = self.db_client.get_conn()?;
        let result = diesel::select(exists(
            event_member::table
                .filter(event_member::event_id.eq(event_id))
                .filter(event_member::user_id.eq(user_id))
                .filter(event_member::left_at.is_null()),
        ))
        .first::<bool>(&mut conn)
        .map_err(RepositoryError::from)?;
        Ok(result)
    }
}
