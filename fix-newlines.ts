import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uyokuiibztwfasdprsov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5NDMwNSwiZXhwIjoyMDg2OTcwMzA1fQ.GK6u125qCmEe_iyk-cFQAoX-SwuUFSoFSPFhhoCIAoI'
)

async function run() {
  const { data: items } = await supabase
    .from('items')
    .select('id, metadata')
    
  if (items) {
    for (const item of items) {
      if (item.metadata && typeof item.metadata.body === 'string' && item.metadata.body.includes('\\n')) {
        const newBody = item.metadata.body.replace(/\\n/g, '\n')
        const newMetadata = { ...item.metadata, body: newBody }
        await supabase.from('items').update({ metadata: newMetadata }).eq('id', item.id)
        console.log(`Fixed item: ${item.id}`)
      }
    }
  }
}

run()
