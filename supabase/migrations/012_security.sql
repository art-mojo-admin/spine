-- 012: Security — RLS, helper functions, observability, security lockdown

-- ── Observability: error_events ────────────────────────────────────────
CREATE TABLE error_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid REFERENCES accounts(id) ON DELETE SET NULL,
  request_id              text,
  function_name           text NOT NULL,
  error_code              text NOT NULL,
  message                 text NOT NULL,
  stack_summary           text,
  integration_instance_id uuid REFERENCES integration_instances(id) ON DELETE SET NULL,
  metadata                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_events_account ON error_events(account_id);
CREATE INDEX idx_error_events_function ON error_events(function_name);
CREATE INDEX idx_error_events_code ON error_events(error_code);
CREATE INDEX idx_error_events_created ON error_events(created_at DESC);
CREATE INDEX idx_error_events_integration ON error_events(integration_instance_id)
  WHERE integration_instance_id IS NOT NULL;

-- ── Observability: metrics_snapshots ───────────────────────────────────
CREATE TABLE metrics_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  function_name       text,
  total_errors        integer NOT NULL DEFAULT 0,
  error_codes         jsonb NOT NULL DEFAULT '{}',
  scheduler_executed  integer NOT NULL DEFAULT 0,
  scheduler_errors    integer NOT NULL DEFAULT 0,
  webhook_delivered   integer NOT NULL DEFAULT 0,
  webhook_failed      integer NOT NULL DEFAULT 0,
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_snapshots_period ON metrics_snapshots(period_start);
CREATE INDEX idx_metrics_snapshots_function ON metrics_snapshots(function_name);

-- ── Helper functions for RLS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.account_id
  FROM memberships m
  JOIN persons p ON p.id = m.person_id
  WHERE p.auth_uid = auth.uid()
    AND m.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.user_person_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id
  FROM persons p
  WHERE p.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_admin_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT m.account_id
  FROM memberships m
  JOIN persons p ON p.id = m.person_id
  WHERE p.auth_uid = auth.uid()
    AND m.status = 'active'
    AND m.account_role IN ('admin', 'operator');
$$;

-- ── match_embeddings RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding text,
  match_count int DEFAULT 10,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  account_id uuid,
  entity_type text,
  entity_id uuid,
  vector_type text,
  metadata jsonb,
  model text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.account_id,
    e.entity_type,
    e.entity_id,
    e.vector_type,
    e.metadata,
    e.model,
    e.created_at,
    1 - (e.embedding <=> query_embedding::vector) AS similarity
  FROM embeddings e
  WHERE (p_account_id IS NULL OR e.account_id = p_account_id)
  ORDER BY e.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- ENABLE RLS ON ALL TABLES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_trigger_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_webhook_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_action_types ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════
-- RLS POLICIES — defense-in-depth
-- Netlify functions use service_role (bypasses RLS).
-- These protect against direct PostgREST access.
-- ══════════════════════════════════════════════════════════════════════

-- ── accounts ───────────────────────────────────────────────────────────
CREATE POLICY "accounts_select" ON accounts FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_account_ids()));
CREATE POLICY "accounts_update" ON accounts FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_admin_account_ids()));

-- ── workflow_definitions ───────────────────────────────────────────────
CREATE POLICY "wf_defs_select" ON workflow_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "wf_defs_modify" ON workflow_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── stage_definitions ──────────────────────────────────────────────────
CREATE POLICY "stage_defs_select" ON stage_definitions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));
CREATE POLICY "stage_defs_modify" ON stage_definitions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── transition_definitions ─────────────────────────────────────────────
CREATE POLICY "trans_defs_select" ON transition_definitions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));
CREATE POLICY "trans_defs_modify" ON transition_definitions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── workflow_actions ───────────────────────────────────────────────────
CREATE POLICY "wf_actions_select" ON workflow_actions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));
CREATE POLICY "wf_actions_modify" ON workflow_actions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── items ──────────────────────────────────────────────────────────────
CREATE POLICY "items_select" ON items FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "items_modify" ON items FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── threads ────────────────────────────────────────────────────────────
CREATE POLICY "threads_select" ON threads FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "threads_modify" ON threads FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── messages ───────────────────────────────────────────────────────────
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (thread_id IN (
    SELECT id FROM threads WHERE account_id IN (SELECT public.user_account_ids())
  ));
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (thread_id IN (
    SELECT id FROM threads WHERE account_id IN (SELECT public.user_account_ids())
  ));

-- ── Generic tenant-scoped read/admin-write pattern ─────────────────────
-- Applied to all remaining tenant-scoped tables

CREATE POLICY "entity_links_select" ON entity_links FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "entity_links_modify" ON entity_links FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "link_type_defs_select" ON link_type_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "link_type_defs_modify" ON link_type_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "custom_field_defs_select" ON custom_field_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "custom_field_defs_modify" ON custom_field_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "entity_watchers_select" ON entity_watchers FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "entity_watchers_modify" ON entity_watchers FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "entity_attachments_select" ON entity_attachments FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "entity_attachments_modify" ON entity_attachments FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "automation_rules_modify" ON automation_rules FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "sched_triggers_select" ON scheduled_triggers FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "sched_triggers_modify" ON scheduled_triggers FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "sched_instances_select" ON scheduled_trigger_instances FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "outbox_select" ON outbox_events FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "webhook_subs_select" ON webhook_subscriptions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "webhook_subs_modify" ON webhook_subscriptions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "webhook_del_select" ON webhook_deliveries FOR SELECT TO authenticated
  USING (webhook_subscription_id IN (
    SELECT id FROM webhook_subscriptions WHERE account_id IN (SELECT public.user_account_ids())
  ));

CREATE POLICY "inbound_keys_select" ON inbound_webhook_keys FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "inbound_keys_modify" ON inbound_webhook_keys FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "inbound_mappings_select" ON inbound_webhook_mappings FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "inbound_mappings_modify" ON inbound_webhook_mappings FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "kb_articles_select" ON knowledge_base_articles FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()) OR is_global = true);
CREATE POLICY "kb_articles_modify" ON knowledge_base_articles FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "enrollments_select" ON enrollments FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "enrollments_modify" ON enrollments FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "lesson_completions_select" ON lesson_completions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "lesson_completions_modify" ON lesson_completions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "view_defs_select" ON view_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "view_defs_modify" ON view_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "app_defs_select" ON app_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "app_defs_modify" ON app_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "integration_instances_select" ON integration_instances FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "integration_instances_modify" ON integration_instances FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── Observability: system admins only ──────────────────────────────────
CREATE POLICY "error_events_select" ON error_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN persons per ON per.id = p.person_id
      WHERE per.auth_uid = auth.uid()
        AND p.system_role IN ('system_admin', 'system_operator')
    )
  );

CREATE POLICY "metrics_snapshots_select" ON metrics_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN persons per ON per.id = p.person_id
      WHERE per.auth_uid = auth.uid()
        AND p.system_role IN ('system_admin', 'system_operator')
    )
  );

-- ── Persons: can see self + members of shared accounts ─────────────────
CREATE POLICY "persons_select" ON persons FOR SELECT TO authenticated
  USING (
    auth_uid = auth.uid()
    OR id IN (
      SELECT m.person_id FROM memberships m
      WHERE m.account_id IN (SELECT public.user_account_ids())
        AND m.status = 'active'
    )
  );

CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (
    person_id = public.user_person_id()
    OR person_id IN (
      SELECT m.person_id FROM memberships m
      WHERE m.account_id IN (SELECT public.user_account_ids())
        AND m.status = 'active'
    )
  );

CREATE POLICY "memberships_select" ON memberships FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "memberships_modify" ON memberships FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "invites_select" ON invites FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "invites_modify" ON invites FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "themes_select" ON tenant_themes FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "themes_modify" ON tenant_themes FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "activity_select" ON activity_events FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "impersonation_select" ON impersonation_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN persons per ON per.id = p.person_id
      WHERE per.auth_uid = auth.uid()
        AND p.system_role IN ('system_admin', 'system_operator')
    )
  );

CREATE POLICY "account_modules_select" ON account_modules FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "account_modules_modify" ON account_modules FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "custom_action_types_select" ON custom_action_types FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "custom_action_types_modify" ON custom_action_types FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "pack_activations_select" ON pack_activations FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));
CREATE POLICY "pack_activations_modify" ON pack_activations FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- Config packs and registries are readable by all authenticated users
CREATE POLICY "config_packs_select" ON config_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY "entity_type_reg_select" ON entity_type_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "item_type_reg_select" ON item_type_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "action_type_reg_select" ON action_type_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "integration_defs_select" ON integration_definitions FOR SELECT TO authenticated USING (true);

-- Enable RLS on registries and integration_definitions (read-only to all authenticated)
ALTER TABLE entity_type_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_type_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_type_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_definitions ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════
-- SECURITY LOCKDOWN — revoke direct PostgREST access
-- ══════════════════════════════════════════════════════════════════════

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Re-grant SELECT through RLS policies (the REVOKE above removes the base grant,
-- but RLS policies + GRANT SELECT allow controlled access)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_account_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_person_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_admin_account_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_embeddings(text, int, uuid) TO authenticated;

-- Fix mutable search_path on functions
ALTER FUNCTION public.match_embeddings(text, int, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- Move extensions out of public schema
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
