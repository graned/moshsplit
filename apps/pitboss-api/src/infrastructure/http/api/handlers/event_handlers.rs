//! Handlers for Event endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;

use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{ListEventsParams, PaginatedResponse, PaginationMeta};
use crate::infrastructure::http::api::dtos::event_dtos::{
    CreateEventRequest, EventListItem, EventResponse, UpdateEventRequest,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::infrastructure::persistence::event_repo::EventRepository;
use crate::infrastructure::persistence::member_repo::EventMemberRepository;
use crate::services::event_service::EventService;

/// GET /v1/events — list events with optional status filter.
#[utoipa::path(
    get,
    path = "/v1/events",
    params(
        ("status" = Option<String>, Query, description = "Filter by event status"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor (ISO 8601)"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Paginated list of events", body = PaginatedResponse<EventListItem>),
    ),
    tag = "Events"
)]
pub async fn list_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListEventsParams>,
) -> Result<Json<PaginatedResponse<EventListItem>>, ServiceError> {
    let svc = EventService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) =
        svc.list_events(params.status.as_deref(), params.cursor.as_deref(), params.limit())?;

    Ok(Json(PaginatedResponse {
        items,
        pagination: PaginationMeta {
            next_cursor,
            has_more,
            limit: params.limit(),
        },
    }))
}

/// POST /v1/events — create a new event.
#[utoipa::path(
    post,
    path = "/v1/events",
    request_body = CreateEventRequest,
    responses(
        (status = 201, description = "Event created", body = EventResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Events"
)]
pub async fn create_event(
    State(state): State<Arc<AppState>>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<CreateEventRequest>,
) -> Result<(StatusCode, Json<EventResponse>), ServiceError> {
    let svc = EventService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let event = svc.create_event(req, user_id)?;
    Ok((StatusCode::CREATED, Json(event)))
}

/// GET /v1/events/:id — get event details.
#[utoipa::path(
    get,
    path = "/v1/events/{id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Event details", body = EventResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Events"
)]
pub async fn get_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<EventResponse>, ServiceError> {
    let svc = EventService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let event = svc.get_event(event_id)?;
    Ok(Json(event))
}

/// PATCH /v1/events/:id — partially update an event.
#[utoipa::path(
    patch,
    path = "/v1/events/{id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = UpdateEventRequest,
    responses(
        (status = 200, description = "Event updated", body = EventResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Events"
)]
pub async fn patch_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Json(req): Json<UpdateEventRequest>,
) -> Result<Json<EventResponse>, ServiceError> {
    let svc = EventService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let event = svc.patch_event(event_id, req)?;
    Ok(Json(event))
}

/// DELETE /v1/events/:id — archive (soft-delete) an event.
#[utoipa::path(
    delete,
    path = "/v1/events/{id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 204, description = "Event archived"),
        (status = 404, description = "Event not found"),
    ),
    tag = "Events"
)]
pub async fn delete_event(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<StatusCode, ServiceError> {
    let svc = EventService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    svc.delete_event(event_id)?;
    Ok(StatusCode::NO_CONTENT)
}
