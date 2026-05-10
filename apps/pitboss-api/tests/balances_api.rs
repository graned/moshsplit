mod common;

use common::{assert_valid_envelope, get_json, post_json};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

struct TestFixture {
    event_id: String,
    payer: String,
    other: String,
}

impl TestFixture {
    async fn new(name: &str) -> Self {
        let (_, body) = post_json(
            "/v1/events",
            &json!({"name": name, "currency": "EUR"}),
        )
        .await;
        let event_id = body["data"]["id"].as_str().unwrap().to_string();

        let payer = Uuid::new_v4().to_string();
        let other = Uuid::new_v4().to_string();

        post_json(
            &format!("/v1/events/{event_id}/members"),
            &json!({"user_id": &payer}),
        )
        .await;
        post_json(
            &format!("/v1/events/{event_id}/members"),
            &json!({"user_id": &other}),
        )
        .await;

        // Payer pays 3000 split equally between both
        post_json(
            &format!("/v1/events/{event_id}/expenses"),
            &json!({
                "title": "Test expense",
                "amount_cents": 3000,
                "paid_by": &payer,
                "split_type": "equal",
                "split_data": {"shares": [&payer, &other]}
            }),
        )
        .await;

        // Other sends 500 to payer as payment
        post_json(
            &format!("/v1/events/{event_id}/payments"),
            &json!({
                "from_user": &other,
                "to_user": &payer,
                "amount_cents": 500,
                "currency": "EUR"
            }),
        )
        .await;

        Self { event_id, payer, other }
    }
}

#[tokio::test]
async fn test_get_balances_returns_200() {
    let fix = TestFixture::new(&format!("bal-all {}", Uuid::new_v4())).await;

    let (status, body) =
        get_json(&format!("/v1/events/{}/balances", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert!(data["balances"].is_array());

    let balances = data["balances"].as_array().unwrap();
    let total: i64 = balances
        .iter()
        .map(|b| b["balance_cents"].as_i64().unwrap_or(0))
        .sum();
    assert_eq!(total, 0, "balances should sum to zero");
    assert_eq!(balances.len(), 3, "should have 3 members: creator + 2 explicit members");
}

#[tokio::test]
async fn test_get_user_balance_returns_200() {
    let fix = TestFixture::new(&format!("bal-user {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/balances/{}",
        fix.event_id, fix.payer
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert_eq!(data["user_id"], fix.payer);
    assert!(data["balance_cents"].is_i64());
    assert!(data["paid_cents"].is_i64());
    assert!(data["owes_cents"].is_i64());
}

#[tokio::test]
async fn test_get_simplified_debts_returns_200() {
    let fix = TestFixture::new(&format!("bal-simp {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/balances/simplified",
        fix.event_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert!(data["transfers"].is_array());
}

#[tokio::test]
async fn test_explain_balance_returns_200() {
    let fix = TestFixture::new(&format!("bal-expl {}", Uuid::new_v4())).await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/balances/{}/explain",
        fix.event_id, fix.payer
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let data = &body["data"];
    assert_eq!(data["user_id"], fix.payer);
    assert!(data["balance_cents"].is_i64());
    assert!(data["expenses"].is_array());
    assert!(data["payments"].is_array());
    assert!(data["settlements"].is_array());
}

#[tokio::test]
async fn test_balances_are_computed_correctly() {
    let fix = TestFixture::new(&format!("bal-calc {}", Uuid::new_v4())).await;

    let (_, body) =
        get_json(&format!("/v1/events/{}/balances", fix.event_id)).await;
    let balances = body["data"]["balances"].as_array().unwrap();

    // payer paid 3000 (paid_cents), owes 1500 (share of equal split)
    // received 500 from other (pmts_in)
    // balance = 3000 - 1500 + 500 = 2000
    let payer_bal = balances
        .iter()
        .find(|b| b["user_id"] == fix.payer)
        .expect("payer should be in balances");
    assert_eq!(
        payer_bal["paid_cents"], 3000,
        "payer paid 3000"
    );
    assert_eq!(
        payer_bal["owes_cents"], 1500,
        "payer owes 1500"
    );
    assert_eq!(
        payer_bal["balance_cents"], 2000,
        "payer balance should be 2000"
    );

    // other paid 0, owes 1500 (share of equal split), sent 500 to payer
    // balance = 0 - 1500 - 500 = -2000
    let other_bal = balances
        .iter()
        .find(|b| b["user_id"] == fix.other)
        .expect("other should be in balances");
    assert_eq!(
        other_bal["paid_cents"], 0,
        "other paid 0"
    );
    assert_eq!(
        other_bal["owes_cents"], 1500,
        "other owes 1500"
    );
    assert_eq!(
        other_bal["balance_cents"], -2000,
        "other balance should be -2000"
    );
}
