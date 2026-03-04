# Spine — Data Model & Database Schema

All data lives in Supabase Postgres (`public` schema). RLS is disabled — all access is mediated through Netlify Functions using the service role key.

---

## Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially:

| # | File | Purpose |
|---|---|---|
| 001 | `foundations.sql` | Extensions, accounts, persons, profiles, memberships |
| 002 | `registries.sql` | Custom field definitions, link type definitions |
| 003 | `workflows.sql` | Workflow definitions, stage definitions, transition definitions, workflow actions |
| 004 | `items.sql` | Items (workflow items) |
| 005 | `threads.sql` | Threads, messages |
| 006 | `relationships.sql` | Entity links, entity attachments, entity watchers |
| 007 | `automation.sql` | Automation rules, outbox events, webhook subscriptions, webhook deliveries, audit log, activity events, scheduled triggers |
| 008 | `knowledge.sql` | Knowledge base articles, embeddings, enrollments, lesson completions |
| 009 | `views_apps.sql` | View definitions, app definitions, account modules |
| 010 | `integrations.sql` | Integration definitions, integration instances, custom action types, inbound webhook keys, inbound webhook mappings |
| 011 | `packs.sql` | Config packs, pack activations, pack entity mappings |
| 012 | `security.sql` | RLS policies, security lockdown, impersonation sessions, invites, error log |
| 013 | `seeds.sql` | Base seed data |
| 014–016 | `seed_template_packs*.sql` | Template pack seed data (Support, CRM) |
| 021–024 | `pack_*.sql` | Expanded packs (Sales, CSM, Operations, Marketing) |
| 025 | `hierarchical_accounts.sql` | Account paths closure table, parent_account_id |
| 026 | `tenant_settings.sql` | Per-tenant settings table |

### Installers

| File | Use Case |
|---|---|
| `install.sql` | Fresh project — creates everything from scratch |
| `install-safe.sql` | Idempotent — safe to re-run on existing projects |
| `install-namespaced.sql` | Deprecated — multi-instance in separate schemas |

---

## Multi-Tenant Isolation

Every tenant-scoped table includes an `account_id` column. All API queries filter by this column using the resolved tenant context from the middleware.

**Pattern:**
```sql
-- Every query in a handler looks like:
SELECT * FROM items WHERE account_id = $accountId AND ...
```

System admins (`system_role = 'system_admin'`) can access any account without a membership.

---

## Common Column Patterns

Most tables share these columns:

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK) | Auto-generated via `uuid_generate_v4()` |
| `account_id` | `uuid` (FK) | Tenant isolation |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Auto-updated via trigger |
| `is_active` | `boolean` | Soft-delete flag |
| `is_test_data` | `boolean` | Marks pack-seeded test data |
| `pack_id` | `uuid` | Links to source config pack |
| `ownership` | `text` | `'pack'` or `'tenant'` |
| `metadata` | `jsonb` | Extensible key-value store |

---

## Core Tables

### Identity & Tenancy

#### `accounts`
Top-level tenant container.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_type` | text | `'individual'` or `'organization'` |
| `display_name` | text | Required |
| `slug` | text | Unique, used for public URLs |
| `status` | text | `'active'`, `'suspended'`, `'closed'` |
| `settings` | jsonb | Account-level settings |
| `metadata` | jsonb | Extensible data |
| `parent_account_id` | uuid FK | For hierarchical accounts |

#### `persons`
Individual identity records.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `auth_uid` | uuid | Links to Supabase Auth user (unique) |
| `email` | text | Unique |
| `full_name` | text | Required |
| `status` | text | `'active'`, `'inactive'`, `'suspended'` |
| `metadata` | jsonb | Extensible data |

#### `profiles`
Display/UI preferences for a person.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid FK → persons | Unique |
| `display_name` | text | |
| `avatar_url` | text | |
| `system_role` | text | `'system_admin'`, `'system_operator'`, `'support_operator'`, or NULL |

#### `memberships`
Links persons to accounts with a role.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `person_id` | uuid FK → persons | |
| `account_id` | uuid FK → accounts | |
| `account_role` | text | `'admin'`, `'operator'`, `'member'`, `'portal'` |
| `status` | text | `'active'`, `'inactive'`, `'invited'` |
| Unique | | `(person_id, account_id)` |

#### `invites`
Pending invitations to join an account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `email` | text | Invitee email |
| `account_role` | text | Role to assign on acceptance |
| `token` | text | Unique invite token |
| `status` | text | `'pending'`, `'accepted'`, `'expired'` |
| `expires_at` | timestamptz | |

#### `account_paths`
Closure table for hierarchical account relationships.

| Column | Type | Notes |
|---|---|---|
| `ancestor_id` | uuid FK → accounts | |
| `descendant_id` | uuid FK → accounts | |
| `depth` | integer | 0 = self, 1 = direct child, etc. |
| PK | | `(ancestor_id, descendant_id)` |

---

### Workflows

#### `workflow_definitions`
Blueprint for a workflow (e.g., "Sales Pipeline", "Support Ticket").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | Required |
| `description` | text | |
| `workflow_type` | text | Free-form label |
| `status` | text | |
| `config` | jsonb | Workflow-level config |
| `metadata` | jsonb | |

#### `stage_definitions`
Named stages within a workflow (e.g., "New", "In Progress", "Closed").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_definition_id` | uuid FK | |
| `name` | text | |
| `position` | integer | Display order |
| `is_initial` | boolean | Starting stage |
| `is_terminal` | boolean | End stage |
| `color` | text | UI color |
| `config` | jsonb | Stage-level config |

#### `transition_definitions`
Allowed moves between stages.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_definition_id` | uuid FK | |
| `from_stage_id` | uuid FK → stage_definitions | |
| `to_stage_id` | uuid FK → stage_definitions | |
| `name` | text | Human label (e.g., "Approve") |
| `conditions` | jsonb | Conditions that must be met |
| `config` | jsonb | |

#### `workflow_actions`
Actions triggered by workflow events.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `workflow_definition_id` | uuid FK | |
| `name` | text | |
| `trigger_type` | text | `'on_create'`, `'on_transition'`, `'on_update'` |
| `trigger_ref_id` | uuid | FK to stage/transition that triggers this |
| `action_type` | text | `'webhook'`, `'update_field'`, `'emit_event'`, `'ai_prompt'`, etc. |
| `action_config` | jsonb | Action-specific configuration |
| `conditions` | jsonb | Pre-execution conditions |
| `position` | integer | Execution order |
| `enabled` | boolean | |

#### `items`
Workflow item instances (the actual work objects).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `workflow_definition_id` | uuid FK | |
| `stage_definition_id` | uuid FK | Current stage |
| `title` | text | |
| `item_type` | text | Free-form classification |
| `priority` | text | |
| `status` | text | |
| `assigned_to_person_id` | uuid FK → persons | |
| `metadata` | jsonb | Custom fields stored here |

---

### Communication

#### `threads`
Conversation containers (support tickets, discussions, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `thread_type` | text | Free-form (e.g., `'support'`, `'discussion'`) |
| `subject` | text | |
| `status` | text | |
| `metadata` | jsonb | |

#### `messages`
Individual messages within a thread.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `thread_id` | uuid FK → threads | |
| `person_id` | uuid FK → persons | Author |
| `body` | text | Message content |
| `is_internal` | boolean | Hidden from portal users |
| `metadata` | jsonb | |

---

### Knowledge & Learning

> **Note:** There are no dedicated KB/course tables. Articles, courses, and lessons are modeled as `items` with `item_type` of `'article'`, `'course'`, or `'lesson'`. See [OBJECT-MODEL.md](OBJECT-MODEL.md) for the mapping:
> - Article body → `item.metadata.body` (markdown)
> - Article slug → `item.metadata.slug`
> - Course/lesson hierarchy → `entity_links` (link_type: `'contains'`)
> - Enrollments → `entity_links` (person → course, link_type: `'enrolled'`)
> - Lesson completions → `entity_links` (person → lesson, link_type: `'completed'`)

---

### Relationships & Extensions

#### `entity_links`
Polymorphic relationship table connecting any two entities.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `source_type` | text | e.g., `'person'`, `'account'`, `'item'` |
| `source_id` | uuid | |
| `target_type` | text | |
| `target_id` | uuid | |
| `link_type` | text | Defined by link_type_definitions |
| `metadata` | jsonb | |

#### `link_type_definitions`
Schema for allowed link types.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `slug` | text | Unique per account |
| `name` | text | |
| `source_type` | text | |
| `target_type` | text | |
| `config` | jsonb | |

#### `custom_field_definitions`
Defines custom metadata fields for entities.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `entity_type` | text | e.g., `'item'`, `'person'`, `'account'` |
| `slug` | text | Field key in metadata |
| `name` | text | Display label |
| `field_type` | text | `'text'`, `'number'`, `'select'`, `'boolean'`, `'date'`, etc. |
| `config` | jsonb | Options, validation rules |
| `position` | integer | Display order |

---

### Events & Audit

#### `outbox_events`
Event queue for webhooks and automations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `event_type` | text | e.g., `'item.created'`, `'account.updated'` |
| `entity_type` | text | |
| `entity_id` | uuid | |
| `payload` | jsonb | Full event payload |
| `processed` | boolean | Set true after webhook delivery queued |

#### `audit_log`
Immutable before/after diff for every write.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `person_id` | uuid FK | Who made the change |
| `request_id` | text | Correlates with API request |
| `action` | text | `'create'`, `'update'`, `'delete'` |
| `entity_type` | text | |
| `entity_id` | uuid | |
| `before_data` | jsonb | State before change |
| `after_data` | jsonb | State after change |
| `metadata` | jsonb | Includes impersonation info if applicable |

#### `activity_events`
Human-readable activity feed.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `person_id` | uuid FK | |
| `event_type` | text | e.g., `'item.created'`, `'automation.executed'` |
| `entity_type` | text | |
| `entity_id` | uuid | |
| `summary` | text | Human-readable description |
| `metadata` | jsonb | |

---

### Webhooks & Integrations

#### `webhook_subscriptions`
Outbound webhook endpoints.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `url` | text | Delivery target |
| `enabled` | boolean | |
| `event_types` | text[] | Filter (empty = all events) |
| `signing_secret` | text | HMAC-SHA256 signing key |
| `description` | text | |

#### `webhook_deliveries`
Individual delivery attempts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `webhook_subscription_id` | uuid FK | |
| `outbox_event_id` | uuid FK | |
| `status` | text | `'pending'`, `'success'`, `'failed'`, `'dead_letter'` |
| `attempts` | integer | |
| `next_attempt_at` | timestamptz | Exponential backoff |
| `response_status` | integer | HTTP status from target |
| `response_body` | text | |

#### `inbound_webhook_keys`
API keys for external systems to push data into Spine.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `api_key` | text | Unique |
| `enabled` | boolean | |
| `last_used_at` | timestamptz | |

#### `inbound_webhook_mappings`
Rules for how inbound data maps to Spine actions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `inbound_key_id` | uuid FK | |
| `name` | text | |
| `action` | text | `'create_item'`, `'update_item'`, `'transition_item'`, `'emit_event'`, etc. |
| `action_config` | jsonb | Field mappings, target stage, etc. |
| `conditions` | jsonb | |
| `enabled` | boolean | |

#### `integration_definitions`
Global integration catalog (available to all tenants).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text | Unique identifier |
| `name` | text | |
| `icon` | text | |
| `category` | text | |
| `version` | text | |
| `manifest` | jsonb | Configuration schema, capabilities |

#### `integration_instances`
Per-tenant installation of an integration.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `definition_id` | uuid FK → integration_definitions | |
| `config` | jsonb | Tenant-specific configuration |
| `status` | text | |

---

### Automation & Scheduling

#### `automation_rules`
Event-triggered rules.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `workflow_definition_id` | uuid FK | Optional — scope to a workflow |
| `name` | text | |
| `trigger_event` | text | e.g., `'item.created'`, `'item.stage_changed'` |
| `conditions` | jsonb | Pre-execution conditions |
| `action_type` | text | `'transition_stage'`, `'emit_event'`, `'webhook'`, `'update_field'`, custom |
| `action_config` | jsonb | |
| `enabled` | boolean | |

#### `scheduled_triggers`
Time-based triggers (one-time, recurring, countdown).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `trigger_type` | text | `'one_time'`, `'recurring'`, `'countdown'` |
| `cron_expression` | text | For recurring (5-field cron) |
| `fire_at` | timestamptz | For one-time |
| `delay_event` | text | For countdown — the event that starts the timer |
| `delay_seconds` | integer | For countdown |
| `action_type` | text | |
| `action_config` | jsonb | |
| `conditions` | jsonb | |
| `enabled` | boolean | |
| `fire_count` | integer | |
| `last_fired_at` | timestamptz | |
| `next_fire_at` | timestamptz | Computed for recurring |

#### `scheduled_trigger_instances`
Individual pending timer instances (from countdowns and workflow timers).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `trigger_id` | uuid FK (nullable) | |
| `account_id` | uuid FK | |
| `fire_at` | timestamptz | When to execute |
| `status` | text | `'pending'`, `'fired'`, `'cancelled'` |
| `context` | jsonb | Payload passed to the action |
| `action_type` | text | |
| `action_config` | jsonb | |

---

### AI & Intelligence

#### `embeddings`
Multi-vector storage using pgvector.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `entity_type` | text | e.g., `'kb_article'`, `'item'` |
| `entity_id` | uuid | |
| `vector_type` | text | e.g., `'content'`, `'title'` |
| `embedding` | vector(1536) | OpenAI text-embedding-3-small |
| `model` | text | Model used to generate |
| `metadata` | jsonb | |
| Unique | | `(account_id, entity_type, entity_id, vector_type)` |

---

### Apps & Views

#### `app_definitions`
Defines a navigable "app" with nav items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `slug` | text | Unique per account |
| `name` | text | |
| `icon` | text | Lucide icon name |
| `min_role` | text | Minimum role to see the app |
| `app_position` | integer | Sidebar sort order |
| `nav_items` | jsonb | Array of `{ label, icon, route_type, view_slug, url, position, min_role }` |

#### `view_definitions`
Configurable data views (list, kanban, detail, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `slug` | text | URL path component |
| `name` | text | |
| `view_type` | text | `'list'`, `'detail'`, `'kanban'`, `'calendar'`, `'chart'` |
| `target_type` | text | Entity type to display |
| `target_filter` | jsonb | Filter criteria |
| `columns` | jsonb | Column definitions |
| `config` | jsonb | View-specific settings |

#### `account_modules`
Feature flags per tenant.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `module_slug` | text | e.g., `'knowledge_base'`, `'courses'` |
| `enabled` | boolean | |
| `config` | jsonb | Module-level settings |

---

### Config Packs

#### `config_packs`
Reusable configuration templates.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text | Unique |
| `name` | text | |
| `description` | text | |
| `category` | text | |
| `version` | text | |

#### `pack_activations`
Tracks which packs are installed for which accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_id` | uuid FK → config_packs | |
| `config_active` | boolean | |
| `installed_at` | timestamptz | |

#### `pack_entity_mappings`
Maps template IDs to cloned IDs during pack install.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_id` | uuid FK | |
| `entity_type` | text | |
| `template_id` | uuid | Original ID in the pack |
| `cloned_id` | uuid | New ID in the tenant's data |

---

### System

#### `admin_counts`
Cached sidebar counters.

| Column | Type | Notes |
|---|---|---|
| `account_id` | uuid | |
| `counter_key` | text | e.g., `'workflows'`, `'members'` |
| `counter_value` | integer | |
| PK | | `(account_id, counter_key)` |

#### `tenant_settings`
Per-tenant configuration.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | Unique |
| `settings` | jsonb | Key-value settings |

#### `error_log`
Captured runtime errors.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `request_id` | text | |
| `function_name` | text | |
| `error_code` | text | |
| `message` | text | |
| `stack` | text | |
| `account_id` | uuid | |
| `metadata` | jsonb | |

#### `impersonation_sessions`
Active impersonation sessions for system admins.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `admin_person_id` | uuid FK | The system admin |
| `target_person_id` | uuid FK | Who they're acting as |
| `target_account_id` | uuid FK | In which account |
| `target_account_role` | text | |
| `reason` | text | Required audit field |
| `status` | text | `'active'`, `'ended'`, `'expired'` |
| `expires_at` | timestamptz | Auto-expiry |

---

## Extensions

Postgres extensions required:

| Extension | Purpose |
|---|---|
| `uuid-ossp` | UUID generation |
| `pgcrypto` | Cryptographic functions |
| `vector` | pgvector for embeddings |
| `pg_trgm` | Trigram similarity for search |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and build pipeline
- [AUTH-AND-RBAC.md](AUTH-AND-RBAC.md) — How auth and roles map to these tables
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Workflow tables in depth
- [CONFIG-PACKS.md](CONFIG-PACKS.md) — How packs install/clone data
