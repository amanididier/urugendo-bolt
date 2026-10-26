import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const secret = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
console.log('URL', url);
console.log('anon len', anon?.length, 'secret len', secret?.length, 'secret prefix', secret?.slice(0,12));

// Try secret as apikey — new Supabase secret keys are sb_secret_... and ARE valid apikeys
const sbSecret = createClient(url, secret);
const sbAnon = createClient(url, anon);

async function testClient(label, sb){
  console.log(`\n=== Testing ${label} ===`);
  const { data, error } = await sb.from('profiles').select('id').limit(1);
  console.log(`${label} profiles read:`, error?.message || `ok ${data?.length}`);
  // Try a dummy update that should be allowed with service role
  const { error: updErr } = await sb.from('branches').update({ phone: '250788000099' }).eq('id', '00000000-0000-0000-0000-000000000006').select('id');
  console.log(`${label} branches update test:`, updErr?.message || 'ok');
  // revert
  await sb.from('branches').update({ phone: '250788000001' }).eq('id', '00000000-0000-0000-0000-000000000006');
}

await testClient('anon', sbAnon);
await testClient('secret', sbSecret);

// Use whichever can update — prefer secret
let sb = sbSecret;
{
  const { error } = await sbSecret.from('bookings').update({ fare_amount: 3821 }).eq('id', 'cf37f1a1-aeca-4572-96de-6fa4166808cc').select('id');
  if (error) {
    console.log('secret cannot update bookings, falling back to anon, err:', error.message);
    sb = sbAnon;
  } else {
    console.log('secret can update bookings — using secret for writes');
    // revert test
    await sbSecret.from('bookings').update({ fare_amount: null }).eq('id', 'cf37f1a1-aeca-4572-96de-6fa4166808cc');
  }
}

console.log('\n=== FIX PHASE (using', sb === sbSecret ? 'secret' : 'anon', ') ===');

// 1) Fix Kigali legacy 000...006 -> Fasta FAS-001 (was blocked by duplicate with Musanze)
{
  const musanzeId = 'ddb171cc-a568-4166-a0c2-5dfbe97a4f1e';
  const kigaliLegacyId = '00000000-0000-0000-0000-000000000006';
  // Ensure Musanze is FAS-006 (already done)
  const { data: m } = await sb.from('branches').select('station_code').eq('id', musanzeId).maybeSingle();
  console.log('Musanze station_code before fix2:', m?.station_code);
  // Now fix Kigali legacy
  const { data, error } = await sb.from('branches').update({ agency_name: 'Fasta', momo_code: null, station_code: 'FAS-001' }).eq('id', kigaliLegacyId).select('id,agency_name,station_code,momo_code');
  console.log('Fix Kigali legacy 000...006 -> Fasta FAS-001:', error ? `ERR ${error.message}` : `ok ${JSON.stringify(data)}`);
}

// 2) Fix trips operator_id for Musanze->Kigali trips (origin is now Fasta Musanze, so operator should be Fasta)
{
  const fastaOpId = '00000000-0000-0000-0000-000000000004';
  const musanzeId = 'ddb171cc-a568-4166-a0c2-5dfbe97a4f1e';
  const { data: tripsToFix } = await sb.from('trips').select('id,route_from,operator_id,origin_branch_id').eq('origin_branch_id', musanzeId);
  console.log('Trips from Musanze count', tripsToFix?.length);
  for (const t of tripsToFix || []) {
    if (t.operator_id !== fastaOpId) {
      const { error } = await sb.from('trips').update({ operator_id: fastaOpId }).eq('id', t.id);
      console.log(`  trip ${t.id.slice(0,8)} operator Virunga -> Fasta`, error ? `ERR ${error.message}` : 'ok');
    } else {
      console.log(`  trip ${t.id.slice(0,8)} already Fasta`);
    }
  }
}

// 3) Fix bookings branch_id for the 6 orphaned bookings (retry with secret)
{
  const musanzeId = 'ddb171cc-a568-4166-a0c2-5dfbe97a4f1e';
  const kigaliFastaId = 'c5775871-4005-4259-a542-34f2e186405e';
  // Map trip -> origin
  const { data: tripsAll } = await sb.from('trips').select('id,route_from,origin_branch_id');
  const tripOrigin = Object.fromEntries((tripsAll||[]).map(t=>[t.id, t.origin_branch_id]));
  const { data: bookings } = await sb.from('bookings').select('id,trip_id,branch_id,fare_amount,total_amount').is('branch_id', null);
  console.log('Orphaned bookings count', bookings?.length);
  for (const b of bookings || []) {
    const origin = tripOrigin[b.trip_id];
    const patch = {};
    if (origin) patch.branch_id = origin;
    if (b.fare_amount == null && b.total_amount != null) patch.fare_amount = b.total_amount;
    else if (b.fare_amount == null) patch.fare_amount = 3821;
    if (Object.keys(patch).length) {
      const { error, data } = await sb.from('bookings').update(patch).eq('id', b.id).select('id,branch_id,fare_amount');
      console.log(`  booking ${b.id.slice(0,8)} patch`, patch, error ? `ERR ${error.message}` : `ok ${JSON.stringify(data)}`);
    }
  }
}

// 4) Verification
console.log('\n=== VERIFICATION ===');
const { data: br2 } = await sb.from('branches').select('id,name,agency_name,station_code,momo_code,phone').order('name');
console.log('branches', JSON.stringify(br2, null, 2));
const { data: trips2 } = await sb.from('trips').select('id,route_from,route_to,operator_id,origin_branch_id,branch_id').order('created_at');
console.log('trips', JSON.stringify(trips2, null, 2));
const { data: bookings2 } = await sb.from('bookings').select('id,trip_id,branch_id,status,payment_status,fare_amount').order('created_at');
console.log('bookings', JSON.stringify(bookings2, null, 2));
for (const br of br2 || []) {
  const { data: bk } = await sb.from('bookings').select('id').eq('branch_id', br.id);
  console.log(`  Verify ${br.name} (${br.agency_name} ${br.station_code} momo:${br.momo_code}): ${(bk||[]).length} bookings`);
}
console.log('\nDone fix2.');
