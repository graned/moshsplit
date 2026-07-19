-- ── Credit Table ──────────────────────────────────────────────────────────────
-- Tracks user-to-user credits for expense reimbursements.
-- Credits are versioned (immutable) — new versions instead of updates.
-- Total credit = sum of latest versions only.

CREATE TABLE app.credit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    creditor_id UUID NOT NULL,
    debtor_id UUID NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    amount_used_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_used_cents >= 0),
    source_expense_id UUID REFERENCES app.expense(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    parent_credit_id UUID REFERENCES app.credit(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT credit_debtor_creditor_check CHECK (debtor_id <> creditor_id),
    CONSTRAINT credit_amount_used_check CHECK (amount_used_cents <= amount_cents)
);

CREATE INDEX idx_credit_event ON app.credit(event_id);
CREATE INDEX idx_credit_debtor_creditor ON app.credit(debtor_id, creditor_id);
CREATE INDEX idx_credit_parent ON app.credit(parent_credit_id) WHERE parent_credit_id IS NOT NULL;
CREATE INDEX idx_credit_status ON app.credit(status) WHERE status = 'active';

-- Add payment_method and credit_id to payment_transaction
ALTER TABLE app.payment_transaction
ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'cash';

ALTER TABLE app.payment_transaction
ADD COLUMN credit_id UUID REFERENCES app.credit(id) ON DELETE SET NULL;

CREATE INDEX idx_payment_transaction_credit ON app.payment_transaction(credit_id) WHERE credit_id IS NOT NULL;
