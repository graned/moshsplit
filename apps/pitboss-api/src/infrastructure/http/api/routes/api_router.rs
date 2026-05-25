//! Builds the API router with full middleware stack.
//!
//! Middleware order (outer → inner):
//!   1. CorsLayer
//!   2. Sentinel AuthMiddleware (protects all /v1/ routes)
//!   3. RequestId middleware
//!   4. Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
//!   5. CatchPanicLayer
//!   6. TraceLayer
//!   7. Extension<AppState>
//!   8. ResponseWrapper middleware
//!   9. Route matching

use std::sync::Arc;

use axum::middleware;
use axum::routing::{delete, get, patch, post};
use axum::Router;
use sentinel_client::AuthMiddleware;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::infrastructure::http::api::handlers::activity_handlers;
use crate::infrastructure::http::api::handlers::auth_handlers;
use crate::infrastructure::http::api::handlers::balance_handlers;
use crate::infrastructure::http::api::handlers::event_handlers;
use crate::infrastructure::http::api::handlers::event_image_handlers;
use crate::infrastructure::http::api::handlers::expense_handlers;
use crate::infrastructure::http::api::handlers::member_handlers;
use crate::infrastructure::http::api::handlers::payment_handlers;
use crate::infrastructure::http::api::handlers::settlement_handlers;
use crate::infrastructure::http::api::handlers::stats_handlers;
use crate::infrastructure::http::api::handlers::system_handlers;
use crate::infrastructure::http::api::middlewares::cookie_auth;
use crate::infrastructure::http::api::middlewares::request_id_middleware;
use crate::infrastructure::http::api::middlewares::response_wrapper;
use crate::infrastructure::http::api::openapi::{ApiDoc, ExternalApiDoc};
use crate::infrastructure::http::api::routes::admin_router;
use crate::infrastructure::http::AppState;

/// Build the API router with all middleware layers applied.
///
/// Middleware execution order (outermost → innermost):
///   1. CorsLayer
///   2. Sentinel AuthMiddleware (protects all /v1/ routes)
///   3. RequestId middleware (injects `X-Request-Id` into request extensions)
///   4. CatchPanicLayer (catches panics and returns 500)
///   5. TraceLayer (request/response logging)
///   6. ResponseWrapper middleware (wraps all responses in `ApiResponse` envelope)
///   7. Route matching
///
/// Axum/Tower layer semantics:
///   Layers added FIRST are closest to the handler (innermost).
///   Layers added LAST wrap everything (outermost).
pub fn build_router(state: Arc<AppState>) -> Router {
    // ── Public routes (no auth required) ───────────────────────────────
    // Note: These must be kept separate from protected routes to avoid
    // the AuthMiddleware being applied to token-exchange endpoints
    let public_routes = Router::new()
        .route("/health", get(system_handlers::health_check))
        .route("/livez", get(system_handlers::livez))
        .merge(SwaggerUi::new("/docs/internal").url("/api-docs/internal/openapi.json", ApiDoc::openapi()))
        .merge(SwaggerUi::new("/docs/external").url("/api-docs/external/openapi.json", ExternalApiDoc::openapi()));

    // ── Public auth routes (no auth required, but under /v1/) ─────────
    // These endpoints exchange tokens, so they cannot require a Bearer token
    let public_auth_routes = Router::new()
        .route("/v1/auth/external-login", post(auth_handlers::external_login))
        .route("/v1/auth/refresh", post(auth_handlers::refresh_token))
        .route("/v1/balances/external-summary", post(balance_handlers::external_summary));

    // ── Protected API routes (require Sentinel auth) ──────────────────

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
        )
        .route(
            "/v1/events/{id}/settlements/{settlement_id}/approve",
            post(settlement_handlers::approve_settlement),
        )
        .route(
            "/v1/events/{id}/settlements/{settlement_id}/reject",
            post(settlement_handlers::reject_settlement),
        )
        .route(
            "/v1/events/{id}/settlements/incoming",
            get(settlement_handlers::incoming_balances),
        )
        .route(
            "/v1/events/{id}/settlements/outgoing",
            get(settlement_handlers::outgoing_balances),
        )
        .route(
            "/v1/events/{id}/settlements/requests",
            get(settlement_handlers::list_settlement_requests),
        )
        .route(
            "/v1/events/{id}/settlements/history",
            get(settlement_handlers::list_settlement_history),
        );

    // ── Balances ───────────────────────────────────────────────────────
    let balance_routes = Router::new()
        .route("/v1/events/{id}/balances", get(balance_handlers::all_balances))
        .route(
            "/v1/events/{id}/balances/simplified",
            get(balance_handlers::simplified_debts),
        )
        .route(
            "/v1/events/{id}/balances/stats",
            get(balance_handlers::balance_stats),
        )
        .route(
            "/v1/events/{id}/balances/{user_id}",
            get(balance_handlers::user_balance),
        )
        .route(
            "/v1/events/{id}/balances/{user_id}/explain",
            get(balance_handlers::explain_balance),
        );

    // ── Activity (Battle Log) ──────────────────────────────────────────
    let activity_routes = Router::new()
        .route("/v1/events/{id}/activity", get(activity_handlers::list_activity));

    // ── Stats ──────────────────────────────────────────────────────────
    let stats_routes = Router::new()
        .route("/v1/events/{id}/stats", get(stats_handlers::get_event_stats));

    // ── Event Images ───────────────────────────────────────────────────
    let event_image_routes = Router::new()
        .route(
            "/v1/events/{id}/images",
            get(event_image_handlers::list_event_images),
        )
        .route(
            "/v1/events/{id}/images",
            post(event_image_handlers::create_event_image),
        )
        .route(
            "/v1/events/{id}/images/{image_id}",
            patch(event_image_handlers::update_event_image),
        )
        .route(
            "/v1/events/{id}/images/{image_id}",
            delete(event_image_handlers::delete_event_image),
        );

    // Merge all protected routes
    let protected_api = event_routes
        .merge(member_routes)
        .merge(expense_routes)
        .merge(payment_routes)
        .merge(settlement_routes)
        .merge(balance_routes)
        .merge(activity_routes)
        .merge(stats_routes)
        .merge(event_image_routes)
        .merge(admin_router::build_admin_router());

    // Create Sentinel auth middleware using the client from app state
    let sentinel_client = state.sentinel_client.clone();
    let auth_middleware = Arc::new(AuthMiddleware::new(sentinel_client.clone()));
    let cookie_auth_middleware = Arc::new(cookie_auth::CookieAuthMiddleware::new(sentinel_client));

    let public_api = Router::new()
        .merge(public_routes)
        .merge(public_auth_routes)
        .layer(TraceLayer::new_for_http())
        .layer(CatchPanicLayer::new())
        .layer(middleware::from_fn(
            request_id_middleware::request_id_middleware,
        ))
        .layer(CorsLayer::permissive());

    let protected_api = protected_api
        .layer(middleware::from_fn(move |req, next| {
            let auth = auth_middleware.clone();
            async move { auth.authenticate(req, next).await }
        }))
        .layer(middleware::from_fn(move |req, next| {
            let auth = cookie_auth_middleware.clone();
            async move { auth.authenticate(req, next).await }
        }))
        .layer(middleware::from_fn(
            response_wrapper::response_wrapper_middleware,
        ))
        .layer(TraceLayer::new_for_http())
        .layer(CatchPanicLayer::new())
        .layer(middleware::from_fn(
            request_id_middleware::request_id_middleware,
        ))
        .layer(CorsLayer::permissive());

    let api_routes = Router::new()
        .merge(public_api)
        .merge(protected_api);

    // Attach shared application state.
    api_routes.with_state(state)
}
