//! Handlers for unified Payment endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::domain::repositories::payment_transaction_repo::PaymentTransactionRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{
    CursorParams, PaginatedResponse, PaginationMeta,
};
use crate::infrastructure::http::api::dtos::payment_dtos::{
    BalanceSummary, ConfirmTransactionRequest, CreatePaymentRequest, PaymentBreakdown,
    PaymentListItem, PaymentResponse, PaymentTransactionResponse, ProposeTransactionRequest,
    RejectTransactionRequest, TransactionWithPaymentContext,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::services::payment_service::PaymentService;

fn make_svc(state: &AppState) -> PaymentService {
    PaymentService::new(
        EventRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
        PaymentTransactionRepository::new(state.db_client.clone()),
        EventMemberRepository::new(state.db_client.clone()),
    )
}

/// POST /v1/events/:id/payments — create a new payment obligation.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/payments",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = CreatePaymentRequest,
    responses(
        (status = 201, description = "Payment created", body = PaymentResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Payments"
)]
pub async fn create_payment(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(_user_id): CurrentUser,
    Json(req): Json<CreatePaymentRequest>,
) -> Result<(StatusCode, Json<PaymentResponse>), ServiceError> {
    let svc = make_svc(&state);

    let payment = svc.create_payment(
        event_id,
        req.creditor_id,
        req.debtor_id,
        req.expense_id,
        req.amount_cents,
        req.reason,
    )?;

    let response = svc.get_payment(event_id, payment.id)?;
    Ok((StatusCode::CREATED, Json(response)))
}

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
    let svc = make_svc(&state);

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
    let svc = make_svc(&state);
    let payment = svc.get_payment(event_id, payment_id)?;
    Ok(Json(payment))
}

/// POST /v1/events/:id/payments/:payment_id/transactions — propose a payment transaction.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/payments/{payment_id}/transactions",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("payment_id" = Uuid, Path, description = "Payment ID"),
    ),
    request_body = ProposeTransactionRequest,
    responses(
        (status = 201, description = "Transaction proposed", body = PaymentTransactionResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Payments"
)]
pub async fn propose_transaction(
    State(state): State<Arc<AppState>>,
    Path((event_id, payment_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<ProposeTransactionRequest>,
) -> Result<(StatusCode, Json<PaymentTransactionResponse>), ServiceError> {
    let svc = make_svc(&state);

    let _payment = svc.get_payment(event_id, payment_id)?;

    let transaction = svc.propose_payment_transaction(payment_id, req.amount_cents, user_id)?;

    let response = PaymentTransactionResponse {
        id: transaction.id,
        payment_id: transaction.payment_id,
        amount_cents: transaction.amount_cents,
        status: transaction.status.to_string(),
        proposed_by: transaction.proposed_by,
        confirmed_by: transaction.confirmed_by,
        created_at: transaction.created_at,
        confirmed_at: transaction.confirmed_at,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// POST /v1/events/:id/payments/transactions/:transaction_id/confirm — confirm a transaction.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/payments/transactions/{transaction_id}/confirm",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("transaction_id" = Uuid, Path, description = "Transaction ID"),
    ),
    request_body = ConfirmTransactionRequest,
    responses(
        (status = 200, description = "Transaction confirmed", body = PaymentTransactionResponse),
        (status = 403, description = "Forbidden — only creditor can confirm"),
    ),
    tag = "Payments"
)]
pub async fn confirm_transaction(
    State(state): State<Arc<AppState>>,
    Path((_event_id, transaction_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(_req): Json<ConfirmTransactionRequest>,
) -> Result<Json<PaymentTransactionResponse>, ServiceError> {
    let svc = make_svc(&state);

    let transaction = svc.confirm_payment_transaction(transaction_id, user_id)?;

    let response = PaymentTransactionResponse {
        id: transaction.id,
        payment_id: transaction.payment_id,
        amount_cents: transaction.amount_cents,
        status: transaction.status.to_string(),
        proposed_by: transaction.proposed_by,
        confirmed_by: transaction.confirmed_by,
        created_at: transaction.created_at,
        confirmed_at: transaction.confirmed_at,
    };

    Ok(Json(response))
}

/// GET /v1/events/:id/payments/incoming — payments where the current user is the creditor.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/incoming",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Incoming payments", body = Vec<PaymentListItem>),
    ),
    tag = "Payments"
)]
pub async fn incoming_payments(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<Vec<PaymentListItem>>, ServiceError> {
    let svc = make_svc(&state);
    let payments = svc.get_incoming_payments(event_id, user_id)?;
    Ok(Json(payments))
}

/// GET /v1/events/:id/payments/outgoing — payments where the current user is the debtor.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/outgoing",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Outgoing payments", body = Vec<PaymentListItem>),
    ),
    tag = "Payments"
)]
pub async fn outgoing_payments(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<Vec<PaymentListItem>>, ServiceError> {
    let svc = make_svc(&state);
    let payments = svc.get_outgoing_payments(event_id, user_id)?;
    Ok(Json(payments))
}

/// GET /v1/events/:id/payments/balance — balance summary for the current user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/balance",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Balance summary", body = BalanceSummary),
    ),
    tag = "Payments"
)]
pub async fn balance_summary(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<BalanceSummary>, ServiceError> {
    let svc = make_svc(&state);
    let summary = svc.calculate_balance(event_id, user_id)?;
    Ok(Json(summary))
}

/// GET /v1/events/:id/payments/breakdown — payment breakdown for the current user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/breakdown",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Payment breakdown", body = PaymentBreakdown),
    ),
    tag = "Payments"
)]
pub async fn payment_breakdown(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
) -> Result<Json<PaymentBreakdown>, ServiceError> {
    let svc = make_svc(&state);
    let breakdown = svc.get_payment_breakdown(event_id, user_id)?;
    Ok(Json(breakdown))
}

/// GET /v1/events/:id/payments/:payment_id/transactions — list transactions for a payment.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/payments/{payment_id}/transactions",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("payment_id" = Uuid, Path, description = "Payment ID"),
    ),
    responses(
        (status = 200, description = "Payment transactions", body = Vec<PaymentTransactionResponse>),
    ),
    tag = "Payments"
)]
pub async fn list_transactions(
    State(state): State<Arc<AppState>>,
    Path((_event_id, payment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<PaymentTransactionResponse>>, ServiceError> {
    let svc = make_svc(&state);
    let transactions = svc.list_payment_transactions(payment_id)?;
    Ok(Json(transactions))
}

pub async fn list_all_transactions(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<TransactionWithPaymentContext>>, ServiceError> {
    let svc = make_svc(&state);
    let transactions = svc.list_transactions_by_event(event_id)?;
    Ok(Json(transactions))
}

pub async fn reject_transaction(
    State(state): State<Arc<AppState>>,
    Path((_event_id, transaction_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(_req): Json<RejectTransactionRequest>,
) -> Result<Json<PaymentTransactionResponse>, ServiceError> {
    let svc = make_svc(&state);
    let transaction = svc.reject_payment_transaction(transaction_id, user_id)?;

    let response = PaymentTransactionResponse {
        id: transaction.id,
        payment_id: transaction.payment_id,
        amount_cents: transaction.amount_cents,
        status: transaction.status.to_string(),
        proposed_by: transaction.proposed_by,
        confirmed_by: transaction.confirmed_by,
        created_at: transaction.created_at,
        confirmed_at: transaction.confirmed_at,
    };

    Ok(Json(response))
}
