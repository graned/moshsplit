//! SQLx-based Postgres connection pool wrapper.
//!
//! Provides a shared `PgPool` with a configured schema search path.

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// A wrapper around `sqlx::PgPool` with application-level defaults.
#[derive(Clone, Debug)]
pub struct PostgresClient {
    pub pool: PgPool,
}

impl PostgresClient {
    /// Creates a new connection pool, sets the `search_path` to `app,public`.
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .connect(database_url)
            .await?;

        // Set search_path so all queries in the `app` schema work without
        // schema-qualified names.
        sqlx::query("SET search_path TO app, public")
            .execute(&pool)
            .await?;

        Ok(Self { pool })
    }

    /// Create a PostgresClient from an existing PgPool (e.g. in tests).
    pub fn from_pool(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Access the inner pool directly.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Run SQLx migrations from the `migrations/` directory.
    pub async fn run_migrations(&self) -> Result<(), sqlx::migrate::MigrateError> {
        let migrator = sqlx::migrate::Migrator::new(std::path::Path::new("./migrations"))
            .await?;
        migrator.run(&self.pool).await
    }
}
