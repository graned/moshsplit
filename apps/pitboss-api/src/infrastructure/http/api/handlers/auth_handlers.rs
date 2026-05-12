//! Auth handlers - external login endpoint.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::infrastructure::http::AppState;

#[derive(Debug, Deserialize)]
pub struct ExternalLoginRequest {
    #[serde(rename = "apiToken")]
    pub api_token: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct ExternalLoginResponse {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
    #[serde(rename = "emailVerified")]
    pub email_verified: bool,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

/// External login - exchange API token for session via Sentinel.
/// This is a public endpoint (no auth required) that allows external apps
/// to log in by providing their API token and target user email.
pub async fn external_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalLoginRequest>,
) -> Result<Json<ApiResponse<ExternalLoginResponse>>, axum::response::Response> {
    let result = state
        .sentinel_client
        .exchange_token(&payload.api_token, &payload.email)
        .await;

    match result {
        Ok(response) => {
            let login_response = ExternalLoginResponse {
                user_id: response.session.user_id,
                access_token: response.session.access_token,
                refresh_token: response.session.refresh_token,
                expires_at: response.session.expires_at,
                email_verified: true,
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(login_response),
                error: None,
            }))
        }
        Err(e) => {
            let (code, message) = match &e {
                sentinel_client::SentinelError::Api { code, message, .. } => {
                    (format!("{}", code), message.clone())
                }
                sentinel_client::SentinelError::Network(_) => {
                    ("NETWORK_ERROR".to_string(), "Failed to connect to auth service".to_string())
                }
                sentinel_client::SentinelError::Parse(_) => {
                    ("PARSE_ERROR".to_string(), "Invalid response from auth service".to_string())
                }
                _ => ("UNKNOWN_ERROR".to_string(), e.to_string()),
            };

            Ok(Json(ApiResponse {
                success: false,
                data: None,
                error: Some(ApiError { code, message }),
            }))
        }
    }
}