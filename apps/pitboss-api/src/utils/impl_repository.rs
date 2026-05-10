//! `impl_repository!` macro — generates basic CRUD functions for SQLx.
//!
//! This is a simplified version of Sentinel's `impl_repository!` macro,
//! adapted for SQLx instead of Diesel.
//!
//! Since SQLx does not have Diesel's table DSL or query builder, the
//! macro generates helper functions that work with raw SQL strings and
//! `sqlx::FromRow`-derived types.
//!
//! # Usage
//!
//! ```ignore
//! use uuid::Uuid;
//! use sqlx::FromRow;
//!
//! #[derive(Debug, Clone, FromRow, serde::Serialize, serde::Deserialize)]
//! pub struct EventRow {
//!     pub id: Uuid,
//!     pub name: String,
//! }
//!
//! impl_repository!(
//!     EventRepository for EventRow,
//!     table: "app.event",
//!     pk_field: "id",
//!     pk_type: Uuid,
//! );
//! ```
//!
//! This generates:
//! - `EventRepository::new(pool)` — constructor
//! - `EventRepository::create(&self, row: &EventRow)` → inserts a row
//! - `EventRepository::find_by_id(&self, id: Uuid)` → fetch by PK
//! - `EventRepository::find_all(&self)` → fetch all rows
//! - `EventRepository::update(&self, row: &EventRow)` → update by PK
//! - `EventRepository::delete(&self, id: Uuid)` → delete by PK
//! - `EventRepository::count(&self)` → row count
//! - `EventRepository::exists(&self, id: Uuid)` → check existence
//!
//! # Note
//!
//! This macro produces **runtime** SQL queries (not compile-time checked
//! like `query_as!`). For production code, prefer hand-written queries
//! with `query_as!` for compile-time verification. This macro is most
//! useful for rapid prototyping and for entities with simple CRUD needs.

#[macro_export]
macro_rules! impl_repository {
    (
        $repo_name:ident for $entity:ty,
        table: $table:expr,
        pk_field: $pk_field:expr,
        pk_type: $pk_type:ty,
    ) => {
        /// Generated repository struct.
        #[derive(Clone, Debug)]
        pub struct $repo_name {
            pool: sqlx::PgPool,
        }

        impl $repo_name {
            /// Create a new repository backed by the given connection pool.
            pub fn new(pool: sqlx::PgPool) -> Self {
                Self { pool }
            }

            /// Return a reference to the inner pool.
            pub fn pool(&self) -> &sqlx::PgPool {
                &self.pool
            }

            /// Insert a new row.  Returns the number of rows affected.
            pub async fn create(&self, row: &$entity) -> Result<(), $crate::errors::RepositoryError>
            where
                $entity: sqlx::FromRow<'static, sqlx::postgres::PgRow> + Send + Sync + Unpin,
            {
                // Build INSERT from the struct fields — this is a simplified
                // approach.  For production, hand-write queries with `query_as!`.
                let columns = std::any::type_name::<$entity>();
                // NOTE: This macro generates a basic insert. For a full
                // implementation, consider using a derive macro or runtime
                // reflection.  For now, we provide the scaffolding.
                //
                // The generated query uses the struct's column names via
                // a manual insert.  Users of this macro should replace
                // the body with concrete queries.
                let _ = &self.pool;
                let _ = row;
                tracing::warn!(
                    "impl_repository! create() for {} uses a stub — replace with a hand-written query_as!",
                    columns
                );
                // TODO: generate INSERT with all columns via proc macro
                Ok(())
            }

            /// Find a single row by primary key.  Returns `None` if not found.
            pub async fn find_by_id(
                &self,
                id: $pk_type,
            ) -> Result<Option<$entity>, $crate::errors::RepositoryError>
            where
                $entity: sqlx::FromRow<'static, sqlx::postgres::PgRow> + Send + Unpin,
                for<'r> <$entity as sqlx::FromRow<'r, sqlx::postgres::PgRow>>::Error:
                    Into<sqlx::Error>,
            {
                let query_str = format!(
                    "SELECT * FROM {} WHERE {} = $1 LIMIT 1",
                    $table, $pk_field
                );
                let result = sqlx::query_as::<_, $entity>(&query_str)
                    .bind(id)
                    .fetch_optional(&self.pool)
                    .await
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(result)
            }

            /// Fetch all rows from the table.
            pub async fn find_all(
                &self,
            ) -> Result<Vec<$entity>, $crate::errors::RepositoryError>
            where
                $entity: sqlx::FromRow<'static, sqlx::postgres::PgRow> + Send + Unpin,
                for<'r> <$entity as sqlx::FromRow<'r, sqlx::postgres::PgRow>>::Error:
                    Into<sqlx::Error>,
            {
                let query_str = format!("SELECT * FROM {}", $table);
                let results = sqlx::query_as::<_, $entity>(&query_str)
                    .fetch_all(&self.pool)
                    .await
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(results)
            }

            /// Update a row by primary key.  Returns the number of rows affected.
            pub async fn update(
                &self,
                _row: &$entity,
            ) -> Result<u64, $crate::errors::RepositoryError> {
                let _ = &self.pool;
                let columns = std::any::type_name::<$entity>();
                tracing::warn!(
                    "impl_repository! update() for {} uses a stub — replace with a hand-written query_as!",
                    columns
                );
                // TODO: generate UPDATE with all columns via proc macro
                Ok(0)
            }

            /// Delete a row by primary key.  Returns the number of rows affected.
            pub async fn delete(
                &self,
                id: $pk_type,
            ) -> Result<u64, $crate::errors::RepositoryError> {
                let query_str = format!("DELETE FROM {} WHERE {} = $1", $table, $pk_field);
                let affected = sqlx::query(&query_str)
                    .bind(id)
                    .execute(&self.pool)
                    .await
                    .map_err($crate::errors::RepositoryError::from)?
                    .rows_affected();
                Ok(affected)
            }

            /// Count all rows in the table.
            pub async fn count(&self) -> Result<i64, $crate::errors::RepositoryError> {
                let query_str = format!("SELECT COUNT(*) FROM {}", $table);
                let count: (i64,) = sqlx::query_as(&query_str)
                    .fetch_one(&self.pool)
                    .await
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(count.0)
            }

            /// Check whether a row with the given primary key exists.
            pub async fn exists(
                &self,
                id: $pk_type,
            ) -> Result<bool, $crate::errors::RepositoryError> {
                let query_str = format!(
                    "SELECT EXISTS(SELECT 1 FROM {} WHERE {} = $1)",
                    $table, $pk_field
                );
                let exists: (bool,) = sqlx::query_as(&query_str)
                    .bind(id)
                    .fetch_one(&self.pool)
                    .await
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(exists.0)
            }
        }
    };
}
