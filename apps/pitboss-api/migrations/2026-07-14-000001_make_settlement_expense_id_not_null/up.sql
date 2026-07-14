DO $$
DECLARE
    r RECORD;
    placeholder_expense_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT s.event_id FROM app.settlement s WHERE s.expense_id IS NULL LOOP
        SELECT e.id INTO placeholder_expense_id
        FROM app.expense e
        JOIN app.expense_version ev ON ev.expense_id = e.id
        WHERE e.event_id = r.event_id AND e.deleted_at IS NOT NULL AND ev.title = 'Orphaned Settlement Placeholder'
        LIMIT 1;

        IF placeholder_expense_id IS NULL THEN
            INSERT INTO app.expense (id, event_id, created_by, created_at, current_version_id, deleted_at)
            VALUES (gen_random_uuid(), r.event_id, '00000000-0000-0000-0000-000000000000'::uuid, now(), NULL, now())
            RETURNING id INTO placeholder_expense_id;

            INSERT INTO app.expense_version (id, expense_id, version_number, title, description, amount_cents, paid_by, split_type, split_data, notes, created_by, created_at, expense_type)
            VALUES (gen_random_uuid(), placeholder_expense_id, 1, 'Orphaned Settlement Placeholder', 'Placeholder for settlements without an expense', 1, '00000000-0000-0000-0000-000000000000'::uuid, 'equal', '{}'::jsonb, NULL, '00000000-0000-0000-0000-000000000000'::uuid, now(), NULL);
        END IF;

        UPDATE app.settlement
        SET expense_id = placeholder_expense_id
        WHERE event_id = r.event_id AND expense_id IS NULL;
    END LOOP;
END $$;

ALTER TABLE app.settlement DROP CONSTRAINT IF EXISTS settlement_expense_id_fkey;
ALTER TABLE app.settlement ALTER COLUMN expense_id SET NOT NULL;
ALTER TABLE app.settlement ADD CONSTRAINT settlement_expense_id_fkey
    FOREIGN KEY (expense_id) REFERENCES app.expense(id) ON DELETE RESTRICT;
DROP INDEX IF EXISTS app.idx_settlement_expense_id;
CREATE INDEX idx_settlement_expense_id ON app.settlement(expense_id);
