// src/lib/managerAuth.ts
//
// Batch 5: DB-backed authentication for agency managers.
//
// Managers are provisioned in the public.agency_managers table.
// Authentication goes through Supabase Edge Function "manager-auth" via
// supabase.functions.invoke so apikey/Authorization headers are injected
// automatically (fixes 401s from raw fetch on both localhost and production).
//
// This module:
//   1. Calls the manager-auth Edge Function via SDK
//   2. Falls back to legacy client-side PBKDF2 only if the function is absent
//   3. Persists a minimal manager session in localStorage
//
// Developers can generate password hashes using the exported
// generateManagerPasswordHash helper for seeding new managers via SQL/migration.

import { supabase } from "./supabase";

export interface ManagerRecord {
  id: string;
  name: string;
  email: string;
  managerCode: string;
  agencyName: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIter: number;
  isActive: boolean;
}

export interface ManagerLoginInput {
  email: string;
  managerCode: string;
  password: string;
  agencyName?: string;
}

export interface ManagerLoginResult {
  ok: boolean;
  reason?:
    | "missing_fields"
    | "not_found"
    | "inactive"
    | "code_mismatch"
    | "agency_mismatch"
    | "bad_password";
  manager?: Omit<ManagerRecord, "passwordHash" | "passwordSalt">;
}

/**
 * Browser-side PBKDF2 via Web Crypto (SHA-512). Returns base64 encoded string.
 * Used only for generating hashes for seeding/management, not for login verification.
 */
export async function pbkdf2(
  password: string,
  salt: string,
  iterations: number = 100000,
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations,
      hash: "SHA-512",
    },
    keyMaterial,
    64 * 8, // 64 bytes
  );
  const bytes = new Uint8Array(bits);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generate password hash and salt for developers to seed new managers into DB.
 */
export async function generateManagerPasswordHash(
  password: string,
  customSalt?: string,
  iterations: number = 100000,
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt =
    customSalt ||
    "urugendo-mgr-" +
      Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

  const hash = await pbkdf2(password, salt, iterations);
  return { hash, salt, iterations };
}

// Constant-time string compare to prevent timing attacks.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Authenticate a manager against the agency_managers table.
 * Uses supabase.functions.invoke so apikey/Authorization are injected automatically.
 */
export async function authenticateManager(
  input: ManagerLoginInput,
): Promise<ManagerLoginResult> {
  if (!input.email?.trim() || !input.managerCode?.trim() || !input.password) {
    return { ok: false, reason: "missing_fields" };
  }

  const email = input.email.trim().toLowerCase();
  const managerCode = input.managerCode.trim();
  const password = input.password;
  const agencyName = input.agencyName?.trim() || undefined;

  try {
    const { data, error } = await supabase.functions.invoke("manager-auth", {
      body: { email, managerCode, password, agencyName },
    });

    if (error) {
      const reason = (data as any)?.reason || (error as any)?.context?.reason;
      if (reason) return { ok: false, reason: reason as ManagerLoginResult["reason"] };
      // If function not deployed / network error, fall back to legacy client path
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      if (status === 404 || !data) {
        console.warn("[managerAuth] Edge Function unavailable, falling back to legacy verify");
        return await authenticateManagerLegacy(input);
      }
      return { ok: false, reason: "bad_password" };
    }

    const body: any = data;
    if (body?.ok && body?.manager) {
      return { ok: true, manager: body.manager as Omit<ManagerRecord, "passwordHash" | "passwordSalt"> };
    }
    return { ok: false, reason: (body?.reason as ManagerLoginResult["reason"]) || "bad_password" };
  } catch (err) {
    console.error("[managerAuth] Edge Function call failed:", err);
    return await authenticateManagerLegacy(input);
  }
}

/**
 * Legacy client-side PBKDF2 verification (fallback only).
 * Deprecated — only used when the Edge Function is not deployed.
 */
async function authenticateManagerLegacy(
  input: ManagerLoginInput,
): Promise<ManagerLoginResult> {
  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("agency_managers")
    .select(
      "id, name, email, manager_code, agency_name, password_hash, password_salt, password_iter, is_active",
    )
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }

  const record: ManagerRecord = {
    id: data.id,
    name: data.name,
    email: data.email,
    managerCode: data.manager_code,
    agencyName: data.agency_name,
    passwordHash: data.password_hash.trim(),
    passwordSalt: data.password_salt,
    passwordIter: data.password_iter || 100000,
    isActive: data.is_active !== false,
  };

  if (!record.isActive) {
    return { ok: false, reason: "inactive" };
  }

  if (
    record.managerCode.trim().toLowerCase() !==
    input.managerCode.trim().toLowerCase()
  ) {
    return { ok: false, reason: "code_mismatch" };
  }

  if (
    input.agencyName &&
    record.agencyName.trim().toLowerCase() !==
      input.agencyName.trim().toLowerCase()
  ) {
    return { ok: false, reason: "agency_mismatch" };
  }

  const computed = await pbkdf2(
    input.password,
    record.passwordSalt,
    record.passwordIter,
  );

  if (!constantTimeEqual(computed, record.passwordHash)) {
    return { ok: false, reason: "bad_password" };
  }

  const { passwordHash, passwordSalt, ...safe } = record;
  void passwordHash;
  void passwordSalt;
  return { ok: true, manager: safe };
}

/**
 * Update manager password securely.
 * This uses the legacy client-side path for now; consider migrating to an Edge Function.
 */
export async function updateManagerPassword(
  managerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  if (!currentPassword || !newPassword) {
    return { ok: false, message: "Current and new password are required." };
  }
  if (newPassword.length < 6) {
    return { ok: false, message: "New password must be at least 6 characters." };
  }

  const { data, error } = await supabase
    .from("agency_managers")
    .select("password_hash, password_salt, password_iter")
    .eq("id", managerId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Manager account record not found." };
  }

  const computedCurrent = await pbkdf2(
    currentPassword,
    data.password_salt,
    data.password_iter || 100000,
  );

  if (!constantTimeEqual(computedCurrent, data.password_hash.trim())) {
    return { ok: false, message: "Current password is incorrect." };
  }

  const newSalt =
    "urugendo-mgr-" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const newIter = 100000;
  const newHash = await pbkdf2(newPassword, newSalt, newIter);

  const { error: updateError } = await supabase
    .from("agency_managers")
    .update({
      password_hash: newHash,
      password_salt: newSalt,
      password_iter: newIter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", managerId);

  if (updateError) {
    console.warn("[managerAuth] password update error:", updateError);
    return { ok: false, message: "Database update failed. Please try again." };
  }

  return { ok: true, message: "Password updated successfully!" };
}

/**
 * Read the active manager record for the current session.
 */
export function getStoredManagerId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("urugendo_manager_id");
}

export function getStoredManager(): Omit<
  ManagerRecord,
  "passwordHash" | "passwordSalt"
> | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("urugendo_manager_id");
  const name = localStorage.getItem("urugendo_manager_name");
  const email = localStorage.getItem("urugendo_manager_email");
  const code = localStorage.getItem("urugendo_manager_code");
  const agency = localStorage.getItem("urugendo_agency");
  if (!id || !email || !code || !agency) return null;
  return {
    id,
    name: name || "Manager",
    email,
    managerCode: code,
    agencyName: agency,
    isActive: true,
    passwordIter: 100000,
  };
}

export function persistManagerSession(
  manager: Omit<ManagerRecord, "passwordHash" | "passwordSalt">,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem("urugendo_manager_id", manager.id);
  localStorage.setItem("urugendo_manager_name", manager.name);
  localStorage.setItem("urugendo_manager_email", manager.email);
  localStorage.setItem("urugendo_manager_code", manager.managerCode);
  localStorage.setItem("urugendo_agency", manager.agencyName);
  localStorage.setItem("urugendo_role", "manager");
}

export function clearManagerSession() {
  if (typeof window === "undefined") return;
  // Remove the explicit manager keys...
  localStorage.removeItem("urugendo_manager_id");
  localStorage.removeItem("urugendo_manager_name");
  localStorage.removeItem("urugendo_manager_email");
  localStorage.removeItem("urugendo_manager_code");
  localStorage.removeItem("urugendo_role");
  localStorage.removeItem("urugendo_manager_password");
  // ...and sweep any other urugendo_* / supabase sb-* keys so the next login on this device is clean
  const sweep: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("urugendo_") || k.startsWith("sb-"))) sweep.push(k);
  }
  sweep.forEach((k) => localStorage.removeItem(k));
}
