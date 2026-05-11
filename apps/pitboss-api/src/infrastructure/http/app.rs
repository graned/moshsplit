//! Application factory — `build_app()`.
//!
//! Single entry point for constructing the fully-wired Axum Router with
//! all infrastructure, state, and middleware.

use std::sync::Arc;

use axum::Router;
use sentinel_client::{SentinelClient, SentinelConfig};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::infrastructure::clients::DbClient;
use crate::infrastructure::http::api::openapi::ApiDoc;
use crate::infrastructure::http::api::routes::api_router;
use crate::infrastructure::http::AppState;

/// Build the complete application, wiring up database clients, domain
/// services, and the HTTP router.
pub async fn build_app(database_url: &str) -> Result<Router, anyhow::Error> {
    // ── Infrastructure ───────────────────────────────────────────────
    let db_client = DbClient::new(database_url)
        .map_err(|e| anyhow::anyhow!("Failed to connect to Postgres: {}", e))?;

    // Run pending migrations (idempotent).
    db_client
        .run_migrations()
        .map_err(|e| anyhow::anyhow!("Migration failed: {}", e))?;

    // ── Sentinel Client ──────────────────────────────────────────────
    let sentinel_url = std::env::var("SENTINEL_URL")
        .unwrap_or_else(|_| "http://localhost:9000".to_string());
    let sentinel_config = SentinelConfig::new(&sentinel_url);
    let sentinel_client = SentinelClient::new(sentinel_config)
        .map_err(|e| anyhow::anyhow!("Failed to create Sentinel client: {}", e))?;

    tracing::info!("Sentinel client configured with URL: {}", sentinel_url);

    // ── Domain applications (wired with repos, services) ─────────────
    // For now the applications module is a placeholder. As features are
    // added, each Application struct wraps one or more services and is
    // stored in AppState.
    //
    // Example:
    //   let event_app = Arc::new(EventApplication::new(
    //       Arc::new(EventRepository::new(db_client.clone())),
    //   ));

    // ── Shared state ─────────────────────────────────────────────────
    let state = Arc::new(AppState {
        db_client,
        sentinel_client,
        // event_app,
        // expense_app,
        // payment_app,
        // settlement_app,
    });

    // ── Router ───────────────────────────────────────────────────────
    // Swagger UI is mounted outside the API middleware stack so the
    // ResponseWrapper doesn't JSON-encode the Swagger assets.
    let router = Router::new()
        .merge(SwaggerUi::new("/swagger-ui")
            .url("/api-docs/openapi.json", ApiDoc::openapi()))
        .merge(api_router::build_router(state));

    Ok(router)
}
