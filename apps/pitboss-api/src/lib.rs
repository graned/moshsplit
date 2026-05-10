//! pitboss-api — MoshSplit shared-expense platform backend.
//!
//! # Architecture
//!
//! Follows the Sentinel Clean Architecture pattern adapted for Diesel:
//!
//! ```text
//! applications/      Use-case orchestrators (thin)
//! services/          Domain / business logic
//! domain/            Entities, value objects, repository traits
//! infrastructure/
//!   clients/         Database, cache, external service clients
//!   http/            Axum server, router, middleware, handlers
//! utils/             Macros and helpers
//! ```
//!
//! See `docs/architecture/` for full design documentation.

pub mod applications;
pub mod domain;
pub mod errors;
pub mod infrastructure;
pub mod schema;
pub mod schema_enums;
pub mod schema_enums_impls;
pub mod schema_models;
pub mod services;
pub mod utils;

// Convenience re-exports so consumers can write `pitboss_api::http::app::build_app`.
pub mod http {
    //! Re-exports from `infrastructure::http` for ergonomic access.
    pub use crate::infrastructure::http::*;
}
