# Spine — Automation, Scheduling & Events

Spine's automation system reacts to events with rules, delivers webhooks from an outbox queue, and fires scheduled triggers on cron or countdown timers.

---

## Event-Driven Architecture

Every write operation in Spine produces up to three event records:

| Record | Table | Purpose |
|---|---|---|
| **Audit** | `audit_log` | Immutable before/after diff |
| **Activity** | `activity_events` | Human-readable feed entry |
| **Outbox** | `outbox_events` | Trigger for webhooks and automations |

```typescript
// Typical write pattern in a handler:
await emitAudit(ctx, 'update', 'item', itemId, before, after)
await emitActivity(ctx, 'item.updated', `Updated item "${title}"`, 'item', itemId)
await emitOutboxEvent(accountId, 'item.updated', 'item', itemId, { before, after })
```

### Event Types

Common event types emitted by the core:

| Event Type | When |
|---|---|
| `item.created` | New workflow item created |
| `item.updated` | Workflow item fields changed |
| `item.stage_changed` | Item moved to a different stage |
| `account.created` | New account created |
| `account.updated` | Account fields changed |
| `person.created` | New person created |
| `person.updated` | Person fields changed |
| `membership.created` | New membership |
| `membership.updated` | Membership role/status changed |
| `kb_article.created` | New KB article |
| `kb_article.updated` | KB article changed |
| `webhook.created` | New webhook subscription |
| `automation.executed` | Automation rule fired |
| `workflow_action.executed` | Workflow action fired |
| `scheduled_trigger.fired` | Scheduled trigger fired |

---

## Automation Rules

Automation rules are event-triggered actions scoped to an account.

### Data Model

```
automation_rules
  - account_id          (tenant scope)
  - workflow_definition_id  (optional — scope to a specific workflow)
  - name                (human label)
  - trigger_event       (e.g., 'item.stage_changed')
  - conditions          (JSONB array of condition objects)
  - action_type         (what to do)
  - action_config       (how to do it)
  - enabled             (boolean toggle)
```

### Creating via API

```
POST /api/automation-rules
{
  "name": "Auto-escalate high-priority items",
  "trigger_event": "item.created",
  "conditions": [
    { "field": "priority", "operator": "equals", "value": "critical" }
  ],
  "action_type": "webhook",
  "action_config": {
    "url": "https://hooks.slack.com/services/...",
  },
  "workflow_definition_id": "uuid"  // optional
}
```

### Creating via Admin UI

Go to **Admin → Automations** to create and manage rules.

### Execution Flow

When an outbox event is emitted, `evaluateAutomations()` runs immediately (synchronous, in the same request):

```
1. Query automation_rules WHERE account_id = X AND trigger_event = Y AND enabled = true
2. For each matching rule:
   a. Evaluate conditions against the event payload
   b. If conditions pass → execute the action
   c. Log an activity event: "Automation X triggered by Y"
3. Also evaluate countdown triggers (see below)
```

### Action Types

Automation rules support the same action types as workflow actions:

| Action Type | Description |
|---|---|
| `transition_stage` | Move an item to a specific stage (bypasses transition validation) |
| `emit_event` | Insert a new outbox event |
| `webhook` | POST to an external URL |
| `update_field` | Update a field on an entity |
| *(custom slug)* | Delegate to a registered custom action type handler |

### Conditions

Same condition system as workflow actions — see [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md#condition-evaluation).

```json
[
  { "field": "priority", "operator": "equals", "value": "high" },
  { "field": "metadata.department", "operator": "in", "value": ["engineering", "product"] }
]
```

---

## Outbox & Webhook Delivery

### Outbox Pattern

Every write emits to `outbox_events`. This table acts as a reliable event queue:

```
outbox_events
  - account_id
  - event_type       (e.g., 'item.created')
  - entity_type
  - entity_id
  - payload          (JSONB — full event data)
  - processed        (boolean — set true after delivery queued)
```

### Webhook Delivery Pipeline

The `webhook-deliver` function runs every 5 minutes (Netlify scheduled function):

```
1. Find unprocessed outbox events (processed = false)
2. For each event:
   a. Find matching webhook_subscriptions (same account, enabled, matching event_types)
   b. Create a webhook_deliveries row for each subscription (status = 'pending')
   c. Mark the outbox event as processed
3. Find pending deliveries (status = 'pending', next_attempt_at <= now)
4. For each delivery:
   a. Fetch the subscription (URL, signing secret)
   b. Build the payload
   c. Compute HMAC-SHA256 signature
   d. POST to the URL with signature header
   e. On success → status = 'success'
   f. On failure → increment attempts, compute backoff, set next_attempt_at
   g. After 5 failures → status = 'dead_letter'
```

### HMAC Signing

Every webhook delivery is signed:

```
Header: X-{AppName}-Signature: sha256={hmac_hex}
Header: X-{AppName}-Timestamp: {iso_timestamp}
Header: X-{AppName}-Event: {event_type}
Header: X-{AppName}-Delivery-Id: {delivery_id}
```

The signature is computed as:
```
HMAC-SHA256(signing_secret, JSON.stringify(payload))
```

Receivers should verify the signature to ensure authenticity.

### Retry & Backoff

The backoff formula computes `next_attempt_at` as `30000ms × 2^attempt`, but since `webhook-deliver` only runs every 5 minutes, the **effective minimum retry interval is 5 minutes** regardless of the computed delay. Shorter delays simply wait until the next scheduler run.

| Attempt | Computed Delay | Effective Delay |
|---|---|---|
| 1 | 30 seconds | ~5 minutes (next scheduler run) |
| 2 | 1 minute | ~5 minutes |
| 3 | 2 minutes | ~5 minutes |
| 4 | 4 minutes | ~5 minutes |
| 5 | 8 minutes | ~10 minutes |
| 6+ | — | Dead letter (no more retries) |

### Dead Letter

After `MAX_ATTEMPTS` (5) failures, the delivery moves to `dead_letter` status. Admins can view dead-letter deliveries in the webhooks admin page and manually replay them.

---

## Scheduled Triggers

Time-based triggers that fire independently of user actions.

### Trigger Types

| Type | Description | Schedule |
|---|---|---|
| `one_time` | Fires once at a specific time | `fire_at` timestamp |
| `recurring` | Fires repeatedly on a cron schedule | `cron_expression` |
| `countdown` | Fires after a delay, started by an event | `delay_event` + `delay_seconds` |

### Creating via API

```
POST /api/scheduled-triggers
{
  "name": "Weekly report",
  "trigger_type": "recurring",
  "cron_expression": "0 9 * * 1",
  "action_type": "webhook",
  "action_config": { "url": "https://..." },
  "conditions": [],
  "enabled": true
}
```

### Creating via Admin UI

Go to **Admin → Schedules** to create and manage triggers.

### Cron Expressions

Spine uses standard 5-field cron (minute, hour, day-of-month, month, day-of-week):

| Expression | Meaning |
|---|---|
| `*/15 * * * *` | Every 15 minutes |
| `0 9 * * 1-5` | 9:00 AM UTC weekdays |
| `0 0 1 * *` | Midnight on the 1st of each month |
| `30 */2 * * *` | Every 2 hours at minute 30 |

The cron parser (`_shared/cron.ts`) supports: numbers, ranges (`1-5`), steps (`*/15`), lists (`1,3,5`), wildcards (`*`).

All times are **UTC**. The admin UI displays cron schedules in UTC as well. If your users are in a different timezone, account for the offset when configuring schedules (e.g., `0 9 * * 1` fires at 9:00 AM UTC, which is 1:00 AM PST).

### Trigger Scheduler

The `trigger-scheduler` function runs every minute via Netlify scheduled function:

```
1. One-time triggers:
   - Find enabled triggers with fire_count = 0 and fire_at <= now
   - Evaluate conditions → execute action
   - Set enabled = false (one-time: disable after firing)

2. Recurring triggers:
   - Find enabled triggers with next_fire_at <= now
   - Evaluate conditions → execute action
   - Compute next_fire_at from cron expression
   - Increment fire_count

3. Trigger instances (from countdowns and schedule_timer actions):
   - Find pending instances with fire_at <= now
   - Execute the action with the stored context
   - Mark as 'fired'
```

### Countdown Triggers

Countdown triggers start their timer when a specific event occurs:

```json
{
  "name": "Follow-up reminder",
  "trigger_type": "countdown",
  "delay_event": "item.created",
  "delay_seconds": 86400,
  "action_type": "send_notification",
  "action_config": { "message": "Don't forget to follow up on {{title}}" },
  "conditions": [
    { "field": "item_type", "operator": "equals", "value": "lead" }
  ]
}
```

When `item.created` fires and conditions match, a `scheduled_trigger_instances` row is created with `fire_at = now + 86400 seconds`. The trigger scheduler picks it up when due.

### Schedule Timer (Workflow Action)

The `schedule_timer` workflow action type creates trigger instances inline:

```json
{
  "action_type": "schedule_timer",
  "action_config": {
    "delay_amount": 24,
    "delay_unit": "hours",
    "nested_action_type": "webhook",
    "nested_action_config": { "url": "https://..." }
  }
}
```

Delay units: `seconds`, `minutes`, `hours`, `days`.

---

## Audit Trail

### `emitAudit(ctx, action, entityType, entityId, before, after)`

Records an immutable before/after diff in `audit_log`:

```json
{
  "action": "update",
  "entity_type": "item",
  "entity_id": "uuid",
  "before_data": { "priority": "medium", "title": "Old Title" },
  "after_data": { "priority": "high", "title": "New Title" },
  "metadata": {
    "impersonated_by": "admin-person-id",  // if impersonating
    "impersonation_session_id": "uuid"
  }
}
```

### `emitActivity(ctx, eventType, summary, entityType?, entityId?, metadata?)`

Records a human-readable activity event:

```json
{
  "event_type": "item.updated",
  "summary": "Updated item \"Acme Deal\"",
  "entity_type": "item",
  "entity_id": "uuid"
}
```

### `emitOutboxEvent(accountId, eventType, entityType, entityId, payload)`

Queues an event for webhook delivery and automation evaluation:

```json
{
  "event_type": "item.stage_changed",
  "entity_type": "item",
  "entity_id": "uuid",
  "payload": { "before": {...}, "after": {...} }
}
```

---

## Error Handling

All scheduled functions log errors to the `error_log` table:

```typescript
await logError({
  requestId: runId,
  functionName: 'trigger-scheduler',
  errorCode: 'internal',
  message: err.message,
  stack: err.stack,
  accountId: trigger.account_id,
})
```

Admins can view errors in **Admin → System Health**.

---

## Related Documentation

- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Workflow actions and transitions
- [INTEGRATIONS.md](INTEGRATIONS.md) — Outbound/inbound webhook details
- [EXTENDING.md](EXTENDING.md) — Custom action types
- [DATA-MODEL.md](DATA-MODEL.md) — Event and automation tables
