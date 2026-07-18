-- ── Rollback: Restore settlement/reimbursement model ─────────────────────────

-- Drop new tables
DROP TABLE IF EXISTS app.payment_transaction CASCADE;
DROP TABLE IF EXISTS app.payment CASCADE;

-- Remove deletion_status column from expense
ALTER TABLE app.expense DROP COLUMN IF EXISTS deletion_status;

-- Recreate settlement table
CREATE TABLE app.settlement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user UUID NOT NULL,
    to_user UUID NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status settlement_status NOT NULL DEFAULT 'pending',
    settled_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    proof_url TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_note TEXT,
    expense_id UUID REFERENCES app.expense(id),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_settlement_event ON app.settlement(event_id);
CREATE INDEX idx_settlement_from_user ON app.settlement(from_user);
CREATE INDEX idx_settlement_to_user ON app.settlement(to_user);
CREATE INDEX idx_settlement_status ON app.settlement(status);

-- Recreate reimbursement table
CREATE TABLE app.reimbursement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_expense_id UUID NOT NULL REFERENCES app.expense(id),
    settlement_id UUID REFERENCES app.settlement(id),
    event_id UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user UUID NOT NULL,
    to_user UUID NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_reimbursement_event ON app.reimbursement(event_id);
CREATE INDEX idx_reimbursement_expense ON app.reimbursement(ref_expense_id);

-- Recreate old payment table
CREATE TABLE app.payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user UUID NOT NULL,
    to_user UUID NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    description TEXT,
    payment_method TEXT,
    external_ref TEXT,
    recorded_by UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (from_user <> to_user)
);
