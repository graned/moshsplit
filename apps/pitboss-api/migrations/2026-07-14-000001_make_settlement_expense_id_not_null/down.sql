ALTER TABLE app.settlement DROP CONSTRAINT IF EXISTS settlement_expense_id_fkey;
ALTER TABLE app.settlement ALTER COLUMN expense_id DROP NOT NULL;
ALTER TABLE app.settlement ADD CONSTRAINT settlement_expense_id_fkey
    FOREIGN KEY (expense_id) REFERENCES app.expense(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS app.idx_settlement_expense_id;
CREATE INDEX idx_settlement_expense_id ON app.settlement(expense_id) WHERE deleted_at IS NULL;
