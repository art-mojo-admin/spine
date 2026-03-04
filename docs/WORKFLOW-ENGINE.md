# Spine — Workflow Engine

The workflow engine is Spine's core state machine system. It manages workflow definitions, stages, transitions, items, and actions.

---

## Data Model

```
workflow_definitions
  └── stage_definitions          (stages within a workflow)
  └── transition_definitions     (allowed moves between stages)
  └── workflow_actions           (actions triggered by events)
  └── items                      (actual work objects)
```

### Workflow Definitions

The blueprint for a workflow. Each account can have multiple workflows (e.g., "Sales Pipeline", "Support Tickets", "Hiring").

```
POST /api/workflow-definitions
{
  "name": "Sales Pipeline",
  "description": "Track deals through the sales process",
  "workflow_type": "pipeline",
  "config": { "allow_public_submission": false }
}
```

Key fields:
- `name` — display name
- `workflow_type` — free-form label for classification
- `config` — workflow-level settings (JSONB)
- `status` — lifecycle status
- `is_active` — soft-delete flag

### Stage Definitions

Named stages within a workflow. Items move between stages via transitions.

```
POST /api/stage-definitions
{
  "workflow_definition_id": "uuid",
  "name": "Qualification",
  "position": 2,
  "is_initial": false,
  "is_terminal": false,
  "color": "#3b82f6",
  "config": {}
}
```

Key fields:
- `position` — display/sort order
- `is_initial` — marks the entry stage (new items start here)
- `is_terminal` — marks end stages (items here are "done")
- `color` — UI color for kanban/builder

### Transition Definitions

Define which stage-to-stage moves are allowed.

```
POST /api/transition-definitions
{
  "workflow_definition_id": "uuid",
  "from_stage_id": "uuid",
  "to_stage_id": "uuid",
  "name": "Qualify",
  "conditions": [],
  "config": {}
}
```

Key fields:
- `from_stage_id` / `to_stage_id` — the source and destination stages
- `name` — human-readable label (e.g., "Approve", "Reject", "Escalate")
- `conditions` — conditions that must be met before the transition is allowed

### Items

The actual work objects that move through workflows.

```
POST /api/workflow-items
{
  "workflow_definition_id": "uuid",
  "title": "Acme Corp Deal",
  "item_type": "deal",
  "priority": "high",
  "metadata": { "amount": 50000, "contact": "john@acme.com" }
}
```

When an item is created, it's automatically placed in the workflow's initial stage.

Key fields:
- `stage_definition_id` — current stage (updated on transition)
- `item_type` — free-form classification
- `assigned_to_person_id` — person responsible
- `metadata` — custom field values (JSONB)

---

## Stage Transitions

When an item's `stage_definition_id` is changed (via PATCH), the workflow engine:

1. **Validates** the transition is allowed (checks `transition_definitions`)
2. **Records** the transition in audit log
3. **Emits** an `item.stage_changed` outbox event
4. **Executes** any workflow actions with `trigger_type: 'on_transition'` for the matching transition
5. **Evaluates** automation rules listening for `item.stage_changed`

### Transition Validation

The `workflow-items.ts` PATCH handler checks:

```
from_stage_id → to_stage_id
```

If no matching `transition_definitions` row exists, the transition is rejected with 400.

---

## Workflow Actions

Actions are triggered automatically by workflow events. They are defined per-workflow and execute in `position` order.

### Trigger Types

| Trigger | When It Fires |
|---|---|
| `on_create` | When a new item is created in this workflow |
| `on_transition` | When an item transitions to/from a specific stage |
| `on_update` | When an item is updated |

For `on_transition`, the `trigger_ref_id` links to a specific stage or transition definition.

### Built-In Action Types

| Action Type | What It Does |
|---|---|
| `webhook` | Sends an HTTP POST to a URL |
| `update_field` | Updates a field on an entity |
| `emit_event` | Inserts a new outbox event |
| `ai_prompt` | Calls OpenAI and optionally stores the result |
| `send_email` | Sends email via Resend, SendGrid, or webhook |
| `send_notification` | Creates an activity event (in-app notification) |
| `create_entity` | Creates a new entity (item, thread, etc.) |
| `create_link` | Creates an entity link between two records |
| `schedule_timer` | Schedules a future action execution |
| *(custom slug)* | Delegates to a registered custom action type handler URL |

### Action Configuration

Each action type has its own `action_config` schema:

#### `webhook`
```json
{
  "url": "https://hooks.example.com/notify",
  "method": "POST",
  "headers": { "X-Custom": "value" },
  "body_template": { "item": "{{title}}", "stage": "{{stage_name}}" }
}
```

#### `update_field`
```json
{
  "entity_table": "items",
  "field": "priority",
  "value": "high"
}
```

#### `emit_event`
```json
{
  "event_type": "deal.qualified",
  "entity_type": "item",
  "entity_id": "{{entity_id}}"
}
```

#### `ai_prompt`
```json
{
  "system_prompt": "You are a deal scoring assistant.",
  "user_prompt": "Score this deal: {{title}} worth ${{metadata.amount}}",
  "model": "gpt-4o-mini",
  "result_target": "ai_score",
  "entity_table": "items",
  "result_actions": [
    { "type": "update_field", "field": "priority", "source": "priority" }
  ]
}
```

#### `send_email`
```json
{
  "to": "{{metadata.contact_email}}",
  "subject": "Your request has been approved",
  "body_html": "<p>Hello {{metadata.contact_name}}, ...</p>",
  "provider": "resend"
}
```

#### `send_notification`
```json
{
  "message": "Item \"{{title}}\" has been escalated",
  "channel": "activity"
}
```

#### `create_entity`
```json
{
  "entity_type": "item",
  "field_mapping": {
    "title": "Follow-up: {{title}}",
    "workflow_definition_id": "uuid",
    "item_type": "task"
  }
}
```

#### `create_link`
```json
{
  "source_type": "item",
  "source_id": "{{entity_id}}",
  "target_type": "person",
  "target_id": "{{assigned_to_person_id}}",
  "link_type": "assigned-to"
}
```

#### `schedule_timer`
```json
{
  "delay_amount": 24,
  "delay_unit": "hours",
  "nested_action_type": "webhook",
  "nested_action_config": { "url": "https://..." }
}
```

---

## Template Interpolation

Action configurations support `{{path.to.value}}` template syntax. The interpolation engine resolves values from the trigger payload:

```typescript
function interpolateTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = getNestedValue(context, path.trim())
    return value !== undefined && value !== null ? String(value) : ''
  })
}
```

### Available Context

The payload passed to actions includes:

| Field | Description |
|---|---|
| `entity_id` / `id` | The item ID |
| `title` | Item title |
| `item_type` | Item type |
| `priority` | Item priority |
| `status` | Item status |
| `metadata.*` | Any custom field value |
| `stage_definition_id` | Current stage ID |
| `assigned_to_person_id` | Assigned person |
| `after.*` | Full item state after change |
| `before.*` | Full item state before change (on update) |

### Examples

```
"{{title}}"                    → "Acme Corp Deal"
"{{metadata.amount}}"          → "50000"
"{{after.priority}}"           → "high"
"{{metadata.contact.email}}"   → "john@acme.com"
```

---

## Condition Evaluation

Both workflow actions and automation rules support conditions that gate execution:

```json
{
  "conditions": [
    { "field": "priority", "operator": "equals", "value": "high" },
    { "field": "metadata.amount", "operator": "gte", "value": 10000 }
  ]
}
```

### Operators

| Operator | Description |
|---|---|
| `equals` | Exact match |
| `not_equals` | Not equal |
| `contains` | String contains substring |
| `in` | Value is in array |
| `exists` | Value is not null/undefined |
| `not_exists` | Value is null/undefined |
| `gt` | Greater than (numeric) |
| `lt` | Less than (numeric) |
| `gte` | Greater than or equal (numeric) |
| `lte` | Less than or equal (numeric) |

All conditions are evaluated with **AND** logic — all must pass for the action to execute.

---

## Execution Flow

### Item Creation

```
POST /api/workflow-items
  1. Insert item with initial stage
  2. emitAudit('create', 'item', ...)
  3. emitActivity('item.created', ...)
  4. emitOutboxEvent('item.created', ...)
  5. executeWorkflowActions(workflowDefId, 'on_create', null, ctx, payload)
  6. evaluateAutomations(accountId, 'item.created', ctx, payload)
  7. autoEmbed(accountId, 'item', itemId, title)
```

### Stage Transition

```
PATCH /api/workflow-items?id=uuid  (with stage_definition_id change)
  1. Validate transition exists in transition_definitions
  2. Update item stage
  3. emitAudit('update', 'item', before, after)
  4. emitActivity('item.stage_changed', ...)
  5. emitOutboxEvent('item.stage_changed', ...)
  6. executeWorkflowActions(workflowDefId, 'on_transition', transitionDefId, ctx, payload)
  7. evaluateAutomations(accountId, 'item.stage_changed', ctx, payload)
```

### Item Update (no stage change)

```
PATCH /api/workflow-items?id=uuid
  1. Update item fields
  2. emitAudit('update', 'item', before, after)
  3. emitActivity('item.updated', ...)
  4. emitOutboxEvent('item.updated', ...)
  5. executeWorkflowActions(workflowDefId, 'on_update', null, ctx, payload)
  6. evaluateAutomations(accountId, 'item.updated', ctx, payload)
```

---

## Visual Workflow Builder

The Workflow Builder (`/admin/workflows/:workflowId/builder`) provides a drag-and-drop editor built on React Flow:

- **Nodes** = stages (with color, position, initial/terminal flags)
- **Edges** = transitions (with name, conditions)
- **Auto-layout** via dagre algorithm
- Changes are saved to the database via the stage/transition definition APIs

---

## Security

The workflow engine enforces:

- **Table allowlist** — dynamic operations only allowed on: `items`, `threads`, `knowledge_base_articles`, `entity_links`
- **Field blocklist** — cannot update: `id`, `account_id`, `auth_uid`, `system_role`, `account_role`, `api_key`, `token`, `signing_secret`, `created_at`
- **SSRF protection** — outbound URLs validated against blocked hosts and private IP ranges
- **Timeout** — all outbound fetches have a 10–30 second timeout

---

## Related Documentation

- [AUTOMATION.md](AUTOMATION.md) — Automation rules that react to workflow events
- [EXTENDING.md](EXTENDING.md) — Custom action types
- [DATA-MODEL.md](DATA-MODEL.md) — Workflow tables schema
- [AI-AND-EMBEDDINGS.md](AI-AND-EMBEDDINGS.md) — AI prompt action details
