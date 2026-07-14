//! EventImageService — business logic for event image management.

use uuid::Uuid;

use crate::domain::repositories::event_image_repo::{
    EventImageRepository, EventImageUpdateChangeset,
};
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::event_image_dtos::{
    CreateEventImageRequest, EventImageResponse, EventImagesResponse, UpdateEventImageRequest,
};
use crate::schema_enums::EventImageType;
use crate::schema_models::EventImage;

pub struct EventImageService {
    repo: EventImageRepository,
}

impl EventImageService {
    pub fn new(repo: EventImageRepository) -> Self {
        Self { repo }
    }

    /// Create a new event image.
    pub fn create_image(
        &self,
        event_id: Uuid,
        req: CreateEventImageRequest,
    ) -> Result<EventImageResponse, ServiceError> {
        // Validate URL is not empty
        if req.url.trim().is_empty() {
            return Err(ServiceError::Validation("Image URL cannot be empty".into()));
        }

        // Parse and validate image type
        let image_type = req.image_type.parse::<EventImageType>().map_err(|_| {
            ServiceError::Validation(format!(
                "Invalid image type: {}. Must be 'banner' or 'gallery'",
                req.image_type
            ))
        })?;

        let id = Uuid::new_v4();
        let sort_order = req.sort_order.unwrap_or(0);

        let image = self.repo.create_image(
            id,
            event_id,
            &req.url,
            req.alt_text.as_deref(),
            image_type,
            sort_order,
        )?;

        Ok(event_image_to_response(&image))
    }

    /// Get all images for an event, grouped into banner + gallery.
    pub fn get_images_for_event(
        &self,
        event_id: Uuid,
    ) -> Result<EventImagesResponse, ServiceError> {
        let images = self.repo.find_by_event_id(event_id)?;
        Ok(group_images(&images))
    }

    /// Delete an image with ownership check (must belong to event).
    pub fn delete_image(&self, event_id: Uuid, image_id: Uuid) -> Result<(), ServiceError> {
        let affected = self.repo.delete_for_event(event_id, image_id)?;
        if affected == 0 {
            return Err(ServiceError::NotFound(format!(
                "Image {} not found for event {}",
                image_id, event_id
            )));
        }
        Ok(())
    }

    /// Update an image with ownership check.
    pub fn update_image(
        &self,
        event_id: Uuid,
        image_id: Uuid,
        req: UpdateEventImageRequest,
    ) -> Result<EventImageResponse, ServiceError> {
        // Verify image belongs to event
        let existing = self
            .repo
            .find_by_event_and_image_id(event_id, image_id)?
            .ok_or_else(|| {
                ServiceError::NotFound(format!(
                    "Image {} not found for event {}",
                    image_id, event_id
                ))
            })?;

        let changes = EventImageUpdateChangeset {
            alt_text: req.alt_text,
            sort_order: req.sort_order,
        };

        self.repo.patch(image_id, &changes)?;

        // Fetch updated image
        let updated = self
            .repo
            .find_by_event_and_image_id(event_id, image_id)?
            .ok_or_else(|| ServiceError::Internal("Image disappeared after update".into()))?;

        // Preserve original uploaded_at from existing record
        let mut response = event_image_to_response(&updated);
        response.uploaded_at = existing.uploaded_at;

        Ok(response)
    }
}

/// Convert a database EventImage to an API response.
fn event_image_to_response(image: &EventImage) -> EventImageResponse {
    EventImageResponse {
        id: image.id,
        url: image.url.clone(),
        alt_text: image.alt_text.clone(),
        image_type: image.image_type.to_string(),
        sort_order: image.sort_order,
        uploaded_at: image.uploaded_at,
    }
}

/// Group a list of EventImage into banner + gallery response.
fn group_images(images: &[EventImage]) -> EventImagesResponse {
    let mut response = EventImagesResponse::default();

    for img in images {
        match img.image_type {
            EventImageType::Banner => {
                // Only keep the first (lowest sort_order) banner
                if response.banner.is_none() {
                    response.banner = Some(event_image_to_response(img));
                }
            }
            EventImageType::Gallery => {
                response.gallery.push(event_image_to_response(img));
            }
        }
    }

    // Sort gallery by sort_order
    response.gallery.sort_by_key(|g| (g.sort_order, g.id));

    response
}
