-- 024: Marketing Pack (Campaigns + Content Pipeline)
-- Pack ID: 00000000-0000-0000-0001-000000000008

INSERT INTO config_packs (id, name, slug, icon, category, description, is_system, pack_data) VALUES
('00000000-0000-0000-0001-000000000008', 'Marketing', 'marketing', 'megaphone', 'marketing',
 'Campaign planning and content pipeline management with cross-pack lead linking.',
 true, '{"features":["Campaigns workflow (6 stages)","Content Pipeline workflow (5 stages)","Channel, budget, and audience fields","Campaign-Content and Campaign-Lead linking","Marketing dashboard"]}'::jsonb);

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 1: Campaigns
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1008-000000000001', '00000000-0000-0000-0000-000000000001',
        'Campaigns', 'Plan and execute marketing campaigns',
        false, '00000000-0000-0000-0001-000000000008', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000010', '00000000-0000-0000-1008-000000000001', 'Idea',        0, true,  false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000011', '00000000-0000-0000-1008-000000000001', 'Planning',    1, false, false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000012', '00000000-0000-0000-1008-000000000001', 'In Progress', 2, false, false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000013', '00000000-0000-0000-1008-000000000001', 'Live',        3, false, false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000014', '00000000-0000-0000-1008-000000000001', 'Completed',   4, false, true,  false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000015', '00000000-0000-0000-1008-000000000001', 'Archived',    5, false, true,  false, '00000000-0000-0000-0001-000000000008', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000020', '00000000-0000-0000-1008-000000000001', 'Start Planning',  '00000000-0000-0000-1008-000000000010', '00000000-0000-0000-1008-000000000011', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000021', '00000000-0000-0000-1008-000000000001', 'Execute',         '00000000-0000-0000-1008-000000000011', '00000000-0000-0000-1008-000000000012', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000022', '00000000-0000-0000-1008-000000000001', 'Go Live',         '00000000-0000-0000-1008-000000000012', '00000000-0000-0000-1008-000000000013', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000023', '00000000-0000-0000-1008-000000000001', 'Complete',        '00000000-0000-0000-1008-000000000013', '00000000-0000-0000-1008-000000000014', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000024', '00000000-0000-0000-1008-000000000001', 'Archive',         '00000000-0000-0000-1008-000000000014', '00000000-0000-0000-1008-000000000015', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000025', '00000000-0000-0000-1008-000000000001', 'Back to Planning','00000000-0000-0000-1008-000000000012', '00000000-0000-0000-1008-000000000011', false, false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 2: Content Pipeline
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1008-000000000100', '00000000-0000-0000-0000-000000000001',
        'Content Pipeline', 'Move content from draft through review to publication',
        false, '00000000-0000-0000-0001-000000000008', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000110', '00000000-0000-0000-1008-000000000100', 'Draft',     0, true,  false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000111', '00000000-0000-0000-1008-000000000100', 'Review',    1, false, false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000112', '00000000-0000-0000-1008-000000000100', 'Approved',  2, false, false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000113', '00000000-0000-0000-1008-000000000100', 'Published', 3, false, true,  false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000114', '00000000-0000-0000-1008-000000000100', 'Retired',   4, false, true,  false, '00000000-0000-0000-0001-000000000008', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000120', '00000000-0000-0000-1008-000000000100', 'Submit for Review','00000000-0000-0000-1008-000000000110', '00000000-0000-0000-1008-000000000111', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000121', '00000000-0000-0000-1008-000000000100', 'Approve',          '00000000-0000-0000-1008-000000000111', '00000000-0000-0000-1008-000000000112', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000122', '00000000-0000-0000-1008-000000000100', 'Publish',          '00000000-0000-0000-1008-000000000112', '00000000-0000-0000-1008-000000000113', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000123', '00000000-0000-0000-1008-000000000100', 'Retire',           '00000000-0000-0000-1008-000000000113', '00000000-0000-0000-1008-000000000114', false, false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000124', '00000000-0000-0000-1008-000000000100', 'Request Changes',  '00000000-0000-0000-1008-000000000111', '00000000-0000-0000-1008-000000000110', true,  false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Custom Fields
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000030', '00000000-0000-0000-0000-000000000001', 'item', 'Channel',         'mktg_channel',         'select', '["Email","Social","Paid Ads","Event","Content","Partner"]', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000031', '00000000-0000-0000-0000-000000000001', 'item', 'Budget',          'mktg_budget',          'number', '[]', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000032', '00000000-0000-0000-0000-000000000001', 'item', 'Target Audience', 'mktg_target_audience', 'text',   '[]', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000033', '00000000-0000-0000-0000-000000000001', 'item', 'UTM Campaign',    'mktg_utm',             'text',   '[]', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000034', '00000000-0000-0000-0000-000000000001', 'item', 'Content Type',    'mktg_content_type',    'select', '["Blog Post","Video","Infographic","Case Study","Whitepaper","Social Post","Email"]', false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Link Types (includes cross-pack link to Sales leads)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000040', '00000000-0000-0000-0000-000000000001', 'Campaign Content', 'mktg_campaign_content', 'item', 'item',   '#8b5cf6', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000041', '00000000-0000-0000-0000-000000000001', 'Campaign Lead',    'mktg_campaign_lead',    'item', 'item',   '#f59e0b', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000042', '00000000-0000-0000-0000-000000000001', 'Content Author',   'mktg_content_author',   'item', 'person', '#10b981', false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- View Definitions
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000080', '00000000-0000-0000-0000-000000000001',
 'mktg-campaign-board', 'Campaign Board', 'board', 'item',
 '{"item_type":"campaign","workflow_definition_id":"00000000-0000-0000-1008-000000000001"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000081', '00000000-0000-0000-0000-000000000001',
 'mktg-campaign-detail', 'Campaign Detail', 'detail', 'item',
 '{"item_type":"campaign"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"activity","position":4}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000082', '00000000-0000-0000-0000-000000000001',
 'mktg-content-pipeline', 'Content Pipeline', 'board', 'item',
 '{"item_type":"content","workflow_definition_id":"00000000-0000-0000-1008-000000000100"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000083', '00000000-0000-0000-0000-000000000001',
 'mktg-content-list', 'All Content', 'list', 'item',
 '{"item_type":"content","workflow_definition_id":"00000000-0000-0000-1008-000000000100"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000084', '00000000-0000-0000-0000-000000000001',
 'mktg-content-detail', 'Content Detail', 'detail', 'item',
 '{"item_type":"content"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"attachments","position":3},{"type":"threads","position":4,"config":{"thread_type":"discussion"}},{"type":"activity","position":5}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000085', '00000000-0000-0000-0000-000000000001',
 'mktg-dashboard', 'Marketing Dashboard', 'dashboard', NULL,
 '{}'::jsonb,
 '{"widgets":[{"widget_type":"count","title":"Active Campaigns","config":{"entity_type":"items","filters":{"item_type":"campaign"}},"position":{"x":0,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Live Now","config":{"entity_type":"items","filters":{"item_type":"campaign","stage":"Live"}},"position":{"x":2,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Content Items","config":{"entity_type":"items","filters":{"item_type":"content"}},"position":{"x":4,"y":0,"w":2,"h":1}},{"widget_type":"list","title":"Upcoming Campaigns","config":{"entity_type":"items","filters":{"item_type":"campaign"},"limit":5},"position":{"x":0,"y":1,"w":3,"h":2}},{"widget_type":"list","title":"Content in Review","config":{"entity_type":"items","filters":{"item_type":"content","stage":"Review"},"limit":5},"position":{"x":3,"y":1,"w":3,"h":2}}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- App Definition
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000090', '00000000-0000-0000-0000-000000000001',
 'marketing', 'Marketing', 'megaphone', 'Campaign planning and content pipeline',
 '[{"label":"Dashboard","icon":"layout-dashboard","route_type":"view","view_slug":"mktg-dashboard","position":0,"min_role":"member"},{"label":"Campaigns","icon":"megaphone","route_type":"view","view_slug":"mktg-campaign-board","position":1,"min_role":"member"},{"label":"Content Pipeline","icon":"file-text","route_type":"view","view_slug":"mktg-content-pipeline","position":2,"min_role":"member"},{"label":"All Content","icon":"list","route_type":"view","view_slug":"mktg-content-list","position":3,"min_role":"member"}]'::jsonb,
 'mktg-dashboard', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Campaigns
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000060', '00000000-0000-0000-0000-000000000001', 'campaign', '00000000-0000-0000-1008-000000000001', '00000000-0000-0000-1008-000000000013',
 'Spring Product Launch', 'Multi-channel launch campaign for new product line', 'high',
 '{"mktg_channel":"Email","mktg_budget":15000,"mktg_target_audience":"Enterprise decision makers","mktg_utm":"spring-launch-2026"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000061', '00000000-0000-0000-0000-000000000001', 'campaign', '00000000-0000-0000-1008-000000000001', '00000000-0000-0000-1008-000000000011',
 'Q2 Webinar Series', 'Educational webinar series for lead generation', 'medium',
 '{"mktg_channel":"Event","mktg_budget":5000,"mktg_target_audience":"SMB owners"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Content Items
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1008-000000000062', '00000000-0000-0000-0000-000000000001', 'content', '00000000-0000-0000-1008-000000000100', '00000000-0000-0000-1008-000000000113',
 'Why SMBs Need Workflow Automation', 'Blog post for spring launch', 'medium',
 '{"mktg_content_type":"Blog Post"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000063', '00000000-0000-0000-0000-000000000001', 'content', '00000000-0000-0000-1008-000000000100', '00000000-0000-0000-1008-000000000111',
 'Customer Success Story: Acme Corp', 'Video case study with Acme Corp', 'high',
 '{"mktg_content_type":"Case Study"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000064', '00000000-0000-0000-0000-000000000001', 'content', '00000000-0000-0000-1008-000000000100', '00000000-0000-0000-1008-000000000110',
 'Product Comparison Infographic', 'Visual comparison of Spine vs competitors', 'low',
 '{"mktg_content_type":"Infographic"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000065', '00000000-0000-0000-0000-000000000001', 'content', '00000000-0000-0000-1008-000000000100', '00000000-0000-0000-1008-000000000112',
 'Webinar: Getting Started with Spine', 'Intro webinar recording + slides', 'medium',
 '{"mktg_content_type":"Video"}', false, true, '00000000-0000-0000-0001-000000000008', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Entity Links
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
-- Campaign → Content
('00000000-0000-0000-1008-000000000070', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1008-000000000060', 'item', '00000000-0000-0000-1008-000000000062', 'mktg_campaign_content', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
('00000000-0000-0000-1008-000000000071', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1008-000000000060', 'item', '00000000-0000-0000-1008-000000000063', 'mktg_campaign_content', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
-- Campaign → Lead (cross-pack to Sales pack leads)
('00000000-0000-0000-1008-000000000072', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1008-000000000060', 'item', '00000000-0000-0000-1001-000000000160', 'mktg_campaign_lead', false, true, '00000000-0000-0000-0001-000000000008', 'pack'),
-- Content author
('00000000-0000-0000-1008-000000000073', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1008-000000000062', 'person', '00000000-0000-0000-0003-000000000004', 'mktg_content_author', false, true, '00000000-0000-0000-0001-000000000008', 'pack');
