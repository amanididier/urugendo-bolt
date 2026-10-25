DROP POLICY IF EXISTS agency_agents_register_pending ON public.agency_agents;
CREATE POLICY agency_agents_register_pending
  ON public.agency_agents FOR INSERT TO anon, authenticated
  WITH CHECK (
    COALESCE(is_approved, false) = false
    AND lower(COALESCE(status, 'pending')) = 'pending'
    AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.operators o
      JOIN public.branches b ON lower(b.agency_name) = lower(o.name)
      WHERE lower(o.name) = lower(COALESCE(agency_agents.agency_name, ''))
        AND (
          lower(b.name) = lower(COALESCE(agency_agents.branch_name, ''))
          OR lower(COALESCE(b.location, '')) = lower(COALESCE(agency_agents.branch_name, ''))
        )
    )
  );