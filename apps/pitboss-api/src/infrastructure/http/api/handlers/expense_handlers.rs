//! Handlers for Expense endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::common::{PaginatedResponse, PaginationMeta};
use crate::infrastructure::http::api::dtos::expense_dtos::{
    CreateExpenseRequest, ExpenseListItem, ExpenseResponse, ExpenseVersionDetail, ListExpensesParams,
    UpdateExpenseRequest,
};
use crate::infrastructure::http::api::extractors::CurrentUser;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::expense_repo::ExpenseRepository;
use crate::domain::repositories::expense_version_repo::ExpenseVersionRepository;
use crate::domain::repositories::expense_version_share_repo::ExpenseVersionShareRepository;
use crate::domain::repositories::payment_repo::PaymentRepository;
use crate::services::expense_service::ExpenseService;

/// GET /v1/events/:id/expenses — list expenses.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/expenses",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
        ("include_deleted" = Option<bool>, Query, description = "Include soft-deleted expenses"),
        ("expense_type" = Option<String>, Query, description = "Filter by expense category"),
        ("user_id" = Option<Uuid>, Query, description = "Filter to show only expenses paid by the user"),
    ),
    responses(
        (status = 200, description = "Paginated list of expenses", body = PaginatedResponse<ExpenseListItem>),
    ),
    tag = "Expenses"
)]
pub async fn list_expenses(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(params): Query<ListExpensesParams>,
) -> Result<Json<PaginatedResponse<ExpenseListItem>>, ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    let (items, has_more, next_cursor) = svc.list_expenses(
        event_id,
        params.cursor.as_deref(),
        params.limit(),
        params.include_deleted(),
        params.expense_type.as_deref(),
        params.user_id,
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

/// POST /v1/events/:id/expenses — create expense.
#[utoipa::path(
    post,
    path = "/v1/events/{id}/expenses",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    request_body = CreateExpenseRequest,
    responses(
        (status = 201, description = "Expense created", body = ExpenseResponse),
        (status = 400, description = "Validation error"),
    ),
    tag = "Expenses"
)]
pub async fn create_expense(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<CreateExpenseRequest>,
) -> Result<(StatusCode, Json<ExpenseResponse>), ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    let expense = svc.create_expense(event_id, req, user_id)?;
    Ok((StatusCode::CREATED, Json(expense)))
}

/// GET /v1/events/:id/expenses/:expense_id — get expense details.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/expenses/{expense_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("expense_id" = Uuid, Path, description = "Expense ID"),
    ),
    responses(
        (status = 200, description = "Expense details", body = ExpenseResponse),
        (status = 404, description = "Expense not found"),
    ),
    tag = "Expenses"
)]
pub async fn get_expense(
    State(state): State<Arc<AppState>>,
    Path((_event_id, expense_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ExpenseResponse>, ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    let expense = svc.get_expense(expense_id)?;
    Ok(Json(expense))
}

/// PATCH /v1/events/:id/expenses/:expense_id — update expense (new version).
#[utoipa::path(
    patch,
    path = "/v1/events/{id}/expenses/{expense_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("expense_id" = Uuid, Path, description = "Expense ID"),
    ),
    request_body = UpdateExpenseRequest,
    responses(
        (status = 200, description = "Expense updated", body = ExpenseResponse),
        (status = 404, description = "Expense not found"),
    ),
    tag = "Expenses"
)]
pub async fn update_expense(
    State(state): State<Arc<AppState>>,
    Path((event_id, expense_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
    Json(req): Json<UpdateExpenseRequest>,
) -> Result<Json<ExpenseResponse>, ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    let expense = svc.update_expense(event_id, expense_id, req, user_id)?;
    Ok(Json(expense))
}

/// DELETE /v1/events/:id/expenses/:expense_id — soft-delete expense.
#[utoipa::path(
    delete,
    path = "/v1/events/{id}/expenses/{expense_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("expense_id" = Uuid, Path, description = "Expense ID"),
    ),
    responses(
        (status = 204, description = "Expense deleted"),
        (status = 403, description = "Forbidden — only creator can delete"),
        (status = 404, description = "Expense not found"),
    ),
    tag = "Expenses"
)]
pub async fn delete_expense(
    State(state): State<Arc<AppState>>,
    Path((event_id, expense_id)): Path<(Uuid, Uuid)>,
    CurrentUser(user_id): CurrentUser,
) -> Result<StatusCode, ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    svc.delete_expense(event_id, expense_id, user_id)?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /v1/events/:id/expenses/:expense_id/versions — list all versions.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/expenses/{expense_id}/versions",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("expense_id" = Uuid, Path, description = "Expense ID"),
    ),
    responses(
        (status = 200, description = "List of expense versions", body = Vec<ExpenseVersionDetail>),
        (status = 404, description = "Expense not found"),
    ),
    tag = "Expenses"
)]
pub async fn list_expense_versions(
    State(state): State<Arc<AppState>>,
    Path((_event_id, expense_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<ExpenseVersionDetail>>, ServiceError> {
    let svc = ExpenseService::new(
        EventRepository::new(state.db_client.clone()),
        ExpenseRepository::new(state.db_client.clone()),
        ExpenseVersionRepository::new(state.db_client.clone()),
        ExpenseVersionShareRepository::new(state.db_client.clone()),
        PaymentRepository::new(state.db_client.clone()),
    );

    let versions = svc.get_expense_with_versions(expense_id)?;
    Ok(Json(versions))
}
