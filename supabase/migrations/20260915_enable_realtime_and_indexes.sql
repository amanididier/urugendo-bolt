-- Enable Supabase Realtime on key tables + add missing indexes
-- Run once via Dashboard SQL Editor or supabase db push

-- 1) Add tables to supabase_realtime publication (idempotent)
do $$
begin
  -- publication may already include some tables; try adding each, ignore duplicate
  begin execute 'alter publication supabase_realtime add table public.bookings'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.agency_agents'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.branches'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.trips'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.operators'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.agency_managers'; exception when duplicate_object then null; end;
end $$;

-- 2) Replica identity FULL so UPDATE/DELETE payloads include full row (needed for filtered Realtime)
alter table public.bookings replica identity full;
alter table public.agency_agents replica identity full;
alter table public.branches replica identity full;
alter table public.trips replica identity full;
alter table public.notifications replica identity full;

-- 3) High-frequency lookup indexes (branch isolation + status filters)
create index if not exists idx_bookings_branch_id on public.bookings(branch_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_payment_status2 on public.bookings(payment_status);
create index if not exists idx_bookings_branch_created on public.bookings(branch_id, created_at desc);
create index if not exists idx_bookings_trip_id on public.bookings(trip_id);
create index if not exists idx_agency_agents_status on public.agency_agents(status);
create index if not exists idx_agency_agents_is_approved on public.agency_agents(is_approved);
create index if not exists idx_agency_agents_agency_name on public.agency_agents(agency_name);
create index if not exists idx_branches_agency_name on public.branches(agency_name);
create index if not exists idx_trips_origin_branch on public.trips(origin_branch);
create index if not exists idx_trips_origin_branch_id on public.trips(origin_branch_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);
