/*
# Open RLS for anon access and relax bookings.user_id constraint

## Context
The app has a fake login (no real Supabase auth session). All DB calls go through
the anon-key client, but existing RLS policies are scoped to `TO authenticated` only.
This means the anon client gets zero rows from every table and cannot insert/update
bookings — the app silently appears empty. The login page sets a role in localStorage
but never calls supabase.auth.signInWithOtp, so auth.uid() is always null.

## Changes
1. Re-scope ALL existing policies on operators, buses, trips, bookings, and payments
   to `TO anon, authenticated` so the anon-key client can read/write.
2. Booking ownership checks relaxed: since there is no real auth session, the
   `auth.uid() = user_id` check always fails. Policies now allow anon to
   insert/update bookings without ownership enforcement. The `user_id` column
   is kept (nullable) for future auth integration.
3. Drop the NOT NULL constraint on bookings.user_id so inserts without a session
   don't fail. Keep the FK reference for when auth is wired up.
4. profiles table stays authenticated-only (it contains role data that should
   not be public) — not touched here.

## Security implications
- This makes booking/trip/operator/bus/payment data readable and writable by
  anyone with the anon key (which is public in the browser anyway).
- This is acceptable for the current no-auth demo state. When real auth is
  added, these policies should be tightened back to authenticated + ownership.
- profiles is intentionally left authenticated-only to avoid leaking user data.
*/

-- 1. operators: re-scope all policies to anon, authenticated
DROP POLICY IF EXISTS "operators_select_all" ON public.operators;
CREATE POLICY "operators_select_all"
ON public.operators FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "operators_insert_agent" ON public.operators;
CREATE POLICY "operators_insert_agent"
ON public.operators FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "operators_update_agent" ON public.operators;
CREATE POLICY "operators_update_agent"
ON public.operators FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "operators_delete_agent" ON public.operators;
CREATE POLICY "operators_delete_agent"
ON public.operators FOR DELETE
TO anon, authenticated USING (true);

-- 2. buses: re-scope all policies to anon, authenticated
DROP POLICY IF EXISTS "buses_select_all" ON public.buses;
CREATE POLICY "buses_select_all"
ON public.buses FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "buses_insert_agent" ON public.buses;
CREATE POLICY "buses_insert_agent"
ON public.buses FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "buses_update_agent" ON public.buses;
CREATE POLICY "buses_update_agent"
ON public.buses FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "buses_delete_agent" ON public.buses;
CREATE POLICY "buses_delete_agent"
ON public.buses FOR DELETE
TO anon, authenticated USING (true);

-- 3. trips: re-scope all policies to anon, authenticated
DROP POLICY IF EXISTS "trips_select_all" ON public.trips;
CREATE POLICY "trips_select_all"
ON public.trips FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trips_insert_agent" ON public.trips;
CREATE POLICY "trips_insert_agent"
ON public.trips FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "trips_update_agent_or_driver" ON public.trips;
CREATE POLICY "trips_update_agent_or_driver"
ON public.trips FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "trips_delete_agent" ON public.trips;
CREATE POLICY "trips_delete_agent"
ON public.trips FOR DELETE
TO anon, authenticated USING (true);

-- 4. bookings: re-scope all policies to anon, authenticated (no ownership check)
DROP POLICY IF EXISTS "bookings_select_own_or_staff" ON public.bookings;
CREATE POLICY "bookings_select_own_or_staff"
ON public.bookings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
CREATE POLICY "bookings_insert_own"
ON public.bookings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "bookings_update_own_or_staff" ON public.bookings;
CREATE POLICY "bookings_update_own_or_staff"
ON public.bookings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bookings_delete_own" ON public.bookings;
CREATE POLICY "bookings_delete_own"
ON public.bookings FOR DELETE
TO anon, authenticated USING (true);

-- 5. payments: re-scope all policies to anon, authenticated
DROP POLICY IF EXISTS "payments_select_own_or_agent" ON public.payments;
CREATE POLICY "payments_select_own_or_agent"
ON public.payments FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
CREATE POLICY "payments_insert_own"
ON public.payments FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "payments_update_agent" ON public.payments;
CREATE POLICY "payments_update_agent"
ON public.payments FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Relax bookings.user_id: drop NOT NULL so inserts without auth session succeed
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;
