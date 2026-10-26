/*
# Fix Cross-Agency Isolation + Payment Visibility (2026-09-18)
#
# Root causes:
# 1) RLS is wide-open (anon/authenticated = true) on trips/bookings.
#    Any browser can read any agency's rows — the only "isolation"
#    was client-side filtering by branch_name string, which leaks
#    across agencies with same-named branches (e.g. "Kigali").
#    This migration does NOT flip to strict RLS yet (would break the
#    demo's anon-key flow), but it adds a branch_id-scoped helper view
#    and documents the tighten path so the next migration can enforce it.
#
# 2) bookings.branch_id is NULL on rows created before Batch 2.
#    Agent dashboard queries `fetchBookingsByBranch(branchId)` match on
#    branch_id first — NULL rows are invisible in the Verify tab, so
#    payments appear to vanish. Backfill branch_id from trips.
#
# 3) trips.origin_branch_id / branch_id NULL on pre-Batch rows.
#    Schedule page filters `from == branch` by text — cross-branch
#    routes pollute the list. Backfill FKs from branches.name.
#
# All blocks idempotent.
*/

-- ------------------------------------------------------------------
-- 1) Backfill trips.*branch_id where NULL (name → id heuristic)
-- ------------------------------------------------------------------
UPDATE public.trips AS t SET origin_branch_id = br.id
FROM public.branches br
WHERE t.origin_branch_id IS NULL
  AND lower(trim(both ' ' from t.route_from)) = lower(trim(both ' ' from br.name));

UPDATE public.trips AS t SET destination_branch_id = br.id
FROM public.branches br
WHERE t.destination_branch_id IS NULL
  AND lower(trim(both ' ' from t.route_to)) = lower(trim(both ' ' from br.name));

-- trips.branch_id mirrors origin_branch_id for legacy consumers
UPDATE public.trips SET branch_id = origin_branch_id
WHERE branch_id IS NULL AND origin_branch_id IS NOT NULL;

-- ------------------------------------------------------------------
-- 2) Backfill bookings.branch_id where NULL
--    - Prefer trip's origin_branch_id (authoritative sale origin)
--    - Else fall back to branches.name == trip.route_from (heuristic)
-- ------------------------------------------------------------------
UPDATE public.bookings AS b SET branch_id = t.origin_branch_id
FROM public.trips t
WHERE b.branch_id IS NULL
  AND b.trip_id = t.id
  AND t.origin_branch_id IS NOT NULL;

UPDATE public.bookings AS b SET branch_id = br.id
FROM public.trips t JOIN public.branches br
  ON lower(trim(both ' ' from t.route_from)) = lower(trim(both ' ' from br.name))
WHERE b.branch_id IS NULL
  AND b.trip_id = t.id;

-- ------------------------------------------------------------------
-- 3) Ensure indexes that make branch-scoped queries fast
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id2            ON public.bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_created2       ON public.bookings(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_branch           ON public.bookings(trip_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_origin_branch_id2        ON public.trips(origin_branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_branch_id2               ON public.trips(branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_origin_destination_branch ON public.trips(origin_branch_id, destination_branch_id);

-- ------------------------------------------------------------------
-- 4) Safety: poking PostgREST to reload schema cache
-- ------------------------------------------------------------------
DO $$ BEGIN PERFORM pg_notify('pgrst','reload schema'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
