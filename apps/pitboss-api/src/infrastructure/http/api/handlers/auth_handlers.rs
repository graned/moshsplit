//! Auth handlers - external login endpoint.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::infrastructure::http::AppState;

#[derive(Debug, Deserialize)]
pub struct ExternalLoginRequest {
    pub api_token: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct ExternalLoginResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
    pub email_verified: bool,
}

/// External login — exchange API token for session via Sentinel.
/// The `ResponseWrapper` middleware wraps the returned data in the standard
/// `ApiResponse` envelope.
pub async fn external_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalLoginRequest>,
) -> Result<Json<ExternalLoginResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .sentinel_client
        .exchange_token(&payload.api_token, &payload.email)
        .await;

    match result {
        Ok(response) => Ok(Json(ExternalLoginResponse {
            user_id: response.user_id,
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            expires_at: response.expires_at,
            email_verified: true,
        })),
        Err(e) => {
            let (code, status, message) = match &e {
                sentinel_client::SentinelError::Api { code, message, status, .. } => {
                    let s = StatusCode::from_u16(*status).unwrap_or(StatusCode::BAD_GATEWAY);
                    (format!("{}", code), s, message.clone())
                }
                sentinel_client::SentinelError::Network(_) => {
                    ("NETWORK_ERROR".to_string(), StatusCode::BAD_GATEWAY, "Failed to connect to auth service".to_string())
                }
                sentinel_client::SentinelError::Parse(_) => {
                    ("PARSE_ERROR".to_string(), StatusCode::BAD_GATEWAY, "Invalid response from auth service".to_string())
                }
                _ => ("UNKNOWN_ERROR".to_string(), StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            };

            let error_body = serde_json::json!({
                "code": code,
                "message": message,
            });
            Err((status, Json(error_body)))
        }
    }
}