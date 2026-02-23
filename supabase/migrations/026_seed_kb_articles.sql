-- Seed global KB articles: documentation for Spine extensibility features
-- These are visible to ALL users regardless of account (is_global = true)

-- Create a sentinel system account to own global content
INSERT INTO accounts (id, account_type, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'organization', 'Spine System')
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_base_articles (account_id, title, slug, body, status, category, is_global, published_at) VALUES

-- 1. Getting Started
('00000000-0000-0000-0000-000000000001', 'Getting Started with Spine', 'getting-started', '
# Getting Started with Spine

Welcome to Spine — a flexible, multi-tenant platform for managing workflows, people, tickets, and more. This guide will help you understand the core concepts and get up and running quickly.

## Core Concepts

### Accounts
An account is your organization or workspace. Everything in Spine — people, workflows, tickets, and settings — belongs to an account. You can be a member of multiple accounts.

### People (Persons)
People are the contacts, customers, team members, or any individuals you track. Each person has a name, email, and can have unlimited custom fields attached.

### Workflows
Workflows are the heart of Spine. A workflow defines a process with **stages** (steps) and **transitions** (allowed movements between stages). Workflow items move through stages as work progresses.

### Tickets
Tickets are lightweight support or task items with priority, status, and assignment. They can be linked to people, workflow items, and other entities.

### Knowledge Base
You are reading a KB article right now! The knowledge base stores documentation, guides, and reference material. Articles can be categorized and published for your team.

## Roles

- **Admin** — Full access to all settings, workflows, automations, and user management
- **Operator** — Can manage day-to-day items, create/edit records, but cannot change account settings
- **Viewer** — Read-only access to data
- **Portal** — External user with limited, scoped access (see the Portal Users guide)

## Next Steps

- Read about **Entity Links** to connect records together
- Learn about the **Public Layer** to share content externally
- Explore **Template Packs** to quickly set up common configurations
- Set up **Automations** to streamline repetitive tasks
', 'published', 'getting-started', true, now()),

-- 2. Entity Links
('00000000-0000-0000-0000-000000000001', 'Entity Links: Connecting Records', 'entity-links', '
# Entity Links: Connecting Records

Entity Links let you create relationships between any two records in Spine — people, accounts, workflow items, tickets, or KB articles. This is one of the most powerful extensibility features.

## What Are Entity Links?

An entity link is a named connection between a **source** and a **target** entity. For example:
- A **person** linked to a **workflow item** as a "Candidate"
- A **ticket** linked to another **ticket** as "Related"
- A **workflow item** linked to a **person** as "Assigned Recruiter"

Each link has a **link type** (e.g., "candidate", "related", "organizer") and optional **metadata** for extra context.

## Using Entity Links

### Viewing Links
On any detail page (Person, Account, Workflow Item, Ticket), scroll down to the **Entity Links** panel. You will see all links to and from that record.

### Creating a Link
1. Open the Entity Links panel on any detail page
2. Click **Add Link**
3. Choose the target entity type (person, workflow item, ticket, etc.)
4. Search for the target record
5. Select a link type
6. Click **Create**

### Removing a Link
Click the **×** button next to any link to remove it.

## Link Type Definitions

Admins can define custom link types under **Admin → Link Types**. Each link type has:
- **Name** — Display name (e.g., "Candidate", "Sponsor")
- **Slug** — URL-safe identifier (e.g., "candidate", "sponsor")
- **Source/Target Entity Types** — Optional constraints on which entity types can be linked
- **Color** — Visual indicator in the UI

### Creating a Link Type
1. Go to **Admin → Link Types**
2. Click **New Link Type**
3. Fill in the name, slug, and optional constraints
4. Save

## Automation Integration

Entity links integrate with the automation engine:
- **Trigger**: `entity_link.created` fires when a new link is created
- **Action**: The `create_link` action type can automatically create links as part of an automation rule

### Example Automation
> When a workflow item enters the "Interview" stage, automatically link the assigned recruiter as "Interviewer".

## Tips
- Links are **bidirectional** — if Person A is linked to Ticket B, you will see the link on both records
- Use link types to categorize relationships and make them searchable
- Template packs can pre-install link types for common scenarios
', 'published', 'features', true, now()),

-- 3. Public Layer
('00000000-0000-0000-0000-000000000001', 'Public Layer: Sharing Content Externally', 'public-layer', '
# Public Layer: Sharing Content Externally

The Public Layer lets you expose selected workflows and items to the public internet — no login required. This is perfect for job boards, event listings, community directories, and more.

## How It Works

1. **Account Slug** — Your account gets a unique URL slug (e.g., `my-company`)
2. **Public Workflows** — Enable public visibility on specific workflows
3. **Public Stages** — Mark which stages are visible to the public
4. **Public Fields** — Control which custom fields are shown publicly

Visitors can browse your public content at `/p/{your-slug}`.

## Setting Up Public Access

### Step 1: Set Your Account Slug
1. Go to **Admin → Settings**
2. Find the **Public URL Slug** field
3. Enter a unique, URL-friendly slug (e.g., `acme-corp`)
4. Save

### Step 2: Enable Public Workflow
1. Open the **Workflow Builder** for the workflow you want to make public
2. In the workflow settings panel, enable **Public Listing**
3. Set a **Listing Title** (shown to visitors)
4. Choose which fields are visible publicly

### Step 3: Mark Public Stages
1. In the Workflow Builder, select a stage
2. Toggle **Public** on for stages that should be visible
3. Only items in public stages will appear in public listings

### Step 4: Mark Public Custom Fields
1. Go to **Admin → Custom Fields**
2. For each field you want visible publicly, enable the **Public** toggle

## Public Pages

- **`/p/{slug}`** — Account home: lists all public workflows
- **`/p/{slug}/{workflowId}`** — Workflow listing: shows items in public stages
- **`/p/{slug}/{workflowId}/{itemId}`** — Item detail: shows public fields

## Interaction

Logged-in users visiting a public page can interact with items (e.g., RSVP, apply). Anonymous visitors see read-only content.

## Tips
- Use this for job boards, event calendars, product catalogs, or community directories
- Combine with **Portal Role** to let external users interact after signing up
- Template packs like "Recruiting" and "Community Events" come pre-configured with public settings
', 'published', 'features', true, now()),

-- 4. Portal Role
('00000000-0000-0000-0000-000000000001', 'Portal Users: External Access', 'portal-users', '
# Portal Users: External Access

The Portal role gives external users (customers, candidates, community members) a limited, scoped view of your Spine account. Portal users see only what is relevant to them.

## What Portal Users Can Do

- **Dashboard** — See workflow items and tickets linked to them
- **My Items** — View workflow items they are connected to via entity links
- **My Tickets** — View tickets they created or are assigned to
- **Browse** — Explore public workflows and listings
- **Profile** — Update their own profile information

Portal users **cannot**:
- Access admin settings
- View other users'' data
- Modify workflows, automations, or custom fields
- See the full operator/admin interface

## Setting Up Portal Access

### Inviting a Portal User
1. Go to **Admin → Team** (or the members section)
2. Invite a new user with the **Portal** role
3. The user receives an invitation and creates their account

### Self-Registration
If you have public pages enabled, visitors can self-register as portal users:
1. They visit your public page at `/p/{slug}`
2. They click **Sign Up** or interact with an item
3. They are provisioned as a portal user on your account

### Upgrading a Portal User
Admins can upgrade a portal user to Viewer, Operator, or Admin at any time through the team management interface.

## Portal UI

Portal users get a dedicated interface (PortalShell) with:
- A simplified sidebar with only relevant navigation
- Dashboard showing their linked items
- Profile management

## Tips
- Use entity links to connect portal users to the items they should see
- Combine with the Public Layer for a complete external-facing experience
- The "Support Pack" template is great for customer portal scenarios
', 'published', 'features', true, now()),

-- 5. Template Packs
('00000000-0000-0000-0000-000000000001', 'Template Packs: Quick Setup', 'template-packs', '
# Template Packs: Quick Setup

Template Packs are pre-built configurations that instantly set up workflows, custom fields, link types, and automations for common use cases. Instead of building everything from scratch, install a pack and start working immediately.

## Available Packs

### CRM Pack
Sales pipeline with deal tracking. Includes:
- **Sales Pipeline** workflow (Lead → Qualified → Proposal → Negotiation → Closed Won/Lost)
- Custom fields: Deal Value, Source, Close Date, Company, Phone, Job Title
- Link types: Contact, Company

### Support Pack
Ticket management with escalation. Includes:
- **Support Escalation** workflow (New → Triaged → In Progress → Awaiting Customer → Resolved)
- Custom fields: Product, Environment, Severity, Plan Tier
- Link types: Related Ticket, Affected Customer

### Recruiting Pack
Hiring pipeline with public job listings. Includes:
- **Hiring Pipeline** workflow with public "Open" stage for job postings
- Custom fields: Department, Location, Salary Range, Resume URL, Skills, Years of Experience
- Link types: Candidate, Recruiter, Hiring Manager
- Pre-configured public listing settings

### Community Events Pack
Event management with RSVP tracking. Includes:
- **Event Lifecycle** workflow with public event listings
- Custom fields: Event Date, Location, Difficulty, Distance, Max Attendees, Meeting Point
- Link types: Participant, Organizer
- Pre-configured public listing settings

### Project Management Pack
Task and project tracking. Includes:
- **Project Delivery** workflow (Backlog → Planning → In Progress → Review → Done)
- Custom fields: Priority, Estimated Hours, Sprint, Assignee Type
- Link types: Depends On, Blocks, Sub-task

### Real Estate Pack
Property listing and deal management. Includes:
- **Property Listing** workflow with public stages for active listings
- Custom fields: Price, Bedrooms, Bathrooms, Square Footage, Property Type, MLS Number
- Link types: Buyer, Seller, Listing Agent

### Nonprofit / Volunteer Pack
Volunteer and program management. Includes:
- **Volunteer Onboarding** workflow
- Custom fields: Availability, Skills, Background Check Status, Hours Logged
- Link types: Volunteer, Program Coordinator, Beneficiary

### IT Service Desk Pack
ITIL-aligned service management. Includes:
- **Incident Management** workflow (Reported → Investigating → Implementing Fix → Resolved → Closed)
- Custom fields: Impact, Urgency, Affected System, Resolution Category
- Link types: Related Incident, Change Request, Affected User

## Installing a Pack

1. Go to **Admin → Template Packs**
2. Browse the available packs
3. Click **Install** on the pack you want
4. The pack creates all workflows, fields, link types, and automations in your account
5. You can customize everything after installation

## Tips
- You can install multiple packs — they do not conflict
- Packs skip fields and link types that already exist (no duplicates)
- After installing, customize the workflows and fields to match your exact needs
- Packs are a starting point, not a limitation
', 'published', 'features', true, now()),

-- 6. Automations & Email
('00000000-0000-0000-0000-000000000001', 'Automations & Email Actions', 'automations-email', '
# Automations & Email Actions

Spine''s automation engine lets you define rules that trigger actions automatically when events occur. Combined with the email action type, you can build powerful notification and workflow automation without code.

## How Automations Work

An automation rule has three parts:
1. **Trigger Event** — What event starts the automation (e.g., `workflow_item.stage_changed`)
2. **Conditions** — Optional filters to narrow when the rule fires (e.g., only for a specific workflow)
3. **Action** — What happens when the rule fires

## Available Trigger Events

- `workflow_item.created` — A new workflow item is created
- `workflow_item.stage_changed` — An item moves to a new stage
- `workflow_item.updated` — An item is modified
- `ticket.created` — A new ticket is created
- `ticket.status_changed` — A ticket status changes
- `person.created` — A new person is added
- `entity_link.created` — A new entity link is created
- `scheduled` — Time-based triggers (cron schedules)

## Action Types

### Webhook (`webhook`)
Send an HTTP POST to any URL with the event data. Great for integrating with external services like Zapier, Make.com, or custom APIs.

### Move Stage (`move_stage`)
Automatically move a workflow item to a specified stage. Useful for auto-advancing items based on conditions.

### Create Link (`create_link`)
Automatically create an entity link between records. For example, auto-link a person to a workflow item when they interact with it.

### Send Email (`send_email`)
Send an email notification. Supports three providers:

#### Resend
Set environment variables:
- `EMAIL_PROVIDER=resend`
- `EMAIL_API_KEY=your_resend_api_key`
- `EMAIL_FROM=noreply@yourdomain.com`

#### SendGrid
Set environment variables:
- `EMAIL_PROVIDER=sendgrid`
- `EMAIL_API_KEY=your_sendgrid_api_key`
- `EMAIL_FROM=noreply@yourdomain.com`

#### Webhook Fallback
If no email provider is configured, the email payload is sent to a webhook URL you specify. This lets you use Make.com, Zapier, or any HTTP endpoint to handle email delivery.

### Email Action Configuration
In the automation builder, configure:
- **To** — Recipient email (supports `{{placeholders}}` from event data)
- **Subject** — Email subject line
- **Body** — Email body (HTML supported)
- **Webhook URL** — Fallback URL if no provider is set

## Scheduled Triggers

For time-based automations:
1. Go to **Admin → Automations**
2. Create a rule with trigger event `scheduled`
3. Set a cron expression (e.g., `0 9 * * 1` for every Monday at 9 AM)
4. The automation fires on schedule

## Tips
- Combine stage changes with email actions for automatic notifications
- Use webhooks to integrate with hundreds of external services
- Scheduled triggers are great for weekly reports, reminders, and cleanup tasks
- Test automations with a small dataset before enabling them broadly
', 'published', 'features', true, now()),

-- 7. Custom Fields
('00000000-0000-0000-0000-000000000001', 'Custom Fields: Extending Your Data', 'custom-fields', '
# Custom Fields: Extending Your Data

Custom fields let you add any data you need to Spine''s core entities — without touching code. Every entity type (persons, workflow items, tickets, KB articles) can have unlimited custom fields.

## Field Types

- **Text** — Free-form text input
- **Number** — Numeric values
- **Date** — Date picker
- **Select** — Single choice from a list of options
- **Multi-Select** — Multiple choices from a list
- **Checkbox** — Boolean true/false
- **URL** — Clickable link
- **Email** — Email address

## Managing Custom Fields

### Creating a Field
1. Go to **Admin → Custom Fields**
2. Click **New Field**
3. Choose the **Entity Type** (person, workflow_item, ticket, kb_article)
4. Set the **Name**, **Field Key** (used in data storage), and **Field Type**
5. For Select/Multi-Select, define the **Options**
6. Optionally mark as **Required** or **Public**
7. Save

### Public Fields
Toggle **Public** on a field to make it visible on public pages. Only public fields are shown to anonymous visitors on your public listings.

### Field Ordering
Set the **Position** value to control the display order of fields on detail pages.

## Where Fields Appear

Custom fields appear automatically on:
- Person detail pages
- Workflow item detail pages
- Ticket detail pages
- KB article detail pages
- Public item detail pages (if marked public)

## Tips
- Use consistent field keys across entity types for easier reporting
- Template packs install relevant custom fields automatically
- Custom fields are stored as JSONB metadata, so they are flexible and searchable
', 'published', 'features', true, now()),

-- 8. Workflow Builder
('00000000-0000-0000-0000-000000000001', 'Workflow Builder: Designing Processes', 'workflow-builder', '
# Workflow Builder: Designing Processes

The Workflow Builder is a visual tool for designing your business processes. Define stages, transitions, and rules — all without code.

## Key Concepts

### Stages
Stages are the steps in your process. Each stage has:
- **Name** — Display name
- **Position** — Order in the workflow
- **Initial** — Is this the starting stage?
- **Terminal** — Is this an end stage?
- **Public** — Is this stage visible on public pages?
- **Config** — Additional settings (JSON)

### Transitions
Transitions define how items move between stages:
- **From Stage → To Stage** — The allowed movement
- **Name** — Label for the transition button
- **Require Comment** — Force users to add a note when transitioning
- **Conditions** — Rules that must be met before the transition is allowed

### Workflow Items
Items are the actual records that flow through your workflow. Each item has a title, description, current stage, and custom fields.

## Building a Workflow

1. Go to **Admin → Workflows**
2. Click **New Workflow** or edit an existing one
3. Open the **Builder** view
4. Add stages by clicking **Add Stage**
5. Configure each stage (name, position, initial/terminal flags)
6. Add transitions between stages
7. Save your workflow

## Public Workflows

To make a workflow publicly accessible:
1. In the builder, open the workflow settings panel
2. Enable **Public Listing**
3. Set a listing title and choose visible fields
4. Mark relevant stages as **Public**
5. Set your account slug in **Admin → Settings**

## Tips
- Start simple: 3-5 stages is enough for most processes
- Use terminal stages to mark completion (e.g., "Done", "Closed", "Archived")
- Require comments on critical transitions for audit trails
- Combine with automations to trigger actions on stage changes
', 'published', 'features', true, now())

ON CONFLICT (account_id, slug) DO NOTHING;
