-- 027: Remove KB-specific tables — migrate content to items + entity_links
-- This aligns the platform with the unified object model:
--   KB articles → items (item_type: 'article')
--   Courses → items (item_type: 'course')
--   Lessons → items (item_type: 'lesson') linked to courses via entity_links
--   Enrollments → entity_links (person → course, link_type: 'enrolled')
--   Lesson completions → entity_links (person → lesson, link_type: 'completed')

-- ══════════════════════════════════════════════════════════════════════
-- STEP 1: Register new item types
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO item_type_registry (slug, label, icon, is_system) VALUES
  ('article', 'Article', 'file-text',  true),
  ('course',  'Course',  'book-open',  true),
  ('lesson',  'Lesson',  'bookmark',   true)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 2: Create a "Documents" workflow definition (template) for articles
-- Uses the template account so packs can clone it.
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO workflow_definitions (id, account_id, name, description, status, config, public_config, is_active, is_test_data, pack_id, ownership)
VALUES (
  '00000000-0000-0000-0000-000000000d01',
  '00000000-0000-0000-0000-000000000001',
  'Documents',
  'Content lifecycle: draft, review, publish, archive',
  'active',
  '{}'::jsonb,
  '{"system_workflow": true}'::jsonb,
  true, false, NULL, 'tenant'
)
ON CONFLICT (id) DO NOTHING;

-- Stage definitions for the Documents workflow
INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, config, is_active, is_test_data)
VALUES
  ('00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000d01', 'Draft',     0, true,  false, false, '{}'::jsonb, true, false),
  ('00000000-0000-0000-0000-000000000d12', '00000000-0000-0000-0000-000000000d01', 'Review',    1, false, false, false, '{}'::jsonb, true, false),
  ('00000000-0000-0000-0000-000000000d13', '00000000-0000-0000-0000-000000000d01', 'Published', 2, false, false, false, '{}'::jsonb, true, false),
  ('00000000-0000-0000-0000-000000000d14', '00000000-0000-0000-0000-000000000d01', 'Archived',  3, false, true,  false, '{}'::jsonb, true, false)
ON CONFLICT (id) DO NOTHING;

-- Transitions for the Documents workflow
INSERT INTO transition_definitions (id, workflow_definition_id, from_stage_id, to_stage_id, name, conditions, config) VALUES
  ('00000000-0000-0000-0000-000000000d21', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d11', '00000000-0000-0000-0000-000000000d12', 'Submit for Review', '[]'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000d22', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d12', '00000000-0000-0000-0000-000000000d13', 'Publish',           '[]'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000d23', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d12', '00000000-0000-0000-0000-000000000d11', 'Return to Draft',   '[]'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000d24', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d13', '00000000-0000-0000-0000-000000000d14', 'Archive',           '[]'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000d25', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d14', '00000000-0000-0000-0000-000000000d11', 'Unarchive',         '[]'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 3: Migrate knowledge_base_articles → items
-- Maps: body → metadata.body, slug → metadata.slug, category → metadata.category,
--        is_global → metadata.is_global, author_person_id → metadata.author_person_id,
--        status → stage_definition_id (draft/published/archived)
-- ══════════════════════════════════════════════════════════════════════

-- First, create the Documents workflow for each tenant account that has KB articles
-- (the template workflow above is for the template account; real tenants need their own)
INSERT INTO workflow_definitions (id, account_id, name, description, status, config, public_config, is_active, is_test_data, ownership)
SELECT
  gen_random_uuid(),
  kba.account_id,
  'Documents',
  'Content lifecycle: draft, review, publish, archive',
  'active',
  '{}'::jsonb,
  '{"system_workflow": true}'::jsonb,
  true, false, 'tenant'
FROM (SELECT DISTINCT account_id FROM knowledge_base_articles WHERE account_id != '00000000-0000-0000-0000-000000000001') kba
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_definitions wd
  WHERE wd.account_id = kba.account_id AND wd.name = 'Documents'
);

-- Create stages for each tenant's Documents workflow
-- We need to use a DO block for the dynamic FK references
DO $$
DECLARE
  wf RECORD;
  stage_draft_id uuid;
  stage_review_id uuid;
  stage_published_id uuid;
  stage_archived_id uuid;
BEGIN
  FOR wf IN
    SELECT id, account_id FROM workflow_definitions
    WHERE name = 'Documents'
      AND account_id != '00000000-0000-0000-0000-000000000001'
      AND NOT EXISTS (
        SELECT 1 FROM stage_definitions sd WHERE sd.workflow_definition_id = workflow_definitions.id
      )
  LOOP
    stage_draft_id := gen_random_uuid();
    stage_review_id := gen_random_uuid();
    stage_published_id := gen_random_uuid();
    stage_archived_id := gen_random_uuid();

    INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, config, is_active, is_test_data) VALUES
      (stage_draft_id,     wf.id, 'Draft',     0, true,  false, false, '{}'::jsonb, true, false),
      (stage_review_id,    wf.id, 'Review',    1, false, false, false, '{}'::jsonb, true, false),
      (stage_published_id, wf.id, 'Published', 2, false, false, false, '{}'::jsonb, true, false),
      (stage_archived_id,  wf.id, 'Archived',  3, false, true,  false, '{}'::jsonb, true, false);

    INSERT INTO transition_definitions (id, workflow_definition_id, from_stage_id, to_stage_id, name, conditions, config) VALUES
      (gen_random_uuid(), wf.id, stage_draft_id,     stage_review_id,    'Submit for Review', '[]'::jsonb, '{}'::jsonb),
      (gen_random_uuid(), wf.id, stage_review_id,    stage_published_id, 'Publish',           '[]'::jsonb, '{}'::jsonb),
      (gen_random_uuid(), wf.id, stage_review_id,    stage_draft_id,     'Return to Draft',   '[]'::jsonb, '{}'::jsonb),
      (gen_random_uuid(), wf.id, stage_published_id, stage_archived_id,  'Archive',           '[]'::jsonb, '{}'::jsonb),
      (gen_random_uuid(), wf.id, stage_archived_id,  stage_draft_id,     'Unarchive',         '[]'::jsonb, '{}'::jsonb);
  END LOOP;
END $$;

-- Now migrate KB articles to items
-- Determine item_type based on category (course articles → 'course', articles with parents → 'lesson', rest → 'article')
INSERT INTO items (
  id, account_id, item_type, workflow_definition_id, stage_definition_id,
  title, description, metadata, is_active, is_test_data, pack_id, ownership,
  created_at, updated_at
)
SELECT
  kba.id,
  kba.account_id,
  CASE
    WHEN kba.category = 'course' OR (kba.metadata->>'is_course')::boolean = true THEN 'course'
    WHEN kba.parent_article_id IS NOT NULL THEN 'lesson'
    ELSE 'article'
  END,
  wd.id,  -- workflow_definition_id
  CASE kba.status
    WHEN 'published' THEN (SELECT sd.id FROM stage_definitions sd WHERE sd.workflow_definition_id = wd.id AND sd.name = 'Published' LIMIT 1)
    WHEN 'archived'  THEN (SELECT sd.id FROM stage_definitions sd WHERE sd.workflow_definition_id = wd.id AND sd.name = 'Archived' LIMIT 1)
    ELSE                  (SELECT sd.id FROM stage_definitions sd WHERE sd.workflow_definition_id = wd.id AND sd.name = 'Draft' LIMIT 1)
  END,
  kba.title,
  NULL,  -- description (body goes in metadata)
  jsonb_build_object(
    'body', kba.body,
    'slug', kba.slug,
    'category', kba.category,
    'summary', kba.summary,
    'tags', kba.tags,
    'visibility', kba.visibility,
    'views', kba.views
  ) || COALESCE(kba.metadata, '{}'::jsonb),
  kba.is_active,
  kba.is_test_data,
  kba.pack_id,
  kba.ownership,
  kba.created_at,
  kba.updated_at
FROM knowledge_base_articles kba
JOIN workflow_definitions wd ON wd.account_id = kba.account_id AND wd.name = 'Documents'
-- Skip if already migrated (item with same ID exists)
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = kba.id);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 4: Migrate parent/child article relationships → entity_links
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO entity_links (
  id, account_id, source_type, source_id, target_type, target_id,
  link_type, metadata, is_active, is_test_data, pack_id, ownership
)
SELECT
  gen_random_uuid(),
  kba.account_id,
  'item',  -- source_type (parent article, now an item)
  kba.parent_article_id,
  'item',  -- target_type (child article, now an item)
  kba.id,
  'contains',
  jsonb_build_object(),
  kba.is_active,
  kba.is_test_data,
  kba.pack_id,
  kba.ownership
FROM knowledge_base_articles kba
WHERE kba.parent_article_id IS NOT NULL
-- Skip duplicates
AND NOT EXISTS (
  SELECT 1 FROM entity_links el
  WHERE el.account_id = kba.account_id
    AND el.source_type = 'item'
    AND el.source_id = kba.parent_article_id
    AND el.target_type = 'item'
    AND el.target_id = kba.id
    AND el.link_type = 'contains'
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 5: Migrate enrollments → entity_links (person → course item)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO entity_links (
  id, account_id, source_type, source_id, target_type, target_id,
  link_type, metadata, is_active, is_test_data, pack_id, ownership
)
SELECT
  gen_random_uuid(),
  e.account_id,
  'person',
  e.person_id,
  'item',
  e.course_id,
  'enrolled',
  jsonb_build_object(
    'enrolled_at', e.enrolled_at,
    'completed_at', e.completed_at,
    'status', e.status
  ) || COALESCE(e.metadata, '{}'::jsonb),
  e.is_active,
  e.is_test_data,
  e.pack_id,
  e.ownership
FROM enrollments e
WHERE NOT EXISTS (
  SELECT 1 FROM entity_links el
  WHERE el.account_id = e.account_id
    AND el.source_type = 'person'
    AND el.source_id = e.person_id
    AND el.target_type = 'item'
    AND el.target_id = e.course_id
    AND el.link_type = 'enrolled'
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 6: Migrate lesson_completions → entity_links (person → lesson item)
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO entity_links (
  id, account_id, source_type, source_id, target_type, target_id,
  link_type, metadata, is_active, is_test_data, pack_id, ownership
)
SELECT
  gen_random_uuid(),
  lc.account_id,
  'person',
  lc.person_id,
  'item',
  lc.article_id,
  'completed',
  jsonb_build_object('completed_at', lc.completed_at) || COALESCE(lc.metadata, '{}'::jsonb),
  lc.is_active,
  lc.is_test_data,
  lc.pack_id,
  lc.ownership
FROM lesson_completions lc
WHERE NOT EXISTS (
  SELECT 1 FROM entity_links el
  WHERE el.account_id = lc.account_id
    AND el.source_type = 'person'
    AND el.source_id = lc.person_id
    AND el.target_type = 'item'
    AND el.target_id = lc.article_id
    AND el.link_type = 'completed'
);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 7: Update embeddings referencing kb_article → item
-- ══════════════════════════════════════════════════════════════════════
UPDATE embeddings SET entity_type = 'item' WHERE entity_type = 'kb_article';

-- ══════════════════════════════════════════════════════════════════════
-- STEP 8: Update pack seed references — change KB article inserts in
-- Support and CRM packs to items (for future pack installs)
-- The existing seeded KB articles are already migrated above.
-- ══════════════════════════════════════════════════════════════════════

-- Support pack: migrate template KB article to item
INSERT INTO items (
  id, account_id, item_type, workflow_definition_id, stage_definition_id,
  title, description, metadata, is_active, is_test_data, pack_id, ownership
)
SELECT
  kba.id,
  kba.account_id,
  'article',
  '00000000-0000-0000-0000-000000000d01',
  '00000000-0000-0000-0000-000000000d13', -- Published stage
  kba.title,
  NULL,
  jsonb_build_object('body', kba.body, 'slug', kba.slug, 'category', kba.category, 'summary', kba.summary, 'tags', kba.tags, 'visibility', kba.visibility, 'views', kba.views),
  kba.is_active, kba.is_test_data, kba.pack_id, kba.ownership
FROM knowledge_base_articles kba
WHERE kba.account_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM items i WHERE i.id = kba.id);

-- ══════════════════════════════════════════════════════════════════════
-- STEP 9: Seed view definitions for documents
-- ══════════════════════════════════════════════════════════════════════
-- These are template-level views for the Documents workflow
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, ownership) VALUES
('00000000-0000-0000-0000-000000000da1', '00000000-0000-0000-0000-000000000001',
 'documents', 'Documents', 'list', 'item',
 '{"item_type":"article"}'::jsonb,
 '{"columns":["title","priority","stage_definition_id","created_at"],"defaultSort":"updated_at","pageSize":50}'::jsonb,
 'member', true, 'tenant'),
('00000000-0000-0000-0000-000000000da2', '00000000-0000-0000-0000-000000000001',
 'courses', 'Courses', 'list', 'item',
 '{"item_type":"course"}'::jsonb,
 '{"columns":["title","stage_definition_id","created_at"],"defaultSort":"updated_at","pageSize":50}'::jsonb,
 'member', true, 'tenant')
ON CONFLICT (account_id, slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- STEP 10: Drop the old tables (order matters for FKs)
-- ══════════════════════════════════════════════════════════════════════

-- Drop RLS policies first
DROP POLICY IF EXISTS "lesson_completions_select" ON lesson_completions;
DROP POLICY IF EXISTS "lesson_completions_modify" ON lesson_completions;
DROP POLICY IF EXISTS "enrollments_select" ON enrollments;
DROP POLICY IF EXISTS "enrollments_modify" ON enrollments;
DROP POLICY IF EXISTS "kb_articles_select" ON knowledge_base_articles;
DROP POLICY IF EXISTS "kb_articles_modify" ON knowledge_base_articles;

-- Drop FK constraints from 011_packs
ALTER TABLE knowledge_base_articles DROP CONSTRAINT IF EXISTS fk_kb_articles_pack;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_pack;

-- Drop the tables (child tables first)
DROP TABLE IF EXISTS lesson_completions CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS knowledge_base_articles CASCADE;

-- ══════════════════════════════════════════════════════════════════════
-- DONE. knowledge_base_articles, enrollments, and lesson_completions
-- are now gone. All content lives in items + entity_links.
-- ══════════════════════════════════════════════════════════════════════
