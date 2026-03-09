# Spine — System Architecture

Spine is a multi-tenant, event-driven operational OS built on React + Netlify Functions + Supabase Postgres.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (SPA)                       │
│  React 18 · Vite · TailwindCSS · shadcn/ui             │
│  Supabase Auth (JWT login/session only)                 │
└──────────────────────┬──────────────────────────────────┘
                       │  fetch() with Bearer JWT
                       │  + X-Account-Id header
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Netlify Functions (API Layer)               │
│  TypeScript · createHandler() middleware                 │
│  Auth → Tenant → Node → Impersonation resolution        │
│  66 serverless endpoints                                │
└──────────────────────┬──────────────────────────────────┘
                       │  Supabase JS client
                       │  (service_role key)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Postgres                          │
│  pgvector · pg_trgm · uuid-ossp · pgcrypto             │
│  RLS disabled — all access via service_role             │
│  26 migrations · 40+ tables                            │
└─────────────────────────────────────────────────────────┘
```

**Key principle:** The frontend never touches the database directly. All reads and writes go through Netlify Functions, which use the Supabase service role key. Supabase Auth is used *only* for login/session management in the browser; the JWT is forwarded to functions for identity verification.

---

## Project Structure

```
spine-ia/
├── core/functions/              # Canonical Spine runtime (DO NOT EDIT directly)
│   ├── _shared/                 # Shared utilities (middleware, db, audit, etc.)
│   └── *.ts                     # 54 endpoint handlers
├── custom/                      # Extension layer
│   ├── functions/               # Custom serverless functions (override/extend core)
│   └── src/                     # Custom frontend code
│       └── manifest/routes.ts   # Custom route + nav registrations
├── netlify/functions/           # Assembled output (core + custom merged at build)
├── src/                         # React frontend
│   ├── components/              # UI components (ui/, layout/, shared/, etc.)
│   ├── hooks/                   # React hooks (useAuth, useCustomFields, etc.)
│   ├── lib/                     # Utilities (api, auth, config, theme, etc.)
│   └── pages/                   # Route pages (lazy-loaded)
├── supabase/
│   ├── migrations/              # 24-file v2 chain (001_foundations → 028_allow_page_view_type)
│   ├── migrations_legacy/       # Archived v1 migrations (unused)
│   └── seed-config-packs.sql    # Template pack seed data
├── scripts/
│   ├── assemble-functions.sh    # Merge core + custom → netlify/functions/
│   ├── verify-integrity.sh      # Check core files against manifest hashes
│   └── build-manifest.sh        # Generate .spine-manifest.json
├── .spine-manifest.json         # SHA-256 hashes of all core files
├── netlify.toml                 # Build config, scheduled functions, redirects
├── vite.config.ts               # Vite config with path aliases
└── package.json                 # Scripts, dependencies
```

---

## Core/Custom Split

Spine separates its runtime into two layers:

### Core (`core/functions/`)

The canonical Spine runtime. Contains all 54 serverless endpoint handlers plus 11 shared utility modules. These files are tracked by `.spine-manifest.json` with SHA-256 hashes.

**You should not edit core files directly.** Instead, use the custom layer to override or extend behavior.

### Custom (`custom/functions/` and `custom/src/`)

The extension layer. Any `.ts` file placed in `custom/functions/` will be copied into `netlify/functions/` at build time, **overriding** a core file of the same name or adding a new endpoint.

Custom frontend code lives in `custom/src/` and is aliased as `@custom` in Vite.

### Assembly

At build time, `scripts/assemble-functions.sh` runs:

1. Cleans `netlify/functions/`
2. Copies all files from `core/functions/` (base layer)
3. Overlays files from `custom/functions/` (overrides + additions)

The assembled result in `netlify/functions/` is what Netlify actually deploys.

---

## Integrity System

Spine includes a file integrity verification system to detect unauthorized modifications to core files.

> **Note:** This is a developer workflow guardrail, not a tamper-proof security mechanism. Anyone with repository access can regenerate the manifest. Its purpose is to make accidental core edits visible, not to prevent determined changes.

### Manifest

`.spine-manifest.json` stores SHA-256 hashes of every file in `core/` and key `src/` files:

```json
{
  "version": "1",
  "integrity_mode": "warn",
  "file_count": 85,
  "hashes": {
    "core/functions/_shared/middleware.ts": "0eb9cb4c...",
    "core/functions/accounts.ts": "a8299f56...",
    ...
  }
}
```

### Verification

`scripts/verify-integrity.sh` compares actual file hashes against the manifest.

| `SPINE_INTEGRITY` | Behavior |
|---|---|
| `warn` (default) | Log warnings, continue build |
| `enforce` | Fail the build on any mismatch |

### Regenerating

After intentionally modifying core files, run `scripts/build-manifest.sh` to regenerate the manifest.

---

## Build Pipeline

Defined in `package.json`:

```
npm run build
  → prebuild
      → npm run assemble    (merge core + custom functions)
      → npm run verify      (check integrity hashes)
  → tsc -b                  (TypeScript compilation)
  → vite build              (bundle frontend)
```

Output lands in `dist/` (frontend) and `netlify/functions/` (API).

---

## Vite Configuration

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@custom': path.resolve(__dirname, './custom/src'),
  },
}
```

- `@` resolves to `src/` — use for all core frontend imports
- `@custom` resolves to `custom/src/` — use for extension imports

Manual chunks split the bundle for caching:

| Chunk | Contents |
|---|---|
| `vendor-react` | react, react-dom, react-router-dom |
| `vendor-supabase` | @supabase/supabase-js |
| `vendor-ui` | lucide-react, clsx, tailwind-merge, class-variance-authority |
| `vendor-markdown` | marked |

---

## Netlify Configuration

`netlify.toml` defines:

### Build
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```

### Scheduled Functions

| Function | Schedule | Purpose |
|---|---|---|
| `trigger-scheduler` | `* * * * *` (every minute) | Fires one-time, recurring, and countdown triggers |
| `webhook-deliver` | `*/5 * * * *` (every 5 min) | Processes outbox → webhook deliveries with retry |

### Redirects

| From | To | Purpose |
|---|---|---|
| `/api/*` | `/.netlify/functions/:splat` | Clean API URLs |
| `/*` | `/index.html` | SPA catch-all |

### Security Headers

All responses include:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## Request Lifecycle

Every API request follows this path through the middleware (`_shared/middleware.ts`):

```
1. OPTIONS? → 204 with CORS headers (preflight)
2. Resolve Auth
   └── Extract Bearer JWT → verify via Supabase → find person → load system_role
3. Resolve Impersonation (if X-Impersonate-Session-Id present)
   └── Validate session → swap person/account context
4. Resolve Tenant
   └── X-Account-Id header → verify membership (or system admin) → set accountId + accountRole
5. Resolve Account Node
   └── X-Account-Node-Id header → verify path ancestry → set accountNodeId
6. Execute Handler
   └── Route to GET/POST/PATCH/DELETE handler with (req, ctx, params)
7. Return Response
   └── JSON body + CORS headers + status code
```

The `RequestContext` object passed to every handler:

```typescript
interface RequestContext {
  requestId: string
  personId: string | null
  accountId: string | null
  accountNodeId: string | null
  accountRole: string | null      // 'admin' | 'operator' | 'member' | 'portal'
  systemRole: string | null       // 'system_admin' | 'system_operator' | 'support_operator'
  authUid: string | null
  impersonating: boolean
  realPersonId: string | null
  impersonationSessionId: string | null
}
```

---

## Shared Utilities (`core/functions/_shared/`)

| Module | Purpose |
|---|---|
| `middleware.ts` | Request lifecycle, auth, tenant resolution, RBAC helpers |
| `db.ts` | Supabase client (service role) |
| `tenant-db.ts` | `tenantDb(ctx)` — auto-scoped queries that inject `account_id` filter |
| `audit.ts` | `emitAudit()`, `emitActivity()`, `emitOutboxEvent()` |
| `automation.ts` | `evaluateAutomations()` — event-triggered rule execution |
| `workflow-engine.ts` | `executeWorkflowActions()` — workflow action pipeline |
| `action-executor.ts` | Shared action execution (webhook, update_field, emit_event, ai_prompt, send_email, etc.) |
| `security.ts` | SSRF protection, table/field allowlists, API key masking |
| `cron.ts` | Cron expression parser, `nextCronDate()`, `describeCron()` |
| `counts.ts` | Admin sidebar counters (`adjustCount`, `recalcAllCounts`) |
| `embed.ts` | Auto-embedding via OpenAI (with stub fallback) |
| `errors.ts` | Error classification and logging to `error_log` table |

---

## Related Documentation

- [AUTH-AND-RBAC.md](AUTH-AND-RBAC.md) — Authentication and role details
- [DATA-MODEL.md](DATA-MODEL.md) — Database schema and migrations
- [EXTENDING.md](EXTENDING.md) — How to add custom functions, routes, and actions
- [ENVIRONMENT.md](ENVIRONMENT.md) — Environment variable reference
- [MANIFESTO.md](MANIFESTO.md) — Design philosophy
