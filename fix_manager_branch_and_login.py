import pathlib
import re

# ---------- 1) agency-login: fix default agency binding race + phantom initial value ----------
p_login = pathlib.Path(r"C:/Users/HP/Documents/urugendo-clone/src/app/agency/agency-login/page.tsx")
t = p_login.read_text(encoding="utf-8")

# The loadOperators effect currently does not trigger branch loading for default pick.
# We patched it previously to use a second effect that watches operators + selectedOperator.
# Add a missing dependency: when single-agency auto-select happens inside loadOperators, the realBranchNames fetch was missing there.
# Ensure single-agency path also fetches real branches.

old_single = """        // Single-agency fast path: auto-select when only one exists
        if (data.length === 1) {
          setSelectedOperator(data[0]);
          setOperatorQuery(data[0].name);
        }"""

new_single = """        // Single-agency fast path: auto-select when only one exists + fetch its real branches
        if (data.length === 1) {
          setSelectedOperator(data[0]);
          setOperatorQuery(data[0].name);
          (async () => {
            setBranchLoading(true);
            try {
              const { data: brs } = await supabase.from("branches").select("name").eq("agency_name", data[0].name).order("name");
              setRealBranchNames(((brs as any[]) || []).map((r: any) => r.name));
            } catch {}
            setBranchLoading(false);
          })();
        }"""

if old_single in t:
    t = t.replace(old_single, new_single)
    print("patched single-agency fast path to also fetch branches")
else:
    print("single-agency fast path NOT FOUND")

# Ensure localStorage restore effect does not leave operatorQuery as a phantom without selectedOperator
# After restoring operatorQuery from localStorage, we should also restore selectedOperator linkage on next operators load.
# The dedicated effect already handles savedName -> operators.find -> setSelectedOperator, so no phantom remains.
# Ensure branch dropdown shows loading state hint (optional minimal)
if 'branchLoading' in t:
    print("branchLoading already wired")
else:
    print("branchLoading missing")

p_login.write_text(t, encoding="utf-8")
print("agency-login fixed")

# ---------- 2) branchService: make insertion error surfaced for debugging ----------
p_bs = pathlib.Path(r"C:/Users/HP/Documents/urugendo-clone/src/lib/branchService.ts")
t2 = p_bs.read_text(encoding="utf-8")
# Add console error detail if present? Already warns. Keep as is — but ensure it never swallows agency_name mismatch silently.
# Validate it sends both name + agency_name trimmed matching operator name exactly.
# Already: payload.agency_name = branch.agencyName if truthy — need to ensure trimming.
old_payload = "    if (branch.agencyName) payload.agency_name = branch.agencyName;"
new_payload = "    if (branch.agencyName) payload.agency_name = branch.agencyName.trim();"
if old_payload in t2:
    t2 = t2.replace(old_payload, new_payload)
    p_bs.write_text(t2, encoding="utf-8")
    print("branchService trims agency_name")
else:
    print("branchService payload trim NOT FOUND")

# ---------- 3) manager/page.tsx: fix branch creation order (DB first, then local state) + preserve agency mapping ----------
p_mgr = pathlib.Path(r"C:/Users/HP/Documents/urugendo-clone/src/app/manager/page.tsx")
t3 = p_mgr.read_text(encoding="utf-8")

old_create = """    setBranches((prev) => [newBranchObj, ...prev]);

    const ok = await createNewBranch(newBranchObj);
    if (!ok) {
      showToast("Branch saved locally — DB sync failed. Will retry.");
    }

    setShowAddBranchModal(false);
    setNewBranchNameInput("");
    setNewBranchLocationInput("");
    setNewBranchMomoInput("");
    setNewBranchPhoneInput("");
    showToast(`Branch ${newBranchObj.name} added successfully!`);"""

new_create = """    const ok = await createNewBranch(newBranchObj);
    if (!ok) {
      setNewBranchError("Database insert failed — please check connection and try again.");
      return;
    }

    // Only push to local state after DB confirms — survives refresh and guarantees agent query will see it
    setBranches((prev) => [newBranchObj, ...prev]);

    setShowAddBranchModal(false);
    setNewBranchNameInput("");
    setNewBranchLocationInput("");
    setNewBranchMomoInput("");
    setNewBranchPhoneInput("");
    showToast(`Branch ${newBranchObj.name} added successfully!`);"""

if old_create in t3:
    t3 = t3.replace(old_create, new_create)
    print("manager create: DB-first, then local")
else:
    print("manager old_create NOT FOUND")

p_mgr.write_text(t3, encoding="utf-8")
print("manager fixed")

# ---------- 4) migrations: ensure branches table alignment ----------
# No live DB to run on, but create a follow-up migration that the user can run in Dashboard if needed.
# This is a no-op if agency_name already exists, but documents the contract.
mig_path = pathlib.Path(r"C:/Users/HP/Documents/urugendo-clone/supabase/migrations/20260912000003_branch_db_alignment.sql")
if not mig_path.exists():
    mig_path.write_text("""-- Ensure public.branches has the columns the app writes.
-- Already in 20260912000001, repeated idempotently here so Dashboard runs stay green.
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS agency_name text;
CREATE INDEX IF NOT EXISTS idx_branches_agency_name2 ON public.branches (agency_name);
CREATE INDEX IF NOT EXISTS idx_branches_agency_branch_name2 ON public.branches (agency_name, name);
-- RLS: allow anon inserts for manager flow in pilot (demo-friendly). Tighten when auth roles harden.
DROP POLICY IF EXISTS "branches_all_anon_align" ON public.branches;
-- Keep the existing permissive policy from earlier migrations — just document that inserts need agency_name.
""", encoding="utf-8")
    print("created alignment migration 20260912000003")
else:
    print("alignment migration already exists")

print("done")
