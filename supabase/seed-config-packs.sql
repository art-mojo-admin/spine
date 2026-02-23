-- Built-in config packs
INSERT INTO config_packs (name, description, is_system, pack_data) VALUES

-- CRM Pack
('CRM Pack', 'Sales pipeline with deal tracking, contact management, and follow-up automations.', true, '{
  "workflows": [{
    "name": "Sales Pipeline",
    "description": "Track deals from lead to close",
    "public_config": {},
    "stages": [
      {"_ref": "lead", "name": "Lead", "position": 0, "is_initial": true},
      {"_ref": "qualified", "name": "Qualified", "position": 1},
      {"_ref": "proposal", "name": "Proposal", "position": 2},
      {"_ref": "negotiation", "name": "Negotiation", "position": 3},
      {"_ref": "closed_won", "name": "Closed Won", "position": 4, "is_terminal": true},
      {"_ref": "closed_lost", "name": "Closed Lost", "position": 5, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Qualify", "_from_ref": "lead", "_to_ref": "qualified"},
      {"name": "Send Proposal", "_from_ref": "qualified", "_to_ref": "proposal"},
      {"name": "Negotiate", "_from_ref": "proposal", "_to_ref": "negotiation"},
      {"name": "Close Won", "_from_ref": "negotiation", "_to_ref": "closed_won", "require_comment": true},
      {"name": "Close Lost", "_from_ref": "negotiation", "_to_ref": "closed_lost", "require_comment": true},
      {"name": "Back to Qualified", "_from_ref": "proposal", "_to_ref": "qualified"}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Deal Value", "field_key": "deal_value", "field_type": "number"},
    {"entity_type": "workflow_item", "name": "Source", "field_key": "source", "field_type": "select", "options": ["Website", "Referral", "Cold Outreach", "Event", "Other"]},
    {"entity_type": "workflow_item", "name": "Close Date", "field_key": "close_date", "field_type": "date"},
    {"entity_type": "person", "name": "Company", "field_key": "company", "field_type": "text"},
    {"entity_type": "person", "name": "Phone", "field_key": "phone", "field_type": "text"},
    {"entity_type": "person", "name": "Job Title", "field_key": "job_title", "field_type": "text"}
  ],
  "link_types": [
    {"name": "Contact", "slug": "contact", "source_entity_type": "workflow_item", "target_entity_type": "person", "color": "#3b82f6"},
    {"name": "Company", "slug": "company", "source_entity_type": "workflow_item", "target_entity_type": "account", "color": "#8b5cf6"}
  ],
  "automations": []
}'::jsonb),

-- Support Pack
('Support Pack', 'Ticket management with SLA tracking, escalation workflows, and customer communication.', true, '{
  "workflows": [{
    "name": "Support Escalation",
    "description": "Escalation path for complex support issues",
    "stages": [
      {"_ref": "new", "name": "New", "position": 0, "is_initial": true},
      {"_ref": "triaged", "name": "Triaged", "position": 1},
      {"_ref": "in_progress", "name": "In Progress", "position": 2},
      {"_ref": "awaiting_customer", "name": "Awaiting Customer", "position": 3},
      {"_ref": "resolved", "name": "Resolved", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Triage", "_from_ref": "new", "_to_ref": "triaged"},
      {"name": "Start Work", "_from_ref": "triaged", "_to_ref": "in_progress"},
      {"name": "Ask Customer", "_from_ref": "in_progress", "_to_ref": "awaiting_customer"},
      {"name": "Customer Replied", "_from_ref": "awaiting_customer", "_to_ref": "in_progress"},
      {"name": "Resolve", "_from_ref": "in_progress", "_to_ref": "resolved", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "ticket", "name": "Product", "field_key": "product", "field_type": "select", "options": ["Core", "API", "Mobile", "Integrations"]},
    {"entity_type": "ticket", "name": "Environment", "field_key": "environment", "field_type": "select", "options": ["Production", "Staging", "Development"]},
    {"entity_type": "ticket", "name": "Severity", "field_key": "severity", "field_type": "select", "options": ["Critical", "Major", "Minor", "Cosmetic"]},
    {"entity_type": "person", "name": "Plan Tier", "field_key": "plan_tier", "field_type": "select", "options": ["Free", "Pro", "Enterprise"]}
  ],
  "link_types": [
    {"name": "Related Ticket", "slug": "related_ticket", "source_entity_type": "ticket", "target_entity_type": "ticket", "color": "#f59e0b"},
    {"name": "Affected Customer", "slug": "affected_customer", "source_entity_type": "ticket", "target_entity_type": "person", "color": "#ef4444"}
  ],
  "automations": []
}'::jsonb),

-- Recruiting Pack
('Recruiting Pack', 'Hiring pipeline with candidate tracking, interview stages, and job posting support.', true, '{
  "workflows": [{
    "name": "Hiring Pipeline",
    "description": "Track candidates through the hiring process",
    "public_config": {"enabled": true, "listing_title": "Open Positions", "visible_fields": ["title", "description", "due_date"]},
    "stages": [
      {"_ref": "open", "name": "Open", "position": 0, "is_initial": true, "is_public": true},
      {"_ref": "applied", "name": "Applied", "position": 1},
      {"_ref": "screening", "name": "Screening", "position": 2},
      {"_ref": "interview", "name": "Interview", "position": 3},
      {"_ref": "offer", "name": "Offer", "position": 4},
      {"_ref": "hired", "name": "Hired", "position": 5, "is_terminal": true},
      {"_ref": "rejected", "name": "Rejected", "position": 6, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Receive Application", "_from_ref": "open", "_to_ref": "applied"},
      {"name": "Screen", "_from_ref": "applied", "_to_ref": "screening"},
      {"name": "Schedule Interview", "_from_ref": "screening", "_to_ref": "interview"},
      {"name": "Extend Offer", "_from_ref": "interview", "_to_ref": "offer"},
      {"name": "Hire", "_from_ref": "offer", "_to_ref": "hired"},
      {"name": "Reject", "_from_ref": "screening", "_to_ref": "rejected", "require_comment": true},
      {"name": "Reject", "_from_ref": "interview", "_to_ref": "rejected", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Department", "field_key": "department", "field_type": "select", "options": ["Engineering", "Design", "Marketing", "Sales", "Operations"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Salary Range", "field_key": "salary_range", "field_type": "text", "is_public": true},
    {"entity_type": "person", "name": "Resume URL", "field_key": "resume_url", "field_type": "url"},
    {"entity_type": "person", "name": "Skills", "field_key": "skills", "field_type": "multi_select", "options": ["JavaScript", "Python", "React", "Node.js", "SQL", "AWS", "Design", "Marketing"]},
    {"entity_type": "person", "name": "Years of Experience", "field_key": "years_experience", "field_type": "number"}
  ],
  "link_types": [
    {"name": "Candidate", "slug": "candidate", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#10b981"},
    {"name": "Recruiter", "slug": "recruiter", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#6366f1"},
    {"name": "Hiring Manager", "slug": "hiring_manager", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#f97316"}
  ],
  "automations": []
}'::jsonb),

-- Community Events Pack
('Community Events Pack', 'Event management with RSVP tracking, public event listings, and participant management.', true, '{
  "workflows": [{
    "name": "Event Lifecycle",
    "description": "Manage community events from proposal to completion",
    "public_config": {"enabled": true, "listing_title": "Upcoming Events", "visible_fields": ["title", "description", "due_date"]},
    "stages": [
      {"_ref": "proposed", "name": "Proposed", "position": 0, "is_initial": true},
      {"_ref": "confirmed", "name": "Confirmed", "position": 1, "is_public": true},
      {"_ref": "in_progress", "name": "In Progress", "position": 2, "is_public": true},
      {"_ref": "completed", "name": "Completed", "position": 3, "is_terminal": true},
      {"_ref": "cancelled", "name": "Cancelled", "position": 4, "is_terminal": true}
    ],
    "transitions": [
      {"name": "Confirm", "_from_ref": "proposed", "_to_ref": "confirmed"},
      {"name": "Start Event", "_from_ref": "confirmed", "_to_ref": "in_progress"},
      {"name": "Complete", "_from_ref": "in_progress", "_to_ref": "completed"},
      {"name": "Cancel", "_from_ref": "proposed", "_to_ref": "cancelled", "require_comment": true},
      {"name": "Cancel", "_from_ref": "confirmed", "_to_ref": "cancelled", "require_comment": true}
    ]
  }],
  "custom_fields": [
    {"entity_type": "workflow_item", "name": "Event Date", "field_key": "event_date", "field_type": "date", "is_public": true},
    {"entity_type": "workflow_item", "name": "Location", "field_key": "location", "field_type": "text", "is_public": true},
    {"entity_type": "workflow_item", "name": "Difficulty", "field_key": "difficulty", "field_type": "select", "options": ["Easy", "Moderate", "Hard", "Expert"], "is_public": true},
    {"entity_type": "workflow_item", "name": "Distance (km)", "field_key": "distance_km", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Max Attendees", "field_key": "max_attendees", "field_type": "number", "is_public": true},
    {"entity_type": "workflow_item", "name": "Meeting Point", "field_key": "meeting_point", "field_type": "text", "is_public": true}
  ],
  "link_types": [
    {"name": "Participant", "slug": "participant", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#22c55e"},
    {"name": "Organizer", "slug": "organizer", "source_entity_type": "person", "target_entity_type": "workflow_item", "color": "#a855f7"}
  ],
  "automations": []
}'::jsonb);
