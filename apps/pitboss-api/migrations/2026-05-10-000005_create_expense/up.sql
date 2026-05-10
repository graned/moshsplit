-- ── Expense ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.expense (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_version_id  UUID,
    deleted_at          TIMESTAMPTZ
);
