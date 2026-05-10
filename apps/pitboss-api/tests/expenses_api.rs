mod common;

use common::{
    assert_valid_envelope, delete_json, get_json, patch_json, post_json,
};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

fn unique_name(prefix: &str) -> String {
    format!("{prefix} {}", Uuid::new_v4())
}

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
async fn test_create_expense_returns_201() {
    let fix = TestFixture::new(&unique_name("exp-create")).await;
    let paid_by = fix.members[0].clone();

    let (status, body) = post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "Dinner",
            "amount_cents": 3000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()},
            "notes": "Team dinner"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    assert_valid_envelope(&body, true);
    let data = &body["data"];
    let version = &data["current_version"];
    assert_eq!(version["title"], "Dinner");
    assert_eq!(version["amount_cents"], 3000);
    assert_eq!(version["split_type"], "equal");
    assert_eq!(version["version_number"], 1);
    assert!(data["deleted_at"].is_null());
}

#[tokio::test]
async fn test_get_expense_returns_200() {
    let fix = TestFixture::new(&unique_name("exp-get")).await;
    let paid_by = fix.members[0].clone();

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "Lunch",
            "amount_cents": 1500,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) =
        get_json(&format!("/v1/events/{}/expenses/{}", fix.event_id, expense_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let version = &body["data"]["current_version"];
    assert_eq!(version["title"], "Lunch");
    assert_eq!(version["amount_cents"], 1500);
}

#[tokio::test]
async fn test_list_expenses_returns_200() {
    let fix = TestFixture::new(&unique_name("exp-list")).await;
    let paid_by = fix.members[0].clone();

    post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "Item 1",
            "amount_cents": 1000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;

    let (status, body) =
        get_json(&format!("/v1/events/{}/expenses", fix.event_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    assert!(body["data"].is_array());
}

#[tokio::test]
async fn test_update_expense_creates_new_version() {
    let fix = TestFixture::new(&unique_name("exp-upd")).await;
    let paid_by = fix.members[0].clone();

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "Original",
            "amount_cents": 2000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) = patch_json(
        &format!("/v1/events/{}/expenses/{}", fix.event_id, expense_id),
        &json!({
            "title": "Updated Title",
            "amount_cents": 2500,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let version = &body["data"]["current_version"];
    assert_eq!(version["title"], "Updated Title");
    assert_eq!(version["amount_cents"], 2500);
    assert_eq!(version["version_number"], 2);
}

#[tokio::test]
async fn test_list_expense_versions_returns_all() {
    let fix = TestFixture::new(&unique_name("exp-vers")).await;
    let paid_by = fix.members[0].clone();

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "V1",
            "amount_cents": 1000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    patch_json(
        &format!("/v1/events/{}/expenses/{}", fix.event_id, expense_id),
        &json!({
            "title": "V2",
            "amount_cents": 2000,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;

    let (status, body) = get_json(&format!(
        "/v1/events/{}/expenses/{}/versions",
        fix.event_id, expense_id
    ))
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);
    let versions = body["data"].as_array().unwrap();
    assert_eq!(versions.len(), 2);
    assert_eq!(versions[0]["version_number"], 2);
    assert_eq!(versions[1]["version_number"], 1);
}

#[tokio::test]
async fn test_delete_expense_soft_deletes() {
    let fix = TestFixture::new(&unique_name("exp-del")).await;
    let paid_by = fix.members[0].clone();

    let (_, create_body) = post_json(
        &format!("/v1/events/{}/expenses", fix.event_id),
        &json!({
            "title": "To Delete",
            "amount_cents": 500,
            "paid_by": paid_by,
            "split_type": "equal",
            "split_data": {"shares": fix.members.clone()}
        }),
    )
    .await;
    let expense_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (status, body) =
        delete_json(&format!("/v1/events/{}/expenses/{}", fix.event_id, expense_id)).await;

    assert_eq!(status, StatusCode::OK);
    assert_valid_envelope(&body, true);

    let (get_status, get_body) =
        get_json(&format!("/v1/events/{}/expenses/{}", fix.event_id, expense_id)).await;
    assert_eq!(get_status, StatusCode::OK);
    assert!(get_body["data"]["deleted_at"].is_string());
}
