"use client";

import { BarChart3, Sparkles, TrendingUp, ArrowUpRight } from "lucide-react";
import { useFounderData } from "../FounderContext";

export default function FounderAnalyticsPage() {
  const { popularTrips, agencyRevenue, loading } = useFounderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-black tracking-tight text-text-primary">Insights</h1>
        <p className="text-[13px] text-text-muted">Most loved trips and revenue — from real verified bookings.</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-2">
          <Sparkles size={16} className="text-primary" /> Most loved trips
        </h3>
        <p className="text-[12px] text-text-muted">Ranked by real booking count</p>
        <div className="mt-3 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-surface-secondary rounded-xl animate-pulse" />)
          ) : popularTrips.length === 0 ? (
            <p className="text-[13px] text-text-muted">No bookings yet — trips will appear here once passengers book.</p>
          ) : (
            popularTrips.map((t, i) => (
              <div key={t.route} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-border bg-white">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
                  <span className="text-[13px] font-bold text-text-primary">{t.route}</span>
                </div>
                <span className="text-[13px] font-bold text-text-muted">{t.count} bookings</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> Revenue by agency
        </h3>
        <p className="text-[12px] text-text-muted">Verified bookings only</p>
        <div className="mt-3 space-y-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 bg-surface-secondary rounded-xl animate-pulse" />)
          ) : agencyRevenue.length === 0 ? (
            <p className="text-[13px] text-text-muted">No verified revenue yet.</p>
          ) : (
            agencyRevenue.map((r) => (
              <div key={r.agency} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-secondary border border-border">
                <div>
                  <div className="text-[13px] font-bold text-text-primary">{r.agency}</div>
                  <div className="text-[11px] text-text-muted">{r.passengers} verified · {r.revenue.toLocaleString()} RWF</div>
                </div>
                <ArrowUpRight size={16} className="text-text-muted" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-primary rounded-2xl p-5 text-white">
        <h3 className="text-[12px] font-bold tracking-widest uppercase opacity-80">Founder note</h3>
        <p className="text-[13px] leading-relaxed mt-2 opacity-95">
          This studio is detached from the user apps — no passenger, agent, or manager route links here, and no shared session. Add agencies under Agencies, then create and approve their managers under Managers. Stats on the Dashboard read directly from Supabase.
        </p>
      </div>
    </div>
  );
}
