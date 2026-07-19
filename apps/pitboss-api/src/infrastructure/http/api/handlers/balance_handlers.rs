//! Handlers for Balance endpoints.

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::domain::repositories::balance_repo::BalanceRepository;
use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::domain::repositories::stats_repo::StatsRepository;
use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::balance_dtos::{
    BalancesResponse, ExplainBalanceBetweenResponse, ExplainBalanceResponse, ExternalBalanceItem,
    ExternalBalanceSummaryRequest, ExternalBalanceSummaryResponse, SimplifiedDebtsResponse,
    UserBalanceResponse,
};
use crate::infrastructure::http::api::dtos::stats_dtos::EventStats;
use crate::infrastructure::http::AppState;
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

/// GET /v1/events/{id}/balances/{user_id}/explain/{counterparty_id} — expenses between two users.
#[utoipa::path(
    get,
    path = "/v1/events/{id}/balances/{user_id}/explain/{counterparty_id}",
    params(
        ("id" = Uuid, Path, description = "Event ID"),
        ("user_id" = Uuid, Path, description = "User ID"),
        ("counterparty_id" = Uuid, Path, description = "Counterparty User ID"),
    ),
    responses(
        (status = 200, description = "Expenses breakdown between two users", body = ExplainBalanceBetweenResponse),
        (status = 404, description = "Event not found"),
    ),
    tag = "Balances"
)]
pub async fn explain_balance_between(
    State(state): State<Arc<AppState>>,
    Path((event_id, user_id, counterparty_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<ExplainBalanceBetweenResponse>, ServiceError> {
    let svc = BalanceService::new(
        EventRepository::new(state.db_client.clone()),
        BalanceRepository::new(state.db_client.clone()),
    );
    let explanation = svc.explain_balance_between(event_id, user_id, counterparty_id)?;
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
/// External consumers pass an API token (`sat_...`) via `Authorization: Bearer <api_token>`.
/// Pitboss-api validates the API token against Sentinel, then uses the email in the
/// request body to look up the user and compute their per-expense balance for their
/// first active event using `moshsplit_balance_engine::compute_balance`.
#[utoipa::path(
    post,
    path = "/v1/balances/external-summary",
    request_body = ExternalBalanceSummaryRequest,
    responses(
        (status = 200, description = "External balance summary", body = ExternalBalanceSummaryResponse),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Authentication required — invalid or missing API token"),
        (status = 404, description = "User or event not found"),
    ),
    security(
        ("api_token_auth" = [])
    ),
    tag = "External"
)]
pub async fn external_summary(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<ExternalBalanceSummaryRequest>,
) -> Result<Json<ExternalBalanceSummaryResponse>, ServiceError> {
    // Step 1 — extract API token from Authorization header
    let api_token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer ").map(|s| s.to_string()))
        .ok_or_else(|| {
            ServiceError::Unauthorized("Missing or invalid Authorization header".into())
        })?;

    // Step 2 — validate API token via Sentinel token exchange (ignore the session, just check validity)
    let validation_result = state
        .sentinel_client
        .exchange_token(&api_token, &payload.email, "validation-only", None)
        .await;

    match validation_result {
        Err(sentinel_client::SentinelError::Api { code, status, .. })
            if code == sentinel_client::SentinelErrorCode::InvalidToken
                || code == sentinel_client::SentinelErrorCode::AuthError
                || status == 401 =>
        {
            return Err(ServiceError::Unauthorized(
                "Invalid or expired API token".into(),
            ));
        }
        Err(e) => {
            tracing::warn!("Sentinel validation failed: {}", e);
            return Err(ServiceError::Unauthorized(
                "API token validation failed".into(),
            ));
        }
        Ok(_) => {}
    }

    // Step 3 — resolve email to user_id via Sentinel admin API
    let email = payload.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(ServiceError::Validation("Email is required".into()));
    }

    let user_id = {
        let result = state
            .sentinel_client
            .list_users(&api_token, Some(1), Some(100))
            .await;

        match result {
            Ok(resp) => resp
                .items
                .into_iter()
                .find(|u| u.email.to_lowercase() == email)
                .map(|u| Uuid::parse_str(&u.user_id).ok())
                .flatten()
                .ok_or_else(|| {
                    ServiceError::NotFound(format!("No user found with email {email}"))
                })?,
            Err(e) => {
                tracing::warn!("Failed to fetch users from Sentinel: {}", e);
                return Err(ServiceError::Unauthorized(
                    "Failed to validate credentials".into(),
                ));
            }
        }
    };

    let member_repo = EventMemberRepository::new(state.db_client.clone());
    if !member_repo.is_member_of_any_active_event(user_id)? {
        return Err(ServiceError::NotFound(
            "User is not a member of any active event".into(),
        ));
    }

    let balance_repo = BalanceRepository::new(state.db_client.clone());
    let (event_id, event_name, rows) = balance_repo
        .external_expense_breakdown(user_id)
        .map_err(ServiceError::from)?;

    // Step 5 — get the full balance row for compute_balance (paid/owes/payments)
    let balance_row = balance_repo
        .user_balance(event_id, user_id)
        .map_err(ServiceError::from)?;

    let (paid_cents, owes_cents, payments_out, payments_in) = match balance_row {
        Some(row) => (
            row.paid_cents,
            row.owes_cents,
            row.payments_out_cents,
            row.payments_in_cents,
        ),
        None => (0, 0, 0, 0),
    };

    let total_balance_cents = moshsplit_balance_engine::compute_balance(
        paid_cents,
        owes_cents,
        payments_out,
        payments_in,
    );

    // Step 6 — build per-expense items
    let items: Vec<ExternalBalanceItem> = rows
        .into_iter()
        .map(|r| ExternalBalanceItem {
            title: r.title,
            amount_cents: r.amount_cents,
        })
        .collect();

    Ok(Json(ExternalBalanceSummaryResponse {
        event_name,
        total_balance_cents,
        items,
    }))
}
