-- 026: Tenant settings + org model configuration
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  org_model text NOT NULL DEFAULT 'single'
    CHECK (org_model IN ('single', 'multi')),
  installed_packs text[] NOT NULL DEFAULT '{}',
  configured_by uuid REFERENCES persons(id),
  configured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION set_tenant_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'INSERT' AND NEW.configured_at IS NULL THEN
    NEW.configured_at = NEW.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_settings_timestamp ON tenant_settings;
CREATE TRIGGER trg_tenant_settings_timestamp
  BEFORE INSERT OR UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_tenant_settings_timestamp();

INSERT INTO tenant_settings (tenant_account_id, org_model)
SELECT id, 'single'
FROM accounts
WHERE account_type = 'tenant'
ON CONFLICT (tenant_account_id) DO NOTHING;

COMMIT;
