-- Public layer: account slugs, public stage visibility, public workflow config

-- Account slugs for public URLs
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slug text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);

-- Stage visibility: which stages are publicly visible
ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Workflow public config: controls public listing behavior
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS public_config jsonb NOT NULL DEFAULT '{}';

-- Custom field public visibility
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
