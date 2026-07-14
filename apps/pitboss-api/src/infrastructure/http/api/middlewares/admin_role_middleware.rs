//! Admin role middleware — restricts access to admin-only endpoints.
//!
//! This middleware checks that the authenticated user (set by the Sentinel
//! auth middleware) has an "admin" role. If not, returns 403 Forbidden.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use sentinel_client::AuthenticatedUser;
use tracing::warn;

use crate::errors::ApiError;

/// Middleware that requires the authenticated user to have an "admin" role.
///
/// Expects `AuthenticatedUser` to be present in request extensions (set by
/// the Sentinel auth middleware). Returns 403 if the user lacks the admin
/// role, or 401 if no authenticated user is found.
pub async fn require_admin(req: Request<Body>, next: Next) -> Result<Response, ApiError> {
    let authenticated = req.extensions().get::<AuthenticatedUser>().ok_or_else(|| {
        ApiError::unauthorized("Authentication required. No authenticated user found.")
    })?;

    // Check for admin role (case-insensitive)
    let has_admin_role = authenticated
        .roles
        .iter()
        .any(|role| role.to_lowercase() == "admin");

    if !has_admin_role {
        warn!(
            user_id = %authenticated.user_id,
            roles = ?authenticated.roles,
            "Admin access denied"
        );
        return Err(ApiError::new(
            "FORBIDDEN",
            "Admin role required to access this resource.",
            StatusCode::FORBIDDEN,
        ));
    }

    Ok(next.run(req).await)
}
