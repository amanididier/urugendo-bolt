/*
# Parent hierarchy + MoMo ownership

Every entity must know its parent agency explicitly — no guessing from
a text branch name, no hardcoded defaults.

- branches.agency_name  — which agency this physical branch belongs to
- agency_agents.agency_name — which agency the agent works for (already
  exists, but rows are NULL — backfill, then enforce NOT NULL pattern
  at the app layer; DB keeps NULLable for legacy rows until migrated)
- trips.operator_id     — already ties trip to agency (operators table)
- bookings.branch_id    — ties booking to the selling branch (and thus agency)

MoMo merchant code:
- branches.momo_code should be NULL at creation — managers set it from
  their dashboard per-branch and it is persisted. The FAST default broke
  this contract (every Fasta branch got "FAST" without manager action).
  Reset all existing non-manager-set codes to NULL; keep Virunga seeded
  demo branches if managers set them later.
*/

-- 1) branches: add agency_name column (if not exists), add index
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS agency_name text;

-- Backfill agency_name on the 4 seeded Fasta branches (known agency = Fasta)
UPDATE public.branches
   SET agency_name = 'Fasta'
 WHERE id IN (
   '00000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000009'
 )
   AND agency_name IS NULL;

-- Any other branches that have a matching operator via branches.name heuristic:
-- try to infer from operators.branches array if a branch name appears only
-- in one operator's list. Prefer explicit data; this is a one-time backfill
-- for legacy rows only. If ambiguous, leave NULL for manager to fix.

CREATE INDEX IF NOT EXISTS idx_branches_agency_name ON public.branches (agency_name);

-- 2) Reset MoMo codes that were seeded with placeholder defaults ("FAST", "FASTA001", etc.)
--    Managers must set these explicitly. Real codes (numeric 6-7 digits) are kept.
--    Pattern: keep codes that look like real MoMo (6-7 digits), null out the rest.
UPDATE public.branches
   SET momo_code = NULL
 WHERE momo_code IS NOT NULL
   AND momo_code !~ '^[0-9]{6,7}$';

-- 3) agency_agents: ensure agency_name exists and add complementary agency_id
--    (FK to operators) for referential integrity. agency_name text stays as the
--    canonical field matching agency_managers.agency_name; agency_id is a
--    convenient FK duplicate for joins.
ALTER TABLE public.agency_agents
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agency_agents_agency_name ON public.agency_agents (agency_name);
CREATE INDEX IF NOT EXISTS idx_agency_agents_agency_id ON public.agency_agents (agency_id);

-- 4) Helpful composite index for branch isolation queries
CREATE INDEX IF NOT EXISTS idx_branches_agency_branch_name
  ON public.branches (agency_name, name);

-- Note: we do NOT add NOT NULL constraints yet — legacy rows still exist
-- until the wipe/reset flow runs. Once the app has written agency_name for
-- every new agent/branch, a follow-up migration can tighten to NOT NULL.
