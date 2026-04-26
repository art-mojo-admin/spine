import { 
  Principal, 
  resolvePrincipal, 
  isSystemAdmin, 
  getPrincipalDb
} from './principal'

// Request context interface
export interface RequestContext {
  requestId: string
  principal: Principal
  db: any
  accountId: string | null
  appId: string | null
  query: Record<string, string>
}

// Handler function type
export type HandlerFunction = (ctx: RequestContext, body?: any) => Promise<any>

// Standard response shape
export interface HandlerResult {
  data?: any
  error?: string
  meta?: any
}

// Create handler wrapper
export function createHandler(handler: HandlerFunction) {
  return async (event: any, context: any) => {
    // Detect nested call: if event is already a RequestContext with a principal,
    // skip event parsing and call the raw handler directly
    if (event && event.requestId && event.principal) {
      return handler(event, context)
    }

    const requestId = crypto.randomUUID()
    const startTime = Date.now()
    
    try {
      // Parse headers
      const appId = event.headers?.['x-app-id'] || event.headers?.['X-App-Id']
      
      // Parse query string parameters
      const queryParams: Record<string, string> = {}
      if (event.queryStringParameters) {
        Object.assign(queryParams, event.queryStringParameters)
      }
      if (!queryParams.method && event.httpMethod) {
        queryParams.method = event.httpMethod
      }

      // ============================================
      // NEW: Resolve Unified Principal
      // ============================================
      const principal = await resolvePrincipal(event)
      
      if (!principal) {
        return error('Authentication required', 401)
      }
      
      // Get RLS-scoped database client based on principal type
      const ctxDb = getPrincipalDb(principal)
      
      // Build request context
      const ctx: RequestContext = {
        requestId,
        principal,
        db: ctxDb,
        accountId: principal.accountId,
        appId: appId || null,
        query: queryParams,
      }
      
      // Parse body
      let body = null
      if (event.body) {
        try {
          body = JSON.parse(event.body)
        } catch (e) {
          return error('Invalid JSON in request body', 400)
        }
      }
      if (ctx.query.id) {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          body = {}
        }
        if (!('id' in body)) {
          body.id = ctx.query.id
        }
      }
      
      // Execute handler
      const result = await handler(ctx, body)
      
      // Return success response
      // Never unwrap result.data here — handlers return the record directly.
      // Using result.data would collide with records that have a .data JSONB column.
      return json({
        data: result,
        error: null,
        meta: {
          requestId,
          duration: Date.now() - startTime
        }
      })
      
    } catch (err: any) {
      console.error(`[${requestId}] Handler error:`, err)
      return error(err.message || 'Internal server error', 500)
    }
  }
}

// JSON response helper
export function json(data: any, status: number = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Account-Id, X-App-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
  }
}

// Error response helper
export function error(message: string, status: number = 400) {
  return json({
    data: null,
    error: message
  }, status)
}

// Parse body helper
export function parseBody(event: any): any {
  if (!event.body) return null
  
  try {
    return JSON.parse(event.body)
  } catch (e) {
    throw new Error('Invalid JSON in request body')
  }
}

// Require user context either as a handler wrapper or as a direct validator
export function requireUserContext(handler: HandlerFunction): HandlerFunction
export function requireUserContext(ctx: RequestContext): HandlerResult | null
export function requireUserContext(arg: HandlerFunction | RequestContext): HandlerFunction | HandlerResult | null {
  if (typeof arg === 'function') {
    const handler = arg
    return async (ctx: RequestContext, body?: any) => {
      if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
        throw new Error('User context (person and account) required')
      }
      return handler(ctx, body)
    }
  }

  const ctx = arg
  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    return error('User context (person and account) required', 403) as any
  }
  return null
}

// Require system context with audit either as a handler wrapper or as a direct validator
export function requireSystemContextWithAudit(handler: HandlerFunction): HandlerFunction
export function requireSystemContextWithAudit(ctx: RequestContext, triggeredBy?: string): HandlerResult | null
export function requireSystemContextWithAudit(
  arg: HandlerFunction | RequestContext,
  triggeredBy?: string,
): HandlerFunction | HandlerResult | null {
  if (typeof arg === 'function') {
    const handler = arg
    return async (ctx: RequestContext, body?: any) => {
      if (!ctx.principal || ctx.principal.id === 'anonymous') {
        throw new Error('Authentication required')
      }
      if (!isSystemAdmin(ctx.principal)) {
        throw new Error('System context required')
      }
      ;(ctx as any).triggeredBy = ctx.principal.id
      return handler(ctx, body)
    }
  }

  const ctx = arg
  if (!ctx.principal || ctx.principal.id === 'anonymous') {
    return error('Authentication required', 401) as any
  }
  if (!isSystemAdmin(ctx.principal)) {
    return error('System context required', 403) as any
  }
  ;(ctx as any).triggeredBy = triggeredBy || ctx.principal.id
  return null
}

// CORS handler
export function cors() {
  return json({ message: 'CORS enabled' }, 200)
}
