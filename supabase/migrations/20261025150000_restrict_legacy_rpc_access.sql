-- Trigger functions are invoked by PostgreSQL triggers; clients must not call them as RPCs.
REVOKE ALL ON FUNCTION public.sync_trip_available_seats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_trip_available_seats() TO service_role;

-- Cached-seat decrement is obsolete: availability is recalculated from bookings. Prevent clients from arbitrarily decrementing it.
REVOKE ALL ON FUNCTION public.decrement_available_seats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_available_seats(uuid) TO service_role;

-- Replace the old SECURITY DEFINER trip search with a schema-qualified, RLS-respecting query.
CREATE OR REPLACE FUNCTION public.get_available_trips(search_origin text, search_destination text)
RETURNS SETOF public.trips
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT t.*
    FROM public.trips AS t
   WHERE lower(COALESCE(t.origin_branch, t.route_from)) = lower(search_origin)
     AND lower(COALESCE(t.destination_branch, t.route_to)) = lower(search_destination)
     AND lower(t.status) = 'scheduled'
     AND (
       CASE
         WHEN t.departure_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           THEN (COALESCE(t.travel_date, t.date) + t.departure_time::time) > (now() + interval '10 minutes')
         ELSE COALESCE(t.travel_date, t.date)::timestamp > (now() + interval '10 minutes')
       END
     )
   ORDER BY COALESCE(t.travel_date, t.date), t.departure_time;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_trips(text, text) TO anon, authenticated;
