-- Drop the audit_log table and its indexes.

DROP INDEX IF EXISTS app.idx_audit_log_user_id;
DROP INDEX IF EXISTS app.idx_audit_log_entity;
DROP INDEX IF EXISTS app.idx_audit_log_created_at_id;
DROP TABLE IF EXISTS app.audit_log;
