//! Handlers for Balance endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, ExplainBalanceResponse, ExternalBalanceItem,
    ExternalBalanceSummaryRequest, ExternalBalanceSummaryResponse, SimplifiedDebtsResponse,
    UserBalanceResponse,
};
use crate::infrastructure::http::api::dtos::stats_dtos::EventStats;
use crate::infrastructure::http::AppState;
use crate::domain::repositories::balance_repo::BalanceRepository;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::stats_repo::StatsRepository;
use crate::services::balance_service::BalanceService;
use crate::services::stats_service::StatsService;

/// GET /v1/events/:id/balances — all balances for an event.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "All user balances", body = BalancesResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Balances"
)]
pub async fn all_balances(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<BalancesResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        BalanceRepository::new(state.db_client.clone()),
    );

    let balances = svc.all_balances(event_id)?;
    Ok(Json(balances))
}

/// GET /v1/events/:id/balances/:user_id — single user balance.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances/{user_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("user_id" = Uuid, Path, description = "User ID"),
    ),
    responses(
        (status = 200, description = "User balance", body = UserBalanceResponse),
        (status = 404, description = "Event or user not found"),
    ),
    tag = "Balances"
)]
pub async fn user_balance(
    State(state): State<Arc<AppState>>,
    Path((event_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<UserBalanceResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        BalanceRepository::new(state.db_client.clone()),
    );

    let balance = svc.user_balance(event_id, user_id)?;
    Ok(Json(balance))
}

/// GET /v1/events/:id/balances/simplified — simplified debts.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances/simplified",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
    ),
    responses(
        (status = 200, description = "Simplified debt transfers", body = SimplifiedDebtsResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Balances"
)]
pub async fn simplified_debts(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<SimplifiedDebtsResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        BalanceRepository::new(state.db_client.clone()),
    );

    let debts = svc.simplified_debts(event_id)?;
    Ok(Json(debts))
}

/// GET /v1/events/:id/balances/:user_id/explain — explain balance.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances/{user_id}/explain",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("user_id" = Uuid, Path, description = "User ID"),
    ),
    responses(
        (status = 200, description = "Balance explanation", body = ExplainBalanceResponse),
        (status = 404, description = "Event or user not found"),
    ),
    tag = "Balances"
)]
pub async fn explain_balance(
    State(state): State<Arc<AppState>>,
    Path((event_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ExplainBalanceResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        BalanceRepository::new(state.db_client.clone()),
    );

    let explanation = svc.explain_balance(event_id, user_id)?;
    Ok(Json(explanation))
}

/// Query parameters for the balance stats endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct BalanceStatsQuery {
    /// The user ID to get stats for.
    pub user_id: Uuid,
}

/// GET /v1/events/:id/balances/stats — event statistics for a specified user.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances/stats",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        BalanceStatsQuery,
    ),
    responses(
        (status = 200, description = "Event statistics for the specified user", body = EventStats),
        (status = 404, description = "Event not found"),
    ),
    tag = "Balances"
)]
pub async fn balance_stats(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<Uuid>,
    Query(query): Query<BalanceStatsQuery>,
) -> Result<Json<EventStats>, ServiceError> {
    let svc = StatsService::new(
        EventRepository::new(state.db_client.clone()),
        StatsRepository::new(state.db_client.clone()),
    );

    let stats = svc.get_stats(event_id, query.user_id)?;
    Ok(Json(stats))
}

/// POST /v1/balances/external-summary — per-expense balance summary for a user by email.
///
/// Requires a valid API token (Bearer auth) and an email in the request body.
/// Resolves the email to a user via Sentinel, then computes the user's per-expense
/// balance for their first active event.
#[utoipa::path(
    post,
    path = "/v1/balances/external-summary",
    request_body = ExternalBalanceSummaryRequest,
    responses(
        (status = 200, description = "External balance summary", body = ExternalBalanceSummaryResponse),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Authentication required"),
        (status = 404, description = "User or event not found"),
    ),
    tag = "External"
)]
pub async fn external_summary(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalBalanceSummaryRequest>,
) -> Result<Json<ExternalBalanceSummaryResponse>, ServiceError> {
    let email = payload.email.trim().to_lowercase();

    if email.is_empty() {
        return Err(ServiceError::Validation("Email is required".into()));
    }

    // Resolve email -> user_id via Sentinel auth database
    let user_id = state
        .sentinel_auth_client
        .find_user_id_by_email(&email)
        .map_err(|e| ServiceError::Database(format!("Failed to look up user: {e}")))?
        .ok_or_else(|| ServiceError::NotFound(format!("No user found with email {email}")))?;

    // Compute per-expense breakdown
    let balance_repo = BalanceRepository::new(state.db_client.clone());
    let (event_name, rows) = balance_repo
        .external_expense_breakdown(user_id)
        .map_err(ServiceError::from)?;

    if event_name.is_empty() {
        return Err(ServiceError::NotFound(
            "User is not a member of any active event".into(),
        ));
    }

    let items: Vec<ExternalBalanceItem> = rows
        .into_iter()
        .map(|r| ExternalBalanceItem {
            title: r.title,
            amount_cents: r.amount_cents,
        })
        .collect();

    let total_balance_cents: i32 = items.iter().map(|i| i.amount_cents).sum();

    Ok(Json(ExternalBalanceSummaryResponse {
        event_name,
        total_balance_cents,
        items,
    }))
}
