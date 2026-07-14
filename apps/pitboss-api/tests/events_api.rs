mod common;

use common::{assert_valid_envelope, delete_json, get_json, patch_json, post_json};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

fn unique_event_name() -> String {
    format!("Test Event {}", Uuid::new_v4())
}

#[tokio::test]
async fn test_create_event_returns_201() {
    let name = unique_event_name();
    let (status, body) = post_json(
        "/v1/events",
        &json!({"name": name, "description": "Integration test event", "currency": "EUR"}),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["name"], name);
    assert_eq!(data["description"], "Integration test event");
    assert_eq!(data["currency"], "EUR");
    assert_eq!(data["status"], "active");
    assert!(data["member_count"].as_i64().unwrap_or(0) >= 1);
    assert!(data["id"].as_str().unwrap().len() > 0);
}

#[tokio::test]
async fn test_create_event_defaults_currency() {
    let name = unique_event_name();
    let (status, body) = post_json("/v1/events", &json!({"name": name})).await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    // API defaults to EUR
    assert_eq!(body["data"]["currency"], "EUR");
}

#[tokio::test]
async fn test_create_event_empty_name_returns_error() {
    let (status, body) = post_json("/v1/events", &json!({"name": ""})).await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_get_event_returns_200() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = get_json(&format!("/v1/events/{event_id}")).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["name"], name);
    assert!(body["data"]["member_count"].as_i64().unwrap_or(0) >= 1);
}

#[tokio::test]
async fn test_get_nonexistent_event_returns_404() {
    let fake_id = Uuid::new_v4();
    let (status, body) = get_json(&format!("/v1/events/{fake_id}")).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_list_events_returns_200() {
    let (status, body) = get_json("/v1/events").await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"]["items"].is_array());
}

#[tokio::test]
async fn test_update_event_returns_200() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let new_name = format!("Updated {name}");

    let (status, body) = patch_json(
        &format!("/v1/events/{event_id}"),
        &json!({"name": new_name, "description": "Updated description"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["name"], new_name);
    assert_eq!(body["data"]["description"], "Updated description");
}

#[tokio::test]
async fn test_delete_event_archives_it() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, _body) = delete_json(&format!("/v1/events/{event_id}")).await;

    // DELETE returns 204 No Content
    assert_eq!(status, StatusCode::NO_CONTENT);

    let (get_status, get_body) = get_json(&format!("/v1/events/{event_id}")).await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(get_body["data"]["status"], "deleted");
}

// ── Members ──────────────────────────────────────────────────────────

#[tokio::test]
async fn test_add_member_returns_201() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let user_id = Uuid::new_v4();

    let (status, body) = post_json(
        &format!("/v1/events/{event_id}/members"),
        &json!({"user_id": user_id}),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["user_id"], user_id.to_string());
    assert_eq!(body["data"]["role"], "member");
}

#[tokio::test]
async fn test_list_members_returns_200() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let user_id = Uuid::new_v4();

    post_json(
        &format!("/v1/events/{event_id}/members"),
        &json!({"user_id": user_id}),
    )
    .await;

    let (status, body) = get_json(&format!("/v1/events/{event_id}/members")).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let members = &body["data"];
    assert!(members.as_array().unwrap().len() >= 2);
}

#[tokio::test]
async fn test_remove_member_returns_200() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let user_id = Uuid::new_v4();

    post_json(
        &format!("/v1/events/{event_id}/members"),
        &json!({"user_id": user_id}),
    )
    .await;

    let (status, _body) = delete_json(&format!("/v1/events/{event_id}/members/{user_id}")).await;

    // DELETE returns 204 No Content
    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_remove_nonexistent_member_returns_error() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let fake_user = Uuid::new_v4();

    let (status, body) = delete_json(&format!("/v1/events/{event_id}/members/{fake_user}")).await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

// ── Invalid Input Tests ─────────────────────────────────────────────────

#[tokio::test]
async fn test_get_event_invalid_uuid_returns_400() {
    let (status, body) = get_json("/v1/events/not-a-uuid").await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_valid_envelope(&body, false);
}

// Note: created_by is extracted from X-User-Id header, not request body
// This test is removed as the field doesn't exist in CreateEventRequest

#[tokio::test]
async fn test_add_member_invalid_user_id_returns_error() {
    let name = unique_event_name();
    let (_, create_body) = post_json("/v1/events", &json!({"name": name})).await;
    let event_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{event_id}/members"),
        &json!({"user_id": "not-a-valid-uuid"}),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_list_members_with_invalid_event_uuid_returns_400() {
    let (status, body) = get_json("/v1/events/invalid-uuid/members").await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_valid_envelope(&body, false);
}
