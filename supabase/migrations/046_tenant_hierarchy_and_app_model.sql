-- 046: Tenant Hierarchy & App Model Hardening
-- Adds owner_account_id for tenant→client hierarchy, updates account_type enum,
-- drops unused ownership columns, and adds app installation flow columns.

-- ── Add owner_account_id to accounts for tenant hierarchy ───────────────────────
ALTER TABLE accounts 
ADD COLUMN owner_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- ── Update account_type CHECK constraint to include 'tenant' ──────────────────────
ALTER TABLE accounts 
DROP CONSTRAINT accounts_account_type_check;

ALTER TABLE accounts 
ADD CONSTRAINT accounts_account_type_check 
CHECK (account_type IN ('tenant', 'organization', 'individual'));

-- ── Data Migration: reclassify existing accounts ────────────────────────────────
-- Spine Template Packs becomes the single root tenant
UPDATE accounts 
SET account_type = 'tenant', owner_account_id = NULL 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- All other accounts become organizations/individuals owned by Spine tenant
UPDATE accounts 
SET account_type = 'organization', owner_account_id = '00000000-0000-0000-0000-000000000001'
WHERE account_type = 'organization' 
  AND id != '00000000-0000-0000-0000-000000000001';

-- Individual accounts also owned by Spine tenant
UPDATE accounts 
SET owner_account_id = '00000000-0000-0000-0000-000000000001'
WHERE account_type = 'individual';

-- ── Drop unused ownership column from accounts and persons ───────────────────────
ALTER TABLE accounts DROP COLUMN IF EXISTS ownership;
ALTER TABLE persons DROP COLUMN IF EXISTS ownership;

-- ── Add external app tracking to installed_packs ───────────────────────────────
ALTER TABLE installed_packs 
ADD COLUMN external_app_id text,
ADD COLUMN external_app_version text;

-- ── Add installed_pack_id FK to app_definitions ────────────────────────────────
ALTER TABLE app_definitions 
ADD COLUMN installed_pack_id uuid REFERENCES installed_packs(id) ON DELETE SET NULL;

-- ── Indexes for new columns ─────────────────────────────────────────────────────
CREATE INDEX idx_accounts_owner_account_id ON accounts(owner_account_id) WHERE owner_account_id IS NOT NULL;
CREATE INDEX idx_installed_packs_external_app_id ON installed_packs(external_app_id) WHERE external_app_id IS NOT NULL;
CREATE INDEX idx_app_definitions_installed_pack_id ON app_definitions(installed_pack_id) WHERE installed_pack_id IS NOT NULL;
