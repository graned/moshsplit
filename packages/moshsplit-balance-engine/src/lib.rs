//! # MoshSplit Balance Engine
//!
//! Pure Rust computation engine for balance calculation, debt simplification,
//! and proportional redistribution of expense shares.
//!
//! This crate is deliberately free of database, HTTP, or infrastructure
//! dependencies. All functions are pure transformations of input data.

pub mod balance;
pub mod redistribute;
pub mod simplified;
pub mod types;

pub use balance::compute_balance;
pub use redistribute::redistribute_shares;
pub use simplified::simplified_debts;
pub use types::{ExpenseShare, Payment, SimplifiedTransfer, UserBalance};

#[cfg(test)]
mod tests;
