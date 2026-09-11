-- Prevent double-booking the same seat on the same trip
-- Only active bookings (not rejected/cancelled) are considered unique
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_trip_seat_active
ON public.bookings (trip_id, seat_label)
WHERE status NOT IN ('rejected', 'cancelled');

-- Atomic RPC for decrementing available_seats (concurrency-safe, single row lock)
CREATE OR REPLACE FUNCTION public.decrement_available_seats(p_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.trips
     SET available_seats = GREATEST(0, available_seats - 1)
   WHERE id = p_trip_id
     AND available_seats > 0;
END; $$;

GRANT EXECUTE ON FUNCTION public.decrement_available_seats(uuid) TO anon, authenticated;
