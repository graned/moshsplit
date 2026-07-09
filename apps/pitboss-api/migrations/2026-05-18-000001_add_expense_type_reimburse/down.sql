-- Remove reimburse value from expense_type enum.
-- Note: PostgreSQL doesn't allow removing values from enums, so this is a no-op
-- in terms of actual data migration. In production, you would need to update all
-- rows with 'reimburse' to a different value first.

-- This migration exists for completeness but reimburse values will remain in the DB.
