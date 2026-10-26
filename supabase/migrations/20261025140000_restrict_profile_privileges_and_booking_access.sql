-- Prevent client-controlled profile privilege escalation.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, email, phone, branch) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, email, phone, branch) ON TABLE public.profiles TO authenticated;

-- Only approved agents/checkers may read or update agency bookings.
DROP POLICY IF EXISTS bookings_select_owner_or_staff ON public.bookings;
CREATE POLICY bookings_select_owner_or_staff ON public.bookings
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss']::text[])
        AND p.operator_id IS NOT NULL
        AND p.operator_id = bookings.agency_id
        AND (
          p.role NOT IN ('agent','checker','ticket_checker')
          OR EXISTS (
            SELECT 1 FROM public.agency_agents a
            WHERE lower(a.email) = lower(p.email)
              AND a.is_approved = true
              AND a.status = 'approved'
          )
        )
    )
  );

DROP POLICY IF EXISTS bookings_update_staff_only ON public.bookings;
CREATE POLICY bookings_update_staff_only ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss']::text[])
        AND p.operator_id IS NOT NULL
        AND p.operator_id = bookings.agency_id
        AND (
          p.role NOT IN ('agent','checker','ticket_checker')
          OR EXISTS (
            SELECT 1 FROM public.agency_agents a
            WHERE lower(a.email) = lower(p.email)
              AND a.is_approved = true
              AND a.status = 'approved'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['agent','checker','ticket_checker','manager','branch_manager','boss','agency_boss']::text[])
        AND p.operator_id IS NOT NULL
        AND p.operator_id = bookings.agency_id
        AND (
          p.role NOT IN ('agent','checker','ticket_checker')
          OR EXISTS (
            SELECT 1 FROM public.agency_agents a
            WHERE lower(a.email) = lower(p.email)
              AND a.is_approved = true
              AND a.status = 'approved'
          )
        )
    )
  );