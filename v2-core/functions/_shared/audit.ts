import { RequestContext } from './middleware'
import { adminDb } from './db'
import { Principal, formatPrincipalForAudit } from './principal'

// ============================================
// UNIFIED AUDIT LOGGING (New Architecture)
// ============================================

/**
 * Emit a unified audit log entry with full principal provenance
 * 
 * This is the primary audit function for the Unified Principal Architecture.
 * It captures complete context about who performed an action, how they were
 * authenticated, and what the result was.
 * 
 * @param ctx - RequestContext with principal
 * @param action - The action performed (e.g., 'items.create', 'people.update')
 * @param target - The target resource {type, id, account_id}
 * @param metadata - Additional context (changes, result, etc.)
 */
export async function emitAudit(
  ctx: RequestContext,
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

// ============================================
// LEGACY FUNCTIONS (Maintained for backwards compatibility)
// ============================================

/**
 * Log an event using the v2.logs table (legacy)
 * @deprecated Use emitAudit() for new code
 */
export async function emitLog(
  ctx: RequestContext,
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
 * Log an activity (legacy compatibility)
 * @deprecated Use emitAudit() for new code
 */
export async function emitActivity(
  ctx: RequestContext,
  type: string,
  details: Record<string, any> = {}
): Promise<void> {
  await emitLog(ctx, `activity.${type}`, undefined, undefined, details)
}
