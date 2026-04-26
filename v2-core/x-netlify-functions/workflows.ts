import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get workflow health metrics
export const getHealthMetrics = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_workflow_health_metrics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Create workflow from template
export const createFromTemplate = requireAuth(createHandler(async (ctx, body) => {
  const { template_name, app_id, config_overrides } = body

  if (!template_name) {
    throw new Error('template_name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_workflow_from_template', {
      template_name,
      account_id: ctx.accountId,
      app_id,
      config_overrides: config_overrides || {}
    })

  if (err) throw err

  await emitLog(ctx, 'workflow.created_from_template', 
    { type: 'system', id: 'workflow_template' }, 
    { after: { template_name, pipeline_id: data[0]?.pipeline_id } }
  )

  return data
}))

// Process all workflow components
export const processAll = requireAuth(createHandler(async (ctx, body) => {
  const { batch_size } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const batchSize = batch_size || 50
  const results = {}

  // Process pending actions
  const { data: actionResults, error: actionErr } = await db
    .rpc('process_pending_actions_batch', {
      account_id: ctx.accountId,
      batch_size: batchSize
    })

  if (actionErr) throw actionErr
  results.pending_actions = actionResults[0]

  // Send outbox events
  const { data: outboxResults, error: outboxErr } = await db
    .rpc('send_outbox_events_batch', {
      account_id: ctx.accountId,
      batch_size: batchSize
    })

  if (outboxErr) throw outboxErr
  results.outbox_events = outboxResults[0]

  // Deliver webhooks
  const { data: webhookResults, error: webhookErr } = await db
    .rpc('deliver_webhooks_batch', {
      account_id: ctx.accountId,
      batch_size: batchSize
    })

  if (webhookErr) throw webhookErr
  results.webhooks = webhookResults[0]

  // Run due timers
  const { data: timerResults, error: timerErr } = await db
    .rpc('run_due_timers', {
      account_id: ctx.accountId,
      limit: batchSize
    })

  if (timerErr) throw timerErr
  results.timers = timerResults

  await emitLog(ctx, 'workflows.processed_all', 
    { type: 'system', id: 'batch_process_all' }, 
    { after: { batch_size, results } }
  )

  return results
}))

// Toggle all workflows for account
export const toggleAccount = requireAuth(createHandler(async (ctx, body) => {
  const { is_active } = body

  if (is_active === undefined) {
    throw new Error('is_active is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('toggle_account_workflows', {
      account_id: ctx.accountId,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'workflows.toggled_account', 
    { type: 'system', id: 'account_workflows' }, 
    { after: { is_active } }
  )

  return data
}))

// Get workflow summary
export const getSummary = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const summary = {}

  // Pipeline counts
  const { data: pipelineCounts, error: pipelineErr } = await db
    .from('pipelines')
    .select('status', { count: 'id' })
    .eq('account_id', ctx.accountId)

  if (!pipelineErr) {
    summary.pipelines = {
      total: pipelineCounts.length,
      active: pipelineCounts.filter(p => p.is_active).length,
      inactive: pipelineCounts.filter(p => !p.is_active).length
    }
  }

  // Trigger counts
  const { data: triggerCounts, error: triggerErr } = await db
    .from('triggers')
    .select('status', { count: 'id' })
    .eq('account_id', ctx.accountId)

  if (!triggerErr) {
    summary.triggers = {
      total: triggerCounts.length,
      active: triggerCounts.filter(t => t.is_active).length,
      inactive: triggerCounts.filter(t => !t.is_active).length
    }
  }

  // Timer counts
  const { data: timerCounts, error: timerErr } = await db
    .from('timers')
    .select('status', { count: 'id' })
    .eq('account_id', ctx.accountId)

  if (!timerErr) {
    summary.timers = {
      total: timerCounts.length,
      active: timerCounts.filter(t => t.is_active).length,
      inactive: timerCounts.filter(t => !t.is_active).length
    }
  }

  // Webhook counts
  const { data: webhookCounts, error: webhookErr } = await db
    .from('webhooks')
    .select('status', { count: 'id' })
    .eq('account_id', ctx.accountId)

  if (!webhookErr) {
    summary.webhooks = {
      total: webhookCounts.length,
      active: webhookCounts.filter(w => w.is_active).length,
      inactive: webhookCounts.filter(w => !w.is_active).length
    }
  }

  // Queue status
  const { data: queueStatus } = await db
    .rpc('get_workflow_health_metrics', {
      account_id: ctx.accountId
    })

  if (queueStatus) {
    summary.queues = {
      pending_actions: queueStatus.find(m => m.metric_type === 'pending_actions' && m.metric_name === 'total_pending')?.value || 0,
      outbox_events: queueStatus.find(m => m.metric_type === 'outbox' && m.metric_name === 'total_pending')?.value || 0,
      failed_rate: queueStatus.find(m => m.metric_type === 'pending_actions' && m.metric_name === 'failed_rate')?.value || 0
    }
  }

  return summary
})

// Get workflow templates
export const getTemplates = createHandler(async (ctx, body) => {
  const templates = [
    {
      name: 'item_approval',
      display_name: 'Item Approval Workflow',
      description: 'Automates item approval process with review and notification stages',
      category: 'content',
      features: ['multi-stage approval', 'notification system', 'reminder scheduling']
    },
    {
      name: 'onboarding',
      display_name: 'User Onboarding',
      description: 'Guides new users through the onboarding process with automated steps',
      category: 'user_management',
      features: ['welcome messages', 'profile setup', 'resource delivery', 'follow-up scheduling']
    },
    {
      name: 'content_moderation',
      display_name: 'Content Moderation',
      description: 'Automated content review and moderation with rule-based filtering',
      category: 'content',
      features: ['content analysis', 'rule checking', 'flagging system', 'moderator notifications']
    }
  ]

  return templates
})

// Get workflow performance metrics
export const getPerformanceMetrics = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const metrics = {}

  // Pipeline performance
  const { data: pipelineStats, error: pipelineErr } = await db
    .rpc('get_execution_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (!pipelineErr) {
    metrics.pipelines = pipelineStats
  }

  // Trigger performance
  const { data: triggerStats, error: triggerErr } = await db
    .rpc('get_trigger_execution_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (!triggerErr) {
    metrics.triggers = triggerStats
  }

  // Webhook performance
  const { data: webhookStats, error: webhookErr } = await db
    .rpc('get_webhook_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (!webhookErr) {
    metrics.webhooks = webhookStats
  }

  // Queue performance
  const { data: actionStats, error: actionErr } = await db
    .rpc('get_pending_action_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (!actionErr) {
    metrics.pending_actions = actionStats
  }

  return metrics
})

// Cleanup workflow data
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const results = {}

  // Cleanup pipeline executions
  const { data: pipelineCleanup, error: pipelineErr } = await db
    .rpc('cleanup_executions', {
      days_to_keep: days_to_keep || 30
    })

  if (!pipelineErr) {
    results.pipeline_executions = pipelineCleanup
  }

  // Cleanup trigger executions
  const { data: triggerCleanup, error: triggerErr } = await db
    .rpc('cleanup_trigger_executions', {
      days_to_keep: days_to_keep || 30
    })

  if (!triggerErr) {
    results.trigger_executions = triggerCleanup
  }

  // Cleanup pending actions
  const { data: actionCleanup, error: actionErr } = await db
    .rpc('cleanup_pending_actions', {
      days_to_keep: days_to_keep || 30
    })

  if (!actionErr) {
    results.pending_actions = actionCleanup
  }

  // Cleanup outbox events
  const { data: outboxCleanup, error: outboxErr } = await db
    .rpc('cleanup_outbox_events', {
      days_to_keep: days_to_keep || 30
    })

  if (!outboxErr) {
    results.outbox_events = outboxCleanup
  }

  // Cleanup webhook deliveries
  const { data: webhookCleanup, error: webhookErr } = await db
    .rpc('cleanup_webhook_deliveries', {
      days_to_keep: days_to_keep || 30
    })

  if (!webhookErr) {
    results.webhook_deliveries = webhookCleanup
  }

  await emitLog(ctx, 'workflows.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 30, results } }
  )

  return results
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'health':
      if (method === 'GET') {
        return await getHealthMetrics(ctx, body)
      }
      break
    case 'from-template':
      if (method === 'POST') {
        return await createFromTemplate(ctx, body)
      }
      break
    case 'process-all':
      if (method === 'POST') {
        return await processAll(ctx, body)
      }
      break
    case 'toggle-account':
      if (method === 'POST') {
        return await toggleAccount(ctx, body)
      }
      break
    case 'summary':
      if (method === 'GET') {
        return await getSummary(ctx, body)
      }
      break
    case 'templates':
      if (method === 'GET') {
        return await getTemplates(ctx, body)
      }
      break
    case 'performance':
      if (method === 'GET') {
        return await getPerformanceMetrics(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
      }
      break
    default:
      throw new Error('Invalid action')
  }
})
