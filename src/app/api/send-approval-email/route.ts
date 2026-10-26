import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, agentName, status, branchName } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Recipient email is required" },
        { status: 400 },
      );
    }

    // Optional: Log approval email dispatch to database or execute provider call
    console.log(
      `Sending approval email to ${email} for agent ${agentName} at branch ${branchName} with status: ${status}`,
    );

    // If you are using an external service like Resend or SendGrid, place your fetch call here:
    /*
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Urugendo <noreply@urugendo.rw>',
        to: [email],
        subject: `Your Urugendo Agent Status: ${status.toUpperCase()}`,
        html: `<p>Hello ${agentName},</p><p>Your request for branch <strong>${branchName}</strong> has been <strong>${status}</strong>.</p>`,
      }),
    });
    */

    return NextResponse.json(
      { success: true, message: "Approval email processed successfully" },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error processing approval email:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
