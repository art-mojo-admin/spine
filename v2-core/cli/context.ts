/// <reference types="node" />
/**
 * @module cli/context
 * @audience installer
 * @layer cli
 * @stability stable
 *
 * CLI context builder and output utilities. This is the CLI equivalent of
 * `createHandler()` in `middleware.ts` — it resolves the principal, picks the
 * correct Supabase client, and returns a `CoreContext` that every CLI command
 * passes directly to core functions.
 *
 * **Environment variables read from `.xenv` or `process.env`:**
 * | Variable                  | Required | Purpose                            |
 * |---------------------------|----------|------------------------------------|
 * | `SUPABASE_URL`            | yes      | Project API URL                    |
 * | `SUPABASE_SERVICE_ROLE_KEY` | yes    | Service-role client (admin ops)    |
 * | `SUPABASE_ANON_KEY`       | yes      | User-scoped client (JWT mode)      |
 * | `SPINE_CLI_ACCOUNT_ID`    | no       | Default account scope              |
 * | `SPINE_CLI_JWT`           | no       | Human principal (Supabase JWT)     |
 * | `SPINE_CLI_API_KEY`       | no       | Machine principal (hashed key)     |
 * | `SPINE_CLI_DEBUG`         | no       | Print stack traces on error        |
 *
 * **Principal resolution priority** (first match wins):
 * 1. `SPINE_CLI_JWT` → human principal (RLS-scoped `getUserDb`)
 * 2. `SPINE_CLI_API_KEY` → machine principal (`adminDb`)
 * 3. Fallback → `SYSTEM_PRINCIPAL` (`adminDb` — admin ops only)
 *
 * @seeAlso functions/_shared/middleware.ts (createHandler — server-side equivalent)
 * @seeAlso functions/_shared/principal.ts (Principal type and SYSTEM_PRINCIPAL)
 * @seeAlso cli/index.ts (entry point that imports all commands)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CoreContext, adminDb, SYSTEM_PRINCIPAL, Principal, getUserDb } from '../functions/_shared/index.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── ENV LOADING ────────────────────────────────────────────────────────────

/**
 * Reads `.xenv` from `v2-core/.xenv` and populates `process.env` with any
 * vars not already set. Silently skips if the file does not exist.
 *
 * Uses a manual line parser (no dotenv dependency) to keep the CLI
 * installable without additional npm packages.
 *
 * @sideEffects Mutates process.env — only sets keys not already present
 * @calledBy buildCliContext (called on every command invocation)
 */
function loadEnv() {
  const envPath = resolve(__dirname, '../.xenv')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

// ─── TYPES ──────────────────────────────────────────────────────────────────

/**
 * Options passed from CLI command `.action()` callbacks to `buildCliContext`.
 *
 * @inputSpec account: string | undefined — UUID of the target account; overrides
 *   `SPINE_CLI_ACCOUNT_ID` if both are present.
 * @calledBy All `registerXxxCommands` functions before calling core functions
 */
export interface CliOptions {
  account?: string
}

// ─── CONTEXT BUILDER ─────────────────────────────────────────────────────────

/**
 * Constructs a `CoreContext` for CLI command execution.
 *
 * Loads `.xenv`, validates required env vars, then resolves the principal and
 * Supabase client using the priority chain described in the module header.
 * Every CLI command calls this before invoking any core function.
 *
 * @param opts - Optional overrides (e.g. `{ account: id }` from `--account` flag)
 * @returns Fully resolved `CoreContext` ready for use with any core function
 * @throws Error('Missing required env vars...') if `SUPABASE_URL` or
 *   `SUPABASE_SERVICE_ROLE_KEY` is absent
 * @throws Error('Invalid or inactive SPINE_CLI_API_KEY') on bad API key
 * @throws Error('Invalid or expired SPINE_CLI_JWT') on bad/expired JWT
 *
 * @inputSpec opts.account: string | undefined — UUID; overrides SPINE_CLI_ACCOUNT_ID
 * @outputSpec CoreContext.principal: Principal — human | machine | SYSTEM_PRINCIPAL
 * @outputSpec CoreContext.db: SupabaseClient — getUserDb (JWT) or adminDb (API key / system)
 * @outputSpec CoreContext.requestId: string — fresh UUID per invocation
 * @sideEffects Reads process.env; calls adminDb for API key / person lookup
 * @calledBy Every `registerXxxCommands` action handler in commands/
 * @calls loadEnv, getUserDb, adminDb
 * @testCLI spine auth check (exercises all three principal paths)
 *
 * @example API key mode
 * ```bash
 * SPINE_CLI_API_KEY=<key> npx spine pipelines list
 * ```
 *
 * @example JWT mode
 * ```bash
 * SPINE_CLI_JWT=<supabase-jwt> npx spine items list --type ticket
 * ```
 *
 * @example System (admin) mode
 * ```bash
 * npx spine migrations list   # no auth vars set — uses SYSTEM_PRINCIPAL
 * ```
 */
export async function buildCliContext(opts: CliOptions = {}): Promise<CoreContext> {
  loadEnv()

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in v2-core/.xenv or export them before running spine commands.'
    )
  }

  const accountId = opts.account || process.env.SPINE_CLI_ACCOUNT_ID || null
  const requestId = crypto.randomUUID()

  // Machine API key auth
  const apiKey = process.env.SPINE_CLI_API_KEY
  if (apiKey) {
    const { data: keyRecord } = await adminDb
      .from('api_keys')
      .select('id, account_id, scopes, principal_id')
      .eq('key_hash', apiKey)
      .eq('is_active', true)
      .single()

    if (!keyRecord) {
      throw new Error('Invalid or inactive SPINE_CLI_API_KEY')
    }

    const principal: Principal = {
      id: keyRecord.principal_id || keyRecord.id,
      type: 'machine',
      accountId: keyRecord.account_id,
      scopes: keyRecord.scopes || [],
      provenance: {
        sourceType: 'api_key',
        createdBy: null,
        apiKeyId: keyRecord.id,
        invokedAt: new Date().toISOString()
      }
    }

    return {
      principal,
      accountId: accountId || keyRecord.account_id,
      db: adminDb,
      requestId
    }
  }

  // JWT auth (human principal)
  const jwt = process.env.SPINE_CLI_JWT
  if (jwt) {
    const userDb = getUserDb(jwt)
    const { data: { user } } = await userDb.auth.getUser()

    if (!user) {
      throw new Error('Invalid or expired SPINE_CLI_JWT')
    }

    const { data: person } = await adminDb
      .from('people')
      .select('id, full_name, email, roles:people_roles(role:roles(slug))')
      .eq('auth_user_id', user.id)
      .single()

    const roles = (person?.roles as any[])?.map((r: any) => r.role?.slug).filter(Boolean) || []

    const principal: Principal = {
      id: person?.id || user.id,
      type: 'human',
      accountId: accountId,
      displayName: person?.full_name || user.email,
      email: person?.email || user.email,
      roles,
      provenance: {
        sourceType: 'jwt',
        createdBy: person?.id || user.id,
        invokedAt: new Date().toISOString()
      },
      authContext: { jwt }
    }

    return {
      principal,
      accountId,
      db: userDb,
      requestId
    }
  }

  // Fallback: system principal (admin ops)
  return {
    principal: SYSTEM_PRINCIPAL,
    accountId,
    db: adminDb,
    requestId
  }
}

// ─── OUTPUT UTILITIES ─────────────────────────────────────────────────────────

/**
 * Pretty-prints a query result to stdout.
 *
 * - `--json` flag: emits `JSON.stringify(data, null, 2)`
 * - Array input (default): renders a left-aligned ASCII table with column headers
 *   and a trailing row count.
 * - Non-array input (default): falls back to `JSON.stringify`.
 *
 * @param data - The result to display (array of objects or any value)
 * @param opts - `{ json?: boolean }` — when true, bypass table rendering
 * @sideEffects Writes to stdout (console.log)
 * @calledBy All `registerXxxCommands` list/get action handlers
 * @testCLI Any `spine <cmd> list` command (visual verification)
 */
export function printResult(data: any, opts: { json?: boolean } = {}) {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('(no results)')
      return
    }
    const keys = Object.keys(data[0])
    const rows = data.map(row => keys.map(k => String(row[k] ?? '')))
    const widths = keys.map((k, i) => Math.max(k.length, ...rows.map(r => r[i].length)))
    const hr = widths.map(w => '-'.repeat(w)).join('  ')
    console.log(keys.map((k, i) => k.padEnd(widths[i])).join('  '))
    console.log(hr)
    rows.forEach(row => console.log(row.map((v, i) => v.padEnd(widths[i])).join('  ')))
    console.log(`\n(${data.length} row${data.length !== 1 ? 's' : ''})`)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
}

/**
 * Prints a formatted error message to stderr and exits with code 1.
 *
 * If `SPINE_CLI_DEBUG` is set, also prints the full stack trace.
 * All CLI command action handlers end their catch blocks with
 * `handleError(err)` so error reporting is consistent across commands.
 *
 * @param err - The caught error (Error object or string)
 * @sideEffects Writes to stderr; calls `process.exit(1)`
 * @throws never — terminates the process instead
 * @calledBy All `registerXxxCommands` action handlers
 */
export function handleError(err: any) {
  console.error(`\nError: ${err.message || err}`)
  if (process.env.SPINE_CLI_DEBUG) {
    console.error(err.stack)
  }
  process.exit(1)
}
