//! Handlers for Admin endpoints — audit log and system stats.

use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;

use crate::errors::ServiceError;
use crate::infrastructure::http::api::dtos::admin_dtos::{
    AdminStats, AuditLogResponse, ListAuditParams,
};
use crate::infrastructure::http::AppState;
use crate::services::admin_stats_service::AdminStatsService;
use crate::services::audit_service::AuditService;

/// GET /v1/admin/audit — list audit log entries.
#[utoipa::path(
    get,
    path = "/v1/admin/audit",
    params(
        ("cursor" = Option<String>, Query, description = "Pagination cursor (encodes created_at + id)"),
        ("limit" = Option<i64>, Query, description = "Max results (default 20, max 100)"),
    ),
    responses(
        (status = 200, description = "Audit log entries", body = AuditLogResponse),
        (status = 403, description = "Admin role required"),
    ),
    tag = "Admin"
)]
pub async fn list_audit_entries(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListAuditParams>,
) -> Result<Json<AuditLogResponse>, ServiceError> {
    let svc = AuditService::new(state.db_client.clone());
    let response = svc.list_entries(params.cursor.as_deref(), params.limit())?;
    Ok(Json(response))
}

/// GET /v1/admin/stats — system-wide admin statistics.
#[utoipa::path(
    get,
    path = "/v1/admin/stats",
    responses(
        (status = 200, description = "Admin statistics", body = AdminStats),
        (status = 403, description = "Admin role required"),
    ),
    tag = "Admin"
)]
pub async fn get_admin_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AdminStats>, ServiceError> {
    let svc = AdminStatsService::new(state.db_client.clone());
    let stats = svc.get_stats()?;
    Ok(Json(stats))
}
