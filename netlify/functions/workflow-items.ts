import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { evaluateAutomations } from './_shared/automation'
import { executeWorkflowActions } from './_shared/workflow-engine'
import { autoEmbed } from './_shared/embed'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('workflow_items')
        .select('*, stage_definitions(id, name, position, is_terminal), workflow_definitions(id, name), persons:owner_person_id(id, full_name)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const workflowId = params.get('workflow_definition_id')
    const parentId = params.get('parent_id')
    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('workflow_items')
      .select('*, stage_definitions(id, name, position, is_terminal), workflow_definitions(id, name), persons:owner_person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)
    if (workflowId) query = query.eq('workflow_definition_id', workflowId)
    if (parentId === 'null') query = query.is('parent_workflow_item_id', null)
    else if (parentId) query = query.eq('parent_workflow_item_id', parentId)

    const { data } = await query.limit(200)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.workflow_definition_id || !body.title || !body.workflow_type) {
      return error('workflow_definition_id, title, and workflow_type required')
    }

    const { data: initialStage } = await db
      .from('stage_definitions')
      .select('id')
      .eq('workflow_definition_id', body.workflow_definition_id)
      .eq('is_initial', true)
      .single()

    const stageId = body.stage_definition_id || initialStage?.id
    if (!stageId) return error('No initial stage found for workflow')

    const { data, error: dbErr } = await db
      .from('workflow_items')
      .insert({
        account_id: ctx.accountId,
        workflow_definition_id: body.workflow_definition_id,
        stage_definition_id: stageId,
        workflow_type: body.workflow_type,
        title: body.title,
        description: body.description || null,
        owner_person_id: body.owner_person_id || ctx.personId,
        due_date: body.due_date || null,
        entity_type: body.entity_type || null,
        entity_id: body.entity_id || null,
        priority: body.priority || 'medium',
        metadata: body.metadata || {},
        parent_workflow_item_id: body.parent_workflow_item_id || null,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'workflow_item', data.id, null, data)
    await emitActivity(ctx, 'workflow_item.created', `Created workflow item "${data.title}"`, 'workflow_item', data.id)
    await emitOutboxEvent(ctx.accountId!, 'workflow_item.created', 'workflow_item', data.id, data)
    await evaluateAutomations(ctx.accountId!, 'workflow_item.created', ctx, data)
    await autoEmbed(ctx.accountId!, 'workflow_item', data.id, `${data.title} ${data.description || ''}`, { title: data.title })

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db.from('workflow_items').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.owner_person_id !== undefined) updates.owner_person_id = body.owner_person_id
    if (body.due_date !== undefined) updates.due_date = body.due_date
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.entity_type !== undefined) updates.entity_type = body.entity_type
    if (body.entity_id !== undefined) updates.entity_id = body.entity_id
    if (body.metadata !== undefined) updates.metadata = body.metadata
    if (body.parent_workflow_item_id !== undefined) updates.parent_workflow_item_id = body.parent_workflow_item_id

    let transitionDef: any = null
    const isStageChange = body.stage_definition_id && body.stage_definition_id !== before.stage_definition_id

    if (isStageChange) {
      // Try to find a matching transition_definition
      const transitionQuery: any = {
        workflow_definition_id: before.workflow_definition_id,
        from_stage_id: before.stage_definition_id,
        to_stage_id: body.stage_definition_id,
      }

      if (body.transition_id) {
        // Explicit transition specified
        const { data: td } = await db
          .from('transition_definitions')
          .select('*')
          .eq('id', body.transition_id)
          .eq('from_stage_id', before.stage_definition_id)
          .eq('to_stage_id', body.stage_definition_id)
          .single()
        transitionDef = td
        if (!transitionDef) return error('Invalid transition', 400)
      } else {
        // Look up by from→to
        const { data: tds } = await db
          .from('transition_definitions')
          .select('*')
          .eq('workflow_definition_id', before.workflow_definition_id)
          .eq('from_stage_id', before.stage_definition_id)
          .eq('to_stage_id', body.stage_definition_id)
          .order('position', { ascending: true })
          .limit(1)

        transitionDef = tds?.[0] || null
      }

      if (transitionDef) {
        // Validate require_comment
        if (transitionDef.require_comment && !body.transition_comment) {
          return error('This transition requires a comment')
        }
        // Validate require_fields
        if (transitionDef.require_fields?.length > 0) {
          for (const field of transitionDef.require_fields) {
            const val = body[field] ?? before[field]
            if (val === undefined || val === null || val === '') {
              return error(`Field "${field}" is required for this transition`)
            }
          }
        }
      } else {
        // Fallback: use legacy allowed_transitions array
        const { data: currentStage } = await db
          .from('stage_definitions')
          .select('allowed_transitions')
          .eq('id', before.stage_definition_id)
          .single()

        if (currentStage?.allowed_transitions?.length > 0 &&
            !currentStage.allowed_transitions.includes(body.stage_definition_id)) {
          return error('Invalid stage transition')
        }
      }

      updates.stage_definition_id = body.stage_definition_id
    }

    // Execute on_exit_stage actions before the update
    if (isStageChange) {
      await executeWorkflowActions(
        ctx.accountId!,
        before.workflow_definition_id,
        'on_exit_stage',
        before.stage_definition_id,
        ctx,
        { ...before, entity_id: id },
      )
    }

    // Execute on_transition actions
    if (isStageChange && transitionDef) {
      await executeWorkflowActions(
        ctx.accountId!,
        before.workflow_definition_id,
        'on_transition',
        transitionDef.id,
        ctx,
        { ...before, entity_id: id, transition: transitionDef, transition_comment: body.transition_comment },
      )
    }

    const { data, error: dbErr } = await db.from('workflow_items').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    // Execute on_enter_stage actions after the update
    if (isStageChange) {
      await executeWorkflowActions(
        ctx.accountId!,
        before.workflow_definition_id,
        'on_enter_stage',
        body.stage_definition_id,
        ctx,
        { ...data, entity_id: id, transition: transitionDef, transition_comment: body.transition_comment },
      )
    }

    const eventType = isStageChange ? 'workflow_item.stage_changed' : 'workflow_item.updated'
    const transitionMeta = transitionDef
      ? { transition_id: transitionDef.id, transition_name: transitionDef.name }
      : {}

    const activitySummary = transitionDef
      ? `"${data.title}" → ${transitionDef.name}`
      : `Updated workflow item "${data.title}"`

    await emitAudit(ctx, 'update', 'workflow_item', id, before, data)
    await emitActivity(ctx, eventType, activitySummary, 'workflow_item', id, transitionMeta)
    await emitOutboxEvent(ctx.accountId!, eventType, 'workflow_item', id, { before, after: data, ...transitionMeta })
    await evaluateAutomations(ctx.accountId!, eventType, ctx, { before, after: data, entity_id: id, ...transitionMeta })
    await autoEmbed(ctx.accountId!, 'workflow_item', id, `${data.title} ${data.description || ''}`, { title: data.title })

    return json(data)
  },
})
