-- 022: Expand Support pack → Support + CSM
-- Pack ID stays: 00000000-0000-0000-0001-000000000002
-- Adds CSM Accounts workflow, extra fields, updated dashboard + app nav

-- ── Update pack metadata ──────────────────────────────────────────────
UPDATE config_packs SET
  name = 'Support + CSM',
  slug = 'support-csm',
  description = 'Customer support ticketing with SLA tracking, plus customer success management with health scoring.',
  pack_data = '{"features":["Support Escalation workflow (6 stages)","CSM Accounts workflow (5 stages)","Severity, product, and SLA fields","Health score and NPS tracking","Customer and ticket linking","Support + CSM dashboards"]}'::jsonb
WHERE id = '00000000-0000-0000-0001-000000000002';

-- ══════════════════════════════════════════════════════════════════════
-- Add "Closed" stage to existing Support workflow
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000015', '00000000-0000-0000-1002-000000000001', 'Closed', 5, false, true, false, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000025', '00000000-0000-0000-1002-000000000001', 'Close', '00000000-0000-0000-1002-000000000014', '00000000-0000-0000-1002-000000000015', false, false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 2: CSM Accounts
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1002-000000000100',
        '00000000-0000-0000-0000-000000000001',
        'CSM Accounts', 'Track customer health through onboarding to renewal',
        false, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000110', '00000000-0000-0000-1002-000000000100', 'Onboarding',  0, true,  false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000111', '00000000-0000-0000-1002-000000000100', 'Active',      1, false, false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000112', '00000000-0000-0000-1002-000000000100', 'At Risk',     2, false, false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000113', '00000000-0000-0000-1002-000000000100', 'Churned',     3, false, true,  false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000114', '00000000-0000-0000-1002-000000000100', 'Renewed',     4, false, true,  false, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000120', '00000000-0000-0000-1002-000000000100', 'Go Live',         '00000000-0000-0000-1002-000000000110', '00000000-0000-0000-1002-000000000111', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000121', '00000000-0000-0000-1002-000000000100', 'Flag At Risk',    '00000000-0000-0000-1002-000000000111', '00000000-0000-0000-1002-000000000112', true,  false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000122', '00000000-0000-0000-1002-000000000100', 'Recover',         '00000000-0000-0000-1002-000000000112', '00000000-0000-0000-1002-000000000111', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000123', '00000000-0000-0000-1002-000000000100', 'Mark Churned',    '00000000-0000-0000-1002-000000000112', '00000000-0000-0000-1002-000000000113', true,  false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000124', '00000000-0000-0000-1002-000000000100', 'Renew',           '00000000-0000-0000-1002-000000000111', '00000000-0000-0000-1002-000000000114', false, false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Additional Custom Fields (CSM)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000130', '00000000-0000-0000-0000-000000000001', 'item',    'Health Score',   'csm_health_score',   'number', '[]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000131', '00000000-0000-0000-0000-000000000001', 'item',    'NPS',            'csm_nps',            'number', '[]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000132', '00000000-0000-0000-0000-000000000001', 'item',    'ARR',            'csm_arr',            'number', '[]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000133', '00000000-0000-0000-0000-000000000001', 'item',    'Renewal Date',   'csm_renewal_date',   'date',   '[]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000134', '00000000-0000-0000-0000-000000000001', 'item',    'SLA Tier',       'support_sla_tier',   'select', '["Free","Pro","Enterprise"]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000135', '00000000-0000-0000-0000-000000000001', 'account', 'Health Score',   'csm_acct_health',    'number', '[]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000136', '00000000-0000-0000-0000-000000000001', 'account', 'NPS',            'csm_acct_nps',       'number', '[]', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Additional Link Types (CSM)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000140', '00000000-0000-0000-0000-000000000001', 'CSM Owner',      'csm_owner',      'item', 'person',  '#8b5cf6', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000141', '00000000-0000-0000-0000-000000000001', 'CSM Account',    'csm_account',    'item', 'account', '#06b6d4', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- New View Definitions (CSM views)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
-- CSM Account list
('00000000-0000-0000-1002-000000000180', '00000000-0000-0000-0000-000000000001',
 'csm-accounts', 'CSM Accounts', 'list', 'item',
 '{"item_type":"csm_account","workflow_definition_id":"00000000-0000-0000-1002-000000000100"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- CSM Health Board
('00000000-0000-0000-1002-000000000181', '00000000-0000-0000-0000-000000000001',
 'csm-health-board', 'Health Board', 'board', 'item',
 '{"item_type":"csm_account","workflow_definition_id":"00000000-0000-0000-1002-000000000100"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- CSM Account Detail
('00000000-0000-0000-1002-000000000182', '00000000-0000-0000-0000-000000000001',
 'csm-account-detail', 'CSM Account Detail', 'detail', 'item',
 '{"item_type":"csm_account"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"activity","position":4}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- KB view (for support docs)
('00000000-0000-0000-1002-000000000184', '00000000-0000-0000-0000-000000000001',
 'support-kb', 'Knowledge Base', 'list', 'document',
 '{}'::jsonb,
 '{"columns":["title","category","status","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Update existing Support dashboard to include CSM counts
-- ══════════════════════════════════════════════════════════════════════

UPDATE view_definitions SET
  name = 'Support & CSM Dashboard',
  config = '{"widgets":[{"widget_type":"count","title":"Open Tickets","config":{"entity_type":"items","filters":{"item_type":"ticket"}},"position":{"x":0,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Critical","config":{"entity_type":"items","filters":{"item_type":"ticket","priority":"urgent"}},"position":{"x":2,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"CSM Accounts","config":{"entity_type":"items","filters":{"item_type":"csm_account"}},"position":{"x":4,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"At Risk","config":{"entity_type":"items","filters":{"item_type":"csm_account","stage":"At Risk"}},"position":{"x":0,"y":1,"w":2,"h":1}},{"widget_type":"list","title":"Recent Tickets","config":{"entity_type":"items","filters":{"item_type":"ticket"},"limit":5},"position":{"x":0,"y":2,"w":3,"h":2}},{"widget_type":"list","title":"At-Risk Accounts","config":{"entity_type":"items","filters":{"item_type":"csm_account","stage":"At Risk"},"limit":5},"position":{"x":3,"y":2,"w":3,"h":2}}]}'::jsonb
WHERE id = '00000000-0000-0000-1002-000000000083';

-- ══════════════════════════════════════════════════════════════════════
-- Update App Definition: add CSM nav items
-- ══════════════════════════════════════════════════════════════════════

UPDATE app_definitions SET
  name = 'Support & CSM',
  description = 'Customer support ticketing and customer success management',
  nav_items = '[{"label":"Dashboard","icon":"layout-dashboard","route_type":"view","view_slug":"support-dashboard","position":0,"min_role":"member"},{"label":"Tickets","icon":"inbox","route_type":"view","view_slug":"support-tickets","position":1,"min_role":"member"},{"label":"Ticket Board","icon":"kanban-square","route_type":"view","view_slug":"support-board","position":2,"min_role":"member"},{"label":"Knowledge Base","icon":"book-open","route_type":"view","view_slug":"support-kb","position":3,"min_role":"member"},{"label":"CSM Accounts","icon":"building-2","route_type":"view","view_slug":"csm-accounts","position":4,"min_role":"member"},{"label":"Health Board","icon":"heart-pulse","route_type":"view","view_slug":"csm-health-board","position":5,"min_role":"member"}]'::jsonb
WHERE id = '00000000-0000-0000-1002-000000000090';

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: CSM Accounts (item_type = 'csm_account')
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000160', '00000000-0000-0000-0000-000000000001', 'csm_account', '00000000-0000-0000-1002-000000000100', '00000000-0000-0000-1002-000000000111',
 'Acme Corp', 'Enterprise customer, 50-seat license', 'high',
 '{"csm_health_score": 85, "csm_nps": 9, "csm_arr": 60000, "csm_renewal_date": "2026-12-01"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000161', '00000000-0000-0000-0000-000000000001', 'csm_account', '00000000-0000-0000-1002-000000000100', '00000000-0000-0000-1002-000000000112',
 'Widget Co', 'Starter plan, low engagement', 'medium',
 '{"csm_health_score": 35, "csm_nps": 4, "csm_arr": 6000, "csm_renewal_date": "2026-06-15"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000162', '00000000-0000-0000-0000-000000000001', 'csm_account', '00000000-0000-0000-1002-000000000100', '00000000-0000-0000-1002-000000000110',
 'GreenEnergy Inc', 'New customer, onboarding in progress', 'high',
 '{"csm_health_score": 70, "csm_arr": 24000}', false, true, '00000000-0000-0000-0001-000000000002', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Entity Links for CSM
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000170', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000160', 'account', '00000000-0000-0000-0002-000000000001', 'csm_account',  false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000171', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000160', 'person',  '00000000-0000-0000-0003-000000000002', 'csm_owner',    false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000172', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000161', 'account', '00000000-0000-0000-0002-000000000002', 'csm_account',  false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000173', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000161', 'person',  '00000000-0000-0000-0003-000000000002', 'csm_owner',    false, true, '00000000-0000-0000-0001-000000000002', 'pack');
