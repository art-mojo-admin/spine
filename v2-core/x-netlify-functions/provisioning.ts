import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Create provisioning template
export const createTemplate = requireAuth(createHandler(async (ctx, body) => {
  const { name, description, template_type, config, default_values, validation_rules, approval_required, auto_activate } = body

  if (!name || !template_type) {
    throw new Error('name and template_type are required')
  }

  const { data, error: err } = await db
    .rpc('v2_create_provisioning_template', {
      name,
      description,
      template_type,
      config: config || {},
      default_values: default_values || {},
      validation_rules: validation_rules || {},
      approval_required: approval_required || false,
      auto_activate: auto_activate !== false,
      created_by: ctx.personId,
      account_id: ctx.accountId!
    })

  if (err) throw err

  await emitLog(ctx, 'provisioning_template.created', 
    { type: 'provisioning_template', id: data }, 
    { after: { name, template_type } }
  )

  return { template_id: data }
}))

// List provisioning templates
export const listTemplates = createHandler(async (ctx, body) => {
  const { template_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('provisioning_templates')
    .select(`
      *,
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('name')

  if (template_type) query = query.eq('template_type', template_type)
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true')

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Create provisioning request
export const createRequest = requireAuth(createHandler(async (ctx, body) => {
  const { template_id, request_type, target_type, target_id, request_data, priority } = body

  if (!template_id || !request_type || !target_type) {
    throw new Error('template_id, request_type, and target_type are required')
  }

  const { data, error: err } = await db
    .rpc('v2_create_provisioning_request', {
      template_id,
      request_type,
      target_type,
      target_id,
      request_data: request_data || {},
      priority: priority || 'normal',
      requested_by: ctx.personId,
      account_id: ctx.accountId!
    })

  if (err) throw err

  await emitLog(ctx, 'provisioning_request.created', 
    { type: 'provisioning_request', id: data }, 
    { after: { template_id, request_type, target_type } }
  )

  return { request_id: data }
}))

// List provisioning requests
export const listRequests = createHandler(async (ctx, body) => {
  const { template_id, request_type, status, priority, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('provisioning_requests')
    .select(`
      *,
      template:provisioning_templates(id, name, template_type),
      requested_by_person:people(id, full_name, email),
      approved_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (template_id) query = query.eq('template_id', template_id)
  if (request_type) query = query.eq('request_type', request_type)
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Approve provisioning request
export const approveRequest = requireAuth(createHandler(async (ctx, body) => {
  const { request_id, notes } = body

  if (!request_id) {
    throw new Error('request_id is required')
  }

  const { data, error: err } = await db
    .rpc('v2_approve_provisioning_request', {
      request_id,
      approved_by: ctx.personId,
      notes
    })

  if (err) throw err

  await emitLog(ctx, 'provisioning_request.approved', 
    { type: 'provisioning_request', id: request_id }, 
    { after: { approved_by: ctx.personId } }
  )

  return { success: data }
}))

// Reject provisioning request
export const rejectRequest = requireAuth(createHandler(async (ctx, body) => {
  const { request_id, rejection_reason } = body

  if (!request_id) {
    throw new Error('request_id is required')
  }

  const { data, error: err } = await db
    .rpc('v2_reject_provisioning_request', {
      request_id,
      rejected_by: ctx.personId,
      rejection_reason
    })

  if (err) throw err

  await emitLog(ctx, 'provisioning_request.rejected', 
    { type: 'provisioning_request', id: request_id }, 
    { after: { rejected_by: ctx.personId, rejection_reason } }
  )

  return { success: data }
}))

// Start provisioning request
export const startRequest = requireAuth(createHandler(async (ctx, body) => {
  const { request_id } = body

  if (!request_id) {
    throw new Error('request_id is required')
  }

  const { data, error: err } = await db
    .rpc('v2_start_provisioning_request', { request_id })

  if (err) throw err

  await emitLog(ctx, 'provisioning_request.started', 
    { type: 'provisioning_request', id: request_id }, 
    {}
  )

  return { success: data }
}))

// Get provisioning statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_get_provisioning_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err
  return data
})

// Retry failed requests
export const retryFailedRequests = requireAuth(createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_retry_failed_provisioning_requests')

  if (err) throw err

  await emitLog(ctx, 'provisioning_requests.retried', 
    { type: 'system', id: 'batch_retry' }, 
    { after: { retried_count: data[0]?.retried_count, failed_count: data[0]?.failed_count } }
  )

  return data
}))

// Cleanup old requests
export const cleanupRequests = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const { data, error: err } = await db
    .rpc('v2_cleanup_old_provisioning_requests', {
      days_to_keep: days_to_keep || 90
    })

  if (err) throw err

  await emitLog(ctx, 'provisioning_requests.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 90, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// List provisioning logs
export const listLogs = createHandler(async (ctx, body) => {
  const { request_id, step_name, step_type, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('provisioning_logs')
    .select(`
      *,
      request:provisioning_requests(id, template_id, request_type, status)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (request_id) query = query.eq('request_id', request_id)
  if (step_name) query = query.eq('step_name', step_name)
  if (step_type) query = query.eq('step_type', step_type)
  if (status) query = query.eq('status', status)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Get request details with logs
export const getRequestDetails = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Request ID is required')
  }

  const { data, error: err } = await db
    .from('provisioning_requests')
    .select(`
      *,
      template:provisioning_templates(id, name, template_type, config),
      requested_by_person:people(id, full_name, email),
      approved_by_person:people(id, full_name, email),
      logs:provisioning_logs(*)
    `)
    .eq('id', id)
    .single()

  if (err) throw err
  return data
})

// Bulk create requests
export const bulkCreateRequests = requireAuth(createHandler(async (ctx, body) => {
  const { requests } = body

  if (!requests || !Array.isArray(requests)) {
    throw new Error('requests array is required')
  }

  const results = []
  for (const request of requests) {
    try {
      const { data, error: err } = await db
        .rpc('v2_create_provisioning_request', {
          template_id: request.template_id,
          request_type: request.request_type,
          target_type: request.target_type,
          target_id: request.target_id,
          request_data: request.request_data || {},
          priority: request.priority || 'normal',
          requested_by: ctx.personId,
          account_id: ctx.accountId!
        })

      if (err) {
        results.push({ success: false, error: err.message, request })
      } else {
        results.push({ success: true, request_id: data, request })
      }
    } catch (error) {
      results.push({ success: false, error: error.message, request })
    }
  }

  await emitLog(ctx, 'provisioning_requests.bulk_created', 
    { type: 'system', id: 'bulk_create' }, 
    { after: { total_requests: requests.length, successful: results.filter(r => r.success).length } }
  )

  return { results }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'approve':
      if (method === 'POST') {
        return await approveRequest(ctx, body)
      }
      break
    case 'reject':
      if (method === 'POST') {
        return await rejectRequest(ctx, body)
      }
      break
    case 'start':
      if (method === 'POST') {
        return await startRequest(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'retry-failed':
      if (method === 'POST') {
        return await retryFailedRequests(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanupRequests(ctx, body)
      }
      break
    case 'logs':
      if (method === 'GET') {
        return await listLogs(ctx, body)
      }
      break
    case 'details':
      if (method === 'GET') {
        return await getRequestDetails(ctx, body)
      }
      break
    case 'bulk-create':
      if (method === 'POST') {
        return await bulkCreateRequests(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        if (ctx.query?.template_id) {
          return await listTemplates(ctx, body)
        } else {
          return await listRequests(ctx, body)
        }
      } else if (method === 'POST') {
        if (body.template_id) {
          return await createRequest(ctx, body)
        } else {
          return await createTemplate(ctx, body)
        }
      }
  }

  throw new Error('Invalid action or method')
})
