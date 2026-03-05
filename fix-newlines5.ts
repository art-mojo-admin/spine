import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uyokuiibztwfasdprsov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5NDMwNSwiZXhwIjoyMDg2OTcwMzA1fQ.GK6u125qCmEe_iyk-cFQAoX-SwuUFSoFSPFhhoCIAoI'
)

async function run() {
  const { data: items } = await supabase
    .from('items')
    .select('id, title, metadata')
    .eq('id', '75754dbf-fd01-4bf3-bf4d-ce88167edd02')
    
  if (items && items.length > 0) {
    const item = items[0];
    const body = item.metadata.body;
    console.log("Original body:");
    console.log(body);
    
    // Replace literal '\n' with actual newline
    const fixedBody = body.replace(/\\n/g, '\n');
    console.log("Fixed body:");
    console.log(fixedBody);
    
    if (fixedBody !== body) {
        const newMetadata = { ...item.metadata, body: fixedBody };
        const { error } = await supabase.from('items').update({ metadata: newMetadata }).eq('id', item.id);
        if (error) {
            console.error('Update error:', error);
        } else {
            console.log('Successfully updated item in database.');
        }
    } else {
        console.log('No changes were made (no literal \\n found or regex failed).');
    }
  }
}

run()
