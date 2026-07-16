-- ── Reimbursement ──────────────────────────────────────────────────────────────
-- Created when an expense is deleted. Tracks who owes whom for confirmed settlements
-- that were previously associated with the deleted expense.
CREATE TABLE IF NOT EXISTS app.reimbursement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_expense_id  UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    settlement_id   UUID REFERENCES app.settlement(id),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CHECK (from_user <> to_user)
);

CREATE INDEX idx_reimbursement_event ON app.reimbursement(event_id);
CREATE INDEX idx_reimbursement_from_user ON app.reimbursement(from_user);
CREATE INDEX idx_reimbursement_to_user ON app.reimbursement(to_user);
CREATE INDEX idx_reimbursement_ref_expense ON app.reimbursement(ref_expense_id);
