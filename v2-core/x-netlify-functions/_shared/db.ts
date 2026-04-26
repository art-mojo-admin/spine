import { createClient } from '@supabase/supabase-js'

// Supabase client scoped to v2 schema
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const db = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'v2'
  }
})

// Helper for executing raw SQL with v2 schema
export async function executeSql(sql: string, params?: any[]) {
  const { data, error } = await db.rpc('exec_sql', {
    sql_query: sql,
    params: params || []
  })
  
  if (error) throw error
  return data
}

// Type for database results
export type DbResult<T> = {
  data: T | null
  error: any
}

export default db
