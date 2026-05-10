//! Dedicated test for the Sentinel-compatible JSON response envelope.
//!
//! This file validates the full envelope shape — all five fields are
//! required, no extra top-level fields leak, and every field conforms
//! to its expected type/format.

mod common;

use common::{assert_valid_envelope, get_json, ENVELOPE_FIELDS};
use reqwest::StatusCode;

#[tokio::test]
async fn test_envelope_structure_is_identical_to_sentinel() {
    let (status, body) = get_json("/health").await;

    assert_eq!(status, StatusCode::OK);

    // 1. Exact top-level fields — no more, no fewer
    let top_keys: std::collections::BTreeSet<&str> =
        body.as_object().unwrap().keys().map(|k| k.as_str()).collect();
    let expected: std::collections::BTreeSet<&str> =
        ENVELOPE_FIELDS.iter().copied().collect();
    assert_eq!(
        top_keys, expected,
        "envelope should contain exactly {expected:?}, got {top_keys:?}"
    );

    // 2. data must be non-null on success
    assert!(
        body["data"].is_string(),
        "data should be present and non-null on success"
    );

    // 3. error is always null on success
    assert!(body["error"].is_null());

    // 4. timestamp is RFC 3339 with timezone (Z suffix or offset)
    let ts = body["timestamp"].as_str().unwrap();
    let parsed = chrono::DateTime::parse_from_rfc3339(ts);
    assert!(parsed.is_ok(), "timestamp must be RFC 3339, got: {ts}");

    // 5. request_id is a UUIDv4
    let rid = body["request_id"].as_str().unwrap();
    let uuid = uuid::Uuid::parse_str(rid).unwrap();
    assert_eq!(uuid.get_version(), Some(uuid::Version::Random));

    // 6. Reuse shared envelope assertions as a baseline
    assert_valid_envelope(&body, true);
}

#[tokio::test]
async fn test_error_envelope_has_exact_fields() {
    let (status, body) = get_json("/nonexistent").await;

    assert_eq!(status, StatusCode::NOT_FOUND);

    let top_keys: std::collections::BTreeSet<&str> =
        body.as_object().unwrap().keys().map(|k| k.as_str()).collect();
    let expected: std::collections::BTreeSet<&str> =
        ENVELOPE_FIELDS.iter().copied().collect();
    assert_eq!(
        top_keys, expected,
        "error envelope should contain exactly {expected:?}, got {top_keys:?}"
    );

    assert!(body["data"].is_null(), "data should be null on error");
    assert_valid_envelope(&body, false);

    let err = &body["error"];
    assert!(err["code"].is_string());
    assert!(err["message"].is_string());
}
