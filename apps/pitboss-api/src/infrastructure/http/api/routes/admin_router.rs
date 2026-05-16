//! Admin route definitions — protected by admin role middleware.

use std::sync::Arc;

use axum::middleware;
use axum::routing::get;
use axum::Router;

use crate::infrastructure::http::api::handlers::admin_handlers;
use crate::infrastructure::http::api::middlewares::admin_role_middleware;
use crate::infrastructure::http::AppState;

/// Build the admin routes with admin role protection.
///
/// All routes under `/v1/admin/*` require the authenticated user to have
/// an "admin" role.
pub fn build_admin_router() -> Router<Arc<AppState>> {
    let admin_routes = Router::new()
        .route("/v1/admin/audit", get(admin_handlers::list_audit_entries))
        .route("/v1/admin/stats", get(admin_handlers::get_admin_stats));

    // Apply admin role middleware to all admin routes
    admin_routes.layer(middleware::from_fn(admin_role_middleware::require_admin))
}
