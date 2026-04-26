import { db } from './db'
import { jwtDecode } from 'jwt-decode'

// Request context interface (locked from Phase 0)
export interface RequestContext {
  requestId: string
  personId: string | null
  accountId: string | null
  appId: string | null
  roles: string[]           // resolved for current app
  systemRole: string | null
  impersonating: boolean
  realPersonId: string | null
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
    // Detect nested call: if event is already a RequestContext (from another handler),
    // skip event parsing and call the raw handler directly
    if (event && event.requestId && 'personId' in event) {
      return handler(event, context)
    }

    const requestId = crypto.randomUUID()
    const startTime = Date.now()
    
    try {
      // Parse headers
      const authHeader = event.headers?.authorization || event.headers?.Authorization
      const accountId = event.headers?.['x-account-id'] || event.headers?.['X-Account-Id']
      const appId = event.headers?.['x-app-id'] || event.headers?.['X-App-Id']
      
      // Parse query string parameters
      const queryParams: Record<string, string> = {}
      if (event.queryStringParameters) {
        Object.assign(queryParams, event.queryStringParameters)
      }

      // Build request context
      const ctx: RequestContext = {
        requestId,
        personId: null,
        accountId: accountId || null,
        appId: appId || null,
        roles: [],
        systemRole: null,
        impersonating: false,
        realPersonId: null,
        query: queryParams
      }
      
      // Handle authentication
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const decoded = jwtDecode(token) as any
        
        ctx.personId = decoded.sub
        ctx.realPersonId = decoded.sub
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
      
      // Resolve roles and system role
      ctx.roles = await resolveRoles(ctx)
      ctx.systemRole = await resolveSystemRole(ctx.personId!)
      
      // Execute handler
      const result = await handler(ctx, body)
      
      // Return success response
      return json({
        data: result.data || result,
        error: result.error || null,
        meta: {
          requestId,
          duration: Date.now() - startTime,
          ...result.meta
        }
      })
      
    } catch (err: any) {
      console.error(`[${requestId}] Handler error:`, err)
      return error(err.message || 'Internal server error', 500)
    }
  }
}

// Require authentication middleware
export function requireAuth(handler: HandlerFunction): HandlerFunction {
  return async (ctx: RequestContext, body?: any) => {
    if (!ctx.personId) {
      throw new Error('Authentication required')
    }
    return handler(ctx, body)
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

// Require specific permission
export function requirePermission(permission: string) {
  return (handler: HandlerFunction): HandlerFunction => {
    return async (ctx: RequestContext, body?: any) => {
      if (!ctx.personId || !ctx.accountId) {
        throw new Error('Authentication and account context required')
      }

      // Check if person has the required permission
      const hasPermission = await checkPermission(ctx.personId, ctx.accountId, permission, ctx.appId)
      
      if (!hasPermission) {
        throw new Error(`Permission denied: ${permission}`)
      }

      return handler(ctx, body)
    }
  }
}

// Check if person has permission
async function checkPermission(
  personId: string, 
  accountId: string, 
  permission: string, 
  appId?: string | null
): Promise<boolean> {
  const { data } = await db.rpc('resolve_person_permissions', {
    person_id: personId,
    account_id: accountId
  })

  if (!data) return false

  // Check if permission exists in resolved permissions
  return (data as any[]).some((p: any) => p.permission === permission)
}

// Resolve roles for request context
async function resolveRoles(ctx: RequestContext): Promise<string[]> {
  if (!ctx.personId || !ctx.accountId) {
    return []
  }

  const { data } = await db.rpc('get_person_roles', {
    person_id: ctx.personId,
    account_id: ctx.accountId,
    include_expired: false
  })

  if (!data) return []

  return (data as any[]).map((role: any) => role.role_slug)
}

// Resolve system role (for super admins, etc.)
async function resolveSystemRole(personId: string): Promise<string | null> {
  // Check if person has super_admin role in any account
  const { data } = await db
    .from('people_roles')
    .select(`
      role:roles(slug, is_system)
    `)
    .eq('person_id', personId)
    .eq('is_active', true)
    .eq('role.is_system', true)
    .limit(1)

  if (data && data.length > 0) {
    return data[0].role.slug
  }

  return null
}

// CORS handler
export function cors() {
  return json({ message: 'CORS enabled' }, 200)
}
