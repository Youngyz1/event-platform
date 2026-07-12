const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
console.log('Reading env from:', envPath);
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

console.log('URL:', supabaseUrl);
console.log('Service Role Key defined:', !!serviceRoleKey);

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('\n--- Testing listUsers ---');
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10 });
    if (error) {
      console.error('listUsers error:', error);
    } else {
      console.log('listUsers success! Count of users fetched:', data.users ? data.users.length : 0);
    }
  } catch (e) {
    console.error('listUsers exception:', e);
  }

  console.log('\n--- Testing articles query ---');
  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('*, profiles:owner_id(id, display_name, account_info)');
    if (error) {
      console.error('articles query error:', error);
    } else {
      console.log('articles query success! Count:', data ? data.length : 0);
      if (data && data.length > 0) {
        console.log('First article owner_id:', data[0].owner_id);
        console.log('First article profiles association:', data[0].profiles);
      }
    }
  } catch (e) {
    console.error('articles query exception:', e);
  }

  console.log('\n--- Testing businesses query ---');
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('*, profiles:owner_id(id, display_name, account_info)');
    if (error) {
      console.error('businesses query error:', error);
    } else {
      console.log('businesses query success! Count:', data ? data.length : 0);
    }
  } catch (e) {
    console.error('businesses query exception:', e);
  }
}

run();
