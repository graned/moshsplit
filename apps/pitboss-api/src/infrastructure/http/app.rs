//! Application factory — `build_app()`.
//!
//! Single entry point for constructing the fully-wired Axum Router with
//! all infrastructure, state, and middleware.

use std::sync::Arc;

use axum::Router;
use sentinel_client::{SentinelClient, SentinelConfig};

use crate::infrastructure::clients::{DbClient, SentinelAuthClient};
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

    // ── Sentinel Auth Client (for reading users from sentinel_auth DB) ─
    // Extract base URL from database_url and replace db name with sentinel_auth
    let sentinel_auth_url = format!(
        "postgres://{}@postgres:5432/sentinel_auth",
        database_url.split('@').last().unwrap_or("").split('/').next().unwrap_or("postgres:password")
    );
    // Use simpler approach - parse the original URL
    let auth_db_url = if database_url.contains("@") {
        let parts: Vec<&str> = database_url.split('@').collect();
        let creds = parts.get(0).unwrap_or(&"postgres:password");
        format!("{}@postgres:5432/sentinel_auth", creds)
    } else {
        "postgres://postgres:password@postgres:5432/sentinel_auth".to_string()
    };
    
    let sentinel_auth_client = SentinelAuthClient::new(&auth_db_url)
        .map_err(|e| anyhow::anyhow!("Failed to connect to sentinel_auth: {}", e))?;

    tracing::info!("Sentinel auth client configured");

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
        sentinel_auth_client,
        // event_app,
        // expense_app,
        // payment_app,
        // settlement_app,
    });

    // ── Router ───────────────────────────────────────────────────────
    let router = Router::new().merge(api_router::build_router(state));

    Ok(router)
}
