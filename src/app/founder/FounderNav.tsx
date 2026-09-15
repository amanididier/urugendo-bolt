"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, ShieldCheck, BarChart3, User, LogOut, Crown } from "lucide-react";
import { motion } from "framer-motion";

type TabKey = "dashboard" | "agencies" | "managers" | "analytics";

const TABS: { key: TabKey; href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", href: "/founder", label: "Dashboard", icon: LayoutDashboard },
  { key: "agencies", href: "/founder/agencies", label: "Agencies", icon: Building2 },
  { key: "managers", href: "/founder/managers", label: "Managers", icon: ShieldCheck },
  { key: "analytics", href: "/founder/analytics", label: "Insights", icon: BarChart3 },
];

function activeKey(pathname: string | null): TabKey | "profile" | null {
  if (!pathname) return null;
  if (pathname === "/founder" || pathname === "/founder/") return "dashboard";
  if (pathname.startsWith("/founder/agencies")) return "agencies";
  if (pathname.startsWith("/founder/managers")) return "managers";
  if (pathname.startsWith("/founder/analytics")) return "analytics";
  if (pathname.startsWith("/founder/profile")) return "profile";
  return null;
}

export function FounderShell({ children, email, name, onExit }: { children: React.ReactNode; email: string; name: string; onExit: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeKey(pathname);
  const initial = (name || email || "F").trim().charAt(0).toUpperCase();

  const go = (href: string) => router.push(href);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top bar — Urugendo bright green, like agency/manager */}
      <div className="sticky top-0 z-10 bg-primary border-b border-primary-dark">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 h-[56px] flex items-center justify-between gap-3">
          {/* Left: brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center border border-white/20">
              <Crown size={16} />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-black tracking-tight text-white leading-none">Urugendo Studio</div>
              <div className="text-[11px] font-medium text-white/80 leading-none mt-0.5">Founder</div>
            </div>
          </div>

          {/* Center: top tabs (desktop) — pill on green */}
          <div className="hidden md:flex items-center gap-1 bg-white/15 p-1 rounded-2xl border border-white/20">
            {TABS.map((t) => {
              const isActive = active === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => go(t.href)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors ${isActive ? "bg-white text-primary shadow-sm" : "text-white/90 hover:text-white hover:bg-white/10"}`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Right: profile + exit */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => go("/founder/profile")}
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px] border transition-colors ${active === "profile" ? "bg-white text-primary border-white" : "bg-white/15 text-white border-white/20 hover:bg-white/25"}`}
              title={email}
            >
              {initial}
            </button>
            <button onClick={onExit} className="h-8 px-3 rounded-full border border-white/30 bg-white/15 text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-white/25">
              <LogOut size={14} /> <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Page body — full width on desktop, centered on large */}
      <div className="flex-1 mx-auto w-full max-w-[1440px] 2xl:max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-[88px] md:pb-8">{children}</div>

      {/* Bottom nav — phone only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-border px-2 py-2 flex justify-around items-center z-40 safe-bottom">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => go(t.href)} className="flex flex-col items-center gap-1 flex-1 py-1 relative">
              {isActive && <motion.div layoutId="founder-nav-pill" className="absolute inset-0 bg-primary/10 rounded-xl" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className={`w-9 h-9 rounded-2xl flex items-center justify-center relative z-10 ${isActive ? "bg-primary text-white" : "text-text-muted"}`}>
                <Icon size={18} />
              </span>
              <span className={`text-[10px] font-bold relative z-10 ${isActive ? "text-primary" : "text-text-muted"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
