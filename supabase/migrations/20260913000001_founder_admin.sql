/*
# Founder backdoor — isolated from every user/manager/agent table

- Table `founder_admins` is NOT joined to profiles/agency_managers/agency_agents.
- RLS: anon + authenticated cannot SELECT/INSERT/UPDATE/DELETE directly. Only
  service_role (Edge Function + manual SQL) can. This guarantees no client
  can enumerate or write founder rows, even if they discover the URL.
- Password stored as PBKDF2-SHA512 100k + app-wide founder salt (same scheme as
  managerAuth.ts but different salt so a leaked manager salt is useless).
- Seed: ishimwemanid@gmail.com / developer@urugendo
  salt = urugendo-founder-v1-salt, iter=100000
  hash computed with Python hashlib.pbkdf2_hmac('sha512', b'developer@urugendo', b'urugendo-founder-v1-salt', 100000, 64) -> base64
*/

CREATE TABLE IF NOT EXISTS public.founder_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL DEFAULT 'Founder',
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_iter int  NOT NULL DEFAULT 100000,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.founder_admins ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access at all — table is invisible to clients.
DROP POLICY IF EXISTS "founder_admins_no_anon" ON public.founder_admins;
CREATE POLICY "founder_admins_no_anon"
ON public.founder_admins FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_founder_admins_email ON public.founder_admins (email);

-- Seed founder (id pinned so wipe script can keep it)
INSERT INTO public.founder_admins (id, email, name, password_hash, password_salt, password_iter)
VALUES (
  '00000000-0000-0000-0000-0000000000f1',
  'ishimwemanid@gmail.com',
  'Amani',
  'kgiKwpZjTMh3KGeMo5TJnXhT1LlgjpF4j7u5GxX+hVRS4I4O3Dy0h+6EG9GFBaeFlcyy78oxULkqPsmiTFwi1Q==',
  'urugendo-founder-v1-salt',
  100000
)
ON CONFLICT (email) DO UPDATE
  SET name          = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      password_iter = EXCLUDED.password_iter,
      updated_at    = now();
