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
    const body = data.metadata?.body || ''
    console.log('Body type:', typeof body)
    console.log('Body length:', body.length)
    console.log('Includes literal \\\\n?', body.includes('\\n'))
    console.log('Includes actual newline?', body.includes('\n'))
  } else {
    console.log('No data', error)
  }
}

run()
