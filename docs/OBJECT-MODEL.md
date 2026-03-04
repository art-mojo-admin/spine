# Spine — Unified Object Model

Everything in Spine is built from five core primitives. Domain-specific "apps" like CRM, Support, and HR are configurations on top of these primitives — not separate systems.

---

## The Five Primitives

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACCOUNTS                                 │
│  Tenants. Organizations. Teams. Hierarchical via account_paths. │
└───────────────────────────┬─────────────────────────────────────┘
                            │ memberships (role-based)
┌───────────────────────────▼─────────────────────────────────────┐
│                        PERSONS                                  │
│  People. Users. Contacts. Candidates. Customers.                │
│  Identity + profile + memberships across accounts.              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ owns / assigned to
┌───────────────────────────▼─────────────────────────────────────┐
│                         ITEMS                                   │
│  The universal work object. Moves through workflow stages.      │
│  Deals, tickets, tasks, articles, courses, leads, jobs —       │
│  all are items with different item_type + metadata.             │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐       │
│  │ title       │  │ item_type    │  │ metadata (JSONB) │       │
│  │ status      │  │ priority     │  │ • body           │       │
│  │ stage_id    │  │ workflow_id  │  │ • slug           │       │
│  │ assigned_to │  │ parent_id    │  │ • amount         │       │
│  │ due_date    │  │ description  │  │ • any fields...  │       │
│  └─────────────┘  └──────────────┘  └─────────────────┘       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ linked to
┌───────────────────────────▼─────────────────────────────────────┐
│                     THREADS + MESSAGES                          │
│  Conversations attached to any entity.                          │
│  Support threads, deal notes, article comments, internal chat.  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      ENTITY LINKS                               │
│  Typed relationships between any two entities.                  │
│  "assigned-to", "related-to", "contains", "enrolled",          │
│  "completed", "blocked-by" — all are links with metadata.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Items: The Universal Work Object

Items are the heart of Spine. Every "thing" that moves through a process is an item:

| Domain Concept | `item_type` | Key Metadata |
|---|---|---|
| Support ticket | `ticket` | `metadata.category`, `metadata.sla_level` |
| Sales deal | `deal` | `metadata.amount`, `metadata.company`, `metadata.stage_probability` |
| Task | `task` | `metadata.checklist`, `metadata.effort_hours` |
| Document/Article | `article` | `metadata.body` (markdown), `metadata.slug`, `metadata.category` |
| Course | `course` | `metadata.body` (description), `metadata.slug` |
| Lesson | `lesson` | `metadata.body` (content), `metadata.position` |
| Job posting | `job` | `metadata.department`, `metadata.location`, `metadata.salary_range` |
| Lead | `lead` | `metadata.source`, `metadata.score` |
| Bug report | `bug` | `metadata.severity`, `metadata.reproduction_steps` |
| Feature request | `feature` | `metadata.votes`, `metadata.target_release` |

The `item_type` field is free-form — Spine doesn't enforce a fixed set. Your vertical product defines what types exist via workflow definitions and custom fields.

### Items Get Everything for Free

Because items are the core primitive, every item automatically has:

| Capability | How |
|---|---|
| **Workflow stages** | `stage_definition_id` — items move through defined stages |
| **Stage transitions** | Validated moves with conditions and actions |
| **Automations** | Rules triggered by `item.created`, `item.updated`, `item.stage_changed` |
| **Custom fields** | Rendered via `custom_field_definitions` for `entity_type: 'item'` |
| **Threaded discussion** | `ThreadPanel` component, linked via threads table |
| **File attachments** | `EntityAttachmentsPanel` component |
| **Entity links** | `EntityLinksPanel` — relate to persons, other items, accounts |
| **Watchers** | `WatchButton` — subscribe to changes |
| **Audit trail** | Every change logged in `audit_log` |
| **Activity feed** | Every change visible in `activity_events` |
| **Webhooks** | Every change emitted via `outbox_events` |
| **AI embeddings** | Auto-indexed for semantic search |
| **Views** | Displayable in list, board, kanban, dashboard views |
| **Parent/child** | `parent_item_id` for hierarchical items |

---

## How "Apps" Are Configurations

A Spine "app" (like CRM or Support) is not separate code. It's a **configuration** composed of:

```
App Definition ("CRM")
  ├── Workflow Definition ("Sales Pipeline")
  │     ├── Stage Definitions (Prospecting → Qualification → Proposal → Closed Won/Lost)
  │     ├── Transition Definitions (allowed moves between stages)
  │     └── Workflow Actions (on_create → send welcome email, on_transition → notify Slack)
  ├── Workflow Definition ("Lead Nurturing")
  │     └── ...
  ├── View Definitions
  │     ├── "Pipeline" (kanban view, filtered to item_type: 'deal')
  │     ├── "All Deals" (list view, filtered to item_type: 'deal')
  │     └── "Leads" (list view, filtered to item_type: 'lead')
  ├── Nav Items (sidebar entries pointing to views)
  ├── Custom Field Definitions (entity_type: 'item', for deal/lead fields)
  ├── Link Type Definitions ("assigned-to", "related-deal")
  ├── Automation Rules (on deal.stage_changed → update forecast)
  └── Scheduled Triggers (weekly pipeline report)
```

All of this is **data in the database**, not code. It can be:
- Created manually via the admin UI
- Installed from a config pack
- Modified per-tenant without touching source code
- Exported and shared between accounts

---

## Entity Links: The Relationship Layer

Entity links connect any two entities with a typed, metadata-rich relationship:

```
┌──────────┐     enrolled      ┌──────────┐
│  Person  │ ──────────────► │  Course   │
│  (person)│                   │  (item)   │
└──────────┘                   └──────────┘

┌──────────┐     completed     ┌──────────┐
│  Person  │ ──────────────► │  Lesson   │
│  (person)│                   │  (item)   │
└──────────┘                   └──────────┘

┌──────────┐     contains      ┌──────────┐
│  Course  │ ──────────────► │  Lesson   │
│  (item)  │                   │  (item)   │
└──────────┘                   └──────────┘

┌──────────┐    assigned-to    ┌──────────┐
│  Deal    │ ──────────────► │  Person   │
│  (item)  │                   │  (person) │
└──────────┘                   └──────────┘

┌──────────┐    blocked-by     ┌──────────┐
│  Task    │ ──────────────► │  Task     │
│  (item)  │                   │  (item)   │
└──────────┘                   └──────────┘
```

Link types are defined per-account via `link_type_definitions`. Links can carry metadata (e.g., `position` for ordering, `completed_at` for timestamps).

---

## Threads: Universal Conversations

Threads attach to any entity via `target_type` + `target_id`:

| Scenario | Thread Attached To |
|---|---|
| Support ticket discussion | Item (item_type: 'ticket') |
| Deal notes | Item (item_type: 'deal') |
| Article comments | Item (item_type: 'article') |
| Internal team chat | Account or custom target |

Messages within threads support:
- `is_internal` flag — hidden from portal users
- `person_id` — message author
- `metadata` — attachments, mentions, etc.

---

## Views: Configuration-Driven UI

Instead of writing custom pages for each domain, Spine uses **view definitions** to render data:

| View Type | Use Case |
|---|---|
| `list` | Table of items with sortable columns |
| `board` | Kanban board grouped by stage |
| `dashboard` | Widget-based overview |
| `detail` | Single entity detail |
| `chart` | Visualizations |

A view definition specifies `target_type`, `target_filter`, `columns`, and `config`. The `ViewRenderer` component handles the rest.

**Example:** A "Published Articles" view:
```json
{
  "slug": "published-articles",
  "name": "Published Articles",
  "view_type": "list",
  "target_type": "item",
  "target_filter": { "item_type": "article" },
  "config": { "sort_by": "updated_at", "sort_dir": "desc" }
}
```

---

## The Rule

> **If you're tempted to create a new table, ask: "Can this be an item with a type, some metadata, and some links?"**
>
> Almost always, the answer is yes.

Items + metadata + links + threads + views can model:
- CRM pipelines
- Support ticketing
- Project management
- Content management
- Course platforms
- HR recruiting
- Inventory tracking
- Approval workflows
- Any process with stages, people, and data

The power is in the **configuration**, not the code.

---

## Related Documentation

- [DATA-MODEL.md](DATA-MODEL.md) — Full table schemas
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Stages, transitions, and actions
- [APPS-AND-VIEWS.md](APPS-AND-VIEWS.md) — App and view definitions
- [EXTENDING.md](EXTENDING.md) — Custom fields, action types, and integrations
- [CONFIG-PACKS.md](CONFIG-PACKS.md) — Packaging configurations as reusable templates
