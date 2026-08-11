/*
# Urugendo Core Schema

Creates the foundational tables for the bus booking PWA.

## New Tables
1. profiles — extends auth.users with role (passenger/agent/driver/admin), phone, name, points, rating
2. operators — bus companies (Volcano, RITCO, Trinity, Virunga)
3. buses — individual buses with plate number, seats, amenities
4. trips — scheduled departures with route, times, price, status
5. bookings — passenger seat reservations with boarding code
6. payments — MTN MoMo / Airtel transaction records

## Security (RLS)
- profiles: authenticated users read all (needed for driver/agent manifests), update only own
- operators, buses, trips: all authenticated can read; only agent/admin can write
- bookings: users read/manage own; agents/drivers/admins read all (for manifests)
- payments: users read own; agents/admins read all

## Notes
- Multi-user app with sign-in. Owner columns default to auth.uid().
- Role-based write access via current_user_role() helper.
- All policies scoped TO authenticated.
*/

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'agent', 'driver', 'admin')),
  points int NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 5,
  total_trips int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. operators
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  emoji text NOT NULL DEFAULT '🚌',
  gradient text NOT NULL DEFAULT 'linear-gradient(135deg, #00B85C, #007A3D)',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- 3. buses
CREATE TABLE IF NOT EXISTS public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  plate_number text UNIQUE NOT NULL,
  total_seats int NOT NULL DEFAULT 36,
  amenities text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;

-- 4. trips
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  route_from text NOT NULL,
  route_to text NOT NULL,
  terminal_from text NOT NULL DEFAULT '',
  terminal_to text NOT NULL DEFAULT '',
  departure_time text NOT NULL,
  arrival_time text NOT NULL,
  duration text NOT NULL DEFAULT '',
  travel_date date NOT NULL,
  price int NOT NULL,
  total_seats int NOT NULL DEFAULT 36,
  available_seats int NOT NULL DEFAULT 36,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- 5. bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_label text NOT NULL,
  passenger_name text NOT NULL DEFAULT '',
  passenger_phone text NOT NULL DEFAULT '',
  short_code text NOT NULL,
  payment_method text NOT NULL DEFAULT 'MTN MoMo',
  total_amount int NOT NULL,
  booking_fee int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'boarded', 'expired', 'past', 'cancelled')),
  booking_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6. payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mtn', 'airtel')),
  phone_number text NOT NULL,
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  provider_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role (must come after profiles table exists, before policies)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Now the policies (function exists so references resolve)

-- profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
ON public.profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- operators policies
DROP POLICY IF EXISTS "operators_select_all" ON public.operators;
CREATE POLICY "operators_select_all"
ON public.operators FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "operators_insert_agent" ON public.operators;
CREATE POLICY "operators_insert_agent"
ON public.operators FOR INSERT
TO authenticated WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "operators_update_agent" ON public.operators;
CREATE POLICY "operators_update_agent"
ON public.operators FOR UPDATE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin')) WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "operators_delete_agent" ON public.operators;
CREATE POLICY "operators_delete_agent"
ON public.operators FOR DELETE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin'));

-- buses policies
DROP POLICY IF EXISTS "buses_select_all" ON public.buses;
CREATE POLICY "buses_select_all"
ON public.buses FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "buses_insert_agent" ON public.buses;
CREATE POLICY "buses_insert_agent"
ON public.buses FOR INSERT
TO authenticated WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "buses_update_agent" ON public.buses;
CREATE POLICY "buses_update_agent"
ON public.buses FOR UPDATE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin')) WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "buses_delete_agent" ON public.buses;
CREATE POLICY "buses_delete_agent"
ON public.buses FOR DELETE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin'));

-- trips policies
DROP POLICY IF EXISTS "trips_select_all" ON public.trips;
CREATE POLICY "trips_select_all"
ON public.trips FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "trips_insert_agent" ON public.trips;
CREATE POLICY "trips_insert_agent"
ON public.trips FOR INSERT
TO authenticated WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "trips_update_agent_or_driver" ON public.trips;
CREATE POLICY "trips_update_agent_or_driver"
ON public.trips FOR UPDATE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin', 'driver')) WITH CHECK (public.current_user_role() IN ('agent', 'admin', 'driver'));

DROP POLICY IF EXISTS "trips_delete_agent" ON public.trips;
CREATE POLICY "trips_delete_agent"
ON public.trips FOR DELETE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin'));

-- bookings policies
DROP POLICY IF EXISTS "bookings_select_own_or_staff" ON public.bookings;
CREATE POLICY "bookings_select_own_or_staff"
ON public.bookings FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.current_user_role() IN ('agent', 'admin', 'driver'));

DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
CREATE POLICY "bookings_insert_own"
ON public.bookings FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_update_own_or_staff" ON public.bookings;
CREATE POLICY "bookings_update_own_or_staff"
ON public.bookings FOR UPDATE
TO authenticated USING (auth.uid() = user_id OR public.current_user_role() IN ('agent', 'admin', 'driver')) WITH CHECK (auth.uid() = user_id OR public.current_user_role() IN ('agent', 'admin', 'driver'));

DROP POLICY IF EXISTS "bookings_delete_own" ON public.bookings;
CREATE POLICY "bookings_delete_own"
ON public.bookings FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- payments policies
DROP POLICY IF EXISTS "payments_select_own_or_agent" ON public.payments;
CREATE POLICY "payments_select_own_or_agent"
ON public.payments FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.current_user_role() IN ('agent', 'admin'));

DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
CREATE POLICY "payments_insert_own"
ON public.payments FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payments_update_agent" ON public.payments;
CREATE POLICY "payments_update_agent"
ON public.payments FOR UPDATE
TO authenticated USING (public.current_user_role() IN ('agent', 'admin')) WITH CHECK (public.current_user_role() IN ('agent', 'admin'));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trips_route ON public.trips (route_from, route_to, travel_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON public.bookings (trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments (booking_id);

-- Seed initial operators
INSERT INTO public.operators (name, emoji, gradient) VALUES
  ('Volcano Express', '🌋', 'linear-gradient(135deg, #FF5C1A, #FF3D00)'),
  ('RITCO', '🚌', 'linear-gradient(135deg, #00B85C, #007A3D)'),
  ('Trinity Express', '🚐', 'linear-gradient(135deg, #3B82F6, #1D4ED8)'),
  ('Virunga Express', '🏔️', 'linear-gradient(135deg, #A855F7, #7C3AED)')
ON CONFLICT (name) DO NOTHING;
