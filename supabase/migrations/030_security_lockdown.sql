-- 030_security_lockdown.sql
-- EMERGENCY: Enable RLS on all public tables and revoke excessive grants.
-- Netlify functions use service_role key (bypasses RLS) so app is unaffected.
-- This blocks direct PostgREST access via the public anon/authenticated keys.

-- ── Enable RLS on every public table ──────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_trigger_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE nav_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- ── Revoke all privileges from anon and authenticated ─────────────────
-- These roles should not have direct table access; all access goes
-- through Netlify functions using the service_role key.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Also revoke function execute so anon/authenticated can't call RPCs directly
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- ── Fix mutable search_path on functions ──────────────────────────────
ALTER FUNCTION public.match_embeddings(text, int, uuid) SET search_path = public;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- ── Move extensions out of public schema ──────────────────────────────
-- The extensions schema already exists in Supabase by default.
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
