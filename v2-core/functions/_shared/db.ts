import { createClient } from '@supabase/supabase-js'

// ============================================
// Supabase Configuration
// ============================================
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

// ============================================
// Admin Client - For system operations, migrations, machine principals
// Uses service_role key - bypasses RLS but application enforces permissions
// ============================================
export const adminDb = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'v2'
  }
})

// ============================================
// User-Scoped Client - For human requests with RLS enforcement
// Uses the user's JWT token - RLS policies enforce account hierarchy
// ============================================
export function getUserDb(jwt: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: 'v2'
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  })
}

// Type for database results
export type DbResult<T> = {
  data: T | null
  error: any
}

/**
 * PostgREST relationship hint strings for all v2 foreign keys.
 * 
 * Use explicit !fk_column hints to make relationships unambiguous,
 * especially when the FK column name doesn't follow PostgREST's
 * tablename_id convention (e.g. created_by → people.id).
 * 
 * Usage in API files:
 *   .select(`*, ${joins.type}, ${joins.app}`)
 */
export const joins = {
  type:         'type:types!type_id(id, slug, name, icon, color, design_schema)',
  app:          'app:apps!app_id(id, slug, name)',
  ownerAccount: 'owner_account:accounts!owner_account_id(id, slug, display_name)',
  createdBy:    'created_by_person:people!created_by(id, full_name, email)',
  parentAccount:'parent:accounts!parent_id(id, slug, display_name)',
  role:         'role:roles!role_id(id, slug, name)',
  pipeline:     'pipeline:pipelines!pipeline_id(id, name)',
}
