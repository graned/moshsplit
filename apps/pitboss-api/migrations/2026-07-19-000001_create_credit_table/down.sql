-- ── Rollback: Remove credit table ────────────────────────────────────────────

-- Remove columns from payment_transaction
ALTER TABLE app.payment_transaction DROP COLUMN IF EXISTS credit_id;
ALTER TABLE app.payment_transaction DROP COLUMN IF EXISTS payment_method;

-- Drop credit table
DROP TABLE IF EXISTS app.credit CASCADE;
