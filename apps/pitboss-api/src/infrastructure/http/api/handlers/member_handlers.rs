//! Handlers for EventMember endpoints.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::member_dtos::{AddMemberRequest, MemberListItem};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::infrastructure::persistence::event_repo::EventRepository;
use crate::infrastructure::persistence::member_repo::EventMemberRepository;
use crate::services::member_service::MemberService;

/// GET /v1/events/:id/members — list active members.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/members",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "List of active members", body = Vec<MemberListItem>),
        (status = 404, description = "Event not found"),
    ),
    tag = "Members"
)]
pub async fn list_members(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<MemberListItem>>, ServiceError> {
    let svc = MemberService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let members = svc.list_members(event_id)?;
    Ok(Json(members))
}

/// POST /v1/events/:id/members — add a member.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/members",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added", body = MemberListItem),
        (status = 400, description = "Validation error"),
        (status = 404, description = "Event not found"),
    ),
    tag = "Members"
)]
pub async fn add_member(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<AddMemberRequest>,
) -> Result<(StatusCode, Json<MemberListItem>), ServiceError> {
    let svc = MemberService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let member = svc.add_member(event_id, req, user_id)?;
    Ok((StatusCode::CREATED, Json(member)))
}

/// DELETE /v1/events/:id/members/:user_id — remove a member.
#[utoipa::path(
    delete,
    path = "/v1/events/{id}/members/{user_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("user_id" = Uuid, Path, description = "User ID to remove"),
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 404, description = "Member not found"),
    ),
    tag = "Members"
)]
pub async fn remove_member(
    State(state): State<Arc<AppState>>,
    Path((event_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ServiceError> {
    let svc = MemberService::new(
        EventRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    svc.remove_member(event_id, user_id)?;
    Ok(StatusCode::NO_CONTENT)
}
