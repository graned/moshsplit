//! AdminStatsService — computes system-wide statistics for admin dashboard.

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::RunQueryDsl;

use crate::errors::{RepositoryError, ServiceError};
use crate::infrastructure::clients::DbClient;
use crate::infrastructure::http::api::dtos::admin_dtos::{AdminStats, SystemHealth};

/// Raw row for aggregate stats query.
#[derive(Debug, Clone, diesel::QueryableByName)]
struct AdminStatsRow {
    #[diesel(sql_type = BigInt)]
    total_events: i64,
    #[diesel(sql_type = BigInt)]
    active_users: i64,
    #[diesel(sql_type = BigInt)]
    total_expenses: i64,
}

/// Raw row for database connectivity check.
#[derive(Debug, Clone, diesel::QueryableByName)]
struct HealthCheckRow {
    #[diesel(sql_type = BigInt)]
    _dummy: i64,
}

pub struct AdminStatsService {
    db_client: DbClient,
}

impl AdminStatsService {
    pub fn new(db_client: DbClient) -> Self {
        Self { db_client }
    }

    /// Compute system-wide admin statistics.
    ///
    /// Aggregates:
    /// - Total event count
    /// - Active user count (distinct users with non-left memberships)
    /// - Total expense count (including soft-deleted)
    /// - System health (database connectivity check)
    pub fn get_stats(&self) -> Result<AdminStats, ServiceError> {
        let mut conn = self
            .db_client
            .get_conn()
            .map_err(|e| ServiceError::Database(format!("Failed to get DB connection: {}", e)))?;

        // Use raw SQL for efficient single-query aggregation.
        // Diesel's type system struggles with COUNT + DISTINCT combinations.
        let sql = r#"
            SELECT
                (SELECT COUNT(*) FROM app.event) AS total_events,
                (SELECT COUNT(DISTINCT user_id) FROM app.event_member WHERE left_at IS NULL) AS active_users,
                (SELECT COUNT(*) FROM app.expense) AS total_expenses
        "#;

        let row: AdminStatsRow = sql_query(sql)
            .get_result(&mut conn)
            .map_err(RepositoryError::from)?;

        // Check system health via a simple query
        let system_health =
            match sql_query("SELECT 1 AS _dummy").get_result::<HealthCheckRow>(&mut conn) {
                Ok(_) => SystemHealth::Healthy,
                Err(_) => SystemHealth::Unhealthy,
            };

        Ok(AdminStats {
            total_events: row.total_events,
            active_users: row.active_users,
            total_expenses: row.total_expenses,
            system_health,
        })
    }
}
