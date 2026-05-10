//! Middleware that ensures every request has a unique `X-Request-Id`.
//!
//! If the client sends an `X-Request-Id` header, that value is reused;
//! otherwise a new UUID v4 is generated.  The ID is inserted into the
//! request extensions so downstream handlers / services can access it
//! via `RequestId`.

use axum::body::Body;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use tracing::Span;

use super::super::types::RequestId;

/// Middleware function that injects (or reuses) a request ID.
pub async fn request_id_middleware(mut request: Request<Body>, next: Next) -> Response {
    // 1. Try to extract from the incoming header, otherwise generate.
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .map(RequestId)
        .unwrap_or_else(|| RequestId::new());

    // 2. Insert into extensions for downstream consumption.
    request.extensions_mut().insert(request_id.clone());

    // 3. Also insert into the tracing span for log correlation.
    Span::current().record("request_id", tracing::field::display(&request_id));

    // 4. Run the inner service.
    let mut response = next.run(request).await;

    // 5. Stamp the response header.
    response.headers_mut().insert(
        axum::http::header::HeaderName::from_static("x-request-id"),
        axum::http::HeaderValue::from_str(&request_id.to_string()).unwrap(),
    );

    response
}
