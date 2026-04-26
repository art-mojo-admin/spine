/**
 * Unified Principal - The single identity abstraction for all actors in Spine v2
 * 
 * This module provides:
 * - Principal interface definition
 * - Resolution functions for all actor types (human, machine, cron, trigger)
 * - Helper functions for principal validation and scope checking
 * 
 * Every request to Spine resolves to a Principal before hitting PermissionEngine or RLS.
 */

import { getUserDb, adminDb } from './db'
import { createClient } from '@supabase/supabase-js'

// Supabase client for JWT validation
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

/**
 * Principal - Unified identity abstraction
 * 
 * All actors in Spine (humans, machines, cron jobs, triggers) resolve to this interface.
 * The type field distinguishes the actor kind, while common fields provide identity context.
 */
export interface Principal {
  /** Unique identifier - person UUID or machine principal UUID */
  id: string
  
  /** Actor type */
  type: 'human' | 'machine'
  
  /** Primary account context for this principal */
  accountId: string | null
  
  // ============================================
  // Human-specific fields (only populated when type === 'human')
  // ============================================
  /** Role slugs assigned to this person */
  roles?: string[]
  
  /** Human-readable name */
  displayName?: string
  
  /** Email address */
  email?: string
  
  // ============================================
  // Machine-specific fields (only populated when type === 'machine')
  // ============================================
  /** Explicit permission grants (e.g., ['items:read', 'people:write']) */
  scopes?: string[]
  
  /** Machine classification */
  machineType?: 'integration' | 'service_account' | 'internal'
  
  /** Internal system machines (cron, trigger, pipeline) are not shown in UI */
  isInternal?: boolean
  
  // ============================================
  // Universal provenance - audit trail context
  // ============================================
  provenance: {
    /** How this principal was authenticated */
    sourceType: 'jwt' | 'api_key' | 'cron' | 'trigger' | 'manual' | 'webhook'
    
    /** Person who authorized this principal (may be self for humans) */
    createdBy: string | null
    
    /** Chain ID for trigger/pipeline sequences */
    parentExecutionId?: string
    
    /** When this principal context was created */
    invokedAt: string
    
    // Source-specific context
    /** API key ID (for api_key source) */
    apiKeyId?: string
    
    /** Schedule ID (for cron source) */
    cronId?: string
    
    /** Trigger ID (for trigger source) */
    triggerId?: string
    
    /** Event ID that triggered this execution */
    eventId?: string
    
    /** IP address of the requester */
    ipAddress?: string
    
    /** User agent string */
    userAgent?: string
  }
  
  // ============================================
  // Authentication context (for RLS client selection)
  // ============================================
  authContext?: {
    /** JWT token for human-scoped DB client */
    jwt?: string
    
    /** API key value for machine verification */
    apiKey?: string
  }
}

/**
 * Anonymous principal for unauthenticated requests
 */
export const ANONYMOUS_PRINCIPAL: Principal = {
  id: 'anonymous',
  type: 'machine',
  accountId: null,
  scopes: [],
  provenance: {
    sourceType: 'manual',
    createdBy: null,
    invokedAt: new Date().toISOString()
  }
}

/**
 * System principal for internal operations
 */
export const SYSTEM_PRINCIPAL: Principal = {
  id: 'system',
  type: 'machine',
  accountId: null,
  scopes: ['*:*'],  // All scopes
  machineType: 'internal',
  isInternal: true,
  provenance: {
    sourceType: 'manual',
    createdBy: null,
    invokedAt: new Date().toISOString()
  }
}

/**
 * Resolve a principal from an incoming event/request
 * 
 * This is the main entry point for principal resolution. It examines the
 * event headers and resolves to the appropriate principal type.
 * 
 * Resolution order:
 * 1. API key (machine principal)
 * 2. Internal cron header
 * 3. Internal trigger header
 * 4. JWT Bearer token (human principal)
 * 5. Anonymous (if no auth)
 */
export async function resolvePrincipal(event: any): Promise<Principal> {
  // Check for API key (external machine)
  const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key']
  if (apiKey) {
    return resolveMachinePrincipal(apiKey, event)
  }
  
  // Check for internal cron header
  const cronId = event.headers?.['x-cron-id'] || event.headers?.['X-Cron-Id']
  if (cronId) {
    return resolveCronPrincipal(cronId)
  }
  
  // Check for internal trigger header
  const triggerId = event.headers?.['x-trigger-id'] || event.headers?.['X-Trigger-Id']
  if (triggerId) {
    return resolveTriggerPrincipal(triggerId, event)
  }
  
  // Check for JWT Bearer (human)
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  if (authHeader?.startsWith('Bearer ')) {
    return resolveHumanPrincipal(authHeader.replace('Bearer ', ''), event)
  }
  
  // No authentication - return anonymous
  return ANONYMOUS_PRINCIPAL
}

/**
 * Resolve a machine principal from an API key
 */
async function resolveMachinePrincipal(apiKey: string, event: any): Promise<Principal> {
  // Validate the API key using the database function
  const { data: machine, error } = await adminDb.rpc('validate_machine_principal', {
    p_key_value: apiKey,
    p_required_scope: null  // No specific scope required for resolution
  })
  
  if (error || !machine || !machine.is_valid) {
    throw new Error(machine?.error_message || 'Invalid or inactive machine principal')
  }
  
  return {
    id: machine.machine_id,
    type: 'machine',
    accountId: machine.account_id,
    scopes: machine.scopes || [],
    machineType: machine.machine_type as any,
    isInternal: machine.is_internal,
    provenance: {
      sourceType: 'api_key',
      createdBy: machine.created_by,
      invokedAt: new Date().toISOString(),
      apiKeyId: machine.machine_id,
      ipAddress: getClientIp(event),
      userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent']
    },
    authContext: { apiKey }
  }
}

/**
 * Resolve a machine principal for a cron job execution
 */
async function resolveCronPrincipal(scheduleId: string): Promise<Principal> {
  // Load the schedule with its machine principal
  const { data: schedule, error: scheduleError } = await adminDb
    .from('schedules')
    .select(`
      *,
      machine:machine_principal_id (*)
    `)
    .eq('id', scheduleId)
    .single()
  
  if (scheduleError || !schedule) {
    throw new Error('Invalid or inactive schedule: ' + scheduleId)
  }
  
  // Validate the schedule creator is still active
  const { data: validation, error: validationError } = await adminDb.rpc('validate_schedule_creator', {
    p_schedule_id: scheduleId
  })
  
  if (validationError || !validation.is_valid) {
    throw new Error(validation.error_message || 'Schedule validation failed')
  }
  
  const machine = schedule.machine
  
  return {
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
      cronId: scheduleId
    }
  }
}

/**
 * Resolve a machine principal for a trigger execution
 */
async function resolveTriggerPrincipal(triggerId: string, event: any): Promise<Principal> {
  // Load the trigger
  const { data: trigger, error: triggerError } = await adminDb
    .from('triggers')
    .select(`
      *,
      action:target_id (*)
    `)
    .eq('id', triggerId)
    .single()
  
  if (triggerError || !trigger) {
    throw new Error('Invalid trigger: ' + triggerId)
  }
  
  // Get the action's default machine principal
  const action = trigger.action
  if (!action?.default_machine_principal_id) {
    throw new Error('Trigger action has no machine principal configured')
  }
  
  const { data: machine, error: machineError } = await adminDb
    .from('api_keys')
    .select('*')
    .eq('id', action.default_machine_principal_id)
    .single()
  
  if (machineError || !machine) {
    throw new Error('Machine principal not found: ' + action.default_machine_principal_id)
  }
  
  return {
    id: machine.id,
    type: 'machine',
    accountId: machine.account_id,
    scopes: machine.scopes || [],
    machineType: machine.machine_type,
    isInternal: machine.is_internal,
    provenance: {
      sourceType: 'trigger',
      createdBy: machine.created_by,
      invokedAt: new Date().toISOString(),
      triggerId: triggerId,
      eventId: event.body?.eventId || event.headers?.['x-event-id']
    }
  }
}

/**
 * Resolve a human principal from a JWT token
 */
async function resolveHumanPrincipal(token: string, event: any): Promise<Principal> {
  // Validate JWT with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new Error('Invalid authentication token')
  }
  
  // Resolve internal person ID from auth user
  const personId = await resolveInternalPersonId(user.id, user.email)
  
  // Load person details
  const { data: person, error: personError } = await adminDb
    .from('people')
    .select('*, role:role_id(slug, name, is_system, is_protected)')
    .eq('id', personId)
    .single()
  
  if (personError || !person) {
    throw new Error('Person not found: ' + personId)
  }
  
  // Resolve role from role_id
  const roleSlugs = person.role?.slug ? [person.role.slug] : []
  
  return {
    id: personId,
    type: 'human',
    accountId: person.account_id || null,
    roles: roleSlugs,
    displayName: person.display_name || person.email,
    email: person.email,
    provenance: {
      sourceType: 'jwt',
      createdBy: personId,  // Self-created through auth
      invokedAt: new Date().toISOString(),
      ipAddress: getClientIp(event),
      userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent']
    },
    authContext: { jwt: token }
  }
}

/**
 * Resolve internal person ID from Supabase auth user ID
 */
async function resolveInternalPersonId(authUserId: string, email?: string): Promise<string> {
  // Try to find by auth_uid
  const { data: byAuthId } = await adminDb
    .from('people')
    .select('id')
    .eq('auth_uid', authUserId)
    .single()
  
  if (byAuthId) return byAuthId.id
  
  // Fallback: try by email
  if (email) {
    const { data: byEmail } = await adminDb
      .from('people')
      .select('id')
      .eq('email', email)
      .single()
    
    if (byEmail) return byEmail.id
  }
  
  // Not found - return the auth ID as fallback
  return authUserId
}

/**
 * Get client IP from event headers
 */
function getClientIp(event: any): string | undefined {
  return event.headers?.['x-forwarded-for'] ||
         event.headers?.['X-Forwarded-For'] ||
         event.headers?.['x-real-ip'] ||
         event.headers?.['X-Real-Ip'] ||
         event.requestContext?.identity?.sourceIp
}

/**
 * Check if a machine principal has a specific scope
 * Supports wildcards: "items:*" matches "items:read", "*:*" matches everything
 */
export function machineHasScope(principal: Principal, scope: string): boolean {
  if (principal.type !== 'machine') return false
  
  const scopes = principal.scopes || []
  const [resource, action] = scope.split(':')
  
  // Exact match
  if (scopes.includes(scope)) return true
  
  // Wildcard resource
  if (scopes.includes(`${resource}:*`)) return true
  
  // Global wildcard
  if (scopes.includes('*:*')) return true
  
  return false
}

/**
 * Check if a human principal has a specific role
 */
export function humanHasRole(principal: Principal, roleSlug: string): boolean {
  if (principal.type !== 'human') return false
  return principal.roles?.includes(roleSlug) || false
}

/**
 * Check if a principal is a system admin
 */
export function isSystemAdmin(principal: Principal): boolean {
  return humanHasRole(principal, 'system_admin')
}

/**
 * Get the appropriate database client for a principal
 * 
 * - Humans: User-scoped client with JWT (enforces RLS)
 * - Machines: Admin client (RLS checks machine ID in policies)
 * - Anonymous: No client (should be rejected before DB access)
 */
export function getPrincipalDb(principal: Principal) {
  if (principal.type === 'human' && principal.authContext?.jwt) {
    return getUserDb(principal.authContext.jwt)
  }
  
  // Machines use admin client - RLS policies check their ID
  return adminDb
}

/**
 * Format principal for audit logging
 */
export function formatPrincipalForAudit(principal: Principal): object {
  return {
    id: principal.id,
    type: principal.type,
    account_id: principal.accountId,
    ...(principal.type === 'human' && {
      roles: principal.roles,
      display_name: principal.displayName
    }),
    ...(principal.type === 'machine' && {
      machine_type: principal.machineType,
      is_internal: principal.isInternal,
      scopes: principal.scopes
    }),
    provenance: principal.provenance
  }
}
