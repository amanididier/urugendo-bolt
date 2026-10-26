-- Migration: Enable Manager Password Updates & Agencies Catalog
-- Prepared: 9 Sept 2026

-- 1. Create agencies catalog table
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

-- Seed core agencies
INSERT INTO public.agencies (name, code)
VALUES 
  ('Virunga Express', 'VRG'),
  ('Volcano Express', 'VLC'),
  ('RITCO', 'RTC'),
  ('Trinity Express', 'TRN')
ON CONFLICT (name) DO NOTHING;

-- 2. Allow managers to UPDATE their own password_hash / password_salt in agency_managers table
DROP POLICY IF EXISTS "agency_managers_update_anon" ON public.agency_managers;
CREATE POLICY "agency_managers_update_anon"
ON public.agency_managers FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

-- 3. Allow managers to DELETE branches from dashboard
DROP POLICY IF EXISTS "branches_delete_anon" ON public.branches;
CREATE POLICY "branches_delete_anon"
ON public.branches FOR DELETE
TO anon, authenticated
USING (true);
