-- Migration 6: Journal Entry Double-Entry Validation Trigger
-- Adds database-level validation for balanced journal entries
-- Date: 2025-11-13
-- Purpose: Ensure double-entry accounting integrity at the database level

-- ============================================================================
-- STEP 1: Create trigger function to validate journal entry balance
-- ============================================================================

CREATE OR REPLACE FUNCTION check_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  debit_total DECIMAL;
  credit_total DECIMAL;
BEGIN
  -- Calculate total debits for this journal entry
  SELECT COALESCE(SUM(amount), 0) INTO debit_total
  FROM journal_entry_legs
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
  AND type = 'Debit';
  
  -- Calculate total credits for this journal entry
  SELECT COALESCE(SUM(amount), 0) INTO credit_total
  FROM journal_entry_legs
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
  AND type = 'Credit';
  
  -- Validate balance with 0.01 tolerance for floating point precision
  IF ABS(debit_total - credit_total) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry debits (%) must equal credits (%)', debit_total, credit_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create trigger on journal_entry_legs table
-- ============================================================================

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS check_journal_entry_balance_trigger ON journal_entry_legs;

-- Create trigger that fires AFTER INSERT/UPDATE/DELETE on journal_entry_legs
CREATE TRIGGER check_journal_entry_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON journal_entry_legs
FOR EACH ROW
EXECUTE FUNCTION check_journal_entry_balance();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 1. Function check_journal_entry_balance() exists
-- 2. Trigger check_journal_entry_balance_trigger exists on journal_entry_legs
-- 3. Trigger fires AFTER INSERT/UPDATE/DELETE operations
-- 4. Attempting to create unbalanced journal entries raises an exception
