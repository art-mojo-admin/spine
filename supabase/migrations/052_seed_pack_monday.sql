-- 052: Monday Pack — materialized entities (all inactive)
-- Pack ID: 00000000-0000-0000-0001-000000000006

-- ── Workflow: Project Board ───────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id)
VALUES ('00000000-0000-0000-1006-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Project Board', 'General project tracking with status labels',
        false, '00000000-0000-0000-0001-000000000006');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000010', '00000000-0000-0000-1006-000000000001', 'Not Started', 0, true,  false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000001', 'Working On',  1, false, false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000012', '00000000-0000-0000-1006-000000000001', 'Stuck',       2, false, false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000013', '00000000-0000-0000-1006-000000000001', 'Done',        3, false, true,  false, '00000000-0000-0000-0001-000000000006');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000020', '00000000-0000-0000-1006-000000000001', 'Start',       '00000000-0000-0000-1006-000000000010', '00000000-0000-0000-1006-000000000011', false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000021', '00000000-0000-0000-1006-000000000001', 'Mark Stuck',  '00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000012', true,  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000022', '00000000-0000-0000-1006-000000000001', 'Unstick',     '00000000-0000-0000-1006-000000000012', '00000000-0000-0000-1006-000000000011', false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000023', '00000000-0000-0000-1006-000000000001', 'Complete',    '00000000-0000-0000-1006-000000000011', '00000000-0000-0000-1006-000000000013', false, false, '00000000-0000-0000-0001-000000000006');

-- ── Workflow: Client Requests ─────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id)
VALUES ('00000000-0000-0000-1006-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Client Requests', 'Track client requests from intake to delivery',
        false, '00000000-0000-0000-0001-000000000006');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000040', '00000000-0000-0000-1006-000000000002', 'Incoming',    0, true,  false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000002', 'Reviewing',   1, false, false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000042', '00000000-0000-0000-1006-000000000002', 'Approved',    2, false, false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000043', '00000000-0000-0000-1006-000000000002', 'In Progress', 3, false, false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000044', '00000000-0000-0000-1006-000000000002', 'Delivered',   4, false, true,  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000045', '00000000-0000-0000-1006-000000000002', 'Rejected',    5, false, true,  false, '00000000-0000-0000-0001-000000000006');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000050', '00000000-0000-0000-1006-000000000002', 'Review',      '00000000-0000-0000-1006-000000000040', '00000000-0000-0000-1006-000000000041', false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000051', '00000000-0000-0000-1006-000000000002', 'Approve',     '00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000042', false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000052', '00000000-0000-0000-1006-000000000002', 'Reject',      '00000000-0000-0000-1006-000000000041', '00000000-0000-0000-1006-000000000045', true,  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000053', '00000000-0000-0000-1006-000000000002', 'Start Work',  '00000000-0000-0000-1006-000000000042', '00000000-0000-0000-1006-000000000043', false, false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000054', '00000000-0000-0000-1006-000000000002', 'Deliver',     '00000000-0000-0000-1006-000000000043', '00000000-0000-0000-1006-000000000044', false, false, '00000000-0000-0000-0001-000000000006');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000030', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Timeline Start',  'mon_timeline_start', 'date',   '[]',                                                  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000031', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Timeline End',    'mon_timeline_end',   'date',   '[]',                                                  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000032', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Status Label',    'mon_status_label',   'select', '["On Track","At Risk","Off Track","Complete"]',       false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000033', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Priority',        'mon_priority',       'select', '["Critical","High","Medium","Low"]',                  false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000034', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Team',            'mon_team',           'select', '["Marketing","Sales","Engineering","Design","Ops"]',  false, '00000000-0000-0000-0001-000000000006');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id) VALUES
('00000000-0000-0000-1006-000000000060', '00000000-0000-0000-0000-000000000001', 'Assignee',     'mon_assignee',     'workflow_item', 'person',        '#3b82f6', false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000061', '00000000-0000-0000-0000-000000000001', 'Reviewer',     'mon_reviewer',     'workflow_item', 'person',        '#8b5cf6', false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000062', '00000000-0000-0000-0000-000000000001', 'Related Item', 'mon_related_item', 'workflow_item', 'workflow_item', '#f59e0b', false, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000063', '00000000-0000-0000-0000-000000000001', 'Client',       'mon_client',       'workflow_item', 'account',       '#22c55e', false, '00000000-0000-0000-0001-000000000006');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id) VALUES
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
 'published', 'guide', false, '00000000-0000-0000-0001-000000000006'),

('00000000-0000-0000-1006-000000000071', '00000000-0000-0000-0000-000000000001',
 'Board Admin Guide', 'monday-admin-guide',
 '# Board Admin Guide

## Board Configuration
Customize the Project Board and Client Requests workflows under Admin → Workflows.

## Custom Fields
Add team-specific fields under Admin → Custom Fields. Common additions include budget, effort estimate, or client priority.

## Automations
- Auto-assign items based on team field
- Notify board owner when items are stuck for 48h
- Move delivered items to archive after 7 days',
 'published', 'admin-guide', false, '00000000-0000-0000-0001-000000000006');

-- ── Test Data: Workflow Items ─────────────────────────────────────────
INSERT INTO workflow_items (id, account_id, workflow_definition_id, stage_definition_id, workflow_type, title, description, priority, metadata, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1006-000000000080', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000011', 'Project Board',
 'Redesign landing page', 'Update hero section and testimonials', 'high',
 '{"mon_timeline_start":"2025-03-01","mon_timeline_end":"2025-03-15","mon_status_label":"On Track","mon_priority":"High","mon_team":"Design"}', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000081', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000012', 'Project Board',
 'Migrate database to new cluster', 'Zero-downtime migration plan needed', 'high',
 '{"mon_timeline_start":"2025-03-10","mon_timeline_end":"2025-03-20","mon_status_label":"At Risk","mon_priority":"Critical","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000082', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1006-000000000001', '00000000-0000-0000-1006-000000000010', 'Project Board',
 'Q2 marketing campaign', 'Plan and execute Q2 campaign', 'medium',
 '{"mon_timeline_start":"2025-04-01","mon_timeline_end":"2025-06-30","mon_status_label":"On Track","mon_priority":"Medium","mon_team":"Marketing"}', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000083', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1006-000000000002', '00000000-0000-0000-1006-000000000041', 'Client Requests',
 'Widget Co — Custom report template', 'Client needs a branded report output', 'medium',
 '{"mon_priority":"Medium","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000084', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1006-000000000002', '00000000-0000-0000-1006-000000000043', 'Client Requests',
 'Acme Corp — SSO integration', 'SAML SSO for enterprise login', 'high',
 '{"mon_priority":"High","mon_team":"Engineering"}', false, true, '00000000-0000-0000-0001-000000000006');

-- ── Test Data: Entity Links ───────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1006-000000000090', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1006-000000000080', 'person',  '00000000-0000-0000-0003-000000000004', 'mon_assignee', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000091', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1006-000000000081', 'person',  '00000000-0000-0000-0003-000000000003', 'mon_assignee', false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000092', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1006-000000000083', 'account', '00000000-0000-0000-0002-000000000002', 'mon_client',   false, true, '00000000-0000-0000-0001-000000000006'),
('00000000-0000-0000-1006-000000000093', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1006-000000000084', 'account', '00000000-0000-0000-0002-000000000001', 'mon_client',   false, true, '00000000-0000-0000-0001-000000000006');
