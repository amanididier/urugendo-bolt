-- WIPE for zero-test: keep only Virunga & Fasta + their managers
-- Run this SECOND, after the hierarchy migration has been applied.
-- Order matters due to FKs.

DELETE FROM public.notifications;
DELETE FROM public.payments;
DELETE FROM public.bookings;
DELETE FROM public.trips;
DELETE FROM public.buses;
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users WHERE email IN ('manager@virunga.com','manager@fasta.com'));
-- agency_agents: delete all demo agents (keep none — agents re-register from zero)
DELETE FROM public.agency_agents;
-- branches: delete all except the 4 seeded Fasta branches (they will get agency_name=Fasta + momo NULL)
DELETE FROM public.branches WHERE id NOT IN (
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000009'
);
-- Also ensure Virunga seed branches exist as operator.branches array, not rows — nothing to keep there.
-- operators: keep only Virunga Express + Fasta
DELETE FROM public.operators WHERE name NOT IN ('Virunga Express','Fasta');
-- agency_managers: keep only the 2 seeded managers
DELETE FROM public.agency_managers WHERE email NOT IN ('manager@virunga.com','manager@fasta.com');
-- routes: clear demo routes
DELETE FROM public.routes;

-- Verify
SELECT 'operators' as tbl, count(*) FROM public.operators
UNION ALL SELECT 'agency_managers', count(*) FROM public.agency_managers
UNION ALL SELECT 'branches', count(*) FROM public.branches
UNION ALL SELECT 'agency_agents', count(*) FROM public.agency_agents
UNION ALL SELECT 'trips', count(*) FROM public.trips
UNION ALL SELECT 'bookings', count(*) FROM public.bookings
UNION ALL SELECT 'buses', count(*) FROM public.buses
UNION ALL SELECT 'routes', count(*) FROM public.routes;
