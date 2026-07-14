//! Cookie-based authentication middleware.
//!
//! This middleware reads the `moshsplit_access_token` cookie and validates
//! the token via Sentinel, inserting the `AuthenticatedUser` into request
//! extensions for downstream handlers.
//!
//! Unlike the Sentinel `AuthMiddleware` which only reads from the
//! `Authorization: Bearer` header, this middleware also supports cookie-based
//! authentication for browser-based clients.

use axum::{
    body::Body,
    extract::Request,
    http::header::{AUTHORIZATION, COOKIE},
    middleware::Next,
    response::Response,
};
use sentinel_client::{AuthenticatedUser, SentinelClient};

/// Extract bearer token from Authorization header.
fn extract_bearer_token(request: &Request<Body>) -> Option<String> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())?;

    if auth_header.starts_with("Bearer ") {
        Some(auth_header.trim_start_matches("Bearer ").to_string())
    } else {
        None
    }
}

/// Extract `moshsplit_access_token` from Cookie header.
fn extract_cookie_token(request: &Request<Body>) -> Option<String> {
    let cookie_header = request.headers().get(COOKIE)?.to_str().ok()?;

    for cookie in cookie_header.split(';').map(|c| c.trim()) {
        if let Some(token) = cookie.strip_prefix("moshsplit_access_token=") {
            // Handle optional semicolon at end of token value
            let token = token.split(';').next().unwrap_or(token);
            if !token.is_empty() {
                return Some(token.to_string());
            }
        }
    }
    None
}

/// Middleware that authenticates requests via either:
/// 1. `Authorization: Bearer <token>` header (preferred)
/// 2. `Cookie: moshsplit_access_token=<token>` header (for browser clients)
///
/// If neither is present or token is invalid, the request passes through
/// without an `AuthenticatedUser` in extensions (handlers should check
/// and return 401 if auth is required).
///
/// This middleware is designed to run BEFORE the Sentinel Bearer auth
/// middleware. If Bearer auth is already present, this layer does nothing.
/// If Bearer auth is absent but Cookie is present, this sets the
/// AuthenticatedUser so the Sentinel auth middleware won't reject the request.
#[derive(Clone)]
pub struct CookieAuthMiddleware {
    sentinel: SentinelClient,
}

impl CookieAuthMiddleware {
    /// Create a new cookie auth middleware with the given Sentinel client.
    pub fn new(sentinel: SentinelClient) -> Self {
        Self { sentinel }
    }

    /// The actual middleware function.
    pub async fn authenticate(&self, mut request: Request<Body>, next: Next) -> Response {
        // Skip if already authenticated (Bearer token present)
        if extract_bearer_token(&request).is_some() {
            return next.run(request).await;
        }

        // Try Cookie header
        let Some(token) = extract_cookie_token(&request) else {
            // No token found — pass through without authentication
            return next.run(request).await;
        };

        // Extract HTTP method and path for authorization
        let method = request.method().as_str().to_string();
        let path = request.uri().path().to_string();

        // Validate token with Sentinel
        match self.sentinel.authenticate(&token, &method, &path).await {
            Ok(user) => {
                // Store authenticated user in extensions
                request.extensions_mut().insert(user);
                tracing::debug!(
                    user_id = request
                        .extensions()
                        .get::<AuthenticatedUser>()
                        .map(|u| u.user_id.as_str())
                        .unwrap_or("unknown"),
                    "Cookie auth: authenticated user via cookie"
                );
            }
            Err(e) => {
                tracing::warn!("Cookie auth: token validation failed: {}", e);
                // Pass through without authentication — handlers will return 401 if needed
            }
        }

        next.run(request).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;

    fn make_request_with_cookie(cookie: &str) -> Request<Body> {
        Request::builder()
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap()
    }

    fn make_request_with_auth(auth: Option<&str>) -> Request<Body> {
        let builder = Request::builder();
        if let Some(v) = auth {
            builder
                .header("authorization", v)
                .body(Body::empty())
                .unwrap()
        } else {
            builder.body(Body::empty()).unwrap()
        }
    }

    #[test]
    fn test_extract_cookie_token() {
        let req = make_request_with_cookie("moshsplit_access_token=abc123");
        assert_eq!(extract_cookie_token(&req), Some("abc123".to_string()));

        let req = make_request_with_cookie("moshsplit_access_token=abc123; other=value");
        assert_eq!(extract_cookie_token(&req), Some("abc123".to_string()));

        let req = make_request_with_cookie("other_cookie=xyz");
        assert_eq!(extract_cookie_token(&req), None);

        let req = make_request_with_cookie("moshsplit_access_token=");
        assert_eq!(extract_cookie_token(&req), None);

        let req = make_request_with_cookie("foo=bar; moshsplit_access_token=abc123; baz=qux");
        assert_eq!(extract_cookie_token(&req), Some("abc123".to_string()));
    }

    #[test]
    fn test_extract_bearer_token() {
        let req = make_request_with_auth(Some("Bearer abc123"));
        assert_eq!(extract_bearer_token(&req), Some("abc123".to_string()));

        let req = make_request_with_auth(Some("Basic abc123"));
        assert_eq!(extract_bearer_token(&req), None);

        let req = make_request_with_auth(None);
        assert_eq!(extract_bearer_token(&req), None);
    }
}
