import { db } from './db'

export type ErrorCode =
  | 'auth_failed'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'db_error'
  | 'timeout'
  | 'external_service'
  | 'internal'

export function classifyError(err: unknown): ErrorCode {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborterror')) return 'timeout'
    if (msg.includes('not found') || msg.includes('404')) return 'not_found'
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('auth')) return 'auth_failed'
    if (msg.includes('forbidden') || msg.includes('403')) return 'forbidden'
    if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) return 'validation'
    if (msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('dns')) return 'external_service'
    if (msg.includes('duplicate') || msg.includes('violates') || msg.includes('relation')) return 'db_error'
  }
  return 'internal'
}

export async function logError(opts: {
  requestId: string
  functionName: string
  errorCode: ErrorCode
  message: string
  stack?: string
  accountId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.from('error_events').insert({
      account_id: opts.accountId || null,
      request_id: opts.requestId,
      function_name: opts.functionName,
      error_code: opts.errorCode,
      message: opts.message.slice(0, 1000),
      stack_summary: opts.stack?.slice(0, 500) || null,
      metadata: opts.metadata || {},
    })
  } catch (e) {
    // Never throw from error logging — just console
    console.error('[logError] Failed to persist error event:', (e as Error).message)
  }
}

export function extractFunctionName(url: string): string {
  try {
    const path = new URL(url).pathname
    // /.netlify/functions/tickets → tickets
    const match = path.match(/\/\.netlify\/functions\/([^/?]+)/)
    return match?.[1] || path.split('/').pop() || 'unknown'
  } catch {
    return 'unknown'
  }
}
