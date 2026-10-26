// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, Apikey, X-Client-Info",
};

Deno.serve(async (req: Request) => {
  // Always handle OPTIONS preflight check first
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Admin token check
    const adminToken = req.headers.get("X-Admin-Token") || req.headers.get("x-admin-token");
    const expectedToken = Deno.env.get("ADMIN_PROVISION_TOKEN");

    if (!expectedToken || adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ ok: false, reason: "unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, manager_code, agency_name, password } = body;

    // Basic validation
    if (!name || !email || !manager_code || !agency_name || !password) {
      return new Response(
        JSON.stringify({ ok: false, reason: "missing_fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Email format check (basic)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, reason: "invalid_email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Check uniqueness of email and manager_code
    const { data: existingEmail } = await supabase
      .from("agency_managers")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ ok: false, reason: "email_exists" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: existingCode } = await supabase
      .from("agency_managers")
      .select("id")
      .eq("manager_code", manager_code.trim())
      .maybeSingle();

    if (existingCode) {
      return new Response(
        JSON.stringify({ ok: false, reason: "code_exists" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate random salt (using crypto.randomUUID for simplicity)
    const salt = crypto.randomUUID();
    const iterations = 100000;

    // Compute PBKDF2-SHA512 hash using Deno's crypto API
    const passwordBytes = new TextEncoder().encode(password);
    const hashBuffer = await Deno.crypto.pbkdf2(
      passwordBytes,
      new TextEncoder().encode(salt),
      iterations,
      { hash: "SHA-512" },
      64,
    );

    const passwordHash = hashBuffer.toString("base64");

    // Insert new manager record
    const { data: newManager, error: insertError } = await supabase
      .from("agency_managers")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        manager_code: manager_code.trim(),
        agency_name: agency_name.trim(),
        password_hash: passwordHash,
        password_salt: salt,
        password_iter: iterations,
        is_active: true,
      })
      .select("id, name, email, manager_code, agency_name, is_active")
      .single();

    if (insertError) {
      console.error("[manager-provision] Insert error:", insertError.message);
      return new Response(
        JSON.stringify({ ok: false, reason: "insert_failed", detail: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, manager: newManager }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[manager-provision] Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});