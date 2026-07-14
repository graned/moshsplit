ALTER TABLE app.settlement ADD COLUMN expense_id UUID REFERENCES app.expense(id) ON DELETE SET NULL;
ALTER TABLE app.settlement ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_settlement_expense_id ON app.settlement(expense_id) WHERE deleted_at IS NULL;
