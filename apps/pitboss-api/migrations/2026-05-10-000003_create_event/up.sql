-- ── Event (aka "Group") ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          app.event_status NOT NULL DEFAULT 'active',
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
