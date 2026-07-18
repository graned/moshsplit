//! ActivityService — builds a unified activity feed (Battle Log) for an event.

use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{DateTime, Utc};
use diesel::sql_query;
use diesel::sql_types::{Integer, Nullable, Text, Timestamptz, Uuid as DUuid};
use diesel::RunQueryDsl;
use uuid::Uuid;

use crate::domain::repositories::event_repo::EventRepository;
use crate::errors::{RepositoryError, ServiceError};
use crate::infrastructure::clients::DbClient;
use crate::infrastructure::http::api::dtos::activity_dtos::{ActivityItem, ActivityResponse};

#[derive(Debug, Clone, diesel::QueryableByName)]
struct ActivityRawRow {
    #[diesel(sql_type = Text)]
    item_type: String,
    #[diesel(sql_type = DUuid)]
    id: Uuid,
    #[diesel(sql_type = Timestamptz)]
    created_at: DateTime<Utc>,
    #[diesel(sql_type = Nullable<Text>)]
    title: Option<String>,
    #[diesel(sql_type = Nullable<Integer>)]
    amount_cents: Option<i32>,
    #[diesel(sql_type = Nullable<DUuid>)]
    paid_by: Option<Uuid>,
    #[diesel(sql_type = Nullable<Integer>)]
    participant_count: Option<i32>,
    #[diesel(sql_type = Nullable<Text>)]
    expense_type: Option<String>,
    #[diesel(sql_type = Nullable<DUuid>)]
    creditor_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<DUuid>)]
    debtor_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<DUuid>)]
    user_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<DUuid>)]
    approved_by: Option<Uuid>,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    reviewed_at: Option<DateTime<Utc>>,
    #[diesel(sql_type = Nullable<DUuid>)]
    expense_id: Option<Uuid>,
    #[diesel(sql_type = Nullable<Text>)]
    deletion_status: Option<String>,
}

fn encode_cursor(created_at: DateTime<Utc>, id: Uuid) -> String {
    let raw = format!("{}|{}", created_at.to_rfc3339(), id);
    STANDARD.encode(raw.as_bytes())
}

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

pub struct ActivityService {
    event_repo: EventRepository,
    db_client: DbClient,
}

impl ActivityService {
    pub fn new(event_repo: EventRepository, db_client: DbClient) -> Self {
        Self {
            event_repo,
            db_client,
        }
    }

    pub fn list_activity(
        &self,
        event_id: Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<ActivityResponse, ServiceError> {
        self.event_repo
            .find_by_id(event_id)?
            .ok_or_else(|| ServiceError::NotFound(format!("Event {} not found", event_id)))?;

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
                'expense'       AS item_type,
                e.id,
                e.created_at,
                ev.title,
                ev.amount_cents,
                ev.paid_by,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM app.expense_version_share sh
                    WHERE sh.expense_version_id = e.current_version_id
                ) AS participant_count,
                ev.expense_type::TEXT,
                NULL::UUID      AS creditor_id,
                NULL::UUID      AS debtor_id,
                NULL::UUID      AS user_id,
                NULL::UUID      AS approved_by,
                NULL::timestamptz AS reviewed_at,
                NULL::UUID      AS expense_id,
                e.deletion_status
            FROM app.expense e
            LEFT JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND e.deleted_at IS NULL
              AND ($2::timestamptz IS NULL
                   OR e.created_at < $2
                   OR (e.created_at = $2 AND e.id < $5::uuid))

            UNION ALL

            SELECT
                'payment'       AS item_type,
                p.id,
                p.created_at,
                p.reason        AS title,
                p.amount_cents,
                NULL::UUID      AS paid_by,
                NULL::INTEGER   AS participant_count,
                NULL::TEXT      AS expense_type,
                p.creditor_id,
                p.debtor_id,
                NULL::UUID      AS user_id,
                NULL::UUID      AS approved_by,
                NULL::timestamptz AS reviewed_at,
                p.expense_id,
                NULL::TEXT      AS deletion_status
            FROM app.payment p
            WHERE p.event_id = $1
              AND ($2::timestamptz IS NULL
                   OR p.created_at < $2
                   OR (p.created_at = $2 AND p.id < $5::uuid))

            UNION ALL

            SELECT
                'payment_confirmed' AS item_type,
                pt.id,
                pt.confirmed_at   AS created_at,
                NULL::TEXT        AS title,
                pt.amount_cents,
                NULL::UUID        AS paid_by,
                NULL::INTEGER     AS participant_count,
                NULL::TEXT        AS expense_type,
                p.creditor_id,
                p.debtor_id,
                NULL::UUID        AS user_id,
                pt.confirmed_by   AS approved_by,
                pt.confirmed_at   AS reviewed_at,
                p.expense_id,
                NULL::TEXT        AS deletion_status
            FROM app.payment_transaction pt
            JOIN app.payment p ON p.id = pt.payment_id
            WHERE p.event_id = $1
              AND pt.status = 'confirmed'
              AND ($2::timestamptz IS NULL
                   OR pt.confirmed_at < $2
                   OR (pt.confirmed_at = $2 AND pt.id < $5::uuid))

            UNION ALL

            SELECT
                'member_join'   AS item_type,
                em.id,
                em.joined_at    AS created_at,
                NULL::TEXT      AS title,
                NULL::INTEGER   AS amount_cents,
                NULL::UUID      AS paid_by,
                NULL::INTEGER   AS participant_count,
                NULL::TEXT      AS expense_type,
                NULL::UUID      AS creditor_id,
                NULL::UUID      AS debtor_id,
                em.user_id,
                NULL::UUID      AS approved_by,
                NULL::timestamptz AS reviewed_at,
                NULL::UUID      AS expense_id,
                NULL::TEXT      AS deletion_status
            FROM app.event_member em
            WHERE em.event_id = $1
              AND ($2::timestamptz IS NULL
                   OR em.joined_at < $2
                   OR (em.joined_at = $2 AND em.id < $5::uuid))

            UNION ALL

            SELECT
                'expense_updated' AS item_type,
                ev.id,
                ev.created_at,
                ev.title,
                ev.amount_cents,
                ev.paid_by,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM app.expense_version_share sh
                    WHERE sh.expense_version_id = ev.id
                ) AS participant_count,
                ev.expense_type::TEXT,
                NULL::UUID      AS creditor_id,
                NULL::UUID      AS debtor_id,
                NULL::UUID      AS user_id,
                NULL::UUID      AS approved_by,
                NULL::timestamptz AS reviewed_at,
                e.id            AS expense_id,
                e.deletion_status
            FROM app.expense_version ev
            JOIN app.expense e ON e.id = ev.expense_id
            WHERE e.event_id = $1
              AND e.deleted_at IS NULL
              AND ev.version_number > 1
              AND ($2::timestamptz IS NULL
                   OR ev.created_at < $2
                   OR (ev.created_at = $2 AND ev.id < $5::uuid))

            UNION ALL

            SELECT
                'expense_deleted' AS item_type,
                e.id,
                e.deleted_at    AS created_at,
                ev.title,
                ev.amount_cents,
                ev.paid_by,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM app.expense_version_share sh
                    WHERE sh.expense_version_id = e.current_version_id
                ) AS participant_count,
                ev.expense_type::TEXT,
                NULL::UUID      AS creditor_id,
                NULL::UUID      AS debtor_id,
                NULL::UUID      AS user_id,
                NULL::UUID      AS approved_by,
                NULL::timestamptz AS reviewed_at,
                e.id            AS expense_id,
                NULL::TEXT      AS deletion_status
            FROM app.expense e
            LEFT JOIN app.expense_version ev ON ev.id = e.current_version_id
            WHERE e.event_id = $1
              AND e.deleted_at IS NOT NULL
              AND ($2::timestamptz IS NULL
                   OR e.deleted_at < $2
                   OR (e.deleted_at = $2 AND e.id < $5::uuid))

            ORDER BY created_at DESC, id DESC
            LIMIT $3
        "#;

        let results: Vec<ActivityRawRow> = sql_query(sql)
            .bind::<DUuid, _>(event_id)
            .bind::<Nullable<Timestamptz>, _>(cursor_ts)
            .bind::<Integer, _>(fetch_limit as i32)
            .bind::<Nullable<DUuid>, _>(cursor_id)
            .bind::<Nullable<DUuid>, _>(cursor_id)
            .load(&mut conn)
            .map_err(RepositoryError::from)?;

        let has_more = results.len() as i64 == fetch_limit;
        let page: Vec<ActivityRawRow> = if has_more {
            results.into_iter().take(limit as usize).collect()
        } else {
            results
        };

        let items: Vec<ActivityItem> = page
            .into_iter()
            .map(|row| match row.item_type.as_str() {
                "expense" => ActivityItem::Expense {
                    id: row.id,
                    title: row.title.unwrap_or_else(|| "Untitled".to_string()),
                    amount_cents: row.amount_cents.unwrap_or(0),
                    paid_by: row.paid_by.unwrap_or_default(),
                    participant_count: row.participant_count.unwrap_or(0),
                    created_at: row.created_at,
                    expense_type: row.expense_type,
                    deletion_status: row.deletion_status,
                },
                "payment" => ActivityItem::Payment {
                    id: row.id,
                    creditor_id: row.creditor_id.unwrap_or_default(),
                    debtor_id: row.debtor_id.unwrap_or_default(),
                    amount_cents: row.amount_cents.unwrap_or(0),
                    created_at: row.created_at,
                },
                "payment_confirmed" => ActivityItem::PaymentConfirmed {
                    id: row.id,
                    creditor_id: row.creditor_id.unwrap_or_default(),
                    debtor_id: row.debtor_id.unwrap_or_default(),
                    amount_cents: row.amount_cents.unwrap_or(0),
                    approved_by: row.approved_by.unwrap_or_default(),
                    created_at: row.created_at,
                    reviewed_at: row.reviewed_at.unwrap_or(row.created_at),
                },
                "member_join" => ActivityItem::MemberJoin {
                    id: row.id,
                    user_id: row.user_id.unwrap_or_default(),
                    user_name: None,
                    created_at: row.created_at,
                },
                "expense_updated" => ActivityItem::ExpenseUpdated {
                    id: row.id,
                    expense_id: row.expense_id.unwrap_or_default(),
                    title: row.title.unwrap_or_else(|| "Untitled".to_string()),
                    amount_cents: row.amount_cents.unwrap_or(0),
                    paid_by: row.paid_by.unwrap_or_default(),
                    participant_count: row.participant_count.unwrap_or(0),
                    created_at: row.created_at,
                    expense_type: row.expense_type,
                },
                "expense_deleted" => ActivityItem::ExpenseDeleted {
                    id: row.id,
                    expense_id: row.expense_id.unwrap_or_default(),
                    title: row.title.unwrap_or_else(|| "Untitled".to_string()),
                    amount_cents: row.amount_cents.unwrap_or(0),
                    paid_by: row.paid_by.unwrap_or_default(),
                    created_at: row.created_at,
                },
                other => ActivityItem::MemberJoin {
                    id: row.id,
                    user_id: Uuid::nil(),
                    user_name: Some(format!("unknown_type:{}", other)),
                    created_at: row.created_at,
                },
            })
            .collect();

        let next_cursor = if has_more {
            items.last().map(|item| match item {
                ActivityItem::Expense { id, created_at, .. }
                | ActivityItem::Payment { id, created_at, .. }
                | ActivityItem::PaymentConfirmed { id, created_at, .. }
                | ActivityItem::MemberJoin { id, created_at, .. }
                | ActivityItem::ExpenseUpdated { id, created_at, .. }
                | ActivityItem::ExpenseDeleted { id, created_at, .. } => {
                    encode_cursor(*created_at, *id)
                }
            })
        } else {
            None
        };

        Ok(ActivityResponse {
            items,
            next_cursor,
            has_more,
        })
    }
}
