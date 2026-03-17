import { getActiveAccountId } from '@/lib/accountContext'
import { getStoredActiveApp, type ActiveAppEntry } from '@/lib/activeAppStorage'

export class MissingActiveAppError extends Error {
  constructor(message = 'Select an app to continue editing pack-managed assets.') {
    super(message)
    this.name = 'MissingActiveAppError'
  }
}

interface ScopeOptions {
  accountId?: string | null
}

export function getActiveAppScope(options: ScopeOptions = {}): ActiveAppEntry | null {
  const accountId = options.accountId ?? getActiveAccountId()
  if (!accountId) return null
  return getStoredActiveApp(accountId)
}

export function requireActiveAppScope(options: ScopeOptions = {}): ActiveAppEntry {
  const scope = getActiveAppScope(options)
  if (!scope) {
    throw new MissingActiveAppError()
  }
  return scope
}

interface WithScopeOptions extends ScopeOptions {
  required?: boolean
  include?: Array<'pack_id' | 'app_id'>
}

export function withActiveAppScope<T extends Record<string, any>>(payload: T, options: WithScopeOptions = {}) {
  const { required = false, include = ['pack_id'] } = options
  const scope = required ? requireActiveAppScope(options) : getActiveAppScope(options)
  if (!scope) return payload

  const next: Record<string, any> = { ...payload }
  if (include.includes('pack_id') && next.pack_id == null) {
    next.pack_id = scope.packId
  }
  if (include.includes('app_id') && next.app_id == null) {
    next.app_id = scope.appId
  }
  return next as T
}
