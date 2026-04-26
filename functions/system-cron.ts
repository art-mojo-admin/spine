/**
 * System Cron Runner
 * 
 * This function is invoked by the system scheduler (e.g., external cron service)
 * to execute due scheduled actions. It:
 * 
 * 1. Finds all schedules due for execution
 * 2. Validates the schedule and its machine principal
 * 3. Executes the action as the machine principal
 * 4. Updates schedule state (success/failure, next run time)
 * 
 * Security: This endpoint should only be accessible internally or via
 * a secure scheduler (e.g., AWS EventBridge, Google Cloud Scheduler).
 */

import { createHandler, RequestContext } from './_shared/middleware'
import { adminDb } from './_shared/db'
import { emitAudit } from './_shared/audit'

// Internal API key for scheduler access (configured in environment)
const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY

// Handler for system cron execution
export const handler = createHandler(async (ctx: RequestContext) => {
  // ============================================
  // SECURITY: Validate this is an internal request
  // ============================================
  
  // Check if request has scheduler authentication
  const requestApiKey = ctx.query?.api_key || ctx.query?.scheduler_key
  
  if (requestApiKey !== SCHEDULER_API_KEY) {
    // Also allow if the principal is a system machine (for internal invocations)
    if (ctx.principal?.type !== 'machine' || ctx.principal?.machineType !== 'internal') {
      await emitAudit(ctx, 'system_cron.unauthorized_access', {
        type: 'system',
        account_id: ctx.accountId || undefined
      }, { result: 'denied', error: 'Invalid or missing scheduler authentication' })
      
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden - Invalid scheduler authentication' })
      }
    }
  }
  
  // ============================================
  // Find and execute due schedules
  // ============================================
  
  const results: Array<{
    scheduleId: string
    actionId: string
    status: 'success' | 'failed' | 'skipped'
    error?: string
    durationMs: number
  }> = []
  
  try {
    // Get all schedules due for execution
    const { data: dueSchedules, error: schedulesError } = await adminDb.rpc('get_due_schedules', {
      p_now: new Date().toISOString()
    })
    
    if (schedulesError) {
      throw new Error(`Failed to fetch due schedules: ${schedulesError.message}`)
    }
    
    if (!dueSchedules || dueSchedules.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No schedules due for execution',
          executed: 0,
          results: []
        })
      }
    }
    
    // Execute each due schedule
    for (const schedule of dueSchedules) {
      const startTime = Date.now()
      
      try {
        // Validate schedule can run (creator still active)
        const { data: validation, error: validationError } = await adminDb.rpc('validate_schedule_creator', {
          p_schedule_id: schedule.schedule_id
        })
        
        if (validationError || !validation?.is_valid) {
          // Schedule was auto-paused by validation function
          results.push({
            scheduleId: schedule.schedule_id,
            actionId: schedule.action_id,
            status: 'skipped',
            error: validation?.error_message || 'Schedule validation failed',
            durationMs: Date.now() - startTime
          })
          continue
        }
        
        // Load the action
        const { data: action, error: actionError } = await adminDb
          .from('actions')
          .select('*')
          .eq('id', schedule.action_id)
          .single()
        
        if (actionError || !action) {
          throw new Error(`Action not found: ${schedule.action_id}`)
        }
        
        // Load the machine principal
        const { data: machine, error: machineError } = await adminDb
          .from('api_keys')
          .select('*')
          .eq('id', schedule.machine_principal_id)
          .single()
        
        if (machineError || !machine) {
          throw new Error(`Machine principal not found: ${schedule.machine_principal_id}`)
        }
        
        // Create execution context with machine principal
        const executionCtx: RequestContext = {
          requestId: ctx.requestId,
          principal: {
            id: machine.id,
            type: 'machine',
            accountId: machine.account_id,
            scopes: schedule.delegated_scopes || machine.scopes || [],
            machineType: machine.machine_type,
            isInternal: machine.is_internal,
            provenance: {
              sourceType: 'cron',
              createdBy: machine.created_by,
              invokedAt: new Date().toISOString(),
              cronId: schedule.schedule_id
            }
          },
          db: adminDb,  // Machines use adminDb (RLS checks their ID)
          accountId: machine.account_id,
          appId: null,
          query: {},
          personId: null,
          systemRole: null,
          roles: []
        }
        
        // Check machine has required scope for this action
        const requiredScope = action.required_scopes?.[0] || `${action.handler}:execute`
        const hasScope = executionCtx.principal.scopes?.includes(requiredScope) ||
                        executionCtx.principal.scopes?.includes('*:*')
        
        if (!hasScope) {
          throw new Error(`Machine lacks required scope: ${requiredScope}`)
        }
        
        // Execute the action
        const executionResult = await executeAction(executionCtx, action, schedule.config)
        
        // Record execution success
        await adminDb.from('schedule_executions').insert({
          schedule_id: schedule.schedule_id,
          account_id: schedule.account_id,
          machine_principal_id: machine.id,
          status: 'success',
          input_params: schedule.config,
          output_result: executionResult,
          duration_ms: Date.now() - startTime
        })
        
        // Update schedule state
        await adminDb.rpc('update_schedule_after_run', {
          p_schedule_id: schedule.schedule_id,
          p_success: true,
          p_error_message: null
        })
        
        // Emit audit log
        await emitAudit(executionCtx, 'schedule.execute', {
          type: 'schedule',
          id: schedule.schedule_id,
          account_id: schedule.account_id
        }, {
          action_id: action.id,
          action_handler: action.handler,
          result: 'success'
        })
        
        results.push({
          scheduleId: schedule.schedule_id,
          actionId: schedule.action_id,
          status: 'success',
          durationMs: Date.now() - startTime
        })
        
      } catch (execError: any) {
        const errorMessage = execError.message || 'Execution failed'
        
        // Record execution failure
        await adminDb.from('schedule_executions').insert({
          schedule_id: schedule.schedule_id,
          account_id: schedule.account_id,
          machine_principal_id: schedule.machine_principal_id,
          status: 'failed',
          input_params: schedule.config,
          error_message: errorMessage,
          duration_ms: Date.now() - startTime
        })
        
        // Update schedule state
        await adminDb.rpc('update_schedule_after_run', {
          p_schedule_id: schedule.schedule_id,
          p_success: false,
          p_error_message: errorMessage
        })
        
        results.push({
          scheduleId: schedule.schedule_id,
          actionId: schedule.action_id,
          status: 'failed',
          error: errorMessage,
          durationMs: Date.now() - startTime
        })
      }
    }
    
    // Return summary
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Executed ${results.length} schedules`,
        executed: results.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        results
      })
    }
    
  } catch (error: any) {
    console.error('System cron error:', error)
    
    await emitAudit(ctx, 'system_cron.error', {
      type: 'system',
      account_id: ctx.accountId || undefined
    }, {
      result: 'failure',
      error: error.message
    })
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'System cron execution failed',
        message: error.message
      })
    }
  }
})

/**
 * Execute an action by handler name
 * 
 * This routes to the appropriate function based on the action's handler configuration.
 * Handlers are organized by module (functions, integrations, custom).
 */
async function executeAction(
  ctx: RequestContext,
  action: any,
  config: any
): Promise<any> {
  const handlerModule = action.handler_module || 'functions'
  const handlerName = action.handler
  
  // Merge action config with schedule-specific config
  const mergedConfig = {
    ...action.config,
    ...config
  }
  
  switch (handlerModule) {
    case 'functions':
      return await executeFunctionHandler(ctx, handlerName, mergedConfig)
    
    case 'integrations':
      return await executeIntegrationHandler(ctx, handlerName, mergedConfig)
    
    case 'custom':
      // Custom handlers would be loaded from v2-custom
      throw new Error(`Custom handlers not yet implemented: ${handlerName}`)
    
    default:
      throw new Error(`Unknown handler module: ${handlerModule}`)
  }
}

/**
 * Execute a built-in function handler
 */
async function executeFunctionHandler(
  ctx: RequestContext,
  handlerName: string,
  config: any
): Promise<any> {
  // Built-in handlers
  const handlers: Record<string, Function> = {
    'send_email': async (ctx: RequestContext, config: any) => {
      // Implementation would integrate with email service
      console.log(`[${ctx.requestId}] Sending email:`, config)
      return { sent: true, recipients: config.recipients }
    },
    
    'generate_report': async (ctx: RequestContext, config: any) => {
      // Implementation would generate and deliver report
      console.log(`[${ctx.requestId}] Generating report:`, config)
      return { generated: true, format: config.output_format }
    },
    
    'notify_watchers': async (ctx: RequestContext, config: any) => {
      // Implementation would notify item watchers
      console.log(`[${ctx.requestId}] Notifying watchers:`, config)
      return { notified: true }
    }
  }
  
  const handler = handlers[handlerName]
  if (!handler) {
    throw new Error(`Unknown function handler: ${handlerName}`)
  }
  
  return await handler(ctx, config)
}

/**
 * Execute an integration handler
 */
async function executeIntegrationHandler(
  ctx: RequestContext,
  handlerName: string,
  config: any
): Promise<any> {
  // Integration handlers would call external services
  // This is a placeholder for future implementation
  console.log(`[${ctx.requestId}] Integration handler: ${handlerName}`, config)
  return { executed: true, handler: handlerName }
}
