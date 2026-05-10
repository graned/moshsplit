//! Builds the API router with full middleware stack.
//!
//! Middleware order (outer → inner):
//!   1. CorsLayer
//!   2. RequestId middleware
//!   3. Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
//!   4. CatchPanicLayer
//!   5. TraceLayer
//!   6. Extension<AppState>
//!   7. ResponseWrapper middleware
//!   8. Route matching

use std::sync::Arc;

use axum::middleware;
use axum::routing::{delete, get, patch, post};
use axum::Router;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::infrastructure::http::api::handlers::balance_handlers;
use crate::infrastructure::http::api::handlers::event_handlers;
use crate::infrastructure::http::api::handlers::expense_handlers;
use crate::infrastructure::http::api::handlers::member_handlers;
use crate::infrastructure::http::api::handlers::payment_handlers;
use crate::infrastructure::http::api::handlers::settlement_handlers;
use crate::infrastructure::http::api::handlers::system_handlers;
use crate::infrastructure::http::api::middlewares::request_id_middleware;
use crate::infrastructure::http::api::middlewares::response_wrapper;
use crate::infrastructure::http::AppState;

/// Build the API router with all middleware layers applied.
///
/// Middleware execution order (outermost → innermost):
///   1. CorsLayer
///   2. RequestId middleware (injects `X-Request-Id` into request extensions)
///   3. CatchPanicLayer (catches panics and returns 500)
///   4. TraceLayer (request/response logging)
///   5. ResponseWrapper middleware (wraps all responses in `ApiResponse` envelope)
///   6. Route matching
///
/// Axum/Tower layer semantics:
///   Layers added FIRST are closest to the handler (innermost).
///   Layers added LAST wrap everything (outermost).
pub fn build_router(state: Arc<AppState>) -> Router {
    let public_routes = Router::new()
        .route("/health", get(system_handlers::health_check))
        .route("/livez", get(system_handlers::livez));

    // ── Events ─────────────────────────────────────────────────────────
    let event_routes = Router::new()
        .route("/v1/events", get(event_handlers::list_events))
        .route("/v1/events", post(event_handlers::create_event))
        .route("/v1/events/{id}", get(event_handlers::get_event))
        .route("/v1/events/{id}", patch(event_handlers::patch_event))
        .route("/v1/events/{id}", delete(event_handlers::delete_event));

    // ── Members ────────────────────────────────────────────────────────
    let member_routes = Router::new()
        .route("/v1/events/{id}/members", get(member_handlers::list_members))
        .route("/v1/events/{id}/members", post(member_handlers::add_member))
        .route(
            "/v1/events/{id}/members/{user_id}",
            delete(member_handlers::remove_member),
        );

    // ── Expenses ───────────────────────────────────────────────────────
    let expense_routes = Router::new()
        .route("/v1/events/{id}/expenses", get(expense_handlers::list_expenses))
        .route("/v1/events/{id}/expenses", post(expense_handlers::create_expense))
        .route(
            "/v1/events/{id}/expenses/{expense_id}",
            get(expense_handlers::get_expense),
        )
        .route(
            "/v1/events/{id}/expenses/{expense_id}",
            patch(expense_handlers::update_expense),
        )
        .route(
            "/v1/events/{id}/expenses/{expense_id}",
            delete(expense_handlers::delete_expense),
        )
        .route(
            "/v1/events/{id}/expenses/{expense_id}/versions",
            get(expense_handlers::list_expense_versions),
        );

    // ── Payments ───────────────────────────────────────────────────────
    let payment_routes = Router::new()
        .route("/v1/events/{id}/payments", get(payment_handlers::list_payments))
        .route("/v1/events/{id}/payments", post(payment_handlers::create_payment))
        .route(
            "/v1/events/{id}/payments/{payment_id}",
            get(payment_handlers::get_payment),
        );

    // ── Settlements ────────────────────────────────────────────────────
    let settlement_routes = Router::new()
        .route("/v1/events/{id}/settlements", get(settlement_handlers::list_settlements))
        .route("/v1/events/{id}/settlements", post(settlement_handlers::propose_settlement))
        .route(
            "/v1/events/{id}/settlements/{settlement_id}",
            patch(settlement_handlers::update_settlement_status),
        )
        .route(
            "/v1/events/{id}/settlements/{settlement_id}",
            get(settlement_handlers::get_settlement),
        );

    // ── Balances ───────────────────────────────────────────────────────
    let balance_routes = Router::new()
        .route("/v1/events/{id}/balances", get(balance_handlers::all_balances))
        .route(
            "/v1/events/{id}/balances/simplified",
            get(balance_handlers::simplified_debts),
        )
        .route(
            "/v1/events/{id}/balances/{user_id}",
            get(balance_handlers::user_balance),
        )
        .route(
            "/v1/events/{id}/balances/{user_id}/explain",
            get(balance_handlers::explain_balance),
        );

    let api_routes = Router::new()
        .merge(public_routes)
        .merge(event_routes)
        .merge(member_routes)
        .merge(expense_routes)
        .merge(payment_routes)
        .merge(settlement_routes)
        .merge(balance_routes)
        // ── Innermost (closest to handler) ──────────────────────
        .layer(middleware::from_fn(
            response_wrapper::response_wrapper_middleware,
        ))
        .layer(TraceLayer::new_for_http())
        .layer(CatchPanicLayer::new())
        .layer(middleware::from_fn(
            request_id_middleware::request_id_middleware,
        ))
        // ── Outermost ────────────────────────────────────────────
        .layer(CorsLayer::permissive()); // tighten in production

    // Attach shared application state.
    api_routes.with_state(state)
}
