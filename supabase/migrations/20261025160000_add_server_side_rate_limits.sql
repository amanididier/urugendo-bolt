CREATE TABLE IF NOT EXISTS public.security_rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  subject_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_rate_limit_events_lookup_idx
  ON public.security_rate_limit_events (bucket, subject_hash, created_at DESC);
ALTER TABLE public.security_rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_rate_limit_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.security_rate_limit_events TO service_role;
ALTER FUNCTION public.decrement_available_seats(uuid) SET search_path = '';
