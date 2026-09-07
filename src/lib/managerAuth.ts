// src/lib/managerAuth.ts
//
// Batch 5: DB-backed authentication for agency managers.
//
// Managers are manually provisioned in the public.agency_managers table
// (see supabase/migrations/20260907120003_create_agency_managers.sql).
// Agents are NOT in this table — they register publicly and are approved
// by an active manager from the manager dashboard.
//
// This module:
//   1. Loads a manager record by email from Supabase
//   2. Verifies the password against the stored PBKDF2-SHA512 hash
//   3. Confirms manager_code matches (defence in depth — same input that
//      the login form collects from the user)
//
// The hash parameters (salt + iterations) must stay in sync with the
// migration. The canonical manager record seeded in the migration is:
//   email:        manager@virunga.com
//   manager_code: MGR-001
//   password:     manager@123
//   password_hash: PBKDF2-SHA512("manager@123", "urugendo-manager-v1-salt",
//                                100000, 64) → base64

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
}

export interface ManagerLoginResult {
  ok: boolean;
  reason?:
    | "missing_fields"
    | "not_found"
    | "inactive"
    | "code_mismatch"
    | "bad_password";
  manager?: Omit<ManagerRecord, "passwordHash" | "passwordSalt">;
}

// Browser-side PBKDF2 via Web Crypto. Returns base64.
async function pbkdf2(
  password: string,
  salt: string,
  iterations: number,
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
  // base64-encode the result
  const bytes = new Uint8Array(bits);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Constant-time string compare.
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
 *
 * Returns { ok: true, manager } on success, otherwise { ok: false, reason }.
 */
export async function authenticateManager(
  input: ManagerLoginInput,
): Promise<ManagerLoginResult> {
  if (!input.email?.trim() || !input.managerCode?.trim() || !input.password) {
    return { ok: false, reason: "missing_fields" };
  }

  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("agency_managers")
    .select(
      "id, name, email, manager_code, agency_name, password_hash, password_salt, password_iter, is_active",
    )
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.warn("[managerAuth] select error:", error.message);
    return { ok: false, reason: "not_found" };
  }
  if (!data) {
    return { ok: false, reason: "not_found" };
  }

  const record: ManagerRecord = {
    id: data.id,
    name: data.name,
    email: data.email,
    managerCode: data.manager_code,
    agencyName: data.agency_name,
    passwordHash: data.password_hash,
    passwordSalt: data.password_salt,
    passwordIter: data.password_iter || 100000,
    isActive: data.is_active !== false,
  };

  if (!record.isActive) {
    return { ok: false, reason: "inactive" };
  }

  if (
    record.managerCode.toLowerCase() !== input.managerCode.trim().toLowerCase()
  ) {
    return { ok: false, reason: "code_mismatch" };
  }

  const computed = await pbkdf2(
    input.password,
    record.passwordSalt,
    record.passwordIter,
  );
  if (!constantTimeEqual(computed, record.passwordHash)) {
    return { ok: false, reason: "bad_password" };
  }

  // Strip secrets before returning to caller.
  const { passwordHash, passwordSalt, ...safe } = record;
  void passwordHash;
  void passwordSalt;
  return { ok: true, manager: safe };
}

/**
 * Read the active manager record for the current session.
 * Returns null if no manager has signed in yet (no localStorage flag).
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
    passwordIter: 10000,
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
  localStorage.removeItem("urugendo_manager_id");
  localStorage.removeItem("urugendo_manager_name");
  localStorage.removeItem("urugendo_manager_email");
  localStorage.removeItem("urugendo_manager_code");
  // Note: do NOT clear urugendo_agency — other roles may use it.
  localStorage.removeItem("urugendo_role");
  localStorage.removeItem("urugendo_manager_password"); // legacy
}
