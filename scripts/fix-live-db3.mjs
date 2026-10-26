import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const secret = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, secret);

// Fix Virguna duplicate: delete the empty Virunga Kigali stub, or orphan existing Virunga trips first
// 000...006 Kigali (Fasta FAS-001) is the one we just fixed, and 4537... trips point to it.
// The duplicate is actually the other way: we now have TWO Kigali rows with same name but different agency.
// Virunga trips (Kigali->Musanze) point to 000...006 which is now Fasta — they should point to a real Virunga branch.
// Real Virunga branches only exist in operators.branches array, not as rows. So create a proper Virunga Kigali row?
// Simpler: point Virunga trips to the Fasta Kigali row? No — that leaks agency.
// Best: keep 000...006 as Fasta Kigali FAS-001 (done), create a new Virunga Kigali row for Virunga trips.

console.log('=== Fix Virunga vs Fasta Kigali split ===');
const { data: existing } = await sb.from('branches').select('id,name,agency_name,station_code').ilike('name','Kigali');
console.log('Kigali rows:', existing);

// Create Virunga Kigali branch if not exists
const virungaKigali = existing?.find(r=>r.agency_name==='Virunga Express');
if (!virungaKigali) {
  const newId = '00000000-0000-0000-0000-000000000010';
  const { data, error } = await sb.from('branches').insert({
    id: newId,
    name: 'Kigali',
    location: 'Kigali City',
    agency_name: 'Virunga Express',
    station_code: 'VIR-001',
    momo_code: null,
    phone: '250788000010',
  }).select('id,name,agency_name,station_code');
  console.log('Create Virunga Kigali:', error ? `ERR ${error.message}` : `ok ${JSON.stringify(data)}`);
  if (!error) {
    // Re-point Virunga trips to this new Virunga Kigali
    const { data: vtrips } = await sb.from('trips').select('id').eq('operator_id', '6bff9fbd-8c47-435e-aeca-3b35d82b6057').eq('route_from','Kigali');
    console.log('Virunga Kigali trips to repoint:', vtrips?.length);
    for (const t of vtrips||[]) {
      const { error } = await sb.from('trips').update({ origin_branch_id: newId, branch_id: newId }).eq('id', t.id);
      console.log(`  trip ${t.id.slice(0,8)} -> Virunga Kigali ${newId.slice(0,8)}`, error ? `ERR ${error.message}` : 'ok');
    }
    const { data: vbookings } = await sb.from('bookings').select('id').eq('branch_id', '00000000-0000-0000-0000-000000000006');
    console.log('Bookings on old Fasta Kigali to move to Virunga Kigali:', vbookings?.length);
    for (const b of vbookings||[]) {
      const { error } = await sb.from('bookings').update({ branch_id: newId }).eq('id', b.id);
      console.log(`  booking ${b.id.slice(0,8)} -> Virunga Kigali`, error ? `ERR ${error.message}` : 'ok');
    }
  }
} else {
  console.log('Virunga Kigali already exists:', virungaKigali);
}

// Also create remaining Virunga branches so agency page doesn't show phantom
const virungaNeeded = [
  { id: '00000000-0000-0000-0000-000000000011', name: 'Musanze', station_code: 'VIR-002', phone: '250788000011' },
  { id: '00000000-0000-0000-0000-000000000012', name: 'Rubavu', station_code: 'VIR-003', phone: '250788000012' },
  { id: '00000000-0000-0000-0000-000000000013', name: 'Nyagatare', station_code: 'VIR-004', phone: '250788000013' },
  { id: '00000000-0000-0000-0000-000000000014', name: 'Gicumbi', station_code: 'VIR-005', phone: '250788000014' },
];
for (const br of virungaNeeded) {
  const { data: exists } = await sb.from('branches').select('id').eq('id', br.id).maybeSingle();
  if (exists) { console.log(`Virunga ${br.name} already exists`); continue; }
  // Check by agency+name
  const { data: byName } = await sb.from('branches').select('id').eq('agency_name','Virunga Express').ilike('name', br.name).maybeSingle();
  if (byName) { console.log(`Virunga ${br.name} exists by name ${byName.id.slice(0,8)}`); continue; }
  const { data, error } = await sb.from('branches').insert({ id: br.id, name: br.name, location: `${br.name} District`, agency_name: 'Virunga Express', station_code: br.station_code, momo_code: null, phone: br.phone }).select('id,name,station_code');
  console.log(`Create Virunga ${br.name}:`, error ? `ERR ${error.message}` : `ok ${JSON.stringify(data)}`);
}

// Final verification: Fasta agents must NOT see Virunga bookings and vice versa
console.log('\n=== Final isolation check ===');
const { data: brs } = await sb.from('branches').select('id,name,agency_name,station_code,momo_code').order('agency_name').order('name');
console.log(JSON.stringify(brs, null, 2));
for (const br of brs||[]) {
  const { data: bk } = await sb.from('bookings').select('id,status,payment_status').eq('branch_id', br.id);
  console.log(`  ${br.agency_name} ${br.name} ${br.station_code}: ${(bk||[]).length} bookings`);
}
console.log('Done fix3');
