// Founder auth — fully isolated from manager/agent/passenger.
// Table: founder_admins (service_role only). Client never touches it directly.
// Verification goes through supabase/functions/v1/founder-auth (service_role).
// Uses supabase.functions.invoke so apikey/Authorization headers are injected
// automatically on both localhost and production — avoids 401s from raw fetch.

import { supabase } from "./supabase";

export interface FounderSession {
  id: string;
  email: string;
  name: string;
}

const FOUNDER_SESSION_KEY = "urugendo_founder_session";

export async function authenticateFounder(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; founder: FounderSession } | { ok: false; reason: string }> {
  if (!input.email?.trim() || !input.password) {
    return { ok: false, reason: "missing_fields" };
  }
  try {
    const { data, error } = await supabase.functions.invoke("founder-auth", {
      body: { email: input.email.trim().toLowerCase(), password: input.password },
    });
    if (error) {
      const msg = (error as any)?.context?.reason || (data as any)?.reason;
      if (msg) return { ok: false, reason: String(msg) };
      // Network / function-not-deployed fallbacks
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      if (status === 401) return { ok: false, reason: "bad_password" };
      if (status === 404) return { ok: false, reason: "not_found" };
      return { ok: false, reason: "network_error" };
    }
    const body: any = data;
    if (body?.ok && body?.founder) return { ok: true, founder: body.founder as FounderSession };
    return { ok: false, reason: String(body?.reason || "bad_password") };
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
  try {
    const { data, error } = await supabase.functions.invoke("founder-auth", {
      body: {
        action: "update_password",
        email: input.email.trim().toLowerCase(),
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
    });
    if (error) {
      const msg = (error as any)?.context?.reason || (data as any)?.reason;
      if (msg) return { ok: false, reason: String(msg) };
      return { ok: false, reason: "update_failed" };
    }
    const body: any = data;
    if (body?.ok) return { ok: true };
    return { ok: false, reason: String(body?.reason || "update_failed") };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export function persistFounderSession(f: FounderSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOUNDER_SESSION_KEY, JSON.stringify(f));
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
