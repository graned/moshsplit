mod common;

use common::{
    assert_valid_envelope, get_json, patch_json, post_json,
};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

struct TestFixture {
    event_id: String,
    members: Vec<String>,
}

impl TestFixture {
    async fn new(name: &str) -> Self {
        let (_, body) = post_json(
            "/v1/events",
            &json!({"name": name, "currency": "EUR"}),
        )
        .await;
        let event_id = body["data"]["id"].as_str().unwrap().to_string();

        let mut members = Vec::new();
        for _ in 0..2 {
            let uid = Uuid::new_v4().to_string();
            post_json(
                &format!("/v1/events/{event_id}/members"),
                &json!({"user_id": uid}),
            )
            .await;
            members.push(uid);
        }

        Self { event_id, members }
    }
}

#[tokio::test]
async fn test_create_settlement_returns_201() {
    let fix = TestFixture::new(&format!("sett-create {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 3000
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["from_user"], fix.members[0]);
    assert_eq!(data["to_user"], fix.members[1]);
    assert_eq!(data["amount_cents"], 3000);
    assert_eq!(data["status"], "pending");
}

#[tokio::test]
async fn test_get_settlement_returns_200() {
    let fix = TestFixture::new(&format!("sett-get {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 1500
        }),
    )
    .await;
    let settlement_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) =
        get_json(&format!("/v1/events/{}/settlements/{}", fix.event_id, settlement_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["amount_cents"], 1500);
    assert_eq!(body["data"]["status"], "pending");
}

#[tokio::test]
async fn test_list_settlements_returns_200() {
    let fix = TestFixture::new(&format!("sett-list {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 2000
        }),
    )
    .await;

    let (status, body) =
        get_json(&format!("/v1/events/{}/settlements", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"]["items"].is_array());
}

#[tokio::test]
async fn test_update_settlement_status_to_confirmed() {
    let fix = TestFixture::new(&format!("sett-conf {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 4000
        }),
    )
    .await;
    let settlement_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = patch_json(
        &format!("/v1/events/{}/settlements/{}", fix.event_id, settlement_id),
        &json!({"status": "confirmed"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["status"], "confirmed");
}

#[tokio::test]
async fn test_update_settlement_status_to_disputed() {
    let fix = TestFixture::new(&format!("sett-disp {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 1000
        }),
    )
    .await;
    let settlement_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = patch_json(
        &format!("/v1/events/{}/settlements/{}", fix.event_id, settlement_id),
        &json!({"status": "disputed"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["status"], "disputed");
}

#[tokio::test]
async fn test_list_settlements_filtered_by_status() {
    let fix = TestFixture::new(&format!("sett-filter {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 5000
        }),
    )
    .await;
    let settlement_id = create_body["data"]["id"].as_str().unwrap().to_string();

    patch_json(
        &format!("/v1/events/{}/settlements/{}", fix.event_id, settlement_id),
        &json!({"status": "confirmed"}),
    )
    .await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements?status=confirmed",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    for item in body["data"]["items"].as_array().unwrap() {
        assert_eq!(item["status"], "confirmed");
    }
}

// ── Validation Tests ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_create_settlement_negative_amount_returns_error() {
    let fix = TestFixture::new(&format!("sett-neg {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": -1000
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_settlement_zero_amount_returns_error() {
    let fix = TestFixture::new(&format!("sett-zero {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 0
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_settlement_from_not_member_returns_error() {
    let fix = TestFixture::new(&format!("sett-from-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": non_member,
            "to_user": fix.members[0],
            "amount_cents": 500
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_settlement_to_not_member_returns_error() {
    let fix = TestFixture::new(&format!("sett-to-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": non_member,
            "amount_cents": 500
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_update_settlement_invalid_status_returns_error() {
    let fix = TestFixture::new(&format!("sett-bad-status {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 1000
        }),
    )
    .await;
    let settlement_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = patch_json(
        &format!("/v1/events/{}/settlements/{}", fix.event_id, settlement_id),
        &json!({"status": "invalid_status"}),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_list_settlements_pagination() {
    let fix = TestFixture::new(&format!("sett-pag {}", Uuid::new_v4())).await;

    // Create multiple settlements
    for i in 0..3 {
        post_json(
            &format!("/v1/events/{}/settlements", fix.event_id),
            &json!({
                "from_user": fix.members[0],
                "to_user": fix.members[1],
                "amount_cents": 100 + i * 100
            }),
        )
        .await;
    }

    // Test with limit
    let (status, body) =
        get_json(&format!("/v1/events/{}/settlements?limit=2", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"]["items"].as_array().unwrap();
    assert!(items.len() <= 2, "limit param should restrict results");
}
