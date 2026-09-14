import { supabase } from "@/lib/supabase";

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("250") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("07") && cleaned.length === 10) return "250" + cleaned.slice(1);
  if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("8"))) return "250" + cleaned;
  return null;
}

export interface AgencyAgentRow {
  id: string;
  name: string;
  email: string;
  branch_name: string;
  phone: string;
  is_approved: boolean;
  status: "pending" | "approved" | "rejected";
  branch_id?: string | null;
  agency_name?: string | null;
  created_at?: string;
}

type AuthContext = { email?: string | null; phone?: string | null };

function isMissingColumnError(error: any): boolean {
  const msg = (error?.message || "").toLowerCase();
  return msg.includes("column") && (msg.includes("does not exist") || msg.includes("not found") || msg.includes("schema cache"));
}
function isBadRequest(error: any): boolean {
  const code = String(error?.code || "");
  const status = error?.status || error?.statusCode;
  return code === "400" || status === 400 || isMissingColumnError(error);
}

export async function fetchAgentByEmail(email: string): Promise<{ data: AgencyAgentRow | null; error: any }> {
  if (!email?.trim()) return { data: null, error: null };
  const { data, error } = await supabase.from("agency_agents").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (isBadRequest(error as any)) {
    console.warn("[agencyAgentService] fetchByEmail 400, treating as not found:", (error as any)?.message);
    return { data: null, error: null };
  }
  if (error) console.warn("[agencyAgentService] fetchByEmail error:", (error as any)?.message);
  return { data: data as AgencyAgentRow | null, error };
}

export async function fetchAgentByPhone(phone: string): Promise<{ data: AgencyAgentRow | null; error: any }> {
  const normalized = phone ? normalizePhone(phone) || phone.trim() : "";
  if (!normalized) return { data: null, error: null };
  const variants = [normalized, phone.trim(), normalized.replace(/^250/, "0"), normalized.replace(/^250/, "+250")].filter(Boolean);
  for (const v of Array.from(new Set(variants))) {
    const { data, error } = await supabase.from("agency_agents").select("*").eq("phone", v).maybeSingle();
    if (isBadRequest(error as any)) {
      console.warn("[agencyAgentService] fetchByPhone 400, trying next variant:", (error as any)?.message);
      continue;
    }
    if (error) { console.warn("[agencyAgentService] fetchByPhone error:", (error as any)?.message); continue; }
    if (data) return { data: data as AgencyAgentRow, error: null };
  }
  return { data: null, error: null };
}

export async function fetchAgentByAuth(auth: AuthContext): Promise<AgencyAgentRow | null> {
  if (auth.email) { const { data } = await fetchAgentByEmail(auth.email); if (data) return data; }
  if (auth.phone) { const { data } = await fetchAgentByPhone(auth.phone); if (data) return data; }
  return null;
}
