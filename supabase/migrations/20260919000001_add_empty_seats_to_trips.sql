/*
# Trip-level empty seats

## Changes
- Adds `empty_seats` (int, NOT NULL, default 0) to public.trips.
  Agents record the number of unoccupied seats per departed bus from the
  Departed manifest tab. Paper-ticket passengers are derived as
  total_seats - empty_seats - digital bookings.
- Index on (origin_branch_id, travel_date) to keep the per-branch manifest
  revenue aggregation fast.
*/

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS empty_seats int NOT NULL DEFAULT 0;

UPDATE public.trips SET empty_seats = 0 WHERE empty_seats IS NULL;

CREATE INDEX IF NOT EXISTS idx_trips_origin_branch_travel_date
  ON public.trips (origin_branch_id, travel_date);
