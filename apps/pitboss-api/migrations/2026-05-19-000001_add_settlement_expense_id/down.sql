DROP INDEX IF EXISTS app.idx_settlement_expense_id;
ALTER TABLE app.settlement DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE app.settlement DROP COLUMN IF EXISTS expense_id;
