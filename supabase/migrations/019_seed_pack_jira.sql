-- 019: Jira Pack — v2 schema (items, views, apps)
-- Pack ID: 00000000-0000-0000-0001-000000000005

-- ── Workflow: Sprint Board ────────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1005-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Sprint Board', 'Track issues through sprint cycles',
        false, '00000000-0000-0000-0001-000000000005', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000010', '00000000-0000-0000-1005-000000000001', 'Backlog',     0, true,  false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000011', '00000000-0000-0000-1005-000000000001', 'To Do',       1, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000012', '00000000-0000-0000-1005-000000000001', 'In Progress', 2, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000013', '00000000-0000-0000-1005-000000000001', 'In Review',   3, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000014', '00000000-0000-0000-1005-000000000001', 'Done',        4, false, true,  false, '00000000-0000-0000-0001-000000000005', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000020', '00000000-0000-0000-1005-000000000001', 'Add to Sprint',     '00000000-0000-0000-1005-000000000010', '00000000-0000-0000-1005-000000000011', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000021', '00000000-0000-0000-1005-000000000001', 'Start Work',        '00000000-0000-0000-1005-000000000011', '00000000-0000-0000-1005-000000000012', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000022', '00000000-0000-0000-1005-000000000001', 'Submit for Review', '00000000-0000-0000-1005-000000000012', '00000000-0000-0000-1005-000000000013', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000023', '00000000-0000-0000-1005-000000000001', 'Approve',           '00000000-0000-0000-1005-000000000013', '00000000-0000-0000-1005-000000000014', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000024', '00000000-0000-0000-1005-000000000001', 'Request Changes',   '00000000-0000-0000-1005-000000000013', '00000000-0000-0000-1005-000000000012', true,  false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000025', '00000000-0000-0000-1005-000000000001', 'Back to Backlog',   '00000000-0000-0000-1005-000000000011', '00000000-0000-0000-1005-000000000010', false, false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Workflow: Bug Tracker ─────────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1005-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Bug Tracker', 'Track and resolve bugs from report to verification',
        false, '00000000-0000-0000-0001-000000000005', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000040', '00000000-0000-0000-1005-000000000002', 'Reported',  0, true,  false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000041', '00000000-0000-0000-1005-000000000002', 'Confirmed', 1, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000042', '00000000-0000-0000-1005-000000000002', 'Fixing',    2, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000043', '00000000-0000-0000-1005-000000000002', 'Testing',   3, false, false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000044', '00000000-0000-0000-1005-000000000002', 'Closed',    4, false, true,  false, '00000000-0000-0000-0001-000000000005', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000050', '00000000-0000-0000-1005-000000000002', 'Confirm',         '00000000-0000-0000-1005-000000000040', '00000000-0000-0000-1005-000000000041', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000051', '00000000-0000-0000-1005-000000000002', 'Start Fix',       '00000000-0000-0000-1005-000000000041', '00000000-0000-0000-1005-000000000042', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000052', '00000000-0000-0000-1005-000000000002', 'Submit for Test', '00000000-0000-0000-1005-000000000042', '00000000-0000-0000-1005-000000000043', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000053', '00000000-0000-0000-1005-000000000002', 'Close',           '00000000-0000-0000-1005-000000000043', '00000000-0000-0000-1005-000000000044', false, false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000054', '00000000-0000-0000-1005-000000000002', 'Reopen',          '00000000-0000-0000-1005-000000000043', '00000000-0000-0000-1005-000000000042', true,  false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000030', '00000000-0000-0000-0000-000000000001', 'item',   'Story Points', 'jira_story_points', 'number', '[]',                                                       false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000031', '00000000-0000-0000-0000-000000000001', 'item',   'Sprint',       'jira_sprint',       'text',   '[]',                                                       false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000032', '00000000-0000-0000-0000-000000000001', 'item',   'Task Type',    'jira_task_type',    'select', '["Story","Bug","Task","Epic","Spike"]',                    false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000033', '00000000-0000-0000-0000-000000000001', 'item',   'Priority',     'jira_priority',     'select', '["Critical","High","Medium","Low"]',                       false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000034', '00000000-0000-0000-0000-000000000001', 'item',   'Component',    'jira_component',    'select', '["Frontend","Backend","API","Database","Infrastructure"]', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000035', '00000000-0000-0000-0000-000000000001', 'item',   'Fix Version',  'jira_fix_version',  'text',   '[]',                                                       false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000036', '00000000-0000-0000-0000-000000000001', 'person', 'Team',         'jira_team',         'select', '["Engineering","QA","DevOps","Design","Product"]',         false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000060', '00000000-0000-0000-0000-000000000001', 'Blocks',     'jira_blocks',     'item',   'item',   '#ef4444', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000061', '00000000-0000-0000-0000-000000000001', 'Depends On', 'jira_depends_on', 'item',   'item',   '#f97316', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000062', '00000000-0000-0000-0000-000000000001', 'Sub-task',   'jira_subtask',    'item',   'item',   '#6366f1', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000063', '00000000-0000-0000-0000-000000000001', 'Assignee',   'jira_assignee',   'item',   'person', '#3b82f6', false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000070', '00000000-0000-0000-0000-000000000001',
 'Developer Guide', 'jira-developer-guide',
 '# Developer Guide

## Sprint Board
Issues flow: Backlog → To Do → In Progress → In Review → Done

## Bug Tracker
Bugs flow: Reported → Confirmed → Fixing → Testing → Closed

## Working with Issues
- Set Story Points for estimation
- Assign to a Sprint for planning
- Use Task Type to categorize (Story, Bug, Task, Epic, Spike)
- Link blockers and dependencies between issues

## Tips
- Keep issues small and well-defined
- Use threads when requesting review
- Use the Blocks/Depends On links to track dependencies',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── View Definitions ────────────────────────────────────────────────
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-0000000000a0', '00000000-0000-0000-0000-000000000001',
 'jira-sprint-board', 'Sprint Board', 'board', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1005-000000000001"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-0000000000a1', '00000000-0000-0000-0000-000000000001',
 'jira-backlog', 'Backlog', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1005-000000000001"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","created_at"],"defaultSort":"created_at","pageSize":100}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-0000000000a2', '00000000-0000-0000-0000-000000000001',
 'jira-bugs', 'Bug Tracker', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1005-000000000002"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","created_at"],"defaultSort":"priority","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-0000000000a3', '00000000-0000-0000-0000-000000000001',
 'jira-issue-detail', 'Issue Detail', 'detail', 'item',
 '{}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"children","position":3},{"type":"threads","position":4,"config":{"thread_type":"discussion"}},{"type":"activity","position":5}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── App Definition ──────────────────────────────────────────────────
INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1005-0000000000b0', '00000000-0000-0000-0000-000000000001',
 'engineering', 'Engineering', 'bug', 'Issue tracking and sprint management',
 '[{"label":"Sprint Board","icon":"kanban-square","route_type":"view","view_slug":"jira-sprint-board","position":0,"min_role":"member"},{"label":"Backlog","icon":"list","route_type":"view","view_slug":"jira-backlog","position":1,"min_role":"member"},{"label":"Bugs","icon":"bug","route_type":"view","view_slug":"jira-bugs","position":2,"min_role":"member"}]'::jsonb,
 'jira-sprint-board', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Test Data: Items ────────────────────────────────────────────────
INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000080', '00000000-0000-0000-0000-000000000001', 'story', '00000000-0000-0000-1005-000000000001', '00000000-0000-0000-1005-000000000011',
 'Implement user authentication', 'OAuth2 + JWT token flow', 'high',
 '{"jira_story_points":8,"jira_sprint":"Sprint 12","jira_task_type":"Story","jira_priority":"High","jira_component":"Backend"}', false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000081', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1005-000000000001', '00000000-0000-0000-1005-000000000012',
 'Dashboard performance optimization', 'Reduce load time from 3s to under 1s', 'medium',
 '{"jira_story_points":5,"jira_sprint":"Sprint 12","jira_task_type":"Task","jira_priority":"Medium","jira_component":"Frontend"}', false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000082', '00000000-0000-0000-0000-000000000001', 'story', '00000000-0000-0000-1005-000000000001', '00000000-0000-0000-1005-000000000010',
 'Add export to PDF feature', 'Users want to export reports as PDF', 'low',
 '{"jira_story_points":3,"jira_sprint":"Backlog","jira_task_type":"Story","jira_priority":"Low","jira_component":"Frontend"}', false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000083', '00000000-0000-0000-0000-000000000001', 'bug', '00000000-0000-0000-1005-000000000002', '00000000-0000-0000-1005-000000000040',
 'Search returns stale results', 'Elasticsearch index not refreshing', 'high',
 '{"jira_task_type":"Bug","jira_priority":"High","jira_component":"Backend"}', false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000084', '00000000-0000-0000-0000-000000000001', 'bug', '00000000-0000-0000-1005-000000000002', '00000000-0000-0000-1005-000000000042',
 'Date picker off by one timezone', 'UTC offset not applied in date fields', 'medium',
 '{"jira_task_type":"Bug","jira_priority":"Medium","jira_component":"Frontend"}', false, true, '00000000-0000-0000-0001-000000000005', 'pack');

-- ── Test Data: Entity Links ─────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1005-000000000090', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1005-000000000080', 'person', '00000000-0000-0000-0003-000000000003', 'assignee',        false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000091', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1005-000000000081', 'person', '00000000-0000-0000-0003-000000000004', 'assignee',        false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000092', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1005-000000000081', 'item',   '00000000-0000-0000-1005-000000000080', 'jira_depends_on', false, true, '00000000-0000-0000-0001-000000000005', 'pack'),
('00000000-0000-0000-1005-000000000093', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1005-000000000083', 'item',   '00000000-0000-0000-1005-000000000081', 'jira_blocks',     false, true, '00000000-0000-0000-0001-000000000005', 'pack');
