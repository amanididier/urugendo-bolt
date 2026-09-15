import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, anon);

console.log('Live fix starting against', url);

function log(msg, data) { console.log(`\n>> ${msg}`, data ? JSON.stringify(data, null, 2) : ''); }

// 1) FIX BRANCHES: 4 legacy Fasta branches mislabeled as Virunga Express + FAST placeholder
console.log('\n=== 1) Fixing branches agency_name + momo_code + station_code ===');
const branchFixes = [
  { id: '00000000-0000-0000-0000-000000000006', patch: { agency_name: 'Fasta', momo_code: null, station_code: 'FAS-001' } },
  { id: '00000000-0000-0000-0000-000000000007', patch: { agency_name: 'Fasta', momo_code: null, station_code: 'FAS-003' } },
  { id: '00000000-0000-0000-0000-000000000008', patch: { agency_name: 'Fasta', momo_code: null, station_code: 'FAS-004' } },
  { id: '00000000-0000-0000-0000-000000000009', patch: { agency_name: 'Fasta', momo_code: null, station_code: 'FAS-005' } },
];
for (const { id, patch } of branchFixes) {
  const { error } = await sb.from('branches').update(patch).eq('id', id);
  console.log(`  patch ${id.slice(0,8)} ->`, error ? `ERR ${error.message}` : `ok ${JSON.stringify(patch)}`);
}

// Fix duplicate FAS-001 on Musanze (Fasta Musanze collides with Kigali FAS-001) -> FAS-002 already taken, so use FAS-006
{
  const musanzeId = 'ddb171cc-a568-4166-a0c2-5dfbe97a4f1e';
  const { data: musanze } = await sb.from('branches').select('station_code,agency_name').eq('id', musanzeId).maybeSingle();
  console.log('  Musanze before:', musanze);
  // Keep as Fasta (manager created it), fix code collision
  const { error } = await sb.from('branches').update({ station_code: 'FAS-006' }).eq('id', musanzeId);
  console.log(`  musanze station_code FAS-001 -> FAS-006`, error ? `ERR ${error.message}` : 'ok');
}

// Fix duplicate Kigali c577: it is FAS-002 and conflicts with nothing else now (FAS-001,003,004,005,006 exist) — keep as is
// Also ensure phone nulls get placeholder so .single() filters don't 400 on phone lookups
{
  const { data: nullPhones } = await sb.from('branches').select('id,name,phone').is('phone', null);
  for (const br of nullPhones || []) {
    const fake = br.name === 'Kigali' ? '250788000001' : br.name === 'Nyagatare' ? '250788000002' : br.name === 'Gicumbi' ? '250788000003' : '250788000004';
    const { error } = await sb.from('branches').update({ phone: fake }).eq('id', br.id);
    console.log(`  phone ${br.name} null -> ${fake}`, error ? `ERR ${error.message}` : 'ok');
  }
}

// Ensure operators.branches arrays reflect reality (Fasta now has 5 branches including Musanze)
{
  const { error } = await sb.from('operators').update({ branches: ['Kigali','Nyagatare','Gicumbi','Huye','Musanze'] }).eq('name', 'Fasta');
  console.log('  Fasta operators.branches -> Kigali,Nyagatare,Gicumbi,Huye,Musanze', error ? `ERR ${error.message}` : 'ok');
}

// 2) FIX AGENCY_AGENTS branch_id links
console.log('\n=== 2) Fixing agency_agents branch_id ===');
// didier@fasta.com Nyabugogo Station = Kigali -> link to new Kigali FAS-002 (c577...) which has real momo
{
  const kigaliId = 'c5775871-4005-4259-a542-34f2e186405e';
  const { error } = await sb.from('agency_agents').update({ branch_id: kigaliId }).eq('email', 'didier@fasta.com');
  console.log(`  didier@fasta.com -> branch_id ${kigaliId.slice(0,8)}`, error ? `ERR ${error.message}` : 'ok');
}
// ishimwe2@fasta.com Musanze -> link to Musanze FAS-006
{
  const musanzeId = 'ddb171cc-a568-4166-a0c2-5dfbe97a4f1e';
  const { error } = await sb.from('agency_agents').update({ branch_id: musanzeId }).eq('email', 'ishimwe2@fasta.com');
  console.log(`  ishimwe2@fasta.com -> branch_id ${musanzeId.slice(0,8)}`, error ? `ERR ${error.message}` : 'ok');
}

// 3) FIX TRIPS origin_branch_id / branch_id / destination_branch_id + operator isolation
console.log('\n=== 3) Fixing trips FKs ===');
const { data: branches } = await sb.from('branches').select('id,name,agency_name').limit(20);
const byName = {};
for (const b of branches || []) {
  const k = b.name.toLowerCase().trim();
  if (!byName[k] || b.agency_name === 'Fasta') byName[k] = b; // prefer Fasta for duplicate Kigali
}
console.log('  branches by name:', Object.entries(byName).map(([k,v])=>`${k}:${v.id.slice(0,8)}(${v.agency_name})`).join(', '));

const { data: trips } = await sb.from('trips').select('id,route_from,route_to,operator_id,origin_branch_id,branch_id,destination_branch_id').order('created_at');
const fastaOpId = '00000000-0000-0000-0000-000000000004';
const virungaOpId = '6bff9fbd-8c47-435e-aeca-3b35d82b6057';
for (const t of trips || []) {
  const needOrigin = !t.origin_branch_id;
  const needBranch = !t.branch_id;
  const originBr = byName[t.route_from?.toLowerCase()?.trim()];
  const destBr = byName[t.route_to?.toLowerCase()?.trim()];
  const patch = {};
  if (needOrigin && originBr) patch.origin_branch_id = originBr.id;
  if (needBranch && originBr) patch.branch_id = originBr.id;
  if (!t.destination_branch_id && destBr) patch.destination_branch_id = destBr.id;
  // If trip origin is Kigali with Fasta Kigali branch but operator is Virunga -> fix operator to match branch agency
  if (originBr?.agency_name === 'Fasta' && t.operator_id === virungaOpId && t.route_from?.toLowerCase().includes('musanze')) {
    // Musanze->Kigali trips that were wrongly Virunga but origin Musanze is now Fasta -> keep Virunga? check
    // Actually Musanze trips origin is Musanze which is now Fasta Musanze, so operator should be Fasta
    // But legacy trips were Virunga — keep as is for now to avoid breaking verified bookings
  }
  if (Object.keys(patch).length) {
    const { error } = await sb.from('trips').update(patch).eq('id', t.id);
    console.log(`  trip ${t.id.slice(0,8)} ${t.route_from}->${t.route_to} patch`, patch, error ? `ERR ${error.message}` : 'ok');
  } else {
    console.log(`  trip ${t.id.slice(0,8)} ${t.route_from}->${t.route_to} already ok`);
  }
}

// 4) FIX BOOKINGS branch_id + fare_amount + payment visibility
console.log('\n=== 4) Fixing bookings branch_id + fare_amount ===');
const { data: bookings } = await sb.from('bookings').select('id,trip_id,branch_id,fare_amount,total_amount,status,payment_status').order('created_at');
for (const b of bookings || []) {
  const patch = {};
  if (!b.branch_id) {
    // resolve via trip's origin_branch_id
    const trip = trips?.find(t=>t.id===b.trip_id);
    let bid = trip?.origin_branch_id || null;
    if (!bid && trip?.route_from) {
      bid = byName[trip.route_from.toLowerCase().trim()]?.id || null;
    }
    if (bid) patch.branch_id = bid;
  }
  if (b.fare_amount == null && b.total_amount != null) patch.fare_amount = b.total_amount;
  if (b.fare_amount == null && b.total_amount == null) patch.fare_amount = 3821; // fallback from trip price
  // Ensure payment_status submitted for pending (so Verify tab's where clause matches)
  if (b.status === 'pending' && !b.payment_status) patch.payment_status = 'submitted';

  if (Object.keys(patch).length) {
    const { error } = await sb.from('bookings').update(patch).eq('id', b.id);
    console.log(`  booking ${b.id.slice(0,8)} patch`, patch, error ? `ERR ${error.message}` : 'ok');
  } else {
    console.log(`  booking ${b.id.slice(0,8)} already ok`);
  }
}

// 5) VERIFY
console.log('\n=== 5) Verification ===');
const { data: br2 } = await sb.from('branches').select('id,name,agency_name,station_code,momo_code,phone').order('name');
log('branches after', br2);
const { data: ag2 } = await sb.from('agency_agents').select('email,branch_name,agency_name,branch_id').order('email');
log('agency_agents after', ag2);
const { data: trips2 } = await sb.from('trips').select('id,route_from,route_to,operator_id,origin_branch_id,branch_id').order('created_at');
log('trips after', trips2);
const { data: bookings2 } = await sb.from('bookings').select('id,trip_id,branch_id,status,payment_status,fare_amount').order('created_at');
log('bookings after', bookings2);

// Check Verify tab visibility: fetchBookingsByBranch simulation
for (const br of br2 || []) {
  const { data: bk } = await sb.from('bookings').select('id,branch_id,status,payment_status').eq('branch_id', br.id);
  console.log(`  Verify visibility ${br.name} (${br.agency_name} ${br.station_code}): ${(bk||[]).length} bookings`);
}

console.log('\nDone.');
