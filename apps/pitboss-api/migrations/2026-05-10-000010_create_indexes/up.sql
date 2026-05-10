-- ── Indexes for MoshSplit domain tables ─────────────────────────────────────

-- event_member
CREATE INDEX IF NOT EXISTS idx_event_member_event_id ON app.event_member(event_id);
CREATE INDEX IF NOT EXISTS idx_event_member_user_id ON app.event_member(user_id);
CREATE INDEX IF NOT EXISTS idx_event_member_active ON app.event_member(event_id, user_id) WHERE left_at IS NULL;

-- expense
CREATE INDEX IF NOT EXISTS idx_expense_event_id ON app.expense(event_id) WHERE deleted_at IS NULL;

-- expense_version
CREATE INDEX IF NOT EXISTS idx_expense_version_expense_id ON app.expense_version(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_version_created_at ON app.expense_version(expense_id, created_at DESC);

-- expense_version_share
CREATE INDEX IF NOT EXISTS idx_expense_version_share_version_id ON app.expense_version_share(expense_version_id);
CREATE INDEX IF NOT EXISTS idx_expense_version_share_user_id ON app.expense_version_share(user_id);

-- payment
CREATE INDEX IF NOT EXISTS idx_payment_event_id ON app.payment(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_from_user ON app.payment(from_user);
CREATE INDEX IF NOT EXISTS idx_payment_to_user ON app.payment(to_user);

-- settlement
CREATE INDEX IF NOT EXISTS idx_settlement_event_id ON app.settlement(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON app.settlement(event_id, status);
