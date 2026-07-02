import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: fundraisers, error } = await supabase
    .from('fundraisers')
    .select('id, title, slug, goal, raised')
    .limit(5);

  if (error) {
    console.error('Error fetching fundraisers:', error);
    return;
  }

  console.log('Fundraisers list:');
  console.log(JSON.stringify(fundraisers, null, 2));
}

run();
