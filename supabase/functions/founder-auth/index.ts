// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization, Apikey, X-Client-Info",
};

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function randomSalt(prefix: string): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return prefix + Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, reason: "method" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = (url.searchParams.get("action") || body.action || "login").toString();

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    if (action === "update_password") {
      const email = String(body.email || "").trim().toLowerCase();
      const currentPassword = String(body.currentPassword || body.current_password || "");
      const newPassword = String(body.newPassword || body.new_password || "");
      if (!email || !currentPassword || !newPassword) return new Response(JSON.stringify({ ok: false, reason: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (newPassword.length < 6) return new Response(JSON.stringify({ ok: false, reason: "weak_password" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data, error } = await supabase
        .from("founder_admins")
        .select("id, email, name, password_hash, password_salt, password_iter, is_active")
        .eq("email", email)
        .maybeSingle();

      if (error || !data) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (data.is_active === false) return new Response(JSON.stringify({ ok: false, reason: "inactive" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const enc = new TextEncoder();
      const keyMat = await crypto.subtle.importKey("raw", enc.encode(currentPassword), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(String(data.password_salt)), iterations: Number(data.password_iter || 100000), hash: "SHA-512" }, keyMat, 512);
      const computed = b64(new Uint8Array(bits));
      if (computed !== String(data.password_hash).trim()) return new Response(JSON.stringify({ ok: false, reason: "bad_password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const newSalt = randomSalt("urugendo-founder-");
      const newIter = 100000;
      const keyMat2 = await crypto.subtle.importKey("raw", enc.encode(newPassword), "PBKDF2", false, ["deriveBits"]);
      const bits2 = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(newSalt), iterations: newIter, hash: "SHA-512" }, keyMat2, 512);
      const newHash = b64(new Uint8Array(bits2));

      const { error: updErr } = await supabase
        .from("founder_admins")
        .update({ password_hash: newHash, password_salt: newSalt, password_iter: newIter, updated_at: new Date().toISOString() })
        .eq("id", data.id);

      if (updErr) return new Response(JSON.stringify({ ok: false, reason: "db_error", details: updErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // default: login
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return new Response(JSON.stringify({ ok: false, reason: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data, error } = await supabase
      .from("founder_admins")
      .select("id, email, name, password_hash, password_salt, password_iter, is_active")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (data.is_active === false) return new Response(JSON.stringify({ ok: false, reason: "inactive" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const salt = data.password_salt;
    const iter = data.password_iter || 100000;
    const stored = String(data.password_hash).trim();

    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(String(salt)), iterations: Number(iter), hash: "SHA-512" }, keyMat, 512);
    const bytes = new Uint8Array(bits);
    const computed = b64(bytes);

    if (computed !== stored) return new Response(JSON.stringify({ ok: false, reason: "bad_password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, founder: { id: data.id, email: data.email, name: data.name } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
