//! Handlers for Settlement endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{ListSettlementsParams, PaginatedResponse, PaginationMeta};
use crate::infrastructure::http::api::dtos::settlement_dtos::{
    CreateSettlementRequest, SettlementListItem, SettlementResponse, UpdateSettlementStatusRequest,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::settlement_repo::SettlementRepository;
use crate::services::settlement_service::SettlementService;

/// GET /v1/events/:id/settlements — list settlements.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("status" = Option<String>, Query, description = "Filter by settlement status"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Paginated list of settlements", body = PaginatedResponse<SettlementListItem>),
    ),
    tag = "Settlements"
)]
pub async fn list_settlements(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<ListSettlementsParams>,
) -> Result<Json<PaginatedResponse<SettlementListItem>>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) = svc.list_settlements(
        event_id,
        params.status.as_deref(),
        params.cursor.as_deref(),
        params.limit(),
    )?;

    Ok(Json(PaginatedResponse {
        items,
        pagination: PaginationMeta {
            next_cursor,
            has_more,
            limit: params.limit(),
        },
    }))
}

/// POST /v1/events/:id/settlements — propose a new settlement.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/settlements",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = CreateSettlementRequest,
    responses(
        (status = 201, description = "Settlement proposed", body = SettlementResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Settlements"
)]
pub async fn propose_settlement(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<CreateSettlementRequest>,
) -> Result<(StatusCode, Json<SettlementResponse>), ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let settlement = svc.propose_settlement(event_id, req, user_id)?;
    Ok((StatusCode::CREATED, Json(settlement)))
}

/// PATCH /v1/events/:id/settlements/:settlement_id — update settlement status.
#[utoipa::path(
    patch,
    path = "/v1/events/{id}/settlements/{settlement_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("settlement_id" = Uuid, Path, description = "Settlement ID"),
    ),
    request_body = UpdateSettlementStatusRequest,
    responses(
        (status = 200, description = "Settlement updated", body = SettlementResponse),
        (status = 404, description = "Settlement not found"),
    ),
    tag = "Settlements"
)]
pub async fn update_settlement_status(
    State(state): State<Arc<AppState>>,
    Path((event_id, settlement_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateSettlementStatusRequest>,
) -> Result<Json<SettlementResponse>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let settlement = svc.update_settlement_status(event_id, settlement_id, req)?;
    Ok(Json(settlement))
}

/// GET /v1/events/:id/settlements/:settlement_id — get settlement details.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements/{settlement_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("settlement_id" = Uuid, Path, description = "Settlement ID"),
    ),
    responses(
        (status = 200, description = "Settlement details", body = SettlementResponse),
        (status = 404, description = "Settlement not found"),
    ),
    tag = "Settlements"
)]
pub async fn get_settlement(
    State(state): State<Arc<AppState>>,
    Path((event_id, settlement_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<SettlementResponse>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let settlement = svc.get_settlement(event_id, settlement_id)?;
    Ok(Json(settlement))
}
