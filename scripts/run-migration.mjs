import fs from 'fs';

const sql = fs.readFileSync('supabase/migration_content_moderation.sql', 'utf8');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'gdxyasxnksgwmpzkclec';

// Use the Supabase SQL endpoint (available on hosted projects)
const endpoints = [
  `https://${projectRef}.supabase.co/rest/v1/rpc/`,
  `https://${projectRef}.supabase.co/sql`,
];

// Smart split: handle $$ blocks
const stmts = [];
let current = '';
let inDollarBlock = false;
for (const line of sql.split('\n')) {
  if (line.trim().startsWith('--') && !inDollarBlock && current.trim() === '') continue;
  current += line + '\n';
  const dollarCount = (line.match(/\$\$/g) || []).length;
  if (dollarCount % 2 === 1) inDollarBlock = !inDollarBlock;
  if (!inDollarBlock && line.trim().endsWith(';')) {
    const cleaned = current.replace(/--[^\n]*/g, '').trim();
    if (cleaned && cleaned !== ';') {
      stmts.push(current.trim());
    }
    current = '';
  }
}

console.log(`Parsed ${stmts.length} SQL statements`);

// Execute each statement via the Supabase management API
let ok = 0, fail = 0;
for (let i = 0; i < stmts.length; i++) {
  const stmt = stmts[i];
  try {
    // Try using fetch to Supabase SQL API
    const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'X-Supabase-Raw-Query': 'true',
      },
      body: stmt,
    });
    // Just track results
    ok++;
  } catch (err) {
    fail++;
    console.log(`Statement ${i+1} error:`, err.message);
  }
}

console.log('Approach 1 done. Now trying direct SQL via management API...');

// Alternative: use the management API with access token
const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (mgmtRes.ok) {
  console.log('Management API migration succeeded');
  const data = await mgmtRes.json();
  console.log(JSON.stringify(data).substring(0, 200));
} else {
  console.log('Management API failed:', mgmtRes.status, await mgmtRes.text().then(t => t.substring(0, 300)));
  console.log('\n=== MANUAL STEP REQUIRED ===');
  console.log('Please run the migration manually:');
  console.log('1. Go to https://supabase.com/dashboard/project/gdxyasxnksgwmpzkclec/sql');
  console.log('2. Paste the contents of supabase/migration_content_moderation.sql');
  console.log('3. Click "Run"');
}
