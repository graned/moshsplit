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
