# Spine — Config Packs (Template Packs)

Config packs are reusable configuration templates that can be installed into any tenant account. They bundle workflow definitions, stages, transitions, actions, automations, custom fields, views, apps, KB articles, and more.

---

## Concept

A config pack is a **seed dataset** stored in the database. When a tenant installs a pack, Spine **clones** every entity from the template into the tenant's account, remapping IDs so foreign key relationships are preserved.

Think of packs as "starter kits" — installing the CRM pack gives an account a complete CRM with pipeline stages, automations, and dashboard views.

---

## Pre-Loaded Packs

Spine ships with several template packs seeded by migrations:

| Pack | Category | Includes |
|---|---|---|
| **Support** | Service | Ticket workflow, SLA stages, KB articles, portal views |
| **CRM** | Sales | Deal pipeline, contact management, sales dashboard |
| **Sales (Expanded)** | Sales | Extended pipeline, forecasting views, email actions |
| **CSM** | Success | Customer health tracking, renewal workflows |
| **Operations** | Ops | Task management, approval workflows, reporting |
| **Marketing** | Marketing | Campaign tracking, lead workflows, content management |

---

## Data Model

### `config_packs`

The pack catalog:

| Field | Type | Description |
|---|---|---|
| `id` | uuid | Pack identifier |
| `slug` | text | Unique slug |
| `name` | text | Display name |
| `description` | text | What the pack includes |
| `category` | text | Grouping (e.g., "sales", "service") |
| `version` | text | Pack version |

### `pack_activations`

Tracks which packs are installed for which accounts:

| Field | Type | Description |
|---|---|---|
| `account_id` | uuid | Tenant |
| `pack_id` | uuid | Which pack |
| `config_active` | boolean | Whether the pack's entities are active |
| `installed_at` | timestamptz | When installed |

### `pack_entity_mappings`

Maps template IDs to cloned IDs:

| Field | Type | Description |
|---|---|---|
| `account_id` | uuid | Tenant |
| `pack_id` | uuid | Pack |
| `entity_type` | text | e.g., `"workflow_definition"`, `"stage_definition"` |
| `template_id` | uuid | Original ID in the pack template |
| `cloned_id` | uuid | New ID in the tenant's data |

---

## Pack Entities

Packs can include entities from these tables (cloned in this order):

| Order | Table | Entity Type |
|---|---|---|
| 1 | `workflow_definitions` | `workflow_definition` |
| 2 | `stage_definitions` | `stage_definition` |
| 3 | `transition_definitions` | `transition_definition` |
| 4 | `workflow_actions` | `workflow_action` |
| 5 | `automation_rules` | `automation_rule` |
| 6 | `custom_field_definitions` | `custom_field_definition` |
| 7 | `link_type_definitions` | `link_type_definition` |
| 8 | `view_definitions` | `view_definition` |
| 9 | `app_definitions` | `app_definition` |
| 10 | `account_modules` | `account_module` |
| 11 | `custom_action_types` | `custom_action_type` |
| 12 | `threads` | `thread` |
| 13 | `messages` | `message` |
| 14 | `items` | `item` |
| 15 | `entity_links` | `entity_link` |

### Shared Test Data

Some tables don't have `pack_id` columns — their test data is shared across packs:

| Table | Note |
|---|---|
| `accounts` | Template accounts (ID prefix `00000000-0000-0000-0000-...`) |
| `persons` | Template persons |
| `memberships` | Template memberships |

These are identified by `is_test_data = true`.

---

## Ownership Pattern

Every packable entity has these columns:

| Column | Description |
|---|---|
| `pack_id` | UUID of the source config pack (null for tenant-created entities) |
| `ownership` | `'pack'` (installed from a pack) or `'tenant'` (created by the tenant) |
| `is_test_data` | Whether the entity is sample/demo data |

Pack-owned entities are managed by the pack system. Tenant-owned entities are managed by the user.

---

## Install Flow

When a tenant installs a pack:

### 1. Identify Template Entities

For each table in the clone sequence, query entities where `pack_id = <pack_id>`:

```sql
SELECT * FROM workflow_definitions WHERE pack_id = 'pack-uuid'
```

### 2. Clone with ID Remapping

Each entity is cloned with a new UUID, and the `account_id` is set to the tenant:

```typescript
const newId = randomUUID()
const clone = {
  ...template,
  id: newId,
  account_id: tenantAccountId,
  ownership: 'pack',
  pack_id: packId,
}
```

### 3. Remap Foreign Keys

Child entities need their foreign keys remapped to the new parent IDs:

```
stage_definitions.workflow_definition_id  → remapped workflow ID
transition_definitions.from_stage_id      → remapped stage ID
transition_definitions.to_stage_id        → remapped stage ID
workflow_actions.trigger_ref_id           → remapped stage/transition ID
items.stage_definition_id                 → remapped stage ID
```

The `pack_entity_mappings` table stores the `template_id → cloned_id` mapping.

### 4. Record Mappings

```sql
INSERT INTO pack_entity_mappings (account_id, pack_id, entity_type, template_id, cloned_id)
VALUES ('tenant-uuid', 'pack-uuid', 'workflow_definition', 'template-uuid', 'cloned-uuid')
```

### 5. Create Activation Record

```sql
INSERT INTO pack_activations (account_id, pack_id, config_active, installed_at)
VALUES ('tenant-uuid', 'pack-uuid', true, now())
```

### 6. Recalculate Counts

After install, `recalcAllCounts(accountId)` refreshes the admin sidebar counters.

---

## Activate / Deactivate

Packs can be toggled on/off without uninstalling:

### Deactivate

Sets `is_active = false` on all cloned entities:

```sql
UPDATE workflow_definitions SET is_active = false
  WHERE account_id = 'tenant-uuid' AND pack_id = 'pack-uuid'
-- Repeat for all pack tables
```

### Activate

Sets `is_active = true` on all cloned entities.

The activation status is stored in `pack_activations.config_active`.

---

## Uninstall Flow

When a tenant uninstalls a pack:

1. For each table in reverse clone order:
   - Find cloned entities via `pack_entity_mappings`
   - Delete them from the database
   - Remove the mapping records
2. Delete the `pack_activations` record
3. Recalculate admin counts

---

## Sync / Drift Detection

The pack system can detect when cloned entities have drifted from their template:

1. Load the template entity from the pack
2. Load the cloned entity via `pack_entity_mappings`
3. Compare key fields (name, config, etc.)
4. Report differences

This is useful for determining if a tenant has customized pack-installed entities.

---

## API

```
GET    /api/config-packs                    # List all available packs
GET    /api/config-packs?id=uuid            # Get pack details + activation status
POST   /api/config-packs                    # Actions: install, uninstall, activate, deactivate, sync
```

### Install

```json
{ "action": "install", "pack_id": "uuid" }
```

### Uninstall

```json
{ "action": "uninstall", "pack_id": "uuid" }
```

### Activate / Deactivate

```json
{ "action": "activate", "pack_id": "uuid" }
{ "action": "deactivate", "pack_id": "uuid" }
```

### Sync (check for drift)

```json
{ "action": "sync", "pack_id": "uuid" }
```

Returns a report of differences between template and cloned entities.

---

## Admin UI

**Admin → Templates** provides:

- Browse available packs with descriptions and categories
- Install/uninstall packs with confirmation
- Activate/deactivate installed packs
- View install status and entity counts per pack
- Sync check to see if cloned entities have been modified

---

## Creating a New Pack

To create a new config pack:

### 1. Create the Pack Record

```sql
INSERT INTO config_packs (id, slug, name, description, category, version)
VALUES (
  'your-pack-uuid',
  'my-pack',
  'My Custom Pack',
  'Description of what this pack includes',
  'custom',
  '1.0'
);
```

### 2. Create Template Entities

Create the entities you want the pack to include, with `pack_id = 'your-pack-uuid'`:

```sql
INSERT INTO workflow_definitions (id, account_id, name, pack_id, ownership)
VALUES ('template-wf-uuid', '00000000-0000-0000-0000-000000000001', 'My Workflow', 'your-pack-uuid', 'pack');

INSERT INTO stage_definitions (id, workflow_definition_id, name, position, is_initial, pack_id, ownership)
VALUES ('template-stage-uuid', 'template-wf-uuid', 'New', 0, true, 'your-pack-uuid', 'pack');
```

The `account_id` should be the template account ID (`00000000-0000-0000-0000-000000000001`).

### 3. Add to a Migration

Create a new migration file (e.g., `027_pack_my_custom.sql`) with all the INSERT statements. The pack will be available to all tenants after the migration runs.

---

## Related Documentation

- [DATA-MODEL.md](DATA-MODEL.md) — Pack-related tables
- [EXTENDING.md](EXTENDING.md) — Alternative extension approaches
- [APPS-AND-VIEWS.md](APPS-AND-VIEWS.md) — Apps and views installed by packs
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Workflow definitions installed by packs
