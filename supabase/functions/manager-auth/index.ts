import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const managerCode = String(body.managerCode || "").trim();
    const password = String(body.password || "");
    const agencyName = String(body.agencyName || "").trim();
    if (!email || !managerCode || !password) return json({ ok: false, reason: "missing_fields" }, 400);
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const emailHash = await sha256("manager-email:" + email);
    const { count: emailAttempts } = await db.from("security_rate_limit_events").select("id", { count: "exact", head: true })
      .eq("bucket", "manager_email").eq("subject_hash", emailHash).gte("created_at", cutoff);
    if ((emailAttempts || 0) >= 8) return json({ ok: false, reason: "rate_limited" }, 429);
    const ipAddress = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (ipAddress) {
      const ipHash = await sha256("manager-ip:" + ipAddress);
      const { count: ipAttempts } = await db.from("security_rate_limit_events").select("id", { count: "exact", head: true })
        .eq("bucket", "manager_ip").eq("subject_hash", ipHash).gte("created_at", cutoff);
      if ((ipAttempts || 0) >= 20) return json({ ok: false, reason: "rate_limited" }, 429);
      await db.from("security_rate_limit_events").insert({ bucket: "manager_ip", subject_hash: ipHash, created_at: nowIso });
    }
    await db.from("security_rate_limit_events").insert({ bucket: "manager_email", subject_hash: emailHash, created_at: nowIso });
    const { data: manager, error } = await db.from("agency_managers")
      .select("id,name,email,manager_code,agency_name,password_hash,password_salt,password_iter,is_active")
      .eq("email", email).maybeSingle();
    if (error || !manager) return json({ ok: false, reason: "not_found" }, 401);
    if (manager.is_active === false) return json({ ok: false, reason: "inactive" }, 403);
    if (!constantTimeEqual(String(manager.manager_code || "").trim().toLowerCase(), managerCode.toLowerCase())) return json({ ok: false, reason: "code_mismatch" }, 401);
    if (agencyName && String(manager.agency_name || "").trim().toLowerCase() !== agencyName.toLowerCase()) return json({ ok: false, reason: "agency_mismatch" }, 401);
    const iterations = Math.max(10000, Math.min(Number(manager.password_iter || 100000), 500000));
    const computed = await pbkdf2(password, String(manager.password_salt || ""), iterations);
    if (!constantTimeEqual(computed, String(manager.password_hash || "").trim())) return json({ ok: false, reason: "bad_password" }, 401);
    const safeManager = { id: manager.id, name: manager.name, email: manager.email, managerCode: manager.manager_code, agencyName: manager.agency_name, isActive: true, passwordIter: manager.password_iter || 100000 };
    if (!body.native) return json({ ok: true, manager: safeManager });
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const sessionToken = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const tokenHash = await sha256(sessionToken);
    const { error: sessionError } = await db.from("agency_manager_sessions").insert({
      manager_id: manager.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    });
    if (sessionError) throw new Error("Could not create a secure manager session.");
    return json({ ok: true, manager: safeManager, sessionToken });
  } catch (error: any) {
    console.error("manager-auth failed:", error?.message || error);
    return json({ ok: false, reason: "internal_error" }, 500);
  }
});
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
function constantTimeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function pbkdf2(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations, hash: "SHA-512" }, key, 512);
  let binary = "";
  for (const b of new Uint8Array(bits)) binary += String.fromCharCode(b);
  return btoa(binary);
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
