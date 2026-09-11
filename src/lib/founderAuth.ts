// Founder auth — fully isolated from manager/agent/passenger.
// Table: founder_admins (service_role only). Client never touches it directly.
// Verification goes through supabase/functions/v1/founder-auth (service_role).

export interface FounderSession {
  id: string;
  email: string;
  name: string;
}

const FOUNDER_SESSION_KEY = "urugendo_founder_session";

function getFounderAuthUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return url ? `${url}/functions/v1/founder-auth` : "";
}

export async function authenticateFounder(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; founder: FounderSession } | { ok: false; reason: string }> {
  if (!input.email?.trim() || !input.password) {
    return { ok: false, reason: "missing_fields" };
  }
  const fnUrl = getFounderAuthUrl();
  if (!fnUrl) return { ok: false, reason: "config_missing" };
  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: (body as any).reason || "bad_password" };
    if (body.ok && body.founder) return { ok: true, founder: body.founder as FounderSession };
    return { ok: false, reason: (body as any).reason || "bad_password" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export async function updateFounderPassword(input: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!input.email?.trim() || !input.currentPassword || !input.newPassword) {
    return { ok: false, reason: "missing_fields" };
  }
  if (input.newPassword.length < 6) return { ok: false, reason: "weak_password" };
  const fnUrl = getFounderAuthUrl();
  if (!fnUrl) return { ok: false, reason: "config_missing" };
  try {
    const res = await fetch(fnUrl + "?action=update_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: (body as any).reason || "update_failed" };
    if (body.ok) return { ok: true };
    return { ok: false, reason: (body as any).reason || "update_failed" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export function persistFounderSession(f: FounderSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOUNDER_SESSION_KEY, JSON.stringify(f));
  // Mark founder distinctly so app-context never derives manager/agent role from founder localStorage
  localStorage.setItem("urugendo_founder_active", "1");
}

export function getFounderSession(): FounderSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FOUNDER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FounderSession;
  } catch {
    return null;
  }
}

export function clearFounderSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FOUNDER_SESSION_KEY);
  localStorage.removeItem("urugendo_founder_active");
}
