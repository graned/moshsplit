//! Domain services — stateless business logic that doesn't fit on an entity.
//!
//! Examples: balance computation, split calculation, debt simplification.

pub mod activity_service;
pub mod admin_stats_service;
pub mod audit_service;
pub mod balance_service;
pub mod credit_service;
pub mod event_image_service;
pub mod event_service;
pub mod expense_service;
pub mod member_service;
pub mod payment_service;
pub mod stats_service;
