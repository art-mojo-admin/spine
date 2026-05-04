/**
 * @module db
 * @audience both
 * @layer shared-core
 * @stability stable
 *
 * Supabase client factory and PostgREST join helpers. This module owns the
 * two-client pattern that is central to Spine's security model: `adminDb`
 * bypasses RLS for system operations; `getUserDb` enforces RLS for all
 * human-principal requests. Never use `adminDb` for user-scoped queries —
 * doing so silently bypasses account isolation.
 *
 * @seeAlso principal.ts (getPrincipalDb selects between these two clients)
 * @seeAlso middleware.ts (ctx.db is set from getPrincipalDb at request time)
 */

import { createClient } from '@supabase/supabase-js'

// ─── ENVIRONMENT RESOLUTION ──────────────────────────────────────────────────

const _env = (globalThis as any).process?.env || {}
const supabaseUrl: string = _env.SUPABASE_URL!
const supabaseServiceKey: string = _env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey: string = _env.SUPABASE_ANON_KEY!

/**
 * Active database schema name, read from `DB_SCHEMA` env var.
 *
 * Defaults to `'public'` (production schema). Set to `'v2'` only in legacy
 * environments. All new migrations target `public`.
 *
 * @inputSpec DB_SCHEMA: string — one of 'public' | 'v2'. Any other value is
 *   passed through as-is and will cause runtime query errors.
 * @outputSpec string — schema name applied to both Supabase clients.
 * @sideEffects none
 * @calledBy adminDb, getUserDb (applied at client construction time)
 */
const dbSchema: string = _env.DB_SCHEMA || 'public'

// ─── CLIENTS ─────────────────────────────────────────────────────────────────

/**
 * Service-role Supabase client. Bypasses Row Level Security.
 *
 * Use this ONLY for:
 * - System/cron operations that must cross account boundaries (`system-cron.ts`)
 * - Principal resolution lookups (`principal.ts` — resolving auth_uid to person)
 * - Machine principal validation RPCs
 * - Test helpers that need to seed/clean data across accounts
 *
 * Do NOT use this in request handlers for user-scoped data reads or writes.
 * Always prefer `ctx.db` (set by `getPrincipalDb` in middleware) for those.
 *
 * @inputSpec SUPABASE_URL: string — valid Supabase project URL, required
 * @inputSpec SUPABASE_SERVICE_ROLE_KEY: string — service role JWT, required
 * @outputSpec SupabaseClient — PostgREST client scoped to `dbSchema`, RLS disabled
 * @sideEffects none (client construction only)
 * @calledBy principal.ts, middleware.ts, system-cron.ts, permissions.ts,
 *   tests/integration/helpers.ts
 * @calls createClient (supabase-js)
 * @testUnit tests/unit/pipeline-runner.test.ts — mocked via vi.mock
 * @testIntegration tests/integration/helpers.ts — used directly as adminDb
 *
 * @example API handler (system operation)
 * ```ts
 * import { adminDb } from './_shared/db'
 * const { data } = await adminDb.from('types').select('*').eq('slug', 'item')
 * ```
 *
 * @example Import usage (v2-custom/ — system-level only)
 * ```ts
 * import { adminDb } from '../_shared/index'
 * // Only use adminDb if your custom code runs as a system/cron principal
 * ```
 */
export const adminDb = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: dbSchema
  }
})

/**
 * Creates a Supabase client scoped to a specific user JWT, with RLS enforced.
 *
 * Every query made through this client is subject to the RLS policies defined
 * in the database. The `get_accessible_accounts()` function is called by those
 * policies to resolve which account rows the JWT holder can see. This is the
 * correct client for all human-principal request handlers.
 *
 * Called by `getPrincipalDb()` in `principal.ts` when the principal is human.
 * Should not be called directly in handlers — use `ctx.db` instead.
 *
 * @param jwt - The user's Supabase JWT obtained from the Authorization header.
 *   Must be a valid, non-expired JWT issued by this project's Supabase Auth.
 *
 * @inputSpec jwt: string — valid Bearer JWT from Supabase Auth, non-empty
 * @outputSpec SupabaseClient — PostgREST client with RLS enforced via Authorization header
 * @throws never — invalid JWTs do not throw here; RLS policies reject queries at runtime
 * @sideEffects none (client construction only)
 * @calledBy principal.ts (getPrincipalDb), middleware.ts (ctx.db setup)
 * @calls createClient (supabase-js)
 * @testUnit tests/unit/permissions.test.ts — getUserDb result mocked
 * @testIntegration tests/integration/isolation.test.ts — verifies RLS enforcement
 *
 * @example API handler (via middleware — preferred)
 * ```ts
 * // In createHandler, ctx.db is already set to getUserDb(jwt) for human principals
 * const { data } = await ctx.db.from('items').select('*')
 * ```
 *
 * @example Direct construction (principal resolution only)
 * ```ts
 * import { getUserDb } from './_shared/db'
 * const db = getUserDb(jwt)
 * const { data } = await db.from('accounts').select('id')
 * ```
 */
export function getUserDb(jwt: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: dbSchema
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  })
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

/**
 * Standard shape returned by all Supabase PostgREST queries.
 *
 * Both `data` and `error` follow the Supabase JS client convention: on success,
 * `error` is null; on failure, `data` is null and `error` contains the Postgres
 * error details. Always check `error` before using `data`.
 *
 * @inputSpec T — the expected shape of a successful result row
 * @outputSpec data: T | null — the query result, null on error
 * @outputSpec error: any — null on success, Postgres/PostgREST error object on failure
 * @calledBy used as return type annotation across all functions/*.ts handlers
 *
 * @example
 * ```ts
 * const result: DbResult<Item> = await adminDb.from('items').select('*').single()
 * if (result.error) throw result.error
 * return result.data!
 * ```
 */
export type DbResult<T> = {
  data: T | null
  error: any
}

// ─── JOIN HELPERS ─────────────────────────────────────────────────────────────

/**
 * PostgREST relationship hint strings for all foreign keys in the public schema.
 *
 * These strings are interpolated into `.select()` calls to eager-load related
 * records in a single query. They use explicit `!fk_column` hints to resolve
 * ambiguous relationships — required when a table has multiple FKs to the same
 * target table, or when the FK column name doesn't follow PostgREST's default
 * `tablename_id` inference convention (e.g. `created_by` → `people.id`).
 *
 * Only add a join here when it is used in two or more handlers. One-off joins
 * should be written inline.
 *
 * @inputSpec none — these are static string constants
 * @outputSpec string — valid PostgREST embed expression for use in .select()
 * @sideEffects none
 * @calledBy types.ts, apps.ts, pipelines.ts, triggers.ts, admin-data.ts, and others
 * @testUnit none — these are string constants; incorrect joins fail at runtime
 * @testIntegration tests/integration/admin-data-accounts.test.ts — exercises joins.type
 *
 * @example
 * ```ts
 * import { joins } from './_shared/db'
 * const { data } = await ctx.db
 *   .from('items')
 *   .select(`*, ${joins.type}, ${joins.app}`)
 * // Returns items with nested type and app objects
 * ```
 */
export const joins = {
  type:         'type:types!type_id(id, slug, name, icon, color, design_schema)',
  app:          'app:apps!app_id(id, slug, name)',
  ownerAccount: 'owner_account:accounts!owner_account_id(id, slug, display_name)',
  createdBy:    'created_by_person:people!created_by(id, full_name, email)',
  parentAccount:'parent:accounts!parent_id(id, slug, display_name)',
  role:         'role:roles!role_id(id, slug, name)',
  pipeline:     'pipeline:pipelines!pipeline_id(id, name)',
}
