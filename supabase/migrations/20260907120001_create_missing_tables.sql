/*
# Add Missing Tables and Columns

## Context
Database inspection revealed 4 tables exist in the live Supabase database
but are missing from the migrations folder:
1. branches - agency branch records with MoMo codes
2. agency_agents - station agent registration/approval records
3. routes - pre-defined route catalog (distance, base price, duration)
4. notifications - app notification log

## Issues Found
- profiles table missing columns: email, operator_id, branch, status
- bookings table has columns the migration doesn't define: agency_id,
  momo_number, momo_name, bus_type, agency_branch, empty_seats
- trips table has additional columns: date, amenities, bus_type, plate_number,
  currency, from, to, origin_branch, destination_branch
- payments table: not verified yet

## Security
All new tables follow the same pattern: anon, authenticated can read/write
for the demo state. Tighten when real auth is wired up.
*/

-- =========================================================================
-- 1. profiles: add missing columns used by app
-- =========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- profiles: add policy so anon can read/insert for sign-up flow
DROP POLICY IF EXISTS "profiles_select_all_anon" ON public.profiles;
CREATE POLICY "profiles_select_all_anon"
ON public.profiles FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_anon" ON public.profiles;
CREATE POLICY "profiles_insert_anon"
ON public.profiles FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_anon" ON public.profiles;
CREATE POLICY "profiles_update_anon"
ON public.profiles FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- 2. branches: agency branch records
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  momo_code text,
  phone text,
  agent_name text,
  agent_email text,
  stats jsonb DEFAULT '{"today":{"passengers":0,"revenue":0},"monthly":{"passengers":0,"revenue":0},"yearly":{"passengers":0,"revenue":0}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_all_anon" ON public.branches;
CREATE POLICY "branches_all_anon"
ON public.branches FOR ALL
TO anon, authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- 3. agency_agents: agent sign-up/approval queue
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.agency_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  branch_name text NOT NULL,
  phone text DEFAULT '',
  is_approved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_agents_all_anon" ON public.agency_agents;
CREATE POLICY "agency_agents_all_anon"
ON public.agency_agents FOR ALL
TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agency_agents_email ON public.agency_agents (email);
CREATE INDEX IF NOT EXISTS idx_agency_agents_status ON public.agency_agents (status);

-- =========================================================================
-- 4. routes: route catalog (distance, base price, duration)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city text NOT NULL,
  to_city text NOT NULL,
  distance_km int,
  base_price int NOT NULL,
  duration_minutes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_city, to_city)
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routes_all_anon" ON public.routes;
CREATE POLICY "routes_all_anon"
ON public.routes FOR ALL
TO anon, authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- 5. notifications: app notification log
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general' CHECK (type IN ('verification', 'delay', 'reminder', 'promo', 'general', 'security', 'booking')),
  action_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all_anon" ON public.notifications;
CREATE POLICY "notifications_all_anon"
ON public.notifications FOR ALL
TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, read);

-- =========================================================================
-- 6. trips: add columns the app expects
-- =========================================================================
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bus_type text DEFAULT 'Coaster',
  ADD COLUMN IF NOT EXISTS plate_number text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'RWF',
  ADD COLUMN IF NOT EXISTS "from" text,
  ADD COLUMN IF NOT EXISTS "to" text,
  ADD COLUMN IF NOT EXISTS origin_branch text,
  ADD COLUMN IF NOT EXISTS destination_branch text;

-- =========================================================================
-- 7. bookings: add columns the app expects
-- =========================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_code text,
  ADD COLUMN IF NOT EXISTS fare_amount int,
  ADD COLUMN IF NOT EXISTS momo_number text,
  ADD COLUMN IF NOT EXISTS momo_name text,
  ADD COLUMN IF NOT EXISTS bus_type text,
  ADD COLUMN IF NOT EXISTS agency_branch text,
  ADD COLUMN IF NOT EXISTS empty_seats int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_id uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_code ON public.bookings (booking_code);

-- =========================================================================
-- 8. operators: add branches array column (used by agency login to list
--    selectable branch stations for an operator)
-- =========================================================================
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS branches text[] DEFAULT '{}';
