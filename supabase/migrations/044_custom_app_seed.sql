-- 044: Custom App Seed — Spine.com Wave 1 Knowledge/Support/Community
-- Registers item types, workflows, stages, fields, and link types for the custom app

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1: Register item types
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO item_type_registry (slug, label, icon, is_system) VALUES
  ('knowledge_article', 'Knowledge Article', 'file-text', false),
  ('support_case', 'Support Case', 'help-circle', false),
  ('community_post', 'Community Post', 'message-square', false),
  ('community_reply', 'Community Reply', 'corner-up-left', false),
  ('category', 'Category', 'folder', false)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2: Register link types
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO link_type_registry (slug, label, description, source_type, target_type, is_system) VALUES
  ('references', 'References', 'Support case references knowledge article', 'support_case', 'knowledge_article', false),
  ('resulted_in', 'Resulted In', 'Support case resulted in knowledge article', 'support_case', 'knowledge_article', false),
  ('related_to', 'Related To', 'Knowledge article related to another article', 'knowledge_article', 'knowledge_article', false),
  ('escalated_to', 'Escalated To', 'Support case escalated to operator', 'support_case', 'person', false),
  ('discusses', 'Discusses', 'Community post discusses knowledge article', 'community_post', 'knowledge_article', false),
  ('prompted_by', 'Prompted By', 'Community post prompted support case', 'community_post', 'support_case', false),
  ('parent_post', 'Parent Post', 'Reply belongs to parent post', 'community_reply', 'community_post', false)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 3: Create workflow definitions
-- ══════════════════════════════════════════════════════════════════════
-- Knowledge lifecycle workflow
INSERT INTO workflow_definitions (id, account_id, name, description, status, config, public_config, is_active, is_test_data, pack_id, ownership)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Knowledge Lifecycle',
  'Knowledge article lifecycle: draft, review, published, archived',
  'active',
  '{"item_type": "knowledge_article"}'::jsonb,
  '{"system_workflow": false}'::jsonb,
  true, false, NULL, 'tenant'
) ON CONFLICT DO NOTHING;

-- Support case workflow
INSERT INTO workflow_definitions (id, account_id, name, description, status, config, public_config, is_active, is_test_data, pack_id, ownership)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Support Case Lifecycle',
  'Support case lifecycle: open, ai_attempt, escalated, in_progress, resolved, closed',
  'active',
  '{"item_type": "support_case"}'::jsonb,
  '{"system_workflow": false}'::jsonb,
  true, false, NULL, 'tenant'
) ON CONFLICT DO NOTHING;

-- Community moderation workflow
INSERT INTO workflow_definitions (id, account_id, name, description, status, config, public_config, is_active, is_test_data, pack_id, ownership)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Community Moderation',
  'Community post moderation: active, reported, under_review, action_taken, dismissed',
  'active',
  '{"item_type": "community_post"}'::jsonb,
  '{"system_workflow": false}'::jsonb,
  true, false, NULL, 'tenant'
) ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 4: Create stage definitions for each workflow
-- ══════════════════════════════════════════════════════════════════════
-- Knowledge lifecycle stages
INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, config, is_active, is_test_data)
SELECT 
  gen_random_uuid() as id,
  wd.id as workflow_definition_id,
  stage.name,
  stage.position,
  stage.is_initial,
  stage.is_terminal,
  stage.is_public,
  '{}'::jsonb as config,
  true as is_active,
  false as is_test_data
FROM workflow_definitions wd, (VALUES 
  ('Draft', 0, true, false, false),
  ('Review', 1, false, false, false),
  ('Published', 2, false, false, true),
  ('Archived', 3, false, true, false)
) AS stage(name, position, is_initial, is_terminal, is_public)
WHERE wd.name = 'Knowledge Lifecycle' AND wd.account_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Support case stages
INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, config, is_active, is_test_data)
SELECT 
  gen_random_uuid() as id,
  wd.id as workflow_definition_id,
  stage.name,
  stage.position,
  stage.is_initial,
  stage.is_terminal,
  stage.is_public,
  '{}'::jsonb as config,
  true as is_active,
  false as is_test_data
FROM workflow_definitions wd, (VALUES 
  ('Open', 0, true, false, false),
  ('AI Attempt', 1, false, false, false),
  ('Escalated', 2, false, false, false),
  ('In Progress', 3, false, false, false),
  ('Resolved', 4, false, false, false),
  ('Closed', 5, false, true, false)
) AS stage(name, position, is_initial, is_terminal, is_public)
WHERE wd.name = 'Support Case Lifecycle' AND wd.account_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Community moderation stages
INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, config, is_active, is_test_data)
SELECT 
  gen_random_uuid() as id,
  wd.id as workflow_definition_id,
  stage.name,
  stage.position,
  stage.is_initial,
  stage.is_terminal,
  stage.is_public,
  '{}'::jsonb as config,
  true as is_active,
  false as is_test_data
FROM workflow_definitions wd, (VALUES 
  ('Active', 0, true, false, true),
  ('Reported', 1, false, false, false),
  ('Under Review', 2, false, false, false),
  ('Action Taken', 3, false, true, false),
  ('Dismissed', 4, false, true, false)
) AS stage(name, position, is_initial, is_terminal, is_public)
WHERE wd.name = 'Community Moderation' AND wd.account_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 5: Create field definitions for each item type
-- ══════════════════════════════════════════════════════════════════════
-- Knowledge article fields
INSERT INTO field_definitions (account_id, field_key, field_label, field_type, config, is_required, is_active, is_test_data, pack_id, ownership)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  field.field_key,
  field.field_label,
  field.field_type,
  field.config,
  field.is_required,
  field.is_active,
  field.is_test_data,
  NULL,
  'tenant'
FROM (VALUES 
  ('article_kind', 'Article Kind', 'select', '{"options": ["docs", "faq", "troubleshooting", "implementation", "release_note", "announcement"]}', false),
  ('visibility', 'Visibility', 'select', '{"options": ["member", "operator", "admin"]}', true),
  ('audience', 'Audience', 'select', '{"options": ["developer", "operator", "customer", "admin"]}', true),
  ('tags', 'Tags', 'multi_select', '{"options": ["getting-started", "api", "ui", "security", "performance", "troubleshooting", "best-practices"]}', false),
  ('summary', 'Summary', 'textarea', '{}', true),
  ('content', 'Content', 'textarea', '{}', true)
) AS field(field_key, field_label, field_type, config, is_required)
WHERE field.field_key NOT IN (
  SELECT field_key FROM field_definitions 
  WHERE account_id = '00000000-0000-0000-0000-000000000001'
);

-- Support case fields
INSERT INTO field_definitions (account_id, field_key, field_label, field_type, config, is_required, is_active, is_test_data, pack_id, ownership)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  field.field_key,
  field.field_label,
  field.field_type,
  field.config,
  field.is_required,
  field.is_active,
  field.is_test_data,
  NULL,
  'tenant'
FROM (VALUES 
  ('priority', 'Priority', 'select', '{"options": ["low", "medium", "high", "urgent"]}', true),
  ('ai_confidence_score', 'AI Confidence Score', 'number', '{"min": 0, "max": 1}', false),
  ('escalation_reason', 'Escalation Reason', 'select', '{"options": ["missing_knowledge", "retrieval_failure", "ambiguous_question", "product_issue", "unsupported_request"]}', false),
  ('ai_summary', 'AI Summary', 'textarea', '{}', false),
  ('resolution_kind', 'Resolution Kind', 'select', '{"options": ["knowledge_created", "knowledge_updated", "internal_followup", "duplicate", "not_applicable"]}', false),
  ('resolution_notes', 'Resolution Notes', 'textarea', '{}', false)
) AS field(field_key, field_label, field_type, config, is_required)
WHERE field.field_key NOT IN (
  SELECT field_key FROM field_definitions 
  WHERE account_id = '00000000-0000-0000-0000-000000000001'
);

-- Community post fields
INSERT INTO field_definitions (account_id, field_key, field_label, field_type, config, is_required, is_active, is_test_data, pack_id, ownership)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  field.field_key,
  field.field_label,
  field.field_type,
  field.config,
  field.is_required,
  field.is_active,
  field.is_test_data,
  NULL,
  'tenant'
FROM (VALUES 
  ('post_kind', 'Post Kind', 'select', '{"options": ["announcement", "discussion", "question"]}', true),
  ('pinned', 'Pinned', 'boolean', '{}', false),
  ('moderation_status', 'Moderation Status', 'select', '{"options": ["active", "reported", "under_review", "action_taken", "dismissed"]}', false),
  ('moderation_reason', 'Moderation Reason', 'text', '{}', false),
  ('moderation_action', 'Moderation Action', 'text', '{}', false)
) AS field(field_key, field_label, field_type, config, is_required)
WHERE field.field_key NOT IN (
  SELECT field_key FROM field_definitions 
  WHERE account_id = '00000000-0000-0000-0000-000000000001'
);

-- Category fields
INSERT INTO field_definitions (account_id, field_key, field_label, field_type, config, is_required, is_active, is_test_data, pack_id, ownership)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  field.field_key,
  field.field_label,
  field.field_type,
  field.config,
  field.is_required,
  field.is_active,
  field.is_test_data,
  NULL,
  'tenant'
FROM (VALUES 
  ('category_type', 'Category Type', 'select', '{"options": ["knowledge", "support", "community"]}', true),
  ('description', 'Description', 'textarea', '{}', false),
  ('icon', 'Icon', 'text', '{}', false)
) AS field(field_key, field_label, field_type, config, is_required)
WHERE field.field_key NOT IN (
  SELECT field_key FROM field_definitions 
  WHERE account_id = '00000000-0000-0000-0000-000000000001'
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 6: Seed initial categories
-- ══════════════════════════════════════════════════════════════════════
-- Get the workflow definition IDs for creating items
WITH workflow_ids AS (
  SELECT 
    (SELECT id FROM workflow_definitions WHERE name = 'Knowledge Lifecycle' AND account_id = '00000000-0000-0000-0000-000000000001') as knowledge_wf_id,
    (SELECT id FROM item_type_registry WHERE slug = 'category') as category_type_id,
    (SELECT id FROM stage_definitions WHERE name = 'Published' AND workflow_definition_id = (
      SELECT id FROM workflow_definitions WHERE name = 'Knowledge Lifecycle' AND account_id = '00000000-0000-0000-0000-000000000001'
    )) as published_stage_id
)
INSERT INTO items (
  id,
  account_id,
  item_type_id,
  workflow_definition_id,
  stage_definition_id,
  title,
  description,
  metadata,
  status,
  is_active,
  is_test_data,
  pack_id,
  ownership,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  wf.category_type_id,
  wf.knowledge_wf_id,
  wf.published_stage_id,
  cat.name,
  cat.description,
  jsonb_build_object(
    'category_type', cat.category_type,
    'icon', cat.icon
  ),
  'active',
  true,
  false,
  NULL,
  'tenant',
  now(),
  now()
FROM workflow_ids wf, (VALUES 
  ('Knowledge', 'Knowledge base articles, documentation, and guides', 'book-open', 'knowledge'),
  ('Support', 'Support cases and help content', 'help-circle', 'support'),
  ('Community', 'Community discussions and announcements', 'users', 'community')
) AS cat(name, description, icon, category_type);

COMMIT;
