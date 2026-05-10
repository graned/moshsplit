//! OpenAPI / Swagger documentation for the pitboss-api.
//!
//! Defines the `ApiDoc` struct (via `utoipa::OpenApi` derive) and the
//! component schemas needed to describe the API response envelope.

use serde::Serialize;
use utoipa::ToSchema;

/// The standard JSON envelope returned by every API response.
///
/// Mirrors the wire format produced by `ResponseWrapper` middleware.
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiResponseEnvelope {
    /// Indicates whether the request succeeded.
    pub success: bool,
    /// The response payload (present on success, null on error).
    pub data: Option<serde_json::Value>,
    /// Error details (present on error, null on success).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiErrorSchema>,
    /// ISO 8601 timestamp of the response.
    pub timestamp: String,
    /// Unique request identifier for tracing.
    pub request_id: String,
}

/// A structured API error returned in the envelope.
#[derive(Debug, Serialize, ToSchema)]
pub struct ApiErrorSchema {
    /// Machine-readable error code (e.g. `NOT_FOUND`, `VALIDATION_ERROR`).
    pub code: String,
    /// Human-readable error message.
    pub message: String,
    /// Optional field-level validation errors.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<FieldErrorSchema>>,
}

/// A field-level validation error.
#[derive(Debug, Serialize, ToSchema)]
pub struct FieldErrorSchema {
    /// The name of the field that failed validation.
    pub field: String,
    /// A description of the validation failure.
    pub message: String,
}

/// Aggregated OpenAPI documentation for the pitboss-api.
#[derive(utoipa::OpenApi)]
#[openapi(
    paths(
        super::handlers::system_handlers::health_check,
        super::handlers::system_handlers::livez,
    ),
    components(schemas(
        ApiResponseEnvelope,
        ApiErrorSchema,
        FieldErrorSchema,
    )),
    tags(
        (name = "System", description = "System health and readiness endpoints")
    ),
)]
pub struct ApiDoc;
