//! OpenAPI / Swagger documentation for the pitboss-api.
//!
//! Defines the `ApiDoc` struct (via `utoipa::OpenApi` derive) and the
//! component schemas needed to describe the API response envelope.

use serde::Serialize;
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::openapi::{ComponentsBuilder, OpenApi};
use utoipa::Modify;
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
        // system
        super::handlers::system_handlers::health_check,
        super::handlers::system_handlers::livez,
        // events
        super::handlers::event_handlers::list_events,
        super::handlers::event_handlers::create_event,
        super::handlers::event_handlers::get_event,
        super::handlers::event_handlers::patch_event,
        super::handlers::event_handlers::delete_event,
        // members
        super::handlers::member_handlers::list_members,
        super::handlers::member_handlers::add_member,
        super::handlers::member_handlers::remove_member,
        // expenses
        super::handlers::expense_handlers::list_expenses,
        super::handlers::expense_handlers::create_expense,
        super::handlers::expense_handlers::get_expense,
        super::handlers::expense_handlers::update_expense,
        super::handlers::expense_handlers::delete_expense,
        super::handlers::expense_handlers::list_expense_versions,
        // payments
        super::handlers::payment_handlers::list_payments,
        super::handlers::payment_handlers::create_payment,
        super::handlers::payment_handlers::get_payment,
        // settlements
        super::handlers::settlement_handlers::list_settlements,
        super::handlers::settlement_handlers::propose_settlement,
        super::handlers::settlement_handlers::update_settlement_status,
        super::handlers::settlement_handlers::get_settlement,
        // balances
        super::handlers::balance_handlers::all_balances,
        super::handlers::balance_handlers::user_balance,
        super::handlers::balance_handlers::simplified_debts,
        super::handlers::balance_handlers::explain_balance,
        super::handlers::balance_handlers::balance_stats,
        // stats
        super::handlers::stats_handlers::get_event_stats,
        // event images
        super::handlers::event_image_handlers::list_event_images,
        super::handlers::event_image_handlers::create_event_image,
        super::handlers::event_image_handlers::update_event_image,
        super::handlers::event_image_handlers::delete_event_image,
        // admin
        super::handlers::admin_handlers::list_audit_entries,
        super::handlers::admin_handlers::get_admin_stats,
    ),
    components(schemas(
        // envelope
        ApiResponseEnvelope,
        ApiErrorSchema,
        FieldErrorSchema,
        // event
        super::dtos::event_dtos::CreateEventRequest,
        super::dtos::event_dtos::UpdateEventRequest,
        super::dtos::event_dtos::EventResponse,
        super::dtos::event_dtos::EventListItem,
        // event image
        super::dtos::event_image_dtos::CreateEventImageRequest,
        super::dtos::event_image_dtos::UpdateEventImageRequest,
        super::dtos::event_image_dtos::EventImageResponse,
        super::dtos::event_image_dtos::EventImagesResponse,
        // member
        super::dtos::member_dtos::AddMemberRequest,
        super::dtos::member_dtos::MemberListItem,
        // expense
        super::dtos::expense_dtos::CreateExpenseRequest,
        super::dtos::expense_dtos::UpdateExpenseRequest,
        super::dtos::expense_dtos::ExpenseResponse,
        super::dtos::expense_dtos::ExpenseListItem,
        super::dtos::expense_dtos::ExpenseVersionResponse,
        super::dtos::expense_dtos::ExpenseVersionDetail,
        super::dtos::expense_dtos::ExpenseVersionShareItem,
        // payment
        super::dtos::payment_dtos::CreatePaymentRequest,
        super::dtos::payment_dtos::PaymentResponse,
        super::dtos::payment_dtos::PaymentListItem,
        // settlement
        super::dtos::settlement_dtos::CreateSettlementRequest,
        super::dtos::settlement_dtos::UpdateSettlementStatusRequest,
        super::dtos::settlement_dtos::SettlementResponse,
        super::dtos::settlement_dtos::SettlementListItem,
        // balance
        super::dtos::balance_dtos::UserBalanceItem,
        super::dtos::balance_dtos::UserBalanceResponse,
        super::dtos::balance_dtos::BalancesResponse,
        super::dtos::balance_dtos::DebtTransfer,
        super::dtos::balance_dtos::SimplifiedDebtsResponse,
        super::dtos::balance_dtos::ExpenseBreakdown,
        super::dtos::balance_dtos::PaymentBreakdown,
        super::dtos::balance_dtos::SettlementBreakdown,
        super::dtos::balance_dtos::ExplainBalanceResponse,
        // stats
        super::dtos::stats_dtos::EventStats,
        // admin
        super::dtos::admin_dtos::AuditEntry,
        super::dtos::admin_dtos::AuditLogResponse,
        super::dtos::admin_dtos::AdminStats,
        super::dtos::admin_dtos::SystemHealth,
        // common
        super::dtos::common::PaginatedResponse<super::dtos::event_dtos::EventListItem>,
        super::dtos::common::PaginationMeta,
    )),
    tags(
        (name = "System", description = "System health and readiness endpoints"),
        (name = "Events", description = "Event CRUD operations"),
        (name = "Event Images", description = "Event image management (banner + gallery)"),
        (name = "Members", description = "Event member management"),
        (name = "Expenses", description = "Expense CRUD with versioning"),
        (name = "Payments", description = "Payment recording"),
        (name = "Settlements", description = "Settlement proposal and confirmation"),
        (name = "Balances", description = "Balance computation and debt simplification"),
        (name = "Stats", description = "Event statistics and settlement progress"),
        (name = "Admin", description = "Admin-only endpoints (audit log, system stats)"),
    ),
)]
pub struct ApiDoc;

/// OpenAPI documentation for the external-facing API.
///
/// Includes only the endpoints meant for external consumers:
/// - `POST /v1/auth/external-login` — uses `bearer_auth` (API token)
/// - `POST /v1/balances/external-summary` — uses `api_token_auth` (API token)
/// Each endpoint has its own security scheme to reflect the different auth flows.
struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut OpenApi) {
        let components = openapi.components.get_or_insert_with(|| {
            ComponentsBuilder::new().build()
        });

        // Bearer auth for external-login (API token)
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .description(Some("API token used as Bearer token in Authorization header"))
                    .build(),
            ),
        );

        // API token auth for external-summary (different key name to distinguish)
        components.add_security_scheme(
            "api_token_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("API Token")
                    .description(Some("External API token (sat_...) used as Bearer token in Authorization header"))
                    .build(),
            ),
        );
    }
}

#[derive(utoipa::OpenApi)]
#[openapi(
    paths(
        super::handlers::auth_handlers::external_login,
        super::handlers::balance_handlers::external_summary,
    ),
    components(schemas(
        super::handlers::auth_handlers::ExternalLoginRequest,
        super::dtos::balance_dtos::ExternalBalanceSummaryRequest,
        super::dtos::balance_dtos::ExternalBalanceSummaryResponse,
        super::dtos::balance_dtos::ExternalBalanceItem,
    )),
    modifiers(&SecurityAddon),
    tags(
        (name = "External", description = "External-facing endpoints for third-party consumers"),
    ),
)]
pub struct ExternalApiDoc;
