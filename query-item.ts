import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('items')
    .select('metadata')
    .eq('id', '75754dbf-fd01-4bf3-bf4d-ce88167edd02')
    .single()
  console.log(JSON.stringify(data, null, 2))
}

run()
