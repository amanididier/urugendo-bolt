// src/lib/paymentProvider.ts
//
// Batch 4: Payment gateway interface for MTN MoMo / Airtel Money.
//
// Current mode: SEMI-AUTOMATED (manual USSD + agent verification).
//   The user dials *182# (MTN) or *500# (Airtel), sends money to the
//   branch's MoMo code, then comes back to the app and clicks "Pay".
//   We do NOT call any live MoMo API — we just record the booking as
//   pending and let the station agent verify the MoMo SMS receipt.
//
// Future mode: When the real MTN/Airtel Edge Functions are deployed,
//   swap the `requestPayment` body to call them. The public surface
//   (PaymentProvider, getProvider, etc.) does not change, so callers
//   in payment/page.tsx keep working untouched.
//
// Contract for whoever deploys the Edge Functions later:
//   POST {SUPABASE_URL}/functions/v1/mtn-payment
//     body: { action: "request", amount, phone, momoName, externalId }
//     → { referenceId: string, status: "pending" }
//
//   GET {SUPABASE_URL}/functions/v1/mtn-payment?action=status&referenceId=...
//     → { status: "pending" | "success" | "failed" }
//
//   POST {SUPABASE_URL}/functions/v1/airtel-payment   (stub — not built yet)
//   GET  {SUPABASE_URL}/functions/v1/airtel-payment?action=status&...

import { supabase } from "./supabase";

export type PaymentChannel = "mtn" | "airtel";

export interface PaymentRequest {
  amount: number;
  phone: string; // E.164 or local Rwanda format
  momoName: string;
  externalId: string; // Our booking reference for reconciliation
}

export type PaymentResultStatus = "pending" | "success" | "failed";

export interface PaymentRequestResult {
  referenceId: string;
  status: PaymentResultStatus;
}

export interface PaymentStatusResult {
  status: PaymentResultStatus;
  failureReason?: string;
}

export interface PaymentProvider {
  channel: PaymentChannel;
  requestPayment(req: PaymentRequest): Promise<PaymentRequestResult>;
  getStatus(referenceId: string): Promise<PaymentStatusResult>;
}

// ---------------------------------------------------------------------------
//  Stub providers — the real Edge Functions are NOT deployed yet.
//  Both methods below return a "pending" status without any network call.
//  When the Edge Functions are deployed, replace the bodies of these two
//  objects with `fetch(functionBaseUrl()/mtn-payment, ...)` — nothing else
//  in the app needs to change.
// ---------------------------------------------------------------------------

function functionBaseUrl(): string {
  return `${
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  }/functions/v1`;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token || ""}`,
    apikey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    "Content-Type": "application/json",
  };
}

export const mtnProvider: PaymentProvider = {
  channel: "mtn",

  async requestPayment(req: PaymentRequest): Promise<PaymentRequestResult> {
    // SEMI-AUTOMATED MODE: do NOT call the live Edge Function. The user has
    // already paid via USSD; we just hand back a synthetic reference so the
    // caller can store it for the agent's verification queue.
    return {
      referenceId: req.externalId,
      status: "pending",
    };

    // ----- REAL MODE (deferred until Edge Function is deployed) -----
    // const res = await fetch(`${functionBaseUrl()}/mtn-payment`, {
    //   method: "POST",
    //   headers: await getAuthHeader(),
    //   body: JSON.stringify({
    //     action: "request",
    //     amount: req.amount,
    //     phone: req.phone,
    //     momoName: req.momoName,
    //     externalId: req.externalId,
    //   }),
    // });
    // if (!res.ok) {
    //   const err = await res.json().catch(() => ({}));
    //   throw new Error(err.error || `MTN request failed: ${res.status}`);
    // }
    // return res.json();
  },

  async getStatus(_referenceId: string): Promise<PaymentStatusResult> {
    // SEMI-AUTOMATED MODE: status flips from 'pending' → 'success' only
    // when the agent confirms the MoMo message in their dashboard.
    // The booking is updated via updateBookingPaymentStatus() instead.
    return { status: "pending" };

    // ----- REAL MODE (deferred) -----
    // const res = await fetch(
    //   `${functionBaseUrl()}/mtn-payment?action=status&referenceId=${encodeURIComponent(referenceId)}`,
    //   { method: "GET", headers: await getAuthHeader() },
    // );
    // if (!res.ok) {
    //   return { status: "failed", failureReason: `HTTP ${res.status}` };
    // }
    // return res.json();
  },
};

export const airtelProvider: PaymentProvider = {
  channel: "airtel",

  async requestPayment(req: PaymentRequest): Promise<PaymentRequestResult> {
    return { referenceId: req.externalId, status: "pending" };
  },

  async getStatus(_referenceId: string): Promise<PaymentStatusResult> {
    return { status: "pending" };
  },
};

export function getProvider(channel: PaymentChannel): PaymentProvider {
  if (channel === "airtel") return airtelProvider;
  return mtnProvider;
}

/**
 * Poll the provider status until success/failed or max attempts reached.
 * In semi-automated mode this is effectively a no-op — the provider always
 * returns 'pending' here; the real transition happens when the agent
 * updates the booking's payment_status in the DB.
 */
export async function pollProviderStatus(
  provider: PaymentProvider,
  referenceId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<boolean> {
  const intervalMs = options.intervalMs ?? 3000;
  const maxAttempts = options.maxAttempts ?? 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { status } = await provider.getStatus(referenceId);
      if (status === "success") return true;
      if (status === "failed") return false;
    } catch {
      // network hiccup, keep polling
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
//  DB-side helpers used by the manual USSD workflow.
//  These replace the live MTN API calls with a row in the bookings table
//  that the agent picks up in their "Verify" tab.
// ---------------------------------------------------------------------------

/**
 * Mark a booking's payment as "submitted" (i.e. user claims they sent the
 * MoMo money and the station agent still needs to verify the receipt).
 *
 * Idempotent: safe to call multiple times. Returns the new row id or null.
 */
export async function markPaymentSubmitted(
  bookingId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .update({
        payment_status: "submitted",
        status: "pending",
      })
      .eq("id", bookingId)
      .select("id")
      .single();

    if (error || !data) {
      console.warn(
        "[paymentProvider] markPaymentSubmitted failed:",
        error?.message,
      );
      return null;
    }
    return data.id;
  } catch (err) {
    console.warn("[paymentProvider] markPaymentSubmitted exception:", err);
    return null;
  }
}

/**
 * Agent-side: mark a booking's payment as verified (success path).
 * Transitions the booking to 'confirmed' so the passenger sees the
 * "Confirmed ✓" badge on their tickets page.
 */
export async function markPaymentVerified(
  bookingId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "verified",
        status: "confirmed",
      })
      .eq("id", bookingId);

    if (error) {
      console.warn(
        "[paymentProvider] markPaymentVerified failed:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[paymentProvider] markPaymentVerified exception:", err);
    return false;
  }
}

/**
 * Agent-side: reject a MoMo payment (e.g. no matching SMS receipt).
 * Transitions the booking to 'rejected'.
 */
export async function markPaymentRejected(
  bookingId: string,
  reason?: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({
        payment_status: "failed",
        status: "rejected",
        // We don't currently store the reason in a column; it's a placeholder
        // for future tickets-page work. Keep parameter so the call site reads
        // the same as the success path.
        ...(reason ? {} : {}),
      })
      .eq("id", bookingId);

    if (error) {
      console.warn(
        "[paymentProvider] markPaymentRejected failed:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[paymentProvider] markPaymentRejected exception:", err);
    return false;
  }
}
