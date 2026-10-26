-- Security hardening for shared PWA/native backend.
-- Public trip discovery remains available through trips_public_read; all trip writes require manager policies.
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Agent accounts may self-register as pending only. Approval and updates are server-side manager actions.
DROP POLICY IF EXISTS "Enable read/write for agency_agents" ON public.agency_agents;
CREATE POLICY agency_agents_register_pending
  ON public.agency_agents FOR INSERT TO anon, authenticated
  WITH CHECK (
    COALESCE(is_approved, false) = false
    AND lower(COALESCE(status, 'pending')) = 'pending'
    AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  );
CREATE POLICY agency_agents_select_self
  ON public.agency_agents FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR lower(email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
  );

-- Manager password hashes/codes are read only by the server-side manager-auth function.
DROP POLICY IF EXISTS "Allow public read access for manager login verification" ON public.agency_managers;

-- Passenger bookings use atomic capacity RPCs; seat-number edits are not part of the booking flow.
DROP POLICY IF EXISTS "seats_update_any_authenticated" ON public.seats;

-- Use ownership-specific notification policies rather than unrestricted anon/authenticated access.
DROP POLICY IF EXISTS "notifications_all_anon" ON public.notifications;
