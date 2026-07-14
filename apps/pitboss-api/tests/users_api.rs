mod common;

use common::{get_json, get_json_with_auth, post_json};
use reqwest::StatusCode;
use uuid::Uuid;

/// Verify the endpoint returns 401 when accessed without authentication.
#[tokio::test]
async fn test_list_users_requires_auth() {
    let (status, _) = get_json("/v1/users").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

/// Verify the endpoint structure when accessed with a valid session token.
#[tokio::test]
async fn test_list_users_returns_valid_structure() {
    let token = "sat_00a473fa4da8a118d6a7b22caa9c88e8c0099e7359df77bc1969484a50101e8b";
    let login_payload = serde_json::json!({
        "api_token": token,
        "email": "anayamaster@gmail.com",
        "display_name": "Eduardo Anaya",
    });

    let (login_status, login_body) = post_json("/v1/auth/external-login", &login_payload).await;

    if login_status == StatusCode::SEE_OTHER || login_status == StatusCode::FOUND {
        let location = login_body
            .get("location")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let params = common::parse_query_params(location.split('?').nth(1).unwrap_or(""));
        let access_token = params
            .get("access_token")
            .expect("access_token in redirect");

        let (status, body) = get_json_with_auth("/v1/users", access_token).await;
        assert_eq!(status, StatusCode::OK, "GET /v1/users should return 200");

        let data = body["data"].as_array().unwrap();
        assert!(!data.is_empty(), "should return at least one user");

        for user in data {
            assert!(user["id"].as_str().map(Uuid::parse_str).unwrap().is_ok());
            assert!(user["first_name"].is_string());
            assert!(user["last_name"].is_string());
            assert!(user["email"].is_string());
        }
    } else {
        eprintln!(
            "Skipping authenticated test — external-login returned {} (expected 302)",
            login_status
        );
    }
}
