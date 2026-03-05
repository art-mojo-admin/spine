import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uyokuiibztwfasdprsov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5NDMwNSwiZXhwIjoyMDg2OTcwMzA1fQ.GK6u125qCmEe_iyk-cFQAoX-SwuUFSoFSPFhhoCIAoI'
)

async function run() {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, item_type, metadata')
    .eq('id', '75754dbf-fd01-4bf3-bf4d-ce88167edd02')
    .single()
    
  if (data) {
    console.log('Body is:', JSON.stringify(data.metadata?.body))
    console.log('Raw body contains literal \\n?', data.metadata?.body.includes('\\n'))
  }
}

run()
