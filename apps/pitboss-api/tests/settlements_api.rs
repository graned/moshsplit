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

// ── New Settle Page Endpoint Tests ─────────────────────────────────────────

/// Helper to create an event with 2 members and an expense where m0 paid and m1 owes.
async fn settle_test_fixture(event_name: &str) -> TestFixture {
    let fix = TestFixture::new(event_name).await;

    post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "Dinner",
            "amount_cents": 2000,
            "paid_by": fix.members[0],
            "splits": [
                {"user_id": fix.members[0], "share_cents": 1000},
                {"user_id": fix.members[1], "share_cents": 1000}
            ]
        }),
    )
    .await;

    fix
}

#[tokio::test]
async fn test_incoming_balances_returns_200() {
    let fix = settle_test_fixture(&format!("inc-bal {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/incoming",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["items"].is_array());
    assert!(data["total_cents"].is_number());
}

#[tokio::test]
async fn test_outgoing_balances_returns_200() {
    let fix = settle_test_fixture(&format!("out-bal {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/outgoing",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["items"].is_array());
    assert!(data["total_cents"].is_number());
}

#[tokio::test]
async fn test_settlement_requests_returns_200() {
    let fix = TestFixture::new(&format!("req-list {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 500
        }),
    )
    .await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/requests",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["items"].is_array());
    assert!(data["pagination"].is_object());
}

#[tokio::test]
async fn test_settlement_history_empty_for_new_event() {
    let fix = TestFixture::new(&format!("hist-empty {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/history",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert!(data["items"].is_array());
    let items = data["items"].as_array().unwrap();
    assert_eq!(items.len(), 0, "new event should have no settlement history");
}

#[tokio::test]
async fn test_settlement_requests_pagination() {
    let fix = TestFixture::new(&format!("req-pag {}", Uuid::new_v4())).await;

    for i in 0..3 {
        post_json(
            &format!("/v1/events/{}/settlements", fix.event_id),
            &json!({
                "from_user": fix.members[0],
                "to_user": fix.members[1],
                "amount_cents": 100 + i * 100,
                "note": format!("Settlement {}", i)
            }),
        )
        .await;
    }

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/requests?limit=2",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"]["items"].as_array().unwrap();
    assert!(items.len() <= 2);
    assert!(body["data"]["pagination"]["has_more"].as_bool().is_some());
}

#[tokio::test]
async fn test_settlement_history_with_confirmed_settlement() {
    let fix = TestFixture::new(&format!("hist-conf {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/settlements", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 500,
            "note": "Paid via bank transfer"
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
        "/v1/events/{}/settlements/history",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "confirmed settlement should appear in history");
    let item = &items[0];
    assert!(item["id"].is_string());
    assert!(item["is_outgoing"].is_boolean());
    assert!(item["counterparty_id"].is_string());
    assert!(item["amount_cents"].is_number());
    assert!(item["created_at"].is_string());
    assert!(item["note"].is_string());
}

#[tokio::test]
async fn test_incoming_balances_with_expense() {
    let fix = settle_test_fixture(&format!("inc-exp {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/incoming",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    let items = data["items"].as_array().unwrap();
    let total = data["total_cents"].as_i64().unwrap();

    if !items.is_empty() {
        assert!(total > 0, "incoming total should be positive");
        for item in items {
            assert!(item["user_id"].is_string());
            assert!(item["amount_cents"].as_i64().unwrap() > 0);
        }
    }
}

#[tokio::test]
async fn test_outgoing_balances_with_expense() {
    let fix = settle_test_fixture(&format!("out-exp {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/settlements/outgoing",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    let items = data["items"].as_array().unwrap();
    let total = data["total_cents"].as_i64().unwrap();

    if !items.is_empty() {
        assert!(total > 0, "outgoing total should be positive");
        for item in items {
            assert!(item["user_id"].is_string());
            assert!(item["amount_cents"].as_i64().unwrap() > 0);
        }
    }
}
