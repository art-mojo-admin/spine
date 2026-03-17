# Spine — Frontend Architecture

The Spine frontend is a React 18 single-page application built with Vite, TailwindCSS, and shadcn/ui.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool and dev server |
| **TypeScript** | Type safety |
| **TailwindCSS 3** | Utility-first CSS |
| **shadcn/ui** | Component library (Radix primitives + Tailwind) |
| **Lucide React** | Icon library |
| **React Router 6** | Client-side routing |
| **Supabase JS** | Auth only (login/session) |
| **TipTap** | Rich text editor (KB articles) |
| **React Flow (@xyflow/react)** | Visual workflow builder |
| **Recharts** | Charts and reports |
| **Framer Motion** | Animations |
| **marked** | Markdown rendering |

---

## Directory Structure

```
core/src/                    # Core Spine frontend (canonical)
├── App.tsx                  # Root component, routing, layouts
├── main.tsx                 # Entry point
├── index.css                # Tailwind imports + base styles
├── vite-env.d.ts
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, card, badge, etc.)
│   ├── layout/              # Shell, Sidebar, PortalShell, AccountNodePanel, ImpersonationBanner
│   ├── shared/              # Reusable components (EditableField, CustomFieldsRenderer, etc.)
│   ├── dashboard/           # Dashboard widgets
│   ├── workflow/            # Workflow-specific components
│   └── app-builder/         # App definition builder components
├── hooks/
│   ├── useAuth.tsx          # Auth context + account management
│   ├── useCustomFields.ts   # Custom field definitions loader
│   ├── useImpersonation.tsx # Impersonation session management
│   └── useTenantSettings.tsx# Per-tenant settings loader
├── lib/
│   ├── api.ts               # API client (apiGet, apiPost, apiPatch, apiDelete)
│   ├── auth.ts              # Supabase client + signOut
│   ├── config.ts            # APP_NAME, STORAGE_PREFIX, WEBHOOK_HEADER_PREFIX
│   ├── accountContext.ts    # localStorage persistence for active account
│   ├── impersonationContext.ts# localStorage persistence for impersonation session
│   ├── theme.ts             # Theme presets + token application
│   ├── customRouteTypes.ts  # TypeScript interfaces for custom routes
│   ├── customRoutes.ts      # Custom route/nav loader via import.meta.glob
│   └── utils.ts             # Utility helpers (generateRequestId, cn)
└── pages/
    ├── *.tsx                # Top-level pages (Dashboard, Accounts, Persons, etc.)
    ├── admin/               # Admin pages (19 pages)
    ├── portal/              # Portal pages (Dashboard, MyItems, Browse, Profile)
    └── public/              # Public pages (Home, Listing, ItemDetail)

custom/src/                  # Custom frontend extensions
└── manifest/
    └── routes.ts            # Custom route + nav registrations

src/                        # Assembled output (core + custom merged)
```

**Note:** The `src/` directory is auto-generated at build time by running `npm run assemble:frontend`. It merges `core/src` (base layer) with `custom/src` (overrides + additions).

---

## Routing

All routes are defined in `src/App.tsx`. Pages are lazy-loaded for code splitting.

### Three Layout Shells

| Shell | Component | Used For |
|---|---|---|
| **Shell** | `Shell.tsx` + `Sidebar.tsx` | Admin/operator/member users |
| **PortalShell** | `PortalShell.tsx` | Portal (external/customer) users |
| **Public** | No shell | Public-facing pages (no auth) |

The `ProtectedRoutes` component selects the shell based on `currentRole`:

```typescript
function ProtectedRoutes() {
  const { session, loading, currentRole } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" />
  if (currentRole === 'portal') return <PortalShell />
  return <Shell />
}
```

### Route Map

**Standard Routes** (inside Shell):

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Overview with stats and recent activity |
| `/accounts` | Accounts | Account list |
| `/accounts/:accountId` | AccountDetail | Single account view/edit |
| `/persons` | Persons | People list |
| `/persons/:personId` | PersonDetail | Single person view/edit |
| `/workflow-items/:itemId` | WorkflowItemDetail | Single item view/edit |
| `/documents` | KnowledgeBase | Article list |
| `/documents/:articleId` | KBArticleDetail | Single article view/edit |
| `/courses` | Courses | Course list |
| `/courses/:courseId` | CourseDetail | Course detail |
| `/courses/:courseId/lessons/:lessonId` | LessonViewer | Lesson viewer |
| `/activity` | Activity | Activity feed |
| `/search` | Search | Semantic + text search |
| `/v/:viewSlug` | ViewRenderer | Dynamic view rendering |
| `/x/:slug` | ExtensionPage | Extension page renderer |

**Admin Routes** (inside Shell, admin role):

| Path | Page |
|---|---|
| `/admin/account-browser` | AccountBrowser (system admin) |
| `/admin/apps` | AppDefinitions |
| `/admin/apps/:appId/builder` | AppBuilder |
| `/admin/automations` | Automations |
| `/admin/custom-actions` | CustomActionTypes |
| `/admin/custom-fields` | CustomFieldDefinitions |
| `/admin/inbound-webhooks` | InboundWebhooks |
| `/admin/link-types` | LinkTypeDefinitions |
| `/admin/members` | Members |
| `/admin/modules` | AccountModules |
| `/admin/packs` | ConfigPacks |
| `/admin/reports` | Reports |
| `/admin/roles` | Roles |
| `/admin/schedules` | ScheduledTriggers |
| `/admin/settings` | Settings |
| `/admin/system-health` | SystemHealth (system admin) |
| `/admin/theme` | ThemeEditor |
| `/admin/views` | ViewDefinitions |
| `/admin/webhooks` | Webhooks |
| `/admin/workflows` | Workflows |
| `/admin/workflows/:workflowId` | WorkflowDetail |
| `/admin/workflows/:workflowId/builder` | WorkflowBuilder |
| `/admin/setup` | SetupWizard |

**Portal Routes** (inside PortalShell):

| Path | Page |
|---|---|
| `/` | PortalDashboard |
| `/my-items` | MyItems |
| `/browse` | PortalBrowse |
| `/profile` | PortalProfile |

**Public Routes** (no auth):

| Path | Page |
|---|---|
| `/login` | Login |
| `/p/:accountSlug` | PublicHome |
| `/p/:accountSlug/:workflowId` | PublicListing |
| `/p/:accountSlug/:workflowId/:itemId` | PublicItemDetail |

---

## API Layer

`src/lib/api.ts` provides the API client used by all pages:

```typescript
export const apiGet    = <T>(endpoint, params?) => api<T>(endpoint, { params })
export const apiPost   = <T>(endpoint, body, options?) => api<T>(endpoint, { method: 'POST', body, ...options })
export const apiPatch  = <T>(endpoint, body, params?) => api<T>(endpoint, { method: 'PATCH', body, params })
export const apiDelete = <T>(endpoint, params?) => api<T>(endpoint, { method: 'DELETE', params })
```

Every request automatically includes:
- `Authorization: Bearer <jwt>` — from Supabase session
- `X-Account-Id` — from `accountContext.ts`
- `X-Account-Node-Id` — from `accountContext.ts`
- `X-Request-Id` — auto-generated UUID
- `X-Impersonate-Session-Id` — if impersonation is active
- `Content-Type: application/json`

Errors are thrown as `ApiError` with `status`, `message`, and `requestId`.

---

## Hooks

### `useAuth` (`src/hooks/useAuth.tsx`)

The central auth/state provider. Wraps the entire app via `AuthProvider`.

**Provides:**
- `session` / `user` — Supabase Auth state
- `profile` — person's display name, avatar, system role
- `memberships` — all account memberships
- `currentAccountId` / `currentAccountNodeId` — active tenant context
- `currentRole` — resolved account role for the active account
- `setCurrentAccountId(id)` — switch accounts (persists to localStorage)
- `setCurrentAccountNodeId(id)` — switch sub-account node
- `refresh()` — reload profile + memberships

**Lifecycle:**
1. On mount, calls `supabase.auth.getSession()` → loads profile via `GET /api/me`
2. Listens for auth state changes (`onAuthStateChange`)
3. Resolves stored account from localStorage; validates against memberships
4. System admins can persist any account ID, even without a membership

### `useCustomFields` (`src/hooks/useCustomFields.ts`)

Loads custom field definitions for an entity type.

```typescript
const { fields, loading } = useCustomFields('item')
```

Fetches `GET /api/custom-field-definitions?entity_type=<type>` and returns the field schema.

### `useImpersonation` (`src/hooks/useImpersonation.tsx`)

Manages impersonation sessions for system admins.

**Provides:**
- `active` — whether impersonation is active
- `session` — current impersonation session details
- `startImpersonation(targetPersonId, targetAccountId, reason)`
- `stopImpersonation()`

### `useTenantSettings` (`src/hooks/useTenantSettings.tsx`)

Loads per-tenant settings.

```typescript
const { settings, loading, refresh } = useTenantSettings()
```

---

## Key Components

### Layout

| Component | File | Purpose |
|---|---|---|
| `Shell` | `layout/Shell.tsx` | Main layout (sidebar + content area) |
| `Sidebar` | `layout/Sidebar.tsx` | Navigation sidebar with tenant switcher, app-driven nav, admin section |
| `PortalShell` | `layout/PortalShell.tsx` | Portal layout (simpler sidebar) |
| `AccountNodePanel` | `layout/AccountNodePanel.tsx` | Hierarchical account browser (breadcrumbs, children) |
| `ImpersonationBanner` | `layout/ImpersonationBanner.tsx` | Yellow banner during impersonation |

### Shared

| Component | File | Purpose |
|---|---|---|
| `EditableField` | `shared/EditableField.tsx` | Inline-editable field (text, select, etc.) |
| `CustomFieldsRenderer` | `shared/CustomFieldsRenderer.tsx` | Renders custom fields from definitions |
| `EntityLinksPanel` | `shared/EntityLinksPanel.tsx` | Shows/manages entity relationships |
| `EntityAttachmentsPanel` | `shared/EntityAttachmentsPanel.tsx` | File attachments |
| `ThreadPanel` | `shared/ThreadPanel.tsx` | Threaded messaging UI |
| `ConditionEditor` | `shared/ConditionEditor.tsx` | Visual condition builder for automations |

### Workflow

| Component | Purpose |
|---|---|
| `WorkflowBuilder.tsx` (page) | Visual stage/transition editor using React Flow |
| `workflow/StageNode.tsx` | React Flow node for a stage |
| `workflow/TransitionEdge.tsx` | React Flow edge for a transition |

### App Builder

| Component | Purpose |
|---|---|
| `AppBuilder.tsx` (page) | Visual app definition editor |
| `app-builder/NavItemEditor.tsx` | Edit individual nav items |
| `app-builder/LucideIconPicker.tsx` | Icon selector |

---

## Sidebar Navigation

The sidebar (`Sidebar.tsx`) has two navigation modes:

### App-Driven Nav
When the account has `app_definitions` published, the sidebar calls `GET /api/compute-nav` which returns filtered nav items based on the user's role. Items are grouped by app name.

### Fallback Nav
When no apps are installed, a hardcoded fallback provides basic navigation: Dashboard, Accounts, Persons, Documents, Activity, Search.

### Admin Section
Always shown to users with `admin` role or `system_admin` system role. Lists all admin pages with optional entity counts from `GET /api/admin-counts`.

### Custom Nav Sections
Custom routes registered via `custom/src/manifest/routes.ts` are rendered in their declared scope (`primary` or `admin`).

---

## Theming

Spine supports per-tenant theming stored in the database.

### Presets

| Preset | Style |
|---|---|
| `clean` | Light, Inter font, blue primary |
| `bold` | Dark, Inter font, purple primary |
| `muted` | Warm, Georgia font, brown primary |

### Token System

Theme tokens map to CSS custom properties on `:root`:

```typescript
interface ThemeTokens {
  primary: string              // HSL value
  'primary-foreground': string
  background: string
  foreground: string
  muted: string
  'muted-foreground': string
  border: string
  radius: string               // e.g., '0.625rem'
  'font-sans': string          // Font family
  // ... and more
}
```

### Application

`applyThemeTokens(tokens)` sets CSS custom properties on `document.documentElement`. The Theme Editor page (`/admin/theme`) provides a live preview.

---

## Branding

The `VITE_APP_NAME` env var drives branding throughout the app:

| Derived Value | Used In |
|---|---|
| `APP_NAME` | Sidebar, login page, page title |
| `STORAGE_PREFIX` | localStorage key prefix |
| `WEBHOOK_HEADER_PREFIX` | Outbound webhook signature header |

Set in `src/lib/config.ts`:

```typescript
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Spine'
export const STORAGE_PREFIX = APP_NAME.toLowerCase().replace(/\s+/g, '-')
export const WEBHOOK_HEADER_PREFIX = `X-${APP_NAME.replace(/\s+/g, '-')}`
```

---

## Custom Route System

Custom routes are loaded from `custom/src/manifest/routes.ts` via Vite's `import.meta.glob`:

```typescript
// src/lib/customRoutes.ts
const manifestModules = import.meta.glob<ManifestModule>(
  '@custom/manifest/routes.ts',
  { eager: true }
)
```

This enables the `custom/` directory to register:
- **Routes** — lazy-loaded React components mapped to URL paths
- **Nav sections** — sidebar items grouped into sections

See [EXTENDING.md](EXTENDING.md) for full details on creating custom routes.

---

## Build Output

Vite produces code-split chunks:

| Chunk | Contents |
|---|---|
| `index-*.js` | App core (hooks, lib, App.tsx) |
| `vendor-react-*.js` | React, React DOM, React Router |
| `vendor-supabase-*.js` | Supabase JS client |
| `vendor-ui-*.js` | Lucide, clsx, tailwind-merge, CVA |
| `vendor-markdown-*.js` | marked |
| `<PageName>-*.js` | Each lazy-loaded page |

All output goes to `dist/`.

---

## Related Documentation

- [AUTH-AND-RBAC.md](AUTH-AND-RBAC.md) — useAuth hook details
- [EXTENDING.md](EXTENDING.md) — Custom routes and nav sections
- [APPS-AND-VIEWS.md](APPS-AND-VIEWS.md) — App-driven navigation
- [ARCHITECTURE.md](ARCHITECTURE.md) — Build pipeline and Vite config
