"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  Bus,
  Ticket,
  TrendingUp,
  UserCheck,
  MapPin,
  Plus,
  ShieldCheck,
  LogOut,
  X,
  Check,
  Loader2,
  Crown,
  BarChart3,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getFounderSession, clearFounderSession, authenticateFounder, persistFounderSession } from "@/lib/founderAuth";
import { generateManagerPasswordHash } from "@/lib/managerAuth";

// Founder-only: hidden from sitemap, not linked anywhere, phone-frame exempt.
// Backdoor principle: no anon can enumerate this table — only service_role via founder-auth.

// ---------- Login ----------
function FounderLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("ishimwemanid@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const res = await authenticateFounder({ email, password });
    setLoading(false);
    if (!res.ok) {
      const msg =
        res.reason === "not_found"
          ? "No founder account with that email."
          : res.reason === "bad_password"
            ? "Incorrect password."
            : res.reason === "missing_fields"
              ? "All fields are required."
              : "Login failed. Try again.";
      setError(msg);
      return;
    }
    persistFounderSession(res.founder);
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]">
        <div className="bg-white rounded-[28px] border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Crown size={20} />
            </div>
            <div>
              <h1 className="text-[18px] font-black tracking-tight text-slate-900">Founder</h1>
              <p className="text-[12px] font-medium text-slate-500">Private — Urugendo Studio</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="ishimwemanid@gmail.com"
                className="mt-1 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-medium focus:outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-medium focus:outline-none focus:border-slate-900"
              />
            </div>
            {error && (
              <p className="text-[12px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Enter Studio"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-center text-slate-400">
            This page is unlisted. No link to it exists in the passenger, agent, or manager apps.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ---------- Helpers ----------
function useFounderGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getFounderSession>>(null);
  useEffect(() => {
    const s = getFounderSession();
    if (!s) {
      setReady(true);
      return;
    }
    setSession(s);
    setReady(true);
  }, []);
  const logout = useCallback(() => {
    clearFounderSession();
    // also sweep founder keys only — leave passenger/manager sessions alone is NOT needed here; founder is isolated
    setSession(null);
    router.replace("/founder");
  }, [router]);
  return { ready, session, logout, setSession };
}

type Stats = {
  totalPassengers: number;
  totalAgents: number;
  totalManagers: number;
  totalAgencies: number;
  totalBranches: number;
  totalTrips: number;
  totalBookings: number;
  totalVerifiedRevenue: number;
  totalPendingAgents: number;
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-2">{icon}</div>
      <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{label}</div>
      <div className="text-[22px] font-black tracking-tight text-slate-900 leading-none mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ---------- Dashboard ----------
function FounderDashboard({
  session,
  onLogout,
}: {
  session: NonNullable<ReturnType<typeof getFounderSession>>;
  onLogout: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agencies, setAgencies] = useState<{ id: string; name: string; branches?: string[] }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string; email: string; agency_name: string; manager_code: string }[]>([]);
  const [popularTrips, setPopularTrips] = useState<{ route: string; count: number; price?: number }[]>([]);
  const [agencyRevenue, setAgencyRevenue] = useState<{ agency: string; revenue: number; passengers: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Add agency form
  const [newAgencyName, setNewAgencyName] = useState("");
  const [creatingAgency, setCreatingAgency] = useState(false);
  const [agencyMsg, setAgencyMsg] = useState("");

  // Add manager form
  const [mgrName, setMgrName] = useState("");
  const [mgrEmail, setMgrEmail] = useState("");
  const [mgrCode, setMgrCode] = useState("");
  const [mgrAgency, setMgrAgency] = useState("");
  const [mgrPassword, setMgrPassword] = useState("manager@123");
  const [creatingMgr, setCreatingMgr] = useState(false);
  const [mgrMsg, setMgrMsg] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, mgrs, branches, trips, bookings, agents, profiles] = await Promise.all([
        supabase.from("operators").select("id,name,branches").order("name"),
        supabase.from("agency_managers").select("id,name,email,agency_name,manager_code").order("agency_name"),
        supabase.from("branches").select("id,agency_name,momo_code"),
        supabase.from("trips").select("id,price,route_from,route_to,operator_id"),
        supabase.from("bookings").select("id,branch_id,trip_id,payment_status,status,fare_amount,created_at,trip:trips(operator_id,price)"),
        supabase.from("agency_agents").select("id,is_approved"),
        supabase.from("profiles").select("id,role"),
      ]);

      const agenciesList = (ops.data || []) as any[];
      setAgencies(agenciesList);
      setManagers(((mgrs.data as any[]) || []).slice(0, 50));
      if (!mgrAgency && agenciesList.length > 0) setMgrAgency(agenciesList[0].name);

      // Stats — real counts
      const totalAgencies = agenciesList.length;
      const totalBranches = (branches.data || []).length;
      const totalTrips = (trips.data || []).length;
      const totalBookings = (bookings.data || []).length;
      const pendingAgents = ((agents.data as any[]) || []).filter((a) => !a.is_approved).length;
      const totalAgents = ((agents.data as any[]) || []).length;
      const passengerProfiles = ((profiles.data as any[]) || []).filter((p) => p.role === "passenger").length;
      // verified revenue: payment_status verified OR status confirmed
      let verifiedRevenue = 0;
      for (const b of (bookings.data as any[]) || []) {
        const isVerified = b.payment_status === "verified" || b.status === "confirmed";
        if (isVerified) verifiedRevenue += Number(b.fare_amount ?? b.trip?.price ?? 0);
      }

      setStats({
        totalPassengers: passengerProfiles,
        totalAgents,
        totalManagers: (mgrs.data || []).length,
        totalAgencies,
        totalBranches,
        totalTrips,
        totalBookings,
        totalVerifiedRevenue: verifiedRevenue,
        totalPendingAgents: pendingAgents,
      });

      // Popular trips by booking count
      const tripCounts: Record<string, { count: number; price: number; route: string }> = {};
      for (const b of (bookings.data as any[]) || []) {
        const tid = b.trip_id;
        if (!tid) continue;
        const tripRow = (trips.data as any[])?.find((t) => t.id === tid);
        const route = tripRow ? `${tripRow.route_from} → ${tripRow.route_to}` : "Unknown route";
        const entry = tripCounts[route] || { count: 0, price: Number(tripRow?.price ?? 0), route };
        entry.count += 1;
        tripCounts[route] = entry;
      }
      const sorted = Object.values(tripCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setPopularTrips(sorted);

      // Revenue per agency (via branch→agency_name + trip→operator)
      // Build branch agency map
      const branchAgency: Record<string, string> = {};
      for (const br of (branches.data as any[]) || []) branchAgency[br.id] = br.agency_name || "—";
      const opIdToName: Record<string, string> = {};
      for (const op of agenciesList) opIdToName[op.id] = op.name;
      const byAgency: Record<string, { revenue: number; passengers: number }> = {};
      for (const b of (bookings.data as any[]) || []) {
        const isVerified = b.payment_status === "verified" || b.status === "confirmed";
        if (!isVerified) continue;
        const fare = Number(b.fare_amount ?? b.trip?.price ?? 0);
        // prefer branch agency, fallback to trip operator
        let agency = b.branch_id ? branchAgency[b.branch_id] : null;
        if (!agency || agency === "—") {
          const tripRow = (trips.data as any[])?.find((t) => t.id === b.trip_id);
          agency = tripRow?.operator_id ? opIdToName[tripRow.operator_id] || "—" : "—";
        }
        const e = byAgency[agency] || { revenue: 0, passengers: 0 };
        e.revenue += fare;
        e.passengers += 1;
        byAgency[agency] = e;
      }
      setAgencyRevenue(Object.entries(byAgency).map(([agency, v]) => ({ agency, ...v })));
    } finally {
      setLoading(false);
    }
  }, [mgrAgency]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgencyMsg("");
    const name = newAgencyName.trim();
    if (!name) {
      setAgencyMsg("Agency name is required.");
      return;
    }
    setCreatingAgency(true);
    const { error } = await supabase.from("operators").insert({ name, branches: [] as string[] });
    setCreatingAgency(false);
    if (error) {
      setAgencyMsg(error.message.includes("duplicate") || error.message.includes("unique") ? "An agency with that name already exists." : error.message);
      return;
    }
    setAgencyMsg("Agency created.");
    setNewAgencyName("");
    loadAll();
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setMgrMsg("");
    if (!mgrName.trim() || !mgrEmail.trim() || !mgrCode.trim() || !mgrAgency.trim() || !mgrPassword) {
      setMgrMsg("All manager fields are required.");
      return;
    }
    setCreatingMgr(true);
    try {
      const { hash, salt, iterations } = await generateManagerPasswordHash(mgrPassword);
      const { error } = await supabase.from("agency_managers").insert({
        name: mgrName.trim(),
        email: mgrEmail.trim().toLowerCase(),
        manager_code: mgrCode.trim().toUpperCase(),
        agency_name: mgrAgency.trim(),
        password_hash: hash,
        password_salt: salt,
        password_iter: iterations,
        is_active: true,
      });
      if (error) {
        setMgrMsg(
          error.message.includes("duplicate") || error.code === "23505"
            ? "Email or manager code already exists."
            : error.message,
        );
        return;
      }
      setMgrMsg("Manager created and active. They can now log in.");
      setMgrName("");
      setMgrEmail("");
      setMgrCode("");
      loadAll();
    } catch (err: any) {
      setMgrMsg(err?.message || "Failed to create manager.");
    } finally {
      setCreatingMgr(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top bar — full width, own design (not the passenger tab) */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Crown size={16} />
            </div>
            <div>
              <div className="text-[13px] font-black tracking-tight text-slate-900 leading-none">Urugendo Studio</div>
              <div className="text-[11px] font-medium text-slate-500 leading-none mt-0.5">Founder — {session.email}</div>
            </div>
          </div>
          <button onClick={onLogout} className="h-8 px-3 rounded-full border border-slate-200 bg-white text-[12px] font-bold flex items-center gap-1.5">
            <LogOut size={14} /> Exit
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Stats */}
        <div>
          <h2 className="text-[12px] font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
            <BarChart3 size={14} /> Overview
          </h2>
          {loading ? (
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[110px] bg-white rounded-2xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Building2 size={16} />} label="Agencies" value={stats.totalAgencies} />
              <StatCard icon={<MapPin size={16} />} label="Branches" value={stats.totalBranches} />
              <StatCard icon={<Bus size={16} />} label="Trips" value={stats.totalTrips} />
              <StatCard icon={<Ticket size={16} />} label="Bookings" value={stats.totalBookings} sub={`${stats.totalPendingAgents} agents pending`} />
              <StatCard icon={<Users size={16} />} label="Passengers" value={stats.totalPassengers} />
              <StatCard icon={<UserCheck size={16} />} label="Agents" value={stats.totalAgents} />
              <StatCard icon={<ShieldCheck size={16} />} label="Managers" value={stats.totalManagers} />
              <StatCard
                icon={<TrendingUp size={16} />}
                label="Verified revenue"
                value={`${stats.totalVerifiedRevenue.toLocaleString()} RWF`}
                sub="payment verified"
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agencies & managers */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[13px] font-black text-slate-900 flex items-center gap-2">
                <Building2 size={16} /> Agencies
              </h3>
              <div className="mt-3 space-y-2">
                {agencies.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No agencies yet. Add your first below.</p>
                ) : (
                  agencies.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[13px] font-bold text-slate-900">{a.name}</span>
                      <span className="text-[11px] font-medium text-slate-500">{a.branches?.length ?? 0} branches seeded</span>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCreateAgency} className="mt-4 space-y-2">
                <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Add agency</label>
                <div className="flex gap-2">
                  <input
                    value={newAgencyName}
                    onChange={(e) => setNewAgencyName(e.target.value)}
                    placeholder="e.g. Horizon Express"
                    className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium focus:outline-none focus:border-slate-900"
                  />
                  <button disabled={creatingAgency} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60">
                    {creatingAgency ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                  </button>
                </div>
                {agencyMsg && <p className="text-[12px] font-semibold text-slate-600">{agencyMsg}</p>}
              </form>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[13px] font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck size={16} /> Managers
              </h3>
              <div className="mt-3 space-y-2">
                {managers.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No managers yet.</p>
                ) : (
                  managers.map((m) => (
                    <div key={m.id} className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[13px] font-bold text-slate-900">
                        {m.name} <span className="font-mono text-[11px] text-slate-500">· {m.manager_code}</span>
                      </div>
                      <div className="text-[12px] text-slate-600">
                        {m.email} · {m.agency_name}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCreateManager} className="mt-4 space-y-3">
                <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Approve & create manager</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={mgrName}
                    onChange={(e) => setMgrName(e.target.value)}
                    placeholder="Full name"
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium focus:outline-none focus:border-slate-900"
                  />
                  <input
                    value={mgrEmail}
                    onChange={(e) => setMgrEmail(e.target.value)}
                    placeholder="manager@agency.com"
                    type="email"
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={mgrCode}
                    onChange={(e) => setMgrCode(e.target.value.toUpperCase())}
                    placeholder="MGR-003"
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-mono font-bold focus:outline-none focus:border-slate-900 uppercase"
                  />
                  <select
                    value={mgrAgency}
                    onChange={(e) => setMgrAgency(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium focus:outline-none focus:border-slate-900"
                  >
                    {agencies.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={mgrPassword}
                  onChange={(e) => setMgrPassword(e.target.value)}
                  placeholder="Initial password"
                  type="password"
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[13px] font-medium focus:outline-none focus:border-slate-900"
                />
                <button disabled={creatingMgr} className="w-full h-10 rounded-xl bg-slate-900 text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {creatingMgr ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create manager
                </button>
                {mgrMsg && <p className="text-[12px] font-semibold text-slate-600">{mgrMsg}</p>}
              </form>
            </div>
          </div>

          {/* Loved trips & agency revenue */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[13px] font-black text-slate-900 flex items-center gap-2">
                <Sparkles size={16} /> Most loved trips
              </h3>
              <p className="text-[12px] text-slate-500">Ranked by real booking count</p>
              <div className="mt-3 space-y-2">
                {popularTrips.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No bookings yet — trips will appear here once passengers book.</p>
                ) : (
                  popularTrips.map((t, i) => (
                    <div key={t.route} className="flex items-center justify-between py-2 px-3 rounded-xl border border-slate-200 bg-white">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                        <span className="text-[13px] font-bold text-slate-900">{t.route}</span>
                      </div>
                      <span className="text-[13px] font-bold text-slate-600">{t.count} bookings</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-[13px] font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={16} /> Revenue by agency
              </h3>
              <p className="text-[12px] text-slate-500">Verified bookings only</p>
              <div className="mt-3 space-y-2">
                {agencyRevenue.length === 0 ? (
                  <p className="text-[13px] text-slate-500">No verified revenue yet.</p>
                ) : (
                  agencyRevenue.map((r) => (
                    <div key={r.agency} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{r.agency}</div>
                        <div className="text-[11px] text-slate-500">{r.passengers} verified · {r.revenue.toLocaleString()} RWF</div>
                      </div>
                      <ArrowUpRight size={16} className="text-slate-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-5 text-white">
              <h3 className="text-[12px] font-bold tracking-widest uppercase opacity-70">Founder note</h3>
              <p className="text-[13px] leading-relaxed mt-2 opacity-90">
                This studio is detached from the user apps — no passenger, agent, or manager route links here, and no shared session. Add agencies first, then create and approve their managers. Real stats above read directly from Supabase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FounderPage() {
  const { ready, session, logout, setSession } = useFounderGuard();
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={20} />
      </div>
    );
  }

  if (!session) {
    return (
      <FounderLogin
        onSuccess={() => {
          const s = getFounderSession();
          if (s) setSession(s);
          setJustLoggedIn(true);
        }}
      />
    );
  }

  return <FounderDashboard session={session} onLogout={logout} />;
}
