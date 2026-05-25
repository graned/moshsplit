//! HTTP layer — server, app factory, middleware, handlers, types.

pub mod api;
pub mod app;
pub mod server;

use crate::infrastructure::clients::{DbClient, SentinelAuthClient};
use sentinel_client::SentinelClient;

/// Shared application state injected via `Extension<AppState>` into all
/// handler functions.
///
/// Each domain aggregate has an `Arc<Application>` handle. As the
/// service grows, add fields here:
/// ```ignore
/// pub event_app: Arc<EventApplication>,
/// pub expense_app: Arc<ExpenseApplication>,
/// pub payment_app: Arc<PaymentApplication>,
/// pub settlement_app: Arc<SettlementApplication>,
/// ```
#[derive(Clone)]
pub struct AppState {
    pub db_client: DbClient,
    pub sentinel_client: SentinelClient,
    /// Read-only client for sentinel_auth database (for user list)
    pub sentinel_auth_client: SentinelAuthClient,
    /// Frontend base URL for SSO redirect flows (e.g. http://localhost:5173)
    pub frontend_base_url: String,
}
