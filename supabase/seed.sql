-- Seed data for Spine MVP
-- Run after migrations

-- Cleanup demo data to keep reruns idempotent
DELETE FROM workflow_items WHERE workflow_definition_id IN ('55555555-5555-5555-5555-555555555551', '55555555-5555-5555-5555-555555555552');
DELETE FROM automation_rules WHERE id IN ('77777777-7777-7777-7777-777777777777');
DELETE FROM stage_definitions WHERE workflow_definition_id IN ('55555555-5555-5555-5555-555555555551', '55555555-5555-5555-5555-555555555552');
DELETE FROM workflow_definitions WHERE id IN ('55555555-5555-5555-5555-555555555551', '55555555-5555-5555-5555-555555555552');
DELETE FROM tickets WHERE account_id IN ('11111111-1111-1111-1111-111111111111');
DELETE FROM knowledge_base_articles WHERE account_id IN ('11111111-1111-1111-1111-111111111111');
DELETE FROM memberships WHERE account_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
DELETE FROM profiles WHERE person_id IN ('44444444-4444-4444-4444-444444444441', '44444444-4444-4444-4444-444444444442', '44444444-4444-4444-4444-444444444443', '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444445');
DELETE FROM tenant_themes WHERE account_id IN ('11111111-1111-1111-1111-111111111111');
DELETE FROM accounts WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

-- Accounts
INSERT INTO accounts (id, account_type, display_name, status, settings) VALUES
  ('11111111-1111-1111-1111-111111111111', 'organization', 'Acme Corp', 'active', '{"single_tenant_mode": false}'),
  ('22222222-2222-2222-2222-222222222222', 'individual', 'Jane Solo', 'active', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'organization', 'KP Growth - Deals CRM', 'active', '{"single_tenant_mode": false}')
ON CONFLICT (id) DO UPDATE SET
  account_type = EXCLUDED.account_type,
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  settings = EXCLUDED.settings;

-- Persons
INSERT INTO persons (id, email, full_name, status) VALUES
  ('44444444-4444-4444-4444-444444444441', 'admin@acme.com', 'Alice Admin', 'active'),
  ('44444444-4444-4444-4444-444444444442', 'operator@acme.com', 'Bob Operator', 'active'),
  ('44444444-4444-4444-4444-444444444443', 'member@acme.com', 'Carol Member', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'jane@solo.com', 'Jane Solo', 'active'),
  ('44444444-4444-4444-4444-444444444445', 'kpettit851@gmail.com', 'Kerry Pettit', 'active'),
  ('55555555-1111-1111-1111-111111111111', 'lydia@atlasanalytics.com', 'Lydia Becker', 'active'),
  ('55555555-2222-2222-2222-222222222222', 'marco@atlasanalytics.com', 'Marco Ortiz', 'active'),
  ('55555555-3333-3333-3333-333333333333', 'claire@beaconsystems.com', 'Claire Hwang', 'active'),
  ('55555555-4444-4444-4444-444444444444', 'dmitri@beaconsystems.com', 'Dmitri Sokolov', 'active')
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  status = EXCLUDED.status;

-- Profiles
INSERT INTO profiles (person_id, display_name, system_role) VALUES
  ((SELECT id FROM persons WHERE email = 'admin@acme.com'), 'Alice Admin', 'system_admin'),
  ((SELECT id FROM persons WHERE email = 'operator@acme.com'), 'Bob Operator', NULL),
  ((SELECT id FROM persons WHERE email = 'member@acme.com'), 'Carol Member', NULL),
  ((SELECT id FROM persons WHERE email = 'jane@solo.com'), 'Jane Solo', NULL),
  ((SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), 'Kerry Pettit', NULL)
ON CONFLICT (person_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  system_role = EXCLUDED.system_role;

-- Memberships
INSERT INTO memberships (person_id, account_id, account_role, status) VALUES
  ((SELECT id FROM persons WHERE email = 'admin@acme.com'), '11111111-1111-1111-1111-111111111111', 'admin', 'active'),
  ((SELECT id FROM persons WHERE email = 'operator@acme.com'), '11111111-1111-1111-1111-111111111111', 'operator', 'active'),
  ((SELECT id FROM persons WHERE email = 'member@acme.com'), '11111111-1111-1111-1111-111111111111', 'member', 'active'),
  ((SELECT id FROM persons WHERE email = 'jane@solo.com'), '22222222-2222-2222-2222-222222222222', 'admin', 'active'),
  ((SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), '33333333-3333-3333-3333-333333333333', 'admin', 'active')
ON CONFLICT (person_id, account_id) DO UPDATE SET
  account_role = EXCLUDED.account_role,
  status = EXCLUDED.status;

-- Workflow definitions
INSERT INTO workflow_definitions (id, account_id, name, description, status) VALUES
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 'Customer Onboarding', 'Standard customer onboarding workflow', 'active'),
  ('55555555-5555-5555-5555-555555555552', '33333333-3333-3333-3333-333333333333', 'Deals Pipeline', 'CRM pipeline for inbound website leads', 'active')
ON CONFLICT (id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- Stage definitions
INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal) VALUES
  ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', 'New', 0, true, false),
  ('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555551', 'In Progress', 1, false, false),
  ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555551', 'Review', 2, false, false),
  ('66666666-6666-6666-6666-666666666664', '55555555-5555-5555-5555-555555555551', 'Complete', 3, false, true),
  ('66666666-6666-6666-6666-666666666665', '55555555-5555-5555-5555-555555555552', 'Lead', 0, true, false),
  ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555552', 'Contacted', 1, false, false),
  ('66666666-6666-6666-6666-666666666667', '55555555-5555-5555-5555-555555555552', 'Proposal', 2, false, false),
  ('66666666-6666-6666-6666-666666666668', '55555555-5555-5555-5555-555555555552', 'Closed Won', 3, false, true),
  ('66666666-6666-6666-6666-666666666669', '55555555-5555-5555-5555-555555555552', 'Closed Lost', 3, false, true)
ON CONFLICT (id) DO UPDATE SET
  workflow_definition_id = EXCLUDED.workflow_definition_id,
  name = EXCLUDED.name,
  position = EXCLUDED.position,
  is_initial = EXCLUDED.is_initial,
  is_terminal = EXCLUDED.is_terminal;

-- Update allowed transitions
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666662'::uuid] WHERE id = '66666666-6666-6666-6666-666666666661';
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666663'::uuid, '66666666-6666-6666-6666-666666666661'::uuid] WHERE id = '66666666-6666-6666-6666-666666666662';
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666664'::uuid, '66666666-6666-6666-6666-666666666662'::uuid] WHERE id = '66666666-6666-6666-6666-666666666663';
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666666'::uuid] WHERE id = '66666666-6666-6666-6666-666666666665';
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666667'::uuid, '66666666-6666-6666-6666-666666666665'::uuid] WHERE id = '66666666-6666-6666-6666-666666666666';
UPDATE stage_definitions SET allowed_transitions = ARRAY['66666666-6666-6666-6666-666666666668'::uuid, '66666666-6666-6666-6666-666666666669'::uuid, '66666666-6666-6666-6666-666666666666'::uuid] WHERE id = '66666666-6666-6666-6666-666666666667';

-- Workflow items
INSERT INTO workflow_items (id, account_id, workflow_definition_id, stage_definition_id, workflow_type, title, description, owner_person_id, priority, metadata) VALUES
  ('88888888-8888-8888-8888-888888888881', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', '66666666-6666-6666-6666-666666666661', 'onboarding', 'Onboard Globex Inc', 'New enterprise customer onboarding', (SELECT id FROM persons WHERE email = 'operator@acme.com'), 'high', '{}'::jsonb),
  ('88888888-8888-8888-8888-888888888882', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', '66666666-6666-6666-6666-666666666662', 'onboarding', 'Onboard Initech', 'SMB customer onboarding', (SELECT id FROM persons WHERE email = 'operator@acme.com'), 'medium', '{}'::jsonb),
  ('88888888-8888-8888-8888-888888888883', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', '66666666-6666-6666-6666-666666666663', 'onboarding', 'Onboard Umbrella Corp', 'Final review pending', (SELECT id FROM persons WHERE email = 'admin@acme.com'), 'low', '{}'::jsonb),
  ('88888888-8888-8888-8888-888888888884', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555552', '66666666-6666-6666-6666-666666666665', 'deals', 'Atlas Analytics – Discovery Call', 'Inbound signup from pricing page', (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), 'medium', '{"company":{"name":"Atlas Analytics","domain":"atlasanalytics.com","industry":"Marketing Intelligence"},"contacts":[{"person_id":"55555555-1111-1111-1111-111111111111","email":"lydia@atlasanalytics.com","role":"VP Operations"},{"person_id":"55555555-2222-2222-2222-222222222222","email":"marco@atlasanalytics.com","role":"CTO"}],"last_action":"pricing_form_submit","estimated_value":45000}'::jsonb),
  ('88888888-8888-8888-8888-888888888885', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555552', '66666666-6666-6666-6666-666666666667', 'deals', 'Atlas Analytics – Pilot Scope', 'Pilot scoping with security review pending', (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), 'high', '{"company":{"name":"Atlas Analytics","domain":"atlasanalytics.com","industry":"Marketing Intelligence"},"contacts":[{"person_id":"55555555-1111-1111-1111-111111111111","email":"lydia@atlasanalytics.com","role":"VP Operations"},{"person_id":"55555555-2222-2222-2222-222222222222","email":"marco@atlasanalytics.com","role":"CTO"}],"last_action":"security_questionnaire_sent","estimated_value":92000}'::jsonb),
  ('88888888-8888-8888-8888-888888888886', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555552', '66666666-6666-6666-6666-666666666668', 'deals', 'Beacon Systems – Expansion', 'Expansion request after roadmap webinar', (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), 'high', '{"company":{"name":"Beacon Systems","domain":"beaconsystems.com","industry":"Field Service"},"contacts":[{"person_id":"55555555-3333-3333-3333-333333333333","email":"claire@beaconsystems.com","role":"Head of Support"},{"person_id":"55555555-4444-4444-4444-444444444444","email":"dmitri@beaconsystems.com","role":"CFO"}],"last_action":"contract_signed","estimated_value":78000,"status_note":"Closed Won – rollout scheduled"}'::jsonb),
  ('88888888-8888-8888-8888-888888888887', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555552', '66666666-6666-6666-6666-666666666669', 'deals', 'Beacon Systems – Legacy Migration', 'Legacy tooling migration deprioritized this quarter', (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com'), 'medium', '{"company":{"name":"Beacon Systems","domain":"beaconsystems.com","industry":"Field Service"},"contacts":[{"person_id":"55555555-3333-3333-3333-333333333333","email":"claire@beaconsystems.com","role":"Head of Support"},{"person_id":"55555555-4444-4444-4444-444444444444","email":"dmitri@beaconsystems.com","role":"CFO"}],"last_action":"project_paused","estimated_value":52000,"status_note":"Closed Lost - budget deferred"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  stage_definition_id = EXCLUDED.stage_definition_id,
  workflow_type = EXCLUDED.workflow_type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  owner_person_id = EXCLUDED.owner_person_id,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata;

-- CRM automation example: when a website visit is marked "book_demo", jump to Proposal
INSERT INTO automation_rules (id, account_id, workflow_definition_id, name, trigger_event, conditions, action_type, action_config, enabled)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  '55555555-5555-5555-5555-555555555552',
  'Auto-advance demo requests',
  'workflow_item.updated',
  '[{"field":"after.metadata.last_action","operator":"equals","value":"book_demo"}]',
  'transition_stage',
  '{"target_stage_id":"66666666-6666-6666-6666-666666666667"}',
  true
)
ON CONFLICT (id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  workflow_definition_id = EXCLUDED.workflow_definition_id,
  name = EXCLUDED.name,
  trigger_event = EXCLUDED.trigger_event,
  conditions = EXCLUDED.conditions,
  action_type = EXCLUDED.action_type,
  action_config = EXCLUDED.action_config,
  enabled = EXCLUDED.enabled;

-- Tickets
INSERT INTO tickets (id, account_id, subject, status, priority, category, opened_by_person_id) VALUES
  ('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'Cannot access billing portal', 'open', 'high', 'billing', '44444444-4444-4444-4444-444444444443'),
  ('99999999-9999-9999-9999-999999999992', '11111111-1111-1111-1111-111111111111', 'Feature request: bulk export', 'open', 'low', 'feature', '44444444-4444-4444-4444-444444444442')
ON CONFLICT (id) DO UPDATE SET
  subject = EXCLUDED.subject,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  category = EXCLUDED.category,
  opened_by_person_id = EXCLUDED.opened_by_person_id;

-- Knowledge base articles
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, author_person_id, published_at) VALUES
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Getting Started with Spine', 'getting-started', '# Getting Started\n\nWelcome to Spine! This guide will help you set up your workspace.\n\n## Step 1: Create your account\n\nSign up at the login page with your email and password.\n\n## Step 2: Invite your team\n\nGo to Settings → Members to invite team members.\n\n## Step 3: Set up workflows\n\nNavigate to Workflows to create your first workflow definition.', 'published', 'guides', '44444444-4444-4444-4444-444444444441', now()),
  ('aaaaaaa2-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Understanding Roles & Permissions', 'roles-permissions', '# Roles & Permissions\n\nSpine uses a two-tier role system:\n\n## Account Roles\n- **Admin**: Full access to tenant resources\n- **Operator**: Can manage workflows and tickets\n- **Member**: Read access with limited write\n\n## System Roles\n- **System Admin**: Cross-tenant administration\n- **System Operator**: Cross-tenant read access\n- **Support Operator**: Support ticket access across tenants', 'published', 'guides', '44444444-4444-4444-4444-444444444441', now())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  body = EXCLUDED.body,
  status = EXCLUDED.status,
  category = EXCLUDED.category,
  author_person_id = EXCLUDED.author_person_id;

-- Tenant theme
INSERT INTO tenant_themes (account_id, preset, tokens) VALUES
  ('11111111-1111-1111-1111-111111111111', 'clean', '{}')
ON CONFLICT (account_id) DO UPDATE SET
  preset = EXCLUDED.preset,
  tokens = EXCLUDED.tokens;
