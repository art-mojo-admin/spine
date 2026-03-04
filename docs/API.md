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

### Transition Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/transition-definitions` | `?workflow_definition_id=<uuid>` | auth+tenant |
| `POST` | `/api/transition-definitions` | body: `{ workflow_definition_id, from_stage_id, to_stage_id, name, conditions?, config? }` | admin/operator |
| `PATCH` | `/api/transition-definitions` | `?id=<uuid>` body: field updates | admin/operator |
| `DELETE` | `/api/transition-definitions` | `?id=<uuid>` | admin |

### Workflow Actions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/workflow-actions` | `?workflow_definition_id=<uuid>` | auth+tenant |
| `POST` | `/api/workflow-actions` | body: `{ workflow_definition_id, name, trigger_type, action_type, action_config, conditions?, position? }` | admin/operator |
| `PATCH` | `/api/workflow-actions` | `?id=<uuid>` body: field updates | admin/operator |
| `DELETE` | `/api/workflow-actions` | `?id=<uuid>` | admin |

### Automation Rules
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/automation-rules` | `?workflow_definition_id=<uuid>` | admin |
| `POST` | `/api/automation-rules` | body: `{ name, trigger_event, conditions?, action_type, action_config, workflow_definition_id?, enabled? }` | admin |
| `PATCH` | `/api/automation-rules` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/automation-rules` | `?id=<uuid>` | admin |

### Threads
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/threads` | `?id=<uuid>` `?thread_type=<str>` | auth+tenant |
| `POST` | `/api/threads` | body: `{ thread_type, subject?, metadata? }` | auth+tenant |
| `PATCH` | `/api/threads` | `?id=<uuid>` body: field updates | auth+tenant |

### Messages
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/messages` | `?thread_id=<uuid>` | auth+tenant |
| `POST` | `/api/messages` | body: `{ thread_id, body, is_internal? }` | auth+tenant |

### Entity Links
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/entity-links` | `?entity_type=&entity_id=` `?link_type=` `?direction=source\|target` | auth+tenant |
| `POST` | `/api/entity-links` | body: `{ source_type, source_id, target_type, target_id, link_type, metadata? }` | auth+tenant |
| `PATCH` | `/api/entity-links` | `?id=<uuid>` body: field updates | auth+tenant |
| `DELETE` | `/api/entity-links` | `?id=<uuid>` | auth+tenant |

### Link Type Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/link-type-definitions` | — | auth+tenant |
| `POST` | `/api/link-type-definitions` | body: `{ slug, name, source_type, target_type, config? }` | admin |
| `PATCH` | `/api/link-type-definitions` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/link-type-definitions` | `?id=<uuid>` | admin |

### Custom Field Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/custom-field-definitions` | `?entity_type=<str>` | auth+tenant |
| `POST` | `/api/custom-field-definitions` | body: `{ entity_type, name, field_type, config?, position? }` | admin |
| `PATCH` | `/api/custom-field-definitions` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/custom-field-definitions` | `?id=<uuid>` | admin |

### Custom Action Types
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/custom-action-types` | — | auth+tenant |
| `POST` | `/api/custom-action-types` | body: `{ slug, name, handler_url, description?, config_schema? }` | admin |
| `PATCH` | `/api/custom-action-types` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/custom-action-types` | `?id=<uuid>` | admin |

### Entity Attachments
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/entity-attachments` | `?entity_type=&entity_id=` | auth+tenant |
| `POST` | `/api/entity-attachments` | body: `{ entity_type, entity_id, file_name, file_url, file_type?, file_size? }` | auth+tenant |
| `DELETE` | `/api/entity-attachments` | `?id=<uuid>` | auth+tenant |

### Entity Watchers
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/entity-watchers` | `?entity_type=&entity_id=` | auth+tenant |
| `POST` | `/api/entity-watchers` | body: `{ entity_type, entity_id }` | auth+tenant |
| `DELETE` | `/api/entity-watchers` | `?id=<uuid>` | auth+tenant |

### App Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/app-definitions` | `?id=<uuid>` `?slug=<str>` | auth+tenant |
| `POST` | `/api/app-definitions` | body: `{ slug, name, icon?, min_role?, app_position?, nav_items? }` or `{ action: "clone", source_id }` | admin |
| `PATCH` | `/api/app-definitions` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/app-definitions` | `?id=<uuid>` | admin |

### View Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/view-definitions` | `?id=<uuid>` `?slug=<str>` `?view_type=` `?target_type=` | auth+tenant |
| `POST` | `/api/view-definitions` | body: `{ slug, name, view_type, target_type?, target_filter?, columns?, config? }` | admin |
| `PATCH` | `/api/view-definitions` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/view-definitions` | `?id=<uuid>` | admin |

### Account Modules
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/account-modules` | — | auth+tenant |
| `POST` | `/api/account-modules` | body: `{ module_slug, enabled?, config? }` | admin |
| `PATCH` | `/api/account-modules` | `?id=<uuid>` body: `{ enabled?, config? }` | admin |

### Account Nodes
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/account-nodes` | `?node_id=<uuid>` | auth+tenant |

Returns the current node, its ancestors (breadcrumb path), and child accounts.

### Compute Nav
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/compute-nav` | `?role=<str>` (preview as role, admin only) | auth+tenant |

Returns filtered nav items and visible apps for the current user.

### Admin Counts
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/admin-counts` | — | admin |

Returns entity counts for the sidebar (workflows, members, automations, etc.).

### Config Packs
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/config-packs` | `?id=<uuid>` | auth+tenant |
| `POST` | `/api/config-packs` | body: `{ action: "install"\|"uninstall"\|"activate"\|"deactivate"\|"sync", pack_id }` | admin |

### Scheduled Triggers
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/scheduled-triggers` | `?id=<uuid>` | admin |
| `POST` | `/api/scheduled-triggers` | body: `{ name, trigger_type, cron_expression?, fire_at?, delay_event?, delay_seconds?, action_type, action_config, conditions?, enabled? }` | admin |
| `PATCH` | `/api/scheduled-triggers` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/scheduled-triggers` | `?id=<uuid>` | admin |

### Inbound Webhook Keys
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/inbound-webhook-keys` | — | admin |
| `POST` | `/api/inbound-webhook-keys` | body: `{ name, enabled? }` | admin |
| `PATCH` | `/api/inbound-webhook-keys` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/inbound-webhook-keys` | `?id=<uuid>` | admin |

### Inbound Webhook Mappings
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/inbound-webhook-mappings` | `?inbound_key_id=<uuid>` | admin |
| `POST` | `/api/inbound-webhook-mappings` | body: `{ inbound_key_id, name, action, action_config, conditions?, enabled? }` | admin |
| `PATCH` | `/api/inbound-webhook-mappings` | `?id=<uuid>` body: field updates | admin |
| `DELETE` | `/api/inbound-webhook-mappings` | `?id=<uuid>` | admin |

### Inbound Webhooks (External Endpoint)
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `POST` | `/api/inbound-webhooks` | body: any JSON payload | X-Api-Key header |

Processes inbound data through matching mappings. No JWT required — uses API key auth.

### Invites
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/invites` | — | admin |
| `POST` | `/api/invites` | body: `{ email, account_role? }` | admin |
| `DELETE` | `/api/invites` | `?id=<uuid>` | admin |

### Impersonation
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/impersonate` | — (returns active session) | system_admin |
| `POST` | `/api/impersonate` | body: `{ target_person_id, target_account_id, reason? }` | system_admin |
| `DELETE` | `/api/impersonate` | `?session_id=<uuid>` | system_admin |

### Provision User
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `POST` | `/api/provision-user` | body: `{ invite_token?, account_slug? }` | auth (no tenant required) |

Auto-provisions a new person, profile, and account on first login.

### Integration Definitions
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/integration-definitions` | — | auth+tenant |

### Integration Instances
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/integration-instances` | `?id=<uuid>` | auth+tenant |
| `POST` | `/api/integration-instances` | body: `{ action: "install"\|"configure"\|"uninstall", definition_id?, config? }` | admin |

### Tenant Settings
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/tenant-settings` | — | auth+tenant |
| `PATCH` | `/api/tenant-settings` | body: key-value pairs to merge | admin |

### AI Invoke
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `POST` | `/api/ai-invoke` | body: `{ system_prompt?, user_prompt, model? }` | auth+tenant |

### Admin Reports
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/admin-reports` | `?report_type=<str>` | admin |

### Metrics Rollup
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/metrics-rollup` | `?metric_type=&period=` | admin |

### System Health
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/system-health` | — | system_admin |

### Public Listings (No Auth)
| Method | Endpoint | Params | Auth |
|---|---|---|---|
| `GET` | `/api/public-listings` | `?account_slug=&workflow_id=&item_id=` | none |

Public-facing endpoint for portal pages. No authentication required.

---

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
