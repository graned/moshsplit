//! Sentinel error types.
//!
//! These mirror the TypeScript SDK error hierarchy.

use serde::Deserialize;
use thiserror::Error;

/// Sentinel error codes - matches TypeScript SDK
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SentinelErrorCode {
    /// Generic authentication error (401)
    AuthError,
    /// Invalid token (401)
    InvalidToken,
    /// Token has expired (401)
    ExpiredToken,
    /// No token provided (401)
    MissingToken,
    /// Email not verified (403)
    EmailNotVerified,
    /// Invalid MFA code (401)
    MfaInvalidCode,
    /// MFA attempt limit exceeded (429)
    MfaAttemptLimit,
    /// Rate limit exceeded (429)
    RateLimitExceeded,
    /// Validation error (400)
    ValidationError,
    /// Forbidden (403)
    Forbidden,
    /// Not found (404)
    NotFound,
    /// Internal server error (500)
    InternalError,
    /// Service unavailable (503)
    ServiceUnavailable,
    /// Network error (0)
    NetworkError,
    /// Unknown error
    Unknown,
}

impl SentinelErrorCode {
    pub fn from_status(status: u16) -> Self {
        match status {
            400 => Self::ValidationError,
            401 => Self::AuthError,
            403 => Self::Forbidden,
            404 => Self::NotFound,
            429 => Self::RateLimitExceeded,
            500 => Self::InternalError,
            503 => Self::ServiceUnavailable,
            _ => Self::Unknown,
        }
    }
}

/// Main Sentinel error type
#[derive(Debug, Error)]
pub enum SentinelError {
    /// Network/transport errors
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// API-level errors with code
    #[error("{message}")]
    Api {
        message: String,
        code: SentinelErrorCode,
        status: u16,
        request_id: Option<String>,
    },

    /// JSON parsing errors
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),

    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Invalid token specifically
    #[error("Invalid token: {0}")]
    InvalidToken(String),

    /// Missing authorization header
    #[error("Missing authorization header")]
    MissingToken,
}

impl SentinelError {
    /// Create an API error from a response
    pub fn from_response(status: u16, body: &str, request_id: Option<String>) -> Self {
        // Try to parse the error response
        let parsed: Option<ApiErrorResponse> = serde_json::from_str(body).ok();
        
        if let Some(api_error) = parsed {
            let code = SentinelErrorCode::from_status(status);
            return Self::Api {
                message: api_error.message,
                code,
                status,
                request_id,
            };
        }

        // Fallback to status-based error
        Self::Api {
            message: format!("HTTP {}", status),
            code: SentinelErrorCode::from_status(status),
            status,
            request_id,
        }
    }

    /// Check if this is an auth error
    pub fn is_auth_error(&self) -> bool {
        matches!(
            self,
            Self::Api { code: SentinelErrorCode::AuthError | SentinelErrorCode::InvalidToken | SentinelErrorCode::ExpiredToken | SentinelErrorCode::MissingToken, .. }
        )
    }

    /// Get the HTTP status code if available
    pub fn status(&self) -> Option<u16> {
        match self {
            Self::Api { status, .. } => Some(*status),
            Self::Network(e) => e.status().map(|s| s.as_u16()),
            _ => None,
        }
    }
}

/// API error response structure from Sentinel
#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    message: String,
    code: Option<String>,
}

impl std::fmt::Display for SentinelErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AuthError => write!(f, "AUTH_ERROR"),
            Self::InvalidToken => write!(f, "INVALID_TOKEN"),
            Self::ExpiredToken => write!(f, "EXPIRED_TOKEN"),
            Self::MissingToken => write!(f, "MISSING_TOKEN"),
            Self::EmailNotVerified => write!(f, "EMAIL_NOT_VERIFIED"),
            Self::MfaInvalidCode => write!(f, "INVALID_MFA_CODE"),
            Self::MfaAttemptLimit => write!(f, "MFA_ATTEMPT_LIMIT_EXCEEDED"),
            Self::RateLimitExceeded => write!(f, "RATE_LIMIT_EXCEEDED"),
            Self::ValidationError => write!(f, "VALIDATION_ERROR"),
            Self::Forbidden => write!(f, "FORBIDDEN"),
            Self::NotFound => write!(f, "NOT_FOUND"),
            Self::InternalError => write!(f, "INTERNAL_ERROR"),
            Self::ServiceUnavailable => write!(f, "SERVICE_UNAVAILABLE"),
            Self::NetworkError => write!(f, "NETWORK_ERROR"),
            Self::Unknown => write!(f, "UNKNOWN"),
        }
    }
}

// Convenience type for results
pub type Result<T> = std::result::Result<T, SentinelError>;