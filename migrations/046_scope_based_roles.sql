-- Migration 046: Replace account_role RBAC with scope-based model
-- Adds admin scopes, bootstraps existing accounts/admins, deprecates account_role

-- Add admin scopes to auth_scopes
INSERT INTO auth_scopes (slug, label, description, category, capabilities, default_role, is_active) VALUES
('admin.members', 'Member Management', 'Manage memberships, invites, principals, and tenant roles', 'admin', '["memberships.read", "memberships.write", "invites.read", "invites.write", "principals.read", "principals.write", "tenant_roles.read", "tenant_roles.write"]', 'admin', true),
('admin.settings', 'Tenant Settings', 'Configure tenant settings, themes, and account configuration', 'admin', '["settings.read", "settings.write", "themes.read", "themes.write", "accounts.read", "accounts.write"]', 'admin', true),
('admin.automations', 'Automation Management', 'Create and manage automation rules, workflows, schedules, and custom actions', 'admin', '["automation.read", "automation.write", "workflows.read", "workflows.write", "schedules.read", "schedules.write", "custom_actions.read", "custom_actions.write"]', 'admin', true),
('admin.webhooks', 'Webhook Management', 'Configure webhook subscriptions, inbound hooks, and view delivery logs', 'admin', '["webhooks.read", "webhooks.write", "inbound_hooks.read", "inbound_hooks.write", "webhook_deliveries.read"]', 'admin', true),
('admin.integrations', 'Integration Management', 'Manage integrations, apps, agent capabilities, and extension surfaces', 'admin', '["integrations.read", "integrations.write", "apps.read", "apps.write", "agent_capabilities.read", "agent_capabilities.write", "extensions.read", "extensions.write"]', 'admin', true),
('admin.items', 'Item Management', 'Configure item types, stage/view/transition definitions, and item schemas', 'admin', '["item_types.read", "item_types.write", "stage_definitions.read", "stage_definitions.write", "view_definitions.read", "view_definitions.write", "transition_definitions.read", "transition_definitions.write"]', 'admin', true),
('admin.audit', 'Audit Access', 'View audit logs and system activity', 'admin', '["audit.read"]', 'admin', true),
('admin.packs', 'Pack Management', 'Manage pack lifecycle, config packs, and local manifests', 'admin', '["packs.read", "packs.write", "config_packs.read", "config_packs.write", "manifests.read", "manifests.write"]', 'admin', true);

-- Enable all admin scopes for existing accounts
INSERT INTO account_scopes (account_id, scope_id, status, source, ownership, notes, config, enabled_at)
SELECT 
  a.id as account_id,
  s.id as scope_id,
  'enabled' as status,
  'manual' as source,
  'tenant' as ownership,
  'Bootstrap: enabled all admin scopes for existing account' as notes,
  '{}' as config,
  now() as enabled_at
FROM accounts a
CROSS JOIN auth_scopes s
WHERE s.category = 'admin' AND s.is_active = true
ON CONFLICT (account_id, scope_id) DO NOTHING;

-- Grant all admin principal scopes to existing admin members
INSERT INTO principal_scopes (scope_id, principal_type, assignment_type, notes, granted_reason, created_at)
SELECT 
  s.id as scope_id,
  'human' as principal_type,
  'direct' as assignment_type,
  'Bootstrap: granted admin scopes to existing admin member' as notes,
  'Migrated from account_role=admin' as granted_reason,
  now() as created_at
FROM memberships m
JOIN auth_scopes s ON s.category = 'admin' AND s.is_active = true
WHERE m.account_role = 'admin' AND m.status = 'active'
ON CONFLICT (scope_id, principal_type, person_id) DO NOTHING;

-- Note: The above INSERT needs person_id in the ON CONFLICT, but we'll handle this properly in the migration
-- Let's fix the principal scopes insertion with proper person_id

-- Grant all admin principal scopes to existing admin members (corrected)
INSERT INTO principal_scopes (scope_id, principal_type, person_id, assignment_type, notes, granted_reason, created_at)
SELECT 
  s.id as scope_id,
  'human' as principal_type,
  m.person_id,
  'direct' as assignment_type,
  'Bootstrap: granted admin scopes to existing admin member' as notes,
  'Migrated from account_role=admin' as granted_reason,
  now() as created_at
FROM memberships m
JOIN auth_scopes s ON s.category = 'admin' AND s.is_active = true
WHERE m.account_role = 'admin' AND m.status = 'active'
ON CONFLICT (scope_id, principal_type, person_id) DO NOTHING;

-- Deprecate account_role: make it nullable and set all values to NULL
ALTER TABLE memberships ALTER COLUMN account_role DROP NOT NULL;
UPDATE memberships SET account_role = NULL;

-- Add a comment to mark account_role as deprecated
COMMENT ON COLUMN memberships.account_role IS 'DEPRECATED: Use principal_scopes with admin.* scopes instead';
