# Spine — Authentication & Role-Based Access Control

Spine uses Supabase Auth for identity with a two-tier RBAC system: system roles (global) and account roles (per-tenant).

---

## Authentication Flow

```
Browser                          Netlify Function              Supabase
  │                                    │                          │
  │  1. Login (email/password)         │                          │
  │ ──────────────────────────────────────────────────────────►   │
  │                                    │          JWT + session   │
  │  ◄───────────────────────────────────────────────────────────│
  │                                    │                          │
  │  2. API call with Bearer JWT       │                          │
  │  + X-Account-Id header             │                          │
  │ ──────────────────────────►        │                          │
  │                                    │  3. Verify JWT           │
  │                                    │ ────────────────────────►│
  │                                    │       user object        │
  │                                    │ ◄────────────────────────│
  │                                    │                          │
  │                                    │  4. Lookup person by     │
  │                                    │     auth_uid             │
  │                                    │  5. Lookup membership    │
  │                                    │     for account_id       │
  │                                    │  6. Execute handler      │
  │         JSON response              │                          │
  │  ◄─────────────────────────        │                          │
```

### Key Points

- **Supabase Auth** handles login, session, and JWT issuance in the browser
- The **JWT is forwarded** as `Authorization: Bearer <token>` to every API call
- Netlify Functions verify the JWT via `db.auth.getUser(token)` using the service role client
- The frontend **never queries the database directly** — all access is through the API layer

---

## Request Headers

Every API request can include these headers:

| Header | Required | Purpose |
|---|---|---|
| `Authorization` | Yes | `Bearer <supabase_jwt>` |
| `X-Account-Id` | Recommended | Selects the tenant context |
| `X-Account-Node-Id` | Optional | Selects a sub-account node (hierarchical accounts) |
| `X-Request-Id` | Optional | Correlation ID (auto-generated if missing) |
| `X-Impersonate-Session-Id` | Optional | Activates impersonation (system admins only) |

---

## Two-Tier Role System

### System Roles (Global)

Stored in `profiles.system_role`. Apply across all accounts.

| Role | Capabilities |
|---|---|
| `system_admin` | Full access to all accounts, can impersonate any user, can browse all accounts |
| `system_operator` | Same as system_admin (treated equivalently in code) |
| `support_operator` | Read access for support purposes |
| `null` | No system-level privileges |

### Account Roles (Per-Tenant)

Stored in `memberships.account_role`. Scoped to a single account.

| Role | Rank | Capabilities |
|---|---|---|
| `admin` | 3 | Full account management, settings, members, automations, webhooks |
| `operator` | 2 | Create/edit workflows, items, KB articles |
| `member` | 1 | Standard access — view items, submit tickets, participate |
| `portal` | 0 | External/customer access — limited to portal views |

### Role Hierarchy

Roles are ranked numerically. A user with rank N can do everything ranks < N can do:

```
portal (0) < member (1) < operator (2) < admin (3)
```

System admins bypass all account role checks.

---

## Middleware Helpers

Located in `core/functions/_shared/middleware.ts`:

### `requireAuth(ctx)`
Returns 401 if `ctx.personId` is null (no valid JWT).

```typescript
const authCheck = requireAuth(ctx)
if (authCheck) return authCheck
```

### `requireTenant(ctx)`
Returns 403 if `ctx.accountId` is null (no tenant context resolved).

```typescript
const tenantCheck = requireTenant(ctx)
if (tenantCheck) return tenantCheck
```

### `requireRole(ctx, roles)`
Returns 403 unless the user's `accountRole` is in the given list. System admins always pass.

```typescript
const roleCheck = requireRole(ctx, ['admin'])
if (roleCheck) return roleCheck
```

### `requireMinRole(ctx, minRole)`
Returns 403 unless the user's role rank is ≥ the required role rank. System admins always pass.

```typescript
const roleCheck = requireMinRole(ctx, 'operator')
if (roleCheck) return roleCheck
```

### `isPortalUser(ctx)`
Returns `true` if the user's account role is `'portal'`.

---

## Auth Resolution Pipeline

The middleware resolves context in this order:

### 1. `resolveAuth(req)`

- Extracts Bearer token from `Authorization` header
- Verifies JWT via `db.auth.getUser(token)`
- Looks up `persons` by `auth_uid`
- Loads `profiles.system_role`
- Returns `{ authUid, personId, systemRole }`

### 2. `resolveImpersonation(req, auth)`

- Checks for `X-Impersonate-Session-Id` header
- Validates caller is `system_admin` or `system_operator`
- Looks up active, non-expired `impersonation_sessions` record
- If valid, swaps the entire context to the target person/account

### 3. `resolveTenant(req, personId, systemRole)`

- Reads `X-Account-Id` header (or `account_id` query param)
- Looks up the user's membership for that account
- If no membership but user is system admin → grants `admin` role
- If no account ID provided → falls back to user's first active membership
- Returns `{ accountId, accountRole }`

### 4. `resolveAccountNode(req, accountId)`

- Reads `X-Account-Node-Id` header (or `account_node_id` query param)
- Validates the node is a descendant of the tenant account via `account_paths`
- Falls back to the account ID itself if invalid
- Returns `accountNodeId`

---

## RequestContext

The resolved context object passed to every handler:

```typescript
interface RequestContext {
  requestId: string                    // Correlation ID
  personId: string | null              // Resolved person (or impersonated target)
  accountId: string | null             // Resolved tenant account
  accountNodeId: string | null         // Resolved sub-account node
  accountRole: string | null           // 'admin' | 'operator' | 'member' | 'portal'
  systemRole: string | null            // 'system_admin' | 'system_operator' | null
  authUid: string | null               // Supabase Auth user ID
  impersonating: boolean               // True if in impersonation session
  realPersonId: string | null          // Admin's person ID during impersonation
  impersonationSessionId: string | null
}
```

---

## Auto-Provisioning

When a new user signs in for the first time, the frontend calls `POST /api/provision-user`. This endpoint:

### Default Path (no invite, no account slug)
1. Creates a `persons` record linked to the Supabase Auth user
2. Creates a `profiles` record
3. Creates a new `accounts` record (organization)
4. Creates a `memberships` record with role `admin`

### Invite Path (with `invite_token`)
1. Validates the invite token
2. Creates person + profile
3. Creates membership in the invited account with the specified role
4. Marks the invite as accepted

### Portal Signup Path (with `account_slug`)
1. Looks up the account by slug
2. Creates person + profile
3. Creates membership with role `portal`

---

## Impersonation

System admins can "act as" any user for troubleshooting.

### Starting a Session

```
POST /api/impersonate
{
  "target_person_id": "...",
  "target_account_id": "...",
  "reason": "Customer requested help with workflow"
}
```

Creates an `impersonation_sessions` record with a 1-hour expiry.

### During Impersonation

- The `X-Impersonate-Session-Id` header is sent with every request
- The middleware swaps the context to the target person/account
- `systemRole` is set to `null` during impersonation (prevents privilege escalation)
- All audit/activity entries are tagged with `impersonated_by` and `impersonation_session_id`

### Ending a Session

```
DELETE /api/impersonate?session_id=...
```

Sets the session status to `'ended'`.

### UI

- `AccountBrowserPage` — admin UI for browsing accounts and starting impersonation
- `ImpersonationBanner` — yellow banner shown during active impersonation
- `useImpersonation` hook — manages session state in the frontend

---

## Frontend Auth Context

The `useAuth` hook (`src/hooks/useAuth.tsx`) provides:

```typescript
interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  memberships: Membership[]
  currentAccountId: string | null
  currentAccountNodeId: string | null
  currentRole: string | null
  loading: boolean
  setCurrentAccountId: (id: string | null) => void
  setCurrentAccountNodeId: (id: string | null) => void
  refresh: () => Promise<void>
}
```

### Account Context Persistence

- `currentAccountId` is persisted in `localStorage` via `accountContext.ts`
- On page load, the stored account is restored if the user still has a membership (or is a system admin)
- Switching accounts in the sidebar triggers `setCurrentAccountId()`, which updates both React state and localStorage
- The `api.ts` module reads from `accountContext.ts` to inject `X-Account-Id` into every request

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Middleware and request lifecycle details
- [DATA-MODEL.md](DATA-MODEL.md) — Tables: persons, profiles, memberships, impersonation_sessions
- [FRONTEND.md](FRONTEND.md) — useAuth hook and account context
- [EXTENDING.md](EXTENDING.md) — How to use RBAC in custom functions
- [AUTH-SCOPE-MODEL.md](AUTH-SCOPE-MODEL.md) — Proposed scope-driven authorization evolution
