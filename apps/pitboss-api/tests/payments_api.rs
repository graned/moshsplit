mod common;

use common::{assert_valid_envelope, get_json, post_json};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

struct TestFixture {
    event_id: String,
    members: Vec<String>,
}

impl TestFixture {
    async fn new(name: &str) -> Self {
        let (_, body) = post_json("/v1/events", &json!({"name": name, "currency": "EUR"})).await;
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
async fn test_create_payment_returns_201() {
    let fix = TestFixture::new(&format!("pay-create {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 5000,
            "currency": "EUR",
            "description": "Paying back for dinner",
            "payment_method": "venmo"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["from_user"], fix.members[0]);
    assert_eq!(data["to_user"], fix.members[1]);
    assert_eq!(data["amount_cents"], 5000);
    assert_eq!(data["currency"], "EUR");
    assert_eq!(data["payment_method"], "venmo");
}

#[tokio::test]
async fn test_get_payment_returns_200() {
    let fix = TestFixture::new(&format!("pay-get {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 2500,
            "currency": "EUR"
        }),
    )
    .await;
    let payment_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = get_json(&format!(
        "/v1/events/{}/payments/{}",
        fix.event_id, payment_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert_eq!(body["data"]["amount_cents"], 2500);
}

#[tokio::test]
async fn test_list_payments_returns_200() {
    let fix = TestFixture::new(&format!("pay-list {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 1000,
            "currency": "EUR"
        }),
    )
    .await;

    let (status, body) = get_json(&format!("/v1/events/{}/payments", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"]["items"].is_array());
    assert!(body["data"]["items"].as_array().unwrap().len() >= 1);
}

#[tokio::test]
async fn test_create_payment_self_payment_fails() {
    let fix = TestFixture::new(&format!("pay-self {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[0],
            "amount_cents": 1000,
            "currency": "EUR"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

// ── Validation Tests ─────────────────────────────────────────────────────

#[tokio::test]
async fn test_create_payment_negative_amount_returns_error() {
    let fix = TestFixture::new(&format!("pay-neg {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": -500,
            "currency": "EUR"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_zero_amount_returns_error() {
    let fix = TestFixture::new(&format!("pay-zero {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": fix.members[1],
            "amount_cents": 0,
            "currency": "EUR"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_from_user_not_member_returns_error() {
    let fix = TestFixture::new(&format!("pay-from-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": non_member,
            "to_user": fix.members[0],
            "amount_cents": 500,
            "currency": "EUR"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_to_user_not_member_returns_error() {
    let fix = TestFixture::new(&format!("pay-to-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "from_user": fix.members[0],
            "to_user": non_member,
            "amount_cents": 500,
            "currency": "EUR"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_list_payments_pagination() {
    let fix = TestFixture::new(&format!("pay-pag {}", Uuid::new_v4())).await;

    // Create multiple payments
    for i in 0..3 {
        post_json(
            &format!("/v1/events/{}/payments", fix.event_id),
            &json!({
                "from_user": fix.members[0],
                "to_user": fix.members[1],
                "amount_cents": 100 + i * 50,
                "currency": "EUR"
            }),
        )
        .await;
    }

    // Test with limit
    let (status, body) = get_json(&format!("/v1/events/{}/payments?limit=2", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"]["items"].as_array().unwrap();
    assert!(items.len() <= 2, "limit param should restrict results");
}
