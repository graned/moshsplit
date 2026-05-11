//! Axum middleware for Sentinel token validation.
//!
//! This middleware validates Bearer tokens against the Sentinel auth service
//! and stores the authenticated user in request extensions.

use axum::{
    body::Body,
    extract::Request,
    http::{
        header::AUTHORIZATION,
        StatusCode,
    },
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

pub use crate::client::SentinelClient;
pub use crate::errors::SentinelError;
pub use crate::types::AuthenticatedUser;

/// Error response structure.
#[derive(Debug, Serialize)]
pub struct AuthErrorResponse {
    pub code: String,
    pub message: String,
}

/// Auth middleware for Axum.
/// 
/// Extracts the Bearer token from the Authorization header,
/// validates it against Sentinel, and stores the AuthenticatedUser
/// in request extensions for downstream handlers.
#[derive(Clone)]
pub struct AuthMiddleware {
    sentinel: SentinelClient,
}

impl AuthMiddleware {
    /// Create a new auth middleware with the given Sentinel client.
    pub fn new(sentinel: SentinelClient) -> Self {
        Self { sentinel }
    }

    /// The actual middleware function.
    pub async fn authenticate(&self, mut request: Request<Body>, next: Next) -> Response {
        // Extract Authorization header
        let token = match extract_bearer_token(&request) {
            Ok(token) => token,
            Err(response) => return response,
        };

        // Validate token with Sentinel
        match self.sentinel.authenticate(&token).await {
            Ok(user) => {
                // Store authenticated user in extensions
                request.extensions_mut().insert(user);
                let user_id = request.extensions().get::<AuthenticatedUser>()
            .map(|u| u.user_id.as_str())
            .unwrap_or("unknown");
        tracing::debug!("Authenticated user: {}", user_id);
                next.run(request).await
            }
            Err(e) => {
                tracing::warn!("Token validation failed: {}", e);
                error_response(
                    status_from_error(&e),
                    error_code_from_error(&e),
                    &e.to_string(),
                )
            }
        }
    }
}

/// Extract Bearer token from request.
fn extract_bearer_token(request: &Request<Body>) -> Result<String, Response> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            Ok(header.trim_start_matches("Bearer ").to_string())
        }
        Some(_) => Err(error_response(
            StatusCode::UNAUTHORIZED,
            "INVALID_AUTHORIZATION_HEADER",
            "Authorization header must use Bearer scheme",
        )),
        None => Err(error_response(
            StatusCode::UNAUTHORIZED,
            "MISSING_TOKEN",
            "Authorization header required",
        )),
    }
}

/// Create an error response.
fn error_response(status: StatusCode, code: &str, message: &str) -> Response {
    let error = AuthErrorResponse {
        code: code.to_string(),
        message: message.to_string(),
    };
    (status, Json(error)).into_response()
}

/// Map SentinelError to HTTP status.
fn status_from_error(error: &SentinelError) -> StatusCode {
    match error {
        SentinelError::Api { status, .. } => StatusCode::from_u16(*status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        SentinelError::Network(e) => e.status().unwrap_or(StatusCode::SERVICE_UNAVAILABLE),
        SentinelError::InvalidToken(_) => StatusCode::UNAUTHORIZED,
        SentinelError::MissingToken => StatusCode::UNAUTHORIZED,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

/// Map SentinelError to error code.
fn error_code_from_error(error: &SentinelError) -> &'static str {
    match error {
        SentinelError::Api { code, .. } => match code {
            crate::errors::SentinelErrorCode::AuthError => "AUTH_ERROR",
            crate::errors::SentinelErrorCode::InvalidToken => "INVALID_TOKEN",
            crate::errors::SentinelErrorCode::ExpiredToken => "EXPIRED_TOKEN",
            crate::errors::SentinelErrorCode::MissingToken => "MISSING_TOKEN",
            crate::errors::SentinelErrorCode::RateLimitExceeded => "RATE_LIMIT_EXCEEDED",
            crate::errors::SentinelErrorCode::ValidationError => "VALIDATION_ERROR",
            crate::errors::SentinelErrorCode::Forbidden => "FORBIDDEN",
            _ => "AUTH_ERROR",
        },
        SentinelError::Network(_) => "NETWORK_ERROR",
        SentinelError::InvalidToken(_) => "INVALID_TOKEN",
        SentinelError::MissingToken => "MISSING_TOKEN",
        _ => "INTERNAL_ERROR",
    }
}

/// Extension trait for getting authenticated user from request.
pub trait AuthExtension {
    fn authenticated_user(&self) -> Option<&AuthenticatedUser>;
}

impl AuthExtension for axum::http::Extensions {
    fn authenticated_user(&self) -> Option<&AuthenticatedUser> {
        self.get::<AuthenticatedUser>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_middleware_builder() {
        let sentinel = SentinelClient::default().unwrap();
        let middleware = AuthMiddleware::new(sentinel);
        
        // Just verify it constructs correctly
        assert!(std::mem::size_of_val(&middleware) > 0);
    }
}