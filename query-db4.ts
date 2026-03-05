import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uyokuiibztwfasdprsov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5NDMwNSwiZXhwIjoyMDg2OTcwMzA1fQ.GK6u125qCmEe_iyk-cFQAoX-SwuUFSoFSPFhhoCIAoI'
)

async function run() {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, item_type, metadata')
    .ilike('title', '%Support%')
    
  if (data) {
    for (const item of data) {
      console.log(`Item: ${item.title}`)
      console.log(`Type: ${item.item_type}`)
      console.log(`Body:`, JSON.stringify(item.metadata?.body))
      console.log('---')
    }
  }
}

run()
