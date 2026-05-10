//! Infrastructure clients — database, cache, external services.

pub mod pg_client;
pub use pg_client::PostgresClient;
