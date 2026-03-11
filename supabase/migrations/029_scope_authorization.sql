-- 029: Scope-driven authorization tables (scopes, capabilities, account enablement, principal assignments)

-- ── auth_scopes ──────────────────────────────────────────────────────────
CREATE TABLE auth_scopes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  label             text NOT NULL,
  description       text,
  category          text NOT NULL DEFAULT 'general',
  default_role      text,
  enabled_levels    text[] NOT NULL DEFAULT ARRAY['system','account','account_node','self'],
  default_bundle    jsonb NOT NULL DEFAULT '{}',
  metadata          jsonb NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_scopes_active ON auth_scopes(is_active) WHERE is_active = true;
CREATE INDEX idx_auth_scopes_category ON auth_scopes(category);

CREATE TRIGGER trg_auth_scopes_updated_at
  BEFORE UPDATE ON auth_scopes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── scope_capabilities ───────────────────────────────────────────────────
CREATE TABLE scope_capabilities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id          uuid NOT NULL REFERENCES auth_scopes(id) ON DELETE CASCADE,
  capability        text NOT NULL,
  capability_type   text NOT NULL DEFAULT 'record' CHECK (capability_type IN ('record','field','action')),
  record_type       text,
  field_path        text,
  description       text,
  default_policies  jsonb NOT NULL DEFAULT '{}',
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope_id, capability)
);

CREATE INDEX idx_scope_capabilities_scope ON scope_capabilities(scope_id);

CREATE TRIGGER trg_scope_capabilities_updated_at
  BEFORE UPDATE ON scope_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── package_scopes (packs → scopes) ───────────────────────────────────────
CREATE TABLE package_scopes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id     uuid NOT NULL REFERENCES config_packs(id) ON DELETE CASCADE,
  scope_id    uuid NOT NULL REFERENCES auth_scopes(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated')),
  metadata    jsonb NOT NULL DEFAULT '{}',
  ownership   text NOT NULL DEFAULT 'pack' CHECK (ownership IN ('pack','tenant')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, scope_id)
);

CREATE INDEX idx_package_scopes_pack ON package_scopes(pack_id);
CREATE INDEX idx_package_scopes_scope ON package_scopes(scope_id);

CREATE TRIGGER trg_package_scopes_updated_at
  BEFORE UPDATE ON package_scopes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── account_scopes (tenant enablement) ────────────────────────────────────
CREATE TABLE account_scopes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scope_id       uuid NOT NULL REFERENCES auth_scopes(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled','preview')),
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('pack','manual')),
  ownership      text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack','tenant')),
  notes          text,
  config         jsonb NOT NULL DEFAULT '{}',
  enabled_at     timestamptz,
  disabled_at    timestamptz,
  updated_by     uuid REFERENCES persons(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, scope_id)
);

CREATE INDEX idx_account_scopes_account ON account_scopes(account_id);
CREATE INDEX idx_account_scopes_scope ON account_scopes(scope_id);
CREATE INDEX idx_account_scopes_status ON account_scopes(status);

CREATE TRIGGER trg_account_scopes_updated_at
  BEFORE UPDATE ON account_scopes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── machine_principals ───────────────────────────────────────────────────
CREATE TABLE machine_principals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  kind           text NOT NULL DEFAULT 'automation' CHECK (kind IN ('automation','api_key','ai_agent','integration')),
  auth_mode      text NOT NULL DEFAULT 'api_key' CHECK (auth_mode IN ('api_key','signed_jwt','oauth_client')),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  visibility     text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
  metadata       jsonb NOT NULL DEFAULT '{}',
  audit_channel  text,
  last_used_at   timestamptz,
  created_by     uuid REFERENCES persons(id),
  ownership      text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack','tenant')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_machine_principals_account ON machine_principals(account_id);
CREATE INDEX idx_machine_principals_status ON machine_principals(status);

CREATE TRIGGER trg_machine_principals_updated_at
  BEFORE UPDATE ON machine_principals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── principal_scopes (assignment per account) ─────────────────────────────
CREATE TABLE principal_scopes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scope_id              uuid NOT NULL REFERENCES auth_scopes(id) ON DELETE CASCADE,
  principal_type        text NOT NULL CHECK (principal_type IN ('human','machine','system')),
  person_id             uuid REFERENCES persons(id),
  machine_principal_id  uuid REFERENCES machine_principals(id),
  assignment_type       text NOT NULL DEFAULT 'direct' CHECK (assignment_type IN ('direct','role_bundle','justification','system_default')),
  granted_by            uuid REFERENCES persons(id),
  granted_reason        text,
  notes                 text,
  expires_at            timestamptz,
  metadata              jsonb NOT NULL DEFAULT '{}',
  ownership             text NOT NULL DEFAULT 'tenant' CHECK (ownership IN ('pack','tenant')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, scope_id, person_id, machine_principal_id)
);

ALTER TABLE principal_scopes
  ADD CONSTRAINT chk_principal_scopes_target
  CHECK (
    (principal_type = 'human' AND person_id IS NOT NULL AND machine_principal_id IS NULL)
    OR (principal_type = 'machine' AND machine_principal_id IS NOT NULL AND person_id IS NULL)
    OR (principal_type = 'system' AND person_id IS NULL AND machine_principal_id IS NULL)
  );

CREATE INDEX idx_principal_scopes_account ON principal_scopes(account_id);
CREATE INDEX idx_principal_scopes_scope ON principal_scopes(scope_id);
CREATE INDEX idx_principal_scopes_person ON principal_scopes(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_principal_scopes_machine ON principal_scopes(machine_principal_id) WHERE machine_principal_id IS NOT NULL;

CREATE TRIGGER trg_principal_scopes_updated_at
  BEFORE UPDATE ON principal_scopes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO auth_scopes (id, slug, label, category, description, default_role, default_bundle, metadata)
VALUES
  ('28090c29-bd44-4f6e-a816-6da08bcb9f85', 'support.inbox', 'Support Inbox', 'support', 'Work and triage customer tickets, assign owners, and collaborate in the shared inbox.', 'operator', '{"record":["view","list","assign"],"actions":["reply","transition"]}'::jsonb, '{"pack_slug":"support-portal","docs":"support/inbox"}'::jsonb),
  ('6f31230a-4a4b-4a97-a1e2-fbf88bed3875', 'support.escalations', 'Support Escalations', 'support', 'Manage SLA escalations, approval ladders, and incident bridges.', 'manager', '{"record":["view","list","transition"],"actions":["escalate","close"]}'::jsonb, '{"pack_slug":"support-portal","docs":"support/escalations"}'::jsonb),
  ('8e0d9d71-5d4e-41f6-80f5-2ad88662bba1', 'crm.pipeline', 'CRM Pipeline', 'crm', 'Operate the opportunity pipeline, including editing deals and forecasting.', 'manager', '{"record":["view","create","edit","assign"],"actions":["stage_move","forecast"]}'::jsonb, '{"pack_slug":"crm","docs":"crm/pipeline"}'::jsonb),
  ('9b47b7d2-303d-4a61-8a66-92e97ff6de1e', 'crm.accounts', 'CRM Accounts', 'crm', 'Access account and contact records, including enrichment and segmentation fields.', 'operator', '{"record":["view","edit"],"fields":["field.view","field.edit"]}'::jsonb, '{"pack_slug":"crm","docs":"crm/accounts"}'::jsonb),
  ('4d329aa2-5a94-4ed2-98af-9b60c1ca4a39', 'automation.workflows', 'Automation Workflows', 'automation', 'Author and run workflow automations, webhook steps, and AI copilots.', 'architect', '{"record":["view","create","edit","delete"],"actions":["publish","execute"]}'::jsonb, '{"pack_slug":"monday","docs":"automation/workflows"}'::jsonb),
  ('e1892741-732d-492d-915d-6c9b25a4d11a', 'automation.integrations', 'Automation Integrations', 'automation', 'Connect integrations, manage credentials, and control data sync schedules.', 'architect', '{"record":["view","edit"],"actions":["connect","disconnect","sync_now"]}'::jsonb, '{"pack_slug":"jira","docs":"automation/integrations"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Seed canonical capability definitions per scope
WITH caps(scope_slug, capability, capability_type, record_type, description) AS (
  VALUES
    ('support.inbox', 'view', 'record', 'ticket', 'View support tickets and their timeline.'),
    ('support.inbox', 'assign', 'record', 'ticket', 'Assign ticket owner or queue.'),
    ('support.inbox', 'transition', 'action', 'ticket', 'Move ticket between workflow stages.'),
    ('support.escalations', 'approve', 'action', 'ticket', 'Approve or reject escalation requests.'),
    ('support.escalations', 'bridge', 'action', 'ticket', 'Open escalation bridge rooms and incident comms.'),
    ('crm.pipeline', 'create', 'record', 'deal', 'Create new opportunities in the pipeline.'),
    ('crm.pipeline', 'forecast', 'action', 'deal', 'Submit forecast entries for owned pipeline.'),
    ('crm.accounts', 'field.edit', 'field', 'account', 'Edit sensitive firmographic/account owner fields.'),
    ('automation.workflows', 'publish', 'action', 'automation_rule', 'Publish automation workflows to production.'),
    ('automation.workflows', 'execute', 'action', 'automation_rule', 'Trigger workflow runs manually.'),
    ('automation.integrations', 'connect', 'action', 'integration_instance', 'Authorize or rotate integration credentials.'),
    ('automation.integrations', 'sync_now', 'action', 'integration_instance', 'Kick off on-demand sync jobs.')
)
INSERT INTO scope_capabilities (scope_id, capability, capability_type, record_type, description)
SELECT s.id, caps.capability, caps.capability_type, caps.record_type, caps.description
FROM caps
JOIN auth_scopes s ON s.slug = caps.scope_slug
ON CONFLICT (scope_id, capability) DO NOTHING;

-- Map template packs to scopes they ship
WITH pack_scope_map(pack_slug, scope_slug) AS (
  VALUES
    ('support-portal', 'support.inbox'),
    ('support-portal', 'support.escalations'),
    ('crm', 'crm.pipeline'),
    ('crm', 'crm.accounts'),
    ('monday', 'automation.workflows'),
    ('jira', 'automation.integrations')
)
INSERT INTO package_scopes (pack_id, scope_id, status, metadata)
SELECT p.id, s.id, 'active', jsonb_build_object('pack_slug', p.slug)
FROM pack_scope_map m
JOIN config_packs p ON p.slug = m.pack_slug
JOIN auth_scopes s ON s.slug = m.scope_slug
ON CONFLICT (pack_id, scope_id) DO NOTHING;

-- Enable scopes for shared demo accounts so UI has data to display
WITH demo_accounts AS (
  SELECT id, display_name FROM accounts
  WHERE id IN (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0002-000000000003'
  )
),
account_scope_map(account_id, scope_slug, source) AS (
  SELECT * FROM (VALUES
    ('00000000-0000-0000-0002-000000000001'::uuid, 'support.inbox', 'pack'),
    ('00000000-0000-0000-0002-000000000001'::uuid, 'support.escalations', 'pack'),
    ('00000000-0000-0000-0002-000000000002'::uuid, 'crm.pipeline', 'pack'),
    ('00000000-0000-0000-0002-000000000002'::uuid, 'crm.accounts', 'pack'),
    ('00000000-0000-0000-0002-000000000003'::uuid, 'automation.workflows', 'pack'),
    ('00000000-0000-0000-0002-000000000003'::uuid, 'automation.integrations', 'pack')
  ) AS v(account_id, scope_slug, source)
)
INSERT INTO account_scopes (account_id, scope_id, status, source, ownership, enabled_at, notes)
SELECT m.account_id,
       s.id,
       'enabled',
       m.source,
       CASE WHEN m.source = 'pack' THEN 'pack' ELSE 'tenant' END,
       now(),
       concat('Seeded via scope migration for ', coalesce(a.display_name, 'demo account'))
FROM account_scope_map m
JOIN auth_scopes s ON s.slug = m.scope_slug
LEFT JOIN demo_accounts a ON a.id = m.account_id
ON CONFLICT (account_id, scope_id) DO NOTHING;
