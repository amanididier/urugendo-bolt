-- Secure public checkout without exposing booking rows to anonymous clients.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_guest_token_hash_unique
  ON public.bookings (guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;

-- Guest booking is called only by the trusted Edge Function using service_role.
CREATE OR REPLACE FUNCTION public.create_guest_passenger_booking(
  p_trip_id uuid,
  p_passenger_name text,
  p_passenger_phone text,
  p_passenger_count integer,
  p_momo_name text,
  p_momo_number text,
  p_booking_code text,
  p_guest_token_hash text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_reserved integer;
  v_total_amount integer;
  v_booking public.bookings%ROWTYPE;
BEGIN
  IF p_passenger_count IS NULL OR p_passenger_count < 1 OR p_passenger_count > 10 THEN
    RAISE EXCEPTION 'Passenger count must be between 1 and 10' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(trim(p_passenger_name), '') IS NULL
     OR NULLIF(trim(p_passenger_phone), '') IS NULL
     OR NULLIF(trim(p_momo_number), '') IS NULL
     OR NULLIF(trim(p_booking_code), '') IS NULL
     OR p_guest_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid guest checkout details' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002'; END IF;
  IF v_trip.status <> 'scheduled' OR v_trip.travel_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Trip is not accepting bookings' USING ERRCODE = 'P0001';
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

  v_total_amount := round(v_trip.price * p_passenger_count)::integer;
  IF v_total_amount <= 0 THEN RAISE EXCEPTION 'Trip fare is invalid' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.bookings (
    trip_id, user_id, seat_label, passenger_name, passenger_phone,
    short_code, booking_code, total_amount, fare_amount, booking_fee,
    status, payment_status, payment_method, booking_date,
    momo_name, momo_number, passenger_count, branch_id, agency_id, agency_branch, guest_token_hash
  ) VALUES (
    p_trip_id, NULL, 'AUTO-' || p_booking_code, trim(p_passenger_name), trim(p_passenger_phone),
    p_booking_code, p_booking_code, v_total_amount, v_total_amount, 0,
    'pending', 'pending', 'MTN MoMo', CURRENT_DATE,
    NULLIF(trim(p_momo_name), ''), trim(p_momo_number), p_passenger_count,
    COALESCE(v_trip.origin_branch_id, v_trip.branch_id), v_trip.operator_id, COALESCE(v_trip.route_from, ''), p_guest_token_hash
  )
  RETURNING * INTO v_booking;

  UPDATE public.trips
     SET available_seats = GREATEST(COALESCE(total_seats, 0) - v_reserved - p_passenger_count, 0)
   WHERE id = p_trip_id;
  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_passenger_booking(uuid, text, text, integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_guest_passenger_booking(uuid, text, text, integer, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_guest_passenger_booking(uuid, text, text, integer, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_passenger_booking(uuid, text, text, integer, text, text, text, text) TO service_role;

-- Keep cached availability in sync when a reservation is cancelled/rejected/confirmed.
CREATE OR REPLACE FUNCTION public.sync_trip_available_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip_id uuid;
BEGIN
  v_trip_id := COALESCE(NEW.trip_id, OLD.trip_id);
  UPDATE public.trips t
     SET available_seats = GREATEST(
       COALESCE(t.total_seats, 0) - COALESCE((
         SELECT SUM(GREATEST(COALESCE(b.passenger_count, 1), 1))
           FROM public.bookings b
          WHERE b.trip_id = t.id
            AND b.status NOT IN ('rejected', 'cancelled', 'expired', 'past')
       ), 0), 0)
   WHERE t.id = v_trip_id;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_sync_trip_available_seats ON public.bookings;
CREATE TRIGGER bookings_sync_trip_available_seats
AFTER INSERT OR UPDATE OF status, passenger_count, trip_id OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_trip_available_seats();

-- Trips are publicly readable, but only a signed-in manager/boss for the owning operator can write them.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.trips;
DROP POLICY IF EXISTS trips_select_all ON public.trips;
DROP POLICY IF EXISTS trips_insert_agent ON public.trips;
DROP POLICY IF EXISTS trips_update_agent_or_driver ON public.trips;
DROP POLICY IF EXISTS trips_delete_agent ON public.trips;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY trips_public_read ON public.trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY trips_manager_insert ON public.trips FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = trips.operator_id
));
CREATE POLICY trips_manager_update ON public.trips FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = trips.operator_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = trips.operator_id
));
CREATE POLICY trips_manager_delete ON public.trips FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = trips.operator_id
));

-- No anonymous booking reads/inserts. Guest tickets are served by the token-checking Edge Function.
DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow public select on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bookings;
DROP POLICY IF EXISTS "Users insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users see own bookings" ON public.bookings;
DROP POLICY IF EXISTS bookings_delete_own ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_own ON public.bookings;
DROP POLICY IF EXISTS bookings_select_own_or_staff ON public.bookings;
DROP POLICY IF EXISTS bookings_update_own_or_staff ON public.bookings;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_select_owner_or_staff ON public.bookings FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = (SELECT auth.uid())
       AND p.role IN ('agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss')
       AND p.operator_id IS NOT NULL
       AND p.operator_id = bookings.agency_id
  )
);
CREATE POLICY bookings_update_staff_only ON public.bookings FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = bookings.agency_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss')
     AND p.operator_id IS NOT NULL
     AND p.operator_id = bookings.agency_id
));

-- Payment rows can be read by the booking owner or assigned agency staff; only trusted server code writes payments.
DROP POLICY IF EXISTS payments_insert_authenticated ON public.payments;
DROP POLICY IF EXISTS payments_select_authenticated ON public.payments;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select_owner_or_staff ON public.payments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bookings b
   WHERE b.id = payments.booking_id
     AND (
       b.user_id = (SELECT auth.uid())
       OR EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.role IN ('agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss')
            AND p.operator_id IS NOT NULL
            AND p.operator_id = b.agency_id
       )
     )
));

-- Public route/operator/branch discovery remains available; writes require a signed-in manager role.
DROP POLICY IF EXISTS "Allow authenticated/manager insert and update on branches" ON public.branches;
DROP POLICY IF EXISTS "Allow public read access on branches" ON public.branches;
CREATE POLICY branches_public_read ON public.branches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY branches_manager_insert ON public.branches FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p JOIN public.operators o ON o.id = p.operator_id
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND lower(o.name) = lower(branches.agency_name)
));
CREATE POLICY branches_manager_update ON public.branches FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p JOIN public.operators o ON o.id = p.operator_id
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND lower(o.name) = lower(branches.agency_name)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p JOIN public.operators o ON o.id = p.operator_id
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND lower(o.name) = lower(branches.agency_name)
));
DROP POLICY IF EXISTS "Allow public read access on operators" ON public.operators;
DROP POLICY IF EXISTS "Enable insert/update for operators" ON public.operators;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.operators;
DROP POLICY IF EXISTS "Enable read access for all users on operators" ON public.operators;
DROP POLICY IF EXISTS operators_select_all ON public.operators;
CREATE POLICY operators_public_read ON public.operators FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY operators_manager_update ON public.operators FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id = operators.id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid())
     AND p.role IN ('manager','branch_manager','boss','agency_boss')
     AND p.operator_id = operators.id
));
