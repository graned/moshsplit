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
        for _ in 0..3 {
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
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 5000,
            "reason": "Dinner split"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    assert_eq!(data["creditor_id"], fix.members[0]);
    assert_eq!(data["debtor_id"], fix.members[1]);
    assert_eq!(data["amount_cents"], 5000);
    assert_eq!(data["amount_paid_cents"], 0);
    assert_eq!(data["status"], "open");
    assert_eq!(data["reason"], "Dinner split");
}

#[tokio::test]
async fn test_get_payment_returns_200() {
    let fix = TestFixture::new(&format!("pay-get {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 2500,
            "reason": "Drinks"
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
    assert_eq!(body["data"]["reason"], "Drinks");
}

#[tokio::test]
async fn test_list_payments_returns_200() {
    let fix = TestFixture::new(&format!("pay-list {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 1000,
            "reason": "Taxi"
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
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[0],
            "amount_cents": 1000,
            "reason": "Self"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_negative_amount_returns_error() {
    let fix = TestFixture::new(&format!("pay-neg {}", Uuid::new_v4())).await;

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": -500,
            "reason": "Negative"
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
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 0,
            "reason": "Zero"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_creditor_not_member_returns_error() {
    let fix = TestFixture::new(&format!("pay-cred-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": non_member,
            "debtor_id": fix.members[0],
            "amount_cents": 500,
            "reason": "Unknown creditor"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_create_payment_debtor_not_member_returns_error() {
    let fix = TestFixture::new(&format!("pay-deb-unknown {}", Uuid::new_v4())).await;
    let non_member = Uuid::new_v4().to_string();

    let (status, body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": non_member,
            "amount_cents": 500,
            "reason": "Unknown debtor"
        }),
    )
    .await;

    assert!(!status.is_success());
    assert_valid_envelope(&body, false);
}

#[tokio::test]
async fn test_list_payments_pagination() {
    let fix = TestFixture::new(&format!("pay-pag {}", Uuid::new_v4())).await;

    for i in 0..3 {
        post_json(
            &format!("/v1/events/{}/payments", fix.event_id),
            &json!({
                "creditor_id": fix.members[0],
                "debtor_id": fix.members[1],
                "amount_cents": 100 + i * 50,
                "reason": format!("Payment {}", i)
            }),
        )
        .await;
    }

    let (status, body) = get_json(&format!("/v1/events/{}/payments?limit=2", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"]["items"].as_array().unwrap();
    assert!(items.len() <= 2, "limit param should restrict results");
}

#[tokio::test]
async fn test_propose_and_confirm_transaction() {
    let fix = TestFixture::new(&format!("pay-tx {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 5000,
            "reason": "Full payment"
        }),
    )
    .await;
    let payment_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, tx_body) = post_json(
        &format!(
            "/v1/events/{}/payments/{}/transactions",
            fix.event_id, payment_id
        ),
        &json!({
            "amount_cents": 3000
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&tx_body, true);
    let tx_id = tx_body["data"]["id"].as_str().unwrap().to_string();
    assert_eq!(tx_body["data"]["status"], "pending");
    assert_eq!(tx_body["data"]["amount_cents"], 3000);

    let (status, confirm_body) = post_json(
        &format!(
            "/v1/events/{}/payments/transactions/{}/confirm",
            fix.event_id, tx_id
        ),
        &json!({}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&confirm_body, true);
    assert_eq!(confirm_body["data"]["status"], "confirmed");

    let (_, payment_body) = get_json(&format!(
        "/v1/events/{}/payments/{}",
        fix.event_id, payment_id
    ))
    .await;
    assert_eq!(payment_body["data"]["amount_paid_cents"], 3000);
    assert_eq!(payment_body["data"]["status"], "ongoing");
}

#[tokio::test]
async fn test_full_payment_completion() {
    let fix = TestFixture::new(&format!("pay-full {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 2000,
            "reason": "Small debt"
        }),
    )
    .await;
    let payment_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (_, tx_body) = post_json(
        &format!(
            "/v1/events/{}/payments/{}/transactions",
            fix.event_id, payment_id
        ),
        &json!({
            "amount_cents": 2000
        }),
    )
    .await;
    let tx_id = tx_body["data"]["id"].as_str().unwrap().to_string();

    post_json(
        &format!(
            "/v1/events/{}/payments/transactions/{}/confirm",
            fix.event_id, tx_id
        ),
        &json!({}),
    )
    .await;

    let (_, payment_body) = get_json(&format!(
        "/v1/events/{}/payments/{}",
        fix.event_id, payment_id
    ))
    .await;
    assert_eq!(payment_body["data"]["amount_paid_cents"], 2000);
    assert_eq!(payment_body["data"]["status"], "completed");
}

#[tokio::test]
async fn test_incoming_outgoing_payments() {
    let fix = TestFixture::new(&format!("pay-io {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 1000,
            "reason": "Incoming for member 0"
        }),
    )
    .await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[2],
            "debtor_id": fix.members[0],
            "amount_cents": 500,
            "reason": "Outgoing for member 0"
        }),
    )
    .await;

    let (status, body) = get_json(&format!("/v1/events/{}/payments/incoming", fix.event_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let (status, body) = get_json(&format!("/v1/events/{}/payments/outgoing", fix.event_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
}

#[tokio::test]
async fn test_balance_summary() {
    let fix = TestFixture::new(&format!("pay-bal {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 3000,
            "reason": "Balance test"
        }),
    )
    .await;

    let (status, body) = get_json(&format!("/v1/events/{}/payments/balance", fix.event_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"]["net_balance_cents"].is_number());
}

#[tokio::test]
async fn test_payment_breakdown() {
    let fix = TestFixture::new(&format!("pay-bd {}", Uuid::new_v4())).await;

    post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 1500,
            "reason": "Breakdown test"
        }),
    )
    .await;

    let (status, body) = get_json(&format!("/v1/events/{}/payments/breakdown", fix.event_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"]["incoming"].is_array());
    assert!(body["data"]["outgoing"].is_array());
}

#[tokio::test]
async fn test_list_transactions_for_payment() {
    let fix = TestFixture::new(&format!("pay-lstx {}", Uuid::new_v4())).await;

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/payments", fix.event_id),
        &json!({
            "creditor_id": fix.members[0],
            "debtor_id": fix.members[1],
            "amount_cents": 5000,
            "reason": "Transaction list test"
        }),
    )
    .await;
    let payment_id = create_body["data"]["id"].as_str().unwrap().to_string();

    post_json(
        &format!(
            "/v1/events/{}/payments/{}/transactions",
            fix.event_id, payment_id
        ),
        &json!({
            "amount_cents": 1000
        }),
    )
    .await;

    post_json(
        &format!(
            "/v1/events/{}/payments/{}/transactions",
            fix.event_id, payment_id
        ),
        &json!({
            "amount_cents": 2000
        }),
    )
    .await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/payments/{}/transactions",
        fix.event_id, payment_id
    ))
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let items = body["data"].as_array().unwrap();
    assert_eq!(items.len(), 2);
}
