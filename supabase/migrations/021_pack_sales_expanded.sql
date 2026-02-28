-- 021: Expand CRM pack → Sales pack (Lead Gen + Pipeline + Contracts)
-- Pack ID stays: 00000000-0000-0000-0001-000000000001
-- Adds Lead Funnel + Contracts workflows alongside existing Sales Pipeline

-- ── Update pack metadata ──────────────────────────────────────────────
UPDATE config_packs SET
  name = 'Sales',
  slug = 'sales',
  description = 'Complete sales suite: lead generation funnel, deal pipeline, and contract management.',
  pack_data = '{"features":["Lead Funnel workflow (5 stages)","Sales Pipeline workflow (6 stages)","Contracts workflow (5 stages)","Deal value, source, and contract tracking","Contact and company linking","Sales dashboard with counts"]}'::jsonb
WHERE id = '00000000-0000-0000-0001-000000000001';

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 2: Lead Funnel
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1001-000000000100',
        '00000000-0000-0000-0000-000000000001',
        'Lead Funnel', 'Capture and qualify inbound leads',
        false, '00000000-0000-0000-0001-000000000001', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000110', '00000000-0000-0000-1001-000000000100', 'New',          0, true,  false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000111', '00000000-0000-0000-1001-000000000100', 'MQL',          1, false, false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000112', '00000000-0000-0000-1001-000000000100', 'SQL',          2, false, false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000113', '00000000-0000-0000-1001-000000000100', 'Opportunity',  3, false, true,  false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000114', '00000000-0000-0000-1001-000000000100', 'Disqualified', 4, false, true,  false, '00000000-0000-0000-0001-000000000001', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000120', '00000000-0000-0000-1001-000000000100', 'Qualify as MQL',    '00000000-0000-0000-1001-000000000110', '00000000-0000-0000-1001-000000000111', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000121', '00000000-0000-0000-1001-000000000100', 'Qualify as SQL',    '00000000-0000-0000-1001-000000000111', '00000000-0000-0000-1001-000000000112', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000122', '00000000-0000-0000-1001-000000000100', 'Convert to Opp',    '00000000-0000-0000-1001-000000000112', '00000000-0000-0000-1001-000000000113', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000123', '00000000-0000-0000-1001-000000000100', 'Disqualify',        '00000000-0000-0000-1001-000000000110', '00000000-0000-0000-1001-000000000114', true,  false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000124', '00000000-0000-0000-1001-000000000100', 'Disqualify MQL',    '00000000-0000-0000-1001-000000000111', '00000000-0000-0000-1001-000000000114', true,  false, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- WORKFLOW 3: Contracts
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1001-000000000200',
        '00000000-0000-0000-0000-000000000001',
        'Contracts', 'Manage contract lifecycle from draft to signature',
        false, '00000000-0000-0000-0001-000000000001', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000210', '00000000-0000-0000-1001-000000000200', 'Draft',   0, true,  false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000211', '00000000-0000-0000-1001-000000000200', 'Review',  1, false, false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000212', '00000000-0000-0000-1001-000000000200', 'Sent',    2, false, false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000213', '00000000-0000-0000-1001-000000000200', 'Signed',  3, false, true,  false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000214', '00000000-0000-0000-1001-000000000200', 'Expired', 4, false, true,  false, '00000000-0000-0000-0001-000000000001', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000220', '00000000-0000-0000-1001-000000000200', 'Submit for Review', '00000000-0000-0000-1001-000000000210', '00000000-0000-0000-1001-000000000211', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000221', '00000000-0000-0000-1001-000000000200', 'Send to Customer',  '00000000-0000-0000-1001-000000000211', '00000000-0000-0000-1001-000000000212', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000222', '00000000-0000-0000-1001-000000000200', 'Mark Signed',       '00000000-0000-0000-1001-000000000212', '00000000-0000-0000-1001-000000000213', true,  false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000223', '00000000-0000-0000-1001-000000000200', 'Mark Expired',      '00000000-0000-0000-1001-000000000212', '00000000-0000-0000-1001-000000000214', false, false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000224', '00000000-0000-0000-1001-000000000200', 'Back to Draft',     '00000000-0000-0000-1001-000000000211', '00000000-0000-0000-1001-000000000210', false, false, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Additional Custom Fields for lead and contract types
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000130', '00000000-0000-0000-0000-000000000001', 'item',   'Lead Score',      'sales_lead_score',      'number', '[]', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000131', '00000000-0000-0000-0000-000000000001', 'item',   'Lead Channel',    'sales_lead_channel',    'select', '["Website","Referral","Cold Outreach","Event","Social","Partner"]', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000132', '00000000-0000-0000-0000-000000000001', 'item',   'Contract Type',   'sales_contract_type',   'select', '["Annual","Monthly","One-Time","Custom"]', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000133', '00000000-0000-0000-0000-000000000001', 'item',   'Contract Value',  'sales_contract_value',  'number', '[]', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000134', '00000000-0000-0000-0000-000000000001', 'item',   'Renewal Date',    'sales_renewal_date',    'date',   '[]', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000135', '00000000-0000-0000-0000-000000000001', 'person', 'Lead Score',      'sales_person_lead_score','number', '[]', false, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Additional Link Types
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000140', '00000000-0000-0000-0000-000000000001', 'Contract Deal',  'sales_contract_deal',  'item', 'item',   '#f59e0b', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000141', '00000000-0000-0000-0000-000000000001', 'Signer',         'sales_signer',         'item', 'person', '#10b981', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000142', '00000000-0000-0000-0000-000000000001', 'Lead Contact',   'sales_lead_contact',   'item', 'person', '#6366f1', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000143', '00000000-0000-0000-0000-000000000001', 'Lead Company',   'sales_lead_company',   'item', 'account','#ec4899', false, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- New View Definitions (Lead + Contract views)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
-- Lead views
('00000000-0000-0000-1001-000000000180', '00000000-0000-0000-0000-000000000001',
 'sales-leads', 'All Leads', 'list', 'item',
 '{"item_type":"lead","workflow_definition_id":"00000000-0000-0000-1001-000000000100"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000181', '00000000-0000-0000-0000-000000000001',
 'sales-lead-board', 'Lead Board', 'board', 'item',
 '{"item_type":"lead","workflow_definition_id":"00000000-0000-0000-1001-000000000100"}'::jsonb,
 '{"laneField":"stage_definition_id","cardFields":["title","priority"]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000182', '00000000-0000-0000-0000-000000000001',
 'sales-lead-detail', 'Lead Detail', 'detail', 'item',
 '{"item_type":"lead"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"activity","position":4}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000001', 'pack'),
-- Contract views
('00000000-0000-0000-1001-000000000183', '00000000-0000-0000-0000-000000000001',
 'sales-contracts', 'All Contracts', 'list', 'item',
 '{"item_type":"contract","workflow_definition_id":"00000000-0000-0000-1001-000000000200"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000184', '00000000-0000-0000-0000-000000000001',
 'sales-contract-detail', 'Contract Detail', 'detail', 'item',
 '{"item_type":"contract"}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"attachments","position":3},{"type":"threads","position":4,"config":{"thread_type":"discussion"}},{"type":"activity","position":5}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Update existing CRM dashboard to include lead + contract counts
-- ══════════════════════════════════════════════════════════════════════

UPDATE view_definitions SET
  config = '{"widgets":[{"widget_type":"count","title":"Active Leads","config":{"entity_type":"items","filters":{"item_type":"lead"}},"position":{"x":0,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Active Deals","config":{"entity_type":"items","filters":{"item_type":"deal"}},"position":{"x":2,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Won Deals","config":{"entity_type":"items","filters":{"item_type":"deal","stage":"Closed Won"}},"position":{"x":4,"y":0,"w":2,"h":1}},{"widget_type":"count","title":"Active Contracts","config":{"entity_type":"items","filters":{"item_type":"contract"}},"position":{"x":0,"y":1,"w":2,"h":1}},{"widget_type":"list","title":"Recent Leads","config":{"entity_type":"items","filters":{"item_type":"lead"},"limit":5},"position":{"x":0,"y":2,"w":3,"h":2}},{"widget_type":"list","title":"Recent Deals","config":{"entity_type":"items","filters":{"item_type":"deal"},"limit":5},"position":{"x":3,"y":2,"w":3,"h":2}}]}'::jsonb,
  name = 'Sales Dashboard'
WHERE id = '00000000-0000-0000-1001-000000000083';

-- ══════════════════════════════════════════════════════════════════════
-- Update App Definition to include Leads + Contracts nav
-- ══════════════════════════════════════════════════════════════════════

UPDATE app_definitions SET
  slug = 'sales',
  name = 'Sales',
  description = 'Lead generation, deal pipeline, and contract management',
  nav_items = '[{"label":"Dashboard","icon":"layout-dashboard","route_type":"view","view_slug":"crm-dashboard","position":0,"min_role":"member"},{"label":"Leads","icon":"user-plus","route_type":"view","view_slug":"sales-leads","position":1,"min_role":"member"},{"label":"Lead Board","icon":"kanban-square","route_type":"view","view_slug":"sales-lead-board","position":2,"min_role":"member"},{"label":"All Deals","icon":"list","route_type":"view","view_slug":"crm-deals","position":3,"min_role":"member"},{"label":"Pipeline","icon":"kanban-square","route_type":"view","view_slug":"crm-pipeline","position":4,"min_role":"member"},{"label":"Contracts","icon":"file-text","route_type":"view","view_slug":"sales-contracts","position":5,"min_role":"member"}]'::jsonb,
  default_view = 'crm-dashboard'
WHERE id = '00000000-0000-0000-1001-000000000090';

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Leads (item_type = 'lead')
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000160', '00000000-0000-0000-0000-000000000001', 'lead', '00000000-0000-0000-1001-000000000100', '00000000-0000-0000-1001-000000000110',
 'Inbound — Contact Form: Sarah at TechCorp', 'Filled out pricing form', 'medium',
 '{"sales_lead_score": 65, "sales_lead_channel": "Website"}', false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000161', '00000000-0000-0000-0000-000000000001', 'lead', '00000000-0000-0000-1001-000000000100', '00000000-0000-0000-1001-000000000111',
 'Referral — Mike at BuildRight', 'Referred by existing customer', 'high',
 '{"sales_lead_score": 82, "sales_lead_channel": "Referral"}', false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000162', '00000000-0000-0000-0000-000000000001', 'lead', '00000000-0000-0000-1001-000000000100', '00000000-0000-0000-1001-000000000112',
 'Event — Lisa at GreenEnergy', 'Met at SaaS Connect conference', 'high',
 '{"sales_lead_score": 90, "sales_lead_channel": "Event"}', false, true, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Contracts (item_type = 'contract')
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1001-000000000163', '00000000-0000-0000-0000-000000000001', 'contract', '00000000-0000-0000-1001-000000000200', '00000000-0000-0000-1001-000000000210',
 'Acme Corp — Annual License 2026', 'Standard annual enterprise license', 'high',
 '{"sales_contract_type": "Annual", "sales_contract_value": 50000, "sales_renewal_date": "2027-01-15"}', false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000164', '00000000-0000-0000-0000-000000000001', 'contract', '00000000-0000-0000-1001-000000000200', '00000000-0000-0000-1001-000000000212',
 'Widget Co — Monthly Pro', 'Monthly pro subscription contract', 'medium',
 '{"sales_contract_type": "Monthly", "sales_contract_value": 5000}', false, true, '00000000-0000-0000-0001-000000000001', 'pack');

-- ══════════════════════════════════════════════════════════════════════
-- Test Data: Entity Links for leads and contracts
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
-- Lead contacts
('00000000-0000-0000-1001-000000000170', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1001-000000000160', 'person',  '00000000-0000-0000-0003-000000000004', 'sales_lead_contact',  false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
('00000000-0000-0000-1001-000000000171', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1001-000000000161', 'person',  '00000000-0000-0000-0003-000000000005', 'sales_lead_contact',  false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
-- Contract → Deal links
('00000000-0000-0000-1001-000000000172', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1001-000000000163', 'item',    '00000000-0000-0000-1001-000000000060', 'sales_contract_deal', false, true, '00000000-0000-0000-0001-000000000001', 'pack'),
-- Contract signers
('00000000-0000-0000-1001-000000000173', '00000000-0000-0000-0000-000000000001', 'item', '00000000-0000-0000-1001-000000000163', 'person',  '00000000-0000-0000-0003-000000000004', 'sales_signer',        false, true, '00000000-0000-0000-0001-000000000001', 'pack');
