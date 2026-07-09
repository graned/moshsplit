-- Add reimburse value to expense_type enum.

ALTER TYPE app.expense_type ADD VALUE IF NOT EXISTS 'reimburse';
