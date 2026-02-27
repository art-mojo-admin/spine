-- 011: Packs — config_packs, pack_activations, pack_entity_mappings
-- Also adds deferred pack_id FKs to all tables that reference config_packs.

-- ── config_packs ───────────────────────────────────────────────────────
CREATE TABLE config_packs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text UNIQUE,
  icon        text,
  category    text,
  description text,
  pack_data   jsonb NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── pack_activations ───────────────────────────────────────────────────
CREATE TABLE pack_activations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id           uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  config_active     boolean NOT NULL DEFAULT false,
  test_data_active  boolean NOT NULL DEFAULT false,
  activated_by      uuid REFERENCES persons(id) ON DELETE SET NULL,
  activated_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, pack_id)
);

CREATE INDEX idx_pack_activations_account ON pack_activations(account_id);
CREATE INDEX idx_pack_activations_pack ON pack_activations(pack_id);

-- ── pack_entity_mappings ───────────────────────────────────────────────
CREATE TABLE pack_entity_mappings (
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pack_id      uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,
  template_id  uuid NOT NULL,
  cloned_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, entity_type, template_id)
);

CREATE INDEX idx_pack_entity_mappings_pack ON pack_entity_mappings(pack_id);
CREATE INDEX idx_pack_entity_mappings_cloned ON pack_entity_mappings(cloned_id);

CREATE TRIGGER trg_pack_entity_mappings_updated_at
  BEFORE UPDATE ON pack_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── account_modules ────────────────────────────────────────────────────
CREATE TABLE account_modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_slug  text NOT NULL,
  label        text NOT NULL,
  description  text,
  enabled      boolean NOT NULL DEFAULT true,
  config       jsonb NOT NULL DEFAULT '{}',
  installed_at timestamptz NOT NULL DEFAULT now(),
  is_active    boolean NOT NULL DEFAULT true,
  is_test_data boolean NOT NULL DEFAULT false,
  pack_id      uuid REFERENCES config_packs(id) ON DELETE SET NULL,
  ownership    text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  UNIQUE(account_id, module_slug)
);

CREATE INDEX idx_account_modules_account ON account_modules(account_id);
CREATE INDEX idx_account_modules_slug ON account_modules(account_id, module_slug) WHERE enabled = true;

-- ── custom_action_types ────────────────────────────────────────────────
CREATE TABLE custom_action_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  name          text NOT NULL,
  description   text,
  handler_url   text NOT NULL,
  config_schema jsonb NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  is_test_data  boolean NOT NULL DEFAULT false,
  pack_id       uuid REFERENCES config_packs(id) ON DELETE SET NULL,
  ownership     text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack', 'tenant')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_custom_action_types_account ON custom_action_types(account_id);

CREATE TRIGGER trg_custom_action_types_updated
  BEFORE UPDATE ON custom_action_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- Deferred pack_id FKs — add to all tables that declared pack_id uuid
-- without a FK (because config_packs didn't exist yet at creation time)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE accounts
  ADD CONSTRAINT fk_accounts_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE persons
  ADD CONSTRAINT fk_persons_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE memberships
  ADD CONSTRAINT fk_memberships_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE workflow_definitions
  ADD CONSTRAINT fk_workflow_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE stage_definitions
  ADD CONSTRAINT fk_stage_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE transition_definitions
  ADD CONSTRAINT fk_transition_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE workflow_actions
  ADD CONSTRAINT fk_workflow_actions_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE items
  ADD CONSTRAINT fk_items_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE threads
  ADD CONSTRAINT fk_threads_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE entity_links
  ADD CONSTRAINT fk_entity_links_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE link_type_definitions
  ADD CONSTRAINT fk_link_type_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE custom_field_definitions
  ADD CONSTRAINT fk_custom_field_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE automation_rules
  ADD CONSTRAINT fk_automation_rules_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE knowledge_base_articles
  ADD CONSTRAINT fk_kb_articles_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE enrollments
  ADD CONSTRAINT fk_enrollments_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE lesson_completions
  ADD CONSTRAINT fk_lesson_completions_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE view_definitions
  ADD CONSTRAINT fk_view_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE app_definitions
  ADD CONSTRAINT fk_app_defs_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;
ALTER TABLE integration_instances
  ADD CONSTRAINT fk_integration_instances_pack FOREIGN KEY (pack_id) REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── Pack ID indexes (for efficient pack cleanup/toggle) ────────────────
CREATE INDEX idx_accounts_pack ON accounts(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_persons_pack ON persons(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_memberships_pack ON memberships(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_workflow_defs_pack ON workflow_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_stage_defs_pack ON stage_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_transition_defs_pack ON transition_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_workflow_actions_pack ON workflow_actions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_items_pack ON items(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_threads_pack ON threads(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_entity_links_pack ON entity_links(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_link_type_defs_pack ON link_type_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_custom_field_defs_pack ON custom_field_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_automation_rules_pack ON automation_rules(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_kb_articles_pack ON knowledge_base_articles(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_enrollments_pack ON enrollments(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_view_defs_pack ON view_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_app_defs_pack ON app_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX idx_integration_instances_pack ON integration_instances(pack_id) WHERE pack_id IS NOT NULL;

-- ── Inactive indexes (optimizes default active-only queries) ───────────
CREATE INDEX idx_accounts_inactive ON accounts(is_active) WHERE is_active = false;
CREATE INDEX idx_persons_inactive ON persons(is_active) WHERE is_active = false;
CREATE INDEX idx_memberships_inactive ON memberships(is_active) WHERE is_active = false;
CREATE INDEX idx_workflow_defs_inactive ON workflow_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_stage_defs_inactive ON stage_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_transition_defs_inactive ON transition_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_workflow_actions_inactive ON workflow_actions(is_active) WHERE is_active = false;
CREATE INDEX idx_items_inactive ON items(is_active) WHERE is_active = false;
CREATE INDEX idx_threads_inactive ON threads(is_active) WHERE is_active = false;
CREATE INDEX idx_automation_rules_inactive ON automation_rules(is_active) WHERE is_active = false;
CREATE INDEX idx_kb_articles_inactive ON knowledge_base_articles(is_active) WHERE is_active = false;
CREATE INDEX idx_custom_field_defs_inactive ON custom_field_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_entity_links_inactive ON entity_links(is_active) WHERE is_active = false;
CREATE INDEX idx_link_type_defs_inactive ON link_type_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_account_modules_inactive ON account_modules(is_active) WHERE is_active = false;
CREATE INDEX idx_custom_action_types_inactive ON custom_action_types(is_active) WHERE is_active = false;
CREATE INDEX idx_enrollments_inactive ON enrollments(is_active) WHERE is_active = false;
CREATE INDEX idx_lesson_completions_inactive ON lesson_completions(is_active) WHERE is_active = false;
CREATE INDEX idx_view_defs_inactive ON view_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_app_defs_inactive ON app_definitions(is_active) WHERE is_active = false;
CREATE INDEX idx_integration_instances_inactive ON integration_instances(is_active) WHERE is_active = false;
