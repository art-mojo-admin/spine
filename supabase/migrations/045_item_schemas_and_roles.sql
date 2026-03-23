-- 045: Unified Item Schema & Custom Tenant Roles
-- Replaces multi-table permission checks with a unified JSON schema on item types
-- Replaces hardcoded membership roles with dynamic tenant roles

BEGIN;

-- 1. Create the tenant_roles table for custom roles
CREATE TABLE tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  pack_id uuid REFERENCES config_packs(id) ON DELETE CASCADE,
  ownership text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_tenant_roles_account ON tenant_roles(account_id);
CREATE INDEX idx_tenant_roles_slug ON tenant_roles(account_id, slug);

CREATE TRIGGER trg_tenant_roles_updated_at
  BEFORE UPDATE ON tenant_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed initial default roles for existing accounts so we don't break current data
INSERT INTO tenant_roles (account_id, slug, display_name, is_system)
SELECT id, 'admin', 'Administrator', true FROM accounts;

INSERT INTO tenant_roles (account_id, slug, display_name, is_system)
SELECT id, 'operator', 'Operator', true FROM accounts;

INSERT INTO tenant_roles (account_id, slug, display_name, is_system)
SELECT id, 'member', 'Member', true FROM accounts;

-- 2. Modify memberships to drop the rigid CHECK constraint
-- We need to drop the constraint, but keep the column, and ideally it should reference tenant_roles(slug).
-- However, since memberships references an account, the foreign key would need to be composite (account_id, account_role) -> tenant_roles(account_id, slug)

-- First, drop the check constraint
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_account_role_check;

-- Add a composite foreign key to ensure a user is only assigned a role that exists in that specific tenant
ALTER TABLE memberships ADD CONSTRAINT fk_memberships_tenant_role
  FOREIGN KEY (account_id, account_role) REFERENCES tenant_roles (account_id, slug);


-- 3. Add the unified schema column to item_type_registry
ALTER TABLE item_type_registry ADD COLUMN schema jsonb NOT NULL DEFAULT '{}';
COMMENT ON COLUMN item_type_registry.schema IS 'Contains record_permissions, field definitions, and field-level permission overrides.';

-- 5. Archive legacy permission tables (preserve data, remove from active use)
-- role_policies has 193 rows of data so we RENAME rather than DROP
ALTER TABLE role_policies RENAME TO role_policies_legacy;
DROP TABLE IF EXISTS field_role_policies CASCADE;

COMMIT;
