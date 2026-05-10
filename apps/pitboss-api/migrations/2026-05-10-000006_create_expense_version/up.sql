-- ── Expense Version ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    paid_by         UUID NOT NULL,
    split_type      app.split_type NOT NULL,
    split_data      JSONB NOT NULL,
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expense_id, version_number)
);
