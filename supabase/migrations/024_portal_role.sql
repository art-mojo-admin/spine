-- Extend account_role to include 'portal' for external users
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_account_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_account_role_check
  CHECK (account_role IN ('admin', 'operator', 'member', 'portal'));
