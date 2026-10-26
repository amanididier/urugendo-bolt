/*
# Align agency_agents with app schema — fixes 400s on agency_agents lookups

Required schema per task:
  agency_agents (
    id uuid PK,
    name text,
    email text UNIQUE,
    branch_name text,
    phone text,
    is_approved boolean,
    branch_id uuid FK → branches(id),
    agency_name text,
    status text
  )

The base 20260907120001_create_missing_tables.sql only created
(id, name, email, branch_name, phone, is_approved, status).
branch_id existed via 9b but agency_name was missing, so any
query that selects/filters on agency_name or branch_id 400s with
"column does not exist" before this migration (app fallback handles it,
this makes it permanent).

Idempotent — safe to run even if columns already exist.
*/

ALTER TABLE public.agency_agents
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agency_name text;

CREATE INDEX IF NOT EXISTS idx_agency_agents_branch_id ON public.agency_agents (branch_id);
CREATE INDEX IF NOT EXISTS idx_agency_agents_agency_name ON public.agency_agents (agency_name);
CREATE INDEX IF NOT EXISTS idx_agency_agents_phone ON public.agency_agents (phone);
CREATE INDEX IF NOT EXISTS idx_agency_agents_email ON public.agency_agents (email);
CREATE INDEX IF NOT EXISTS idx_agency_agents_status ON public.agency_agents (status);
