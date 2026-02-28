-- 023: Operations Pack (Projects + Tasks + Orders)
-- Pack ID: 00000000-0000-0000-0001-000000000007

INSERT INTO config_packs (id, name, slug, icon, category, description, is_system, pack_data) VALUES
('00000000-0000-0000-0001-000000000007', 'Operations', 'operations', 'folder-kanban', 'operations',
 'Project management with task tracking, plus order fulfillment with public status portal.',
 true, '{"features":["Projects workflow (6 stages)","Tasks workflow (4 stages)","Orders workflow (6 stages)","Story points, sprint, and tracking fields","Project-Task parent/child linking","Order status public portal","Ops dashboard"]}'::jsonb);

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 1: Projects
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1007-000000000001', '00000000-0000-0000-0000-000000000001',
        'Projects', 'Track projects from planning through delivery',
        false, '00000000-0000-0000-0001-000000000007', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000010', '00000000-0000-0000-1007-000000000001', 'Backlog',     0, true,  false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000011', '00000000-0000-0000-1007-000000000001', 'Planning',    1, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000012', '00000000-0000-0000-1007-000000000001', 'In Progress', 2, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000013', '00000000-0000-0000-1007-000000000001', 'Review',      3, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000014', '00000000-0000-0000-1007-000000000001', 'Done',        4, false, true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000015', '00000000-0000-0000-1007-000000000001', 'Archived',    5, false, true,  false, '00000000-0000-0000-0001-000000000007', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000020', '00000000-0000-0000-1007-000000000001', 'Plan',       '00000000-0000-0000-1007-000000000010', '00000000-0000-0000-1007-000000000011', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000021', '00000000-0000-0000-1007-000000000001', 'Start',      '00000000-0000-0000-1007-000000000011', '00000000-0000-0000-1007-000000000012', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000022', '00000000-0000-0000-1007-000000000001', 'Review',     '00000000-0000-0000-1007-000000000012', '00000000-0000-0000-1007-000000000013', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000023', '00000000-0000-0000-1007-000000000001', 'Complete',   '00000000-0000-0000-1007-000000000013', '00000000-0000-0000-1007-000000000014', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000024', '00000000-0000-0000-1007-000000000001', 'Archive',    '00000000-0000-0000-1007-000000000014', '00000000-0000-0000-1007-000000000015', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000025', '00000000-0000-0000-1007-000000000001', 'Back to WIP','00000000-0000-0000-1007-000000000013', '00000000-0000-0000-1007-000000000012', false, false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 2: Tasks
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1007-000000000100', '00000000-0000-0000-0000-000000000001',
        'Tasks', 'Simple task board for day-to-day work',
        false, '00000000-0000-0000-0001-000000000007', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000110', '00000000-0000-0000-1007-000000000100', 'To Do',       0, true,  false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000111', '00000000-0000-0000-1007-000000000100', 'In Progress', 1, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000112', '00000000-0000-0000-1007-000000000100', 'Blocked',     2, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000113', '00000000-0000-0000-1007-000000000100', 'Done',        3, false, true,  false, '00000000-0000-0000-0001-000000000007', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000120', '00000000-0000-0000-1007-000000000100', 'Start',     '00000000-0000-0000-1007-000000000110', '00000000-0000-0000-1007-000000000111', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000121', '00000000-0000-0000-1007-000000000100', 'Block',     '00000000-0000-0000-1007-000000000111', '00000000-0000-0000-1007-000000000112', true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000122', '00000000-0000-0000-1007-000000000100', 'Unblock',   '00000000-0000-0000-1007-000000000112', '00000000-0000-0000-1007-000000000111', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000123', '00000000-0000-0000-1007-000000000100', 'Complete',  '00000000-0000-0000-1007-000000000111', '00000000-0000-0000-1007-000000000113', false, false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 3: Orders
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership, public_config)
VALUES ('00000000-0000-0000-1007-000000000200', '00000000-0000-0000-0000-000000000001',
        'Orders', 'Track orders from submission through delivery',
        false, '00000000-0000-0000-0001-000000000007', 'pack',
        '{"enabled":true,"listing_title":"Order Status","visible_fields":["title","priority","created_at"]}'::jsonb);

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000210', '00000000-0000-0000-1007-000000000200', 'Submitted',  0, true,  false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000211', '00000000-0000-0000-1007-000000000200', 'Approved',   1, false, false, false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000212', '00000000-0000-0000-1007-000000000200', 'Processing', 2, false, false, true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000213', '00000000-0000-0000-1007-000000000200', 'Shipped',    3, false, false, true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000214', '00000000-0000-0000-1007-000000000200', 'Delivered',  4, false, true,  true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000215', '00000000-0000-0000-1007-000000000200', 'Cancelled',  5, false, true,  false, false, '00000000-0000-0000-0001-000000000007', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000220', '00000000-0000-0000-1007-000000000200', 'Approve',   '00000000-0000-0000-1007-000000000210', '00000000-0000-0000-1007-000000000211', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000221', '00000000-0000-0000-1007-000000000200', 'Process',   '00000000-0000-0000-1007-000000000211', '00000000-0000-0000-1007-000000000212', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000222', '00000000-0000-0000-1007-000000000200', 'Ship',      '00000000-0000-0000-1007-000000000212', '00000000-0000-0000-1007-000000000213', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000223', '00000000-0000-0000-1007-000000000200', 'Deliver',   '00000000-0000-0000-1007-000000000213', '00000000-0000-0000-1007-000000000214', false, false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000224', '00000000-0000-0000-1007-000000000200', 'Cancel',    '00000000-0000-0000-1007-000000000210', '00000000-0000-0000-1007-000000000215', true,  false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000225', '00000000-0000-0000-1007-000000000200', 'Cancel Processing','00000000-0000-0000-1007-000000000211', '00000000-0000-0000-1007-000000000215', true, false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Custom Fields
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000030', '00000000-0000-0000-0000-000000000001', 'item', 'Story Points',     'ops_story_points',    'number', '[]', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000031', '00000000-0000-0000-0000-000000000001', 'item', 'Sprint',           'ops_sprint',          'select', '["Sprint 1","Sprint 2","Sprint 3","Sprint 4","Backlog"]', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000032', '00000000-0000-0000-0000-000000000001', 'item', 'Project Type',     'ops_project_type',    'select', '["Internal","Client","R&D"]', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000033', '00000000-0000-0000-0000-000000000001', 'item', 'Order Number',     'ops_order_number',    'text',   '[]', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000034', '00000000-0000-0000-0000-000000000001', 'item', 'Shipping Address', 'ops_shipping_address','text',   '[]', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000035', '00000000-0000-0000-0000-000000000001', 'item', 'Tracking Number',  'ops_tracking_number', 'text',   '[]', false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Link Types
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000040', '00000000-0000-0000-0000-000000000001', 'Project Task',    'ops_project_task',    'item', 'item',    '#3b82f6', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000041', '00000000-0000-0000-0000-000000000001', 'Blocker',         'ops_blocker',         'item', 'item',    '#ef4444', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000042', '00000000-0000-0000-0000-000000000001', 'Order Customer',  'ops_order_customer',  'item', 'person',  '#f59e0b', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000043', '00000000-0000-0000-0000-000000000001', 'Task Assignee',   'ops_task_assignee',   'item', 'person',  '#10b981', false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- View Definitions
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000080', '00000000-0000-0000-0000-000000000001',
 'ops-project-board', 'Project Board', 'board', 'item',
 '{"item_type":"project","workflow_definition_id":"00000000-0000-0000-1007-000000000001"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000081', '00000000-0000-0000-0000-000000000001',
 'ops-task-board', 'Task Board', 'board', 'item',
 '{"item_type":"task","workflow_definition_id":"00000000-0000-0000-1007-000000000100"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000082', '00000000-0000-0000-0000-000000000001',
 'ops-task-list', 'All Tasks', 'list', 'item',
 '{"item_type":"task","workflow_definition_id":"00000000-0000-0000-1007-000000000100"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000083', '00000000-0000-0000-0000-000000000001',
 'ops-order-list', 'All Orders', 'list', 'item',
 '{"item_type":"order","workflow_definition_id":"00000000-0000-0000-1007-000000000200"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000084', '00000000-0000-0000-0000-000000000001',
 'ops-order-board', 'Order Board', 'board', 'item',
 '{"item_type":"order","workflow_definition_id":"00000000-0000-0000-1007-000000000200"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000085', '00000000-0000-0000-0000-000000000001',
 'ops-project-detail', 'Project Detail', 'detail', 'item',
 '{"item_type":"project"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"activity","position":4}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000086', '00000000-0000-0000-0000-000000000001',
 'ops-dashboard', 'Ops Dashboard', 'dashboard', NULL,
 '{}'::jsonb,
 '{"widgets":[{"widget_type":"count","title":"Active Projects","config":{"entity_type":"items","filters":{"item_type":"project"}},"position":{"x":0,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Open Tasks","config":{"entity_type":"items","filters":{"item_type":"task"}},"position":{"x":2,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Pending Orders","config":{"entity_type":"items","filters":{"item_type":"order"}},"position":{"x":4,"y":0,"w":2,"h":1}},{"widget_type":"list","title":"Recent Tasks","config":{"entity_type":"items","filters":{"item_type":"task"},"limit":5},"position":{"x":0,"y":1,"w":3,"h":2}},{"widget_type":"list","title":"Recent Orders","config":{"entity_type":"items","filters":{"item_type":"order"},"limit":5},"position":{"x":3,"y":1,"w":3,"h":2}}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- App Definitions
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000090', '00000000-0000-0000-0000-000000000001',
 'projects', 'Projects', 'folder-kanban', 'Project and task management',
 '[{"label":"Dashboard","icon":"layout-dashboard","route_type":"view","view_slug":"ops-dashboard","position":0,"min_role":"member"},{"label":"Projects","icon":"folder-kanban","route_type":"view","view_slug":"ops-project-board","position":1,"min_role":"member"},{"label":"Tasks","icon":"check-square","route_type":"view","view_slug":"ops-task-board","position":2,"min_role":"member"},{"label":"All Tasks","icon":"list","route_type":"view","view_slug":"ops-task-list","position":3,"min_role":"member"}]'::jsonb,
 'ops-dashboard', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000091', '00000000-0000-0000-0000-000000000001',
 'orders', 'Orders', 'package', 'Order fulfillment and tracking',
 '[{"label":"All Orders","icon":"list","route_type":"view","view_slug":"ops-order-list","position":0,"min_role":"member"},{"label":"Order Board","icon":"kanban-square","route_type":"view","view_slug":"ops-order-board","position":1,"min_role":"member"}]'::jsonb,
 'ops-order-list', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000007', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
-- Projects
('00000000-0000-0000-1007-000000000060', '00000000-0000-0000-0000-000000000001', 'project', '00000000-0000-0000-1007-000000000001', '00000000-0000-0000-1007-000000000012',
 'Website Redesign', 'Complete redesign of marketing website', 'high',
 '{"ops_project_type":"Client"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000061', '00000000-0000-0000-0000-000000000001', 'project', '00000000-0000-0000-1007-000000000001', '00000000-0000-0000-1007-000000000011',
 'API v3 Migration', 'Migrate all endpoints to v3 spec', 'medium',
 '{"ops_project_type":"Internal"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
-- Tasks
('00000000-0000-0000-1007-000000000062', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1007-000000000100', '00000000-0000-0000-1007-000000000111',
 'Design homepage wireframes', 'Create wireframes for new homepage layout', 'high',
 '{"ops_story_points":5,"ops_sprint":"Sprint 1"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000063', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1007-000000000100', '00000000-0000-0000-1007-000000000110',
 'Set up CI/CD pipeline', 'Configure automated deployment', 'medium',
 '{"ops_story_points":3,"ops_sprint":"Sprint 1"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000064', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1007-000000000100', '00000000-0000-0000-1007-000000000112',
 'Fix mobile responsive issues', 'Several pages break on mobile viewports', 'high',
 '{"ops_story_points":8,"ops_sprint":"Sprint 2"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
-- Orders
('00000000-0000-0000-1007-000000000065', '00000000-0000-0000-0000-000000000001', 'order', '00000000-0000-0000-1007-000000000200', '00000000-0000-0000-1007-000000000212',
 'ORD-2026-001 — Acme Corp', '50x Enterprise licenses', 'high',
 '{"ops_order_number":"ORD-2026-001","ops_shipping_address":"123 Main St, NYC"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000066', '00000000-0000-0000-0000-000000000001', 'order', '00000000-0000-0000-1007-000000000200', '00000000-0000-0000-1007-000000000213',
 'ORD-2026-002 — Widget Co', '10x Pro seats', 'medium',
 '{"ops_order_number":"ORD-2026-002","ops_tracking_number":"1Z999AA10123456784"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000067', '00000000-0000-0000-0000-000000000001', 'order', '00000000-0000-0000-1007-000000000200', '00000000-0000-0000-1007-000000000210',
 'ORD-2026-003 — GreenEnergy', '25x Starter package', 'low',
 '{"ops_order_number":"ORD-2026-003"}', false, true, '00000000-0000-0000-0001-000000000007', 'pack');

-- Test entity links
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1007-000000000070', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1007-000000000060', 'item',   '00000000-0000-0000-1007-000000000062', 'ops_project_task',   false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000071', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1007-000000000060', 'item',   '00000000-0000-0000-1007-000000000064', 'ops_project_task',   false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000072', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1007-000000000062', 'person', '00000000-0000-0000-0003-000000000003', 'ops_task_assignee',  false, true, '00000000-0000-0000-0001-000000000007', 'pack'),
('00000000-0000-0000-1007-000000000073', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1007-000000000065', 'person', '00000000-0000-0000-0003-000000000004', 'ops_order_customer', false, true, '00000000-0000-0000-0001-000000000007', 'pack');
