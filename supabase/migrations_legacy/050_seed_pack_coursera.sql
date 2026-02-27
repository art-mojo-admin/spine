-- 050: Coursera Pack — materialized entities (all inactive)
-- Pack ID: 00000000-0000-0000-0001-000000000004

-- ── Workflow: Course Lifecycle ────────────────────────────────────────
INSERT INTO workflow_definitions (id, account_id, name, description, public_config, is_active, pack_id)
VALUES ('00000000-0000-0000-1004-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'Course Lifecycle', 'Manage courses from creation to completion',
        '{"enabled":true,"listing_title":"Course Catalog","visible_fields":["title","description"]}'::jsonb,
        false, '00000000-0000-0000-0001-000000000004');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, is_terminal, is_public, is_active, pack_id) VALUES
('00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000001', 'Draft',           0, true,  false, false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000001', 'Open Enrollment', 1, false, false, true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000012', '00000000-0000-0000-1004-000000000001', 'In Session',      2, false, false, true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000013', '00000000-0000-0000-1004-000000000001', 'Grading',         3, false, false, false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000014', '00000000-0000-0000-1004-000000000001', 'Completed',       4, false, true,  false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000015', '00000000-0000-0000-1004-000000000001', 'Cancelled',       5, false, true,  false, false, '00000000-0000-0000-0001-000000000004');

INSERT INTO transition_definitions (id, workflow_definition_id, name, from_stage_id, to_stage_id, require_comment, is_active, pack_id) VALUES
('00000000-0000-0000-1004-000000000020', '00000000-0000-0000-1004-000000000001', 'Open Enrollment', '00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000011', false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000021', '00000000-0000-0000-1004-000000000001', 'Start Session',   '00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000012', false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000022', '00000000-0000-0000-1004-000000000001', 'Begin Grading',   '00000000-0000-0000-1004-000000000012', '00000000-0000-0000-1004-000000000013', false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000023', '00000000-0000-0000-1004-000000000001', 'Complete',        '00000000-0000-0000-1004-000000000013', '00000000-0000-0000-1004-000000000014', false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000024', '00000000-0000-0000-1004-000000000001', 'Cancel',          '00000000-0000-0000-1004-000000000010', '00000000-0000-0000-1004-000000000015', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000025', '00000000-0000-0000-1004-000000000001', 'Cancel',          '00000000-0000-0000-1004-000000000011', '00000000-0000-0000-1004-000000000015', true,  false, '00000000-0000-0000-0001-000000000004');

-- ── Custom Fields ─────────────────────────────────────────────────────
INSERT INTO custom_field_definitions (id, account_id, entity_type, name, field_key, field_type, options, is_public, is_active, pack_id) VALUES
('00000000-0000-0000-1004-000000000030', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Subject',        'edu_subject',        'select', '["Mathematics","Science","English","History","Art","Technology","Business"]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000031', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Level',          'edu_level',          'select', '["Beginner","Intermediate","Advanced"]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000032', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Max Enrollment', 'edu_max_enrollment', 'number', '[]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000033', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Start Date',     'edu_start_date',     'date',   '[]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000034', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'End Date',       'edu_end_date',       'date',   '[]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000035', '00000000-0000-0000-0000-000000000001', 'workflow_item', 'Credits',        'edu_credits',        'number', '[]', true,  false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000036', '00000000-0000-0000-0000-000000000001', 'person',        'Student ID',     'edu_student_id',     'text',   '[]', false, false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000037', '00000000-0000-0000-0000-000000000001', 'person',        'Grade Level',    'edu_grade_level',    'select', '["Freshman","Sophomore","Junior","Senior","Graduate"]', false, false, '00000000-0000-0000-0001-000000000004');

-- ── Link Types ────────────────────────────────────────────────────────
INSERT INTO link_type_definitions (id, account_id, name, slug, source_entity_type, target_entity_type, color, is_active, pack_id) VALUES
('00000000-0000-0000-1004-000000000040', '00000000-0000-0000-0000-000000000001', 'Student',      'edu_student',      'person',        'workflow_item', '#22c55e', false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000041', '00000000-0000-0000-0000-000000000001', 'Instructor',   'edu_instructor',   'person',        'workflow_item', '#3b82f6', false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000042', '00000000-0000-0000-0000-000000000001', 'TA',           'edu_ta',           'person',        'workflow_item', '#8b5cf6', false, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000043', '00000000-0000-0000-0000-000000000001', 'Prerequisite', 'edu_prerequisite', 'workflow_item', 'workflow_item', '#f59e0b', false, '00000000-0000-0000-0001-000000000004');

-- ── Docs ──────────────────────────────────────────────────────────────
INSERT INTO knowledge_base_articles (id, account_id, title, slug, body, status, category, is_active, pack_id) VALUES
('00000000-0000-0000-1004-000000000050', '00000000-0000-0000-0000-000000000001',
 'Student Guide', 'edu-student-guide',
 '# Student Guide

## Enrolling in Courses
Browse the Course Catalog to find available courses. Courses in Open Enrollment are accepting new students.

## Course Structure
Each course has lessons organized as documents. Work through them in order and track your progress.

## Tips
- Check the course start and end dates before enrolling
- Contact the instructor via comments if you have questions',
 'published', 'guide', false, '00000000-0000-0000-0001-000000000004'),

('00000000-0000-0000-1004-000000000051', '00000000-0000-0000-0000-000000000001',
 'Course Admin Guide', 'edu-admin-guide',
 '# Course Admin Guide

## Creating Courses
1. Create a new workflow item in the Course Lifecycle workflow
2. Add course details (subject, level, dates, credits)
3. Create lesson documents as children of a parent course document
4. Move to Open Enrollment when ready

## Managing Students
- Link students to courses using the Student link type
- Track enrollment and completion through the workflow stages
- Assign instructors and TAs via link types',
 'published', 'admin-guide', false, '00000000-0000-0000-0001-000000000004');

-- ── Test Data: Workflow Items ─────────────────────────────────────────
INSERT INTO workflow_items (id, account_id, workflow_definition_id, stage_definition_id, workflow_type, title, description, priority, metadata, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1004-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1004-000000000001', '00000000-0000-0000-1004-000000000011', 'Course Lifecycle',
 'Introduction to Web Development', 'Learn HTML, CSS, and JavaScript basics', 'medium',
 '{"edu_subject":"Technology","edu_level":"Beginner","edu_max_enrollment":30,"edu_credits":3}', false, true, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000061', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-1004-000000000001', '00000000-0000-0000-1004-000000000012', 'Course Lifecycle',
 'Data Science Fundamentals', 'Statistics, Python, and data analysis', 'medium',
 '{"edu_subject":"Science","edu_level":"Intermediate","edu_max_enrollment":25,"edu_credits":4}', false, true, '00000000-0000-0000-0001-000000000004');

-- ── Test Data: Entity Links ───────────────────────────────────────────
INSERT INTO entity_links (id, account_id, source_type, source_id, target_type, target_id, link_type, is_active, is_test_data, pack_id) VALUES
('00000000-0000-0000-1004-000000000070', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000002', 'workflow_item', '00000000-0000-0000-1004-000000000060', 'edu_instructor', false, true, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000071', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000005', 'workflow_item', '00000000-0000-0000-1004-000000000060', 'edu_student',    false, true, '00000000-0000-0000-0001-000000000004'),
('00000000-0000-0000-1004-000000000072', '00000000-0000-0000-0000-000000000001', 'person', '00000000-0000-0000-0003-000000000003', 'workflow_item', '00000000-0000-0000-1004-000000000061', 'edu_ta',         false, true, '00000000-0000-0000-0001-000000000004');
