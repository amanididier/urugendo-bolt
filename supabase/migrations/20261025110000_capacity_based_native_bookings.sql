-- Capacity-based passenger bookings for the native app.
-- No seat map: each booking reserves passenger_count seats against the
-- total_seats value entered by an agency manager when scheduling the trip.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS passenger_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_passenger_count_positive;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_passenger_count_positive CHECK (passenger_count >= 1 AND passenger_count <= 50);

CREATE OR REPLACE FUNCTION public.create_passenger_booking(
  p_trip_id uuid,
  p_passenger_name text,
  p_passenger_phone text,
  p_passenger_count integer,
  p_total_amount integer,
  p_momo_name text,
  p_momo_number text,
  p_booking_code text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trip public.trips%ROWTYPE;
  v_reserved integer;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before booking a trip' USING ERRCODE = '28000';
  END IF;
  IF p_passenger_count IS NULL OR p_passenger_count < 1 OR p_passenger_count > 50 THEN
    RAISE EXCEPTION 'Passenger count must be between 1 and 50' USING ERRCODE = '22023';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION 'Invalid booking amount' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_trip.status IN ('cancelled', 'departed', 'arrived') THEN
    RAISE EXCEPTION 'Trip is no longer accepting bookings' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(GREATEST(COALESCE(passenger_count, 1), 1)), 0)::integer
    INTO v_reserved
    FROM public.bookings
   WHERE trip_id = p_trip_id
     AND status NOT IN ('rejected', 'cancelled', 'expired', 'past');

  IF v_reserved + p_passenger_count > COALESCE(v_trip.total_seats, 0) THEN
    RAISE EXCEPTION 'Only % seats remain', GREATEST(COALESCE(v_trip.total_seats, 0) - v_reserved, 0)
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.bookings (
    trip_id, user_id, seat_label, passenger_name, passenger_phone,
    short_code, booking_code, total_amount, fare_amount, booking_fee,
    status, payment_status, payment_method, booking_date,
    momo_name, momo_number, passenger_count, branch_id, agency_branch
  ) VALUES (
    p_trip_id, v_user_id, 'AUTO-' || p_booking_code, p_passenger_name, p_passenger_phone,
    p_booking_code, p_booking_code, p_total_amount, p_total_amount, 0,
    'pending', 'pending', 'MTN MoMo', CURRENT_DATE,
    NULLIF(p_momo_name, ''), p_momo_number, p_passenger_count,
    COALESCE(v_trip.origin_branch_id, v_trip.branch_id), COALESCE(v_trip.route_from, '')
  )
  RETURNING * INTO v_booking;

  UPDATE public.trips
     SET available_seats = GREATEST(COALESCE(total_seats, 0) - v_reserved - p_passenger_count, 0)
   WHERE id = p_trip_id;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_passenger_booking(uuid, text, text, integer, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_passenger_booking(uuid, text, text, integer, integer, text, text, text) TO authenticated;
