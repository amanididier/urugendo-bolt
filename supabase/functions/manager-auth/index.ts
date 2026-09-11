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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "authenticate";

    // Create a Supabase client with the service role key for server-side access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (action === "authenticate") {
      const body = await req.json().catch(() => ({}));
      const { email, managerCode, password, agencyName } = body;

      if (!email || !managerCode || !password) {
        return new Response(
          JSON.stringify({ ok: false, reason: "missing_fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Look up the manager record by email
      const { data, error } = await supabase
        .from("agency_managers")
        .select(
          "id, name, email, manager_code, agency_name, password_hash, password_salt, password_iter, is_active",
        )
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("[manager-auth] DB error:", error.message);
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (!data) {
        return new Response(
          JSON.stringify({ ok: false, reason: "not_found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Optional agency name mismatch check
      if (
        agencyName &&
        data.agency_name &&
        agencyName.trim().toLowerCase() !==
          data.agency_name.trim().toLowerCase()
      ) {
        return new Response(
          JSON.stringify({ ok: false, reason: "agency_mismatch" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Verify manager code (case-insensitive, trimmed)
      if (data.manager_code.trim().toLowerCase() !== managerCode.trim().toLowerCase()) {
        return new Response(
          JSON.stringify({ ok: false, reason: "code_mismatch" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Verify user is active
      if (data.is_active !== true) {
        return new Response(
          JSON.stringify({ ok: false, reason: "inactive" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Compute PBKDF2-SHA512 hash using Deno's crypto API (same algorithm as client)
      const passwordBytes = new TextEncoder().encode(password);
      const hashBuffer = await Deno.crypto.pbkdf2(
        passwordBytes,
        new TextEncoder().encode(data.password_salt),
        data.password_iter,
        { hash: "SHA-512" },
        64, // 64 bytes = 512 bits
      );

      const computedHash = hashBuffer.toString("base64");

      // Constant-time comparison (approximate using simple equality for simplicity;
      // in production, consider a proper constant-time compare)
      if (computedHash !== data.password_hash) {
        return new Response(
          JSON.stringify({ ok: false, reason: "bad_password" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Success — return sanitized manager record (no secrets)
      const { password_hash, password_salt, password_iter, ...safe } = data;
      return new Response(
        JSON.stringify({ ok: true, manager: safe }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[manager-auth] Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});