//! DTOs for EventImage endpoints.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

// ── Request DTOs ───────────────────────────────────────────────────────────────

/// Payload to create a new event image.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateEventImageRequest {
    /// Image URL (required).
    pub url: String,
    /// Optional alt text for accessibility.
    pub alt_text: Option<String>,
    /// Image type: "banner" or "gallery".
    pub image_type: String,
    /// Optional sort order (default 0).
    pub sort_order: Option<i32>,
}

/// Payload to partially update an event image.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct UpdateEventImageRequest {
    /// New alt text.
    pub alt_text: Option<String>,
    /// New sort order.
    pub sort_order: Option<i32>,
}

// ── Response DTOs ──────────────────────────────────────────────────────────────

/// Single event image representation.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventImageResponse {
    pub id: Uuid,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt_text: Option<String>,
    pub image_type: String,
    pub sort_order: i32,
    pub uploaded_at: DateTime<Utc>,
}

/// Grouped event images: one optional banner + gallery list.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EventImagesResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub banner: Option<EventImageResponse>,
    #[serde(default)]
    pub gallery: Vec<EventImageResponse>,
}

impl Default for EventImagesResponse {
    fn default() -> Self {
        Self {
            banner: None,
            gallery: Vec::new(),
        }
    }
}
