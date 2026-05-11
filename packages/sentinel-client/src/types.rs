//! Request and response types for Sentinel Auth API.
//!
//! These types mirror the TypeScript sentinel-auth-sdk.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Auth Types
// ─────────────────────────────────────────────────────────────────────────────

/// Request to authenticate (validate a token)
#[derive(Debug, Clone, Serialize)]
pub struct AuthenticateRequest {
    pub token: String,
}

/// Response from authenticate endpoint
#[derive(Debug, Clone, Deserialize)]
pub struct AuthenticateResponse {
    #[serde(rename = "user_id")]
    pub user_id: String,
    pub email: Option<String>,
    #[serde(rename = "first_name")]
    pub first_name: Option<String>,
    #[serde(rename = "last_name")]
    pub last_name: Option<String>,
    #[serde(rename = "email_verified")]
    pub email_verified: bool,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    #[serde(rename = "expires_at")]
    pub expires_at: Option<String>,
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
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresAt")]
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