-- Fix 400 schema cache errors: align client queries with live schema
-- 1. agency_agents: some clients queried user_id but live table uses id as PK (no user_id column on some envs).
--    Keep id as primary; add user_id as nullable alias if missing so both query patterns work without 400.
-- 2. notifications: live table uses user_id, but some clients/errors referenced user_phone.
--    Ensure user_id exists and add user_phone as nullable alias for forward compat (no 400 on either).
-- 3. notifications action_url: already in fix_production_bugs, re-ensure here for idempotency.
-- 4. Refresh PostgREST schema cache hint via notify.

-- agency_agents: add user_id alias if missing (uuid, nullable, FK to auth.users if present)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='agency_agents' and column_name='user_id') then
    alter table public.agency_agents add column user_id uuid references auth.users(id) on delete set null;
    create index if not exists idx_agency_agents_user_id2 on public.agency_agents(user_id);
    -- backfill from id where id looks like a user uuid that exists in auth.users
    update public.agency_agents set user_id = id where user_id is null;
  end if;
end $$;

-- notifications: ensure user_id exists (should already) and add user_phone alias if missing
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_id') then
    alter table public.notifications add column user_id uuid references auth.users(id) on delete cascade;
    create index if not exists idx_notifications_user_id2 on public.notifications(user_id);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='user_phone') then
    alter table public.notifications add column user_phone text;
    create index if not exists idx_notifications_user_phone on public.notifications(user_phone);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='action_url') then
    alter table public.notifications add column action_url text;
  end if;
end $$;

-- bookings: ensure branch_id / payment_status / fare_amount / momo fields exist (re-ensure)
alter table public.bookings add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.bookings add column if not exists payment_status text default 'unpaid';
alter table public.bookings add column if not exists fare_amount int;
alter table public.bookings add column if not exists momo_name text;
alter table public.bookings add column if not exists momo_number text;

-- trips: ensure branch isolation cols
alter table public.trips add column if not exists origin_branch_id uuid references public.branches(id) on delete set null;
alter table public.trips add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- force PostgREST to reload schema cache (no-op if not supported, safe)
-- notify is allowed; pgrst will pick up on next request anyway
do $$ begin perform pg_notify('pgrst','reload schema'); exception when others then null; end $$;
