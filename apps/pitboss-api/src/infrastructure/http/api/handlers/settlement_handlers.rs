//! Handlers for Settlement endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{CursorParams, ListSettlementsParams, PaginatedResponse, PaginationMeta};
use crate::infrastructure::http::api::dtos::settlement_dtos::{
    ApproveSettlementRequest, CreateSettlementRequest, IncomingBalancesResponse, OutgoingBalancesResponse,
    RejectSettlementRequest, SettlementHistoryItem, SettlementListItem, SettlementResponse, UpdateSettlementStatusRequest,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::settlement_repo::SettlementRepository;
use crate::services::balance_service::BalanceService;
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

/// POST /v1/events/:id/settlements — propose a new settlement (honor request).
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

/// POST /v1/events/:id/settlements/:settlement_id/approve — approve a settlement request.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/settlements/{settlement_id}/approve",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("settlement_id" = Uuid, Path, description = "Settlement ID"),
    ),
    request_body = ApproveSettlementRequest,
    responses(
        (status = 200, description = "Settlement approved — honor restored", body = SettlementResponse),
        (status = 400, description = "Validation error"),
        (status = 403, description = "Forbidden — only recipient can approve"),
        (status = 404, description = "Settlement not found"),
    ),
    tag = "Settlements"
)]
pub async fn approve_settlement(
    State(state): State<Arc<AppState>>,
    Path((event_id, settlement_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<ApproveSettlementRequest>,
) -> Result<Json<SettlementResponse>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let settlement = svc.approve_settlement(event_id, settlement_id, user_id, req)?;
    Ok(Json(settlement))
}

/// POST /v1/events/:id/settlements/:settlement_id/reject — reject a settlement request.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/settlements/{settlement_id}/reject",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("settlement_id" = Uuid, Path, description = "Settlement ID"),
    ),
    request_body = RejectSettlementRequest,
    responses(
        (status = 200, description = "Settlement rejected", body = SettlementResponse),
        (status = 400, description = "Validation error"),
        (status = 403, description = "Forbidden — only recipient can reject"),
        (status = 404, description = "Settlement not found"),
    ),
    tag = "Settlements"
)]
pub async fn reject_settlement(
    State(state): State<Arc<AppState>>,
    Path((event_id, settlement_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<RejectSettlementRequest>,
) -> Result<Json<SettlementResponse>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let settlement = svc.reject_settlement(event_id, settlement_id, user_id, req)?;
    Ok(Json(settlement))
}

/// PATCH /v1/events/:id/settlements/:settlement_id — update settlement status (legacy).
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

/// GET /v1/events/{id}/settlements/incoming — users who owe the current user money.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements/incoming",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Incoming balances — who owes the current user", body = IncomingBalancesResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Settlements"
)]
pub async fn incoming_balances(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<IncomingBalancesResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        crate::domain::repositories::balance_repo::BalanceRepository::new(state.db_client.clone()),
    );

    let response = svc.incoming_balances(event_id, user_id)?;
    Ok(Json(response))
}

/// GET /v1/events/{id}/settlements/outgoing — users the current user owes money to.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements/outgoing",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Outgoing balances — who the current user owes", body = OutgoingBalancesResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Settlements"
)]
pub async fn outgoing_balances(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<OutgoingBalancesResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        crate::domain::repositories::balance_repo::BalanceRepository::new(state.db_client.clone()),
    );

    let response = svc.outgoing_balances(event_id, user_id)?;
    Ok(Json(response))
}

/// GET /v1/events/{id}/settlements/requests — pending settlement requests involving the current user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements/requests",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Paginated settlement requests", body = PaginatedResponse<SettlementListItem>),
        (status = 404, description = "Event not found"),
    ),
    tag = "Settlements"
)]
pub async fn list_settlement_requests(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<CursorParams>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<PaginatedResponse<SettlementListItem>>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) = svc.list_settlements_for_user(
        event_id,
        user_id,
        None,
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

/// GET /v1/events/{id}/settlements/history — confirmed settlement history for the current user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/settlements/history",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Paginated settlement history", body = PaginatedResponse<SettlementHistoryItem>),
        (status = 404, description = "Event not found"),
    ),
    tag = "Settlements"
)]
pub async fn list_settlement_history(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<CursorParams>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<PaginatedResponse<SettlementHistoryItem>>, ServiceError> {
    let svc = SettlementService::new(
        EventRepository::new(state.db_client.clone()),
        SettlementRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) = svc.list_history_for_user(
        event_id,
        user_id,
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
