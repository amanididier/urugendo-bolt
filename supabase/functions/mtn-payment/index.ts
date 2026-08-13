import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "initiate";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (action === "status") {
      return await checkPaymentStatus(req, supabase);
    }

    if (action === "webhook") {
      return await handleWebhook(req, supabase);
    }

    return await initiatePayment(req, supabase);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getMtnAccessToken(): Promise<string> {
  if (!SUBSCRIPTION_KEY || !API_USER_ID || !API_KEY) {
    throw new Error(
      "MTN MoMo credentials not configured. Set MTN_COLLECTION_SUBSCRIPTION_KEY, MTN_API_USER_ID, MTN_API_KEY as edge function secrets."
    );
  }

  const basicAuth = btoa(`${API_USER_ID}:${API_KEY}`);

  const res = await fetch(`${MTN_BASE}/collection/token/`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
      "Authorization": `Basic ${basicAuth}`,
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

async function initiatePayment(req: Request, supabase: any) {
  const body: PaymentRequest = await req.json();
  const { bookingId, amount, phone, currency = "RWF" } = body;

  if (!bookingId || !amount || !phone) {
    return new Response(
      JSON.stringify({ error: "Missing bookingId, amount, or phone" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const accessToken = await getMtnAccessToken();
  const referenceId = crypto.randomUUID();

  const res = await fetch(`${MTN_BASE}/collection/v1_2/requesttopay`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(amount),
      currency,
      externalId: bookingId,
      payer: { partyIdType: "MSISDN", partyId: phone },
      payerMessage: body.payerMessage || "Urugendo bus ticket",
      payeeNote: body.payeeNote || "Urugendo booking",
    }),
  });

  if (!res.ok && res.status !== 202) {
    const errBody = await res.text();
    return new Response(
      JSON.stringify({ error: `MTN request failed (${res.status}): ${errBody}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: payError } = await supabase.from("payments").insert({
    booking_id: bookingId,
    provider: "mtn",
    phone_number: phone,
    amount,
    currency,
    provider_reference: referenceId,
    status: "pending",
  });

  if (payError) console.error("Failed to record payment:", payError);

  return new Response(
    JSON.stringify({
      referenceId,
      status: "pending",
      message: "Payment request sent to customer's phone. They must approve it.",
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function checkPaymentStatus(req: Request, supabase: any) {
  const url = new URL(req.url);
  const referenceId = url.searchParams.get("referenceId");

  if (!referenceId) {
    return new Response(
      JSON.stringify({ error: "Missing referenceId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_reference", referenceId)
    .maybeSingle();

  if (payment && payment.status === "success") {
    return new Response(
      JSON.stringify({ status: "success", payment }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const accessToken = await getMtnAccessToken();
  const res = await fetch(`${MTN_BASE}/collection/v1_2/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY!,
    },
  });

  if (!res.ok) {
    return new Response(
      JSON.stringify({ status: "pending", message: "Payment still processing" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const mtnData = await res.json();
  const mtnStatus = mtnData.status;
  let dbStatus = "pending";
  if (mtnStatus === "SUCCESSFUL") dbStatus = "success";
  else if (mtnStatus === "FAILED" || mtnStatus === "REJECTED") dbStatus = "failed";

  if (dbStatus !== "pending" && payment) {
    await supabase.from("payments").update({ status: dbStatus }).eq("id", payment.id);
    if (dbStatus === "success") {
      await supabase.from("bookings").update({ status: "upcoming" }).eq("id", payment.booking_id);
    }
  }

  return new Response(
    JSON.stringify({ status: dbStatus, mtnStatus, referenceId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleWebhook(req: Request, supabase: any) {
  const payload = await req.json();
  if (payload.status === "SUCCESSFUL") {
    await supabase.from("payments").update({ status: "success" }).eq("provider_reference", payload.externalId);
  } else if (payload.status === "FAILED" || payload.status === "REJECTED") {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_reference", payload.externalId);
  }
  return new Response(
    JSON.stringify({ received: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
