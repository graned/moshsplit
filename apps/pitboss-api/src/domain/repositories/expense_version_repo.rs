//! ExpenseVersionRepository — CRUD + queries for `app::expense_version`.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::expense_version;
use crate::schema_models::ExpenseVersion;

crate::impl_repository!(
    ExpenseVersionRepository for ExpenseVersion,
    table: expense_version::table,
    pk_column: expense_version::id,
    pk_type: Uuid,
);

impl ExpenseVersionRepository {
    /// Find all versions for an expense, ordered by version_number ascending.
    pub fn find_by_expense_id(
        &self,
        expense_id: Uuid,
    ) -> Result<Vec<ExpenseVersion>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let results = expense_version::table
            .filter(expense_version::expense_id.eq(expense_id))
            .order_by(expense_version::version_number.asc())
            .load::<ExpenseVersion>(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(results)
    }

    /// Get the next version number for an expense (1-based).
    pub fn next_version_number(&self, expense_id: Uuid) -> Result<i32, RepositoryError> {
        use diesel::dsl::max;

        let mut conn = self.db_client.get_conn()?;
        let max_ver: Option<i32> = expense_version::table
            .filter(expense_version::expense_id.eq(expense_id))
            .select(max(expense_version::version_number))
            .first(&mut conn)
            .map_err(RepositoryError::from)?;

        Ok(max_ver.unwrap_or(0) + 1)
    }
}
