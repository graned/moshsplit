//! Integration tests for the health-check endpoint.
//!
//! These tests make **real HTTP calls** against a running pitboss-api
//! container (expected at `http://localhost:8080`).
//!
//! # Running the tests
//!
//! ```shell
//! # Start the dev stack (in project root):
//! docker compose -f infra/compose/dev.yml up -d
//!
//! # Wait for the container to be healthy, then run:
//! cargo test --package pitboss-api --test health_check
//! ```
//!
//! Tests cover:
//! 1. `GET /health` returns 200 with the Sentinel-style envelope
//! 2. `GET /nonexistent` returns 404 with the error envelope
//! 3. Response has `X-Request-Id` header
//! 4. `GET /livez` endpoint works
//! 5. Request ID passthrough — send `X-Request-Id`, verify it echoes back

mod common;

use common::{assert_valid_envelope, get_json, test_client, BASE_URL};
use reqwest::StatusCode;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_health_check_returns_200_with_envelope() {
    let (status, body) = get_json("/health").await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"], "Okiley Dokiley!", "data mismatch");
}

#[tokio::test]
async fn test_nonexistent_route_returns_404_with_envelope() {
    let (status, body) = get_json("/nonexistent").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_valid_envelope(&body, false);
    assert!(body["data"].is_null(), "data should be null on error");
}

#[tokio::test]
async fn test_response_has_x_request_id_header() {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/health"))
        .send()
        .await
        .expect("HTTP request failed");

    // Header must be present
    let header_val = resp
        .headers()
        .get("x-request-id")
        .expect("X-Request-Id header should be present")
        .to_str()
        .expect("X-Request-Id header should be valid UTF-8")
        .to_string();

    // Must be a valid UUID
    assert!(
        uuid::Uuid::parse_str(&header_val).is_ok(),
        "X-Request-Id should be a valid UUID, got: {header_val}"
    );
}

#[tokio::test]
async fn test_livez_returns_200() {
    let (status, body) = get_json("/livez").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true, "success should be true");
    assert!(body["data"].is_string(), "data should be a string");
}

#[tokio::test]
async fn test_request_id_is_stable_across_middleware() {
    // When client sends X-Request-Id, it should be echoed back.
    let custom_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/health"))
        .header("x-request-id", custom_id)
        .send()
        .await
        .expect("HTTP request failed");

    let returned_id = resp
        .headers()
        .get("x-request-id")
        .expect("X-Request-Id header should be present")
        .to_str()
        .expect("X-Request-Id header should be valid UTF-8")
        .to_string();

    assert_eq!(
        returned_id, custom_id,
        "echoed X-Request-Id should match the sent value"
    );
}
