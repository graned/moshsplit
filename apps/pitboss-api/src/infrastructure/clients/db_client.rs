//! Diesel + r2d2 Postgres connection pool wrapper.
//!
//! Provides a shared `r2d2::Pool<ConnectionManager<PgConnection>>` with
//! automatic migration support via `diesel_migrations::embed_migrations!`.

use diesel::pg::PgConnection;
use diesel::r2d2::{self, ConnectionManager};
use diesel::sql_query;
use diesel::RunQueryDsl;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use serde::Serialize;
use uuid::Uuid;

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

    /// Get all distinct user IDs that are members of at least one event.
    pub fn get_moshsplit_user_ids(&self) -> Result<Vec<Uuid>, crate::errors::RepositoryError> {
        use diesel::deserialize::QueryableByName;

        let mut conn = self.get_conn()?;

        #[derive(QueryableByName)]
        struct IdRow {
            #[diesel(sql_type = diesel::sql_types::Uuid)]
            pub user_id: Uuid,
        }

        let rows: Vec<IdRow> = sql_query("SELECT DISTINCT user_id FROM app.event_member")
            .get_results(&mut conn)
            .map_err(crate::errors::RepositoryError::from)?;

        Ok(rows.into_iter().map(|r| r.user_id).collect())
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

/// A read-only client for the Sentinel auth database.
/// Used to fetch user list for member selection in events/expenses.
#[derive(Clone, Debug)]
pub struct SentinelAuthClient {
    pool: DbPool,
}

impl SentinelAuthClient {
    /// Create a new connection pool for sentinel_auth database.
    /// Also ensures the pitboss user has SELECT access on auth tables (idempotent).
    pub fn new(database_url: &str) -> Result<Self, r2d2::PoolError> {
        let client = DbClient::new(database_url)?;
        let pool = client.pool.clone();
        let result = Self { pool };

        let _ = result.ensure_permissions();

        Ok(result)
    }

    /// Grant SELECT permissions to the pitboss role on sentinel_auth tables.
    /// Idempotent — safe to call on every startup.
    fn ensure_permissions(&self) -> Result<(), crate::errors::RepositoryError> {
        let mut conn = self.pool.get().map_err(|e| {
            crate::errors::RepositoryError::Database(format!("Connection pool error: {}", e))
        })?;
        sql_query("GRANT USAGE ON SCHEMA public TO pitboss")
            .execute(&mut conn)
            .ok();
        sql_query("GRANT SELECT ON ALL TABLES IN SCHEMA public TO pitboss")
            .execute(&mut conn)
            .ok();
        Ok(())
    }

    /// Get a connection with search_path set to auth schema.
    pub fn get_conn(
        &self,
    ) -> Result<r2d2::PooledConnection<ConnectionManager<PgConnection>>, r2d2::PoolError> {
        let mut conn = self.pool.get()?;
        sql_query("SET search_path TO auth, public")
            .execute(&mut conn)
            .ok();
        Ok(conn)
    }

    /// Look up a user's UUID by their email in the Sentinel auth database.
    ///
    /// Returns `Ok(Some(user_id))` if found, `Ok(None)` if no user with that email exists.
    ///
    /// Note: The Sentinel auth service stores its tables in the `public` schema
    /// of the `sentinel_auth` database. The `users` table holds user metadata
    /// (user_id, display_name, etc.) and `user_identities` maps emails to users.
    /// We join both to resolve email → user_id.
    pub fn find_user_id_by_email(
        &self,
        email: &str,
    ) -> Result<Option<Uuid>, crate::errors::RepositoryError> {
        use diesel::deserialize::QueryableByName;
        use diesel::OptionalExtension;
        let mut conn = self.get_conn().map_err(|e| {
            crate::errors::RepositoryError::Database(format!("Connection pool error: {}", e))
        })?;

        #[derive(Debug, QueryableByName)]
        struct IdRow {
            #[diesel(sql_type = diesel::sql_types::Uuid)]
            pub id: Uuid,
        }

        let sql = "\
            SELECT u.user_id AS id \
            FROM public.users u \
            JOIN public.user_identities ui ON u.user_id = ui.user_id \
            WHERE ui.email = $1 AND ui.is_primary = true \
            LIMIT 1";
        let result: Option<IdRow> = sql_query(sql)
            .bind::<diesel::sql_types::Text, _>(email)
            .get_result(&mut conn)
            .optional()
            .map_err(|e| crate::errors::RepositoryError::Database(e.to_string()))?;

        Ok(result.map(|r| r.id))
    }

    /// Fetch active users from the Sentinel auth database, filtered by the
    /// given set of user IDs (must be members of at least one MoshSplit event).
    /// Joins `public.users` and `public.user_identities` on `user_id`.
    pub fn list_users(
        &self,
        user_ids: &[Uuid],
    ) -> Result<Vec<UserRow>, crate::errors::RepositoryError> {
        use diesel::sql_types::{Array, Uuid as SqlUuid};

        if user_ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut conn = self.get_conn().map_err(|e| {
            crate::errors::RepositoryError::Database(format!("Connection pool error: {}", e))
        })?;

        let ids: Vec<Uuid> = user_ids.to_vec();

        let sql = "\
            SELECT u.user_id, u.first_name, u.last_name, ui.email \
            FROM public.users u \
            JOIN public.user_identities ui ON u.user_id = ui.user_id \
            WHERE u.status = 'active' AND ui.is_primary = true \
              AND u.user_id = ANY($1) \
            ORDER BY u.first_name, u.last_name";
        let rows: Vec<UserRow> = sql_query(sql)
            .bind::<Array<SqlUuid>, _>(&ids)
            .get_results(&mut conn)
            .map_err(|e| crate::errors::RepositoryError::Database(e.to_string()))?;

        Ok(rows)
    }
}

/// A raw user row from the `public.users` + `public.user_identities` join.
#[derive(Debug, Clone, Serialize, diesel::QueryableByName)]
pub struct UserRow {
    #[diesel(sql_type = diesel::sql_types::Uuid)]
    pub user_id: Uuid,
    #[diesel(sql_type = diesel::sql_types::Text)]
    pub first_name: String,
    #[diesel(sql_type = diesel::sql_types::Text)]
    pub last_name: String,
    #[diesel(sql_type = diesel::sql_types::Text)]
    pub email: String,
}
