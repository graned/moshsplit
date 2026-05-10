-- ── Event Member ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.event_member (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES app.event(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        app.event_member_role NOT NULL DEFAULT 'member',
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at     TIMESTAMPTZ,
    UNIQUE (event_id, user_id, left_at)
);
