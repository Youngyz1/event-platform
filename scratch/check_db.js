const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables manually
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log("Checking reviews table...");
  const { data: reviewsData, error: reviewsError } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .limit(1);
  if (reviewsError) {
    console.log("Reviews table error:", reviewsError.message);
  } else {
    console.log("Reviews table exists!");
  }

  console.log("Checking organizers nonprofit columns...");
  const { data: orgData, error: orgError } = await supabaseAdmin
    .from('organizers')
    .select('organization_name, tax_id, nonprofit_registration_number')
    .limit(1);
  if (orgError) {
    console.log("Organizers nonprofit columns error:", orgError.message);
  } else {
    console.log("Organizers nonprofit columns exist!");
  }

  console.log("Checking donations path columns...");
  const { data: donData, error: donError } = await supabaseAdmin
    .from('donations')
    .select('receipt_path, certificate_path')
    .limit(1);
  if (donError) {
    console.log("Donations path columns error:", donError.message);
  } else {
    console.log("Donations path columns exist!");
  }
}

check();
