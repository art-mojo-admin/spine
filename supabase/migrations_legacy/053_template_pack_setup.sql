-- 053: Template pack system account and entity mapping table
SET search_path = spine_v1, extensions;

-- Ensure the canonical template account exists (used to store pack blueprints)
INSERT INTO accounts (id, account_type, display_name, status, settings, created_at, updated_at, metadata, slug, is_active, is_test_data, pack_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'organization',
  'Spine Template Packs',
  'active',
  COALESCE((SELECT settings FROM accounts WHERE id = '00000000-0000-0000-0000-000000000001'), '{}'::jsonb),
  now(),
  now(),
  '{}'::jsonb,
  'spine-template-packs',
  false,
  false,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  account_type = EXCLUDED.account_type,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status;

-- Mapping table to track cloned entities per account/pack
CREATE TABLE IF NOT EXISTS pack_entity_mappings (
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id      uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,
  template_id  uuid NOT NULL,
  cloned_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, entity_type, template_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_entity_mappings_pack ON pack_entity_mappings(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_entity_mappings_cloned ON pack_entity_mappings(cloned_id);

CREATE TRIGGER trg_pack_entity_mappings_updated_at
  BEFORE UPDATE ON pack_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
