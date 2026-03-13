-- 033: App package context and ownership metadata

-- ── Config pack ownership + primary app linkage ─────────────────────────────
ALTER TABLE config_packs
  ADD COLUMN owner_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN primary_app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_config_packs_owner ON config_packs(owner_account_id);

-- ── App-aware columns on configurable tables ────────────────────────────────
ALTER TABLE workflow_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_app ON workflow_definitions(app_id);

ALTER TABLE stage_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stage_definitions_app ON stage_definitions(app_id);

ALTER TABLE transition_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transition_definitions_app ON transition_definitions(app_id);

ALTER TABLE workflow_actions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_actions_app ON workflow_actions(app_id);

ALTER TABLE automation_rules
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_automation_rules_app ON automation_rules(app_id);

ALTER TABLE custom_field_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_app ON custom_field_definitions(app_id);

ALTER TABLE link_type_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_link_type_definitions_app ON link_type_definitions(app_id);

ALTER TABLE view_definitions
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_view_definitions_app ON view_definitions(app_id);

ALTER TABLE account_modules
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_account_modules_app ON account_modules(app_id);

ALTER TABLE custom_action_types
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_custom_action_types_app ON custom_action_types(app_id);

ALTER TABLE items
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_items_app ON items(app_id);

ALTER TABLE threads
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_threads_app ON threads(app_id);

ALTER TABLE messages
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(app_id);

ALTER TABLE entity_links
  ADD COLUMN app_id uuid REFERENCES app_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_entity_links_app ON entity_links(app_id);

-- ── Backfill helpers: temporarily set app_id based on pack’s primary app ─────
-- (Backfill will run in a follow-up data migration once app_id metadata exists.)
