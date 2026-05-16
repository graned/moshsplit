-- Reverse the expense_type migration.

ALTER TABLE app.expense_version
    DROP COLUMN IF EXISTS expense_type;

DROP TYPE IF EXISTS app.expense_type CASCADE;
