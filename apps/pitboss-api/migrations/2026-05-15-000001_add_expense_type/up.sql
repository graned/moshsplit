-- Add expense_type enum and column to expense_version.

-- 1. Create the expense_type enum.
CREATE TYPE app.expense_type AS ENUM (
    'food',
    'beer',
    'gas',
    'transport',
    'merch',
    'camping',
    'other'
);

-- 2. Add nullable column to expense_version for backward compatibility.
ALTER TABLE app.expense_version
    ADD COLUMN expense_type app.expense_type;
