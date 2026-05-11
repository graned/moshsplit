//! 4-layer error hierarchy:
//!   DomainError → RepositoryError → ServiceError → ApiError
//!
//! Each layer has `From` impls to convert from the lower layer.
//! ApiError implements `IntoResponse` for Axum.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

// ── Layer 1: DomainError ──────────────────────────────────────────────────────

/// Errors originating from domain logic / business rules.
#[derive(Debug, Clone, thiserror::Error)]
pub enum DomainError {
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Business rule violated: {0}")]
    BusinessRule(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Domain error: {0}")]
    Generic(String),
}

// ── Layer 2: RepositoryError ──────────────────────────────────────────────────

/// Errors originating from data-access / persistence layer.
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Transaction error: {0}")]
    Transaction(String),
}

impl From<diesel::result::Error> for RepositoryError {
    fn from(err: diesel::result::Error) -> Self {
        match &err {
            diesel::result::Error::NotFound => RepositoryError::NotFound(err.to_string()),
            diesel::result::Error::DatabaseError(db_kind, info) => {
                match db_kind {
                    diesel::result::DatabaseErrorKind::UniqueViolation =>
                        RepositoryError::Validation(format!("Unique constraint: {}", info.message())),
                    diesel::result::DatabaseErrorKind::ForeignKeyViolation =>
                        RepositoryError::Validation(format!("Foreign key violation: {}", info.message())),
                    _ => RepositoryError::Database(info.message().to_string()),
                }
            }
            _ => RepositoryError::Database(err.to_string()),
        }
    }
}

impl From<diesel::r2d2::PoolError> for RepositoryError {
    fn from(err: diesel::r2d2::PoolError) -> Self {
        RepositoryError::Database(err.to_string())
    }
}

impl From<DomainError> for RepositoryError {
    fn from(err: DomainError) -> Self {
        match err {
            DomainError::Validation(msg) => RepositoryError::Validation(msg),
            DomainError::NotFound(msg) => RepositoryError::NotFound(msg),
            DomainError::BusinessRule(msg) => RepositoryError::Validation(msg),
            DomainError::Generic(msg) => RepositoryError::Database(msg),
        }
    }
}

// ── Layer 3: ServiceError ─────────────────────────────────────────────────────

/// Errors originating from the service / orchestration layer.
#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Business rule violation: {0}")]
    BusinessRule(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<RepositoryError> for ServiceError {
    fn from(err: RepositoryError) -> Self {
        match err {
            RepositoryError::NotFound(msg) => ServiceError::NotFound(msg),
            RepositoryError::Validation(msg) => ServiceError::Validation(msg),
            RepositoryError::Database(msg) => ServiceError::Database(msg),
            RepositoryError::Serialization(msg) => ServiceError::Internal(msg),
            RepositoryError::Transaction(msg) => ServiceError::Database(msg),
        }
    }
}

impl From<DomainError> for ServiceError {
    fn from(err: DomainError) -> Self {
        match err {
            DomainError::Validation(msg) => ServiceError::Validation(msg),
            DomainError::BusinessRule(msg) => ServiceError::BusinessRule(msg),
            DomainError::NotFound(msg) => ServiceError::NotFound(msg),
            DomainError::Generic(msg) => ServiceError::Internal(msg),
        }
    }
}

impl From<diesel::result::Error> for ServiceError {
    fn from(err: diesel::result::Error) -> Self {
        let repo_err: RepositoryError = err.into();
        ServiceError::from(repo_err)
    }
}

// ── Layer 4: ApiError ─────────────────────────────────────────────────────────

/// A structured API error sent over HTTP.
#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<FieldError>>,
    #[serde(skip)]
    pub status: StatusCode,
}

/// A field-level validation error.
#[derive(Debug, Clone, Serialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>, status: StatusCode) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
            status,
        }
    }

    pub fn with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: Vec<FieldError>,
        status: StatusCode,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: Some(details),
            status,
        }
    }

    /// Create an unauthorized (401) error.
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            code: "UNAUTHORIZED".into(),
            message: message.into(),
            details: None,
            status: StatusCode::UNAUTHORIZED,
        }
    }
}

impl From<ServiceError> for ApiError {
    fn from(err: ServiceError) -> Self {
        match err {
            ServiceError::NotFound(msg) => {
                ApiError::new("NOT_FOUND", msg, StatusCode::NOT_FOUND)
            }
            ServiceError::Validation(msg) => {
                ApiError::new("VALIDATION_ERROR", msg, StatusCode::BAD_REQUEST)
            }
            ServiceError::BusinessRule(msg) => {
                ApiError::new("BUSINESS_RULE_ERROR", msg, StatusCode::UNPROCESSABLE_ENTITY)
            }
            ServiceError::Database(msg) => {
                ApiError::new("DATABASE_ERROR", msg, StatusCode::INTERNAL_SERVER_ERROR)
            }
            ServiceError::Conflict(msg) => {
                ApiError::new("CONFLICT", msg, StatusCode::CONFLICT)
            }
            ServiceError::Unauthorized(msg) => {
                ApiError::new("UNAUTHORIZED", msg, StatusCode::UNAUTHORIZED)
            }
            ServiceError::Forbidden(msg) => {
                ApiError::new("FORBIDDEN", msg, StatusCode::FORBIDDEN)
            }
            ServiceError::Internal(msg) => {
                ApiError::new("INTERNAL_ERROR", msg, StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}

/// Default 500 for unexpected ApiError construction without explicit status.
impl IntoResponse for ServiceError {
    fn into_response(self) -> Response {
        let api_error: ApiError = self.into();
        api_error.into_response()
    }
}

impl Default for ApiError {
    fn default() -> Self {
        Self {
            code: "INTERNAL_ERROR".into(),
            message: "An unexpected error occurred".into(),
            details: None,
            status: StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status;
        let mut resp = axum::Json(self).into_response();
        *resp.status_mut() = status;
        resp
    }
}
