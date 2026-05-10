//! `impl_repository!` macro — generates basic CRUD functions for Diesel.
//!
//! This is a simplified version of Sentinel's `impl_repository!` macro,
//! adapted for Diesel instead of SQLx.
//!
//! The macro generates helper functions that work with Diesel's query
//! builder using a table expression and primary key column expression.
//!
//! # Usage
//!
//! ```ignore
//! use uuid::Uuid;
//! use diesel::prelude::*;
//!
//! #[derive(Debug, Clone, Queryable, Insertable, AsChangeset, serde::Serialize, serde::Deserialize)]
//! #[diesel(table_name = app_event)]
//! pub struct EventRow {
//!     pub id: Uuid,
//!     pub name: String,
//! }
//!
//! impl_repository!(
//!     EventRepository for EventRow,
//!     table: app_event::table,       // table value (Diesel unit struct)
//!     pk_column: app_event::id,      // primary key column expression
//!     pk_type: Uuid,
//! );
//! ```
//!
//! This generates:
//! - `EventRepository::new(db_client)` — constructor
//! - `EventRepository::create(&self, row: &EventRow)` → inserts a row
//! - `EventRepository::find_by_id(&self, id: Uuid)` → fetch by PK
//! - `EventRepository::find_all(&self)` → fetch all rows
//! - `EventRepository::delete(&self, id: Uuid)` → delete by PK
//! - `EventRepository::count(&self)` → row count
//! - `EventRepository::exists(&self, id: Uuid)` → check existence
//!
//! For updates, hand-write methods with explicit changeset structs.
//!
//! # Note
//!
//! This macro is intended for rapid prototyping.  For production code,
//! prefer hand-written repositories with explicit Diesel queries for
//! compile-time verification and fine-grained control.

#[macro_export]
macro_rules! impl_repository {
    (
        $repo_name:ident for $entity:ty,
        table: $table:expr,
        pk_column: $pk_column:expr,
        pk_type: $pk_type:ty,
    ) => {
        /// Generated repository struct.
        #[derive(Clone, Debug)]
        pub struct $repo_name {
            db_client: $crate::infrastructure::clients::DbClient,
        }

        impl $repo_name {
            /// Create a new repository backed by the given DbClient.
            pub fn new(db_client: $crate::infrastructure::clients::DbClient) -> Self {
                Self { db_client }
            }

            /// Return a reference to the inner DbClient.
            pub fn db_client(&self) -> &$crate::infrastructure::clients::DbClient {
                &self.db_client
            }

            /// Insert a new row.
            pub fn create(&self, row: &$entity) -> Result<(), $crate::errors::RepositoryError> {
                let mut conn = self.db_client.get_conn()?;
                diesel::insert_into($table)
                    .values(row)
                    .execute(&mut conn)
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(())
            }

            /// Find a single row by primary key.  Returns `None` if not found.
            pub fn find_by_id(
                &self,
                id: $pk_type,
            ) -> Result<Option<$entity>, $crate::errors::RepositoryError> {
                use diesel::QueryDsl;
                use diesel::RunQueryDsl;
                let mut conn = self.db_client.get_conn()?;
                let result = $table
                    .find(id)
                    .first::<$entity>(&mut conn)
                    .optional()
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(result)
            }

            /// Fetch all rows from the table.
            pub fn find_all(
                &self,
            ) -> Result<Vec<$entity>, $crate::errors::RepositoryError> {
                use diesel::RunQueryDsl;
                let mut conn = self.db_client.get_conn()?;
                let results = $table
                    .load::<$entity>(&mut conn)
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(results)
            }

            /// Delete a row by primary key.  Returns the number of rows affected.
            pub fn delete(
                &self,
                id: $pk_type,
            ) -> Result<usize, $crate::errors::RepositoryError> {
                use diesel::QueryDsl;
                use diesel::RunQueryDsl;
                let mut conn = self.db_client.get_conn()?;
                let affected = diesel::delete($table.find(id))
                    .execute(&mut conn)
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(affected)
            }

            /// Count all rows in the table.
            pub fn count(&self) -> Result<i64, $crate::errors::RepositoryError> {
                use diesel::QueryDsl;
                use diesel::RunQueryDsl;
                let mut conn = self.db_client.get_conn()?;
                use diesel::dsl::count_star;
                let count: i64 = $table
                    .select(count_star())
                    .first(&mut conn)
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(count)
            }

            /// Check whether a row with the given primary key exists.
            pub fn exists(
                &self,
                id: $pk_type,
            ) -> Result<bool, $crate::errors::RepositoryError> {
                use diesel::QueryDsl;
                use diesel::RunQueryDsl;
                use diesel::dsl::exists;
                let mut conn = self.db_client.get_conn()?;
                let result = diesel::select(exists($table.find(id)))
                    .first::<bool>(&mut conn)
                    .map_err($crate::errors::RepositoryError::from)?;
                Ok(result)
            }
        }
    };
}
