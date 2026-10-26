/*
# Add station_code to branches — manager security code vs momo_code

- momo_code  = MTN MoMo payment code (finance)
- station_code = security code agents enter at login to prove they belong
  to a specific station (e.g. VIR-001, FAS-002). Needed for multi-station
  cities like Kigali where several branches share one location.

Changes:
1) Add public.branches.station_code text (nullable, backfilled later)
2) Indexes for fast lookup by (agency_name, station_code) and (agency_name, name)
3) Optional unique guard per agency so two stations cannot share the same code.
*/

alter table public.branches
  add column if not exists station_code text;

create index if not exists idx_branches_station_code
  on public.branches (station_code);

create index if not exists idx_branches_agency_branch
  on public.branches (agency_name, name);

-- one code per agency must be unique (allows nulls, multiple agencies can reuse same pattern)
create unique index if not exists uniq_branches_agency_station_code
  on public.branches (agency_name, station_code)
  where station_code is not null;

-- Backfill existing stations so current agents are not locked out.
-- Uses agency prefix (VIR/FAS/VOL/RIT/TRI etc.) + row_number per agency.
-- Safe to re-run: only touches rows where station_code is null.
do $$
declare
  r record;
  pref text;
  seq int;
begin
  for r in
    select id, agency_name,
           row_number() over (partition by agency_name order by created_at, name) as rn
    from public.branches
    where station_code is null
  loop
    pref := case
      when lower(r.agency_name) like '%virunga%' then 'VIR'
      when lower(r.agency_name) like '%fasta%'   then 'FAS'
      when lower(r.agency_name) like '%volcano%' then 'VOL'
      when lower(r.agency_name) like '%ritco%'   then 'RIT'
      when lower(r.agency_name) like '%trinity%' then 'TRI'
      else upper(substring(r.agency_name from 1 for 3))
    end;
    pref := upper(regexp_replace(pref, '[^A-Z]', '', 'g'));
    if length(pref) < 3 then pref := rpad(pref, 3, 'X'); end if;
    pref := substring(pref from 1 for 3);
    seq := r.rn;
    update public.branches
       set station_code = pref || '-' || lpad(seq::text, 3, '0')
     where id = r.id;
  end loop;
end $$;
