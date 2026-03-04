# Spine — Integrations & Webhooks

Spine provides outbound webhooks, inbound webhooks, and an integration framework for connecting with external systems.

---

## Outbound Webhooks

Outbound webhooks deliver Spine events to external endpoints.

### Subscription Management

```
POST /api/webhook-subscriptions
{
  "url": "https://hooks.example.com/spine",
  "enabled": true,
  "event_types": ["item.created", "item.stage_changed"],
  "description": "Notify our CRM"
}
```

When created, a `signing_secret` is auto-generated (32 random hex bytes).

| Field | Description |
|---|---|
| `url` | Target endpoint |
| `enabled` | Toggle on/off |
| `event_types` | Filter — empty array means all events |
| `signing_secret` | HMAC-SHA256 key for signature verification |
| `description` | Human label |

### Delivery Lifecycle

```
outbox_events (written on every mutation)
      │
      ▼  webhook-deliver (runs every 5 minutes)
webhook_deliveries (one per subscription × event)
      │
      ▼  HTTP POST with HMAC signature
External endpoint
```

1. Every write emits to `outbox_events`
2. `webhook-deliver` (scheduled function) processes unprocessed events
3. For each event × matching subscription, a `webhook_deliveries` row is created
4. Pending deliveries are POSTed with HMAC signature
5. On failure: retry with exponential backoff (up to 5 attempts)
6. After max attempts: dead-letter

### Signature Verification

Every delivery includes these headers:

| Header | Value |
|---|---|
| `X-{AppName}-Signature` | `sha256={hmac_hex}` |
| `X-{AppName}-Timestamp` | ISO 8601 timestamp |
| `X-{AppName}-Event` | Event type (e.g., `item.created`) |
| `X-{AppName}-Delivery-Id` | Unique delivery ID |

`{AppName}` is derived from `VITE_APP_NAME` (default: `Spine`).

**Verification pseudocode:**
```python
expected = hmac_sha256(signing_secret, request_body)
actual = request.headers['X-Spine-Signature'].replace('sha256=', '')
assert constant_time_compare(expected, actual)
```

### Retry Policy

| Attempt | Backoff Delay |
|---|---|
| 1 | 30 seconds |
| 2 | 1 minute |
| 3 | 2 minutes |
| 4 | 4 minutes |
| 5 | 8 minutes |
| 6+ | Dead letter |

### Replay

Dead-letter deliveries can be replayed:

```
POST /api/webhook-deliveries?id=uuid
```

This resets the delivery to `pending` for re-attempt.

### Admin UI

**Admin → Webhooks** provides:
- Subscription list with enable/disable
- Signing secret reveal
- Delivery log with status, attempts, response
- Replay button for dead-letter deliveries

---

## Inbound Webhooks

Inbound webhooks allow external systems to push data into Spine via API key authentication.

### Architecture

```
External system
      │  POST with X-Api-Key header
      ▼
inbound-webhooks (Netlify function)
      │  Authenticate API key
      │  Look up mappings
      ▼
Execute mapping actions (create item, transition, emit event, etc.)
```

### API Keys

Create inbound webhook keys via **Admin → Inbound Hooks**:

```
POST /api/inbound-webhook-keys
{
  "name": "CRM Integration",
  "enabled": true
}
```

Returns an `api_key` that external systems use in the `X-Api-Key` header.

Key features:
- Auto-generated unique API keys
- Enable/disable toggle
- `last_used_at` tracking
- Key masking in API responses (only prefix + last 4 chars shown)

### Mappings

Mappings define how inbound data is processed:

```
POST /api/inbound-webhook-mappings
{
  "inbound_key_id": "uuid",
  "name": "Create Support Ticket",
  "action": "create_item",
  "action_config": {
    "workflow_definition_id": "uuid",
    "field_mapping": {
      "title": "{{payload.subject}}",
      "metadata.source": "crm",
      "metadata.external_id": "{{payload.id}}"
    }
  },
  "conditions": [
    { "field": "payload.type", "operator": "equals", "value": "support" }
  ],
  "enabled": true
}
```

### Mapping Actions

| Action | Description |
|---|---|
| `create_item` | Create a new workflow item |
| `update_item` | Update an existing item |
| `transition_item` | Move an item to a different stage |
| `create_entity` | Create a generic entity |
| `emit_event` | Emit a custom outbox event |

### Calling the Inbound Endpoint

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/inbound-webhooks \
  -H "X-Api-Key: spn_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "type": "support",
    "subject": "Login issue",
    "customer_email": "user@example.com"
  }'
```

The endpoint:
1. Authenticates the API key
2. Finds all enabled mappings for that key
3. Evaluates conditions against the payload
4. Executes matching actions
5. Returns results for each mapping

### Template Interpolation

Mapping configs support `{{path.to.value}}` templates resolved against `{ payload, ...payload }`:

```json
{
  "title": "{{payload.subject}}",
  "metadata.email": "{{payload.customer_email}}"
}
```

---

## Integration Framework

The integration framework provides a marketplace-like pattern for installable integrations.

### Integration Definitions

Global catalog entries (not tenant-scoped):

```sql
INSERT INTO integration_definitions (slug, name, icon, category, version, manifest)
VALUES (
  'slack',
  'Slack',
  'MessageSquare',
  'communication',
  '1.0.0',
  '{
    "description": "Send notifications to Slack channels",
    "config_fields": [
      { "key": "webhook_url", "label": "Slack Webhook URL", "type": "url", "required": true },
      { "key": "channel", "label": "Default Channel", "type": "text" }
    ],
    "capabilities": ["send_notification"],
    "docs_url": "https://..."
  }'
);
```

### Integration Instances

Per-tenant installations:

```
POST /api/integration-instances
{
  "action": "install",
  "definition_id": "uuid",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/...",
    "channel": "#alerts"
  }
}
```

Actions:
- `install` — create a new instance
- `configure` — update configuration
- `uninstall` — deactivate the instance

### Using Integrations in Custom Code

Custom functions can query integration instances to get tenant-specific config:

```typescript
const { data: instance } = await db
  .from('integration_instances')
  .select('*, integration_definitions(slug, manifest)')
  .eq('account_id', ctx.accountId)
  .eq('integration_definitions.slug', 'slack')
  .eq('is_active', true)
  .single()

if (instance) {
  const webhookUrl = instance.config.webhook_url
  // Use the integration config...
}
```

---

## Security

### SSRF Protection

All outbound URLs (webhooks, custom actions, integrations) are validated by `validateOutboundUrl()`:

**Blocked:**
- Non-HTTP(S) schemes (`file://`, `ftp://`, etc.)
- `localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`
- Private IP ranges: `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`
- Cloud metadata endpoints: `169.254.169.254`, `*.internal`
- IPv6 private ranges: `fc00:`, `fd`, `fe80:`

### Table/Field Allowlists

Dynamic entity operations (from workflow actions and automations) are restricted:

**Allowed tables:** `items`, `threads`, `knowledge_base_articles`, `entity_links`

**Blocked fields:** `id`, `account_id`, `auth_uid`, `system_role`, `account_role`, `api_key`, `token`, `signing_secret`, `created_at`

### API Key Masking

API keys are masked in responses to prevent accidental exposure:

```
"spn_abc123...ef01"
```

Only the first 8 and last 4 characters are shown.

### Timeouts

| Context | Timeout |
|---|---|
| Webhook delivery | 10 seconds |
| Custom action handler | 15 seconds |
| AI prompt (OpenAI) | 30 seconds |
| Automation webhook | 5 seconds |

---

## Related Documentation

- [AUTOMATION.md](AUTOMATION.md) — Outbox events and automation triggers
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Webhook and custom action types
- [EXTENDING.md](EXTENDING.md) — Custom action types and integration patterns
- [ENVIRONMENT.md](ENVIRONMENT.md) — Email provider configuration
