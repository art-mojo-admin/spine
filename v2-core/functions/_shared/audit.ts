/**
 * @module audit
 * @audience both
 * @layer shared-core
 * @stability stable
 *
 * Unified audit logging for all operations in Spine. Every state-changing
 * operation should call `emitAudit` to write a structured row to the `logs`
 * table with full principal provenance. Audit failures never throw — a failed
 * log write must never break the operation that triggered it.
 *
 * INVARIANT: always call `emitAudit` after a successful write, not before.
 *   Pass `result: 'failure'` only when the operation itself failed.
 * INVARIANT: never pass sensitive secrets (API keys, tokens) in metadata.
 *
 * @seeAlso principal.ts (formatPrincipalForAudit — shapes the principal field)
 * @seeAlso middleware.ts (CoreContext — ctx.requestId ties logs to HTTP requests)
 * @seeAlso logs.ts (API handler that queries the logs table)
 * @seeAlso permissions.ts (getPrincipalPermissionSummary — used in metadata)
 */

import { CoreContext } from './middleware'
import { adminDb } from './db'
import { Principal, formatPrincipalForAudit } from './principal'

// ─── PRIMARY AUDIT FUNCTION ───────────────────────────────────────────────────

/**
 * Writes a structured audit log entry to the `logs` table with full principal
 * provenance, action context, and optional before/after change data.
 *
 * Log level is derived automatically:
 *   - `result: 'failure'` or `result: 'denied'` → `level: 'warning'`
 *   - all other results (including undefined) → `level: 'info'`
 *
 * Uses `ctx.db` (RLS-scoped) if available, falling back to `adminDb` for
 * system operations where no user context is present (e.g. cron, triggers).
 *
 * Never throws — all errors are caught and logged to console only.
 *
 * @param ctx - Request context with principal, accountId, requestId, and db
 * @param action - Dot-namespaced action string (e.g. `'items.create'`, `'people.update'`)
 * @param target - The resource being acted upon
 * @param metadata - Optional additional context: changes, result, error, custom fields
 *
 * @inputSpec ctx.principal: Principal — resolved principal; null is tolerated
 * @inputSpec ctx.requestId: string — ties this log entry to an HTTP request
 * @inputSpec action: string — dot-namespaced, e.g. 'entity.operation' (never empty)
 * @inputSpec target.type: string — resource type slug (e.g. 'item', 'account', 'pipeline')
 * @inputSpec target.id: string | undefined — UUID of the specific resource, if known
 * @inputSpec target.account_id: string | undefined — account scope; falls back to ctx.accountId
 * @inputSpec metadata.result: 'success' | 'failure' | 'denied' | undefined
 * @inputSpec metadata.changes: { before?, after? } | undefined — for update operations
 * @inputSpec metadata.error: string | undefined — error message on failure
 * @outputSpec void — always resolves, never rejects
 * @throws never — catches all DB errors internally
 * @sideEffects DB write: inserts one row into `logs` table
 * @calledBy Every state-changing handler across all 19 API functions
 * @calledBy pipeline-runner.ts, trigger-engine.ts, agent-runner.ts
 * @calls formatPrincipalForAudit (principal.ts), ctx.db or adminDb
 * @testUnit none — side-effect only; tested via integration
 * @testIntegration tests/integration/audit-assertions.test.ts
 *
 * @example API handler usage
 * ```ts
 * await emitAudit(ctx, 'items.create', { type: 'item', id: newItem.id }, {
 *   result: 'success',
 *   changes: { after: newItem }
 * })
 * ```
 *
 * @example Import usage (v2-custom/)
 * ```ts
 * import { emitAudit } from '../_shared/index'
 * await emitAudit(ctx, 'custom.my_action', { type: 'item', id: record.id }, {
 *   result: 'success'
 * })
 * ```
 *
 * @example Denied access logging
 * ```ts
 * await emitAudit(ctx, 'items.read', { type: 'item', id: record.id }, {
 *   result: 'denied',
 *   error: 'Insufficient permissions'
 * })
 * ```
 */
export async function emitAudit(
  ctx: CoreContext,
  action: string,
  target: { type: string; id?: string; account_id?: string },
  metadata?: {
    changes?: { before?: any; after?: any }
    result?: 'success' | 'failure' | 'denied'
    error?: string
    [key: string]: any
  }
): Promise<void> {
  try {
    // Use the RLS-scoped db from context, or fallback to adminDb
    const logDb = ctx.db || adminDb
    
    await logDb.from('logs').insert({
      level: metadata?.result === 'failure' || metadata?.result === 'denied' ? 'warning' : 'info',
      source: 'audit',
      message: `${action} by ${ctx.principal?.type || 'unknown'}:${ctx.principal?.id || 'anonymous'}`,
      metadata: {
        principal: ctx.principal ? formatPrincipalForAudit(ctx.principal) : null,
        action,
        target: {
          type: target.type,
          id: target.id,
          account_id: target.account_id || ctx.accountId
        },
        request_id: ctx.requestId,
        ...metadata
      },
      account_id: target.account_id || ctx.accountId || ctx.principal?.accountId || null
    })
  } catch (err) {
    console.error('Failed to emit audit log:', err)
    // Don't throw - audit failures shouldn't break operations
  }
}

// ─── LEGACY EXPORTS ───────────────────────────────────────────────────────────

/**
 * Legacy audit function — thin wrapper around `emitAudit`.
 *
 * Accepts the older positional argument style. Preserved for backward
 * compatibility. All new code should call `emitAudit` directly.
 *
 * @param ctx - Request context
 * @param eventType - Action string (maps to `action` in `emitAudit`)
 * @param target - Optional target resource with type and id
 * @param changes - Optional before/after change data
 * @param metadata - Additional key/value context
 *
 * @inputSpec eventType: string — action string, same as emitAudit's `action`
 * @inputSpec target: { type, id } | undefined
 * @inputSpec changes: { before?, after? } | undefined
 * @outputSpec void — always resolves
 * @throws never
 * @sideEffects DB write via emitAudit → logs table
 * @calledBy Legacy callers; new code should use emitAudit directly
 * @calls emitAudit
 * @deprecated Use emitAudit() for new code
 * @stability internal
 */
export async function emitLog(
  ctx: CoreContext,
  eventType: string,
  target?: { type: string; id: string },
  changes?: { before?: any; after?: any },
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await emitAudit(ctx, eventType, {
      type: target?.type || 'unknown',
      id: target?.id,
      account_id: ctx.accountId || undefined
    }, {
      changes,
      ...metadata
    })
  } catch (error) {
    console.error('Failed to emit log:', error)
    // Don't throw - logging failures shouldn't break operations
  }
}

/**
 * Legacy activity logger — wraps `emitLog` with an `activity.` prefix.
 *
 * Preserved for backward compatibility. All new code should call `emitAudit`
 * with a fully qualified action string (e.g. `'items.activity'`).
 *
 * @param ctx - Request context
 * @param type - Activity type string; prefixed with `'activity.'`
 * @param details - Key/value metadata passed through to the log entry
 *
 * @inputSpec type: string — activity type; must not already start with 'activity.'
 * @inputSpec details: Record<string, any> — arbitrary context, no secrets
 * @outputSpec void — always resolves
 * @throws never
 * @sideEffects DB write via emitLog → emitAudit → logs table
 * @calledBy Legacy callers only
 * @calls emitLog
 * @deprecated Use emitAudit() for new code
 * @stability internal
 */
export async function emitActivity(
  ctx: CoreContext,
  type: string,
  details: Record<string, any> = {}
): Promise<void> {
  await emitLog(ctx, `activity.${type}`, undefined, undefined, details)
}
