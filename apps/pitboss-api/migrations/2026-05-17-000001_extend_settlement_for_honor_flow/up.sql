-- ── Extend settlement_status enum with 'rejected' ─────────────────────────────
ALTER TYPE app.settlement_status ADD VALUE IF NOT EXISTS 'rejected';

-- ── Add honor settlement flow columns to settlement table ─────────────────────
ALTER TABLE app.settlement
    ADD COLUMN IF NOT EXISTS note              TEXT,
    ADD COLUMN IF NOT EXISTS proof_url         TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by       UUID,
    ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_note    TEXT;
