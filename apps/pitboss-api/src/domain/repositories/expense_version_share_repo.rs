//! ExpenseVersionShareRepository — CRUD + bulk insert for `app::expense_version_share`.

use diesel::prelude::*;
use uuid::Uuid;

use crate::errors::RepositoryError;
use crate::schema::app::expense_version_share;
use crate::schema_models::ExpenseVersionShare;

crate::impl_repository!(
    ExpenseVersionShareRepository for ExpenseVersionShare,
    table: expense_version_share::table,
    pk_column: expense_version_share::id,
    pk_type: Uuid,
);

impl ExpenseVersionShareRepository {
    /// Find all shares for a given expense version.
    pub fn find_by_expense_version_id(
        &self,
        version_id: Uuid,
    ) -> Result<Vec<ExpenseVersionShare>, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let results = expense_version_share::table
            .filter(expense_version_share::expense_version_id.eq(version_id))
            .load::<ExpenseVersionShare>(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(results)
    }

    /// Insert multiple shares in a single batch.
    pub fn bulk_insert(
        &self,
        rows: &[ExpenseVersionShare],
    ) -> Result<usize, RepositoryError> {
        let mut conn = self.db_client.get_conn()?;
        let affected = diesel::insert_into(expense_version_share::table)
            .values(rows)
            .execute(&mut conn)
            .map_err(RepositoryError::from)?;
        Ok(affected)
    }
}
