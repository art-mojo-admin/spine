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

-- See seed-manual-data.sql for INSERT statements
-- Articles are inserted with is_global=true, owned by Default Organization
-- account_id = (SELECT id FROM accounts WHERE display_name = 'Default Organization')
-- author_person_id = (SELECT id FROM persons WHERE email = 'kpettit851@gmail.com')
-- Categories: getting-started, core-features, workflows, tickets, knowledge-base, admin, integrations, extensibility
-- 22 articles total covering the full Spine user manual
