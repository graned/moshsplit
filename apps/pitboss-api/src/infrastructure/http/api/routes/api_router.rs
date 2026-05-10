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
use axum::routing::get;
use axum::Router;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

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

    // NOTE: future authenticated routes go behind a separate router that
    // also applies the auth middleware.

    let api_routes = Router::new()
        .nest("/", public_routes)
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
