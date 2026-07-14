//! Middleware that wraps every handler response in the standard
//! `ApiResponse<T>` JSON envelope.
//!
//! - Success (2xx): the response body becomes `data` in the envelope.
//! - Error (4xx/5xx): the response body is placed into the `error` field.
//!
//! In both cases the `X-Request-Id` header is forwarded from the
//! request, and `timestamp` is set to the response time.

use axum::body::Body;
use axum::http::{HeaderName, HeaderValue, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use http_body_util::BodyExt;
use serde_json::Value;

use super::super::types::{ApiResponse, RequestId};

pub async fn response_wrapper_middleware(request: Request<Body>, next: Next) -> Response {
    // Extract request_id from extensions (set by request_id_middleware).
    let request_id = request
        .extensions()
        .get::<RequestId>()
        .cloned()
        .unwrap_or_else(RequestId::new);

    // Run the inner service.
    let response = next.run(request).await;

    // Decompose the response into status, headers, and body.
    let (mut parts, body) = response.into_parts();
    let status = parts.status;
    let timestamp = Utc::now();

    // Collect the full response body as bytes.
    let body_bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(_) => {
            // If we cannot read the body, return a 500 error.
            let err = ApiResponse::<()>::error(
                "INTERNAL_ERROR".into(),
                "Failed to read response body".into(),
                request_id,
                timestamp,
            );
            return (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(err)).into_response();
        }
    };

    let envelope_body = if status.is_success() {
        // ── Success path ──────────────────────────────────────────────
        // Try to parse the body as JSON; fall back to wrapping the raw
        // string representation.
        let data: Value = serde_json::from_slice(&body_bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&body_bytes).into_owned()));

        let envelope = ApiResponse {
            success: true,
            data: Some(data),
            error: None,
            timestamp,
            request_id: request_id.clone(),
        };
        serde_json::to_vec(&envelope).unwrap_or_else(|_| {
            // If serialization itself fails, fall back to a minimal envelope.
            format!(
                r#"{{"success":true,"data":null,"error":null,"timestamp":"{}","request_id":"{}"}}"#,
                timestamp.to_rfc3339(),
                request_id
            )
            .into_bytes()
        })
    } else {
        // ── Error path ────────────────────────────────────────────────
        // The body may already be JSON (e.g. from ApiError::into_response)
        // or a plain string (from Axum's default 404/500 handlers).
        let error_message = String::from_utf8_lossy(&body_bytes).into_owned();

        // Try to extract a structured error from JSON body.
        let api_error = if let Ok(json) = serde_json::from_slice::<Value>(&body_bytes) {
            let code = json
                .get("code")
                .and_then(|c| c.as_str())
                .unwrap_or(status.as_str())
                .to_string();
            let message = json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or(&error_message)
                .to_string();
            crate::errors::ApiError::new(code, message, status)
        } else {
            let reason = status.canonical_reason().unwrap_or("Unknown").to_string();
            crate::errors::ApiError::new(
                status.as_str().to_string(),
                if error_message.is_empty() {
                    reason
                } else {
                    error_message
                },
                status,
            )
        };

        let envelope = ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(api_error),
            timestamp,
            request_id: request_id.clone(),
        };
        serde_json::to_vec(&envelope).unwrap_or_default()
    };

    // Set content-type and request-id header.
    parts.headers.insert(
        HeaderName::from_static("content-type"),
        HeaderValue::from_static("application/json"),
    );
    parts.headers.insert(
        HeaderName::from_static("x-request-id"),
        HeaderValue::from_str(&request_id.to_string()).unwrap(),
    );

    Response::from_parts(parts, Body::from(envelope_body))
}
