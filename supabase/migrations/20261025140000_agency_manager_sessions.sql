CREATE TABLE IF NOT EXISTS public.agency_manager_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES public.agency_managers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agency_manager_sessions_manager_expiry_idx
  ON public.agency_manager_sessions (manager_id, expires_at);
ALTER TABLE public.agency_manager_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agency_manager_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.agency_manager_sessions TO service_role;
