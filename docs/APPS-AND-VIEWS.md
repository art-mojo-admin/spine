# Spine — Apps, Views & Navigation

Apps and views are Spine's configuration-driven UI system. They let tenants build custom navigation and data presentations without writing code.

---

## Overview

```
app_definitions        → Groups of nav items that drive the sidebar
  └── nav_items[]      → Each points to a view, URL path, or external link
view_definitions       → Configurable data views (list, kanban, detail, etc.)
account_modules        → Feature flags that enable/disable capabilities
compute-nav            → Server-side endpoint that filters nav by role
```

When apps are published, the sidebar switches from a hardcoded fallback to app-driven navigation. Views are rendered dynamically by `ViewRenderer.tsx`.

---

## App Definitions

An app is a named group of navigation items stored in the database.

### Schema

| Field | Type | Description |
|---|---|---|
| `slug` | text | Unique identifier per account |
| `name` | text | Display name (used as sidebar section header) |
| `icon` | text | Lucide icon name |
| `min_role` | text | Minimum role to see the app (`member`, `operator`, `admin`) |
| `app_position` | integer | Sort order in the sidebar (lower = higher) |
| `nav_items` | jsonb | Array of navigation item objects |
| `is_active` | boolean | Whether the app is published |

### Nav Item Structure

Each element in the `nav_items` array:

```json
{
  "label": "Pipeline",
  "icon": "GitBranch",
  "route_type": "view",
  "view_slug": "sales-pipeline",
  "url": null,
  "position": 1,
  "min_role": "member"
}
```

| Field | Description |
|---|---|
| `label` | Display text in the sidebar |
| `icon` | Lucide icon name (optional) |
| `route_type` | `"view"` (renders at `/v/:viewSlug`), `"path"` (navigates to a URL), `"admin"` (admin path), or `"external"` |
| `view_slug` | For `route_type: "view"` — the view definition slug |
| `url` | For `route_type: "path"` or `"admin"` — the target path |
| `position` | Sort order within the app |
| `min_role` | Minimum role to see this item |

### API

```
GET    /api/app-definitions                    # List all apps
GET    /api/app-definitions?id=uuid            # Get one app
GET    /api/app-definitions?slug=my-app        # Get by slug
POST   /api/app-definitions                    # Create app (admin)
PATCH  /api/app-definitions?id=uuid            # Update app (admin)
DELETE /api/app-definitions?id=uuid            # Delete app (admin)
```

### Clone Action

Apps installed from packs can be cloned as tenant-owned drafts:

```
POST /api/app-definitions
{ "action": "clone", "source_id": "uuid" }
```

This creates a copy with `-custom` appended to the slug.

---

## View Definitions

Views are configurable data presentations rendered by `ViewRenderer.tsx` at `/v/:viewSlug`.

### Schema

| Field | Type | Description |
|---|---|---|
| `slug` | text | URL path component (unique per account) |
| `name` | text | Display name |
| `view_type` | text | `"list"`, `"kanban"`, `"detail"`, `"calendar"`, `"chart"` |
| `target_type` | text | Entity type to display (e.g., `"item"`, `"person"`) |
| `target_filter` | jsonb | Filter criteria for querying data |
| `columns` | jsonb | Column definitions for list/table views |
| `config` | jsonb | View-specific settings |
| `min_role` | text | Minimum role to access |
| `is_active` | boolean | Whether the view is published |

### View Types

#### `list`
Table view with sortable columns.

```json
{
  "view_type": "list",
  "target_type": "item",
  "target_filter": { "item_type": "deal", "status": "active" },
  "columns": [
    { "field": "title", "label": "Deal Name", "sortable": true },
    { "field": "metadata.amount", "label": "Amount", "type": "currency" },
    { "field": "stage_definition_id", "label": "Stage", "type": "stage" },
    { "field": "assigned_to_person_id", "label": "Owner", "type": "person" },
    { "field": "created_at", "label": "Created", "type": "date" }
  ],
  "config": {
    "sort_by": "created_at",
    "sort_dir": "desc",
    "page_size": 25
  }
}
```

#### `kanban`
Board view grouped by workflow stage.

```json
{
  "view_type": "kanban",
  "target_type": "item",
  "target_filter": { "workflow_definition_id": "uuid" },
  "config": {
    "group_by": "stage_definition_id",
    "card_title": "title",
    "card_subtitle": "metadata.company",
    "card_badge": "priority"
  }
}
```

#### `detail`
Single-entity detail view.

```json
{
  "view_type": "detail",
  "target_type": "item",
  "config": {
    "sections": [
      { "title": "Overview", "fields": ["title", "status", "priority"] },
      { "title": "Details", "fields": ["metadata.amount", "metadata.contact"] }
    ]
  }
}
```

#### `chart`
Visualization view powered by Recharts.

```json
{
  "view_type": "chart",
  "target_type": "item",
  "config": {
    "chart_type": "bar",
    "group_by": "stage_definition_id",
    "metric": "count"
  }
}
```

### API

```
GET    /api/view-definitions                          # List all views
GET    /api/view-definitions?id=uuid                  # Get one view
GET    /api/view-definitions?slug=my-view             # Get by slug
GET    /api/view-definitions?view_type=list            # Filter by type
POST   /api/view-definitions                          # Create view (admin)
PATCH  /api/view-definitions?id=uuid                  # Update view (admin)
DELETE /api/view-definitions?id=uuid                  # Delete view (admin)
```

### ViewRenderer

The `ViewRenderer.tsx` page at `/v/:viewSlug`:

1. Fetches the view definition by slug
2. Fetches the target data based on `target_type` and `target_filter`
3. Renders the appropriate view component based on `view_type`
4. Supports inline editing, sorting, filtering, and pagination

---

## Computed Navigation

The `compute-nav` endpoint calculates the sidebar navigation for the current user.

### Endpoint

```
GET /api/compute-nav
GET /api/compute-nav?role=member   # Preview as a specific role (admin only)
```

### Response

```json
{
  "nav_items": [
    {
      "app_slug": "sales",
      "app_name": "Sales",
      "app_icon": "BarChart3",
      "app_position": 10,
      "label": "Pipeline",
      "icon": "GitBranch",
      "route_type": "view",
      "view_slug": "sales-pipeline",
      "url": null,
      "position": 1
    }
  ],
  "apps": [
    { "slug": "sales", "name": "Sales", "icon": "BarChart3" }
  ]
}
```

### Filtering Logic

1. Load all active `app_definitions` for the account
2. For each app, check if user's role rank ≥ app's `min_role` rank
3. For each nav item in visible apps, check if user's role rank ≥ item's `min_role` rank
4. Sort by `app_position`, then by `app_name`, then by item `position`

### Role Ranks

| Role | Rank |
|---|---|
| `portal` | 0 |
| `member` | 1 |
| `operator` | 2 |
| `admin` | 3 |

System admins bypass all role checks.

---

## Sidebar Behavior

The sidebar (`Sidebar.tsx`) has two modes:

### App-Driven Mode

When `compute-nav` returns nav items:
1. Standard items (Accounts, Persons) are shown first
2. App-driven items are grouped by app name with section headers
3. Custom nav sections from `custom/src/manifest/routes.ts` are rendered
4. Admin section is shown for admin/system_admin users

### Fallback Mode

When no apps are installed (empty response from `compute-nav`):
1. A hardcoded fallback provides: Dashboard, Accounts, Persons, Documents, Activity, Search
2. Custom nav sections are still rendered
3. Admin section is shown for admin users

### Admin Counts

The sidebar fetches `GET /api/admin-counts` to display entity counts next to admin menu items:

```json
{
  "workflows": 3,
  "members": 12,
  "automations": 5,
  "webhooks": 2,
  "custom_fields": 8,
  ...
}
```

---

## Account Modules

Account modules are feature flags that enable or disable capabilities per tenant.

### Schema

| Field | Type | Description |
|---|---|---|
| `module_slug` | text | Feature identifier |
| `enabled` | boolean | Whether the module is active |
| `config` | jsonb | Module-specific settings |

### API

```
GET    /api/account-modules                    # List all modules
POST   /api/account-modules                    # Create/toggle module (admin)
PATCH  /api/account-modules?id=uuid            # Update module (admin)
```

### Admin UI

Go to **Admin → Modules** to enable/disable modules. Modules are typically installed by config packs but can also be created manually.

---

## App Builder

The App Builder (`/admin/apps/:appId/builder`) provides a visual editor for app definitions:

- Edit app name, slug, icon, minimum role, position
- Add/remove/reorder nav items
- Select route type (view, path, admin)
- Pick views from existing view definitions
- Preview navigation as different roles
- Icon picker with Lucide icon search

---

## Connecting the Pieces

### Typical Setup Flow

1. **Create view definitions** for the data you want to display
2. **Create an app definition** that groups views into a navigation experience
3. **Publish the app** (set `is_active: true`)
4. The sidebar automatically switches to app-driven mode

### Example: CRM App

```
1. Views:
   - "Pipeline" (kanban, items where workflow_type = 'sales')
   - "All Deals" (list, items where item_type = 'deal')
   - "Contacts" (list, persons)

2. App:
   {
     "slug": "crm",
     "name": "CRM",
     "icon": "BarChart3",
     "min_role": "member",
     "app_position": 10,
     "nav_items": [
       { "label": "Pipeline", "route_type": "view", "view_slug": "pipeline", "position": 1 },
       { "label": "All Deals", "route_type": "view", "view_slug": "all-deals", "position": 2 },
       { "label": "Contacts", "route_type": "path", "url": "/persons", "position": 3 }
     ]
   }
```

---

## Related Documentation

- [EXTENDING.md](EXTENDING.md) — Custom routes and nav sections
- [FRONTEND.md](FRONTEND.md) — Sidebar and routing details
- [CONFIG-PACKS.md](CONFIG-PACKS.md) — Apps and views installed by packs
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Workflow items displayed in views
