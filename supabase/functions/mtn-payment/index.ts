// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Updated CORS headers with proper casing and allowance for standard headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Authorization, Apikey, X-Client-Info",
};

const MTN_BASE = "https://sandbox.momodeveloper.mtn.com";
const TARGET_ENV = Deno.env.get("MTN_TARGET_ENV") || "sandbox";

const SUBSCRIPTION_KEY = Deno.env.get("MTN_COLLECTION_SUBSCRIPTION_KEY");
const API_USER_ID = Deno.env.get("MTN_API_USER_ID");
const API_KEY = Deno.env.get("MTN_API_KEY");

interface PaymentRequest {
  bookingId: string;
  amount: number;
  phone: string;
  currency?: string;
  payerMessage?: string;
  payeeNote?: string;
}

Deno.serve(async (req: Request) => {
  // Always handle OPTIONS preflight check first
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "initiate";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);
    if (action === "webhook") {
      const expected = Deno.env.get("MTN_WEBHOOK_SECRET");
      if (!expected || req.headers.get("x-webhook-secret") !== expected) {
        return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await handleWebhook(req, supabase);
    }

    const authorization = req.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!token || !publicKey) {
      return new Response(JSON.stringify({ error: "Sign in is required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "status") {
      return await checkPaymentStatus(req, supabase, authData.user.id);
    }
    return await initiatePayment(req, supabase, authData.user.id);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function getMtnAccessToken(): Promise<string> {
  if (!SUBSCRIPTION_KEY || !API_USER_ID || !API_KEY) {
    throw new Error(
      "MTN MoMo credentials not configured. Set MTN_COLLECTION_SUBSCRIPTION_KEY, MTN_API_USER_ID, MTN_API_KEY as edge function secrets.",
    );
  }

  const basicAuth = btoa(`${API_USER_ID}:${API_KEY}`);

  const res = await fetch(`${MTN_BASE}/collection/token/`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
      Authorization: `Basic ${basicAuth}`,
      "Content-Length": "0",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MTN token failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function initiatePayment(req: Request, supabase: any, userId: string) {
  const body: PaymentRequest = await req.json();
  const { bookingId, amount, phone, currency = "RWF" } = body;

  if (!bookingId || !amount || !phone) {
    return new Response(
      JSON.stringify({ error: "Missing bookingId, amount, or phone" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, total_amount, fare_amount, payment_status, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError || !booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (booking.user_id !== userId) {
    return new Response(JSON.stringify({ error: "You cannot pay for this booking" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (booking.payment_status === "verified" || booking.payment_status === "success") {
    return new Response(JSON.stringify({ error: "This booking is already paid" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const normalizedPhone = String(phone).replace(/\D/g, "");
  const validRwandaPhone = /^250[7-8]\d{8}$/.test(normalizedPhone);
  const validSandboxTestPhone = TARGET_ENV === "sandbox" && (/^4673312345[0-9]$/.test(normalizedPhone) || /^4673312346[0-4]$/.test(normalizedPhone));
  if (!validRwandaPhone && !validSandboxTestPhone) {
    return new Response(JSON.stringify({ error: "Use a valid Rwanda MoMo number, including country code 250" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const trustedAmount = Number(booking.total_amount ?? booking.fare_amount ?? 0);
  if (!Number.isFinite(trustedAmount) || trustedAmount <= 0) {
    return new Response(JSON.stringify({ error: "Booking amount is invalid" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let accessToken: string;
  try {
    accessToken = await getMtnAccessToken();
  } catch (error: any) {
    await supabase.from("bookings").update({ status: "rejected", payment_status: "failed" }).eq("id", bookingId).eq("user_id", userId);
    return json({ error: error?.message || "Could not connect to MTN MoMo" }, 502);
  }
  const referenceId = crypto.randomUUID();

  // MTN's sandbox accepts EUR, while Urugendo fares are stored in RWF.
  // Use a harmless €1 test request in sandbox; never send a RWF amount as EUR.
  const mtnCurrency = TARGET_ENV === "sandbox" ? "EUR" : currency;
  const mtnAmount = TARGET_ENV === "sandbox" ? "1" : String(trustedAmount);

  const res = await fetch(`${MTN_BASE}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: mtnAmount,
      currency: mtnCurrency,
      externalId: bookingId,
      payer: { partyIdType: "MSISDN", partyId: normalizedPhone },
      payerMessage: body.payerMessage || "Urugendo bus ticket",
      payeeNote: body.payeeNote || "Urugendo booking",
    }),
  });

  if (!res.ok && res.status !== 202) {
    const errBody = await res.text();
    return new Response(
      JSON.stringify({
        error: `MTN request failed (${res.status}): ${errBody}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Store the actual user currency (RWF) in your database
  const { error: payError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    provider: "mtn",
    phone_number: normalizedPhone,
    amount: trustedAmount,
    currency: currency || "RWF",
    provider_reference: referenceId,
    status: "pending",
  });

  if (payError) {
    console.error("Failed to record payment:", payError);
    return new Response(JSON.stringify({ error: "MTN accepted the request but payment tracking could not be saved; contact support with reference " + referenceId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      referenceId,
      status: "pending",
      message:
        "Payment request sent to customer's phone. They must approve it.",
    }),
    {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function checkPaymentStatus(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const referenceId = url.searchParams.get("referenceId");

  if (!referenceId) {
    return new Response(JSON.stringify({ error: "Missing referenceId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*, booking:bookings(user_id, created_at)")
    .eq("provider_reference", referenceId)
    .maybeSingle();
  if (!payment || payment.booking?.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Payment not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (payment && payment.status === "success") {
    return new Response(JSON.stringify({ status: "success", payment }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const accessToken = await getMtnAccessToken();
  const res = await fetch(
    `${MTN_BASE}/collection/v1_0/requesttopay/${referenceId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Target-Environment": TARGET_ENV,
        "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY!,
      },
    },
  );

  if (!res.ok) {
    return new Response(
      JSON.stringify({
        status: "pending",
        message: "Payment still processing",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const mtnData = await res.json();
  const mtnStatus = mtnData.status;
  let dbStatus = "pending";
  if (mtnStatus === "SUCCESSFUL") dbStatus = "success";
  else if (mtnStatus === "FAILED" || mtnStatus === "REJECTED")
    dbStatus = "failed";

  if (dbStatus !== "pending" && payment) {
    await supabase
      .from("payments")
      .update({ status: dbStatus })
      .eq("id", payment.id);
    if (dbStatus === "success") {
      await supabase
        .from("bookings")
        .update({ status: "confirmed", payment_status: "verified" })
        .eq("id", payment.booking_id)
        .eq("user_id", userId);
    } else if (dbStatus === "failed") {
      await supabase
        .from("bookings")
        .update({ status: "rejected", payment_status: "failed" })
        .eq("id", payment.booking_id)
        .eq("user_id", userId);
    }
  }

  return new Response(
    JSON.stringify({ status: dbStatus, mtnStatus, referenceId }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function handleWebhook(req: Request, supabase: any) {
  const payload = await req.json();
  if (payload.status === "SUCCESSFUL") {
    await supabase
      .from("payments")
      .update({ status: "success" })
      .eq("provider_reference", payload.externalId);
  } else if (payload.status === "FAILED" || payload.status === "REJECTED") {
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("provider_reference", payload.externalId);
  }
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
