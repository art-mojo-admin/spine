# Spine — How to Extend

This is the primary guide for building on top of Spine. It covers custom backend functions, custom frontend routes, custom action types, custom fields, and integrations — with a worked example.

---

## Extension Points Overview

| Extension Point | Where | What It Does |
|---|---|---|
| **Custom Functions** | `custom/functions/*.ts` | Add or override serverless API endpoints |
| **Custom Frontend Routes** | `custom/src/manifest/routes.ts` | Add pages and nav items to the UI |
| **Custom Action Types** | Admin UI or API | Register webhook-backed action types for workflows/automations |
| **Custom Field Definitions** | Admin UI or API | Add per-entity metadata fields |
| **Integration Definitions** | Database seed | Define installable integrations |
| **Config Packs** | Database seed | Package reusable configurations |
| **View Definitions** | Admin UI or API | Create configurable data views |
| **App Definitions** | Admin UI or API | Define navigable apps with nav items |

---

## 1. Custom Backend Functions

### How It Works

Spine's build pipeline merges two directories into `netlify/functions/`:

```
core/functions/     → base layer (canonical runtime)
custom/functions/   → overlay (your extensions)
```

At build time (`npm run assemble`), custom files are copied **on top of** core files. A custom file with the same name as a core file **replaces** it entirely.

### Adding a New Endpoint

Create a file in `custom/functions/`:

```typescript
// custom/functions/my-endpoint.ts
import { createHandler, requireAuth, requireTenant, json, error } from
  '../../netlify/functions/_shared/middleware'
import { db } from '../../netlify/functions/_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data } = await db
      .from('my_table')
      .select('*')
      .eq('account_id', ctx.accountId)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    // ... handle POST
    return json({ ok: true }, 201)
  },
})
```

The endpoint will be available at:
- `/.netlify/functions/my-endpoint`
- `/api/my-endpoint` (via the `/api/*` redirect)

### Import Paths

Custom functions import shared utilities relative to the assembled output:

```typescript
// From custom/functions/my-file.ts:
import { createHandler, requireAuth, json, error } from
  '../../netlify/functions/_shared/middleware'
import { db } from '../../netlify/functions/_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from
  '../../netlify/functions/_shared/audit'
```

### Available Shared Modules

| Module | Key Exports |
|---|---|
| `_shared/middleware` | `createHandler`, `requireAuth`, `requireTenant`, `requireRole`, `requireMinRole`, `json`, `error`, `parseBody`, `clampLimit`, `isPortalUser` |
| `_shared/db` | `db` (Supabase client with service role) |
| `_shared/tenant-db` | `tenantDb(ctx)` — auto-scoped query builder (recommended) |
| `_shared/audit` | `emitAudit`, `emitActivity`, `emitOutboxEvent` |
| `_shared/automation` | `evaluateAutomations` |
| `_shared/workflow-engine` | `executeWorkflowActions`, `callAI`, `interpolateTemplate`, `evaluateConditions` |
| `_shared/action-executor` | `executeAction`, `evaluateConditions`, `interpolateTemplate`, `getNestedValue` |
| `_shared/security` | `validateOutboundUrl`, `validateEntityTable`, `validateFieldName`, `maskApiKey` |
| `_shared/embed` | `autoEmbed`, `getEmbedding` |
| `_shared/counts` | `adjustCount`, `setCount`, `recalcAllCounts` |
| `_shared/cron` | `parseCron`, `nextCronDate`, `describeCron` |
| `_shared/errors` | `logError`, `classifyError`, `extractFunctionName` |

### Overriding a Core Endpoint

To modify the behavior of an existing endpoint (e.g., `accounts`), copy the core file and modify it:

```bash
cp core/functions/accounts.ts custom/functions/accounts.ts
# Edit custom/functions/accounts.ts
```

At build time, your version replaces the core version. **Be careful** — you take ownership of the entire file and won't receive upstream fixes.

### Handler Pattern

Every endpoint uses `createHandler()` which provides:
- CORS handling (preflight OPTIONS)
- Auth + tenant + node + impersonation resolution
- Error handling with logging
- Method routing (GET, POST, PATCH, DELETE)

```typescript
export default createHandler({
  async GET(req, ctx, params) { /* ... */ },
  async POST(req, ctx) { /* ... */ },
  async PATCH(req, ctx, params) { /* ... */ },
  async DELETE(req, ctx, params) { /* ... */ },
})
```

Parameters:
- `req: Request` — the raw HTTP request
- `ctx: RequestContext` — resolved auth/tenant context
- `params: URLSearchParams` — query string parameters

---

## 2. Custom Frontend Routes

### Registration

Custom routes are registered in `custom/src/manifest/routes.ts`:

```typescript
import type { CustomNavSection, CustomRouteDefinition } from '@/lib/customRouteTypes'

export const customRoutes: CustomRouteDefinition[] = [
  {
    path: '/custom/my-page',
    loader: () => import('../my-feature/pages/MyPage').then(m => ({ default: m.MyPage })),
    layout: 'shell',       // 'shell' | 'portal' | 'public'
    minRole: 'member',     // informational, for nav filtering
    description: 'My custom page.',
  },
]

export const customNavSections: CustomNavSection[] = [
  {
    key: 'my-feature',
    title: 'My Feature',
    scope: 'primary',      // 'primary' (user nav) or 'admin'
    position: 50,           // sort order
    items: [
      {
        key: 'my-page',
        label: 'My Page',
        to: '/custom/my-page',
        icon: 'Users',      // Lucide icon name
        minRole: 'member',
      },
    ],
  },
]

export default customRoutes
```

### Type Definitions

```typescript
// CustomRouteDefinition
interface CustomRouteDefinition {
  path: string                              // URL path (registered with React Router)
  loader: () => Promise<{ default: ComponentType<any> }>  // Lazy import
  layout?: 'shell' | 'portal' | 'public'   // Target layout (default: 'shell')
  minRole?: 'portal' | 'member' | 'operator' | 'admin'
  description?: string
}

// CustomNavSection
interface CustomNavSection {
  key: string
  title: string
  items: CustomNavItem[]
  scope?: 'primary' | 'admin'   // Where in the sidebar
  position?: number              // Sort order (lower = higher)
}

// CustomNavItem
interface CustomNavItem {
  key: string
  label: string
  to: string                     // Route path
  icon?: string                  // Lucide icon name
  minRole?: 'member' | 'operator' | 'admin'
}
```

### How It Works

1. `src/lib/customRoutes.ts` uses `import.meta.glob('@custom/manifest/routes.ts', { eager: true })` to load the manifest at build time
2. `App.tsx` calls `getCustomRoutes()` and registers them with React Router in the appropriate layout
3. `Sidebar.tsx` calls `getCustomNavSections()` and renders nav items filtered by role rank

### Available Icons

The sidebar maps icon strings to Lucide components. Available icons include:
`LayoutDashboard`, `Building2`, `Users`, `GitBranch`, `FileText`, `Activity`, `Palette`, `Webhook`, `Settings`, `Shield`, `UserPlus`, `Zap`, `ArrowDownToLine`, `SlidersHorizontal`, `Clock`, `Link2`, `Package`, `Search`, `LogOut`, `ChevronDown`, `Blocks`, `PlugZap`, `ShieldAlert`, `HeartPulse`, `LayoutGrid`, `BarChart3`

### Using Core Imports in Custom Pages

Custom pages can import from the core `src/` via the `@` alias:

```typescript
import { useAuth } from '@/hooks/useAuth'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
```

---

## 3. Custom Action Types

Custom action types let you extend the workflow engine and automation system with new behaviors backed by external webhooks.

### Registering via API

```
POST /api/custom-action-types
{
  "slug": "notify-slack",
  "name": "Notify Slack",
  "description": "Send a notification to a Slack channel",
  "handler_url": "https://your-service.com/api/spine-actions/slack",
  "config_schema": {
    "channel": { "type": "string", "required": true },
    "message_template": { "type": "string" }
  }
}
```

### Registering via Admin UI

Go to **Admin → Custom Actions** and create a new action type.

### How It Works

1. When a workflow action or automation rule has an `action_type` that doesn't match a built-in type, the engine looks up `custom_action_types` for the account
2. If found, it sends a POST to the `handler_url` with this payload:

```json
{
  "action_name": "My Action",
  "action_type": "notify-slack",
  "action_config": { "channel": "#alerts", "message_template": "..." },
  "account_id": "uuid",
  "payload": { /* trigger payload */ },
  "timestamp": "2026-03-02T..."
}
```

3. Your handler processes the request and returns a success/failure HTTP status

### Using in Workflows

In the Workflow Builder or via API, create a workflow action with:
- `action_type`: your custom slug (e.g., `"notify-slack"`)
- `action_config`: whatever your handler expects

### Using in Automations

Same pattern — set `action_type` on an automation rule to your custom slug.

---

## 4. Custom Field Definitions

Custom fields add tenant-specific metadata to entities without schema changes.

### Creating via API

```
POST /api/custom-field-definitions
{
  "entity_type": "item",
  "name": "Priority Score",
  "field_type": "number",
  "config": { "min": 0, "max": 100, "step": 1 }
}
```

### Creating via Admin UI

Go to **Admin → Custom Fields** and add fields for any entity type.

### Field Types

| Type | Config Options |
|---|---|
| `text` | `placeholder`, `maxLength` |
| `number` | `min`, `max`, `step` |
| `select` | `options: [{ value, label }]` |
| `multi_select` | `options: [{ value, label }]` |
| `boolean` | — |
| `date` | `includeTime` |
| `url` | — |
| `email` | — |
| `textarea` | `rows`, `maxLength` |

### Storage

Custom field values are stored in the entity's `metadata` JSONB column, keyed by the field's `slug`:

```json
{
  "priority_score": 85,
  "department": "engineering"
}
```

### Rendering

The `CustomFieldsRenderer` component automatically loads field definitions and renders appropriate inputs:

```tsx
<CustomFieldsRenderer
  entityType="item"
  metadata={metadata}
  editing={isEditing}
  onChange={setMetadata}
/>
```

---

## 5. View Definitions

Views are configurable data presentations (list, kanban, detail, etc.).

### Creating via API

```
POST /api/view-definitions
{
  "slug": "active-deals",
  "name": "Active Deals",
  "view_type": "list",
  "target_type": "item",
  "target_filter": { "status": "active", "item_type": "deal" },
  "columns": [
    { "field": "title", "label": "Deal Name" },
    { "field": "metadata.amount", "label": "Amount" },
    { "field": "stage_definition_id", "label": "Stage" }
  ],
  "config": { "sort_by": "created_at", "sort_dir": "desc" }
}
```

### View Types

| Type | Description |
|---|---|
| `list` | Table/list view with sortable columns |
| `kanban` | Board view grouped by stage |
| `detail` | Single entity detail view |
| `calendar` | Calendar view (date-based) |
| `chart` | Chart/graph visualization |

### Rendering

Views are rendered at `/v/:viewSlug` by `ViewRenderer.tsx`, which fetches the view definition and data dynamically.

### Connecting to Apps

Views can be referenced in app nav items:

```json
{
  "label": "Active Deals",
  "route_type": "view",
  "view_slug": "active-deals",
  "position": 1
}
```

---

## 6. App Definitions

Apps group views and navigation items into a coherent experience.

### Creating via API

```
POST /api/app-definitions
{
  "slug": "sales-app",
  "name": "Sales",
  "icon": "BarChart3",
  "min_role": "member",
  "app_position": 10,
  "nav_items": [
    { "label": "Pipeline", "route_type": "view", "view_slug": "sales-pipeline", "position": 1, "min_role": "member" },
    { "label": "All Deals", "route_type": "view", "view_slug": "all-deals", "position": 2, "min_role": "member" },
    { "label": "Reports", "route_type": "path", "url": "/admin/reports", "position": 3, "min_role": "operator" }
  ]
}
```

### Creating via Admin UI

Go to **Admin → Apps** to create and manage app definitions. The **App Builder** (`/admin/apps/:appId/builder`) provides a visual editor.

### Navigation

When apps are published, the sidebar switches from fallback nav to app-driven nav. The server computes visible nav items based on the user's role via `GET /api/compute-nav`.

---

## 7. Entity Links

Link any two entities together with typed relationships.

### Link Type Definitions

First, define the allowed link types:

```
POST /api/link-type-definitions
{
  "slug": "related-to",
  "name": "Related To",
  "source_type": "item",
  "target_type": "item",
  "config": { "bidirectional": true }
}
```

### Creating Links

```
POST /api/entity-links
{
  "source_type": "item",
  "source_id": "uuid",
  "target_type": "person",
  "target_id": "uuid",
  "link_type": "assigned-to"
}
```

### Frontend Component

The `EntityLinksPanel` renders and manages links for any entity:

```tsx
<EntityLinksPanel entityType="account" entityId={accountId} />
```

---

## 8. Integration Framework

Integrations provide a marketplace-like pattern for connecting external services.

### Defining an Integration

Seed an `integration_definitions` row:

```sql
INSERT INTO integration_definitions (slug, name, icon, category, version, manifest)
VALUES (
  'gmail',
  'Gmail',
  'Mail',
  'communication',
  '1.0',
  '{
    "config_fields": [
      { "key": "api_key", "label": "API Key", "type": "secret" },
      { "key": "webhook_url", "label": "Webhook URL", "type": "url" }
    ],
    "capabilities": ["send_email", "receive_email"]
  }'
);
```

### Installing per Tenant

```
POST /api/integration-instances
{
  "action": "install",
  "definition_id": "uuid",
  "config": { "api_key": "...", "webhook_url": "..." }
}
```

### Using in Custom Functions

Your custom functions can query `integration_instances` to get the tenant's configuration for a specific integration.

---

## Worked Example: Community App

The repository includes a complete custom app example in `custom/`:

### Structure

```
custom/
├── functions/
│   └── community-bootstrap.ts     # Custom API endpoint
└── src/
    ├── manifest/
    │   └── routes.ts              # Route + nav registration
    └── community/
        ├── index.ts               # Barrel export
        ├── types.ts               # TypeScript interfaces
        ├── hooks/
        │   └── useCommunityBootstrap.ts  # Data-fetching hook
        └── pages/
            └── CommunityHome.tsx  # Main page component
```

### Backend: `custom/functions/community-bootstrap.ts`

A single GET endpoint that aggregates data from multiple Spine tables:
- Person + profile for the current user
- Thread activity (recent posts)
- Knowledge base articles (lessons)
- Lesson completions
- Workflow items (events)
- Member count

Returns a unified `CommunityBootstrap` payload.

### Manifest: `custom/src/manifest/routes.ts`

```typescript
export const customRoutes: CustomRouteDefinition[] = [
  {
    path: '/custom/community',
    loader: () => import('../community/pages/CommunityHome')
      .then(m => ({ default: m.CommunityHome })),
    layout: 'shell',
    minRole: 'member',
    description: 'Community home experience rendered inside the core shell.',
  },
]

export const customNavSections: CustomNavSection[] = [
  {
    key: 'community-app',
    title: 'Community',
    scope: 'primary',
    position: 50,
    items: [
      {
        key: 'community-home',
        label: 'Community',
        to: '/custom/community',
        icon: 'Users',
        minRole: 'member',
      },
    ],
  },
]
```

### Frontend: `CommunityHome.tsx`

A rich page that:
- Uses `useCommunityBootstrap()` to fetch data from the custom endpoint
- Renders persona panel, stats, channels, lessons, events, cohorts
- Uses core UI components (`@/components/ui/*`) for consistent styling
- Follows the same patterns as core pages

### Key Takeaways

1. **Custom functions** import shared middleware from core — they get auth, tenant isolation, and RBAC for free
2. **Custom routes** are lazy-loaded and appear seamlessly in the sidebar
3. **Custom pages** can import any core component or hook
4. The custom layer is **additive** — it doesn't require modifying core files

---

## Best Practices

1. **Never edit core files directly** — use the custom overlay or admin UI
2. **Use `createHandler()`** for all custom functions — it handles auth, CORS, and error logging
3. **Always scope queries by `account_id`** — multi-tenant isolation is your responsibility
4. **Use `emitAudit` + `emitActivity` + `emitOutboxEvent`** for writes — keep the audit trail intact
5. **Prefer view definitions over custom pages** for data display — views are configurable without code
6. **Prefer custom action types over function overrides** for new behaviors — they're composable and tenant-scoped
7. **Use custom fields instead of schema changes** for tenant-specific data
8. **Test with multiple accounts** to verify tenant isolation

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Build pipeline and core/custom assembly
- [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) — Workflow actions and conditions
- [AUTOMATION.md](AUTOMATION.md) — Automation rules and triggers
- [APPS-AND-VIEWS.md](APPS-AND-VIEWS.md) — App and view definitions
- [INTEGRATIONS.md](INTEGRATIONS.md) — Webhook and integration patterns
- [CONFIG-PACKS.md](CONFIG-PACKS.md) — Packaging reusable configurations
- [AUTH-AND-RBAC.md](AUTH-AND-RBAC.md) — RBAC helpers for custom functions
