-- 015: Support Portal Pack — v2 schema (items, threads, views, apps)
-- Pack ID: 00000000-0000-0000-0001-000000000002

-- ── Workflow: Support Escalation ──────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1002-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Support Escalation', 'Route support requests through triage to resolution',
        false, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000010', '00000000-0000-0000-1002-000000000001', 'New',               0, true,  false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000011', '00000000-0000-0000-1002-000000000001', 'Triaged',           1, false, false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000001', 'In Progress',       2, false, false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000013', '00000000-0000-0000-1002-000000000001', 'Awaiting Customer', 3, false, false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000014', '00000000-0000-0000-1002-000000000001', 'Resolved',          4, false, true,  false, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000020', '00000000-0000-0000-1002-000000000001', 'Triage',           '00000000-0000-0000-1002-000000000010', '00000000-0000-0000-1002-000000000011', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000021', '00000000-0000-0000-1002-000000000001', 'Start Work',       '00000000-0000-0000-1002-000000000011', '00000000-0000-0000-1002-000000000012', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000022', '00000000-0000-0000-1002-000000000001', 'Ask Customer',     '00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000013', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000023', '00000000-0000-0000-1002-000000000001', 'Customer Replied', '00000000-0000-0000-1002-000000000013', '00000000-0000-0000-1002-000000000012', false, false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000024', '00000000-0000-0000-1002-000000000001', 'Resolve',          '00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000014', true,  false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Custom Fields (entity_type = 'item' not 'ticket') ───────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000030', '00000000-0000-0000-0000-000000000001', 'item', 'Product',     'support_product',     'select', '["Core","API","Mobile","Integrations"]',  false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000031', '00000000-0000-0000-0000-000000000001', 'item', 'Environment', 'support_environment', 'select', '["Production","Staging","Development"]',  false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000032', '00000000-0000-0000-0000-000000000001', 'item', 'Severity',    'support_severity',    'select', '["Critical","Major","Minor","Cosmetic"]', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000033', '00000000-0000-0000-0000-000000000001', 'person', 'Plan Tier', 'support_plan_tier',   'select', '["Free","Pro","Enterprise"]',              false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Link Types (entity_type = 'item' not 'workflow_item'/'ticket') ──
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000040', '00000000-0000-0000-0000-000000000001', 'Related Ticket',    'support_related_ticket',    'item', 'item',   '#f59e0b', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000041', '00000000-0000-0000-0000-000000000001', 'Affected Customer', 'support_affected_customer', 'item', 'person', '#ef4444', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000042', '00000000-0000-0000-0000-000000000001', 'Requester',         'requester',                 'item', 'person', '#3b82f6', false, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000043', '00000000-0000-0000-0000-000000000001', 'Assignee',          'assignee',                  'item', 'person', '#10b981', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000050', '00000000-0000-0000-0000-000000000001',
 'Support Agent Guide', 'support-agent-guide',
 '# Support Agent Guide

## Handling Tickets
1. **New** tickets appear in your queue — triage them by severity
2. **Triage** to classify product area and environment
3. **Start Work** when you begin investigating
4. **Ask Customer** if you need more info
5. **Resolve** with a comment explaining the fix

## Custom Fields
- **Product** — Which product area is affected
- **Environment** — Production, Staging, or Development
- **Severity** — Critical, Major, Minor, or Cosmetic

## Tips
- Link related tickets to track patterns
- Use threads to maintain context with the customer',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── View Definitions ────────────────────────────────────────────────
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
-- Ticket list view
('00000000-0000-0000-1002-000000000080', '00000000-0000-0000-0000-000000000001',
 'support-tickets', 'All Tickets', 'list', 'item',
 '{"item_type":"ticket","workflow_definition_id":"00000000-0000-0000-1002-000000000001"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- Ticket board view
('00000000-0000-0000-1002-000000000081', '00000000-0000-0000-0000-000000000001',
 'support-board', 'Ticket Board', 'board', 'item',
 '{"item_type":"ticket","workflow_definition_id":"00000000-0000-0000-1002-000000000001"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- Ticket detail view
('00000000-0000-0000-1002-000000000082', '00000000-0000-0000-0000-000000000001',
 'support-ticket-detail', 'Ticket Detail', 'detail', 'item',
 '{"item_type":"ticket"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"threads","position":2,"config":{"thread_type":"support"}},{"type":"relationships","position":3},{"type":"attachments","position":4},{"type":"activity","position":5}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack'),
-- Support dashboard
('00000000-0000-0000-1002-000000000083', '00000000-0000-0000-0000-000000000001',
 'support-dashboard', 'Support Dashboard', 'dashboard', NULL,
 '{}'::jsonb,
 '{"widgets":[{"widget_type":"count","title":"Open Tickets","config":{"entity_type":"items","filters":{"item_type":"ticket"}},"position":{"x":0,"y":0,"w":3,"h":1}},{"widget_type":"count","title":"Critical","config":{"entity_type":"items","filters":{"item_type":"ticket","priority":"urgent"}},"position":{"x":3,"y":0,"w":3,"h":1}}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── App Definition ──────────────────────────────────────────────────
INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000090', '00000000-0000-0000-0000-000000000001',
 'support', 'Support', 'headphones', 'Customer support ticket management',
 '[{"label":"Dashboard","icon":"layout-dashboard","route_type":"view","view_slug":"support-dashboard","position":0,"min_role":"member"},{"label":"All Tickets","icon":"inbox","route_type":"view","view_slug":"support-tickets","position":1,"min_role":"member"},{"label":"Board","icon":"kanban-square","route_type":"view","view_slug":"support-board","position":2,"min_role":"member"},{"label":"Knowledge Base","icon":"book-open","route_type":"view","view_slug":"support-kb","position":3,"min_role":"member"}]'::jsonb,
 'support-dashboard', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Test Data: Items (was workflow_items, item_type = 'ticket') ─────
INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000060', '00000000-0000-0000-0000-000000000001', 'ticket', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000010',
 'Login page returns 500 error', 'Users unable to log in since morning', 'urgent',
 '{"support_product":"Core","support_severity":"Critical","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000061', '00000000-0000-0000-0000-000000000001', 'ticket', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000012',
 'API rate limit too low', 'Customer hitting limits on batch operations', 'medium',
 '{"support_product":"API","support_severity":"Minor","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000062', '00000000-0000-0000-0000-000000000001', 'ticket', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000013',
 'Mobile app crashes on iOS 17', 'Crash on launch for specific devices', 'high',
 '{"support_product":"Mobile","support_severity":"Major","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000063', '00000000-0000-0000-0000-000000000001', 'ticket', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000014',
 'Integration webhook not firing', 'Zapier integration stopped working', 'low',
 '{"support_product":"Integrations","support_severity":"Minor","support_environment":"Staging"}', false, true, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Test Data: Entity Links (person roles as relationships) ─────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1002-000000000070', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000060', 'person', '00000000-0000-0000-0003-000000000005', 'requester',                false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000071', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000060', 'person', '00000000-0000-0000-0003-000000000003', 'assignee',                 false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000072', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000060', 'item',   '00000000-0000-0000-1002-000000000062', 'support_related_ticket',   false, true, '00000000-0000-0000-0001-000000000002', 'pack'),
('00000000-0000-0000-1002-000000000073', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000060', 'person', '00000000-0000-0000-0003-000000000005', 'support_affected_customer', false, true, '00000000-0000-0000-0001-000000000002', 'pack');

-- ── Test Data: Threads + Messages ───────────────────────────────────
INSERT INTO threads (id, account_id, target_type, target_id, thread_type, visibility, status, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1002-0000000000a0', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1002-000000000060', 'support', 'portal', 'open', false, true, '00000000-0000-0000-0001-000000000002', 'pack');

INSERT INTO messages (id, thread_id, person_id, direction, body, sequence, visibility, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1002-0000000000b0', '00000000-0000-0000-1002-0000000000a0', '00000000-0000-0000-0003-000000000005', 'inbound',  'I cannot log into the dashboard. Getting a 500 error since this morning.', 1, 'inherit', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-0000000000b1', '00000000-0000-0000-1002-0000000000a0', '00000000-0000-0000-0003-000000000003', 'outbound', 'Thanks for reporting this. We''re looking into it now. Can you share your browser and OS?', 2, 'inherit', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-0000000000b2', '00000000-0000-0000-1002-0000000000a0', '00000000-0000-0000-0003-000000000003', 'internal', 'Looks like a database connection pool issue. Checking prod metrics.', 3, 'internal', false, true, '00000000-0000-0000-0001-000000000002');
