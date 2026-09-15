-- Migration for Batch 7: Database indexes for high-frequency filter & join columns
-- Prepared: 9 Sept 2026

-- Index on trips.branch_id and trips (date, origin_branch_id)
CREATE INDEX IF NOT EXISTS idx_trips_branch_id ON public.trips (branch_id);
CREATE INDEX IF NOT EXISTS idx_trips_date_origin ON public.trips (date, origin_branch_id);

-- Index on bookings.user_id (for My Tickets queries)
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);

-- Index on bookings.branch_id (for branch isolation & revenue aggregations)
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON public.bookings (branch_id);

-- Index on bookings.trip_id (for trip manifests & passenger count lookups)
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings (trip_id);

-- Index on agency_agents.user_id (for agent session lookup)
CREATE INDEX IF NOT EXISTS idx_agency_agents_user_id ON public.agency_agents (user_id);
