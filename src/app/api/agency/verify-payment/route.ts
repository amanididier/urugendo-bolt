import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await request.json();
    if (typeof bookingId !== "string" || !bookingId.trim()) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: agent, error: agentError } = await admin
      .from("agency_agents")
      .select("id, status")
      .eq("email", user.email)
      .maybeSingle();

    if (agentError || !agent || agent.status !== "approved") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, payment_status, user_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.payment_status !== "submitted") {
      return NextResponse.json(
        { error: "Booking is not awaiting payment verification" },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from("bookings")
      .update({ payment_status: "verified", status: "confirmed" })
      .eq("id", bookingId)
      .eq("payment_status", "submitted");
    if (updateError) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
    }

    if (booking.user_id) {
      await admin.from("notifications").insert({
        user_id: booking.user_id,
        title: "Payment confirmed",
        message: "Your payment has been verified. Your ticket is ready.",
        type: "booking",
        action_url: "/tickets",
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
