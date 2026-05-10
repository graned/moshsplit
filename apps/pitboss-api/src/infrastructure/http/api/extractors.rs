//! Custom Axum extractors — `CurrentUser`, etc.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use uuid::Uuid;

use crate::errors::ApiError;

/// Extractor that reads the current user ID from the `X-User-Id` header.
///
/// If the header is absent or invalid, a well-known test UUID is used as
/// fallback (so handlers don't break during development before auth is
/// wired in).
///
/// # Future
///
/// When auth middleware is added, this extractor will be changed to read
/// the authenticated user from request extensions instead.
#[derive(Debug, Clone, Copy)]
pub struct CurrentUser(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .headers
            .get("x-user-id")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok())
            .unwrap_or_else(test_user_id);

        Ok(CurrentUser(user_id))
    }
}

/// Well-known test / development user UUID.
fn test_user_id() -> Uuid {
    Uuid::from_u128(1)
}
