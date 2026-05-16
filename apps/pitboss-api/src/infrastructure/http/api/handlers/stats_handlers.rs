//! Handlers for Event Stats endpoints.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::stats_dtos::EventStats;
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::stats_repo::StatsRepository;
use crate::services::stats_service::StatsService;

/// GET /v1/events/:id/stats — event statistics for the current user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/stats",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Event statistics", body = EventStats),
        (status = 404, description = "Event not found"),
    ),
    tag = "Stats"
)]
pub async fn get_event_stats(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<EventStats>, ServiceError> {
    let svc = StatsService::new(
        EventRepository::new(state.db_client.clone()),
        StatsRepository::new(state.db_client.clone()),
    );

    let stats = svc.get_stats(event_id, user_id)?;
    Ok(Json(stats))
}
