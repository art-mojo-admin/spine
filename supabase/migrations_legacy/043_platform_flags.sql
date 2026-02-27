-- 043: Add is_active, is_test_data, pack_id to all core entity tables
-- These platform-wide flags enable template packs to pre-install inactive
-- config and test data that can be toggled on/off by admins.

-- ── accounts ──────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── persons ───────────────────────────────────────────────────────────
ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── memberships ───────────────────────────────────────────────────────
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── workflow_definitions ──────────────────────────────────────────────
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── stage_definitions ─────────────────────────────────────────────────
ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE stage_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── transition_definitions ────────────────────────────────────────────
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── workflow_actions ──────────────────────────────────────────────────
ALTER TABLE workflow_actions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE workflow_actions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE workflow_actions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── workflow_items ────────────────────────────────────────────────────
ALTER TABLE workflow_items ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE workflow_items ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE workflow_items ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── automation_rules ──────────────────────────────────────────────────
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── tickets ───────────────────────────────────────────────────────────
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── ticket_messages ───────────────────────────────────────────────────
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── knowledge_base_articles ───────────────────────────────────────────
ALTER TABLE knowledge_base_articles ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE knowledge_base_articles ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE knowledge_base_articles ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── custom_field_definitions ──────────────────────────────────────────
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE custom_field_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── entity_links ──────────────────────────────────────────────────────
ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── link_type_definitions ─────────────────────────────────────────────
ALTER TABLE link_type_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE link_type_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE link_type_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── account_modules ───────────────────────────────────────────────────
ALTER TABLE account_modules ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE account_modules ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE account_modules ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── custom_action_types ───────────────────────────────────────────────
ALTER TABLE custom_action_types ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE custom_action_types ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE custom_action_types ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── nav_extensions ────────────────────────────────────────────────────
ALTER TABLE nav_extensions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE nav_extensions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE nav_extensions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── nav_overrides ─────────────────────────────────────────────────────
ALTER TABLE nav_overrides ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE nav_overrides ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE nav_overrides ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── enrollments ───────────────────────────────────────────────────────
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── lesson_completions ────────────────────────────────────────────────
ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE lesson_completions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── dashboard_definitions ─────────────────────────────────────────────
ALTER TABLE dashboard_definitions ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE dashboard_definitions ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE dashboard_definitions ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── dashboard_widgets ─────────────────────────────────────────────────
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS is_active    boolean NOT NULL DEFAULT true;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS pack_id      uuid    REFERENCES config_packs(id) ON DELETE SET NULL;

-- ── Partial indexes for inactive records (optimizes default active-only queries) ──
CREATE INDEX IF NOT EXISTS idx_accounts_inactive            ON accounts(is_active)              WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_persons_inactive             ON persons(is_active)               WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_memberships_inactive         ON memberships(is_active)           WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_workflow_defs_inactive       ON workflow_definitions(is_active)   WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_stage_defs_inactive          ON stage_definitions(is_active)      WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_transition_defs_inactive     ON transition_definitions(is_active) WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_workflow_actions_inactive    ON workflow_actions(is_active)       WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_workflow_items_inactive      ON workflow_items(is_active)         WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_automation_rules_inactive    ON automation_rules(is_active)       WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_tickets_inactive             ON tickets(is_active)               WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_ticket_messages_inactive     ON ticket_messages(is_active)        WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_kb_articles_inactive         ON knowledge_base_articles(is_active) WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_inactive   ON custom_field_definitions(is_active) WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_entity_links_inactive        ON entity_links(is_active)           WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_link_type_defs_inactive      ON link_type_definitions(is_active)  WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_account_modules_inactive     ON account_modules(is_active)        WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_custom_action_types_inactive ON custom_action_types(is_active)    WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_nav_extensions_inactive      ON nav_extensions(is_active)         WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_nav_overrides_inactive       ON nav_overrides(is_active)          WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_enrollments_inactive         ON enrollments(is_active)            WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_lesson_completions_inactive  ON lesson_completions(is_active)     WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_dashboard_defs_inactive      ON dashboard_definitions(is_active)  WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_inactive   ON dashboard_widgets(is_active)      WHERE is_active = false;

-- ── Pack ID indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_accounts_pack            ON accounts(pack_id)              WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persons_pack             ON persons(pack_id)               WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_pack         ON memberships(pack_id)           WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_defs_pack       ON workflow_definitions(pack_id)   WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stage_defs_pack          ON stage_definitions(pack_id)      WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transition_defs_pack     ON transition_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_actions_pack    ON workflow_actions(pack_id)       WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_items_pack      ON workflow_items(pack_id)         WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_rules_pack    ON automation_rules(pack_id)       WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_pack             ON tickets(pack_id)               WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_articles_pack         ON knowledge_base_articles(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_pack   ON custom_field_definitions(pack_id) WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_links_pack        ON entity_links(pack_id)           WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_type_defs_pack      ON link_type_definitions(pack_id)  WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nav_extensions_pack      ON nav_extensions(pack_id)         WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nav_overrides_pack       ON nav_overrides(pack_id)          WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_defs_pack      ON dashboard_definitions(pack_id)  WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_pack   ON dashboard_widgets(pack_id)      WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_items_pack2     ON workflow_items(pack_id)         WHERE pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_pack         ON enrollments(pack_id)            WHERE pack_id IS NOT NULL;
