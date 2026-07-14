//! AuditService — queries the audit_log table for admin visibility.
//!
//! Provides cursor-based pagination over audit entries.

use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{DateTime, Utc};
use diesel::sql_query;
use diesel::sql_types::{Jsonb, Nullable, Text, Timestamptz, Uuid as DUuid};
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::errors::{RepositoryError, ServiceError};
use crate::infrastructure::clients::DbClient;
use crate::infrastructure::http::api::dtos::admin_dtos::{AuditEntry, AuditLogResponse};

/// Raw row returned by the audit_log query.
#[derive(Debug, Clone, diesel::QueryableByName)]
struct AuditRawRow {
    #[diesel(sql_type = DUuid)]
    id: Uuid,
    #[diesel(sql_type = Text)]
    action: String,
    #[diesel(sql_type = Text)]
    entity_type: String,
    #[diesel(sql_type = DUuid)]
    entity_id: Uuid,
    #[diesel(sql_type = DUuid)]
    user_id: Uuid,
    #[diesel(sql_type = Nullable<Jsonb>)]
    details: Option<serde_json::Value>,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<Utc>,
}

/// Encodes `(created_at, id)` into a URL-safe base64 cursor string.
fn encode_cursor(created_at: DateTime<Utc>, id: Uuid) -> String {
    let raw = format!("{}|{}", created_at.to_rfc3339(), id);
    STANDARD.encode(raw.as_bytes())
}

/// Decodes a cursor string back into `(created_at, id)`.
fn decode_cursor(cursor: &str) -> Option<(DateTime<Utc>, Uuid)> {
    let decoded = STANDARD.decode(cursor).ok()?;
    let s = String::from_utf8(decoded).ok()?;
    let parts: Vec<&str> = s.splitn(2, '|').collect();
    if parts.len() != 2 {
        return None;
    }
    let ts = DateTime::parse_from_rfc3339(parts[0]).ok()?;
    let id = Uuid::parse_str(parts[1]).ok()?;
    Some((ts.with_timezone(&Utc), id))
}

pub struct AuditService {
    db_client: DbClient,
}

impl AuditService {
    pub fn new(db_client: DbClient) -> Self {
        Self { db_client }
    }

    /// List audit log entries with cursor-based pagination.
    ///
    /// The cursor encodes `(created_at, id)` for stable pagination.
    /// Results are returned in descending order (newest first).
    pub fn list_entries(
        &self,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<AuditLogResponse, ServiceError> {
        let mut conn = self
            .db_client
            .get_conn()
            .map_err(|e| ServiceError::Database(format!("Failed to get DB connection: {}", e)))?;

        let fetch_limit = std::cmp::min(limit, 100) + 1;
        let (cursor_ts, cursor_id) = match cursor.and_then(decode_cursor) {
            Some((ts, id)) => (Some(ts), Some(id)),
            None => (None, None),
        };

        let sql = r#"
            SELECT
                id,
                action,
                entity_type,
                entity_id,
                user_id,
                details,
                created_at
            FROM app.audit_log
            WHERE ($1::timestamptz IS NULL
                   OR created_at < $1
                   OR (created_at = $1 AND id < $3::uuid))
            ORDER BY created_at DESC, id DESC
            LIMIT $2
        "#;

        let results: Vec<AuditRawRow> = sql_query(sql)
            .bind::<Nullable<Timestamptz>, _>(cursor_ts)
            .bind::<diesel::sql_types::BigInt, _>(fetch_limit as i64)
            .bind::<Nullable<DUuid>, _>(cursor_id)
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let page: Vec<AuditRawRow> = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        let entries: Vec<AuditEntry> = page
            .into_iter()
            .map(|row| AuditEntry {
                id: row.id,
                action: row.action,
                entity_type: row.entity_type,
                entity_id: row.entity_id,
                user_id: row.user_id,
                details: row.details,
                created_at: row.created_at,
            })
            .collect();

        let next_cursor = if has_more {
            entries
                .last()
                .map(|entry| encode_cursor(entry.created_at, entry.id))
        } else {
            None
        };

        Ok(AuditLogResponse {
            entries,
            next_cursor,
            has_more,
        })
    }
}
