//! Shared API types — response envelope, request ID, pagination.

use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::errors::ApiError;

// ── RequestId ─────────────────────────────────────────────────────────────────

/// A unique identifier for each request, used for tracing and correlation.
#[derive(Debug, Clone, Serialize)]
pub struct RequestId(pub uuid::Uuid);

impl RequestId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4())
    }

    /// Attempt to extract the current request ID from the task-local or
    /// generate a new one.  In practice the middleware sets this as an
    /// extension; this is a fallback.
    pub fn current() -> Self {
        Self::new()
    }
}

impl Default for RequestId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for RequestId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ── ApiResponse ───────────────────────────────────────────────────────────────

/// Standard JSON envelope for every API response.
///
/// ```json
/// {
///   "success": true,
///   "data": { ... },
///   "error": null,
///   "timestamp": "2026-05-10T10:00:00.000Z",
///   "request_id": "uuid"
/// }
/// ```
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub timestamp: DateTime<Utc>,
    pub request_id: RequestId,
}

impl<T: Serialize> ApiResponse<T> {
    /// Build a success envelope.
    pub fn success(data: T, request_id: RequestId, timestamp: DateTime<Utc>) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp,
            request_id,
        }
    }

    /// Build an error envelope.
    pub fn error(
        code: String,
        message: String,
        request_id: RequestId,
        timestamp: DateTime<Utc>,
    ) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(ApiError::new(
                code,
                message,
                StatusCode::INTERNAL_SERVER_ERROR,
            )),
            timestamp,
            request_id,
        }
    }

    /// Build an error envelope from a structured ApiError.
    pub fn error_raw(error: ApiError, request_id: RequestId) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            timestamp: Utc::now(),
            request_id,
        }
    }
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status = self
            .error
            .as_ref()
            .map(|e| e.status)
            .unwrap_or(StatusCode::OK);

        let mut response = Json(self).into_response();
        *response.status_mut() = status;
        response.headers_mut().insert(
            HeaderName::from_static("x-request-id"),
            HeaderValue::from_str(&uuid::Uuid::new_v4().to_string()).unwrap(),
        );
        response
    }
}

// ── Pagination (stub for future use) ───────────────────────────────────────────

/// Pagination metadata included in the envelope's `meta` field.
#[derive(Debug, Serialize)]
pub struct PaginationMeta {
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub limit: u32,
}
