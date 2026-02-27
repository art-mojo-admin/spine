-- 017: SKOOL Pack — v2 schema (items, views, apps)
-- Pack ID: 00000000-0000-0000-0001-000000000003

-- ── Workflow: Community Discussions ───────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1003-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Community Discussions', 'Track discussion threads in the community',
        false, '00000000-0000-0000-0001-000000000003', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000010', '00000000-0000-0000-1003-000000000001', 'Open',   0, true,  false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000011', '00000000-0000-0000-1003-000000000001', 'Active', 1, false, false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000012', '00000000-0000-0000-1003-000000000001', 'Pinned', 2, false, false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000013', '00000000-0000-0000-1003-000000000001', 'Closed', 3, false, true,  false, '00000000-0000-0000-0001-000000000003', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000020', '00000000-0000-0000-1003-000000000001', 'Activate', '00000000-0000-0000-1003-000000000010', '00000000-0000-0000-1003-000000000011', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000021', '00000000-0000-0000-1003-000000000001', 'Pin',      '00000000-0000-0000-1003-000000000011', '00000000-0000-0000-1003-000000000012', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000022', '00000000-0000-0000-1003-000000000001', 'Unpin',    '00000000-0000-0000-1003-000000000012', '00000000-0000-0000-1003-000000000011', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000023', '00000000-0000-0000-1003-000000000001', 'Close',    '00000000-0000-0000-1003-000000000011', '00000000-0000-0000-1003-000000000013', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000024', '00000000-0000-0000-1003-000000000001', 'Reopen',   '00000000-0000-0000-1003-000000000013', '00000000-0000-0000-1003-000000000011', false, false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Workflow: Community Events ────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, public_config, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1003-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Community Events', 'Manage community events from proposal to completion',
        '{"enabled":true,"listing_title":"Upcoming Events","visible_fields":["title","description"]}'::jsonb,
        false, '00000000-0000-0000-0001-000000000003', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000040', '00000000-0000-0000-1003-000000000002', 'Proposed',    0, true,  false, false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000041', '00000000-0000-0000-1003-000000000002', 'Confirmed',   1, false, false, true,  false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000042', '00000000-0000-0000-1003-000000000002', 'In Progress', 2, false, false, true,  false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000043', '00000000-0000-0000-1003-000000000002', 'Completed',   3, false, true,  false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000044', '00000000-0000-0000-1003-000000000002', 'Cancelled',   4, false, true,  false, false, '00000000-0000-0000-0001-000000000003', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000050', '00000000-0000-0000-1003-000000000002', 'Confirm',     '00000000-0000-0000-1003-000000000040', '00000000-0000-0000-1003-000000000041', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000051', '00000000-0000-0000-1003-000000000002', 'Start Event', '00000000-0000-0000-1003-000000000041', '00000000-0000-0000-1003-000000000042', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000052', '00000000-0000-0000-1003-000000000002', 'Complete',    '00000000-0000-0000-1003-000000000042', '00000000-0000-0000-1003-000000000043', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000053', '00000000-0000-0000-1003-000000000002', 'Cancel',      '00000000-0000-0000-1003-000000000040', '00000000-0000-0000-1003-000000000044', true,  false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000054', '00000000-0000-0000-1003-000000000002', 'Cancel',      '00000000-0000-0000-1003-000000000041', '00000000-0000-0000-1003-000000000044', true,  false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_public, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000030', '00000000-0000-0000-0000-000000000001', 'item', 'Topic',         'skool_topic',         'select', '["General","Introductions","Wins","Questions","Resources"]', false, false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000031', '00000000-0000-0000-0000-000000000001', 'item', 'Event Date',    'skool_event_date',    'date',   '[]', true,  false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000032', '00000000-0000-0000-0000-000000000001', 'item', 'Location',      'skool_location',      'text',   '[]', true,  false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000033', '00000000-0000-0000-0000-000000000001', 'item', 'Max Attendees', 'skool_max_attendees', 'number', '[]', true,  false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000060', '00000000-0000-0000-0000-000000000001', 'Member',    'skool_member',    'person', 'item', '#22c55e', false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000061', '00000000-0000-0000-0000-000000000001', 'Organizer', 'skool_organizer', 'person', 'item', '#a855f7', false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000062', '00000000-0000-0000-0000-000000000001', 'RSVP',      'skool_rsvp',      'person', 'item', '#3b82f6', false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000070', '00000000-0000-0000-0000-000000000001',
 'Community Member Guide', 'skool-member-guide',
 '# Community Member Guide

## Discussions
Post questions, share wins, and introduce yourself. Discussions flow through Open → Active → Pinned → Closed.

## Events
Browse upcoming community events and RSVP. Organizers confirm events and manage attendance.

## Tips
- Engage with discussions to help the community grow
- RSVP early for events with limited capacity',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── View Definitions ────────────────────────────────────────────────
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-0000000000a0', '00000000-0000-0000-0000-000000000001',
 'skool-discussions', 'Discussions', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1003-000000000001"}'::jsonb,
 '{"columns":["title","stage_definition_id","created_at"],"defaultSort":"updated_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-0000000000a1', '00000000-0000-0000-0000-000000000001',
 'skool-events', 'Events', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1003-000000000002"}'::jsonb,
 '{"columns":["title","stage_definition_id","due_date","created_at"],"defaultSort":"due_date","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── App Definition ──────────────────────────────────────────────────
INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1003-0000000000b0', '00000000-0000-0000-0000-000000000001',
 'community', 'Community', 'users', 'Community discussions and events',
 '[{"label":"Discussions","icon":"message-square","route_type":"view","view_slug":"skool-discussions","position":0,"min_role":"member"},{"label":"Events","icon":"calendar","route_type":"view","view_slug":"skool-events","position":1,"min_role":"member"},{"label":"Courses","icon":"book-open","route_type":"view","view_slug":"skool-courses","position":2,"min_role":"member"}]'::jsonb,
 'skool-discussions', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Test Data: Items ────────────────────────────────────────────────
INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000080', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1003-000000000001', '00000000-0000-0000-1003-000000000011',
 'Welcome! Introduce yourself', 'Share who you are and what you do', 'medium',
 '{"skool_topic":"Introductions"}', false, true, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000081', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1003-000000000001', '00000000-0000-0000-1003-000000000012',
 'Best resources for beginners', 'Curated list of starter resources', 'medium',
 '{"skool_topic":"Resources"}', false, true, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000082', '00000000-0000-0000-0000-000000000001', 'event', '00000000-0000-0000-1003-000000000002', '00000000-0000-0000-1003-000000000041',
 'Monthly Community Meetup', 'Virtual hangout for all members', 'medium',
 '{"skool_event_date":"2026-04-15","skool_location":"Zoom","skool_max_attendees":50}', false, true, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000083', '00000000-0000-0000-0000-000000000001', 'event', '00000000-0000-0000-1003-000000000002', '00000000-0000-0000-1003-000000000040',
 'Workshop: Building Your First App', 'Hands-on session for new developers', 'medium',
 '{"skool_event_date":"2026-05-01","skool_location":"Discord","skool_max_attendees":25}', false, true, '00000000-0000-0000-0001-000000000003', 'pack');

-- ── Test Data: Entity Links ─────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1003-000000000090', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000002', 'item', '00000000-0000-0000-1003-000000000082', 'skool_organizer', false, true, '00000000-0000-0000-0001-000000000003', 'pack'),
('00000000-0000-0000-1003-000000000091', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000003', 'item', '00000000-0000-0000-1003-000000000082', 'skool_rsvp',      false, true, '00000000-0000-0000-0001-000000000003', 'pack');
