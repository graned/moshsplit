//! Auth handlers - external login and token refresh endpoints.

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::domain::repositories::member_repo::EventMemberRepository;
use crate::infrastructure::http::AppState;
use crate::services::member_service::MemberService;

#[derive(Debug, Deserialize, ToSchema)]
pub struct ExternalLoginRequest {
    pub api_token: String,
    pub email: String,
    pub display_name: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ExternalLoginResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
    pub email_verified: bool,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub user_id: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct RefreshTokenResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

/// External login — exchange API token for session via Sentinel.
/// The `ResponseWrapper` middleware wraps the returned data in the standard
/// `ApiResponse` envelope.
#[utoipa::path(
    post,
    path = "/v1/auth/external-login",
    request_body = ExternalLoginRequest,
    responses(
        (status = 200, description = "Login successful, returns session tokens", body = ExternalLoginResponse),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Authentication required — invalid or missing API token"),
        (status = 502, description = "Auth service unavailable"),
    ),
    tag = "External"
)]
pub async fn external_login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalLoginRequest>,
) -> Result<Json<ExternalLoginResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Use provided display_name and avatar_url from request, fallback to defaults
    let display_name = if payload.display_name.is_empty() {
        "Eduardo Anaya"
    } else {
        &payload.display_name
    };
    let avatar_url = payload.avatar_url.or_else(|| Some("https://lh3.googleusercontent.com/pw/AP1GczMPVP7BLZ7fKXXLPHayHHvK7FaOd1N_jPqod7q3pCaPoUAPIW37PLFQtYPTHeHmx6dT6S9N0j1QNbGdK70dMK_yYz_9rI5A9IBBt8OkLxkDdVq2wTXEL0z2jgPfbaL1ULukmNnGmzhummJ0tK45L1waNg=w1082-h1441-s-no-gm?authuser=0".to_string()));

    let result = state
        .sentinel_client
        .exchange_token(&payload.api_token, &payload.email, display_name, avatar_url.as_deref())
        .await;

    match result {
        Ok(response) => {
            // On first login, auto-join the user to the first active event.
            // This is best-effort — failures (e.g., no event exists yet) are
            // logged but do not prevent login.
            if let Ok(user_id) = Uuid::parse_str(&response.user_id) {
                let svc = MemberService::new(
                    EventRepository::new(state.db_client.clone()),
                    EventMemberRepository::new(state.db_client.clone()),
                );
                match svc.auto_join_first_event(user_id) {
                    Ok(true) => tracing::info!("Auto-joined user {user_id} to first active event"),
                    Ok(false) => { /* already a member — no-op */ }
                    Err(e) => tracing::warn!("Failed to auto-join user {user_id}: {e}"),
                }
            }

            Ok(Json(ExternalLoginResponse {
                user_id: response.user_id,
                access_token: response.access_token,
                refresh_token: response.refresh_token,
                expires_at: response.expires_at,
                email_verified: true,
                avatar_url: response.avatar_url,
            }))
        }
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

/// Refresh access token using refresh token via Sentinel.
/// The `ResponseWrapper` middleware wraps the returned data in the standard
/// `ApiResponse` envelope.
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshTokenRequest>,
) -> Result<Json<RefreshTokenResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .sentinel_client
        .refresh_token(&payload.user_id, &payload.refresh_token)
        .await;

    match result {
        Ok(response) => {
            let session = response.session;
            Ok(Json(RefreshTokenResponse {
                user_id: session.user_id,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
            }))
        }
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