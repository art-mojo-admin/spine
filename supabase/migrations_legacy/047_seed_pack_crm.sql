-- 047: CRM Pack — materialized entities (all inactive)
-- Pack ID: 00000000-0000-0000-0001-000000000001
-- System account: 00000000-0000-0000-0000-000000000001

-- ── Workflow: Sales Pipeline ──────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id)
VALUES ('00000000-0000-0000-1001-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Sales Pipeline', 'Track deals from lead to close',
        false, '00000000-0000-0000-0001-000000000001');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id) VALUES
('00000000-0000-0000-1001-000000000010', '00000000-0000-0000-1001-000000000001', 'Lead',        0, true,  false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000011', '00000000-0000-0000-1001-000000000001', 'Qualified',   1, false, false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000012', '00000000-0000-0000-1001-000000000001', 'Proposal',    2, false, false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000013', '00000000-0000-0000-1001-000000000001', 'Negotiation', 3, false, false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000014', '00000000-0000-0000-1001-000000000001', 'Closed Won',  4, false, true,  false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000015', '00000000-0000-0000-1001-000000000001', 'Closed Lost', 5, false, true,  false, '00000000-0000-0000-0001-000000000001');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id) VALUES
('00000000-0000-0000-1001-000000000020', '00000000-0000-0000-1001-000000000001', 'Qualify',          '00000000-0000-0000-1001-000000000010', '00000000-0000-0000-1001-000000000011', false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000021', '00000000-0000-0000-1001-000000000001', 'Send Proposal',    '00000000-0000-0000-1001-000000000011', '00000000-0000-0000-1001-000000000012', false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000022', '00000000-0000-0000-1001-000000000001', 'Negotiate',        '00000000-0000-0000-1001-000000000012', '00000000-0000-0000-1001-000000000013', false, false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000023', '00000000-0000-0000-1001-000000000001', 'Close Won',        '00000000-0000-0000-1001-000000000013', '00000000-0000-0000-1001-000000000014', true,  false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000024', '00000000-0000-0000-1001-000000000001', 'Close Lost',       '00000000-0000-0000-1001-000000000013', '00000000-0000-0000-1001-000000000015', true,  false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000025', '00000000-0000-0000-1001-000000000001', 'Back to Qualified', '00000000-0000-0000-1001-000000000012', '00000000-0000-0000-1001-000000000011', false, false, '00000000-0000-0000-0001-000000000001');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id) VALUES
('00000000-0000-0000-1001-000000000030', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Deal Value', 'crm_deal_value', 'number', '[]', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000031', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Source',     'crm_source',     'select', '["Website","Referral","Cold Outreach","Event","Other"]', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000032', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Close Date', 'crm_close_date', 'date',   '[]', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000033', '00000000-0000-0000-0000-000000000001', 'person',        'Company',    'crm_company',    'text',   '[]', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000034', '00000000-0000-0000-0000-000000000001', 'person',        'Phone',      'crm_phone',      'text',   '[]', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000035', '00000000-0000-0000-0000-000000000001', 'person',        'Job Title',  'crm_job_title',  'text',   '[]', false, '00000000-0000-0000-0001-000000000001');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id) VALUES
('00000000-0000-0000-1001-000000000040', '00000000-0000-0000-0000-000000000001', 'Contact', 'crm_contact', 'workflow_item', 'person',  '#3b82f6', false, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000041', '00000000-0000-0000-0000-000000000001', 'Company', 'crm_company', 'workflow_item', 'account', '#8b5cf6', false, '00000000-0000-0000-0001-000000000001');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id) VALUES
('00000000-0000-0000-1001-000000000050', '00000000-0000-0000-0000-000000000001',
 'Getting Started with CRM', 'crm-getting-started',
 '# Getting Started with CRM

## Your Sales Pipeline
Track deals through 6 stages: Lead → Qualified → Proposal → Negotiation → Closed Won / Closed Lost.

## Custom Fields
- **Deal Value** — Expected revenue
- **Source** — How the lead was acquired
- **Close Date** — Target close date

## Linking Contacts
Use entity links to connect people and companies to deals.

## Tips
- Move deals through stages using the transition buttons
- Add comments to deals to track conversation history',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000001'),

('00000000-0000-0000-1001-000000000051', '00000000-0000-0000-0000-000000000001',
 'CRM Admin Guide', 'crm-admin-guide',
 '# CRM Admin Guide

## Customizing the Pipeline
Edit the Sales Pipeline workflow under Admin → Workflows to add stages, change transitions, or require comments.

## Custom Fields
Add more fields under Admin → Custom Fields. Filter by entity type to find deal or contact fields.

## Automations
- Send a webhook when a deal enters Closed Won
- Notify the team on high-value deals
- Auto-assign deals based on source',
 'published', 'admin-guide', false, '00000000-0000-0000-0001-000000000001');

-- ── Test Data: Workflow Items ─────────────────────────────────────────
INSERT INTO workflow_items (id, account_id, workflow_definition_id, stage_definition_id, workflow_type, title, description, priority, metadata, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1001-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1001-000000000001', '00000000-0000-0000-1001-000000000010', 'Sales Pipeline',
 'Acme Corp — Enterprise License', 'Annual enterprise license deal', 'high',
 '{"crm_deal_value": 50000, "crm_source": "Referral"}', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000061', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1001-000000000001', '00000000-0000-0000-1001-000000000012', 'Sales Pipeline',
 'Widget Co — Starter Plan', 'Monthly starter subscription', 'medium',
 '{"crm_deal_value": 5000, "crm_source": "Website"}', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000062', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1001-000000000001', '00000000-0000-0000-1001-000000000013', 'Sales Pipeline',
 'Global Industries — Custom Build', 'Custom development project', 'high',
 '{"crm_deal_value": 120000, "crm_source": "Cold Outreach"}', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000063', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1001-000000000001', '00000000-0000-0000-1001-000000000014', 'Sales Pipeline',
 'TechStart — Pro Upgrade', 'Upgrade from free to pro tier', 'medium',
 '{"crm_deal_value": 12000, "crm_source": "Website"}', false, true, '00000000-0000-0000-0001-000000000001');

-- ── Test Data: Entity Links ───────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1001-000000000070', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1001-000000000060', 'person',  '00000000-0000-0000-0003-000000000004', 'crm_contact', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000071', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1001-000000000060', 'account', '00000000-0000-0000-0002-000000000001', 'crm_company', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000072', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1001-000000000061', 'account', '00000000-0000-0000-0002-000000000002', 'crm_company', false, true, '00000000-0000-0000-0001-000000000001'),
('00000000-0000-0000-1001-000000000073', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1001-000000000061', 'person',  '00000000-0000-0000-0003-000000000005', 'crm_contact', false, true, '00000000-0000-0000-0001-000000000001');
