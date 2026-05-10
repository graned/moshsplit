//! System-level handlers — health check, canary, metrics, etc.

use axum::response::IntoResponse;

use crate::infrastructure::http::api::openapi::ApiResponseEnvelope;

/// Simple health-check endpoint.
///
/// The `ResponseWrapperLayer` middleware wraps the returned string
/// into the standard `ApiResponse` envelope:
/// ```json
/// { "success": true, "data": "Okiley Dokiley!", ... }
/// ```
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = ApiResponseEnvelope,
         example = json!({
             "success": true,
             "data": "Okiley Dokiley!",
             "error": null,
             "timestamp": "2026-05-10T12:00:00Z",
             "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
         })),
        (status = 500, description = "Internal server error", body = ApiResponseEnvelope)
    ),
    tag = "System"
)]
pub async fn health_check() -> impl IntoResponse {
    "Okiley Dokiley!"
}

/// Liveness / readiness probe (alias).
#[utoipa::path(
    get,
    path = "/livez",
    responses(
        (status = 200, description = "Service is alive", body = ApiResponseEnvelope,
         example = json!({
             "success": true,
             "data": "Okiley Dokiley!",
             "error": null,
             "timestamp": "2026-05-10T12:00:00Z",
             "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
         })),
    ),
    tag = "System"
)]
pub async fn livez() -> impl IntoResponse {
    "Okiley Dokiley!"
}
