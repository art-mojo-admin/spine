-- 020: Monday Pack — v2 schema (items, views, apps)
-- Pack ID: 00000000-0000-0000-0001-000000000006

-- ── Workflow: Project Board ───────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1006-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Project Board', 'General project tracking with status labels',
        false, '00000000-0000-0000-0001-000000000006', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000010', '00000000-0000-0000-1006-000000000001', 'Not Started', 0, true,  false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000001', 'Working On',  1, false, false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000012', '00000000-0000-0000-1006-000000000001', 'Stuck',       2, false, false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000013', '00000000-0000-0000-1006-000000000001', 'Done',        3, false, true,  false, '00000000-0000-0000-0001-000000000006', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000020', '00000000-0000-0000-1006-000000000001', 'Start',       '00000000-0000-0000-1006-000000000010', '00000000-0000-0000-1006-000000000011', false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000021', '00000000-0000-0000-1006-000000000001', 'Mark Stuck',  '00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000012', true,  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000022', '00000000-0000-0000-1006-000000000001', 'Unstick',     '00000000-0000-0000-1006-000000000012', '00000000-0000-0000-1006-000000000011', false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000023', '00000000-0000-0000-1006-000000000001', 'Complete',    '00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000013', false, false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Workflow: Client Requests ─────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1006-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Client Requests', 'Track client requests from intake to delivery',
        false, '00000000-0000-0000-0001-000000000006', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000040', '00000000-0000-0000-1006-000000000002', 'Incoming',    0, true,  false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000002', 'Reviewing',   1, false, false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000042', '00000000-0000-0000-1006-000000000002', 'Approved',    2, false, false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000043', '00000000-0000-0000-1006-000000000002', 'In Progress', 3, false, false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000044', '00000000-0000-0000-1006-000000000002', 'Delivered',   4, false, true,  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000045', '00000000-0000-0000-1006-000000000002', 'Rejected',    5, false, true,  false, '00000000-0000-0000-0001-000000000006', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000050', '00000000-0000-0000-1006-000000000002', 'Review',      '00000000-0000-0000-1006-000000000040', '00000000-0000-0000-1006-000000000041', false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000051', '00000000-0000-0000-1006-000000000002', 'Approve',     '00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000042', false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000052', '00000000-0000-0000-1006-000000000002', 'Reject',      '00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000045', true,  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000053', '00000000-0000-0000-1006-000000000002', 'Start Work',  '00000000-0000-0000-1006-000000000042', '00000000-0000-0000-1006-000000000043', false, false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000054', '00000000-0000-0000-1006-000000000002', 'Deliver',     '00000000-0000-0000-1006-000000000043', '00000000-0000-0000-1006-000000000044', false, false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000030', '00000000-0000-0000-0000-000000000001', 'item', 'Timeline Start',  'mon_timeline_start', 'date',   '[]',                                                  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000031', '00000000-0000-0000-0000-000000000001', 'item', 'Timeline End',    'mon_timeline_end',   'date',   '[]',                                                  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000032', '00000000-0000-0000-0000-000000000001', 'item', 'Status Label',    'mon_status_label',   'select', '["On Track","At Risk","Off Track","Complete"]',       false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000033', '00000000-0000-0000-0000-000000000001', 'item', 'Priority',        'mon_priority',       'select', '["Critical","High","Medium","Low"]',                  false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000034', '00000000-0000-0000-0000-000000000001', 'item', 'Team',            'mon_team',           'select', '["Marketing","Sales","Engineering","Design","Ops"]',  false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000060', '00000000-0000-0000-0000-000000000001', 'Assignee',     'mon_assignee',     'item', 'person',  '#3b82f6', false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000061', '00000000-0000-0000-0000-000000000001', 'Reviewer',     'mon_reviewer',     'item', 'person',  '#8b5cf6', false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000062', '00000000-0000-0000-0000-000000000001', 'Related Item', 'mon_related_item', 'item', 'item',    '#f59e0b', false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000063', '00000000-0000-0000-0000-000000000001', 'Client',       'mon_client',       'item', 'account', '#22c55e', false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000070', '00000000-0000-0000-0000-000000000001',
 'Team Member Guide', 'monday-team-guide',
 '# Team Member Guide

## Project Board
Track your work items through: Not Started → Working On → Stuck → Done

## Client Requests
Client requests flow through: Incoming → Reviewing → Approved → In Progress → Delivered

## Custom Fields
- **Timeline** — Start and end dates for scheduling
- **Status Label** — On Track, At Risk, Off Track, or Complete
- **Priority** — Critical, High, Medium, Low
- **Team** — Which team owns the item

## Tips
- Mark items as Stuck with a comment explaining the blocker
- Use the timeline fields to track project schedules
- Link related items to see dependencies across boards',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── View Definitions ────────────────────────────────────────────────
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-0000000000a0', '00000000-0000-0000-0000-000000000001',
 'mon-projects', 'Projects', 'board', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1006-000000000001"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-0000000000a1', '00000000-0000-0000-0000-000000000001',
 'mon-requests', 'Client Requests', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1006-000000000002"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-0000000000a2', '00000000-0000-0000-0000-000000000001',
 'mon-item-detail', 'Item Detail', 'detail', 'item',
 '{}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"activity","position":4}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── App Definition ──────────────────────────────────────────────────
INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1006-0000000000b0', '00000000-0000-0000-0000-000000000001',
 'work-management', 'Work Management', 'layout-grid', 'Project boards and client request tracking',
 '[{"label":"Projects","icon":"kanban-square","route_type":"view","view_slug":"mon-projects","position":0,"min_role":"member"},{"label":"Client Requests","icon":"inbox","route_type":"view","view_slug":"mon-requests","position":1,"min_role":"member"}]'::jsonb,
 'mon-projects', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Test Data: Items ────────────────────────────────────────────────
INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000080', '00000000-0000-0000-0000-000000000001', 'project', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000011',
 'Redesign landing page', 'Update hero section and testimonials', 'high',
 '{"mon_timeline_start":"2026-03-01","mon_timeline_end":"2026-03-15","mon_status_label":"On Track","mon_priority":"High","mon_team":"Design"}', false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000081', '00000000-0000-0000-0000-000000000001', 'project', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000012',
 'Migrate database to new cluster', 'Zero-downtime migration plan needed', 'high',
 '{"mon_timeline_start":"2026-03-10","mon_timeline_end":"2026-03-20","mon_status_label":"At Risk","mon_priority":"Critical","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000082', '00000000-0000-0000-0000-000000000001', 'project', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000010',
 'Q2 marketing campaign', 'Plan and execute Q2 campaign', 'medium',
 '{"mon_timeline_start":"2026-04-01","mon_timeline_end":"2026-06-30","mon_status_label":"On Track","mon_priority":"Medium","mon_team":"Marketing"}', false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000083', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1006-000000000002', '00000000-0000-0000-1006-000000000041',
 'Widget Co — Custom report template', 'Client needs a branded report output', 'medium',
 '{"mon_priority":"Medium","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000084', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1006-000000000002', '00000000-0000-0000-1006-000000000043',
 'Acme Corp — SSO integration', 'SAML SSO for enterprise login', 'high',
 '{"mon_priority":"High","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006', 'pack');

-- ── Test Data: Entity Links ─────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1006-000000000090', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1006-000000000080', 'person',  '00000000-0000-0000-0003-000000000004', 'assignee',   false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000091', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1006-000000000081', 'person',  '00000000-0000-0000-0003-000000000003', 'assignee',   false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000092', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1006-000000000083', 'account', '00000000-0000-0000-0002-000000000002', 'mon_client', false, true, '00000000-0000-0000-0001-000000000006', 'pack'),
('00000000-0000-0000-1006-000000000093', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1006-000000000084', 'account', '00000000-0000-0000-0002-000000000001', 'mon_client', false, true, '00000000-0000-0000-0001-000000000006', 'pack');
