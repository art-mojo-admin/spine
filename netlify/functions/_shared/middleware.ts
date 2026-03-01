import type { Context } from '@netlify/functions'
import { db } from './db'
import { logError, classifyError, extractFunctionName } from './errors'

export interface RequestContext {
  requestId: string
  personId: string | null
  accountId: string | null
  accountNodeId: string | null
  accountRole: string | null
  systemRole: string | null
  authUid: string | null
  impersonating: boolean
  realPersonId: string | null
  impersonationSessionId: string | null
}

export interface HandlerResult {
  statusCode: number
  body: string
  headers?: Record<string, string>
}

type RouteHandler = (
  req: Request,
  ctx: RequestContext,
  params: URLSearchParams,
) => Promise<HandlerResult>

interface RouteMap {
  GET?: RouteHandler
  POST?: RouteHandler
  PATCH?: RouteHandler
  DELETE?: RouteHandler
}

const ALLOWED_ORIGIN = process.env.SITE_URL || process.env.URL || '*'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id, X-Account-Id, X-Account-Node-Id, X-Impersonate-Session-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

const PUBLIC_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

export function json(data: unknown, status = 200): HandlerResult {
  return { statusCode: status, body: JSON.stringify(data), headers: CORS_HEADERS }
}

export function error(message: string, status = 400): HandlerResult {
  return { statusCode: status, body: JSON.stringify({ error: message }), headers: CORS_HEADERS }
}

async function resolveAuth(req: Request): Promise<Partial<RequestContext>> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {}
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await db.auth.getUser(token)

  if (authError || !user) {
    console.error('[auth] Token verification failed:', authError?.message)
    // Persist failed auth attempt for security monitoring
    try {
      await db.from('audit_log').insert({
        account_id: null,
        person_id: null,
        request_id: req.headers.get('x-request-id') || 'unknown',
        action: 'auth.failed',
        entity_type: 'auth',
        entity_id: null,
        metadata: {
          reason: authError?.message || 'Unknown auth error',
          user_agent: req.headers.get('user-agent')?.slice(0, 200) || null,
        },
      })
    } catch {}
    return {}
  }

  const { data: person } = await db
    .from('persons')
    .select('id')
    .eq('auth_uid', user.id)
    .single()

  if (!person) {
    console.error('[auth] No person found for auth_uid:', user.id)
    return { authUid: user.id }
  }

  const { data: profile } = await db
    .from('profiles')
    .select('system_role')
    .eq('person_id', person.id)
    .single()

  return {
    authUid: user.id,
    personId: person.id,
    systemRole: profile?.system_role ?? null,
  }
}

async function resolveTenant(
  req: Request,
  personId: string | null,
  systemRole: string | null = null,
): Promise<{ accountId: string | null; accountRole: string | null }> {
  const headerAccountId = req.headers.get('x-account-id')
  const url = new URL(req.url)
  const paramAccountId = url.searchParams.get('account_id')
  const accountId = headerAccountId || paramAccountId

  if (!accountId || !personId) {
    if (personId) {
      const { data: membership } = await db
        .from('memberships')
        .select('account_id, account_role')
        .eq('person_id', personId)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (membership) {
        return { accountId: membership.account_id, accountRole: membership.account_role }
      }
    }
    return { accountId: null, accountRole: null }
  }

  const { data: membership } = await db
    .from('memberships')
    .select('account_role')
    .eq('person_id', personId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .single()

  if (membership) {
    return { accountId, accountRole: membership.account_role }
  }

  // System admins can access any account even without a membership
  if (systemRole && ['system_admin', 'system_operator'].includes(systemRole)) {
    return { accountId, accountRole: 'admin' }
  }

  return { accountId: null, accountRole: null }
}

async function resolveAccountNode(
  req: Request,
  accountId: string | null,
): Promise<string | null> {
  if (!accountId) return null

  const headerNodeId = req.headers.get('x-account-node-id')
  const url = new URL(req.url)
  const paramNodeId = url.searchParams.get('account_node_id')
  const nodeId = headerNodeId || paramNodeId

  if (!nodeId) {
    return accountId
  }

  const { data: path } = await db
    .from('account_paths')
    .select('ancestor_id')
    .eq('ancestor_id', accountId)
    .eq('descendant_id', nodeId)
    .limit(1)
    .single()

  if (path) {
    return nodeId
  }

  return accountId
}

interface ImpersonationResult {
  sessionId: string
  targetPersonId: string
  targetAccountId: string
  targetAccountRole: string
}

async function resolveImpersonation(
  req: Request,
  auth: Partial<RequestContext>,
): Promise<ImpersonationResult | null> {
  const sessionId = req.headers.get('x-impersonate-session-id')
  if (!sessionId || !auth.personId) return null

  // Caller must be a system admin/operator to impersonate
  if (!auth.systemRole || !['system_admin', 'system_operator'].includes(auth.systemRole)) {
    console.warn(`[impersonate] Non-admin ${auth.personId} attempted impersonation`)
    return null
  }

  const { data: session } = await db
    .from('impersonation_sessions')
    .select('id, admin_person_id, target_person_id, target_account_id, target_account_role, status, expires_at')
    .eq('id', sessionId)
    .eq('admin_person_id', auth.personId)
    .eq('status', 'active')
    .single()

  if (!session) {
    console.warn(`[impersonate] Session ${sessionId} not found or not active`)
    return null
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await db
      .from('impersonation_sessions')
      .update({ status: 'expired' })
      .eq('id', sessionId)
    console.warn(`[impersonate] Session ${sessionId} expired`)
    return null
  }

  console.log(`[impersonate] ${auth.personId} acting as ${session.target_person_id} in ${session.target_account_id}`)

  return {
    sessionId: session.id,
    targetPersonId: session.target_person_id,
    targetAccountId: session.target_account_id,
    targetAccountRole: session.target_account_role,
  }
}

export function createHandler(routes: RouteMap) {
  return async (req: Request, _netlifyContext: Context): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
    console.log(`[${requestId}] ${req.method} ${req.url}`)

    const handler = routes[req.method as keyof RouteMap]
    if (!handler) {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: CORS_HEADERS },
      )
    }

    try {
      const auth = await resolveAuth(req)
      const impersonation = await resolveImpersonation(req, auth)

      let ctx: RequestContext

      if (impersonation) {
        ctx = {
          requestId,
          personId: impersonation.targetPersonId,
          accountId: impersonation.targetAccountId,
          accountNodeId: impersonation.targetAccountId,
          accountRole: impersonation.targetAccountRole,
          systemRole: null,
          authUid: auth.authUid ?? null,
          impersonating: true,
          realPersonId: auth.personId ?? null,
          impersonationSessionId: impersonation.sessionId,
        }
      } else {
        const tenant = await resolveTenant(req, auth.personId ?? null, auth.systemRole ?? null)
        const accountNodeId = await resolveAccountNode(req, tenant.accountId)
        ctx = {
          requestId,
          personId: auth.personId ?? null,
          accountId: tenant.accountId,
          accountNodeId,
          accountRole: tenant.accountRole,
          systemRole: auth.systemRole ?? null,
          authUid: auth.authUid ?? null,
          impersonating: false,
          realPersonId: null,
          impersonationSessionId: null,
        }
      }

      const url = new URL(req.url)
      const result = await handler(req, ctx, url.searchParams)

      return new Response(result.body, {
        status: result.statusCode,
        headers: { ...CORS_HEADERS, ...result.headers },
      })
    } catch (err: any) {
      console.error(`[${requestId}] Error:`, err)
      const fnName = extractFunctionName(req.url)
      const errorCode = classifyError(err)
      await logError({
        requestId,
        functionName: fnName,
        errorCode,
        message: err.message || 'Unknown error',
        stack: err.stack,
        accountId: null,
        metadata: { method: req.method, url: req.url },
      })
      return new Response(
        JSON.stringify({ error: 'Internal server error', requestId }),
        { status: 500, headers: CORS_HEADERS },
      )
    }
  }
}

export function requireAuth(ctx: RequestContext): HandlerResult | null {
  if (!ctx.personId) {
    return error('Authentication required', 401)
  }
  return null
}

export function requireTenant(ctx: RequestContext): HandlerResult | null {
  if (!ctx.accountId) {
    return error('Tenant context required', 403)
  }
  return null
}

export function requireRole(ctx: RequestContext, roles: string[]): HandlerResult | null {
  if (ctx.systemRole && ['system_admin', 'system_operator'].includes(ctx.systemRole)) {
    return null
  }
  if (!ctx.accountRole || !roles.includes(ctx.accountRole)) {
    return error('Insufficient permissions', 403)
  }
  return null
}

const ROLE_RANK: Record<string, number> = {
  portal: 0,
  member: 1,
  operator: 2,
  admin: 3,
}

export function requireMinRole(ctx: RequestContext, minRole: string): HandlerResult | null {
  if (ctx.systemRole && ['system_admin', 'system_operator'].includes(ctx.systemRole)) {
    return null
  }
  const required = ROLE_RANK[minRole] ?? 0
  const actual = ROLE_RANK[ctx.accountRole || ''] ?? -1
  if (actual < required) {
    return error('Insufficient permissions', 403)
  }
  return null
}

export function isPortalUser(ctx: RequestContext): boolean {
  return ctx.accountRole === 'portal'
}

export function clampLimit(params: URLSearchParams, defaultLimit = 50, maxLimit = 200): number {
  const raw = parseInt(params.get('limit') || String(defaultLimit), 10)
  return Math.min(Math.max(raw || defaultLimit, 1), maxLimit)
}

const MAX_BODY_BYTES = 1_048_576 // 1 MB

export async function parseBody<T = any>(req: Request): Promise<T> {
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    throw new Error('Request body too large')
  }
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) {
    throw new Error('Request body too large')
  }
  return JSON.parse(text) as T
}
