import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const { data, error } = await db.rpc('exec_sql', { query: sql, params })
  if (error) throw error
  return data as T[]
}
