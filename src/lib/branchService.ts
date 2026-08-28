import { supabase } from "@/lib/supabase";

export interface PeriodStats {
  passengers: number;
  revenue: number;
}

export interface BranchRecord {
  id: string;
  name: string;
  location: string;
  momoCode: string;
  phone: string;
  agentName: string;
  agentEmail: string;
  stats: Record<"today" | "monthly" | "yearly", PeriodStats>;
}

/**
 * Fetch all agency branches from Supabase database
 */
export async function fetchAgencyBranches(): Promise<BranchRecord[]> {
  try {
    const { data, error } = await supabase.from("branches").select("*");
    if (error || !data) {
      console.warn("[branchService] error fetching branches:", error);
      return [];
    }

    return data.map((b: any) => ({
      id: b.id,
      name: b.name,
      location: b.location,
      momoCode: b.momo_code,
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

/**
 * Fetch dynamic revenue for a specific branch ID by checking real transaction logs
 */
export async function fetchBranchRevenue(
  branchId: string,
): Promise<PeriodStats> {
  try {
    // Query actual bookings/transactions table linked to branch_id if available
    const { data, error } = await supabase
      .from("bookings")
      .select("fare_amount, created_at")
      .eq("branch_id", branchId);

    if (error || !data) {
      return { passengers: 0, revenue: 0 };
    }

    const passengers = data.length;
    const revenue = data.reduce(
      (sum, item) => sum + (Number(item.fare_amount) || 0),
      0,
    );

    return { passengers, revenue };
  } catch {
    return { passengers: 0, revenue: 0 };
  }
}

/**
 * Insert or register a brand new branch dynamically into Supabase
 */
export async function createNewBranch(branch: BranchRecord): Promise<boolean> {
  try {
    const { error } = await supabase.from("branches").insert({
      id: branch.id,
      name: branch.name,
      location: branch.location,
      momo_code: branch.momoCode,
      phone: branch.phone,
      agent_name: branch.agentName,
      agent_email: branch.agentEmail,
      stats: branch.stats,
    });

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
