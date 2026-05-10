//! Domain services — stateless business logic that doesn't fit on an entity.
//!
//! Examples: balance computation, split calculation, debt simplification.

pub mod balance_service;
pub mod event_service;
pub mod expense_service;
pub mod member_service;
pub mod payment_service;
pub mod settlement_service;
