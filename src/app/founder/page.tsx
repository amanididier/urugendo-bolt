"use client";

import { Building2, Users, Bus, Ticket, TrendingUp, UserCheck, MapPin, ShieldCheck, BarChart3, ArrowUpRight, Sparkles } from "lucide-react";
import { useFounderData } from "./FounderContext";
import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-[20px] border p-4 sm:p-5 flex flex-col justify-between min-h-[120px] transition-colors ${accent ? "bg-primary text-white border-primary shadow-primary" : "bg-white border-border hover:border-primary/20"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${accent ? "bg-white/20 text-white" : "bg-primary-light text-primary"}`}>{icon}</div>
      <div>
        <div className={`text-[11px] font-bold tracking-widest uppercase ${accent ? "text-white/80" : "text-text-muted"}`}>{label}</div>
        <div className={`text-[22px] sm:text-[24px] font-black tracking-tight leading-none mt-1 ${accent ? "text-white" : "text-text-primary"}`}>{value}</div>
        {sub && <div className={`text-[11px] mt-1 ${accent ? "text-white/80" : "text-text-muted"}`}>{sub}</div>}
      </div>
    </div>
  );
}

function GrowthAlerts({
  stats,
  prevStats,
}: {
  stats: { totalPassengers: number; totalBookings: number } | null;
  prevStats: { totalPassengers: number; totalBookings: number } | null;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const storageKey = "urugendo_founder_growth_dismissed";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDismissed(JSON.parse(raw));
    } catch {}
  }, []);
  const dismiss = (id: string) => {
    const nxt = Array.from(new Set([...dismissed, id]));
    setDismissed(nxt);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nxt));
    } catch {}
  };
  if (!stats || !prevStats) return null;
  const alerts: { id: string; title: string; body: string }[] = [];
  const dUsers = stats.totalPassengers - prevStats.totalPassengers;
  if (dUsers > 0) {
    const pct = prevStats.totalPassengers > 0 ? (dUsers / prevStats.totalPassengers) * 100 : 100;
    if (dUsers >= 500 || pct >= 25) alerts.push({ id: `users:${stats.totalPassengers}`, title: "Users surged", body: `Passengers grew by ${dUsers.toLocaleString()} (${pct.toFixed(0)}%) — now ${stats.totalPassengers.toLocaleString()}.` });
  }
  const dBookings = stats.totalBookings - prevStats.totalBookings;
  if (dBookings > 0) {
    const pctB = prevStats.totalBookings > 0 ? (dBookings / prevStats.totalBookings) * 100 : 100;
    if (dBookings >= 200 || pctB >= 25) alerts.push({ id: `bookings:${stats.totalBookings}`, title: "Bookings surged", body: `Bookings grew by ${dBookings.toLocaleString()} (${pctB.toFixed(0)}%) — now ${stats.totalBookings.toLocaleString()}.` });
  }
  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;
  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div key={a.id} className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-3">
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Bell size={16} />
            </div>
            <div>
              <div className="text-[13px] font-black text-amber-900">{a.title}</div>
              <div className="text-[12px] text-amber-800 leading-snug">{a.body}</div>
            </div>
          </div>
          <button type="button" onClick={() => dismiss(a.id)} className="p-1.5 rounded-full hover:bg-amber-100 text-amber-700">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function FounderOverviewPage() {
  const { stats, prevStats, loading } = useFounderData();

  return (
    <div className="space-y-6">
      <GrowthAlerts
        stats={stats ? { totalPassengers: stats.totalPassengers, totalBookings: stats.totalBookings } : null}
        prevStats={prevStats ? { totalPassengers: prevStats.totalPassengers, totalBookings: prevStats.totalBookings } : null}
      />

      <div className="bg-primary rounded-[20px] p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"><BarChart3 size={18} /></div>
          <div>
            <h2 className="text-[15px] font-black tracking-tight">Overview</h2>
            <p className="text-[12px] text-white/80">Live from Supabase — verified numbers only</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[120px] bg-white rounded-[20px] border border-border animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={<Building2 size={16} />} label="Agencies" value={stats.totalAgencies} />
          <StatCard icon={<MapPin size={16} />} label="Branches" value={stats.totalBranches} />
          <StatCard icon={<Bus size={16} />} label="Trips" value={stats.totalTrips} />
          <StatCard icon={<Ticket size={16} />} label="Bookings" value={stats.totalBookings} sub={`${stats.totalPendingAgents} agents pending`} />
          <StatCard icon={<Users size={16} />} label="Passengers" value={stats.totalPassengers} />
          <StatCard icon={<UserCheck size={16} />} label="Agents" value={stats.totalAgents} />
          <StatCard icon={<ShieldCheck size={16} />} label="Managers" value={stats.totalManagers} />
          <StatCard accent icon={<TrendingUp size={16} />} label="Verified revenue" value={`${stats.totalVerifiedRevenue.toLocaleString()} RWF`} sub="payment verified" />
        </div>
      ) : null}

      <div className="bg-white rounded-[20px] border border-border p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0"><Sparkles size={16} /></div>
        <div>
          <h3 className="text-[12px] font-bold tracking-widest uppercase text-text-muted">Founder note</h3>
          <p className="text-[13px] leading-relaxed mt-1 text-text-secondary">
            This studio is detached from the user apps — no passenger, agent, or manager route links here, and no shared session. Add agencies under Agencies, then create and approve their managers under Managers. Insights shows the real loved trips and revenue.
          </p>
        </div>
      </div>
    </div>
  );
}
