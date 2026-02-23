# Spine API Reference

All endpoints are under `/.netlify/functions/` (proxied to `/api/` via netlify.toml).

## Authentication

Every request must include:
- `Authorization: Bearer <supabase_jwt>`
- `X-Request-Id: <uuid>` (optional, auto-generated if missing)
- `X-Account-Id: <uuid>` (optional, to select tenant context)

## Endpoints

### `GET /api/me`
Returns current person, profile, and memberships.

### Accounts
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/accounts` | `?id=<uuid>` | auth |
| `POST` | `/api/accounts` | body: `{ display_name, account_type }` | auth |
| `PATCH` | `/api/accounts` | `?id=<uuid>` body: `{ display_name?, status?, settings? }` | admin |

### Persons
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/persons` | `?id=<uuid>` | auth+tenant |
| `POST` | `/api/persons` | body: `{ email, full_name, display_name? }` | admin |
| `PATCH` | `/api/persons` | `?id=<uuid>` body: `{ full_name?, email?, status? }` | admin |

### Memberships
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/memberships` | — | auth+tenant |
| `POST` | `/api/memberships` | body: `{ person_id, account_role? }` | admin |
| `PATCH` | `/api/memberships` | `?id=<uuid>` body: `{ account_role?, status? }` | admin |
| `DELETE` | `/api/memberships` | `?id=<uuid>` | admin |

### Workflow Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/workflow-definitions` | `?id=<uuid>` | auth+tenant |
| `POST` | `/api/workflow-definitions` | body: `{ name, description?, config? }` | admin/operator |
| `PATCH` | `/api/workflow-definitions` | `?id=<uuid>` body: `{ name?, description?, status?, config? }` | admin/operator |
| `DELETE` | `/api/workflow-definitions` | `?id=<uuid>` | admin |

### Stage Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/stage-definitions` | `?workflow_definition_id=<uuid>` | auth+tenant |
| `POST` | `/api/stage-definitions` | body: `{ workflow_definition_id, name, position?, is_initial?, is_terminal?, allowed_transitions? }` | admin/operator |
| `PATCH` | `/api/stage-definitions` | `?id=<uuid>` body: field updates | admin/operator |
| `DELETE` | `/api/stage-definitions` | `?id=<uuid>` | admin |

### Workflow Items
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/workflow-items` | `?id=<uuid>` `?workflow_definition_id=<uuid>` | auth+tenant |
| `POST` | `/api/workflow-items` | body: `{ workflow_definition_id, title, workflow_type, ... }` | admin/operator |
| `PATCH` | `/api/workflow-items` | `?id=<uuid>` body: field updates (stage_definition_id triggers transition validation) | admin/operator |

### Tickets
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/tickets` | `?id=<uuid>` `?status=<str>` | auth+tenant |
| `POST` | `/api/tickets` | body: `{ subject, priority?, category?, assigned_to_person_id? }` | auth+tenant |
| `PATCH` | `/api/tickets` | `?id=<uuid>` body: `{ subject?, status?, priority?, category?, assigned_to_person_id? }` | auth+tenant |

### Ticket Messages
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/ticket-messages` | `?ticket_id=<uuid>` | auth+tenant |
| `POST` | `/api/ticket-messages` | body: `{ ticket_id, body, is_internal? }` | auth+tenant |

### Knowledge Base Articles
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/kb-articles` | `?id=<uuid>` `?status=<str>` | auth+tenant |
| `POST` | `/api/kb-articles` | body: `{ title, body?, slug?, status?, category? }` | admin/operator |
| `PATCH` | `/api/kb-articles` | `?id=<uuid>` body: field updates | admin/operator |
| `DELETE` | `/api/kb-articles` | `?id=<uuid>` | admin |

### Activity Events
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/activity-events` | `?event_type=&entity_type=&entity_id=&limit=` | auth+tenant |

### Audit Log
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/audit-log` | `?entity_type=&entity_id=&action=&limit=` | admin |

### Themes
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/themes` | — | auth+tenant |
| `POST` | `/api/themes` | body: `{ preset?, tokens?, dark_tokens?, logo_url? }` | admin |

### Settings
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/settings` | — | auth+tenant |
| `PATCH` | `/api/settings` | body: key-value pairs to merge | admin |

### Webhook Subscriptions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/webhook-subscriptions` | `?id=<uuid>` | admin |
| `POST` | `/api/webhook-subscriptions` | body: `{ url, enabled?, event_types?, description? }` | admin |
| `PATCH` | `/api/webhook-subscriptions` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/webhook-subscriptions` | `?id=<uuid>` | admin |

### Webhook Deliveries
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/webhook-deliveries` | `?webhook_subscription_id=&status=` | admin |
| `POST` | `/api/webhook-deliveries` | `?id=<uuid>` (replay) | admin |

### Embeddings
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `POST` | `/api/embeddings` | body: `{ entity_type, entity_id, vector_type, content?, embedding?, metadata?, model? }` | auth+tenant |
| `POST` | `/api/embeddings?action=search` | body: `{ query, entity_type?, vector_type?, limit? }` | auth+tenant |

## Example Requests

```bash
# Get current user
curl -H "Authorization: Bearer $TOKEN" http://localhost:8888/api/me

# Create a ticket
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Login broken","priority":"high"}' \
  http://localhost:8888/api/tickets

# Search embeddings
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"how to reset password","entity_type":"kb_article","vector_type":"body"}' \
  "http://localhost:8888/api/embeddings?action=search"
```
