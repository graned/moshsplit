//! Shared test helpers — HTTP client, envelope assertions, constants.

use reqwest::StatusCode;
use serde_json::Value;

/// Sentinel's standard JSON response envelope fields.
pub const ENVELOPE_FIELDS: &[&str] = &["success", "data", "error", "timestamp", "request_id"];

/// Base URL of the running pitboss-api Docker container.
pub const BASE_URL: &str = "http://localhost";

/// Returns a `reqwest::Client` pre-configured to call the test server.
pub fn test_client() -> reqwest::Client {
    reqwest::Client::builder()
        .build()
        .expect("Failed to build reqwest client")
}

/// Fetch a path and deserialize the JSON body.
pub async fn get_json(path: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}{path}"))
        .send()
        .await
        .expect("HTTP request failed — is the pitboss-api container running?");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// POST JSON body and deserialize the response.
pub async fn post_json(path: &str, body: &Value) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .post(format!("{BASE_URL}{path}"))
        .json(body)
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// POST JSON body with an Authorization: Bearer header and deserialize the response.
pub async fn post_json_with_auth(path: &str, body: &Value, bearer_token: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .post(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .json(body)
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// POST JSON body with an Authorization: Bearer header. Returns the raw
/// `reqwest::Response` (useful when the response is not JSON, e.g. HTML).
pub async fn post_raw_with_auth(path: &str, body: &Value, bearer_token: &str) -> reqwest::Response {
    let client = test_client();
    client
        .post(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .json(body)
        .send()
        .await
        .expect("HTTP request failed")
}

/// GET a path with an Authorization: Bearer header. Returns the raw
/// `reqwest::Response`.
pub async fn get_raw_with_auth(path: &str, bearer_token: &str) -> reqwest::Response {
    let client = test_client();
    client
        .get(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await
        .expect("HTTP request failed")
}

/// PATCH JSON body with an Authorization: Bearer header and deserialize the response.
pub async fn patch_json_with_auth(path: &str, body: &Value, bearer_token: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .patch(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .json(body)
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// DELETE and deserialize the response with an Authorization: Bearer header.
pub async fn delete_json_with_auth(path: &str, bearer_token: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .delete(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    if status == StatusCode::NO_CONTENT {
        return (status, Value::Null);
    }
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// GET JSON with an Authorization: Bearer header and deserialize the response.
pub async fn get_json_with_auth(path: &str, bearer_token: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .get(format!("{BASE_URL}{path}"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// PATCH JSON body and deserialize the response.
pub async fn patch_json(path: &str, body: &Value) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .patch(format!("{BASE_URL}{path}"))
        .json(body)
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// DELETE and deserialize the response. Returns empty Value for 204 responses.
pub async fn delete_json(path: &str) -> (StatusCode, Value) {
    let client = test_client();
    let resp = client
        .delete(format!("{BASE_URL}{path}"))
        .send()
        .await
        .expect("HTTP request failed");

    let status = resp.status();
    // 204 No Content has no body
    if status == StatusCode::NO_CONTENT {
        return (status, Value::Null);
    }
    let body: Value = resp
        .json()
        .await
        .expect("Response body is not valid JSON");
    (status, body)
}

/// Assert the response body matches Sentinel's standard envelope.
pub fn assert_valid_envelope(body: &Value, expected_success: bool) {
    for field in ENVELOPE_FIELDS {
        assert!(
            body.get(field).is_some(),
            "envelope missing field: {field}"
        );
    }

    assert_eq!(body["success"], expected_success, "success mismatch");

    let ts = body["timestamp"]
        .as_str()
        .expect("timestamp should be a string");
    assert!(
        chrono::DateTime::parse_from_rfc3339(ts).is_ok(),
        "timestamp should be valid RFC 3339 / ISO 8601, got: {ts}"
    );

    let rid = body["request_id"]
        .as_str()
        .expect("request_id should be a string");
    let parsed = uuid::Uuid::parse_str(rid);
    assert!(parsed.is_ok(), "request_id should be a valid UUID, got: {rid}");
    assert_eq!(
        parsed.unwrap().get_version(),
        Some(uuid::Version::Random),
        "request_id should be UUIDv4"
    );

    if expected_success {
        assert!(body["error"].is_null(), "error should be null on success");
    } else {
        assert!(body["error"].is_object(), "error should be an object");
        let err = &body["error"];
        assert!(err["code"].is_string(), "error.code should be a string");
        assert!(err["message"].is_string(), "error.message should be a string");
    }
}
