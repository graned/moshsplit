//! Request and response types for Sentinel Auth API.
//!
//! These types mirror the TypeScript sentinel-auth-sdk.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Common Types (ApiEnvelope)
// ─────────────────────────────────────────────────────────────────────────────

/// Sentinel API response wrapper format
#[derive(Debug, Clone, Deserialize)]
pub struct ApiEnvelope<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiError>,
    pub timestamp: String,
    #[serde(rename = "request_id")]
    pub request_id: String,
}

/// Sentinel API error response
#[derive(Debug, Clone, Deserialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Types
// ─────────────────────────────────────────────────────────────────────────────

/// Request to authenticate (validate a token)
#[derive(Debug, Clone, Serialize)]
pub struct AuthenticateRequest {
    pub token: String,
}

/// Response from authenticate endpoint (POST /v1/api/auth/authenticate)
#[derive(Debug, Clone, Deserialize)]
pub struct AuthenticateResponse {
    #[serde(rename = "user_id")]
    pub user_id: String,
    #[serde(rename = "session_id")]
    pub session_id: Option<String>,
    pub roles: Vec<String>,
    #[serde(rename = "email_verified")]
    pub email_verified: bool,
    #[serde(rename = "must_change_password")]
    pub must_change_password: bool,
}

/// Request to authenticate and authorize (validate token + check permissions)
#[derive(Debug, Clone, Serialize)]
pub struct AuthenticateAndAuthorizeRequest {
    #[serde(rename = "access_token")]
    pub access_token: String,
    pub method: String,
    pub path: String,
}

/// Response from authenticate-and-authorize endpoint
#[derive(Debug, Clone, Deserialize)]
pub struct AuthenticateAndAuthorizeResponse {
    pub authorized: bool,
    pub roles: Option<Vec<UserRole>>,
}

/// User role from Sentinel
#[derive(Debug, Clone, Deserialize)]
pub struct UserRole {
    pub id: String,
    pub name: String,
    pub permissions: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Register Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct RegisterRequest {
    #[serde(rename = "first_name")]
    pub first_name: String,
    #[serde(rename = "last_name")]
    pub last_name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterResponse {
    pub user_id: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

// Token exchange types (POST /v1/api/auth/token/exchange)
// Sentinel v1.3.0+: Requires display_name, avatar_url is optional but recommended
#[derive(Debug, Clone, Serialize)]
pub struct TokenExchangeRequest {
    pub email: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenExchangeResponse {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

/// Login response - either a session or MFA challenge
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum LoginResponse {
    Session(LoginSuccessResponse),
    MfaChallenge(MfaChallengeResponse),
}

#[derive(Debug, Clone, Deserialize)]
pub struct LoginSuccessResponse {
    pub session: Session,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MfaChallengeResponse {
    #[serde(rename = "type")]
    pub challenge_type: String,
    #[serde(rename = "user_id")]
    pub user_id: String,
    #[serde(rename = "mfa_session_token")]
    pub mfa_session_token: String,
}

/// Session object
#[derive(Debug, Clone, Deserialize)]
pub struct Session {
    pub user_id: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// User Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct UpdateProfileRequest {
    #[serde(rename = "first_name")]
    pub first_name: Option<String>,
    #[serde(rename = "last_name")]
    pub last_name: Option<String>,
    #[serde(rename = "avatar_url")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChangePasswordRequest {
    #[serde(rename = "current_password")]
    pub current_password: String,
    #[serde(rename = "new_password")]
    pub new_password: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// MFA Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct MfaVerifyRequest {
    #[serde(rename = "mfa_session_token")]
    pub mfa_session_token: String,
    pub code: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MfaVerifyResponse {
    pub session: Session,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TotpStartResponse {
    #[serde(rename = "otpauth_uri")]
    pub otpauth_uri: String,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TotpConfirmRequest {
    pub code: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TotpConfirmResponse {
    #[serde(rename = "recovery_codes")]
    pub recovery_codes: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Refresh Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct RefreshTokenRequest {
    #[serde(rename = "refresh_token")]
    pub refresh_token: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RefreshTokenResponse {
    pub session: Session,
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated User (for middleware)
// ─────────────────────────────────────────────────────────────────────────────

/// Authenticated user extracted from validated token - used in middleware
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email_verified: bool,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
}

impl AuthenticatedUser {
    pub fn new(user_id: String) -> Self {
        Self {
            user_id,
            email: None,
            first_name: None,
            last_name: None,
            email_verified: false,
            roles: Vec::new(),
            permissions: Vec::new(),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

/// Sentinel client configuration
#[derive(Debug, Clone)]
pub struct SentinelConfig {
    pub base_url: String,
    pub timeout: std::time::Duration,
}

impl SentinelConfig {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            timeout: std::time::Duration::from_millis(2000),
        }
    }

    pub fn with_timeout(mut self, timeout_ms: u64) -> Self {
        self.timeout = std::time::Duration::from_millis(timeout_ms);
        self
    }
}

impl Default for SentinelConfig {
    fn default() -> Self {
        Self::new("http://localhost:9000")
    }
}