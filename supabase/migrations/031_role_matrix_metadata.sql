-- 031: Role matrix metadata tables for pack-aware permissions
-- Captures per-entity and per-field visibility/editability controls that can
-- be attached to both pack templates and tenant-owned clones.

BEGIN;

CREATE TABLE role_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES config_packs(id) ON DELETE CASCADE,
  ownership text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  template_entity_id uuid,
  visibility jsonb NOT NULL DEFAULT jsonb_build_object('default_role', 'member'),
  editability jsonb NOT NULL DEFAULT jsonb_build_object('default_role', 'member'),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX idx_role_policies_account ON role_policies(account_id);
CREATE INDEX idx_role_policies_pack ON role_policies(pack_id);
CREATE INDEX idx_role_policies_template ON role_policies(template_entity_id);

CREATE TRIGGER trg_role_policies_updated
  BEFORE UPDATE ON role_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE field_role_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_policy_id uuid NOT NULL REFERENCES role_policies(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  visibility jsonb NOT NULL DEFAULT jsonb_build_object('default_role', 'member'),
  editability jsonb NOT NULL DEFAULT jsonb_build_object('default_role', 'member'),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_policy_id, field_path)
);

CREATE TRIGGER trg_field_role_policies_updated
  BEFORE UPDATE ON field_role_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
