//! Infrastructure clients — database, cache, external services.

pub mod db_client;
pub use db_client::{DbClient, SentinelAuthClient};
