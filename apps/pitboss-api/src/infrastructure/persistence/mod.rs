//! Repository implementations — one module per database table.
//!
//! Each repository provides CRUD operations plus domain-specific queries
//! using Diesel's type-safe query builder.

pub mod balance_repo;
pub mod event_repo;
pub mod expense_repo;
pub mod expense_version_repo;
pub mod expense_version_share_repo;
pub mod member_repo;
pub mod payment_repo;
pub mod settlement_repo;

pub use balance_repo::BalanceRepository;
pub use event_repo::EventRepository;
pub use expense_repo::ExpenseRepository;
pub use expense_version_repo::ExpenseVersionRepository;
pub use expense_version_share_repo::ExpenseVersionShareRepository;
pub use member_repo::EventMemberRepository;
pub use payment_repo::PaymentRepository;
pub use settlement_repo::SettlementRepository;
