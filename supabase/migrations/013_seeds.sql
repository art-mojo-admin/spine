-- 013: Seed data — registry types, template account, Make.com integration definition

-- ══════════════════════════════════════════════════════════════════════
-- ENTITY TYPE REGISTRY
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO entity_type_registry (slug, label, is_system) VALUES
  ('item',         'Item',         true),
  ('account',      'Account',      true),
  ('person',       'Person',       true),
  ('document',     'Document',     true),
  ('thread',       'Thread',       true),
  ('message',      'Message',      true),
  ('relationship', 'Relationship', true),
  ('workflow',     'Workflow',     true),
  ('view',         'View',         true),
  ('app',          'App',          true),
  ('integration',  'Integration',  true)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- ITEM TYPE REGISTRY
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO item_type_registry (slug, label, icon, is_system) VALUES
  ('task',     'Task',     'check-square',  true),
  ('ticket',   'Ticket',   'ticket',        true),
  ('deal',     'Deal',     'handshake',     true),
  ('contract', 'Contract', 'file-text',     true),
  ('event',    'Event',    'calendar',      true),
  ('vendor',   'Vendor',   'building',      true),
  ('bug',      'Bug',      'bug',           true),
  ('feature',  'Feature',  'lightbulb',     true),
  ('epic',     'Epic',     'layers',        true),
  ('story',    'Story',    'book-open',     true),
  ('lead',     'Lead',     'user-plus',     true),
  ('project',  'Project',  'folder',        true)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- ACTION TYPE REGISTRY
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO action_type_registry (slug, label, is_system) VALUES
  ('webhook',           'Webhook',            true),
  ('update_field',      'Update Field',       true),
  ('emit_event',        'Emit Event',         true),
  ('ai_prompt',         'AI Prompt',          true),
  ('create_entity',     'Create Entity',      true),
  ('send_notification', 'Send Notification',  true),
  ('send_email',        'Send Email',         true),
  ('create_link',       'Create Link',        true),
  ('schedule_timer',    'Schedule Timer',     true),
  ('transition_stage',  'Transition Stage',   true)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- BUILT-IN LINK TYPE DEFINITIONS (person↔item roles)
-- These are "system" link types available to all accounts.
-- Pack seeds will clone account-specific versions.
-- ══════════════════════════════════════════════════════════════════════
-- Note: link_type_definitions are per-account. These will be seeded
-- per-account by packs. The convention for person↔item roles is:
--   source_type='item', target_type='person', link_type=<role>
-- Built-in link_type slugs (used by convention, not enforced by FK):
--   requester, assignee, watcher, approver, follower, reviewer, attendee, mentor

-- ══════════════════════════════════════════════════════════════════════
-- TEMPLATE ACCOUNT (for pack blueprints)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO accounts (id, account_type, display_name, status, slug, is_active, is_test_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'organization',
  'Spine Template Packs',
  'active',
  'spine-template-packs',
  false,
  false
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status;

-- ══════════════════════════════════════════════════════════════════════
-- MAKE.COM INTEGRATION DEFINITION
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO integration_definitions (slug, name, description, icon, category, version, manifest, is_system)
VALUES (
  'make-com',
  'Make.com',
  'Connect Spine to Make.com for workflow automation, data sync, and external integrations.',
  'webhook',
  'automation',
  '1.0.0',
  '{
    "auth_type": "api_key",
    "config_schema": {},
    "inbound_endpoints": [
      {
        "name": "Default Inbound",
        "event_name": "make.webhook",
        "mapping_template": {}
      }
    ],
    "outbound_presets": [
      {
        "name": "All Events",
        "event_types": ["*"],
        "url_template": ""
      }
    ]
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;
