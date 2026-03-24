-- 047: Prefix v1 tables with x_ to signal deprecated status
-- These tables do not fit the v2 item model and are preserved for reference only.
-- V2 replacements are noted for each table.

BEGIN;

-- ── Workflow v1 tables ──────────────────────────────────────────────────────
-- stage_definitions      → workflow_definitions.statuses (jsonb)
-- transition_definitions → workflow_definitions.statuses[].to_statuses (jsonb)
-- workflow_actions       → automation_rules
ALTER TABLE stage_definitions      RENAME TO x_stage_definitions;
ALTER TABLE transition_definitions RENAME TO x_transition_definitions;
ALTER TABLE workflow_actions       RENAME TO x_workflow_actions;

-- ── Entity/linking v1 tables ────────────────────────────────────────────────
-- entity_type_registry   → item_type_registry
-- link_type_definitions  → item_links (item-centric)
ALTER TABLE entity_type_registry  RENAME TO x_entity_type_registry;
ALTER TABLE link_type_definitions RENAME TO x_link_type_definitions;

-- ── Field v1 table ──────────────────────────────────────────────────────────
-- field_definitions → item_type_registry.schema.fields (jsonb)
ALTER TABLE field_definitions RENAME TO x_field_definitions;

-- ── Role policy v1 table ────────────────────────────────────────────────────
-- role_policies_legacy → principal_scopes
ALTER TABLE role_policies_legacy RENAME TO x_role_policies;

-- ── Knowledge/LMS v1 tables ─────────────────────────────────────────────────
-- legacy_knowledge_base_articles → items (item_type='knowledge_article')
-- legacy_enrollments             → items (item_type='enrollment')
-- legacy_lesson_completions      → items (item_type='lesson_completion')
ALTER TABLE legacy_knowledge_base_articles RENAME TO x_knowledge_base_articles;
ALTER TABLE legacy_enrollments             RENAME TO x_enrollments;
ALTER TABLE legacy_lesson_completions      RENAME TO x_lesson_completions;

-- ── Unblock v2 item creation ────────────────────────────────────────────────
-- workflow_definition_id and stage_definition_id were NOT NULL, blocking
-- creation of items that don't belong to a v1 workflow.
ALTER TABLE items
  ALTER COLUMN workflow_definition_id DROP NOT NULL,
  ALTER COLUMN stage_definition_id    DROP NOT NULL;

COMMIT;
