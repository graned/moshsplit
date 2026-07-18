-- ── Unified Payment Model ────────────────────────────────────────────────────
-- Replaces the settlement/reimbursement model with a unified payment model.
-- Payment represents debts/obligations that get paid down over time via
-- PaymentTransaction records.

-- Drop old tables first (order matters due to FK dependencies)
DROP TABLE IF EXISTS app.reimbursement CASCADE;
DROP TABLE IF EXISTS app.settlement CASCADE;

-- Drop old payment table (will be replaced with new schema)
DROP TABLE IF EXISTS app.payment CASCADE;

-- Create new Payment table
CREATE TABLE app.payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    creditor_id UUID NOT NULL,
    debtor_id UUID NOT NULL,
    expense_id UUID REFERENCES app.expense(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
    reason VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT payment_creditor_debtor_expense_status_unique 
        UNIQUE (creditor_id, debtor_id, expense_id, status),
    CHECK (creditor_id <> debtor_id)
);

CREATE INDEX idx_payment_event_creditor_status ON app.payment(event_id, creditor_id, status);
CREATE INDEX idx_payment_event_debtor_status ON app.payment(event_id, debtor_id, status);
CREATE INDEX idx_payment_expense ON app.payment(expense_id);

-- Create PaymentTransaction table
CREATE TABLE app.payment_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES app.payment(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    proposed_by UUID NOT NULL,
    confirmed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_transaction_payment_status ON app.payment_transaction(payment_id, status);
CREATE INDEX idx_payment_transaction_proposed_by ON app.payment_transaction(proposed_by);

-- Update expense table with deletion_status
ALTER TABLE app.expense 
ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(20) DEFAULT 'none';
