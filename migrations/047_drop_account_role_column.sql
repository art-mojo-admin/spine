-- Migration 047: Drop deprecated account_role column
-- This migration removes the deprecated account_role column after the scope-based migration is complete

-- First, verify that all account_role values are NULL (should already be from migration 046)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships 
    WHERE account_role IS NOT NULL 
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot drop account_role column: non-NULL values still exist';
  END IF;
END $$;

-- Drop the deprecated account_role column
ALTER TABLE memberships DROP COLUMN account_role;

-- Remove any remaining references to account_role in constraints or indexes
-- (This is a safety measure - there shouldn't be any after migration 046)

-- Update any comments that reference the old system
COMMENT ON TABLE memberships IS 'User memberships in accounts. Access control is now managed through principal_scopes with admin.* scopes.';
