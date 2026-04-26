import { createHandler } from './_shared/middleware'
import { createClient } from '@supabase/supabase-js'

// Debug authentication token validation
const debug = createHandler(async (ctx, _body) => {
  const authHeader = ctx.event?.headers?.authorization || ctx.event?.headers?.Authorization
  
  return {
    data: {
      message: 'Debug auth endpoint',
      authHeader: authHeader ? 'Bearer [REDACTED]' : 'None',
      hasAuthHeader: !!authHeader,
      requestId: ctx.requestId,
      envVars: {
        supabaseUrl: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
      }
    }
  }
})

// Test JWT validation directly
const testJwt = createHandler(async (ctx, _body) => {
  const authHeader = ctx.event?.headers?.authorization || ctx.event?.headers?.Authorization
  
  if (!authHeader) {
    return {
      data: null,
      error: 'No authorization header'
    }
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  // Test Supabase JWT validation
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    return {
      data: {
        tokenValid: !error,
        user: user ? {
          id: user.id,
          email: user.email,
          aud: user.aud,
        } : null,
        error: error ? {
          message: error.message,
          status: error.status
        } : null
      }
    }
  } catch (e: any) {
    return {
      data: null,
      error: e.message
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
