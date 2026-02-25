-- 048: Support Portal Pack — materialized entities (all inactive)
-- Pack ID: 00000000-0000-0000-0001-000000000002

-- ── Workflow: Support Escalation ──────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, is_active, pack_id)
VALUES ('00000000-0000-0000-1002-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Support Escalation', 'Route support requests through triage to resolution',
        false, '00000000-0000-0000-0001-000000000002');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_active, pack_id) VALUES
('00000000-0000-0000-1002-000000000010', '00000000-0000-0000-1002-000000000001', 'New',               0, true,  false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000011', '00000000-0000-0000-1002-000000000001', 'Triaged',           1, false, false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000001', 'In Progress',       2, false, false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000013', '00000000-0000-0000-1002-000000000001', 'Awaiting Customer', 3, false, false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000014', '00000000-0000-0000-1002-000000000001', 'Resolved',          4, false, true,  false, '00000000-0000-0000-0001-000000000002');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id) VALUES
('00000000-0000-0000-1002-000000000020', '00000000-0000-0000-1002-000000000001', 'Triage',           '00000000-0000-0000-1002-000000000010', '00000000-0000-0000-1002-000000000011', false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000021', '00000000-0000-0000-1002-000000000001', 'Start Work',       '00000000-0000-0000-1002-000000000011', '00000000-0000-0000-1002-000000000012', false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000022', '00000000-0000-0000-1002-000000000001', 'Ask Customer',     '00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000013', false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000023', '00000000-0000-0000-1002-000000000001', 'Customer Replied', '00000000-0000-0000-1002-000000000013', '00000000-0000-0000-1002-000000000012', false, false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000024', '00000000-0000-0000-1002-000000000001', 'Resolve',          '00000000-0000-0000-1002-000000000012', '00000000-0000-0000-1002-000000000014', true,  false, '00000000-0000-0000-0001-000000000002');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_active, pack_id) VALUES
('00000000-0000-0000-1002-000000000030', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Product',     'support_product',     'select', '["Core","API","Mobile","Integrations"]',  false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000031', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Environment', 'support_environment', 'select', '["Production","Staging","Development"]',  false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000032', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Severity',    'support_severity',    'select', '["Critical","Major","Minor","Cosmetic"]', false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000033', '00000000-0000-0000-0000-000000000001', 'person',        'Plan Tier',   'support_plan_tier',   'select', '["Free","Pro","Enterprise"]',              false, '00000000-0000-0000-0001-000000000002');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id) VALUES
('00000000-0000-0000-1002-000000000040', '00000000-0000-0000-0000-000000000001', 'Related Ticket',    'support_related_ticket',    'workflow_item', 'workflow_item', '#f59e0b', false, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000041', '00000000-0000-0000-0000-000000000001', 'Affected Customer', 'support_affected_customer', 'workflow_item', 'person',        '#ef4444', false, '00000000-0000-0000-0001-000000000002');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id) VALUES
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
- Add comments to maintain context for the customer',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000002'),

('00000000-0000-0000-1002-000000000051', '00000000-0000-0000-0000-000000000001',
 'Support Admin Guide', 'support-admin-guide',
 '# Support Admin Guide

## Workflow Customization
Edit the Support Escalation workflow to add stages like Escalated or Waiting on Vendor.

## Custom Fields
Add fields for SLA deadlines, ticket categories, or customer satisfaction scores.

## Automations
- Auto-assign tickets based on product area
- Send webhook on critical severity tickets
- Notify team lead when tickets are unresolved for 24h',
 'published', 'admin-guide', false, '00000000-0000-0000-0001-000000000002');

-- ── Test Data: Workflow Items ─────────────────────────────────────────
INSERT INTO workflow_items (id, account_id, workflow_definition_id, stage_definition_id, workflow_type, title, description, priority, metadata, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1002-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000010', 'Support Escalation',
 'Login page returns 500 error', 'Users unable to log in since morning', 'urgent',
 '{"support_product":"Core","support_severity":"Critical","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000061', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000012', 'Support Escalation',
 'API rate limit too low', 'Customer hitting limits on batch operations', 'medium',
 '{"support_product":"API","support_severity":"Minor","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000062', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000013', 'Support Escalation',
 'Mobile app crashes on iOS 17', 'Crash on launch for specific devices', 'high',
 '{"support_product":"Mobile","support_severity":"Major","support_environment":"Production"}', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000063', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1002-000000000001', '00000000-0000-0000-1002-000000000014', 'Support Escalation',
 'Integration webhook not firing', 'Zapier integration stopped working', 'low',
 '{"support_product":"Integrations","support_severity":"Minor","support_environment":"Staging"}', false, true, '00000000-0000-0000-0001-000000000002');

-- ── Test Data: Entity Links ───────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1002-000000000070', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1002-000000000060', 'person',        '00000000-0000-0000-0003-000000000005', 'support_affected_customer', false, true, '00000000-0000-0000-0001-000000000002'),
('00000000-0000-0000-1002-000000000071', '00000000-0000-0000-0000-000000000001', 'workflow_item', '00000000-0000-0000-1002-000000000060', 'workflow_item', '00000000-0000-0000-1002-000000000062', 'support_related_ticket',   false, true, '00000000-0000-0000-0001-000000000002');
