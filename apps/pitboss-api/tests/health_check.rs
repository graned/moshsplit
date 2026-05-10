//! Integration tests for the health-check endpoint.
//!
//! Tests that:
//! 1. `GET /health` returns 200 with the standard envelope
//! 2. `GET /nonexistent` returns 404 with the error envelope
//! 3. Response has `X-Request-Id` header

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt; // for `oneshot`

/// Build a simple test app without database dependencies.
/// This tests the middleware stack in isolation.
fn simple_test_app() -> axum::Router {
    use axum::middleware;
    use axum::routing::get;
    use axum::Router;
    use pitboss_api::infrastructure::http::api::middlewares::request_id_middleware;
    use pitboss_api::infrastructure::http::api::middlewares::response_wrapper;

    Router::new()
        .route("/health", get(|| async { "Okiley Dokiley!" }))
        .route("/livez", get(|| async { "Okiley Dokiley!" }))
        // Apply the same middleware stack as the real app.
        // Innermost (closest to handler):
        .layer(middleware::from_fn(
            response_wrapper::response_wrapper_middleware,
        ))
        // Outermost:
        .layer(middleware::from_fn(
            request_id_middleware::request_id_middleware,
        ))
}

#[tokio::test]
async fn test_health_check_returns_200_with_envelope() {
    let app = simple_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .header("content-type", "application/json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body: Value = serde_json::from_slice(&body_bytes).unwrap();

    // Verify the envelope structure
    assert_eq!(body["success"], true);
    assert_eq!(body["data"], "Okiley Dokiley!");
    assert!(body["error"].is_null());
    assert!(body["timestamp"].is_string());
    assert!(body["request_id"].is_string());
}

#[tokio::test]
async fn test_nonexistent_route_returns_404_with_envelope() {
    let app = simple_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/nonexistent")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Axum's default 404 handler returns 404 with an empty body.
    // The response wrapper middleware should wrap it in the error envelope.
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let body_bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body: Value = serde_json::from_slice(&body_bytes).unwrap();

    // Verify the error envelope structure
    assert_eq!(body["success"], false);
    assert!(body["data"].is_null());
    assert!(body["error"].is_object());
    assert!(body["timestamp"].is_string());
    assert!(body["request_id"].is_string());

    // Error should have a code and message
    assert!(body["error"]["code"].is_string());
    assert!(body["error"]["message"].is_string());
}

#[tokio::test]
async fn test_response_has_x_request_id_header() {
    let app = simple_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert!(response.headers().get("x-request-id").is_some());

    let header_val = response
        .headers()
        .get("x-request-id")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    // Must be a valid UUID
    assert!(uuid::Uuid::parse_str(&header_val).is_ok());
}

#[tokio::test]
async fn test_livez_returns_200() {
    let app = simple_test_app();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/livez")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body: Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn test_request_id_is_stable_across_middleware() {
    // When client sends X-Request-Id, it should be echoed back.
    let app = simple_test_app();
    let custom_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .header("x-request-id", custom_id)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let returned_id = response
        .headers()
        .get("x-request-id")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert_eq!(returned_id, custom_id);
}
