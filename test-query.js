const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(role, user_id, profile:profiles(id, display_name, email, avatar_url)), scripts(count)')
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data length:", data ? data.length : 0);
}
test();
