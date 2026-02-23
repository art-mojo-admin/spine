import { db } from './db'
import type { RequestContext } from './middleware'

export async function emitAudit(
  ctx: RequestContext,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeData: unknown = null,
  afterData: unknown = null,
) {
  try {
    const metadata: Record<string, unknown> = {}
    if (ctx.impersonating && ctx.realPersonId) {
      metadata.impersonated_by = ctx.realPersonId
      metadata.impersonation_session_id = ctx.impersonationSessionId
    }

    await db.from('audit_log').insert({
      account_id: ctx.accountId,
      person_id: ctx.personId,
      request_id: ctx.requestId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: beforeData,
      after_data: afterData,
      metadata,
    })
    const impTag = ctx.impersonating ? ' [IMPERSONATED]' : ''
    console.log(`[${ctx.requestId}] audit: ${action} ${entityType} ${entityId}${impTag}`)
  } catch (err: any) {
    console.error(`[${ctx.requestId}] audit emit failed:`, err.message)
  }
}

export async function emitActivity(
  ctx: RequestContext,
  eventType: string,
  summary: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const activityMeta: Record<string, unknown> = { ...(metadata ?? {}) }
    if (ctx.impersonating && ctx.realPersonId) {
      activityMeta.impersonated_by = ctx.realPersonId
      activityMeta.impersonation_session_id = ctx.impersonationSessionId
    }

    await db.from('activity_events').insert({
      account_id: ctx.accountId,
      person_id: ctx.personId,
      request_id: ctx.requestId,
      event_type: eventType,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      summary,
      metadata: activityMeta,
    })
    const impTag = ctx.impersonating ? ' [IMPERSONATED]' : ''
    console.log(`[${ctx.requestId}] activity: ${eventType} - ${summary}${impTag}`)
  } catch (err: any) {
    console.error(`[${ctx.requestId}] activity emit failed:`, err.message)
  }
}

export async function emitOutboxEvent(
  accountId: string,
  eventType: string,
  entityType: string | null,
  entityId: string | null,
  payload: Record<string, unknown>,
) {
  try {
    await db.from('outbox_events').insert({
      account_id: accountId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
    })
  } catch (err: any) {
    console.error('outbox emit failed:', err.message)
  }
}
