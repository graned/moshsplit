//! HTTP layer — server, app factory, middleware, handlers, types.

pub mod api;
pub mod app;
pub mod server;

use crate::infrastructure::clients::DbClient;

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
}
