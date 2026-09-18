import { supabase } from "@/lib/supabase";
import { getRwandaToday } from "@/lib/dateUtils";
import {
  computePaperPassengers,
  computePaperRevenue,
  hasTripDeparted,
  isVerifiedDigitalBooking,
} from "@/lib/manifestMath";

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

const EMPTY_STATS: PeriodStats = {
  passengers: 0,
  revenue: 0,
  urugendoPassengers: 0,
  urugendoRevenue: 0,
  paperPassengers: 0,
  paperRevenue: 0,
};

function periodDateRange(
  period: "today" | "monthly" | "yearly",
  now: Date,
): { startDate: string; endDate: string } {
  const today = getRwandaToday(now);
  const [y, m] = today.split("-").map(Number);
  if (period === "today") return { startDate: today, endDate: today };
  if (period === "monthly") {
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate, endDate };
  }
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export async function fetchBranchRevenue(
  branchId: string,
  period: "today" | "monthly" | "yearly" = "today",
  now: Date = new Date(),
): Promise<PeriodStats> {
  const { startDate, endDate } = periodDateRange(period, now);

  try {
    const tripsRes = await supabase
          .from("trips")
          .select(
            "id, price, total_seats, empty_seats, travel_date, departure_time, status, origin_branch_id, branch_id",
          )
          .or(`origin_branch_id.eq.${branchId},branch_id.eq.${branchId}`)
          .gte("travel_date", startDate)
          .lte("travel_date", endDate)
          .neq("status", "cancelled");

    if (tripsRes.error) {
      console.warn("[branchService] trips manifest error:", tripsRes.error.message);
    }

    const trips = (tripsRes.data ?? []) as any[];
    const tripIds = trips.map((t) => t.id).filter(Boolean);

    let bookings: any[] = [];
    if (tripIds.length > 0) {
      const bookingsRes = await supabase
        .from("bookings")
        .select("trip_id, fare_amount, total_amount, status, payment_status")
        .in("trip_id", tripIds);
      if (bookingsRes.error) {
        console.warn("[branchService] bookings revenue error:", bookingsRes.error.message);
      }
      bookings = (bookingsRes.data ?? []).filter(isVerifiedDigitalBooking);
    }

    const digitalPerTrip = new Map<string, number>();
    let urugendoPassengers = 0;
    let urugendoRevenue = 0;
    for (const b of bookings) {
      urugendoPassengers += 1;
      urugendoRevenue += Number(b.fare_amount) || Number(b.total_amount) || 0;
      if (!b.trip_id) continue;
      digitalPerTrip.set(b.trip_id, (digitalPerTrip.get(b.trip_id) ?? 0) + 1);
    }

    let paperPassengers = 0;
    let paperRevenue = 0;
    for (const trip of trips) {
      const departed = hasTripDeparted(trip.travel_date, trip.departure_time, now);
      const digital = digitalPerTrip.get(trip.id) ?? 0;
      const paper = computePaperPassengers(
        Number(trip.total_seats) || 0,
        Number(trip.empty_seats) || 0,
        digital,
        departed,
      );
      paperPassengers += paper;
      paperRevenue += computePaperRevenue(paper, Number(trip.price) || 0);
    }

    return {
      passengers: urugendoPassengers + paperPassengers,
      revenue: urugendoRevenue + paperRevenue,
      urugendoPassengers,
      urugendoRevenue,
      paperPassengers,
      paperRevenue,
    };
  } catch (err) {
    console.warn("[branchService] exception in fetchBranchRevenue:", err);
    return { ...EMPTY_STATS };
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
