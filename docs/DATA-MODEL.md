# Spine — Data Model & Database Schema

All data lives in Supabase Postgres (`public` schema). RLS is disabled — all access is mediated through Netlify Functions using the service role key.

---

## Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially:

| # | File | Purpose |
|---|---|---|
| 001 | `foundations.sql` | Extensions, accounts, persons, profiles, memberships |
| 002 | `registries.sql` | Item type registry, field definitions, link type definitions |
| 003 | `workflows.sql` | Legacy workflow definitions, stage definitions, transition definitions, workflow actions |
| 004 | `items.sql` | Items (core object model) |
| 005 | `threads.sql` | Threads, messages |
| 006 | `relationships.sql` | Legacy entity links, entity attachments, entity watchers |
| 007 | `automation.sql` | Automation rules, outbox events, webhook subscriptions, webhook deliveries, audit log, activity events, scheduled triggers |
| 008 | `knowledge.sql` | Legacy knowledge base articles, embeddings, enrollments, lesson completions |
| 009 | `views_apps.sql` | View definitions, app definitions, legacy account modules |
| 010 | `integrations.sql` | Integration definitions, integration instances, custom action types, inbound webhook keys, inbound webhook mappings |
| 011 | `packs.sql` | Legacy config packs, pack activations, pack entity mappings |
| 012 | `security.sql` | RLS policies, security lockdown, impersonation sessions, invites, error log |
| 013 | `seeds.sql` | Base seed data |
| 014–016 | `seed_template_packs*.sql` | Template pack seed data (Support, CRM) |
| 021–024 | `pack_*.sql` | Expanded packs (Sales, CSM, Operations, Marketing) |
| 025 | `hierarchical_accounts.sql` | Account paths closure table, parent_account_id |
| 026 | `tenant_settings.sql` | Per-tenant settings table |
| 027 | `remove_kb.sql` | Migrate knowledge system to items, drop legacy tables |
| 028 | `allow_page_view_type.sql` | Add page view type |
| 029 | `scope_authorization.sql` | Scope-driven authorization system |
| 030 | `settings_enhancements.sql` | Settings table enhancements |
| 031 | `role_matrix_metadata.sql` | Role matrix metadata |
| 032 | `pack_role_policies_and_legacy.sql` | Pack role policies |
| 033 | `app_package_context.sql` | App package context |
| 034 | `phase_a_kernel.sql` | **Phase A:** Principals, item events, item links, item lifecycle |
| 035 | `phase_b_threads_messages.sql` | **Phase B:** Item-centric threads and messages |
| 036 | `phase_b_traversal.sql` | **Phase B:** Item relationship traversal |
| 037 | `phase_b_semantic_search.sql` | **Phase B:** Vector search with pgvector |
| 038 | `phase_b_introspection.sql` | **Phase B:** Machine-readable API contracts |
| 039 | `phase_c_pack_lifecycle.sql` | **Phase C:** Pack lifecycle management |
| 040 | `phase_c_local_manifest.sql` | **Phase C:** Local manifest support |
| 041 | `phase_d_agents.sql` | **Phase D:** Agent contracts, capabilities, extensions |
| 042 | `phase_e_admin_ui.sql` | **Phase E:** Admin UI support tables |
| 043 | `drop_legacy_tables.sql` | **Cleanup:** Drop pre-Phase-A legacy tables |

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

#### `principals`
**Phase A:** Identity abstraction layer for all authenticated actors.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `principal_type` | text | `'human'`, `'machine'`, `'system'`, `'service'` |
| `person_id` | uuid FK → persons | For human principals |
| `machine_principal_id` | uuid FK → machine_principals | For machine principals |
| `display_name` | text | |
| `status` | text | `'active'`, `'suspended'`, `'revoked'` |
| `metadata` | jsonb | |

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
Links principals to accounts with a role.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `person_id` | uuid FK → persons | Legacy, still populated |
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
**Phase A:** Universal object model - all entities are items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | Tenant isolation |
| `item_type` | text FK → item_type_registry | **Phase A:** Required type registration |
| `slug` | text | Optional human-readable key |
| `title` | text | Optional - some types don't need it |
| `status` | text | **Phase A:** From lifecycle_states, default 'active' |
| `archived_at` | timestamptz | **Phase A:** Soft archive flag |
| `version` | integer | **Phase A:** Optimistic locking |
| `owner_account_id` | uuid FK → accounts | Business ownership (vs tenancy) |
| `created_by_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `updated_by_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `custom_fields` | jsonb | **Phase A:** Validated against field_definitions |
| `metadata` | jsonb | System/pack provenance, tags |
| `workflow_definition_id` | uuid FK | **Legacy:** Still present, deferred removal |
| `stage_definition_id` | uuid FK | **Legacy:** Still present, deferred removal |

---

### Communication

#### `threads`
**Phase B:** Item-centric conversations (attached to items only).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `item_id` | uuid FK → items | **Phase B:** Items only, not polymorphic |
| `thread_type` | text | `'conversation'`, `'review'`, `'ai_exchange'` |
| `visibility` | text | `'internal'`, `'external'`, `'public'` |
| `status` | text | `'open'`, `'resolved'`, `'archived'` |
| `created_by_principal_id` | uuid FK → principals | **Phase B:** Changed from person_id |
| `metadata` | jsonb | |

#### `messages`
Individual messages within a thread.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `thread_id` | uuid FK → threads | |
| `body` | text | Message content |
| `direction` | text | `'outbound'`, `'inbound'`, `'system'` |
| `author_principal_id` | uuid FK → principals | **Phase B:** Changed from person_id |
| `sequence_number` | integer | **Phase B:** DB-assigned monotonic |
| `visibility` | text | `'internal'`, `'external'`, `'public'` |
| `metadata` | jsonb | |

---

### Knowledge & Learning

> **Note:** Legacy KB tables were dropped in migration 043. Articles, courses, and lessons are now modeled as `items` with `item_type` of `'article'`, `'course'`, or `'lesson'`. Hierarchies use `item_links`:
> - Article body → `item.metadata.body` (markdown)
> - Course/lesson hierarchy → `item_links` (link_type: `'contains'`)
> - Enrollments → `item_links` (person → course, link_type: `'enrolled'`)
> - Lesson completions → `item_links` (person → lesson, link_type: `'completed'`)

---

### Phase A: Core Kernel Tables

#### `item_links`
**Phase A:** Item-to-item relationships only (no polymorphic links).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `source_item_id` | uuid FK → items | **Phase A:** Item-to-item only |
| `target_item_id` | uuid FK → items | **Phase A:** Item-to-item only |
| `link_type` | text FK → link_type_definitions | |
| `sequence` | integer | For ordered links |
| `created_by_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `metadata` | jsonb | |

#### `item_events`
**Phase A:** Immutable audit log for items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `item_id` | uuid FK → items | |
| `event_type` | text | `'state_change'`, `'assignment'`, `'comment'`, `'system'`, `'audit'` |
| `event_data` | jsonb | |
| `actor_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `sequence_number` | integer | **Phase A:** DB-assigned monotonic |
| `created_at` | timestamptz | **Phase A:** Immutable, no UPDATE/DELETE |

#### `embeddings`
**Phase A:** Vector storage for semantic search.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `entity_type` | text | `'item'`, `'thread_message'`, etc. |
| `entity_id` | uuid | |
| `vector_type` | text | `'content'`, `'title'`, `'summary'` |
| `embedding` | vector(1536) | **Phase A:** pgvector with ivfflat index |
| `model_version` | text | Default `'text-embedding-3-small'` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `field_definitions`
**Phase A:** Account-scoped field definitions (replaces custom_field_definitions).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `item_type` | text | **Phase A:** Items only, not polymorphic |
| `field_key` | text | |
| `field_type` | text | `'text'`, `'number'`, `'date'`, `'boolean'`, `'enum'`, `'ref'`, `'json'` |
| `field_label` | text | |
| `is_required` | boolean | |
| `default_value` | jsonb | |
| `validation_rules` | jsonb | |
| `display_config` | jsonb | |
| `ownership` | text | `'pack'` or `'tenant'` |
| `pack_id` | uuid FK | |

#### `link_type_definitions`
**Phase A:** Schema for allowed item-to-item link types.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `slug` | text | Unique per account |
| `name` | text | |
| `source_item_type` | text | **Phase A:** Items only |
| `target_item_type` | text | **Phase A:** Items only |
| `is_directional` | boolean | |
| `cardinality` | text | `'one_to_one'`, `'one_to_many'`, `'many_to_many'` |
| `constraints` | jsonb | |
| `ownership` | text | `'pack'` or `'tenant'` |
| `pack_id` | uuid FK | |

#### `item_type_registry`
**Phase A:** Central type registry for items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text UNIQUE | |
| `name` | text | |
| `description` | text | |
| `lifecycle_states` | text[] | **Phase A:** Defined states |
| `default_status` | text | Default `'active'` |
| `allowed_link_types` | text[] | **Phase A:** Allowed link slugs |
| `embedding_strategy` | jsonb | **Phase A:** Which fields to embed |
| `indexing_hints` | jsonb | **Phase A:** Query optimization |
| `permission_behavior` | jsonb | **Phase A:** Default permissions |
| `display_hints` | jsonb | |
| `is_system` | boolean | **Phase A:** Cannot be uninstalled |
| `ownership` | text | `'system'`, `'pack'`, `'tenant'` |
| `pack_id` | uuid FK | |
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

> **Note:** Legacy `account_modules` table was dropped in migration 043. Feature flags are now handled through the pack system.

---

### Phase C: Pack Lifecycle

#### `installed_packs`
**Phase C:** Registry of installed packs per account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_name` | text | Pack identifier |
| `pack_version` | text | Semver version |
| `manifest` | jsonb | Pack manifest data |
| `installed_at` | timestamptz | |
| `installed_by_principal_id` | uuid FK → principals | |
| `status` | text | `'active'`, `'upgrading'`, `'failed'`, `'uninstalled'` |

#### `pack_install_history`
**Phase C:** History of pack operations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_name` | text | |
| `operation` | text | `'install'`, `'upgrade'`, `'uninstall'`, `'rollback'` |
| `from_version` | text | |
| `to_version` | text | |
| `status` | text | `'success'`, `'failed'`, `'pending'` |
| `error_message` | text | |
| `executed_by_principal_id` | uuid FK → principals | |
| `executed_at` | timestamptz | |

#### `pack_dependencies`
**Phase C:** Dependency tracking for packs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_name` | text | |
| `dependency_name` | text | |
| `dependency_version` | text | Semver constraint |
| `is_satisfied` | boolean | |

#### `pack_rollback_snapshots`
**Phase C:** Snapshots for pack rollback.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_name` | text | |
| `version` | text | |
| `snapshot_data` | jsonb | Serialized state |
| `created_at` | timestamptz | |

#### `local_pack_manifests`
**Phase C:** Local pack manifests for development.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `pack_name` | text | |
| `manifest` | jsonb | |
| `status` | text | `'draft'`, `'valid'`, `'invalid'` |
| `validation_errors` | jsonb | |
| `created_by_principal_id` | uuid FK → principals | |

---

### Phase D: Agent System

#### `agent_contracts`
**Phase D:** Agent contract definitions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `description` | text | |
| `contract_type` | text | `'task'`, `'service'`, `'workflow'` |
| `status` | text | `'active'`, `'inactive'`, `'deprecated'` |
| `config` | jsonb | Contract configuration |
| `created_by_principal_id` | uuid FK → principals | |

#### `agent_executions`
**Phase D:** Execution tracking for agents.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `contract_id` | uuid FK → agent_contracts | |
| `status` | text | `'pending'`, `'running'`, `'completed'`, `'failed'` |
| `input_data` | jsonb | |
| `output_data` | jsonb | |
| `error_message` | text | |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | |
| `executed_by_principal_id` | uuid FK → principals | |

#### `agent_capabilities`
**Phase D:** Registry of agent capabilities.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `category` | text | `'analysis'`, `'generation'`, `'automation'` |
| `description` | text | |
| `input_schema` | jsonb | JSON schema for input |
| `output_schema` | jsonb | JSON schema for output |
| `is_system` | boolean | System-provided capability |

#### `agent_contract_capabilities`
**Phase D:** Many-to-many between contracts and capabilities.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK → agent_contracts | |
| `capability_id` | uuid FK → agent_capabilities | |

#### `extension_surfaces`
**Phase D:** Extension points for custom logic.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `surface_type` | text | `'hook'`, `'middleware'`, `'filter'` |
| `trigger_conditions` | jsonb | When to trigger |
| `handler_definition` | jsonb | Handler configuration |
| `is_active` | boolean | |
| `created_by_principal_id` | uuid FK → principals | |

#### `helper_utilities`
**Phase D:** Reusable helper functions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `category` | text | `'validation'`, `'transformation'`, `'calculation'` |
| `description` | text | |
| `input_schema` | jsonb | |
| `output_schema` | jsonb | |
| `implementation` | jsonb | Function implementation |
| `is_active` | boolean | |

---

### Phase E: Admin UI

#### `admin_audit_views`
**Phase E:** Configurable admin audit views.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `name` | text | |
| `description` | text | |
| `table_name` | text | Target table |
| `filters` | jsonb | Default filters |
| `columns` | jsonb | Column configuration |
| `sort_order` | jsonb | Default sorting |
| `is_favorite` | boolean | |
| `created_by_principal_id` | uuid FK → principals | |

#### `admin_alerts`
**Phase E:** System alerts for admin monitoring.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `title` | text | |
| `description` | text | |
| `severity` | text | `'low'`, `'medium'`, `'high'`, `'critical'` |
| `status` | text | `'open'`, `'acknowledged'`, `'resolved'` |
| `source` | text | Alert source |
| `metadata` | jsonb | Alert-specific data |
| `expires_at` | timestamptz | |
| `resolved_at` | timestamptz | |
| `resolved_by_principal_id` | uuid FK → principals | |
| `created_at` | timestamptz | |

#### `admin_dashboard_widgets`
**Phase E:** Customizable dashboard widgets.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `widget_type` | text | `'metric'`, `'chart'`, `'table'`, `'alert'` |
| `title` | text | |
| `data_source` | jsonb | Query configuration |
| `position` | jsonb | Grid position |
| `config` | jsonb | Widget-specific config |
| `refresh_interval` | integer | Seconds |
| `is_active` | boolean | |
| `created_by_principal_id` | uuid FK → principals | |

#### `admin_health_snapshots`
**Phase E:** Historical health metrics.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `snapshot_time` | timestamptz | |
| `metrics` | jsonb | Health metrics |
| `system_status` | jsonb | System-wide status |
| `created_at` | timestamptz | |

---

### System

> **Note:** Legacy `admin_counts` table was dropped in migration 043. Dashboard metrics are now handled through Phase E admin widgets.
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

#### `error_events`
**Phase A:** Captured runtime errors.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `request_id` | text | |
| `function_name` | text | |
| `error_code` | text | |
| `message` | text | |
| `stack` | text | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

#### `impersonation_sessions`
Active impersonation sessions for system admins.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `admin_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `target_principal_id` | uuid FK → principals | **Phase A:** Changed from person_id |
| `target_account_id` | uuid FK | |
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
