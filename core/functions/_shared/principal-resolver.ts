import { db } from './db'

/**
 * Resolve a principal ID from a person ID, creating if needed
 */
export async function resolvePrincipalFromPerson(personId: string): Promise<string | null> {
  if (!personId) return null

  const { data: existing } = await db
    .from('principals')
    .select('id')
    .eq('person_id', personId)
    .single()

  if (existing) return existing.id

  // Create new human principal
  const { data: person } = await db
    .from('persons')
    .select('full_name')
    .eq('id', personId)
    .single()

  const { data: principal } = await db
    .from('principals')
    .insert({
      principal_type: 'human',
      person_id: personId,
      display_name: person?.full_name || null,
      status: 'active',
      metadata: {},
    })
    .select('id')
    .single()

  return principal?.id || null
}

/**
 * Get principal details with related person/machine info
 */
export async function getPrincipalDetails(principalId: string) {
  const { data } = await db
    .from('principals')
    .select(`
      *,
      persons:person_id (
        id,
        email,
        full_name,
        status
      ),
      machine_principals:machine_principal_id (
        id,
        name,
        kind,
        status,
        auth_mode
      )
    `)
    .eq('id', principalId)
    .single()

  return data
}

/**
 * Check if a principal has a specific scope
 */
export async function principalHasScope(
  principalId: string,
  accountId: string,
  scopeSlug: string
): Promise<boolean> {
  const { data } = await db
    .from('principal_scopes')
    .select('id')
    .eq('principal_id', principalId)
    .eq('account_id', accountId)
    .eq('scope_slug', scopeSlug)
    .eq('status', 'active')
    .single()

  return !!data
}

/**
 * Get all scopes for a principal in an account
 */
export async function getPrincipalScopes(principalId: string, accountId: string) {
  const { data } = await db
    .from('principal_scopes')
    .select(`
      *,
      auth_scopes (
        slug,
        label,
        category,
        description
      )
    `)
    .eq('principal_id', principalId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return data || []
}
