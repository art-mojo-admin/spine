import { createHandler, requireAuth, requireTenant, json, error, parseBody, makeCtx } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'
import { emitActivity } from '../../core/functions/_shared/audit'

export default createHandler({
  async POST(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemId = params.get('item_id')
    if (!itemId) return error('item_id required')

    const body = await parseBody<{
      content: string
      direction: string
    }>(req)

    if (!body.content || !body.direction) {
      return error('content and direction required')
    }

    // Get the case to verify access
    const { data: caseData, error: caseErr } = await db
      .from('items')
      .select('id, created_by_principal_id')
      .eq('account_id', ctx.accountId)
      .eq('id', itemId)
      .eq('item_type', 'support_case')
      .eq('is_active', true)
      .single()

    if (caseErr) throw caseErr
    if (!caseData) return error('Case not found', 404)

    // Check access permissions (portal users can only message their own cases)
    const effectiveRole = 'portal' // Customer portal always uses portal role
    if (effectiveRole === 'portal' && caseData.created_by_principal_id !== ctx.personId) {
      return error('Access denied', 403)
    }

    // Find or create thread for this case
    let { data: thread } = await db
      .from('threads')
      .select('id')
      .eq('target_type', 'item')
      .eq('target_id', itemId)
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .single()

    // Create thread if it doesn't exist
    if (!thread) {
      const { data: newThread, error: threadErr } = await db
        .from('threads')
        .insert({
          account_id: ctx.accountId,
          target_type: 'item',
          target_id: itemId,
          thread_type: 'conversation',
          visibility: 'private',
          status: 'active',
          is_active: true,
          created_by: ctx.personId,
        })
        .select()
        .single()

      if (threadErr) throw threadErr
      thread = newThread
    }

    // Get next sequence number
    const { data: lastMessage } = await db
      .from('messages')
      .select('sequence')
      .eq('thread_id', thread.id)
      .eq('is_active', true)
      .order('sequence', { ascending: false })
      .limit(1)
      .single()

    const nextSequence = (lastMessage?.sequence || 0) + 1

    // Add message to thread
    const { data: message, error: messageErr } = await db
      .from('messages')
      .insert({
        account_id: ctx.accountId,
        thread_id: thread.id,
        person_id: ctx.personId,
        content: body.content,
        direction: body.direction,
        sequence: nextSequence,
        visibility: 'private',
        is_active: true,
        created_by: ctx.personId,
      })
      .select()
      .single()

    if (messageErr) throw messageErr

    // Emit activity
    await emitActivity(
      makeCtx(ctx.accountId, ctx.personId), 
      'support.message_posted', 
      `Posted message to support case`, 
      'item', 
      itemId
    )

    return json(message)
  }
})
