//! Auth handlers - external login and token refresh endpoints.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect, Response};
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
    /// Optional URL to redirect to after successful login. Must start with '/' and be a safe relative path.
    #[serde(default)]
    pub return_to: Option<String>,
    /// If true, check for existing session before creating new one. When true, Sentinel is
    /// called to validate and may return existing session tokens if the user already has an
    /// active session. Defaults to false (always creates a new session).
    #[serde(default)]
    pub reuse_session: Option<bool>,
}

/// Response passed to the redirect URL on success.
pub struct ExternalLoginSuccess {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
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
/// On success: redirects to frontend login page with session tokens.
/// On error: redirects to frontend login page with error details.
#[utoipa::path(
    post,
    path = "/v1/auth/external-login",
    request_body = ExternalLoginRequest,
    responses(
        (status = 302, description = "Redirects to login page with session tokens"),
        (status = 400, description = "Invalid request body"),
        (status = 401, description = "Authentication required — invalid or missing API token"),
        (status = 502, description = "Auth service unavailable"),
    ),
    tag = "External"
)]
pub async fn external_login(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<ExternalLoginRequest>,
) -> Result<Response, (StatusCode, Response)> {
    // Use provided display_name and avatar_url from request, fallback to defaults
    let display_name = if payload.display_name.is_empty() {
        "Eduardo Anaya"
    } else {
        &payload.display_name
    };
    let avatar_url = payload.avatar_url.or_else(|| {
        Some(
            "https://lh3.googleusercontent.com/pw/AP1GczMPVP7BLZ7fKXXLPHayHHvK7FaOd1N_jPqod7q3pCaPoUAPIW37PLFQtYPTHeHmx6dT6S9N0j1QNbGdK70dMK_yYz_9rI5A9IBBt8OkLxkDdVq2wTXEL0z2jgPfbaL1ULukmNnGmzhummJ0tK45L1waNg=w1082-h1441-s-no-gm?authuser=0"
                .to_string(),
        )
    });

    /// Validate and sanitize a return_to URL to prevent open-redirect attacks.
    /// Returns Some(valid_path) if safe, None if the path is invalid.
    fn validate_return_to(return_to: &str) -> Option<String> {
        // Must start with /
        if !return_to.starts_with('/') {
            return None;
        }
        // Block javascript: and other schemes to prevent XSS/open-redirect
        if return_to.contains(':') {
            return None;
        }
        // Block path traversal to prevent directory traversal
        if return_to.contains("..") {
            return None;
        }
        // Max length to prevent abuse
        if return_to.len() > 256 {
            return None;
        }
        Some(return_to.to_string())
    }

    /// Resolve return_to with validation, defaulting to /app if absent or invalid.
    fn resolve_return_to(return_to: &Option<String>) -> String {
        return_to
            .as_ref()
            .and_then(|rt| validate_return_to(rt))
            .unwrap_or_else(|| "/app".to_string())
    }

    // Determine reuse_session flag (default: false)
    let reuse_session = payload.reuse_session.unwrap_or(false);

    // Call Sentinel's exchange_token
    // Note: reuse_session is informational - Sentinel's exchange_token is idempotent
    // for the same email. If user already has a session, Sentinel returns existing tokens.
    tracing::debug!(
        "External login attempt for email={}, reuse_session={}",
        payload.email,
        reuse_session
    );

    let result = state
        .sentinel_client
        .exchange_token(
            &payload.api_token,
            &payload.email,
            display_name,
            avatar_url.as_deref(),
        )
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
                    Ok(false) => {
                        /* already a member — no-op */
                    }
                    Err(e) => tracing::warn!("Failed to auto-join user {user_id}: {e}"),
                }
            }

            let return_to = resolve_return_to(&payload.return_to);
            let redirect_url = format!(
                "{}/moshsplit/login?access_token={}&refresh_token={}&user_id={}&expires_at={}&return_to={}",
                state.frontend_base_url,
                urlencoding::encode(&response.access_token),
                urlencoding::encode(&response.refresh_token),
                urlencoding::encode(&response.user_id),
                urlencoding::encode(&response.expires_at),
                urlencoding::encode(&return_to),
            );

            Ok(Redirect::to(&redirect_url).into_response())
        }
        Err(e) => {
            let (code, status, message) = match &e {
                sentinel_client::SentinelError::Api {
                    code,
                    message,
                    status,
                    ..
                } => {
                    let s = StatusCode::from_u16(*status).unwrap_or(StatusCode::BAD_GATEWAY);
                    (format!("{}", code), s, message.clone())
                }
                sentinel_client::SentinelError::Network(_) => (
                    "NETWORK_ERROR".to_string(),
                    StatusCode::BAD_GATEWAY,
                    "Failed to connect to auth service".to_string(),
                ),
                sentinel_client::SentinelError::Parse(_) => (
                    "PARSE_ERROR".to_string(),
                    StatusCode::BAD_GATEWAY,
                    "Invalid response from auth service".to_string(),
                ),
                _ => (
                    "UNKNOWN_ERROR".to_string(),
                    StatusCode::INTERNAL_SERVER_ERROR,
                    e.to_string(),
                ),
            };

            let redirect_url = format!(
                "{}/moshsplit/login?error={}&error_description={}",
                state.frontend_base_url,
                urlencoding::encode(&code),
                urlencoding::encode(&message),
            );

            Err((status, Redirect::to(&redirect_url).into_response()))
        }
    }
}

/// Refresh access token using refresh token via Sentinel.
/// The `ResponseWrapper` middleware wraps the returned data in the standard
/// `ApiResponse` envelope.
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    axum::Json(payload): axum::Json<RefreshTokenRequest>,
) -> Result<axum::Json<RefreshTokenResponse>, (StatusCode, axum::Json<serde_json::Value>)> {
    let result = state
        .sentinel_client
        .refresh_token(&payload.user_id, &payload.refresh_token)
        .await;

    match result {
        Ok(response) => {
            let session = response.session;
            Ok(axum::Json(RefreshTokenResponse {
                user_id: session.user_id,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
            }))
        }
        Err(e) => {
            let (code, status, message) = match &e {
                sentinel_client::SentinelError::Api {
                    code,
                    message,
                    status,
                    ..
                } => {
                    let s = StatusCode::from_u16(*status).unwrap_or(StatusCode::BAD_GATEWAY);
                    (format!("{}", code), s, message.clone())
                }
                sentinel_client::SentinelError::Network(_) => (
                    "NETWORK_ERROR".to_string(),
                    StatusCode::BAD_GATEWAY,
                    "Failed to connect to auth service".to_string(),
                ),
                sentinel_client::SentinelError::Parse(_) => (
                    "PARSE_ERROR".to_string(),
                    StatusCode::BAD_GATEWAY,
                    "Invalid response from auth service".to_string(),
                ),
                _ => (
                    "UNKNOWN_ERROR".to_string(),
                    StatusCode::INTERNAL_SERVER_ERROR,
                    e.to_string(),
                ),
            };

            let error_body = serde_json::json!({
                "code": code,
                "message": message,
            });
            Err((status, axum::Json(error_body)))
        }
    }
}