-- Expanded template packs: additional scenario-based configurations
-- These supplement the 4 built-in packs from seed-config-packs.sql

INSERT INTO config_packs (name, description, is_system, pack_data) VALUES

-- Project Management Pack
('Project Management Pack', 'Agile-friendly task and project tracking with sprints, priorities, and dependency links.', true, '{
  "workflows": [{
    "name": "Project Delivery",
    "description": "Track tasks from backlog to completion",
    "stages": [
      {"_ref": "backlog", "name": "Backlog", "position": 0, "is_initial": true},
      {"_ref": "planning", "name": "Planning", "position": 1},
      {"_ref": "in_progress", "name": "In Progress", "position": 2},
      {"_ref": "review", "name": "Review", "position": 3},
      {"_ref": "done", "name": "Done", "position": 4, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Plan", "_from_ref": "backlog", "_to_ref": "planning"},
      {"name": "Start Work", "_from_ref": "planning", "_to_ref": "in_progress"},
      {"name": "Submit for Review", "_from_ref": "in_progress", "_to_ref": "review"},
      {"name": "Approve", "_from_ref": "review", "_to_ref": "done"},
      {"name": "Request Changes", "_from_ref": "review", "_to_ref": "in_progress", "require_comment": true},
      {"name": "Back to Backlog", "_from_ref": "planning", "_to_ref": "backlog"},
      {"name": "Cancel", "_from_ref": "backlog", "_to_ref": "cancelled"},
      {"name": "Cancel", "_from_ref": "planning", "_to_ref": "cancelled"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Priority", "field_key": "priority", "field_type": "select", "options": ["Critical", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Estimated Hours", "field_key": "estimated_hours", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Sprint", "field_key": "sprint", "field_type": "text"},
    {"entity_type": "workflow_item", "name": "Story Points", "field_key": "story_points", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Task Type", "field_key": "task_type", "field_type": "select", "options": ["Feature", "Bug", "Chore", "Spike", "Epic"]},
    {"entity_type": "person", "name": "Team", "field_key": "team", "field_type": "select", "options": ["Engineering", "Design", "QA", "DevOps", "Product"]}
  ],
  "link_types": [
    {"name": "Depends On", "slug": "depends_on", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#ef4444"},
    {"name": "Blocks", "slug": "blocks", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f97316"},
    {"name": "Sub-task", "slug": "subtask", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#6366f1"},
    {"name": "Assignee", "slug": "assignee", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"}
  ],
  "automations": [
    {"name": "Notify on Review", "description": "Send webhook when item enters Review", "trigger_event": "workflow_item.stage_changed", "conditions": [{"field": "new_stage_name", "op": "eq", "value": "Review"}], "action_type": "webhook", "action_config": {"url": "{{REVIEW_WEBHOOK_URL}}", "method": "POST"}}
  ]
}'::jsonb),

-- Real Estate Pack
('Real Estate Pack', 'Property listing and deal management with public MLS-style listings, buyer/seller tracking, and deal stages.', true, '{
  "workflows": [{
    "name": "Property Listing",
    "description": "Manage properties from listing to close",
    "public_config": {"enabled": true, "listing_title": "Available Properties", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "draft", "name": "Draft", "position": 0, "is_initial": true},
      {"_ref": "active", "name": "Active", "position": 1, "is_public": true},
      {"_ref": "under_contract", "name": "Under Contract", "position": 2, "is_public": true},
      {"_ref": "pending", "name": "Pending", "position": 3},
      {"_ref": "sold", "name": "Sold", "position": 4, "is_terminal": true},
      {"_ref": "withdrawn", "name": "Withdrawn", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Publish", "_from_ref": "draft", "_to_ref": "active"},
      {"name": "Accept Offer", "_from_ref": "active", "_to_ref": "under_contract"},
      {"name": "Move to Pending", "_from_ref": "under_contract", "_to_ref": "pending"},
      {"name": "Close Sale", "_from_ref": "pending", "_to_ref": "sold", "require_comment": true},
      {"name": "Back to Active", "_from_ref": "under_contract", "_to_ref": "active"},
      {"name": "Withdraw", "_from_ref": "active", "_to_ref": "withdrawn", "require_comment": true},
      {"name": "Withdraw", "_from_ref": "draft", "_to_ref": "withdrawn"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Price", "field_key": "price", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Bedrooms", "field_key": "bedrooms", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Bathrooms", "field_key": "bathrooms", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Square Footage", "field_key": "sqft", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Property Type", "field_key": "property_type", "field_type": "select", "options": ["Single Family", "Condo", "Townhouse", "Multi-Family", "Land", "Commercial"], "is_public": true},
    {"entity_type": "workflow_item", "name": "MLS Number", "field_key": "mls_number", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Year Built", "field_key": "year_built", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Address", "field_key": "address", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "License Number", "field_key": "license_number", "field_type": "text"},
    {"entity_type": "person", "name": "Brokerage", "field_key": "brokerage", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Buyer", "slug": "buyer", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#22c55e"},
    {"name": "Seller", "slug": "seller", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f59e0b"},
    {"name": "Listing Agent", "slug": "listing_agent", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Buying Agent", "slug": "buying_agent", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"}
  ],
  "automations": []
}'::jsonb),

-- Nonprofit / Volunteer Pack
('Nonprofit & Volunteer Pack', 'Volunteer onboarding, program management, and hour tracking for nonprofits and community organizations.', true, '{
  "workflows": [{
    "name": "Volunteer Onboarding",
    "description": "Track volunteers from application to active status",
    "stages": [
      {"_ref": "applied", "name": "Applied", "position": 0, "is_initial": true},
      {"_ref": "screening", "name": "Screening", "position": 1},
      {"_ref": "orientation", "name": "Orientation", "position": 2},
      {"_ref": "active", "name": "Active", "position": 3},
      {"_ref": "inactive", "name": "Inactive", "position": 4, "is_terminal": true},
      {"_ref": "declined", "name": "Declined", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Screen", "_from_ref": "applied", "_to_ref": "screening"},
      {"name": "Schedule Orientation", "_from_ref": "screening", "_to_ref": "orientation"},
      {"name": "Activate", "_from_ref": "orientation", "_to_ref": "active"},
      {"name": "Deactivate", "_from_ref": "active", "_to_ref": "inactive", "require_comment": true},
      {"name": "Reactivate", "_from_ref": "inactive", "_to_ref": "active"},
      {"name": "Decline", "_from_ref": "screening", "_to_ref": "declined", "require_comment": true}
    ]
  },
  {
    "name": "Program Cycle",
    "description": "Manage program delivery from planning to completion",
    "public_config": {"enabled": true, "listing_title": "Our Programs", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "planning", "name": "Planning", "position": 0, "is_initial": true},
      {"_ref": "recruiting", "name": "Recruiting Volunteers", "position": 1, "is_public": true},
      {"_ref": "running", "name": "Running", "position": 2, "is_public": true},
      {"_ref": "completed", "name": "Completed", "position": 3, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Open Recruiting", "_from_ref": "planning", "_to_ref": "recruiting"},
      {"name": "Launch", "_from_ref": "recruiting", "_to_ref": "running"},
      {"name": "Complete", "_from_ref": "running", "_to_ref": "completed", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Availability", "field_key": "availability", "field_type": "multi_select", "options": ["Weekday Mornings", "Weekday Afternoons", "Weekday Evenings", "Weekends", "Flexible"]},
    {"entity_type": "person", "name": "Skills", "field_key": "volunteer_skills", "field_type": "multi_select", "options": ["Teaching", "Cooking", "Driving", "Admin", "Fundraising", "Construction", "Medical", "Legal", "IT"]},
    {"entity_type": "person", "name": "Background Check", "field_key": "background_check", "field_type": "select", "options": ["Not Started", "Pending", "Cleared", "Failed"]},
    {"entity_type": "person", "name": "Hours Logged", "field_key": "hours_logged", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Program Area", "field_key": "program_area", "field_type": "select", "options": ["Education", "Health", "Environment", "Community", "Arts", "Youth"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Volunteers Needed", "field_key": "volunteers_needed", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Start Date", "field_key": "start_date", "field_type": "date", "is_public": true}
  ],
  "link_types": [
    {"name": "Volunteer", "slug": "volunteer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Program Coordinator", "slug": "program_coordinator", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"},
    {"name": "Beneficiary", "slug": "beneficiary", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f59e0b"},
    {"name": "Mentor", "slug": "mentor", "source_entity_type": "person", "target_entity_type": "person", "color": "#6366f1"}
  ],
  "automations": []
}'::jsonb),

-- IT Service Desk Pack
('IT Service Desk Pack', 'ITIL-aligned incident and change management with escalation, SLA tracking, and resolution workflows.', true, '{
  "workflows": [{
    "name": "Incident Management",
    "description": "Track and resolve IT incidents",
    "stages": [
      {"_ref": "reported", "name": "Reported", "position": 0, "is_initial": true},
      {"_ref": "investigating", "name": "Investigating", "position": 1},
      {"_ref": "implementing", "name": "Implementing Fix", "position": 2},
      {"_ref": "testing", "name": "Testing", "position": 3},
      {"_ref": "resolved", "name": "Resolved", "position": 4},
      {"_ref": "closed", "name": "Closed", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Investigate", "_from_ref": "reported", "_to_ref": "investigating"},
      {"name": "Implement Fix", "_from_ref": "investigating", "_to_ref": "implementing"},
      {"name": "Test Fix", "_from_ref": "implementing", "_to_ref": "testing"},
      {"name": "Resolve", "_from_ref": "testing", "_to_ref": "resolved"},
      {"name": "Reopen", "_from_ref": "resolved", "_to_ref": "investigating", "require_comment": true},
      {"name": "Close", "_from_ref": "resolved", "_to_ref": "closed"},
      {"name": "Escalate", "_from_ref": "investigating", "_to_ref": "implementing", "require_comment": true}
    ]
  },
  {
    "name": "Change Request",
    "description": "Manage IT change requests through approval and implementation",
    "stages": [
      {"_ref": "submitted", "name": "Submitted", "position": 0, "is_initial": true},
      {"_ref": "review", "name": "Under Review", "position": 1},
      {"_ref": "approved", "name": "Approved", "position": 2},
      {"_ref": "scheduled", "name": "Scheduled", "position": 3},
      {"_ref": "implemented", "name": "Implemented", "position": 4},
      {"_ref": "verified", "name": "Verified", "position": 5, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Review", "_from_ref": "submitted", "_to_ref": "review"},
      {"name": "Approve", "_from_ref": "review", "_to_ref": "approved", "require_comment": true},
      {"name": "Reject", "_from_ref": "review", "_to_ref": "rejected", "require_comment": true},
      {"name": "Schedule", "_from_ref": "approved", "_to_ref": "scheduled"},
      {"name": "Implement", "_from_ref": "scheduled", "_to_ref": "implemented"},
      {"name": "Verify", "_from_ref": "implemented", "_to_ref": "verified", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Impact", "field_key": "impact", "field_type": "select", "options": ["Critical", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Urgency", "field_key": "urgency", "field_type": "select", "options": ["Immediate", "High", "Medium", "Low"]},
    {"entity_type": "workflow_item", "name": "Affected System", "field_key": "affected_system", "field_type": "select", "options": ["Email", "Network", "Database", "Application", "Hardware", "Security", "Cloud Infrastructure"]},
    {"entity_type": "workflow_item", "name": "Resolution Category", "field_key": "resolution_category", "field_type": "select", "options": ["Configuration", "Code Fix", "Hardware Replacement", "Workaround", "Vendor Patch", "User Training"]},
    {"entity_type": "workflow_item", "name": "Change Type", "field_key": "change_type", "field_type": "select", "options": ["Standard", "Normal", "Emergency"]},
    {"entity_type": "workflow_item", "name": "Downtime Required", "field_key": "downtime_required", "field_type": "checkbox"},
    {"entity_type": "workflow_item", "name": "Rollback Plan", "field_key": "rollback_plan", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Related Incident", "slug": "related_incident", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#ef4444"},
    {"name": "Change Request", "slug": "change_request", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Affected User", "slug": "affected_user", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f59e0b"},
    {"name": "Assigned Engineer", "slug": "assigned_engineer", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"}
  ],
  "automations": [
    {"name": "Auto-escalate Critical", "description": "Send webhook when a critical incident is reported", "trigger_event": "workflow_item.created", "conditions": [], "action_type": "webhook", "action_config": {"url": "{{ESCALATION_WEBHOOK_URL}}", "method": "POST"}}
  ]
}'::jsonb),

-- Education / Course Pack
('Education & Course Pack', 'Course management with enrollment tracking, public course catalog, student progress, and grading workflows.', true, '{
  "workflows": [{
    "name": "Course Lifecycle",
    "description": "Manage courses from creation to completion",
    "public_config": {"enabled": true, "listing_title": "Course Catalog", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "draft", "name": "Draft", "position": 0, "is_initial": true},
      {"_ref": "open_enrollment", "name": "Open Enrollment", "position": 1, "is_public": true},
      {"_ref": "in_session", "name": "In Session", "position": 2, "is_public": true},
      {"_ref": "grading", "name": "Grading", "position": 3},
      {"_ref": "completed", "name": "Completed", "position": 4, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Open Enrollment", "_from_ref": "draft", "_to_ref": "open_enrollment"},
      {"name": "Start Session", "_from_ref": "open_enrollment", "_to_ref": "in_session"},
      {"name": "Begin Grading", "_from_ref": "in_session", "_to_ref": "grading"},
      {"name": "Complete", "_from_ref": "grading", "_to_ref": "completed"},
      {"name": "Cancel", "_from_ref": "draft", "_to_ref": "cancelled"},
      {"name": "Cancel", "_from_ref": "open_enrollment", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Subject", "field_key": "subject", "field_type": "select", "options": ["Mathematics", "Science", "English", "History", "Art", "Music", "Technology", "Business"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Level", "field_key": "level", "field_type": "select", "options": ["Beginner", "Intermediate", "Advanced"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Enrollment", "field_key": "max_enrollment", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Start Date", "field_key": "course_start_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "End Date", "field_key": "course_end_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Credits", "field_key": "credits", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Room / Location", "field_key": "room_location", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "Student ID", "field_key": "student_id", "field_type": "text"},
    {"entity_type": "person", "name": "Grade Level", "field_key": "grade_level", "field_type": "select", "options": ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]}
  ],
  "link_types": [
    {"name": "Student", "slug": "student", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Instructor", "slug": "instructor", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Teaching Assistant", "slug": "ta", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#8b5cf6"},
    {"name": "Prerequisite", "slug": "prerequisite", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb),

-- Membership / Club Pack
('Membership & Club Pack', 'Member management with dues tracking, event coordination, public member directory, and renewal workflows.', true, '{
  "workflows": [{
    "name": "Membership Lifecycle",
    "description": "Track members from application to renewal",
    "stages": [
      {"_ref": "applied", "name": "Applied", "position": 0, "is_initial": true},
      {"_ref": "approved", "name": "Approved", "position": 1},
      {"_ref": "active", "name": "Active Member", "position": 2},
      {"_ref": "renewal_due", "name": "Renewal Due", "position": 3},
      {"_ref": "lapsed", "name": "Lapsed", "position": 4, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Approve", "_from_ref": "applied", "_to_ref": "approved", "require_comment": true},
      {"name": "Reject", "_from_ref": "applied", "_to_ref": "rejected", "require_comment": true},
      {"name": "Activate", "_from_ref": "approved", "_to_ref": "active"},
      {"name": "Renewal Due", "_from_ref": "active", "_to_ref": "renewal_due"},
      {"name": "Renew", "_from_ref": "renewal_due", "_to_ref": "active"},
      {"name": "Lapse", "_from_ref": "renewal_due", "_to_ref": "lapsed"}
    ]
  },
  {
    "name": "Club Events",
    "description": "Plan and manage club events and meetups",
    "public_config": {"enabled": true, "listing_title": "Upcoming Events", "visible_fields": ["title", "description"]},
    "stages": [
      {"_ref": "idea", "name": "Idea", "position": 0, "is_initial": true},
      {"_ref": "planned", "name": "Planned", "position": 1, "is_public": true},
      {"_ref": "open_rsvp", "name": "Open for RSVP", "position": 2, "is_public": true},
      {"_ref": "past", "name": "Past Event", "position": 3, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Plan", "_from_ref": "idea", "_to_ref": "planned"},
      {"name": "Open RSVP", "_from_ref": "planned", "_to_ref": "open_rsvp"},
      {"name": "Close Event", "_from_ref": "open_rsvp", "_to_ref": "past"},
      {"name": "Cancel", "_from_ref": "planned", "_to_ref": "cancelled", "require_comment": true},
      {"name": "Cancel", "_from_ref": "open_rsvp", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Membership Tier", "field_key": "membership_tier", "field_type": "select", "options": ["Basic", "Premium", "VIP", "Lifetime"]},
    {"entity_type": "person", "name": "Join Date", "field_key": "join_date", "field_type": "date"},
    {"entity_type": "person", "name": "Renewal Date", "field_key": "renewal_date", "field_type": "date"},
    {"entity_type": "person", "name": "Dues Paid", "field_key": "dues_paid", "field_type": "checkbox"},
    {"entity_type": "workflow_item", "name": "Event Date", "field_key": "event_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "event_location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Capacity", "field_key": "max_capacity", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Cost", "field_key": "event_cost", "field_type": "text", "is_public": true}
  ],
  "link_types": [
    {"name": "Member", "slug": "member", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Event Organizer", "slug": "event_organizer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"},
    {"name": "RSVP", "slug": "rsvp", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#3b82f6"},
    {"name": "Sponsor", "slug": "sponsor", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb),

-- Freelancer / Client Pack
('Freelancer & Client Pack', 'Client project management with proposals, invoicing stages, time tracking, and client portal support.', true, '{
  "workflows": [{
    "name": "Client Project",
    "description": "Manage client engagements from proposal to payment",
    "stages": [
      {"_ref": "proposal", "name": "Proposal", "position": 0, "is_initial": true},
      {"_ref": "negotiation", "name": "Negotiation", "position": 1},
      {"_ref": "active", "name": "Active", "position": 2},
      {"_ref": "delivered", "name": "Delivered", "position": 3},
      {"_ref": "invoiced", "name": "Invoiced", "position": 4},
      {"_ref": "paid", "name": "Paid", "position": 5, "is_terminal": true},
      {"_ref": "lost", "name": "Lost", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Negotiate", "_from_ref": "proposal", "_to_ref": "negotiation"},
      {"name": "Win Project", "_from_ref": "negotiation", "_to_ref": "active"},
      {"name": "Deliver", "_from_ref": "active", "_to_ref": "delivered"},
      {"name": "Send Invoice", "_from_ref": "delivered", "_to_ref": "invoiced"},
      {"name": "Mark Paid", "_from_ref": "invoiced", "_to_ref": "paid"},
      {"name": "Lost", "_from_ref": "proposal", "_to_ref": "lost", "require_comment": true},
      {"name": "Lost", "_from_ref": "negotiation", "_to_ref": "lost", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Project Value", "field_key": "project_value", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Hourly Rate", "field_key": "hourly_rate", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Hours Logged", "field_key": "hours_logged", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Deadline", "field_key": "deadline", "field_type": "date"},
    {"entity_type": "workflow_item", "name": "Project Type", "field_key": "project_type", "field_type": "select", "options": ["Web Development", "Mobile App", "Design", "Consulting", "Content", "Marketing", "Other"]},
    {"entity_type": "person", "name": "Company", "field_key": "client_company", "field_type": "text"},
    {"entity_type": "person", "name": "Budget Range", "field_key": "budget_range", "field_type": "select", "options": ["< $1K", "$1K-$5K", "$5K-$20K", "$20K-$50K", "$50K+"]}
  ],
  "link_types": [
    {"name": "Client Contact", "slug": "client_contact", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Subcontractor", "slug": "subcontractor", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#f97316"},
    {"name": "Related Project", "slug": "related_project", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#6366f1"}
  ],
  "automations": []
}'::jsonb),

-- Healthcare / Patient Pack
('Healthcare & Patient Pack', 'Patient intake and care coordination with referral tracking, appointment workflows, and HIPAA-conscious field design.', true, '{
  "workflows": [{
    "name": "Patient Intake",
    "description": "Track patients from referral to active care",
    "stages": [
      {"_ref": "referred", "name": "Referred", "position": 0, "is_initial": true},
      {"_ref": "scheduled", "name": "Scheduled", "position": 1},
      {"_ref": "intake_complete", "name": "Intake Complete", "position": 2},
      {"_ref": "active_care", "name": "Active Care", "position": 3},
      {"_ref": "discharged", "name": "Discharged", "position": 4, "is_terminal": true},
      {"_ref": "no_show", "name": "No Show", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Schedule", "_from_ref": "referred", "_to_ref": "scheduled"},
      {"name": "Complete Intake", "_from_ref": "scheduled", "_to_ref": "intake_complete"},
      {"name": "Begin Care", "_from_ref": "intake_complete", "_to_ref": "active_care"},
      {"name": "Discharge", "_from_ref": "active_care", "_to_ref": "discharged", "require_comment": true},
      {"name": "No Show", "_from_ref": "scheduled", "_to_ref": "no_show"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "person", "name": "Date of Birth", "field_key": "dob", "field_type": "date"},
    {"entity_type": "person", "name": "Insurance Provider", "field_key": "insurance_provider", "field_type": "text"},
    {"entity_type": "person", "name": "Policy Number", "field_key": "policy_number", "field_type": "text"},
    {"entity_type": "person", "name": "Emergency Contact", "field_key": "emergency_contact", "field_type": "text"},
    {"entity_type": "person", "name": "Allergies", "field_key": "allergies", "field_type": "text"},
    {"entity_type": "workflow_item", "name": "Referral Source", "field_key": "referral_source", "field_type": "select", "options": ["Self", "Physician", "Insurance", "Hospital", "Other"]},
    {"entity_type": "workflow_item", "name": "Appointment Date", "field_key": "appointment_date", "field_type": "date"},
    {"entity_type": "workflow_item", "name": "Visit Type", "field_key": "visit_type", "field_type": "select", "options": ["Initial Consultation", "Follow-up", "Procedure", "Lab Work", "Imaging"]}
  ],
  "link_types": [
    {"name": "Patient", "slug": "patient", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#22c55e"},
    {"name": "Referring Provider", "slug": "referring_provider", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Care Team Member", "slug": "care_team", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#8b5cf6"},
    {"name": "Related Case", "slug": "related_case", "source_entity_type": "workflow_item", "target_entity_type": "workflow_item", "color": "#f59e0b"}
  ],
  "automations": []
}'::jsonb);
