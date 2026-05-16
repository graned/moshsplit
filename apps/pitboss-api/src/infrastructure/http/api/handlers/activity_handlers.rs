//! Handlers for the Activity Feed (Battle Log) endpoint.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::activity_dtos::{ActivityResponse, ListActivityParams};
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::services::activity_service::ActivityService;

/// GET /v1/events/:id/activity — list activity feed for an event.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/activity",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor (encodes created_at + id)"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Activity feed items", body = ActivityResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Activity"
)]
pub async fn list_activity(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<ListActivityParams>,
) -> Result<Json<ActivityResponse>, ServiceError> {
    let svc = ActivityService::new(
        EventRepository::new(state.db_client.clone()),
        state.db_client.clone(),
    );

    let response = svc.list_activity(event_id, params.cursor.as_deref(), params.limit())?;
    Ok(Json(response))
}
