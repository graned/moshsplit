//! Custom Axum extractors — `CurrentUser`, etc.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sentinel_client::AuthenticatedUser;
use uuid::Uuid;

use crate::errors::ApiError;

/// Extractor that reads the authenticated user from request extensions.
///
/// This extractor expects the `AuthenticatedUser` to be set by the Sentinel
/// auth middleware. If not present (which should only happen for public
/// routes), returns an unauthorized error.
#[derive(Debug, Clone, Copy)]
pub struct CurrentUser(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let authenticated = parts.extensions.get::<AuthenticatedUser>().ok_or_else(|| {
            ApiError::unauthorized("Authentication required. No authenticated user found.")
        })?;

        // Parse the user_id string into a Uuid
        let user_id = Uuid::parse_str(&authenticated.user_id).map_err(|_| {
            ApiError::unauthorized("Invalid user ID format in authentication token.")
        })?;

        Ok(CurrentUser(user_id))
    }
}

/// Optional extractor for routes that may or may not have authentication.
/// Returns None if no authenticated user is present (public access).
#[derive(Debug, Clone, Copy)]
pub struct OptionalCurrentUser(pub Option<Uuid>);

impl<S: Send + Sync> FromRequestParts<S> for OptionalCurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_id = parts
            .extensions
            .get::<AuthenticatedUser>()
            .and_then(|u| Uuid::parse_str(&u.user_id).ok());

        Ok(OptionalCurrentUser(user_id))
    }
}
