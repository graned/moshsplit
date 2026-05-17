-- ── Remove honor settlement flow columns ──────────────────────────────────────
ALTER TABLE app.settlement
    DROP COLUMN IF EXISTS note,
    DROP COLUMN IF EXISTS proof_url,
    DROP COLUMN IF EXISTS reviewed_by,
    DROP COLUMN IF EXISTS reviewed_at,
    DROP COLUMN IF EXISTS rejection_note;

-- Note: Cannot remove enum value in PostgreSQL. Would need to recreate the type.
-- For development, this is acceptable. For production, a more complex migration
-- would be required.
