/*
# Batch 5: Create agency_managers table with the canonical manager record

## Context
The manager app needs DB-backed authentication. The previous flow used a
hardcoded email constant in src/app/agency/agency-login/page.tsx and never
verified the password — anyone who typed the right email was admitted.

## Manual provisioning model
Agency managers are created by the Urugendo development team via SQL or
migrations. Agents sign up via the public registration form and are then
approved by the manager from their dashboard. This table enforces the
manager half of that trust chain.

## Password storage
The password is stored as a PBKDF2-SHA512 hash (100,000 iterations) with a
fixed app-wide salt. The matching JS verifier lives in
src/lib/managerAuth.ts — it recomputes the hash from the user-typed
password and compares it constant-time to the stored value.

Pre-computed for canonical manager: "manager@123" →
  +Bv9Vw4uf+5e2GlcKwWSkkDwsRDFnYvlJzjE6XieAsUDnx6UdNX9k2DkoJY9u7tSCYZS64/kQcdkkhMSKSkN+w==

## Canonical record
- name:           Amani Ishimwe Didier
- email:          manager@virunga.com
- manager_code:   MGR-001
- agency_name:    Virunga Express
- password_hash:  <see above>
*/

-- =========================================================================
-- 1. Create the table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.agency_managers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text UNIQUE NOT NULL,
  manager_code    text UNIQUE NOT NULL,
  agency_name     text NOT NULL,
  password_hash   text NOT NULL,
  password_salt   text NOT NULL,
  password_iter   int  NOT NULL DEFAULT 100000,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_managers ENABLE ROW LEVEL SECURITY;

-- RLS: anyone (anon + authenticated) can SELECT the active manager rows
-- so the login form can verify email + code + password against the DB.
-- The password_hash column is server-side only in the real world; here we
-- accept the demo trade-off of returning the hash to the client and
-- verifying on the client (see src/lib/managerAuth.ts).
DROP POLICY IF EXISTS "agency_managers_select_anon" ON public.agency_managers;
CREATE POLICY "agency_managers_select_anon"
ON public.agency_managers FOR SELECT
TO anon, authenticated USING (true);

-- INSERT/UPDATE/DELETE are restricted to the service_role key (i.e. our
-- SQL migration) so untrusted clients cannot mint new managers.
DROP POLICY IF EXISTS "agency_managers_no_write" ON public.agency_managers;
CREATE POLICY "agency_managers_no_write"
ON public.agency_managers FOR ALL
TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_agency_managers_email
  ON public.agency_managers (email);
CREATE INDEX IF NOT EXISTS idx_agency_managers_code
  ON public.agency_managers (manager_code);

-- =========================================================================
-- 2. Seed the canonical manager record
-- =========================================================================
-- Hash is PBKDF2-SHA512 of "manager@123" with salt
-- "urugendo-manager-v1-salt", 100000 iterations, 64-byte output,
-- base64-encoded. If you change the salt or iterations in
-- src/lib/managerAuth.ts, recompute this hash and update the row.
INSERT INTO public.agency_managers (
  name, email, manager_code, agency_name,
  password_hash, password_salt, password_iter
)
VALUES (
  'Amani Ishimwe Didier',
  'manager@virunga.com',
  'MGR-001',
  'Virunga Express',
  '+Bv9Vw4uf+5e2GlcKwWSkkDwsRDFnYvlJzjE6XieAsUDnx6UdNX9k2DkoJY9u7tSCYZS64/kQcdkkhMSKSkN+w==',
  'urugendo-manager-v1-salt',
  100000
)
ON CONFLICT (email) DO UPDATE
  SET name          = EXCLUDED.name,
      manager_code  = EXCLUDED.manager_code,
      agency_name   = EXCLUDED.agency_name,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      password_iter = EXCLUDED.password_iter,
      updated_at    = now();
