import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Create impersonation session
export const createSession = requireAuth(createHandler(async (ctx, body) => {
  const { target_user_id, target_account_id, reason, context, permissions, restrictions, expires_in_hours } = body

  if (!target_user_id || !target_account_id) {
    throw new Error('target_user_id and target_account_id are required')
  }

  const { data, error: err } = await db
    .rpc('create_impersonation_session', {
      impersonator_id: ctx.personId!,
      target_user_id,
      impersonator_account_id: ctx.accountId!,
      target_account_id,
      reason,
      context: context || {},
      permissions: permissions || [],
      restrictions: restrictions || {},
      expires_in_hours: expires_in_hours || 8
    })

  if (err) throw err

  await emitLog(ctx, 'impersonation_session.created', 
    { type: 'impersonation_session', id: data }, 
    { after: { target_user_id, target_account_id } }
  )

  return { session_id: data }
}))

// Validate impersonation session
export const validateSession = createHandler(async (ctx, body) => {
  const { session_token, ip_address, user_agent } = body

  if (!session_token) {
    throw new Error('session_token is required')
  }

  const { data, error: err } = await db
    .rpc('v2_validate_impersonation_session', {
      session_token,
      ip_address: ip_address || null,
      user_agent: user_agent || null
    })

  if (err) throw err
  return data
})

// Revoke impersonation session
export const revokeSession = requireAuth(createHandler(async (ctx, body) => {
  const { session_id, reason } = body

  if (!session_id) {
    throw new Error('session_id is required')
  }

  const { data, error: err } = await db
    .rpc('v2_revoke_impersonation_session', {
      session_id,
      reason
    })

  if (err) throw err

  await emitLog(ctx, 'impersonation_session.revoked', 
    { type: 'impersonation_session', id: session_id }, 
    { after: { reason } }
  )

  return { success: data }
}))

// List impersonation sessions
export const listSessions = createHandler(async (ctx, body) => {
  const { impersonator_id, target_user_id, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('impersonation_sessions')
    .select(`
      *,
      impersonator_person:people!impersonation_sessions_impersonator_id_fkey(id, full_name, email),
      target_person:people!impersonation_sessions_target_user_id_fkey(id, full_name, email),
      impersonator_account:accounts!impersonation_sessions_impersonator_account_id_fkey(id, name),
      target_account:accounts!impersonation_sessions_target_account_id_fkey(id, name)
    `)
    .eq('impersonator_account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (impersonator_id) query = query.eq('impersonator_id', impersonator_id)
  if (target_user_id) query = query.eq('target_user_id', target_user_id)
  if (status) query = query.eq('status', status)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Log impersonation action
export const logAction = createHandler(async (ctx, body) => {
  const { session_id, request_method, request_path, request_headers, request_body, response_status, response_body, duration_ms, success, error_message } = body

  if (!session_id) {
    throw new Error('session_id is required')
  }

  const { data, error: err } = await db
    .rpc('v2_log_impersonation_action', {
      session_id,
      request_method,
      request_path,
      request_headers: request_headers || {},
      request_body: request_body || {},
      response_status,
      response_body: response_body || {},
      duration_ms,
      success: success !== false,
      error_message
    })

  if (err) throw err
  return { log_id: data }
})

// Get impersonation statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_get_impersonation_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err
  return data
})

// Cleanup expired sessions
export const cleanupSessions = requireAuth(createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('v2_cleanup_expired_impersonation_sessions')

  if (err) throw err

  await emitLog(ctx, 'impersonation_sessions.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { expired_count: data } }
  )

  return { expired_count: data }
}))

// Create impersonation policy
export const createPolicy = requireAuth(createHandler(async (ctx, body) => {
  const { name, description, policy_type, conditions, permissions, restrictions, time_restrictions, ip_restrictions, priority } = body

  if (!name || !policy_type) {
    throw new Error('name and policy_type are required')
  }

  const { data, error: err } = await db
    .rpc('v2_create_impersonation_policy', {
      name,
      description,
      policy_type,
      conditions: conditions || {},
      permissions: permissions || [],
      restrictions: restrictions || {},
      time_restrictions: time_restrictions || {},
      ip_restrictions: ip_restrictions || [],
      priority: priority || 100,
      created_by: ctx.personId,
      account_id: ctx.accountId!
    })

  if (err) throw err

  await emitLog(ctx, 'impersonation_policy.created', 
    { type: 'impersonation_policy', id: data }, 
    { after: { name, policy_type } }
  )

  return { policy_id: data }
}))

// List impersonation policies
export const listPolicies = createHandler(async (ctx, body) => {
  const { policy_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('impersonation_policies')
    .select(`
      *,
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('priority', { ascending: true })

  if (policy_type) query = query.eq('policy_type', policy_type)
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true')

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Evaluate impersonation policies
export const evaluatePolicies = createHandler(async (ctx, body) => {
  const { impersonator_id, target_user_id, impersonator_account_id, context } = body

  if (!impersonator_id || !target_user_id || !impersonator_account_id) {
    throw new Error('impersonator_id, target_user_id, and impersonator_account_id are required')
  }

  const { data, error: err } = await db
    .rpc('v2_evaluate_impersonation_policies', {
      impersonator_id,
      target_user_id,
      impersonator_account_id,
      context: context || {}
    })

  if (err) throw err
  return data
})

// List impersonation logs
export const listLogs = createHandler(async (ctx, body) => {
  const { session_id, action_type, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('impersonation_logs')
    .select(`
      *,
      session:impersonation_sessions(id, session_token, impersonator_id, target_user_id)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (session_id) query = query.eq('session_id', session_id)
  if (action_type) query = query.eq('action_type', action_type)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'validate':
      if (method === 'POST') {
        return await validateSession(ctx, body)
      }
      break
    case 'revoke':
      if (method === 'POST') {
        return await revokeSession(ctx, body)
      }
      break
    case 'log-action':
      if (method === 'POST') {
        return await logAction(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanupSessions(ctx, body)
      }
      break
    case 'create-policy':
      if (method === 'POST') {
        return await createPolicy(ctx, body)
      }
      break
    case 'policies':
      if (method === 'GET') {
        return await listPolicies(ctx, body)
      }
      break
    case 'evaluate-policies':
      if (method === 'POST') {
        return await evaluatePolicies(ctx, body)
      }
      break
    case 'logs':
      if (method === 'GET') {
        return await listLogs(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        if (ctx.query?.id) {
          // Get single session
          const { data, error: err } = await db
            .from('impersonation_sessions')
            .select(`
              *,
              impersonator_person:people(id, full_name, email),
              target_person:people(id, full_name, email),
              impersonator_account:accounts(id, name),
              target_account:accounts(id, name)
            `)
            .eq('id', ctx.query.id)
            .single()

          if (err) throw err
          return data
        } else {
          return await listSessions(ctx, body)
        }
      } else if (method === 'POST') {
        return await createSession(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
