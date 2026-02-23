-- 031_rls_policies.sql
-- Defense-in-depth RLS policies for all public tables.
-- Netlify functions use service_role (bypasses RLS), so these policies
-- only apply to direct PostgREST access via anon/authenticated keys.
-- With grants revoked (030), these are a second safety net.

-- ── Helper: reusable function to check account membership ─────────────
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

-- ══════════════════════════════════════════════════════════════════════
-- TENANT-SCOPED TABLES (have account_id column)
-- Pattern: read if member, write if admin/operator
-- ══════════════════════════════════════════════════════════════════════

-- ── accounts ──────────────────────────────────────────────────────────
CREATE POLICY "accounts_select" ON accounts FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_account_ids()));

CREATE POLICY "accounts_update" ON accounts FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_admin_account_ids()));

-- ── workflow_definitions ──────────────────────────────────────────────
CREATE POLICY "wf_defs_select" ON workflow_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "wf_defs_modify" ON workflow_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── stage_definitions ─────────────────────────────────────────────────
CREATE POLICY "stage_defs_select" ON stage_definitions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));

CREATE POLICY "stage_defs_modify" ON stage_definitions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── transition_definitions ────────────────────────────────────────────
CREATE POLICY "trans_defs_select" ON transition_definitions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));

CREATE POLICY "trans_defs_modify" ON transition_definitions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── workflow_actions ──────────────────────────────────────────────────
CREATE POLICY "wf_actions_select" ON workflow_actions FOR SELECT TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_account_ids())
  ));

CREATE POLICY "wf_actions_modify" ON workflow_actions FOR ALL TO authenticated
  USING (workflow_definition_id IN (
    SELECT id FROM workflow_definitions WHERE account_id IN (SELECT public.user_admin_account_ids())
  ));

-- ── workflow_items ────────────────────────────────────────────────────
CREATE POLICY "wf_items_select" ON workflow_items FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "wf_items_insert" ON workflow_items FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "wf_items_update" ON workflow_items FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── automation_rules ──────────────────────────────────────────────────
CREATE POLICY "auto_rules_select" ON automation_rules FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "auto_rules_modify" ON automation_rules FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── tickets ───────────────────────────────────────────────────────────
CREATE POLICY "tickets_select" ON tickets FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "tickets_insert" ON tickets FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "tickets_update" ON tickets FOR UPDATE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── ticket_messages ───────────────────────────────────────────────────
CREATE POLICY "ticket_msgs_select" ON ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (
    SELECT id FROM tickets WHERE account_id IN (SELECT public.user_account_ids())
  ));

CREATE POLICY "ticket_msgs_insert" ON ticket_messages FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (
    SELECT id FROM tickets WHERE account_id IN (SELECT public.user_account_ids())
  ));

-- ── knowledge_base_articles ───────────────────────────────────────────
CREATE POLICY "kb_select" ON knowledge_base_articles FOR SELECT TO authenticated
  USING (
    account_id IN (SELECT public.user_account_ids())
    OR is_global = true
  );

CREATE POLICY "kb_modify" ON knowledge_base_articles FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── tenant_themes ─────────────────────────────────────────────────────
CREATE POLICY "themes_select" ON tenant_themes FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "themes_modify" ON tenant_themes FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── custom_field_definitions ──────────────────────────────────────────
CREATE POLICY "cfd_select" ON custom_field_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "cfd_modify" ON custom_field_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── entity_links ──────────────────────────────────────────────────────
CREATE POLICY "elinks_select" ON entity_links FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "elinks_insert" ON entity_links FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "elinks_delete" ON entity_links FOR DELETE TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── link_type_definitions ─────────────────────────────────────────────
CREATE POLICY "ltdefs_select" ON link_type_definitions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "ltdefs_modify" ON link_type_definitions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── embeddings ────────────────────────────────────────────────────────
CREATE POLICY "embed_select" ON embeddings FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── account_modules ───────────────────────────────────────────────────
CREATE POLICY "modules_select" ON account_modules FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "modules_modify" ON account_modules FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── custom_action_types ───────────────────────────────────────────────
CREATE POLICY "cat_select" ON custom_action_types FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "cat_modify" ON custom_action_types FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── nav_extensions ────────────────────────────────────────────────────
CREATE POLICY "navext_select" ON nav_extensions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "navext_modify" ON nav_extensions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── webhook_subscriptions ─────────────────────────────────────────────
CREATE POLICY "webhooksub_select" ON webhook_subscriptions FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "webhooksub_modify" ON webhook_subscriptions FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── outbox_events ─────────────────────────────────────────────────────
CREATE POLICY "outbox_select" ON outbox_events FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── webhook_deliveries (join through subscription) ────────────────────
CREATE POLICY "whdeliv_select" ON webhook_deliveries FOR SELECT TO authenticated
  USING (webhook_subscription_id IN (
    SELECT id FROM webhook_subscriptions WHERE account_id IN (SELECT public.user_account_ids())
  ));

-- ── scheduled_triggers ────────────────────────────────────────────────
CREATE POLICY "schtrig_select" ON scheduled_triggers FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "schtrig_modify" ON scheduled_triggers FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── scheduled_trigger_instances ───────────────────────────────────────
CREATE POLICY "schtrigi_select" ON scheduled_trigger_instances FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── inbound_webhook_mappings ──────────────────────────────────────────
CREATE POLICY "iwm_select" ON inbound_webhook_mappings FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "iwm_modify" ON inbound_webhook_mappings FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ══════════════════════════════════════════════════════════════════════
-- SENSITIVE / SERVICE-ONLY TABLES — deny all via PostgREST
-- (RLS enabled + no policies = zero rows for anon/authenticated)
-- ══════════════════════════════════════════════════════════════════════

-- inbound_webhook_keys: contains plaintext API keys — no PostgREST access
-- impersonation_sessions: admin-only, service_role only
-- (No policies created = fully blocked)

-- ══════════════════════════════════════════════════════════════════════
-- IDENTITY TABLES (no account_id — scoped differently)
-- ══════════════════════════════════════════════════════════════════════

-- ── persons ───────────────────────────────────────────────────────────
-- Users can read their own record + co-members in shared accounts
CREATE POLICY "persons_select_own" ON persons FOR SELECT TO authenticated
  USING (
    auth_uid = auth.uid()
    OR id IN (
      SELECT m2.person_id FROM memberships m2
      WHERE m2.account_id IN (SELECT public.user_account_ids())
        AND m2.status = 'active'
    )
  );

CREATE POLICY "persons_update_own" ON persons FOR UPDATE TO authenticated
  USING (auth_uid = auth.uid());

-- ── profiles ──────────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (
    person_id = public.user_person_id()
    OR person_id IN (
      SELECT m2.person_id FROM memberships m2
      WHERE m2.account_id IN (SELECT public.user_account_ids())
        AND m2.status = 'active'
    )
  );

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (person_id = public.user_person_id());

-- ── memberships ───────────────────────────────────────────────────────
CREATE POLICY "memberships_select" ON memberships FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

CREATE POLICY "memberships_modify" ON memberships FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── invites ───────────────────────────────────────────────────────────
CREATE POLICY "invites_select" ON invites FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

CREATE POLICY "invites_modify" ON invites FOR ALL TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ══════════════════════════════════════════════════════════════════════
-- READ-ONLY TABLES
-- ══════════════════════════════════════════════════════════════════════

-- ── audit_log ─────────────────────────────────────────────────────────
CREATE POLICY "audit_select" ON audit_log FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_admin_account_ids()));

-- ── activity_events ───────────────────────────────────────────────────
CREATE POLICY "activity_select" ON activity_events FOR SELECT TO authenticated
  USING (account_id IN (SELECT public.user_account_ids()));

-- ── config_packs ──────────────────────────────────────────────────────
CREATE POLICY "packs_select" ON config_packs FOR SELECT TO authenticated
  USING (true);
