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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, reason: "method" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) return new Response(JSON.stringify({ ok: false, reason: "missing_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data, error } = await supabase
      .from("founder_admins")
      .select("id, email, name, password_hash, password_salt, password_iter, is_active")
      .eq("email", String(email).trim().toLowerCase())
      .maybeSingle();

    if (error || !data) return new Response(JSON.stringify({ ok: false, reason: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (data.is_active === false) return new Response(JSON.stringify({ ok: false, reason: "inactive" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const salt = data.password_salt;
    const iter = data.password_iter || 100000;
    const stored = String(data.password_hash).trim();

    // PBKDF2-SHA512 via Deno built-in (matches manager-auth scheme, different salt)
    // Deno: crypto.subtle PBKDF2 is subtle — use raw import
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(String(salt)), iterations: Number(iter), hash: "SHA-512" }, keyMat, 512);
    const bytes = new Uint8Array(bits);
    const computed = b64(bytes);

    // Constant-time-ish compare
    if (computed !== stored) return new Response(JSON.stringify({ ok: false, reason: "bad_password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, founder: { id: data.id, email: data.email, name: data.name } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, reason: "server_error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
