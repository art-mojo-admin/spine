-- 014: Seed 6 template pack definitions + shared test accounts/persons
-- Materialized entities are in 015-020 (one per pack)

DELETE FROM config_packs WHERE is_system = true;

INSERT INTO config_packs (id, name, slug, icon, category, description, is_system, pack_data) VALUES
('00000000-0000-0000-0001-000000000001', 'CRM', 'crm', 'briefcase', 'sales',
 'Sales pipeline with deal tracking, contact management, and follow-up automations.',
 true, '{"features":["Sales Pipeline workflow (6 stages)","Deal value and source tracking","Contact and company linking","Pipeline overview dashboard"]}'::jsonb),

('00000000-0000-0000-0001-000000000002', 'Support Portal', 'support-portal', 'headphones', 'service',
 'Ticket management with SLA tracking, escalation workflows, and customer communication.',
 true, '{"features":["Support Escalation workflow (5 stages)","Severity and product classification","Customer and ticket linking","Open tickets dashboard"]}'::jsonb),

('00000000-0000-0000-0001-000000000003', 'SKOOL', 'skool', 'users', 'community',
 'Community platform with discussions, events, and structured course content.',
 true, '{"features":["Community Discussions workflow","Community Events with RSVP","Course library via documents","Member engagement tracking"]}'::jsonb),

('00000000-0000-0000-0001-000000000004', 'Coursera', 'coursera', 'graduation-cap', 'education',
 'Course management with enrollment tracking, lesson hierarchies, and progress monitoring.',
 true, '{"features":["Course Lifecycle workflow","Lesson hierarchy via documents","Student/instructor/TA linking","Course catalog with enrollment stats"]}'::jsonb),

('00000000-0000-0000-0001-000000000005', 'Jira', 'jira', 'bug', 'engineering',
 'Issue tracking with sprint boards, bug management, and dependency linking.',
 true, '{"features":["Sprint Board workflow","Bug Tracker workflow","Story points and sprint fields","Dependency and blocker linking"]}'::jsonb),

('00000000-0000-0000-0001-000000000006', 'Monday', 'monday', 'layout-grid', 'operations',
 'Work management with multiple board views, timeline tracking, and team assignment.',
 true, '{"features":["Project Board workflow","Client Requests workflow","Timeline and status fields","Team workload overview"]}'::jsonb);

-- Shared test accounts (inactive, test_data)
INSERT INTO accounts (id, account_type, display_name, status, is_active, is_test_data) VALUES
('00000000-0000-0000-0002-000000000001', 'organization', 'Acme Corp',    'active', false, true),
('00000000-0000-0000-0002-000000000002', 'organization', 'Widget Co',    'active', false, true),
('00000000-0000-0000-0002-000000000003', 'organization', 'Learning Hub', 'active', false, true)
ON CONFLICT (id) DO NOTHING;

-- Shared test persons (inactive, test_data)
INSERT INTO persons (id, email, full_name, status, is_active, is_test_data) VALUES
('00000000-0000-0000-0003-000000000001', 'sam.admin@demo.spine.local',     'Sam Admin',      'active', false, true),
('00000000-0000-0000-0003-000000000002', 'jordan.mgr@demo.spine.local',    'Jordan Manager', 'active', false, true),
('00000000-0000-0000-0003-000000000003', 'alex.dev@demo.spine.local',      'Alex Dev',       'active', false, true),
('00000000-0000-0000-0003-000000000004', 'pat.ops@demo.spine.local',       'Pat Ops',        'active', false, true),
('00000000-0000-0000-0003-000000000005', 'casey.customer@demo.spine.local', 'Casey Customer', 'active', false, true)
ON CONFLICT (id) DO NOTHING;
