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
      if (item.metadata && typeof item.metadata.body === 'string') {
        let newBody = item.metadata.body;
        // The regex /\\n/g matches literal string "\n"
        newBody = newBody.replace(/\\n/g, '\n');
        
        if (newBody !== item.metadata.body) {
            const newMetadata = { ...item.metadata, body: newBody }
            const { error } = await supabase.from('items').update({ metadata: newMetadata }).eq('id', item.id)
            if (error) console.error(error)
            console.log(`Fixed literal \\n for item: ${item.id}`)
        }
      }
    }
  }
}

run()
