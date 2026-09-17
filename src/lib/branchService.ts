import { supabase } from "@/lib/supabase";

export interface PeriodStats {
  passengers: number;
  revenue: number;
  urugendoPassengers?: number;
  urugendoRevenue?: number;
  paperPassengers?: number;
  paperRevenue?: number;
}

export function agencyPrefix(agencyName: string): string {
  const a = (agencyName || "").trim().toLowerCase();
  if (a.includes("fasta")) return "FAS";
  if (a.includes("virunga")) return "VIR";
  if (a.includes("volcano")) return "VOL";
  if (a.includes("ritco")) return "RIT";
  if (a.includes("trinity")) return "TRI";
  const clean = agencyName.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (clean.length >= 3) return clean.slice(0, 3);
  return (clean + "XXX").slice(0, 3);
}

export function nextStationCode(
  agencyName: string,
  existingCodes: string[],
): string {
  const prefix = agencyPrefix(agencyName);
  let max = 0;
  for (const c of existingCodes) {
    const m = c?.toUpperCase().match(new RegExp(`^${prefix}-(\\d{3})$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = String(max + 1).padStart(3, "0");
  return `${prefix}-${n}`;
}

export interface BranchRecord {
  id: string;
  name: string;
  location: string;
  agencyName?: string | null;
  stationCode?: string | null;
  momoCode: string | null;
  phone: string;
  agentName: string;
  agentEmail: string;
  stats: Record<"today" | "monthly" | "yearly", PeriodStats>;
}

export async function fetchAgencyBranches(agencyName?: string): Promise<BranchRecord[]> {
  try {
    let query = supabase.from("branches").select("id, name, location, agency_name, station_code, momo_code, phone, agent_name, agent_email, stats");
    if (agencyName) query = query.eq("agency_name", agencyName);
    const { data, error } = await query;
    if (error || !data) {
      console.warn("[branchService] error fetching branches:", error);
      return [];
    }

    return data.map((b: any) => ({
      id: b.id,
      name: b.name,
      location: b.location,
      agencyName: b.agency_name ?? null,
      stationCode: b.station_code ?? null,
      momoCode: b.momo_code ?? null,
      phone: b.phone,
      agentName: b.agent_name,
      agentEmail: b.agent_email,
      stats: b.stats || {
        today: { passengers: 0, revenue: 0 },
        monthly: { passengers: 0, revenue: 0 },
        yearly: { passengers: 0, revenue: 0 },
      },
    }));
  } catch (err) {
    console.warn("[branchService] exception in fetchAgencyBranches:", err);
    return [];
  }
}

export async function fetchBranchRevenue(
  branchId: string,
  period: "today" | "monthly" | "yearly" = "today",
  now: Date = new Date(),
): Promise<PeriodStats> {
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("fare_amount, created_at, status, payment_status, is_paper_ticket")
      .eq("branch_id", branchId)
      .gte("created_at", start.toISOString())
      .or("payment_status.eq.verified,status.eq.confirmed");

    if (error || !data) {
      return { passengers: 0, revenue: 0, urugendoPassengers: 0, urugendoRevenue: 0, paperPassengers: 0, paperRevenue: 0 };
    }

    const urugendoBookings = data.filter((b) => !b.is_paper_ticket);
    const paperBookings = data.filter((b) => b.is_paper_ticket);

    const urugendoPassengers = urugendoBookings.length;
    const urugendoRevenue = urugendoBookings.reduce((sum, item) => sum + (Number(item.fare_amount) || 0), 0);

    const paperPassengers = paperBookings.length;
    const paperRevenue = paperBookings.reduce((sum, item) => sum + (Number(item.fare_amount) || 0), 0);

    const passengers = urugendoPassengers + paperPassengers;
    const revenue = urugendoRevenue + paperRevenue;

    return {
      passengers,
      revenue,
      urugendoPassengers,
      urugendoRevenue,
      paperPassengers,
      paperRevenue,
    };
  } catch {
    return { passengers: 0, revenue: 0, urugendoPassengers: 0, urugendoRevenue: 0, paperPassengers: 0, paperRevenue: 0 };
  }
}

export async function createNewBranch(branch: BranchRecord): Promise<boolean> {
  try {
    const payload: Record<string, any> = {
      id: branch.id,
      name: branch.name,
      location: branch.location,
      momo_code: branch.momoCode ?? null,
      phone: branch.phone,
      agent_name: branch.agentName,
      agent_email: branch.agentEmail,
      stats: branch.stats,
    };
    if (branch.agencyName) payload.agency_name = branch.agencyName;
    if (branch.stationCode) payload.station_code = branch.stationCode.toUpperCase().trim();
    const { error } = await supabase.from("branches").insert(payload);

    if (error) {
      console.warn("[branchService] error creating branch:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[branchService] exception creating branch:", err);
    return false;
  }
}

export async function deleteBranch(branchId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("branches").delete().eq("id", branchId);
    if (error) {
      console.warn("[branchService] error deleting branch:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[branchService] exception deleting branch:", err);
    return false;
  }
}

export async function updateManagerPassword(
  managerId: string,
  currentPass: string,
  newPass: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: mgr, error } = await supabase
      .from("agency_managers")
      .select("id, password_hash")
      .eq("id", managerId)
      .maybeSingle();

    if (error || !mgr) {
      return { ok: false, message: "Manager account not found." };
    }

    if (mgr.password_hash && mgr.password_hash !== currentPass) {
      return { ok: false, message: "Current master password is incorrect." };
    }

    const { error: updateErr } = await supabase
      .from("agency_managers")
      .update({ password_hash: newPass })
      .eq("id", managerId);

    if (updateErr) {
      return { ok: false, message: updateErr.message };
    }

    return { ok: true, message: "Password updated successfully." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to update password." };
  }
}
