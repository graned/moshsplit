//! System-level handlers — health check, canary, metrics, etc.

use axum::response::IntoResponse;

/// Simple health-check endpoint.
///
/// The `ResponseWrapperLayer` middleware wraps the returned string
/// into the standard `ApiResponse` envelope:
/// ```json
/// { "success": true, "data": "Okiley Dokiley!", ... }
/// ```
pub async fn health_check() -> impl IntoResponse {
    "Okiley Dokiley!"
}

/// Liveness / readiness probe (alias).
pub async fn livez() -> impl IntoResponse {
    "Okiley Dokiley!"
}
