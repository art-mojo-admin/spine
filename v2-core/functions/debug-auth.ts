import { createHandler } from './_shared/middleware'

// Debug authentication token validation
const debug = createHandler(async (ctx, _body) => {
  const envObj = (globalThis as any).process?.env || {}
  return {
    data: {
      message: 'Debug auth endpoint',
      hasPrincipal: !!ctx.principal,
      principalType: ctx.principal?.type || 'none',
      requestId: ctx.requestId,
      envVars: {
        supabaseUrl: envObj.SUPABASE_URL ? 'SET' : 'NOT_SET',
        supabaseAnonKey: envObj.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      }
    }
  }
})

// Test JWT validation directly
const testJwt = createHandler(async (ctx, _body) => {
  const envObj = (globalThis as any).process?.env || {}
  if (!ctx.principal) {
    return {
      data: null,
      error: 'No principal resolved from token'
    }
  }
  
  return {
    data: {
      tokenValid: true,
      principal: {
        type: ctx.principal.type,
        id: ctx.principal.id,
        accountId: ctx.accountId
      }
    }
  }
})

// Main handler
export async function handler(event: any, context: any) {
  const method = event.queryStringParameters?.method || 'debug'
  
  const ctx = await createHandler(async (ctx, _body) => {
    switch (method) {
      case 'debug':
        return await debug(ctx, _body)
      case 'testJwt':
        return await testJwt(ctx, _body)
      default:
        return await debug(ctx, _body)
    }
  })(event, context)
  
  return ctx
}
