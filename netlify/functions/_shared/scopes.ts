import { db } from './db'

export interface ScopeSummary {
  id: string
  slug: string
  label: string
  category: string
  description: string | null
  default_role: string | null
  default_bundle: Record<string, unknown> | null
}

export async function fetchScopeSummary(ref: { id?: string | null; slug?: string | null }): Promise<ScopeSummary | null> {
  if (!ref.id && !ref.slug) return null

  let query = db
    .from('auth_scopes')
    .select('id, slug, label, category, description, default_role, default_bundle')
    .limit(1)

  if (ref.id) query = query.eq('id', ref.id)
  if (ref.slug) query = query.eq('slug', ref.slug)

  const { data, error } = await query.single()
  if (error || !data) return null
  return data as ScopeSummary
}
