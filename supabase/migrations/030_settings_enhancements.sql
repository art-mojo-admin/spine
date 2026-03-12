-- 030: Settings enhancements for tenant type and workspace pack tracking
BEGIN;

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS tenant_type text NOT NULL DEFAULT 'individual'
    CHECK (tenant_type IN ('individual', 'organization', 'service_provider')),
  ADD COLUMN IF NOT EXISTS active_pack_id uuid REFERENCES config_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workspace_last_purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS workspace_last_purged_by uuid REFERENCES persons(id);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_active_pack ON tenant_settings(active_pack_id);

UPDATE tenant_settings
SET tenant_type = CASE
    WHEN org_model = 'multi' THEN 'organization'
    ELSE 'individual'
  END
WHERE tenant_type IS NULL OR tenant_type = '';

COMMIT;
