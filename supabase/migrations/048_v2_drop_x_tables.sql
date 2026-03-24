-- 048: V2 Crystallize - Drop all x_ tables and finalize v2 schema
-- All x_ table data is treated as legacy and discarded

BEGIN;

-- ── Add v2 columns ────────────────────────────────────────────────────────
-- Add workflow statuses array to workflow_definitions
ALTER TABLE workflow_definitions 
  ADD COLUMN statuses jsonb DEFAULT '[]';

-- Add default_workflow_id to item_type_registry (1:1 item_type → workflow)
ALTER TABLE item_type_registry 
  ADD COLUMN default_workflow_id uuid REFERENCES workflow_definitions(id);

-- ── Drop v1 column from items ─────────────────────────────────────────────────
-- stage_definition_id is replaced by items.status text
ALTER TABLE items 
  DROP COLUMN stage_definition_id;

-- ── Drop all x_ tables (legacy data) ─────────────────────────────────────────
DROP TABLE IF EXISTS x_stage_definitions CASCADE;
DROP TABLE IF EXISTS x_transition_definitions CASCADE;
DROP TABLE IF EXISTS x_workflow_actions CASCADE;
DROP TABLE IF EXISTS x_field_definitions CASCADE;
DROP TABLE IF EXISTS x_link_type_definitions CASCADE;
DROP TABLE IF EXISTS x_entity_type_registry CASCADE;
DROP TABLE IF EXISTS x_role_policies CASCADE;
DROP TABLE IF EXISTS x_knowledge_base_articles CASCADE;
DROP TABLE IF EXISTS x_enrollments CASCADE;
DROP TABLE IF EXISTS x_lesson_completions CASCADE;

COMMIT;
