-- 032: Seed pack role policies and mark legacy packs
BEGIN;

-- Target packs for default Account Admin policies
WITH target_packs AS (
  SELECT * FROM (VALUES
    ('00000000-0000-0000-0001-000000000008'::uuid), -- Marketing
    ('00000000-0000-0000-0001-000000000001'::uuid), -- Sales / CRM
    ('00000000-0000-0000-0001-000000000007'::uuid), -- Operations
    ('00000000-0000-0000-0001-000000000002'::uuid)  -- Support + CSM
  ) AS tp(pack_id)
),
entity_sources AS (
  SELECT 'workflow_definition' AS entity_type, id AS entity_id, pack_id FROM workflow_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'stage_definition', id, pack_id FROM stage_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'transition_definition', id, pack_id FROM transition_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'workflow_action', id, pack_id FROM workflow_actions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'automation_rule', id, pack_id FROM automation_rules
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'custom_field_definition', id, pack_id FROM custom_field_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'link_type_definition', id, pack_id FROM link_type_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'view_definition', id, pack_id FROM view_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'app_definition', id, pack_id FROM app_definitions
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'account_module', id, pack_id FROM account_modules
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'custom_action_type', id, pack_id FROM custom_action_types
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'thread', id, pack_id FROM threads
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'message', id, pack_id FROM messages
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND COALESCE(is_test_data, false) = false AND pack_id IS NOT NULL
  UNION ALL
  SELECT 'item', id, pack_id FROM items
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
  UNION ALL
  SELECT 'entity_link', id, pack_id FROM entity_links
  WHERE pack_id IN (SELECT pack_id FROM target_packs) AND ownership = 'pack' AND COALESCE(is_test_data, false) = false
)
INSERT INTO role_policies (entity_type, entity_id, pack_id, ownership, visibility, editability, metadata)
SELECT
  es.entity_type,
  es.entity_id,
  es.pack_id,
  'pack',
  jsonb_build_object('default_role', 'admin'),
  jsonb_build_object('default_role', 'admin'),
  jsonb_build_object('seed', '032_pack_role_policies')
FROM entity_sources es
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Mark legacy packs so they can no longer be installed
WITH legacy_packs AS (
  SELECT * FROM (VALUES
    ('00000000-0000-0000-0001-000000000004'::uuid, 'Coursera'),
    ('00000000-0000-0000-0001-000000000005'::uuid, 'Jira'),
    ('00000000-0000-0000-0001-000000000003'::uuid, 'Skool'),
    ('00000000-0000-0000-0001-000000000006'::uuid, 'Monday')
  ) AS lp(pack_id, pack_name)
)
UPDATE config_packs cp
SET pack_data = jsonb_set(
      COALESCE(cp.pack_data, '{}'::jsonb),
      '{legacy}',
      'true'::jsonb,
      true
    ),
    description = CASE
      WHEN cp.description ILIKE '%Legacy - disabled%' THEN cp.description
      ELSE CONCAT_WS(' ', COALESCE(cp.description, cp.name), '(Legacy - disabled)')
    END,
    is_system = false
WHERE cp.id IN (SELECT pack_id FROM legacy_packs);

COMMIT;
