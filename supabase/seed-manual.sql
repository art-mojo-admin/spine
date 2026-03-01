-- Spine User Manual — Global KB Articles
-- Author: Kerry Pettit (kpettit851@gmail.com) | system_admin
-- Owned by Default Organization, is_global=true so visible to ALL accounts
-- Run after main seed.sql

-- Ensure Kerry is system_admin
UPDATE profiles SET system_role = 'system_admin'
WHERE person_id = (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com');

-- Remove old manual articles
DELETE FROM knowledge_base_articles
  WHERE is_global = true;

-- Manual seed helpers
-- 1) Reset tenant-level pack installs (keeps template catalog intact)
DELETE FROM pack_entity_mappings WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2';
DELETE FROM pack_activations WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2';
DELETE FROM audit_log WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2';
DELETE FROM activity_events WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2';
DELETE FROM workflow_definitions WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM view_definitions WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM app_definitions WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM custom_field_definitions WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM link_type_definitions WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM items WHERE account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2' AND ownership = 'tenant';
DELETE FROM tenant_settings WHERE tenant_account_id = 'cd74879c-3bfa-4dce-9bbd-67b31eaa23e2';

-- 2) Re-seed system template catalog (base + expanded packs)
\i supabase/migrations/014_seed_template_packs.sql
\i supabase/migrations/015_seed_pack_support.sql
\i supabase/migrations/016_seed_pack_crm.sql
\i supabase/migrations/021_pack_sales_expanded.sql
\i supabase/migrations/022_pack_support_csm_expanded.sql
\i supabase/migrations/023_pack_operations.sql
\i supabase/migrations/024_pack_marketing.sql

-- See seed-manual-data.sql for INSERT statements
-- Articles are inserted with is_global=true, owned by Default Organization
-- account_id = (SELECT id FROM accounts WHERE display_name = 'Default Organization')
-- author_person_id = (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com')
-- Categories: getting-started, core-features, workflows, tickets, knowledge-base, admin, integrations, extensibility
-- 22 articles total covering the full Spine user manual
