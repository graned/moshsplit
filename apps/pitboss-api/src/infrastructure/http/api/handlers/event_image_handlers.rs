//! Handlers for EventImage endpoints.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::domain::repositories::event_image_repo::EventImageRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::event_image_dtos::{
    CreateEventImageRequest, EventImageResponse, EventImagesResponse, UpdateEventImageRequest,
};
use crate::infrastructure::http::AppState;
use crate::services::event_image_service::EventImageService;

/// POST /v1/events/{id}/images — create an event image.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/images",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = CreateEventImageRequest,
    responses(
        (status = 201, description = "Image created", body = EventImageResponse),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Event not found"),
    ),
    tag = "Event Images"
)]
pub async fn create_event_image(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Json(req): Json<CreateEventImageRequest>,
) -> Result<(StatusCode, Json<EventImageResponse>), ServiceError> {
    let svc = EventImageService::new(EventImageRepository::new(state.db_client.clone()));

    let image = svc.create_image(event_id, req)?;
    Ok((StatusCode::CREATED, Json(image)))
}

/// GET /v1/events/{id}/images — list all images for an event.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/images",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Event images grouped by type", body = EventImagesResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Event Images"
)]
pub async fn list_event_images(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<EventImagesResponse>, ServiceError> {
    let svc = EventImageService::new(EventImageRepository::new(state.db_client.clone()));

    let images = svc.get_images_for_event(event_id)?;
    Ok(Json(images))
}

/// DELETE /v1/events/{id}/images/{image_id} — delete an event image.
#[utoipa::path(
    delete,
    path = "/v1/events/{id}/images/{image_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("image_id" = Uuid, Path, description = "Image ID"),
    ),
    responses(
        (status = 204, description = "Image deleted"),
        (status = 404, description = "Image not found"),
    ),
    tag = "Event Images"
)]
pub async fn delete_event_image(
    State(state): State<Arc<AppState>>,
    Path((event_id, image_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ServiceError> {
    let svc = EventImageService::new(EventImageRepository::new(state.db_client.clone()));

    svc.delete_image(event_id, image_id)?;
    Ok(StatusCode::NO_CONTENT)
}

/// PATCH /v1/events/{id}/images/{image_id} — update an event image.
#[utoipa::path(
    patch,
    path = "/v1/events/{id}/images/{image_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("image_id" = Uuid, Path, description = "Image ID"),
    ),
    request_body = UpdateEventImageRequest,
    responses(
        (status = 200, description = "Image updated", body = EventImageResponse),
        (status = 404, description = "Image not found"),
    ),
    tag = "Event Images"
)]
pub async fn update_event_image(
    State(state): State<Arc<AppState>>,
    Path((event_id, image_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateEventImageRequest>,
) -> Result<Json<EventImageResponse>, ServiceError> {
    let svc = EventImageService::new(EventImageRepository::new(state.db_client.clone()));

    let image = svc.update_image(event_id, image_id, req)?;
    Ok(Json(image))
}
