import { RequestContext } from './middleware'
import { db } from './db'

// Log an event using the v2.logs table
export async function emitLog(
  ctx: RequestContext,
  eventType: string,
  target?: { type: string; id: string },
  changes?: { before?: any; after?: any },
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await db.rpc('log_event', {
      event_type: eventType,
      actor_id: ctx.personId || null,
      target_type: target?.type || null,
      target_id: target?.id || null,
      action: metadata.action || null,
      details: changes || {},
      metadata,
      account_id: ctx.accountId!,
      app_id: ctx.appId || null
    })
  } catch (error) {
    console.error('Failed to emit log:', error)
    // Don't throw - logging failures shouldn't break operations
  }
}

// Log an activity (legacy compatibility)
export async function emitActivity(
  ctx: RequestContext,
  type: string,
  details: Record<string, any> = {}
): Promise<void> {
  await emitLog(ctx, `activity.${type}`, undefined, undefined, details)
}
