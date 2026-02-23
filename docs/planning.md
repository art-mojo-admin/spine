# Spine — Planning & Architecture Decisions

## Tenancy Model

- **Tenant boundary** = `account_id` on every core table row
- Every API request resolves: `person_id`, `account_id`, `account_role`, `system_role`
- All DB queries enforce tenant scoping unless a permitted `system_role` explicitly overrides
- Single-tenant mode via `accounts.settings.single_tenant_mode` — UI hides switcher, auto-selects tenant

## RBAC Model

### Account Roles (tenant-level, via `memberships.account_role`)
| Role | Access |
|---|---|
| `admin` | Full tenant access: CRUD all entities, manage members, settings, webhooks, themes |
| `operator` | Manage workflows, tickets, KB articles |
| `member` | Read access with limited write (create tickets, reply to messages) |

### System Roles (global, via `profiles.system_role`)
| Role | Access |
|---|---|
| `system_admin` | Cross-tenant admin, bypasses tenant scoping |
| `system_operator` | Cross-tenant read access |
| `support_operator` | Cross-tenant ticket access |

### Enforcement
- Middleware chain: `parse request_id → verify JWT → resolve person + tenant → check RBAC → handler → emit audit + activity → respond`
- `requireAuth()` — ensures valid JWT + person exists
- `requireTenant()` — ensures tenant context resolved
- `requireRole(roles)` — checks account_role OR system_role override

## Audit & Activity

- **audit_log**: Append-only. Every write records `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `request_id`, `person_id`, `account_id`.
- **activity_events**: Append-only. Human-readable `summary` + `event_type` for feed display.
- Both emitted in the API layer after every successful write operation.
- `request_id` propagated from client via `X-Request-Id` header (or auto-generated).

## Webhook Delivery

- **Outbox pattern**: Writes emit to `outbox_events`. Scheduled function processes unprocessed events, creating `webhook_deliveries`.
- **HMAC signing**: `HMAC-SHA256(signing_secret, payload)` in `X-Spine-Signature` header.
- **Retry/backoff**: Up to 5 attempts. Exponential backoff (30s × 2^attempt). Dead-letter after max attempts.
- **Replay**: Admin can reset a dead-letter delivery to `pending` for re-delivery.

## Multi-Vector Embeddings

- `embeddings` table with `vector_type` facet allows multiple vectors per entity (e.g., "title", "body", "summary").
- Search filtered by `account_id + entity_type + vector_type`.
- Stub embedder generates deterministic vectors from text; structured for real model swap via `model` column.

## Theming

- `tenant_themes` stores `preset`, `tokens` (JSON of HSL values), `dark_tokens`, `logo_url`.
- Frontend loads tokens on auth and applies as CSS custom properties on `:root`.
- 3 presets: Clean (light blue), Bold (dark purple), Muted (earth tones).
- Theme Editor provides live preview with real-time CSS var injection.

## Technology Choices

| Decision | Rationale |
|---|---|
| React + Vite | Fast dev server, modern tooling, wide ecosystem |
| TailwindCSS + shadcn/ui | Apple-clean design out of the box, CSS var theming |
| Netlify Functions | Serverless, zero-infra, scheduled functions for webhooks |
| Supabase Postgres | Managed Postgres with auth, pgvector extension |
| Supabase Auth (JWT only) | Browser auth only — no direct table access from frontend |
