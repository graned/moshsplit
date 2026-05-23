//! Integration tests for external-facing API endpoints.
//!
//! Tests cover:
//!   1. External Login (POST /v1/auth/external-login)
//!   2. External Balance Summary (POST /v1/balances/external-summary)
//!   3. Dual Swagger Docs (/docs/internal, /docs/external,
//!      /api-docs/internal/openapi.json, /api-docs/external/openapi.json)
//!
//! All tests make **real HTTP calls** against a running pitboss-api
//! container (expected at `http://localhost:8080`).
//!
//! # Run
//!
//! ```shell
//! cargo test --package pitboss-api --test external_api
//! ```

mod common;

use common::{
    assert_valid_envelope, get_json, post_json, post_json_with_auth, test_client, BASE_URL,
};
use reqwest::StatusCode;
use serde_json::json;

// ---------------------------------------------------------------------------
// Constants — matching seed data in the running container
// ---------------------------------------------------------------------------

/// Valid external API token configured in the Sentinel auth service.
const VALID_API_TOKEN: &str =
    "sat_e91974dac53da17dd64b0d1bef35049542bd21ffbae0bc68cc7620ce32e5f936";

/// Email of a known seed user.
const KNOWN_EMAIL: &str = "anayamaster@gmail.com";

/// A token that is guaranteed to be rejected by Sentinel.
const INVALID_API_TOKEN: &str = "sat_invalid_token_that_should_fail";

/// A Bearer token that is guaranteed to be rejected by the auth middleware.
const INVALID_BEARER_TOKEN: &str = "invalid_bearer_token_xyz";

/// Email that should not exist in the auth database.
const UNKNOWN_EMAIL: &str = "nonexistent@example.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Perform an external login and return the `access_token`.
///
/// Used as a pre-condition for tests that need a valid Bearer token.
async fn login_and_get_token() -> String {
    let (status, body) = post_json(
        "/v1/auth/external-login",
        &json!({
            "api_token": VALID_API_TOKEN,
            "email": KNOWN_EMAIL,
            "display_name": "Eduardo Anaya",
        }),
    )
    .await;

    assert_eq!(
        status,
        StatusCode::OK,
        "external-login setup call failed — is Sentinel running?"
    );
    assert_valid_envelope(&body, true);

    body["data"]["access_token"]
        .as_str()
        .expect("access_token should be a non-empty string in the response")
        .to_string()
}

/// Perform an external login and return both `bearer_token` and `user_id`.
async fn login_and_get_credentials() -> (String, String) {
    let (status, body) = post_json(
        "/v1/auth/external-login",
        &json!({
            "api_token": VALID_API_TOKEN,
            "email": KNOWN_EMAIL,
            "display_name": "Eduardo Anaya",
        }),
    )
    .await;

    assert_eq!(
        status,
        StatusCode::OK,
        "external-login setup call failed — is Sentinel running?"
    );
    assert_valid_envelope(&body, true);

    let token = body["data"]["access_token"]
        .as_str()
        .expect("access_token should be present")
        .to_string();
    let user_id = body["data"]["user_id"]
        .as_str()
        .expect("user_id should be present")
        .to_string();

    (token, user_id)
}

/// Fetch the list of events the authenticated user belongs to.
async fn get_events(bearer_token: &str) -> Vec<serde_json::Value> {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/v1/events"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await
        .expect("HTTP request failed — is the pitboss-api container running?");

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");

    assert_eq!(status, StatusCode::OK, "list-events setup call failed");
    assert_valid_envelope(&body, true);

    body["data"]["items"]
        .as_array()
        .expect("data.items should be an array")
        .clone()
}

/// Fetch the list of members in an event.
async fn get_members(event_id: &str, bearer_token: &str) -> Vec<serde_json::Value> {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/v1/events/{event_id}/members"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");

    assert_eq!(status, StatusCode::OK, "list-members setup call failed");
    assert_valid_envelope(&body, true);

    body["data"]
        .as_array()
        .expect("data should be an array of members")
        .clone()
}

/// Create an expense in the given event, split equally among the given participants.
async fn create_expense(
    event_id: &str,
    paid_by: &str,
    participants: &[&str],
    bearer_token: &str,
) {
    let (status, body) = post_json_with_auth(
        &format!("/v1/events/{event_id}/expenses"),
        &json!({
            "title": "E2E test expense — external summary",
            "amount_cents": 1000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": { "shares": participants },
        }),
        bearer_token,
    )
    .await;

    assert_eq!(status, StatusCode::CREATED, "create-expense setup call failed");
    assert_valid_envelope(&body, true);
}

// ===========================================================================
// 1. External Login — POST /v1/auth/external-login
// ===========================================================================

#[tokio::test]
async fn test_external_login_success() {
    let (status, body) = post_json(
        "/v1/auth/external-login",
        &json!({
            "api_token": VALID_API_TOKEN,
            "email": KNOWN_EMAIL,
            "display_name": "Eduardo Anaya",
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert!(
        data["user_id"].as_str().unwrap_or("").len() > 0,
        "data.user_id should be present and non-empty"
    );
    assert!(
        data["access_token"].as_str().unwrap_or("").len() > 0,
        "data.access_token should be present and non-empty"
    );
    assert!(
        data["refresh_token"].as_str().unwrap_or("").len() > 0,
        "data.refresh_token should be present and non-empty"
    );
    assert!(
        data["expires_at"].as_str().unwrap_or("").len() > 0,
        "data.expires_at should be present and non-empty"
    );
    assert_eq!(
        data["email_verified"], true,
        "data.email_verified should be true"
    );
}

#[tokio::test]
async fn test_external_login_missing_email() {
    // Omit the `email` field entirely — Axum's Json extractor rejects the
    // request because `email` is a required field in `ExternalLoginRequest`.
    let (status, body) = post_json(
        "/v1/auth/external-login",
        &json!({
            "api_token": VALID_API_TOKEN,
            "display_name": "Test",
        }),
    )
    .await;

    // Axum 0.8 returns 422 for Json deserialization failures.
    // The response wrapper middleware wraps the error in the standard envelope.
    assert!(
        status == StatusCode::UNPROCESSABLE_ENTITY
            || status == StatusCode::BAD_REQUEST,
        "expected 422 or 400 for missing email, got: {status}"
    );
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_external_login_invalid_api_token() {
    let (status, body) = post_json(
        "/v1/auth/external-login",
        &json!({
            "api_token": INVALID_API_TOKEN,
            "email": KNOWN_EMAIL,
            "display_name": "Test",
        }),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_valid_envelope(&body, false);
}

// ===========================================================================
// 2. External Balance Summary — POST /v1/balances/external-summary
// ===========================================================================

#[tokio::test]
async fn test_external_summary_valid_token_and_known_email() {
    // ── Setup: seed an expense for the known user ──────────────────────
    let (bearer_token, user_id) = login_and_get_credentials().await;
    let events = get_events(&bearer_token).await;

    assert!(
        !events.is_empty(),
        "known user should belong to at least one event"
    );
    let event_id = events[0]["id"]
        .as_str()
        .expect("event should have an id");

    // Fetch event members — we need a second participant so the expense
    // balance for the payer is non-zero.
    let members = get_members(event_id, &bearer_token).await;
    assert!(
        members.len() >= 2,
        "expected at least 2 members in the event for a valid split"
    );
    let other_member_id = members
        .iter()
        .find(|m| m["user_id"].as_str() != Some(&user_id))
        .expect("should find another member besides the payer")["user_id"]
        .as_str()
        .expect("user_id should be a string")
        .to_string();

    // Create an expense where the known user pays, split between both members
    let participants = &[user_id.as_str(), other_member_id.as_str()];
    create_expense(event_id, &user_id, participants, &bearer_token).await;

    // ── Exercise: call external-summary for the known email ────────────
    let (status, body) = post_json_with_auth(
        "/v1/balances/external-summary",
        &json!({ "email": KNOWN_EMAIL }),
        &bearer_token,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert!(
        data["event_name"].is_string(),
        "data.event_name should be a string, got: {:?}",
        data["event_name"]
    );
    assert!(
        data["total_balance_cents"].is_i64(),
        "data.total_balance_cents should be an integer"
    );
    assert!(
        data["items"].is_array(),
        "data.items should be an array"
    );

    // Items should contain the expense we just created
    let items = data["items"]
        .as_array()
        .expect("items should be an array");
    assert!(!items.is_empty(), "items should not be empty");

    for item in items {
        assert!(
            item["title"].is_string(),
            "each item should have a title string"
        );
        assert!(
            item["amount_cents"].is_i64(),
            "each item should have amount_cents integer"
        );
    }

    // Verify the total is non-zero (our expense of 1000, user paid it all)
    let total = data["total_balance_cents"].as_i64().unwrap_or(0);
    assert!(total > 0, "total_balance_cents should be positive");
}

#[tokio::test]
async fn test_external_summary_invalid_bearer_token() {
    let (status, body) = post_json_with_auth(
        "/v1/balances/external-summary",
        &json!({ "email": KNOWN_EMAIL }),
        INVALID_BEARER_TOKEN,
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_external_summary_unknown_email() {
    let (bearer_token, _user_id) = login_and_get_credentials().await;

    let (status, body) = post_json_with_auth(
        "/v1/balances/external-summary",
        &json!({ "email": UNKNOWN_EMAIL }),
        &bearer_token,
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_valid_envelope(&body, false);
}

// ===========================================================================
// 3. Dual Swagger Docs
// ===========================================================================

#[tokio::test]
async fn test_swagger_ui_internal_returns_200() {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/docs/internal"))
        .send()
        .await
        .expect("HTTP request failed");

    assert_eq!(resp.status(), StatusCode::OK);

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        content_type.contains("text/html"),
        "expected text/html content-type, got: {content_type}"
    );

    let text = resp
        .text()
        .await
        .expect("Failed to read response body");
    assert!(
        text.contains("Swagger UI"),
        "response should contain 'Swagger UI' in the HTML"
    );
}

#[tokio::test]
async fn test_swagger_ui_external_returns_200() {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}/docs/external"))
        .send()
        .await
        .expect("HTTP request failed");

    assert_eq!(resp.status(), StatusCode::OK);

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        content_type.contains("text/html"),
        "expected text/html content-type, got: {content_type}"
    );

    let text = resp
        .text()
        .await
        .expect("Failed to read response body");
    assert!(
        text.contains("Swagger UI"),
        "response should contain 'Swagger UI' in the HTML"
    );
}

#[tokio::test]
async fn test_internal_openapi_json_has_paths() {
    let (status, body) = get_json("/api-docs/internal/openapi.json").await;

    assert_eq!(status, StatusCode::OK);
    assert!(
        body.get("openapi").is_some(),
        "response should contain 'openapi' field"
    );
    assert!(
        body.get("paths").is_some(),
        "response should contain 'paths' field"
    );

    let paths = body["paths"].as_object().expect("paths should be an object");
    assert!(
        paths.len() > 0,
        "internal OpenAPI should have at least one path entry"
    );
}

#[tokio::test]
async fn test_external_openapi_json_has_only_external_paths() {
    let (status, body) = get_json("/api-docs/external/openapi.json").await;

    assert_eq!(status, StatusCode::OK);
    assert!(
        body.get("openapi").is_some(),
        "response should contain 'openapi' field"
    );

    let paths = body["paths"]
        .as_object()
        .expect("paths should be an object");

    assert_eq!(
        paths.len(),
        2,
        "external OpenAPI should have exactly 2 paths, got {}: {:?}",
        paths.len(),
        paths.keys().collect::<Vec<_>>()
    );

    assert!(
        paths.contains_key("/v1/auth/external-login"),
        "should contain /v1/auth/external-login path"
    );
    assert!(
        paths.contains_key("/v1/balances/external-summary"),
        "should contain /v1/balances/external-summary path"
    );
}
