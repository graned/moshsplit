//! Diesel + r2d2 Postgres connection pool wrapper.
//!
//! Provides a shared `r2d2::Pool<ConnectionManager<PgConnection>>` with
//! automatic migration support via `diesel_migrations::embed_migrations!`.

use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use diesel::sql_query;
use diesel::RunQueryDsl;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

/// The embedded Diesel migrations (discovered at compile time from
/// the `migrations/` directory).
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

/// Type alias for the r2d2 connection pool used throughout the app.
pub type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

/// A shared, thread-safe Postgres client backed by Diesel + r2d2.
#[derive(Clone, Debug)]
pub struct DbClient {
    pub pool: DbPool,
}

impl DbClient {
    /// Create a new connection pool, connect, and set the `search_path`.
    pub fn new(database_url: &str) -> Result<Self, r2d2::PoolError> {
        let manager = ConnectionManager::<PgConnection>::new(database_url);
        let pool = r2d2::Pool::builder().max_size(20).build(manager)?;
        Ok(Self { pool })
    }

    /// Run all pending Diesel migrations (idempotent).
    /// Sets `search_path` to `app, public` before running so that
    /// Diesel's internal migration tracking table is created in the
    /// `public` schema (accessible by the app user).
    pub fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.pool.get()?;
        sql_query("SET search_path TO app, public")
            .execute(&mut conn)
            .ok();
        conn.run_pending_migrations(MIGRATIONS).map(|_| ())?;
        Ok(())
    }

    /// Access the underlying connection pool.
    pub fn pool(&self) -> &DbPool {
        &self.pool
    }

    /// Get a single connection from the pool with `search_path` set to `app, public`.
    pub fn get_conn(
        &self,
    ) -> Result<r2d2::PooledConnection<ConnectionManager<PgConnection>>, r2d2::PoolError> {
        let mut conn = self.pool.get()?;
        sql_query("SET search_path TO app, public")
            .execute(&mut conn)
            .ok();
        Ok(conn)
    }
}
