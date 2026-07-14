//! EventImageRepository — CRUD for the `app::event_image` table.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::event_image;
use crate::schema_enums::EventImageType;
use crate::schema_models::EventImage;

crate::impl_repository!(
    EventImageRepository for EventImage,
    table: event_image::table,
    pk_column: event_image::id,
    pk_type: Uuid,
);

/// Changeset for partial event image updates (PATCH).
#[derive(Debug, Clone, AsChangeset)]
#[diesel(table_name = event_image)]
#[diesel(treat_none_as_null = false)]
pub struct EventImageUpdateChangeset {
    pub alt_text: Option<String>,
    pub sort_order: Option<i32>,
}

impl EventImageRepository {
    /// Find all images for a given event, ordered by (image_type, sort_order).
    pub fn find_by_event_id(&self, event_id: Uuid) -> Result<Vec<EventImage>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let results = event_image::table
            .filter(event_image::event_id.eq(event_id))
            .order((event_image::image_type, event_image::sort_order))
            .load::<EventImage>(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(results)
    }

    /// Delete an image only if it belongs to the specified event.
    /// Returns the number of rows affected (0 if image doesn't belong to event).
    pub fn delete_for_event(
        &self,
        event_id: Uuid,
        image_id: Uuid,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::delete(
            event_image::table
                .filter(event_image::id.eq(image_id))
                .filter(event_image::event_id.eq(event_id)),
        )
        .execute(&mut conn)
        .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Partial update — only provided fields are changed.
    /// Returns the number of affected rows.
    pub fn patch(
        &self,
        image_id: Uuid,
        changes: &EventImageUpdateChangeset,
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::update(event_image::table.filter(event_image::id.eq(image_id)))
            .set(changes)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }

    /// Find a single image by ID that belongs to the specified event.
    pub fn find_by_event_and_image_id(
        &self,
        event_id: Uuid,
        image_id: Uuid,
    ) -> Result<Option<EventImage>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let result = event_image::table
            .filter(event_image::id.eq(image_id))
            .filter(event_image::event_id.eq(event_id))
            .first::<EventImage>(&mut conn)
            .optional()
            .map_err(RepositoryError::from)?;
        Ok(result)
    }

    /// Create a new event image with explicit field values.
    pub fn create_image(
        &self,
        id: Uuid,
        event_id: Uuid,
        url: &str,
        alt_text: Option<&str>,
        image_type: EventImageType,
        sort_order: i32,
    ) -> Result<EventImage, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let now = chrono::Utc::now();
        let image = EventImage {
            id,
            event_id,
            url: url.to_string(),
            alt_text: alt_text.map(String::from),
            image_type,
            sort_order,
            uploaded_at: now,
            created_at: now,
        };
        diesel::insert_into(event_image::table)
            .values(&image)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(image)
    }
}
