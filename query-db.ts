import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://uyokuiibztwfasdprsov.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5b2t1aWlienR3ZmFzZHByc292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTQzMDUsImV4cCI6MjA4Njk3MDMwNX0.PYYNUhAYnAZ8WHvKvyPAHzHOn_LKVXTGnaeinYNgIHk'
)

async function run() {
  const { data, error } = await supabase
    .from('items')
    .select('metadata')
    .eq('id', '75754dbf-fd01-4bf3-bf4d-ce88167edd02')
  console.log(data)
}

run()
