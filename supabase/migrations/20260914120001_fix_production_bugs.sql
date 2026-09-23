/*
# Production Bugfix — 2026-09-14
# Fixes 400s, notification schema drift, branch isolation, booking/bus wiring

1) bookings: ensure all columns referenced by src/lib/api.ts exist
   - seat_id (some code paths query/insert it, but core schema only had seat_label)
   - booking_code, fare_amount, payment_status, branch_id already added earlier — ensure again
   - momo_name, momo_number already added — ensure again
   - Relax NOT NULL on legacy columns so dual-write (short_code+booking_code, total_amount+fare_amount) never 400s
   - Add total_amount + short_code defaults if missing

2) notifications: ensure action_url exists (PGRST204 fix, idempotent)
   - Some deployments never ran the full 20260907120001 block
   - Adding IF NOT EXISTS keeps production safe, and allows notifyUser to send action_url

3) trips: ensure origin_branch_id / destination_branch_id / branch_id exist
   - Used for strict branch isolation — if missing, queries filter in app falls back to text

4) Helpful indexes for branch-isolated queries
*/

-- =============================================================================
-- 1) bookings: missing columns + nullable relaxation
-- =============================================================================
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS seat_id uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_code text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS fare_amount int;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','submitted','verified','failed'));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS momo_name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS momo_number text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
-- legacy aliases already in core, ensure they exist for older DBs that were wiped
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_amount int;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_fee int DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'MTN MoMo';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_date date DEFAULT CURRENT_DATE;

-- Relax NOT NULL on legacy columns so we can dual-write without ordering issues.
-- Safe to re-run: only executes if column is currently NOT NULL.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='short_code' AND is_nullable='NO') THEN
    ALTER TABLE public.bookings ALTER COLUMN short_code DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='total_amount' AND is_nullable='NO') THEN
    ALTER TABLE public.bookings ALTER COLUMN total_amount DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='seat_label' AND is_nullable='NO') THEN
    ALTER TABLE public.bookings ALTER COLUMN seat_label DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='booking_date' AND is_nullable='NO') THEN
    ALTER TABLE public.bookings ALTER COLUMN booking_date DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON public.bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_created ON public.bookings(branch_id, created_at);

-- =============================================================================
-- 2) notifications: action_url
-- =============================================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url text;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- =============================================================================
-- 3) trips: branch isolation columns
-- =============================================================================
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS origin_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS destination_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_origin_branch_id ON public.trips(origin_branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_branch_id ON public.trips(branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_date_origin ON public.trips(date, origin_branch_id);

-- =============================================================================
-- 4) Backfill origin_branch_id where possible (heuristic: match route_from to branches.name)
-- =============================================================================
UPDATE public.trips AS t SET origin_branch_id = br.id
FROM public.branches AS br
WHERE t.origin_branch_id IS NULL AND lower(t.route_from) = lower(br.name);

UPDATE public.trips AS t SET destination_branch_id = br.id
FROM public.branches AS br
WHERE t.destination_branch_id IS NULL AND lower(t.route_to) = lower(br.name);

-- Backfill bookings.branch_id from trips.origin_branch_id where bookings.branch_id is null
UPDATE public.bookings AS b SET branch_id = t.origin_branch_id
FROM public.trips AS t
WHERE b.branch_id IS NULL AND b.trip_id = t.id AND t.origin_branch_id IS NOT NULL;
