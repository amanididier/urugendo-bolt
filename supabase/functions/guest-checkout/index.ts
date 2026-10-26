import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TARGET_ENV = Deno.env.get("MTN_TARGET_ENV") || "sandbox";
const MTN_BASE = Deno.env.get("MTN_BASE_URL") || (TARGET_ENV === "sandbox" ? "https://sandbox.momodeveloper.mtn.com" : "");
const SUBSCRIPTION_KEY = Deno.env.get("MTN_COLLECTION_SUBSCRIPTION_KEY");
const API_USER_ID = Deno.env.get("MTN_API_USER_ID");
const API_KEY = Deno.env.get("MTN_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for guest checkout." }, 405);
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "initiate";
    const body = await req.json();
    if (action === "trips") return await listPublicTrips(body);
    if (action === "ticket") return await getGuestTicket(body);
    if (action === "status") return await getGuestPaymentStatus(body);
    if (action !== "initiate") return json({ error: "Unknown checkout action." }, 400);
    return await initiateGuestCheckout(body);
  } catch (error: any) {
    console.error("guest-checkout error:", error?.message || error);
    return json({ error: error?.message || "Guest checkout failed." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^4673312345[0-9]$/.test(digits) || /^4673312346[0-4]$/.test(digits)) return digits;
  if (/^250[7-8]\d{8}$/.test(digits)) return digits;
  if (/^0[7-8]\d{8}$/.test(digits)) return "250" + digits.slice(1);
  if (/^[7-8]\d{8}$/.test(digits)) return "250" + digits;
  return null;
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function mtnAccessToken() {
  if (!MTN_BASE) throw new Error("Set MTN_BASE_URL for non-sandbox MTN environments after MTN confirms your production endpoint.");
  if (!SUBSCRIPTION_KEY || !API_USER_ID || !API_KEY) throw new Error("MTN MoMo credentials are not configured on the server.");
  const response = await fetch(`${MTN_BASE}/collection/token/`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
      "X-Target-Environment": TARGET_ENV,
      Authorization: `Basic ${btoa(`${API_USER_ID}:${API_KEY}`)}`,
      "Content-Length": "0",
    },
  });
  if (!response.ok) throw new Error(`MTN token request failed (${response.status}).`);
  return (await response.json()).access_token as string;
}

async function listPublicTrips(body: any) {
  const from = String(body.from || "").trim();
  const to = String(body.to || "").trim();
  const date = String(body.date || "").trim();
  let query = supabase.from("trips")
    .select("id,route_from,route_to,travel_date,date,departure_time,arrival_time,price,currency,total_seats,available_seats,status,operator:operators(name)")
    .eq("status", "scheduled")
    .gte("travel_date", new Date().toISOString().slice(0, 10))
    .order("travel_date", { ascending: true }).limit(100);
  if (from) query = query.ilike("route_from", `%${from}%`);
  if (to) query = query.ilike("route_to", `%${to}%`);
  if (date && /^\\d{4}-\\d{2}-\\d{2}$/.test(date)) query = query.eq("travel_date", date);
  const { data: trips, error } = await query;
  if (error) throw new Error("Could not load available trips.");
  if (!trips?.length) return json({ trips: [] });
  const ids = trips.map((trip: any) => trip.id);
  const { data: bookings, error: bookingError } = await supabase.from("bookings")
    .select("trip_id,passenger_count,status")
    .in("trip_id", ids)
    .not("status", "in", '("rejected","cancelled","expired","past")');
  if (bookingError) throw new Error("Could not calculate seat availability.");
  const reserved = new Map<string, number>();
  for (const booking of bookings || []) reserved.set(booking.trip_id, (reserved.get(booking.trip_id) || 0) + Math.max(1, Number(booking.passenger_count || 1)));
  return json({ trips: trips.map((trip: any) => ({
    id: trip.id, from: trip.route_from, to: trip.route_to,
    date: trip.travel_date || trip.date, departureTime: trip.departure_time,
    arrivalTime: trip.arrival_time, price: Number(trip.price || 0),
    currency: trip.currency || "RWF", totalSeats: Number(trip.total_seats || 0),
    availableSeats: Math.max(0, Number(trip.total_seats || 0) - (reserved.get(trip.id) || 0)),
    operatorName: trip.operator?.name || "Bus operator",
  })) });
}

async function initiateGuestCheckout(body: any) {
  const passengerName = String(body.passengerName || "").trim();
  const passengerPhone = normalizePhone(body.passengerPhone);
  const momoName = String(body.momoName || "").trim();
  const momoNumber = normalizePhone(body.momoNumber);
  const passengerCount = Math.floor(Number(body.passengerCount || 1));
  const tripId = String(body.tripId || "");
  if (!tripId || !passengerName || !passengerPhone || !momoName || !momoNumber) return json({ error: "Enter passenger name, passenger phone, MoMo account name and MoMo number." }, 400);
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 10) return json({ error: "Choose between 1 and 10 passengers." }, 400);
  if ((passengerPhone.startsWith("467") || momoNumber.startsWith("467")) && TARGET_ENV !== "sandbox") return json({ error: "MTN sandbox test numbers cannot be used in production." }, 400);

  // Server-side rate limits store hashes only; raw phone/IP values are not retained in this table.
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const ipAddress = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const phoneHash = await sha256("guest-phone:" + momoNumber);
  if (ipAddress) {
    const ipHash = await sha256("guest-ip:" + ipAddress);
    const { count: ipCount } = await supabase.from("security_rate_limit_events").select("id", { count: "exact", head: true })
      .eq("bucket", "guest_ip").eq("subject_hash", ipHash).gte("created_at", cutoff);
    if ((ipCount || 0) >= 8) return json({ error: "Too many checkout attempts from this connection. Please wait 15 minutes." }, 429);
    await supabase.from("security_rate_limit_events").insert({ bucket: "guest_ip", subject_hash: ipHash, created_at: nowIso });
  }
  const { count: phoneAttempts } = await supabase.from("security_rate_limit_events").select("id", { count: "exact", head: true })
    .eq("bucket", "guest_phone").eq("subject_hash", phoneHash).gte("created_at", cutoff);
  if ((phoneAttempts || 0) >= 3) return json({ error: "Too many checkout attempts for this MoMo number. Please wait 15 minutes." }, 429);
  await supabase.from("security_rate_limit_events").insert({ bucket: "guest_phone", subject_hash: phoneHash, created_at: nowIso });

  // Basic server-side abuse guard: limit repeated pending reservations for the same payer.
  const { count: recentCount, error: rateError } = await supabase.from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("passenger_phone", passengerPhone)
    .eq("payment_status", "pending")
    .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (!rateError && (recentCount || 0) >= 3) return json({ error: "Too many pending bookings for this number. Check your previous request or try again in 15 minutes." }, 429);

  const guestToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const guestTokenHash = await sha256(guestToken);
  const bookingCode = "URG-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: booking, error: bookingError } = await supabase.rpc("create_guest_passenger_booking", {
    p_trip_id: tripId,
    p_passenger_name: passengerName,
    p_passenger_phone: passengerPhone,
    p_passenger_count: passengerCount,
    p_momo_name: momoName,
    p_momo_number: momoNumber,
    p_booking_code: bookingCode,
    p_guest_token_hash: guestTokenHash,
  });
  if (bookingError || !booking) return json({ error: bookingError?.message || "Could not reserve seats for this trip." }, bookingError?.code === "P0001" ? 409 : 400);
  const saved = Array.isArray(booking) ? booking[0] : booking;
  const referenceId = crypto.randomUUID();
  // MTN sandbox accepts EUR only. A €1 sandbox test request is not the RWF fare.
  const amount = TARGET_ENV === "sandbox" ? "1" : String(Number(saved.total_amount));
  const currency = TARGET_ENV === "sandbox" ? "EUR" : "RWF";
  // Persist the reference before calling MTN so an accepted request can never become untrackable.
  const { error: paymentError } = await supabase.from("payments").insert({
    booking_id: saved.id, provider: "mtn", phone_number: momoNumber,
    amount: Number(saved.total_amount), currency: "RWF",
    provider_reference: referenceId, status: "pending",
  });
  if (paymentError) {
    await supabase.from("bookings").update({ status: "rejected", payment_status: "failed" }).eq("id", saved.id);
    return json({ error: "Could not create secure payment tracking. No payment request was sent." }, 500);
  }
  try {
    const token = await mtnAccessToken();
    const response = await fetch(`${MTN_BASE}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": TARGET_ENV,
        "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount, currency, externalId: saved.id,
        payer: { partyIdType: "MSISDN", partyId: momoNumber },
        payerMessage: "Urugendo bus ticket",
        payeeNote: "Urugendo guest booking",
      }),
    });
    if (!response.ok && response.status !== 202) {
      const detail = await response.text();
      await supabase.from("payments").update({ status: "failed" }).eq("provider_reference", referenceId);
      await supabase.from("bookings").update({ status: "rejected", payment_status: "failed" }).eq("id", saved.id);
      return json({ error: `MTN payment request failed (${response.status}): ${detail}` }, 502);
    }
    return json({
      bookingId: saved.id, bookingCode: saved.booking_code, guestToken,
      paymentReference: referenceId, paymentStatus: "pending",
      totalAmount: Number(saved.total_amount),
      message: TARGET_ENV === "sandbox"
        ? "Sandbox simulation started. No real money moves and no real MoMo PIN prompt is sent; the test status will update automatically."
        : "Approve the MTN MoMo prompt on your phone. Urugendo never asks for or stores your PIN.",
    }, 202);
  } catch (error: any) {
    await supabase.from("payments").update({ status: "failed" }).eq("provider_reference", referenceId);
    await supabase.from("bookings").update({ status: "rejected", payment_status: "failed" }).eq("id", saved.id);
    return json({ error: error?.message || "Could not start MTN payment." }, 502);
  }
}
async function verifyGuest(body: any) {
  const bookingId = String(body.bookingId || "");
  const guestToken = String(body.guestToken || "");
  if (!bookingId || guestToken.length < 40) return { error: "Ticket access is invalid." };
  const hash = await sha256(guestToken);
  const { data: booking, error } = await supabase.from("bookings")
    .select("id, guest_token_hash, booking_code, short_code, passenger_name, passenger_phone, passenger_count, seat_label, total_amount, fare_amount, status, payment_status, booking_date, created_at, trip_id, branch_id, agency_id, agency_branch, momo_name, trip:trips(id,route_from,route_to,departure_time,arrival_time,travel_date,date,price,currency,plate_number,bus_type,operator:operators(name))")
    .eq("id", bookingId).maybeSingle();
  if (error || !booking || !booking.guest_token_hash || booking.guest_token_hash !== hash) return { error: "Ticket not found or access token is invalid." };
  return { booking };
}
async function getGuestTicket(body: any) {
  const result = await verifyGuest(body);
  if (result.error) return json({ error: result.error }, 404);
  const b = result.booking;
  return json({ booking: {
    id: b.id, bookingCode: b.booking_code, shortCode: b.short_code,
    passengerName: b.passenger_name, passengerPhone: b.passenger_phone,
    passengerCount: b.passenger_count, seatLabel: b.seat_label,
    totalAmount: b.total_amount, status: b.status, paymentStatus: b.payment_status,
    bookingDate: b.booking_date, createdAt: b.created_at, branchId: b.branch_id,
    momoAccountName: b.momo_name,
    trip: b.trip ? {
      id: b.trip.id, from: b.trip.route_from, to: b.trip.route_to,
      departureTime: b.trip.departure_time, arrivalTime: b.trip.arrival_time,
      date: b.trip.travel_date || b.trip.date, price: b.trip.price,
      currency: b.trip.currency, plateNumber: b.trip.plate_number,
      busType: b.trip.bus_type, operator: b.trip.operator,
    } : null,
  }});
}
async function getGuestPaymentStatus(body: any) {
  const verified = await verifyGuest(body);
  if (verified.error) return json({ error: verified.error }, 404);
  const booking = verified.booking;
  const { data: payment } = await supabase.from("payments").select("id, provider_reference, status")
    .eq("booking_id", booking.id).eq("provider", "mtn").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!payment) return json({ status: booking.payment_status === "failed" ? "failed" : "pending", message: "No payment reference is recorded yet." });
  if (payment.status === "success") return json({ status: "success", bookingStatus: booking.status, paymentStatus: booking.payment_status });
  if (payment.status === "failed") return json({ status: "failed", message: "MTN did not confirm the payment. The seat reservation has been released." });
  let mtnStatus = "PENDING";
  try {
    const token = await mtnAccessToken();
    const response = await fetch(`${MTN_BASE}/collection/v1_0/requesttopay/${payment.provider_reference}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Target-Environment": TARGET_ENV, "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY! },
    });
    if (!response.ok) {
      if (Date.now() - new Date(booking.created_at).getTime() >= 15 * 60 * 1000) {
        await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
        await supabase.from("bookings").update({ status: "expired", payment_status: "expired" }).eq("id", booking.id);
        return json({ status: "failed", message: "Payment request expired. The seat reservation has been released." });
      }
      return json({ status: "pending", message: "Waiting for MTN confirmation." });
    }
    mtnStatus = (await response.json()).status || "PENDING";
  } catch {
    return json({ status: "pending", message: "Waiting for MTN confirmation." });
  }
  if (mtnStatus !== "SUCCESSFUL" && !["FAILED", "REJECTED", "EXPIRED"].includes(mtnStatus) && Date.now() - new Date(booking.created_at).getTime() >= 15 * 60 * 1000) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
    await supabase.from("bookings").update({ status: "expired", payment_status: "expired" }).eq("id", booking.id);
    return json({ status: "failed", message: "Payment request expired. The seat reservation has been released." });
  }
  if (mtnStatus === "SUCCESSFUL") {
    await supabase.from("payments").update({ status: "success" }).eq("id", payment.id);
    await supabase.from("bookings").update({ status: "confirmed", payment_status: "verified" }).eq("id", booking.id);
    return json({ status: "success", bookingStatus: "confirmed", paymentStatus: "verified" });
  }
  if (["FAILED", "REJECTED", "EXPIRED"].includes(mtnStatus)) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
    await supabase.from("bookings").update({ status: "rejected", payment_status: "failed" }).eq("id", booking.id);
    return json({ status: "failed", message: "MTN did not confirm the payment. The seat reservation has been released." });
  }
  return json({ status: "pending", message: "Approve the MTN prompt to activate your ticket." });
}
