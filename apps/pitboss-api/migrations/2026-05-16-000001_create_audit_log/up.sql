-- Create the audit_log table for tracking administrative actions.

CREATE TABLE app.audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient cursor pagination (created_at DESC, id DESC).
CREATE INDEX idx_audit_log_created_at_id ON app.audit_log (created_at DESC, id DESC);

-- Index for filtering by entity.
CREATE INDEX idx_audit_log_entity ON app.audit_log (entity_type, entity_id);

-- Index for filtering by user.
CREATE INDEX idx_audit_log_user_id ON app.audit_log (user_id);
