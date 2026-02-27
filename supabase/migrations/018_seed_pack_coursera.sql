-- 018: Coursera Pack — v2 schema (items, views, apps)
-- Pack ID: 00000000-0000-0000-0001-000000000004

-- ── Workflow: Course Lifecycle ────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, public_config, is_active, pack_id, ownership)
VALUES ('00000000-0000-0000-1004-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Course Lifecycle', 'Manage courses from creation to completion',
        '{"enabled":true,"listing_title":"Course Catalog","visible_fields":["title","description"]}'::jsonb,
        false, '00000000-0000-0000-0001-000000000004', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000001', 'Draft',           0, true,  false, false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000001', 'Open Enrollment', 1, false, false, true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000012', '00000000-0000-0000-1004-000000000001', 'In Session',      2, false, false, true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000013', '00000000-0000-0000-1004-000000000001', 'Grading',         3, false, false, false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000014', '00000000-0000-0000-1004-000000000001', 'Completed',       4, false, true,  false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000015', '00000000-0000-0000-1004-000000000001', 'Cancelled',       5, false, true,  false, false, '00000000-0000-0000-0001-000000000004', 'pack');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000020', '00000000-0000-0000-1004-000000000001', 'Open Enrollment', '00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000011', false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000021', '00000000-0000-0000-1004-000000000001', 'Start Session',   '00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000012', false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000022', '00000000-0000-0000-1004-000000000001', 'Begin Grading',   '00000000-0000-0000-1004-000000000012', '00000000-0000-0000-1004-000000000013', false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000023', '00000000-0000-0000-1004-000000000001', 'Complete',        '00000000-0000-0000-1004-000000000013', '00000000-0000-0000-1004-000000000014', false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000024', '00000000-0000-0000-1004-000000000001', 'Cancel',          '00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000015', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000025', '00000000-0000-0000-1004-000000000001', 'Cancel',          '00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000015', true,  false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_public, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000030', '00000000-0000-0000-0000-000000000001', 'item',   'Subject',        'edu_subject',        'select', '["Mathematics","Science","English","History","Art","Technology","Business"]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000031', '00000000-0000-0000-0000-000000000001', 'item',   'Level',          'edu_level',          'select', '["Beginner","Intermediate","Advanced"]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000032', '00000000-0000-0000-0000-000000000001', 'item',   'Max Enrollment', 'edu_max_enrollment', 'number', '[]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000033', '00000000-0000-0000-0000-000000000001', 'item',   'Start Date',     'edu_start_date',     'date',   '[]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000034', '00000000-0000-0000-0000-000000000001', 'item',   'End Date',       'edu_end_date',       'date',   '[]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000035', '00000000-0000-0000-0000-000000000001', 'item',   'Credits',        'edu_credits',        'number', '[]', true,  false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000036', '00000000-0000-0000-0000-000000000001', 'person', 'Student ID',     'edu_student_id',     'text',   '[]', false, false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000037', '00000000-0000-0000-0000-000000000001', 'person', 'Grade Level',    'edu_grade_level',    'select', '["Freshman","Sophomore","Junior","Senior","Graduate"]', false, false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000040', '00000000-0000-0000-0000-000000000001', 'Student',      'edu_student',      'person', 'item', '#22c55e', false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000041', '00000000-0000-0000-0000-000000000001', 'Instructor',   'edu_instructor',   'person', 'item', '#3b82f6', false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000042', '00000000-0000-0000-0000-000000000001', 'TA',           'edu_ta',           'person', 'item', '#8b5cf6', false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000043', '00000000-0000-0000-0000-000000000001', 'Prerequisite', 'edu_prerequisite', 'item',   'item', '#f59e0b', false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000050', '00000000-0000-0000-0000-000000000001',
 'Student Guide', 'edu-student-guide',
 '# Student Guide

## Enrolling in Courses
Browse the Course Catalog to find available courses. Courses in Open Enrollment are accepting new students.

## Course Structure
Each course has lessons organized as documents. Work through them in order and track your progress.

## Tips
- Check the course start and end dates before enrolling
- Use threads on the course to ask questions',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── View Definitions ────────────────────────────────────────────────
INSERT INTO view_definitions (id, account_id, slug, name, view_type, target_type, target_filter, config, min_role, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000080', '00000000-0000-0000-0000-000000000001',
 'edu-courses', 'Course Catalog', 'list', 'item',
 '{"workflow_definition_id":"00000000-0000-0000-1004-000000000001"}'::jsonb,
 '{"columns":["title","stage_definition_id","due_date","created_at"],"defaultSort":"created_at","pageSize":50}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000081', '00000000-0000-0000-0000-000000000001',
 'edu-course-detail', 'Course Detail', 'detail', 'item',
 '{}'::jsonb,
 '{"panels":[{"type":"workflow","position":0},{"type":"fields","position":1},{"type":"relationships","position":2},{"type":"threads","position":3,"config":{"thread_type":"discussion"}},{"type":"children","position":4},{"type":"attachments","position":5}]}'::jsonb,
 'member', false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── App Definition ──────────────────────────────────────────────────
INSERT INTO app_definitions (id, account_id, slug, name, icon, description, nav_items, default_view, min_role, integration_deps, is_active, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000090', '00000000-0000-0000-0000-000000000001',
 'education', 'Education', 'graduation-cap', 'Course management and student tracking',
 '[{"label":"Courses","icon":"book-open","route_type":"view","view_slug":"edu-courses","position":0,"min_role":"member"},{"label":"Documents","icon":"file-text","route_type":"view","view_slug":"edu-docs","position":1,"min_role":"member"}]'::jsonb,
 'edu-courses', 'member', '[]'::jsonb,
 false, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── Test Data: Items ────────────────────────────────────────────────
INSERT INTO items (id, account_id, item_type, workflow_definition_id, stage_definition_id, title, description, priority, metadata, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000060', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1004-000000000001', '00000000-0000-0000-1004-000000000011',
 'Introduction to Web Development', 'Learn HTML, CSS, and JavaScript basics', 'medium',
 '{"edu_subject":"Technology","edu_level":"Beginner","edu_max_enrollment":30,"edu_credits":3}', false, true, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000061', '00000000-0000-0000-0000-000000000001', 'task', '00000000-0000-0000-1004-000000000001', '00000000-0000-0000-1004-000000000012',
 'Data Science Fundamentals', 'Statistics, Python, and data analysis', 'medium',
 '{"edu_subject":"Science","edu_level":"Intermediate","edu_max_enrollment":25,"edu_credits":4}', false, true, '00000000-0000-0000-0001-000000000004', 'pack');

-- ── Test Data: Entity Links ─────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id, ownership) VALUES
('00000000-0000-0000-1004-000000000070', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000002', 'item', '00000000-0000-0000-1004-000000000060', 'edu_instructor', false, true, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000071', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000005', 'item', '00000000-0000-0000-1004-000000000060', 'edu_student',    false, true, '00000000-0000-0000-0001-000000000004', 'pack'),
('00000000-0000-0000-1004-000000000072', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000003', 'item', '00000000-0000-0000-1004-000000000061', 'edu_ta',         false, true, '00000000-0000-0000-0001-000000000004', 'pack');
