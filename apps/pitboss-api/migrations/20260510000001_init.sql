-- MoshSplit — Initial schema setup
-- Creates the `app` schema (if not already created by init script)
-- and the core domain tables.

CREATE SCHEMA IF NOT EXISTS app;

-- ── Event (aka "Group") ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Event Member ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,
    UNIQUE (event_id, user_id, left_at)
);

-- ── Expense ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.expense (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id  UUID,
    deleted_at          TIMESTAMPTZ
);

-- ── Expense Version ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.expense_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id      UUID NOT NULL REFERENCES app.expense(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    paid_by         UUID NOT NULL,
    split_type      TEXT NOT NULL CHECK (split_type IN ('equal', 'custom', 'percentage', 'shares')),
    split_data      JSONB NOT NULL,
    notes           TEXT,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expense_id, version_number)
);

-- ── Expense Version Share (normalized split amounts) ────────────────────────
CREATE TABLE IF NOT EXISTS app.expense_version_share (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_version_id UUID NOT NULL REFERENCES app.expense_version(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    share_cents     INT NOT NULL CHECK (share_cents > 0),
    UNIQUE (expense_version_id, user_id)
);

-- ── Payment (immutable) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.payment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    currency        TEXT NOT NULL DEFAULT 'EUR',
    description     TEXT,
    payment_method  TEXT,
    external_ref    TEXT,
    recorded_by     UUID NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);

-- ── Settlement ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.settlement (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    from_user       UUID NOT NULL,
    to_user         UUID NOT NULL,
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'disputed')),
    settled_at      TIMESTAMPTZ,
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_user <> to_user)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_member_event_id ON app.event_member(event_id);
CREATE INDEX IF NOT EXISTS idx_event_member_user_id ON app.event_member(user_id);
CREATE INDEX IF NOT EXISTS idx_event_member_active ON app.event_member(event_id, user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_event_id ON app.expense(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expense_version_expense_id ON app.expense_version(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_version_created_at ON app.expense_version(expense_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_version_share_version_id ON app.expense_version_share(expense_version_id);
CREATE INDEX IF NOT EXISTS idx_expense_version_share_user_id ON app.expense_version_share(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_event_id ON app.payment(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_from_user ON app.payment(from_user);
CREATE INDEX IF NOT EXISTS idx_payment_to_user ON app.payment(to_user);
CREATE INDEX IF NOT EXISTS idx_settlement_event_id ON app.settlement(event_id);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON app.settlement(event_id, status);
