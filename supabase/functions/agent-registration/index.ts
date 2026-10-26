import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const db = createClient(url, serviceKey);
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !publicKey) return json({ error: "Sign in is required." }, 401);
    const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user?.id || !user.email) return json({ error: "Your session is invalid. Sign in again." }, 401);

    const body = await req.json();
    const fullName = String(body.fullName || user.user_metadata?.full_name || "").trim();
    const operatorId = String(body.operatorId || "");
    const branchName = String(body.branchName || "").trim();
    if (!fullName || !operatorId || !branchName) return json({ error: "Name, agency and branch are required." }, 400);

    const { data: agent, error: agentError } = await db.from("agency_agents")
      .select("id,email,agency_name,branch_name,branch_id,is_approved,status")
      .eq("email", user.email.trim().toLowerCase()).maybeSingle();
    if (agentError || !agent) return json({ error: "No agent registration was found for this account. Register as an agent first." }, 403);
    if (String(agent.agency_name || "").trim().toLowerCase() !== String(body.operatorName || "").trim().toLowerCase()) {
      return json({ error: "The selected agency does not match your pending registration." }, 403);
    }
    if (String(agent.branch_name || "").trim().toLowerCase() !== branchName.toLowerCase()) {
      return json({ error: "The selected branch does not match your pending registration." }, 403);
    }
    const { data: operator, error: operatorError } = await db.from("operators").select("id,name").eq("id", operatorId).maybeSingle();
    if (operatorError || !operator || operator.name.trim().toLowerCase() !== String(agent.agency_name || "").trim().toLowerCase()) {
      return json({ error: "Agency assignment could not be verified." }, 403);
    }
    const { data: branches, error: branchError } = await db.from("branches")
      .select("id,name,location,agency_name").ilike("agency_name", operator.name).limit(200);
    if (branchError) return json({ error: "Could not verify the agency branch." }, 500);
    const branch = (branches || []).find((b: any) =>
      String(b.name || "").trim().toLowerCase() === branchName.toLowerCase() ||
      String(b.location || "").trim().toLowerCase() === branchName.toLowerCase()
    );
    if (!branch) return json({ error: "This branch is not assigned to the selected agency." }, 403);

    const approved = agent.is_approved === true || agent.status === "approved";
    const { error: profileError } = await db.from("profiles").upsert({
      id: user.id, full_name: fullName, email: user.email,
      operator_id: operator.id, branch: branch.name, role: "agent",
      status: approved ? "approved" : "pending",
    }, { onConflict: "id" });
    if (profileError) throw new Error("Could not set up your agency profile.");

    const { error: linkError } = await db.from("agency_agents").update({ user_id: user.id, branch_id: agent.branch_id || branch.id })
      .eq("id", agent.id);
    if (linkError) throw new Error("Could not link your agent registration.");

    return json({ ok: true, approved, status: approved ? "approved" : "pending", profile: { id: user.id, full_name: fullName, operator_id: operator.id, branch: branch.name, role: "agent" } });
  } catch (error: any) {
    console.error("agent-registration failed:", error?.message || error);
    return json({ error: error?.message || "Could not complete agent registration." }, 500);
  }
});
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
