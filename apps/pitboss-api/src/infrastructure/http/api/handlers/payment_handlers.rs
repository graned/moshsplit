//! Handlers for Payment endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{CursorParams, PaginatedResponse, PaginationMeta};
use crate::infrastructure::http::api::dtos::payment_dtos::{
    CreatePaymentRequest, PaymentListItem, PaymentResponse,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::services::payment_service::PaymentService;

/// GET /v1/events/:id/payments — list payments.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Paginated list of payments", body = PaginatedResponse<PaymentListItem>),
    ),
    tag = "Payments"
)]
pub async fn list_payments(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<CursorParams>,
) -> Result<Json<PaginatedResponse<PaymentListItem>>, ServiceError> {
    let svc = PaymentService::new(
        EventRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) =
        svc.list_payments(event_id, params.cursor.as_deref(), params.limit())?;

    Ok(Json(PaginatedResponse {
        items,
        pagination: PaginationMeta {
            next_cursor,
            has_more,
            limit: params.limit(),
        },
    }))
}

/// POST /v1/events/:id/payments — record a payment.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/payments",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = CreatePaymentRequest,
    responses(
        (status = 201, description = "Payment recorded", body = PaymentResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Payments"
)]
pub async fn create_payment(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<CreatePaymentRequest>,
) -> Result<(StatusCode, Json<PaymentResponse>), ServiceError> {
    let svc = PaymentService::new(
        EventRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let payment = svc.create_payment(event_id, req, user_id)?;
    Ok((StatusCode::CREATED, Json(payment)))
}

/// GET /v1/events/:id/payments/:payment_id — get payment details.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/{payment_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("payment_id" = Uuid, Path, description = "Payment ID"),
    ),
    responses(
        (status = 200, description = "Payment details", body = PaymentResponse),
        (status = 404, description = "Payment not found"),
    ),
    tag = "Payments"
)]
pub async fn get_payment(
    State(state): State<Arc<AppState>>,
    Path((event_id, payment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<PaymentResponse>, ServiceError> {
    let svc = PaymentService::new(
        EventRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    );

    let payment = svc.get_payment(event_id, payment_id)?;
    Ok(Json(payment))
}
