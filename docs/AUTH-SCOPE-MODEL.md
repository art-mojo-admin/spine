# Scope-Driven Authorization & Capability Model

> Spine Core evolution proposal — expands todays system/account role RBAC into a scope-driven, package-aware capability framework.

## 1. Baseline (Current State + Gaps)

| Area | Today | Pain / Gap |
| --- | --- | --- |
| Role constructs | System role on `profiles`, account role on `memberships` (see [`AUTH-AND-RBAC.md`](AUTH-AND-RBAC.md)) | Hardcoded role lists, no way to express domain-focused access (e.g., "Support workflows but not CRM") |
| Package enablement | `config_packs`, `pack_activations`, `pack_entity_mappings`, `ownership` columns | Packs ship views/apps/items but cant describe the capabilities they expose, nor how tenants toggle subsets |
| Capability checks | Middleware helpers (`requireRole`, `requireMinRole`) plus ad-hoc conditional logic | Lacks record/field granularity, no shared vocabulary for actions like assign/archive/export |
| Machine actors | Implicit (API tokens, automation runners) | No first-class principal, unclear audit surface area |
| Overrides | System defaults baked into code | Tenants cannot override defaults without forking code or editing migrations |
| Telemetry | None | Cannot explain *why* a user has/denied access |

## 2. Core Concepts & Vocabulary

### Principals
1. **Human** (`persons` + `memberships`)
2. **Machine/Automation** (new `machine_principals` table, ties to service accounts, AI agents, webhooks)
3. **System** (Spine runtime operations; mostly existing `system_admin`/`operator` personas)

Each principal references:
- `principal_id` (UUID)
- `principal_type` (`human`, `machine`, `system`)
- Auth bindings (Supabase UID, signed key, OAuth client, etc.)

### Tenancy Layers
1. **System** — cross-account operations
2. **Account** — tenant-wide actions (`accounts.id`)
3. **Account Node** — sub-tenancy via `account_nodes`
4. **Self/Portal** — actions on data owned by the principal or entity-linked (customer portal patterns)

### Scopes
- **Definition:** Named capability bundles representing a domain or product area (e.g., `support.inbox`, `crm.pipeline`, `automation.workflows`).
- **Attributes:**
  - `scope_id`, `slug`, `label`, `description`
  - `capability_bundle_id` (reference to granular actions)
  - `default_role_rank` suggestions (e.g., recommended minimum account role)
  - Relationships to template packs and tenancy levels supported

Scopes become the shared vocabulary across packages, admin UI, and enforcement logic.

## 3. Data Model & Runtime Configuration

### New / Extended Tables

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `auth_scopes` | Canonical registry of scopes shipped by Spine Core | `id`, `slug`, `label`, `description`, `category`, `default_bundle_id`, `enabled_levels[]` |
| `package_scopes` | Many-to-many between `config_packs` and `auth_scopes` | `id`, `pack_id`, `scope_id`, `status`, `metadata`, `ownership ('pack')` |
| `account_scopes` | Tenant-level enablement overrides | `id`, `account_id`, `scope_id`, `status ('enabled','disabled','preview')`, `source ('pack','manual')`, `ownership ('tenant')`, `config jsonb` |
| `principal_scopes` | Assignment of scopes to principals | `id`, `principal_id`, `scope_id`, `assignment_type ('role_bundle','direct','justification')`, `granted_by`, `expires_at` |
| `scope_capabilities` | Atomic actions per scope | `id`, `scope_id`, `capability`, `description`, `record_type`, `field_path`, `default_policies` |
| `machine_principals` | Service accounts / automations | `id`, `account_id`, `name`, `kind ('api_key','automation','ai_agent')`, `auth_mode`, `status`, `audit_channel` |
| `principal_context_cache` (materialized) | Denormalized view for fast request resolution | `principal_id`, `account_id`, `scope_id`, `capabilities[]`, `tenant_overrides` |

### Lifecycle
1. **Pack authoring:** Template pack defines scopes it requires → entries in `package_scopes`.
2. **Pack install:** `pack-installer` seeds `account_scopes` rows with status `enabled` (or `preview`).
3. **Admin overrides:** Studio UI toggles scopes (per account / sub-account) → updates `account_scopes`.
4. **Principal assignment:** Admin assigns scope bundles to humans/machines → rows in `principal_scopes`.
5. **Runtime cache:** Background job/materialized view hydrates `principal_context_cache` for fast lookups.

## 4. Capability Modeling

### Capability Taxonomy
- **Record-level:** `view`, `list`, `create`, `edit`, `assign`, `transition`, `delete`, `export`.
- **Field-level:** `field.view`, `field.edit`, `field.mask` with optional `field_path` (JSON path) and conditionals (ownership, status, tags).
- **Action-level:** Workflow triggers, automation execution, integration calls.

### Policy Layers
1. **System default** — defined in `scope_capabilities.default_policies` (e.g., `portal` cannot `delete`).
2. **Package default** — optional overrides suggested by packs.
3. **Account override** — stored in `account_scopes.config` (JSON policy DSL).
4. **Principal override** — `principal_scopes` may grant/restrict capabilities (time-bound, justification, approvals).

Policies evaluate using a deterministic merge (system → package → account → principal). Later layers can only narrow or explicitly extend with audit requirement.

### Field Masking
- Define mask types (`hidden`, `readonly`, `redacted`, `obfuscated`).
- Field policies map to `record_type` + `field_path` with conditions (e.g., `if status = 'sealed' then mask`).

## 5. Machine Principals & AI Envelope

- **Machine principal records** live in `machine_principals`, linking to `accounts`.
- Each machine principal must have at least one scope assignment.
- Auth modes: signed JWT, API key, OAuth client credentials.
- **Action modes:** `observe` (read-only), `suggest` (write proposals requiring human approval), `execute` (direct write with on-call guardrails).
- **Audit:** Every action tagged with `principal_type`, `machine_principal_id`, optional `impersonated_person_id` (for AI copilots acting on behalf of humans).
- **Rate / safety controls:** Stored per scope to cap automation frequency.

## 6. Resolution & Enforcement Flow

```
request → resolvePrincipal() → resolveTenancy() → resolveScopes() → evalCapabilities() → handler guard
```

1. **resolvePrincipal**
   - Existing auth + new machine principal lookup
   - Produces `principalContext` (type, ids, impersonation flags)
2. **resolveTenancy**
   - Same account / account-node detection as today
   - Adds `tenancyLevel` into context
3. **resolveScopes**
   - Pull `principal_context_cache` rows for (principal, account, level)
   - Fall back to on-demand join if cache miss
4. **evalCapabilities**
   - Determine record/field permissions for requested resource via merge layers
   - Return `capabilitySet` with allow/deny + justifications
5. **Handler guard**
   - Functions declare required capability expression (`support.inbox::view + assign`)
   - Middleware short-circuits, returning 403 with explanation payload

### Friendly Roles
- Existing roles become higher-level *scope bundles*: e.g., `System Support Operator` = `system_admin` + `support.*` scopes.
- Admin UI still shows “roles”, but under the hood they resolve to scope assignments.

## 7. Admin / Runtime UX & Rollout

### Admin Surfaces
1. **Scope Library** (system): inspect global scopes, pack mapping, capability definitions.
2. **Account Scopes** (tenant): toggle scopes, preview resulting UI/views, provide override notes.
3. **Principal Assignments**: assign bundles to members & machines, set expirations, require approvals.
4. **Audit Explorer**: explain why access was granted/denied (derived from capability evaluation trace).

### Rollout Plan
1. **Backfill metadata:** Generate core scope registry from existing packs (Support, CRM, etc.).
2. **Dual-write phase:** Keep legacy roles while capturing scope usage → telemetry proves parity.
3. **Feature gating:** Use account flag to opt into scope enforcement per tenant.
4. **Deprecation:** After parity achieved, migrate `requireRole/minRole` to capability guards, drop unused roles.

### Telemetry & Tooling
- `auth_decision_logs` table capturing evaluation inputs/outputs.
- Dashboards showing most-denied capabilities, orphaned scopes, stale assignments.

## 8. Next Steps
1. Formalize schema (write migrations + ERD) and validate with Supabase MCP project.
2. Prototype scope resolution middleware + materialized view refresh job.
3. Update pack authoring tools to declare required scopes + default bundles.
4. Build admin UI slices for scope toggles and principal assignment flows.
5. Define migration script translating current account roles into initial scope bundles.
