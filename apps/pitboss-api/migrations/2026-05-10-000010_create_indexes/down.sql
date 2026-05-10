-- Drop all indexes created in the up migration.
DROP INDEX IF EXISTS app.idx_event_member_event_id;
DROP INDEX IF EXISTS app.idx_event_member_user_id;
DROP INDEX IF EXISTS app.idx_event_member_active;
DROP INDEX IF EXISTS app.idx_expense_event_id;
DROP INDEX IF EXISTS app.idx_expense_version_expense_id;
DROP INDEX IF EXISTS app.idx_expense_version_created_at;
DROP INDEX IF EXISTS app.idx_expense_version_share_version_id;
DROP INDEX IF EXISTS app.idx_expense_version_share_user_id;
DROP INDEX IF EXISTS app.idx_payment_event_id;
DROP INDEX IF EXISTS app.idx_payment_from_user;
DROP INDEX IF EXISTS app.idx_payment_to_user;
DROP INDEX IF EXISTS app.idx_settlement_event_id;
DROP INDEX IF EXISTS app.idx_settlement_status;
