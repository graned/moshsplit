-- ── Expense Version Share (normalised split amounts) ────────────────────────
CREATE TABLE IF NOT EXISTS app.expense_version_share (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_version_id UUID NOT NULL REFERENCES app.expense_version(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    share_cents     INT NOT NULL CHECK (share_cents > 0),
    UNIQUE (expense_version_id, user_id)
);
