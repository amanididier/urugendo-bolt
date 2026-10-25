import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const body = await req.json();
    const token = String(body.sessionToken || "");
    if (token.length < 60) return json({ error: "Manager session is required." }, 401);
    const tokenHash = await sha256(token);
    const { data: session, error: sessionError } = await db.from("agency_manager_sessions")
      .select("id,manager_id,expires_at,revoked_at,manager:agency_managers(id,name,email,agency_name,is_active)")
      .eq("token_hash", tokenHash).maybeSingle();
    if (sessionError || !session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now() || session.manager?.is_active === false) {
      return json({ error: "Manager session expired. Sign in again." }, 401);
    }
    const action = String(body.action || "list");
    if (action === "logout") {
      await db.from("agency_manager_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
      return json({ ok: true });
    }
    const { data: operator, error: operatorError } = await db.from("operators")
      .select("id,name").ilike("name", String(session.manager.agency_name || "")).maybeSingle();
    if (operatorError || !operator) return json({ error: "This manager's agency is not configured in the operators table yet." }, 409);
    if (action === "list-agents") {
      const { data: agents, error } = await db.from("agency_agents")
        .select("id,name,email,branch_name,phone,created_at,is_approved,status")
        .eq("agency_name", String(session.manager.agency_name || ""))
        .eq("is_approved", false)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ agents: agents || [] });
    }
    if (action === "approve-agent") {
      const agentId = String(body.agentId || "");
      if (!agentId) return json({ error: "Agent ID is required." }, 400);
      const { data: updated, error } = await db.from("agency_agents")
        .update({ is_approved: true, status: "approved" })
        .eq("id", agentId)
        .eq("agency_name", String(session.manager.agency_name || ""))
        .eq("is_approved", false)
        .select("id,name").maybeSingle();
      if (error) throw error;
      if (!updated) return json({ error: "Agent not found for this agency or already approved." }, 404);
      return json({ ok: true, agent: updated });
    }
    if (action === "list") {
      const { data, error } = await db.from("trips")
        .select("id,route_from,route_to,travel_date,departure_time,arrival_time,price,total_seats,available_seats,status,origin_branch,origin_branch_id,destination_branch,destination_branch_id")
        .eq("operator_id", operator.id).order("travel_date", { ascending: true }).limit(100);
      if (error) throw error;
      return json({ trips: data || [] });
    }
    if (action !== "create") return json({ error: "Unknown manager schedule action." }, 400);
    const trip = body.trip || {};
    const from = String(trip.from || "").trim();
    const to = String(trip.to || "").trim();
    const travelDate = String(trip.date || "");
    const departureTime = String(trip.departureTime || "");
    const price = Number(trip.price);
    const totalSeats = Number(trip.totalSeats);
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return json({ error: "Enter different origin and destination stations." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || travelDate < new Date().toISOString().slice(0, 10)) return json({ error: "Choose today or a future travel date." }, 400);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime)) return json({ error: "Enter departure time in 24-hour HH:MM format." }, 400);
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) return json({ error: "Fare must be greater than zero." }, 400);
    if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > 100) return json({ error: "Capacity must be between 1 and 100 seats." }, 400);

    let { data: origin } = await db.from("branches").select("id,name,location").ilike("name", from).limit(1).maybeSingle();
    if (!origin) { const result = await db.from("branches").select("id,name,location").ilike("location", from).limit(1).maybeSingle(); origin = result.data; }
    let { data: destination } = await db.from("branches").select("id,name,location").ilike("name", to).limit(1).maybeSingle();
    if (!destination) { const result = await db.from("branches").select("id,name,location").ilike("location", to).limit(1).maybeSingle(); destination = result.data; }
    const payload = {
      operator_id: operator.id, route_from: from, route_to: to,
      from, to, travel_date: travelDate, date: travelDate,
      departure_time: departureTime, price, currency: "RWF",
      total_seats: totalSeats, available_seats: totalSeats, status: "scheduled",
      origin_branch: origin?.name || from, destination_branch: destination?.name || to,
      origin_branch_id: origin?.id || null, destination_branch_id: destination?.id || null,
      branch_id: origin?.id || null,
    };
    const { data: created, error } = await db.from("trips").insert(payload)
      .select("id,route_from,route_to,travel_date,departure_time,price,total_seats,available_seats,status,origin_branch,origin_branch_id,destination_branch,destination_branch_id").single();
    if (error) throw error;
    return json({ trip: created });
  } catch (error: any) {
    console.error("manager-schedule error:", error?.message || error);
    return json({ error: error?.message || "Could not process manager schedule." }, 500);
  }
});
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
