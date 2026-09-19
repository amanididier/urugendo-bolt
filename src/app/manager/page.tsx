"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  User,
  TrendingUp,
  Download,
  CheckCircle2,
  Bell,
  Lock,
  Globe,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Calendar,
  X,
  DollarSign,
  MapPin,
  Bus,
  Check,
  KeyRound,
  QrCode,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  fetchAgencyBranches,
  createNewBranch,
  deleteBranch,
  fetchBranchRevenue,
  BranchRecord,
  PeriodStats,
  agencyPrefix,
  nextStationCode,
} from "@/lib/branchService";
import {
  getStoredManager,
  clearManagerSession,
  getStoredManagerId,
  updateManagerPassword,
} from "@/lib/managerAuth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TimePeriod = "today" | "monthly" | "yearly" | "custom";
type Tab = "home" | "branches" | "profile";

// Agent record as stored in the DB
interface PendingAgent {
  id: string;
  name: string;
  email: string;
  branchName: string;
  phone: string;
  signedUpAt: string;
}

// Logged-in manager session
interface ManagerSession {
  id: string;
  name: string;
  email: string;
  managerCode: string;
  agencyName: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatRwf(n: number): string {
  return `RWF ${n.toLocaleString()}`;
}

function periodLabel(period: TimePeriod, customDate: string): string {
  switch (period) {
    case "today":
      return "Today";
    case "monthly":
      return "This Month";
    case "yearly":
      return "This Year";
    case "custom": {
      const [year, month, day] = customDate.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PeriodSelector({
  value,
  onChange,
  customDate,
  onCustomDateChange,
}: {
  value: TimePeriod;
  onChange: (p: TimePeriod) => void;
  customDate: string;
  onCustomDateChange: (d: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex bg-white p-1 rounded-2xl border border-border shadow-sm gap-1">
        {(["today", "monthly", "yearly", "custom"] as TimePeriod[]).map(
          (period) => (
            <button
              key={period}
              type="button"
              onClick={() => onChange(period)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                value === period
                  ? "bg-primary text-white shadow-md"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {period}
            </button>
          ),
        )}
      </div>

      {value === "custom" && (
        <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-border">
          <Calendar size={18} className="text-primary" />
          <input
            type="date"
            value={customDate}
            onChange={(e) => onCustomDateChange(e.target.value)}
            className="text-xs font-bold text-text-primary outline-none w-full bg-transparent"
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div>
        <h1 className="text-[22px] font-extrabold text-text-primary leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[12px] text-text-muted font-medium">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AgencyManagerApp() {
  const router = useRouter();

  // ── Session ──────────────────────────────────────────────────────────
  const [session, setSession] = useState<ManagerSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // ── Navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showPendingAgentsView, setShowPendingAgentsView] = useState(false);

  // ── Time / Filtering ──────────────────────────────────────────────────
  type RevenueCategory = "overall" | "urugendo" | "paper";
  const [revenueCategory, setRevenueCategory] = useState<RevenueCategory>("overall");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("today");
  const [customDate, setCustomDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // ── Data (always real — no seed fallbacks) ──────────────────────────
  // Batch 5: starts empty; filled by loadData useEffect below.
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);

  // Real period-keyed stats aggregated from the bookings table.
  const [periodStats, setPeriodStats] = useState<
    Record<string, PeriodStats>
  >({});
  const [statsNonce, setStatsNonce] = useState(0);

  // ── Branch form state ────────────────────────────────────────────────
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [newMomoInput, setNewMomoInput] = useState("");
  const [newPhoneInput, setNewPhoneInput] = useState("");
  const [momoError, setMomoError] = useState("");

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchNameInput, setNewBranchNameInput] = useState("");
  const [newBranchLocationInput, setNewBranchLocationInput] = useState("");
  const [newBranchMomoInput, setNewBranchMomoInput] = useState("");
  const [newBranchPhoneInput, setNewBranchPhoneInput] = useState("");
  const [newBranchStationCodeInput, setNewBranchStationCodeInput] = useState("");
  const [newBranchError, setNewBranchError] = useState("");
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [deletingBranchName, setDeletingBranchName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPasswordDrawer, setShowPasswordDrawer] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const [language, setLanguage] = useState<"rw" | "en" | "fr">("rw");
  const [toastVisible, setToastVisible] = useState(false);

  // ── Toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
      setToastVisible(false);
    }, 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Session guard ───────────────────────────────────────────────────
  // Batch 5: redirect to login if no manager session is found.
  useEffect(() => {
    const mgr = getStoredManager();
    if (!mgr) {
      router.replace("/agency/agency-login");
      return;
    }
    setSession(mgr as ManagerSession);
    setCheckingSession(false);
  }, [router]);

  // ── Load data from Supabase ────────────────────────────────────────
  const loadData = useCallback(async () => {
    const agencyName = session?.agencyName;
    // Fetch only this agency's branches — branch isolation by parent
    const dbBranches = await fetchAgencyBranches(agencyName);
    setBranches(dbBranches);

    // Fetch unapproved agents for this agency only
    try {
      let q = supabase
        .from("agency_agents")
        .select("id, name, email, branch_name, phone, created_at")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });
      if (agencyName) q = q.eq("agency_name", agencyName);
      const { data: agentData, error: agentErr } = await q;

      if (agentErr) {
        console.warn("[manager] agents fetch error:", agentErr.message);
        return;
      }
      setPendingAgents(
        (agentData || []).map((a: any) => ({
          id: a.id,
          name: a.name || "Agent",
          email: a.email,
          branchName: a.branch_name || "—",
          phone: a.phone || "—",
          signedUpAt: relativeTime(new Date(a.created_at)),
        })),
      );
    } catch (err) {
      console.warn("[manager] pending agents fetch error:", err);
    }
  }, [session?.agencyName]);

  useEffect(() => {
    if (checkingSession) return;
    loadData();

    // Realtime: manager live feed — agency_agents + branches + bookings (no refresh)
    const agencyFilter = session?.agencyName ? `agency_name=eq.${session.agencyName}` : undefined;
    const chAgents = supabase
      .channel(`manager-agents-${session?.agencyName ?? "all"}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "agency_agents", ...(agencyFilter ? { filter: agencyFilter } : {}) }, (payload: any) => {
        const row = payload.new;
        const oldRow = payload.old;
        if (payload.eventType === "INSERT" && row && row.is_approved !== true) {
          setPendingAgents((prev) => [{ id: row.id, name: row.name || "New Agent", email: row.email, branchName: row.branch_name || "—", phone: row.phone || "—", signedUpAt: "Just now" }, ...prev]);
          showToast(`New agent signup: ${row.name}`);
        }
        if (payload.eventType === "UPDATE" && row) {
          // approved or status changed — remove from pending if no longer pending
          if (row.is_approved === true || row.status === "approved") setPendingAgents((prev) => prev.filter((a) => a.id !== row.id));
          else setPendingAgents((prev) => prev.map((a) => (a.id === row.id ? { ...a, name: row.name, email: row.email, branchName: row.branch_name } : a)));
        }
        if (payload.eventType === "DELETE" && oldRow) setPendingAgents((prev) => prev.filter((a) => a.id !== oldRow.id));
      })
      .subscribe();
    const chBranches = supabase
      .channel(`manager-branches-${session?.agencyName ?? "all"}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "branches", ...(agencyFilter ? { filter: agencyFilter } : {}) }, (payload: any) => {
        const row = payload.new;
        if (payload.eventType === "INSERT" && row) {
          setBranches((prev) => {
            if (prev.some((b) => b.id === row.id)) return prev;
            return [{ id: row.id, name: row.name, location: row.location, agencyName: row.agency_name, stationCode: row.station_code, momoCode: row.momo_code, phone: row.phone, agentName: row.agent_name, agentEmail: row.agent_email, stats: row.stats } as any, ...prev];
          });
        }
        if (payload.eventType === "UPDATE" && row) setBranches((prev) => prev.map((b) => (b.id === row.id ? { ...b, name: row.name, location: row.location, momoCode: row.momo_code, stationCode: row.station_code, phone: row.phone } : b)));
        if (payload.eventType === "DELETE" && payload.old) setBranches((prev) => prev.filter((b) => b.id !== payload.old.id));
      })
      .subscribe();
    const chBookings = supabase
      .channel(`manager-bookings-${session?.agencyName ?? "all"}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "bookings" }, () => {
        setStatsNonce((n) => n + 1);
      })
      .subscribe();
    // Agents recording empty seats changes the paper-ticket half of the math.
    const chTrips = supabase
      .channel(`manager-trips-${session?.agencyName ?? "all"}`)
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "trips" }, () => {
        setStatsNonce((n) => n + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chAgents);
      supabase.removeChannel(chBranches);
      supabase.removeChannel(chBookings);
      supabase.removeChannel(chTrips);
    };
  }, [checkingSession, loadData, showToast, session?.agencyName]);

  // ── Revenue stats (re-fetch when branches, period or live data change) ──
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (branches.length === 0 || checkingSession) return;
    let cancelled = false;
    setStatsLoading(true);

    const period =
      selectedPeriod === "custom" ? "today" : (selectedPeriod as "today" | "monthly" | "yearly");

    async function loadStats() {
      const entries = await Promise.all(
        branches.map(async (b) => {
          const stats = await fetchBranchRevenue(b.id, period);
          return [b.id, stats] as const;
        }),
      );
      if (!cancelled) {
        const map: Record<string, PeriodStats> = {};
        for (const [id, stats] of entries) map[id] = stats;
        setPeriodStats(map);
        setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [branches, selectedPeriod, checkingSession, statsNonce]);

  // ── Computed ───────────────────────────────────────────────────────
  // The Overall / Urugendo / Paper switch projects every displayed figure
  // onto the selected slice of the manifest math.
  const categoryStats = (stats: PeriodStats) => {
    if (revenueCategory === "urugendo")
      return {
        passengers: stats.urugendoPassengers ?? 0,
        revenue: stats.urugendoRevenue ?? 0,
      };
    if (revenueCategory === "paper")
      return {
        passengers: stats.paperPassengers ?? 0,
        revenue: stats.paperRevenue ?? 0,
      };
    return { passengers: stats.passengers, revenue: stats.revenue };
  };

  const branchStats = branches.map((b) => {
    const raw = periodStats[b.id] ?? { passengers: 0, revenue: 0 };
    return { branch: b, stats: categoryStats(raw) };
  });

  const totalPassengers = branchStats.reduce(
    (acc, b) => acc + b.stats.passengers,
    0,
  );

  const totalRevenue = branchStats.reduce((acc, b) => acc + b.stats.revenue, 0);
  const topBranch = [...branchStats].sort(
    (a, b) => b.stats.revenue - a.stats.revenue,
  )[0];

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleApproveAgent = async (agent: PendingAgent) => {
    setApprovingId(agent.id);
    try {
      const { error } = await supabase
        .from("agency_agents")
        .update({ is_approved: true, status: "approved" })
        .eq("id", agent.id);

      if (error) {
        console.warn("[manager] approve agent error:", error.message);
        showToast(`Failed to approve ${agent.name}. Try again.`);
      } else {
        setPendingAgents((prev) => prev.filter((a) => a.id !== agent.id));
        showToast(`${agent.name} approved successfully!`);
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleSaveBranchDetails = async (branchId: string) => {
    if (!/^\d{6,7}$/.test(newMomoInput)) {
      setMomoError("MoMo Pay code must be 6 or 7 digits.");
      return;
    }

    const targetBranch = branches.find((b) => b.id === branchId);
    if (!targetBranch) return;

    setBranches((prev) =>
      prev.map((b) =>
        b.id === branchId
          ? { ...b, momoCode: newMomoInput, phone: newPhoneInput }
          : b,
      ),
    );

    try {
      const { error } = await supabase
        .from("branches")
        .update({ momo_code: newMomoInput, phone: newPhoneInput })
        .eq("id", branchId);

      if (error) {
        console.warn("[manager] branch update error:", error.message);
      }
    } catch (err) {
      console.warn("[manager] branch update sync skipped:", err);
    }

    setEditingBranchId(null);
    setNewMomoInput("");
    setNewPhoneInput("");
    setMomoError("");
    showToast(`Branch details for ${targetBranch.name} updated!`);
  };

  // Verified DB insert: only add to local list after Supabase confirms, with
  // exact agency_name + station_code so `select * from branches where agency_name = :agency`
  // and login verify against station_code works. Auto-fills FAS-xxx / VIR-xxx.
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewBranchError("");

    if (
      !newBranchNameInput.trim() ||
      !newBranchLocationInput.trim() ||
      !newBranchMomoInput.trim() ||
      !newBranchPhoneInput.trim()
    ) {
      setNewBranchError("Please fill in all required fields.");
      return;
    }

    if (!/^\d{6,7}$/.test(newBranchMomoInput.trim())) {
      setNewBranchError("MoMo code must be 6 or 7 digits.");
      return;
    }

    const agencyForInsert = (session?.agencyName || "").trim();
    if (!agencyForInsert) {
      setNewBranchError(
        "Agency is not set for this manager. Sign in again via Manager Portal.",
      );
      return;
    }

    const codeRaw = newBranchStationCodeInput.trim().toUpperCase();
    const prefix = agencyPrefix(agencyForInsert);
    const stationCode = codeRaw || nextStationCode(agencyForInsert, branches.map((b) => b.stationCode || ""));
    if (!new RegExp(`^${prefix}-\\d{3}$`).test(stationCode)) {
      setNewBranchError(`Station security code must be ${prefix}-XXX (e.g. ${prefix}-001).`);
      return;
    }

    setIsCreatingBranch(true);
    const payload: BranchRecord = {
      id: crypto.randomUUID(),
      name: newBranchNameInput.trim(),
      location: newBranchLocationInput.trim(),
      agencyName: agencyForInsert,
      stationCode,
      momoCode: newBranchMomoInput.trim() || null,
      phone: newBranchPhoneInput.trim(),
      agentName: "Assigned Agent",
      agentEmail: `${newBranchNameInput
        .toLowerCase()
        .replace(/\s+/g, "")
        .trim()}@${(agencyForInsert || "agency").toLowerCase().replace(/\s+/g, "")}.rw`,
      stats: {
        today: { passengers: 0, revenue: 0 },
        monthly: { passengers: 0, revenue: 0 },
        yearly: { passengers: 0, revenue: 0 },
      },
    };

    const ok = await createNewBranch(payload);
    setIsCreatingBranch(false);

    if (!ok) {
      setNewBranchError(
        "Failed to save branch to database. Check connection / RLS and try again.",
      );
      return;
    }

    // Only update local list after verified DB insert — prevents refresh wipe.
    setBranches((prev) => [payload, ...prev]);
    setShowAddBranchModal(false);
    setNewBranchNameInput("");
    setNewBranchLocationInput("");
    setNewBranchMomoInput("");
    setNewBranchPhoneInput("");
    setNewBranchStationCodeInput("");
    setNewBranchError("");
    showToast(`Branch ${payload.name} added successfully!`);
  };

  const handleDeleteBranchConfirm = async () => {
    if (!deletingBranchId) return;
    setIsDeleting(true);
    const targetName = deletingBranchName;

    const ok = await deleteBranch(deletingBranchId);
    setIsDeleting(false);
    setDeletingBranchId(null);
    setDeletingBranchName("");

    if (ok) {
      setBranches((prev) => prev.filter((b) => b.id !== deletingBranchId));
      showToast(`Branch ${targetName} deleted successfully.`);
    } else {
      showToast(`Failed to delete branch ${targetName}. Try again.`);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!session?.id) {
      setPasswordError("Session error. Please sign in again.");
      return;
    }
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setPasswordError("Please fill in all password fields.");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    const res = await updateManagerPassword(
      session.id,
      currentPasswordInput,
      newPasswordInput,
    );
    setIsChangingPassword(false);

    if (!res.ok) {
      setPasswordError(res.message);
    } else {
      setPasswordSuccess("Password changed successfully!");
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      showToast("Master password updated successfully!");
      setTimeout(() => {
        setShowPasswordDrawer(false);
        setPasswordSuccess("");
      }, 1500);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearManagerSession();
    // Also sweep any leftover urugendo_ / sb- keys so next user on this device cannot reuse stale session
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("urugendo_") || k.startsWith("sb-"))) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    router.push("/agency/agency-login");
  };

  const handleGenerateReport = () => {
    const label = periodLabel(selectedPeriod, customDate);
    const nowStr = new Date().toLocaleString();
    const rawTotal = branches.reduce(
      (acc, b) => {
        const s = periodStats[b.id] ?? {} as any;
        return {
          passengers: acc.passengers + (s.passengers ?? 0),
          revenue: acc.revenue + (s.revenue ?? 0),
          urugendoPassengers: acc.urugendoPassengers + (s.urugendoPassengers ?? 0),
          urugendoRevenue: acc.urugendoRevenue + (s.urugendoRevenue ?? 0),
          paperPassengers: acc.paperPassengers + (s.paperPassengers ?? 0),
          paperRevenue: acc.paperRevenue + (s.paperRevenue ?? 0),
        };
      },
      { passengers: 0, revenue: 0, urugendoPassengers: 0, urugendoRevenue: 0, paperPassengers: 0, paperRevenue: 0 },
    );

    const sorted = [...branches]
      .map((b) => {
        const s = periodStats[b.id] ?? {} as any;
        return {
          branch: b,
          passengers: s.passengers ?? 0,
          revenue: s.revenue ?? 0,
          urugendoPassengers: s.urugendoPassengers ?? 0,
          urugendoRevenue: s.urugendoRevenue ?? 0,
          paperPassengers: s.paperPassengers ?? 0,
          paperRevenue: s.paperRevenue ?? 0,
          trips: s.manifestTrips ?? s.tripCount ?? 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const maxRev = Math.max(1, sorted[0]?.revenue || 1);
    const totalPct = (n: number) => `${((n / (rawTotal.revenue || 1)) * 100).toFixed(1)}%`;

    const timestamp = `${selectedPeriod}-${Date.now()}`;

    // ── CSV (spreadsheet-friendly) ──────────────────────────────────
    const csvHeader =
      "Rank,Branch,Location,Station Code,Agent Name,Agent Email,Phone,MoMo Code,"
      + "Urugendo Digital Pax,Urugendo Digital Revenue (RWF),Paper Tickets Pax,Paper Revenue (RWF),"
      + "Total Pax,Total Revenue (RWF),Share of Total\n";
    const csvRows = sorted
      .map((r, i) =>
        [
          i + 1,
          `"${r.branch.name}"`,
          `"${r.branch.location}"`,
          r.branch.stationCode || "",
          `"${r.branch.agentName || ""}"`,
          `"${r.branch.agentEmail || ""}"`,
          `"${r.branch.phone || ""}"`,
          `*${r.branch.momoCode || "—"}#`,
          r.urugendoPassengers,
          r.urugendoRevenue,
          r.paperPassengers,
          r.paperRevenue,
          r.passengers,
          r.revenue,
          totalPct(r.revenue),
        ].join(","),
      )
      .join("\n");
    const csv =
      csvHeader
      + csvRows
      + `\n"","","","","","","","TOTAL",${rawTotal.urugendoPassengers},${rawTotal.urugendoRevenue},${rawTotal.paperPassengers},${rawTotal.paperRevenue},${rawTotal.passengers},${rawTotal.revenue},"100.0%"`;

    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const aCsv = document.createElement("a");
    aCsv.href = csvUrl;
    aCsv.download = `Urugendo_Report_CSV_${timestamp}.csv`;
    aCsv.click();
    URL.revokeObjectURL(csvUrl);

    // ── HTML (Apple-level design, print-to-PDF ready) ───────────────
    const branchRowsHtml = sorted
      .map((r, i) => {
        const barW = ((r.revenue / maxRev) * 100).toFixed(2);
        const badgeColor = i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500";
        return `
        <tr class="h-12 hover:bg-slate-50/60 transition-colors">
          <td class="text-left px-5 py-3 align-middle">
            <span class="inline-flex items-center gap-2">
              <span class="font-black text-[13px] w-6 h-6 rounded-full ${badgeColor} flex items-center justify-center">${i + 1}</span>
              <span class="font-semibold text-slate-900">${r.branch.name}</span>
            </span>
            <div class="text-[11px] text-slate-500 mt-0.5 ml-8">${r.branch.location} · Code ${r.branch.stationCode || "—"}</div>
          </td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12.5px] text-slate-700">${r.urugendoPassengers.toLocaleString()}</td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12.5px] font-semibold text-emerald-600">${r.urugendoRevenue.toLocaleString()}</td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12.5px] text-slate-700">${r.paperPassengers.toLocaleString()}</td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12.5px] font-semibold text-indigo-600">${r.paperRevenue.toLocaleString()}</td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12.5px] font-bold text-slate-900">${r.passengers.toLocaleString()}</td>
          <td class="text-right px-5 py-3 align-middle">
            <div class="flex items-center gap-2.5 justify-end">
              <div class="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style="width:${barW}%"></div></div>
              <div class="min-w-[110px] text-right">
                <div class="font-mono font-bold text-slate-900 text-[12.5px]">RWF ${r.revenue.toLocaleString()}</div>
                <div class="text-[10px] text-slate-400 font-semibold">${totalPct(r.revenue)} share</div>
              </div>
            </div>
          </td>
          <td class="text-right px-5 py-3 align-middle font-mono text-[12px] text-slate-600">*${r.branch.momoCode || "—"}#</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Urugendo Agency Report — ${session?.agencyName || "Agency"} — ${label}</title>
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  html,body{font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;background:#EEF1F5;color:#0F172A;min-height:100%}
  @page{size:A4;margin:14mm 12mm}
  .page{max-width:1100px;margin:40px auto;padding:0 24px}
  .card{background:#fff;border-radius:28px;box-shadow:0 1px 3px rgba(15,23,42,.06),0 20px 50px -20px rgba(15,23,42,.18);border:1px solid rgba(226,232,240,.8);overflow:hidden}
  .hero{background:linear-gradient(135deg,#00B85C 0%,#009e50 50%,#0A1A12 100%);color:#fff;padding:44px 44px 40px;position:relative;overflow:hidden}
  .hero::after{content:"";position:absolute;right:-100px;top:-80px;width:360px;height:360px;border-radius:50%;background:rgba(255,255,255,.08);filter:blur(10px)}
  .hero::before{content:"";position:absolute;left:-40px;bottom:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.06)}
  .hero-inner{position:relative;z-index:1}
  .brand{display:flex;align-items:center;gap:14px}
  .brand-mark{width:52px;height:52px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px -10px rgba(0,0,0,.3);overflow:hidden}
  .brand-mark img{width:42px;height:42px;object-fit:contain}
  .eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-bottom:6px}
  .h1{font-size:32px;font-weight:900;letter-spacing:-.02em;line-height:1.15}
  .subtitle{font-size:13.5px;color:rgba(255,255,255,.82);font-weight:500;margin-top:8px}
  .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:28px}
  .meta-cell{background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px 16px}
  .meta-label{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.68)}
  .meta-value{font-size:15px;font-weight:800;margin-top:4px}
  .body{padding:36px 44px 44px}
  .section-title{font-size:15px;font-weight:900;color:#0F172A;letter-spacing:-.01em;margin-bottom:16px;display:flex;align-items:center;gap:10px}
  .section-title::before{content:"";width:4px;height:16px;border-radius:4px;background:#00B85C}
  .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:32px}
  .kpi{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:22px;padding:18px 20px;position:relative;overflow:hidden}
  .kpi-accent{position:absolute;right:-18px;top:-18px;width:80px;height:80px;border-radius:50%;opacity:.08}
  .kpi-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B}
  .kpi-value{font-size:24px;font-weight:900;letter-spacing:-.02em;color:#0F172A;margin-top:6px;line-height:1}
  .kpi-sub{font-size:11.5px;color:#475569;font-weight:600;margin-top:8px}
  .pill{display:inline-flex;align-items:center;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.02em}
  .pill-emerald{background:#D1FAE5;color:#065F46}
  .pill-indigo{background:#E0E7FF;color:#3730A3}
  .pill-slate{background:#F1F5F9;color:#475569}
  .mix-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:20px;margin-bottom:32px}
  .mix-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:22px;padding:22px 24px}
  .mix-row{display:flex;align-items:center;gap:14px;margin-top:14px}
  .mix-row:first-of-type{margin-top:16px}
  .mix-swatch{width:14px;height:14px;border-radius:6px;flex-shrink:0}
  .mix-label{font-size:12.5px;font-weight:700;color:#334155;flex:1}
  .mix-amt{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;font-size:13px;color:#0F172A}
  .mix-bar-wrap{height:10px;width:100%;background:#E2E8F0;border-radius:999px;overflow:hidden;margin-top:16px}
  .mix-bar{height:100%;border-radius:999px}
  table{width:100%;border-collapse:separate;border-spacing:0}
  thead th{background:#F8FAFC;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748B;padding:14px 18px;border-bottom:1px solid #E2E8F0;text-align:right}
  thead th:first-child{text-align:left}
  tbody td{border-bottom:1px solid #F1F5F9}
  tbody tr:last-child td{border-bottom:none}
  tfoot td{background:#F8FAFC;border-top:2px solid #0F172A;border-bottom-left-radius:18px;border-bottom-right-radius:18px;padding:16px 18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;font-size:13px;text-align:right;color:#0F172A}
  tfoot td:first-child{text-align:left}
  .wrap{border:1px solid #E2E8F0;border-radius:22px;overflow:hidden;background:#fff}
  .foot{margin-top:30px;display:flex;justify-content:space-between;align-items:center;padding:0 4px;color:#64748B;font-size:11.5px;font-weight:600}
  @media (max-width:860px){.meta{grid-template-columns:repeat(2,1fr)}.kpis{grid-template-columns:repeat(2,1fr)}.mix-grid{grid-template-columns:1fr}.h1{font-size:26px}.hero{padding:32px 28px}.body{padding:28px}.page{margin:16px auto;padding:0 12px}}
</style>
</head>
<body>
<div class="page">
  <div class="card">
    <div class="hero">
      <div class="hero-inner">
        <div class="brand">
          <div class="brand-mark"><img src="/favicon.png" alt="Urugendo" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<span style=\\"font-size:26px\\">🚌</span>')" /></div>
          <div>
            <div class="eyebrow">Urugendo · Revenue & Manifest Report</div>
            <div class="h1">${session?.agencyName || "Agency"} · ${label}</div>
            <div class="subtitle">Managed by <b>${session?.name || "Manager"}</b> · ${session?.email || ""} · ${nowStr}</div>
          </div>
        </div>
        <div class="meta">
          <div class="meta-cell"><div class="meta-label">Reporting Period</div><div class="meta-value">${label}</div></div>
          <div class="meta-cell"><div class="meta-label">Branches</div><div class="meta-value">${branches.length}</div></div>
          <div class="meta-cell"><div class="meta-label">Total Passengers</div><div class="meta-value">${rawTotal.passengers.toLocaleString()}</div></div>
          <div class="meta-cell"><div class="meta-label">Total Revenue</div><div class="meta-value">RWF ${rawTotal.revenue.toLocaleString()}</div></div>
        </div>
      </div>
    </div>
    <div class="body">
      <div class="kpis">
        <div class="kpi"><div class="kpi-accent" style="background:#00B85C"></div><div class="kpi-label">Urugendo Digital</div><div class="kpi-value" style="color:#059669">RWF ${rawTotal.urugendoRevenue.toLocaleString()}</div><div class="kpi-sub"><span class="pill pill-emerald">Pax ${rawTotal.urugendoPassengers.toLocaleString()}</span></div></div>
        <div class="kpi"><div class="kpi-accent" style="background:#6366F1"></div><div class="kpi-label">Paper Tickets</div><div class="kpi-value" style="color:#4338CA">RWF ${rawTotal.paperRevenue.toLocaleString()}</div><div class="kpi-sub"><span class="pill pill-indigo">Pax ${rawTotal.paperPassengers.toLocaleString()}</span> <span class="text-[10.5px] text-slate-500 ml-1">post-departure only</span></div></div>
        <div class="kpi"><div class="kpi-accent" style="background:#0F172A"></div><div class="kpi-label">Grand Total</div><div class="kpi-value">RWF ${rawTotal.revenue.toLocaleString()}</div><div class="kpi-sub"><span class="pill pill-slate">${rawTotal.passengers.toLocaleString()} pax</span></div></div>
        <div class="kpi"><div class="kpi-accent" style="background:#F59E0B"></div><div class="kpi-label">Digital Mix</div><div class="kpi-value">${rawTotal.revenue ? (((rawTotal.urugendoRevenue || 0) / rawTotal.revenue) * 100).toFixed(1) : "0.0"}%</div><div class="kpi-sub">Urugendo share of total revenue</div></div>
      </div>

      <div class="section-title">Revenue Composition</div>
      <div class="mix-grid">
        <div class="mix-card">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="kpi-label">Passenger Split</div><div style="font-size:11px;color:#64748B;font-weight:700">${rawTotal.passengers.toLocaleString()} total</div></div>
          <div class="mix-row"><div class="mix-swatch" style="background:#10B981"></div><div class="mix-label">Urugendo Digital Passengers</div><div class="mix-amt">${rawTotal.urugendoPassengers.toLocaleString()}</div></div>
          <div class="mix-row"><div class="mix-swatch" style="background:#6366F1"></div><div class="mix-label">Paper Ticket Passengers</div><div class="mix-amt">${rawTotal.paperPassengers.toLocaleString()}</div></div>
          <div class="mix-bar-wrap">
            <div class="mix-bar" style="background:linear-gradient(90deg,#10B981 0%,#10B981 ${rawTotal.passengers ? ((rawTotal.urugendoPassengers/rawTotal.passengers)*100).toFixed(3):0}%,#6366F1 ${rawTotal.passengers ? ((rawTotal.urugendoPassengers/rawTotal.passengers)*100).toFixed(3):0}%,#6366F1 100%)"></div>
          </div>
        </div>
        <div class="mix-card">
          <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="kpi-label">Revenue Split (RWF)</div><div style="font-size:11px;color:#64748B;font-weight:700">${formatRwf(rawTotal.revenue)}</div></div>
          <div class="mix-row"><div class="mix-swatch" style="background:#059669"></div><div class="mix-label">Urugendo Digital Revenue</div><div class="mix-amt">${rawTotal.urugendoRevenue.toLocaleString()}</div></div>
          <div class="mix-row"><div class="mix-swatch" style="background:#4338CA"></div><div class="mix-label">Paper Ticket Revenue</div><div class="mix-amt">${rawTotal.paperRevenue.toLocaleString()}</div></div>
          <div class="mix-bar-wrap">
            <div class="mix-bar" style="background:linear-gradient(90deg,#059669 0%,#059669 ${rawTotal.revenue ? ((rawTotal.urugendoRevenue/rawTotal.revenue)*100).toFixed(3):0}%,#4338CA ${rawTotal.revenue ? ((rawTotal.urugendoRevenue/rawTotal.revenue)*100).toFixed(3):0}%,#4338CA 100%)"></div>
          </div>
        </div>
      </div>

      <div class="section-title">Branch Ranking · All Branches Breakdown</div>
      <div class="wrap">
        <table>
          <thead>
            <tr>
              <th>Branch / Location</th>
              <th>Urugendo Pax</th>
              <th>Urugendo Rev</th>
              <th>Paper Pax</th>
              <th>Paper Rev</th>
              <th>Total Pax</th>
              <th>Revenue & Share</th>
              <th>MoMo Code</th>
            </tr>
          </thead>
          <tbody>${branchRowsHtml}</tbody>
          <tfoot>
            <tr>
              <td style="text-align:left;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:900">TOTAL · ${sorted.length} branches</td>
              <td>${rawTotal.urugendoPassengers.toLocaleString()}</td>
              <td style="color:#059669">${rawTotal.urugendoRevenue.toLocaleString()}</td>
              <td>${rawTotal.paperPassengers.toLocaleString()}</td>
              <td style="color:#4338CA">${rawTotal.paperRevenue.toLocaleString()}</td>
              <td>${rawTotal.passengers.toLocaleString()}</td>
              <td style="text-align:right">RWF ${rawTotal.revenue.toLocaleString()}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="foot">
        <div>© ${new Date().getFullYear()} Urugendo · Manifest math: paper revenue computed strictly for trips with departure_time ≤ NOW</div>
        <div>Generated by Manager: ${session?.name || "Manager"} · Code ${session?.managerCode || "—"}</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

    const htmlBlob = new Blob([html], { type: "text/html;charset=utf-8" });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const aHtml = document.createElement("a");
    aHtml.href = htmlUrl;
    aHtml.download = `Urugendo_Report_${timestamp}.html`;
    aHtml.click();
    URL.revokeObjectURL(htmlUrl);

    showToast("Report downloaded · HTML + CSV");
  };

  const openBranchEditor = (branch: BranchRecord) => {
    setEditingBranchId(branch.id);
    setNewMomoInput(branch.momoCode ?? "");
    setNewPhoneInput(branch.phone || "");
    setMomoError("");
  };

  const goTab = (tab: Tab) => {
    setActiveTab(tab);
    setShowPendingAgentsView(false);
  };

  const languageLabels = { rw: "Kinyarwanda", en: "English", fr: "Français" };

  /* ---------------------------------------------------------------- */
  /*  Loading / unauthed state                                         */
  /* ---------------------------------------------------------------- */

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="text-text-muted text-sm font-semibold animate-pulse">
          Loading manager portal...
        </div>
      </div>
    );
  }

  if (!session) return null;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative h-full w-full bg-[#F5F7FA] text-text-primary font-sans flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-20">
        {/* ── HOME ──────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <>
            <div className="bg-primary text-white pt-12 pb-5 px-6 rounded-b-[32px] shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Bus size={20} className="text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-white">
                      Manager Portal
                    </span>
                    <h1 className="text-lg font-black mt-0.5 leading-tight">
                      Agency Dashboard
                    </h1>
                    <p className="text-[11px] text-white/75 font-medium truncate max-w-[180px]">
                      {session.agencyName} · {branches.length} branch{branches.length !== 1 ? "es" : ""}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPendingAgentsView(true)}
                  className="relative p-2.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 active:scale-95 transition-transform cursor-pointer"
                  aria-label="View pending agents"
                >
                  <Bell size={20} className="text-white" />
                  {pendingAgents.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                      {pendingAgents.length > 9 ? "9+" : pendingAgents.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 relative z-10">
                {[
                  { label: "Branches", value: branches.length },
                  { label: "Revenue", value: formatCompact(totalRevenue) },
                  { label: "Riders", value: formatCompact(totalPassengers) },
                  { label: "Pending", value: pendingAgents.length },
                ].map((pill) => (
                  <div
                    key={pill.label}
                    className="bg-white/15 backdrop-blur-md rounded-2xl py-2 px-1 text-center border border-white/10"
                  >
                    <div className="text-sm font-black leading-none">
                      {statsLoading && pill.label === "Revenue" ? "…" : pill.value}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-white/75 mt-1">
                      {pill.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Pending agents alert banner */}
              {pendingAgents.length > 0 && (
                <div
                  onClick={() => setShowPendingAgentsView(true)}
                  className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                      {pendingAgents.length}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-900">
                        Unapproved Agents
                      </div>
                      <div className="text-[11px] text-amber-700">
                        Tap to review and authorize accounts instantly
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-amber-700" />
                </div>
              )}

              <div className="flex bg-white p-1 rounded-2xl border border-border shadow-sm gap-1 mb-3">
                {(["overall", "urugendo", "paper"] as RevenueCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRevenueCategory(cat)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                        revenueCategory === cat
                          ? "bg-primary text-white shadow-md"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {cat}
                    </button>
                  ),
                )}
              </div>

              <PeriodSelector
                value={selectedPeriod}
                onChange={setSelectedPeriod}
                customDate={customDate}
                onCustomDateChange={setCustomDate}
              />

              <div className="bg-primary rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-white/80">
                    {periodLabel(selectedPeriod, customDate)}&apos;s Revenue
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                </div>
                <h2 className="text-3xl font-black mt-2 relative z-10">
                  {statsLoading ? "—" : formatRwf(totalRevenue)}
                </h2>
                <p className="text-[11px] text-white/80 mt-1 flex items-center gap-1 relative z-10">
                  <TrendingUp size={13} />
                  {statsLoading
                    ? "Loading..."
                    : `${totalPassengers.toLocaleString()} verified bookings`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Building2 size={16} />
                  </div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide">
                    Top Branch
                  </p>
                  <p className="text-sm font-black text-text-primary mt-0.5 leading-tight">
                    {topBranch ? topBranch.branch.name.split(" ")[0] : "—"}
                  </p>
                  <p className="text-[10px] text-primary font-bold">
                    {topBranch ? formatCompact(topBranch.stats.revenue) : "0"} RWF
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
                    <UserCheck size={16} />
                  </div>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide">
                    Pending Agents
                  </p>
                  <p className="text-sm font-black text-text-primary mt-0.5">
                    {pendingAgents.length}
                  </p>
                  <p className="text-[10px] text-text-muted">Awaiting approval</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-border bg-white font-bold text-xs text-text-primary active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <Download size={15} />
                  Download Report
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(true)}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-bold text-xs shadow-md active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <PlusCircle size={15} />
                  Add New Branch
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── BRANCHES ──────────────────────────────────────────── */}
        {activeTab === "branches" && (
          <div className="p-5 space-y-5 pt-10">
            <SectionHeader
              title="Agency Branches"
              subtitle={`${session.agencyName} · ${branches.length} active stations`}
              action={
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-md active:scale-95 cursor-pointer"
                >
                  <PlusCircle size={14} />
                  Add Branch
                </button>
              }
            />

            <PeriodSelector
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              customDate={customDate}
              onCustomDateChange={setCustomDate}
            />

            {branches.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-border shadow-sm">
                <Building2 size={48} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-text-primary text-base">
                  No branches yet
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Add your first branch to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {branchStats.map(({ branch: b, stats }) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl p-5 border border-border shadow-sm relative space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-text-primary text-base">
                          {b.name}
                        </h3>
                        <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {b.location}
                          {b.agentName && b.agentName !== "Assigned Agent"
                            ? ` · ${b.agentName}`
                            : ""}
                        </p>
                        <p className="text-xs font-mono text-primary font-semibold mt-1">
                          {b.phone || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openBranchEditor(b)}
                          className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          Edit Info
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingBranchId(b.id);
                            setDeletingBranchName(b.name);
                          }}
                          className="p-1.5 bg-red-50 border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                          title="Delete Branch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted block font-bold uppercase">
                          Branch Revenue
                        </span>
                        <span className="font-black text-primary text-sm">
                          {statsLoading ? "—" : formatRwf(stats.revenue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block font-bold uppercase">
                          Passengers
                        </span>
                        <span className="font-bold text-text-primary text-sm">
                          {statsLoading ? "—" : stats.passengers}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black">
                          <QrCode size={18} />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                            Merchant MoMo Code
                          </span>
                          <span className="text-base font-extrabold text-slate-900 font-mono tracking-wider">
                            *{b.momoCode || "——"}#
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] font-extrabold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md uppercase">
                        MTN MoMo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE ─────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <div className="p-5 space-y-5 pt-10">
            <SectionHeader
              title="Profile"
              subtitle="Manager account settings"
            />

            <div className="bg-white rounded-3xl p-5 border border-border shadow-sm text-center relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl mx-auto mb-3 border border-primary/20">
                {session.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-extrabold text-text-primary text-lg">
                {session.name}
              </h2>
              <p className="text-xs text-text-muted font-medium">
                {session.email}
              </p>
              <span className="inline-block mt-2 text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                {session.agencyName} Manager
              </span>
              <p className="text-[10px] text-text-muted mt-1 font-mono">
                Code: {session.managerCode}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-border shadow-sm space-y-1 text-xs font-bold text-text-primary">
              <button
                type="button"
                onClick={() => setShowLanguageSheet(true)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-primary" />
                  <span>App Language</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <span>{languageLabels[language]}</span>
                  <ChevronRight size={16} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowPasswordDrawer(true)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-primary" />
                  <span>Change Password</span>
                </div>
                <ChevronRight size={16} className="text-text-muted" />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-2xl pt-3 border-t border-slate-100 mt-1 cursor-pointer"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── PENDING AGENTS MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showPendingAgentsView && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute inset-0 bg-[#F5F7FA] z-50 p-5 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6 pt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 font-bold">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-text-primary">
                    Pending Agents
                  </h2>
                  <p className="text-xs text-text-muted">
                    Approve or reject agent registrations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingAgentsView(false)}
                className="p-2 rounded-full bg-slate-200 text-slate-600 active:scale-95 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {pendingAgents.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-border shadow-sm mt-8">
                <ShieldCheck size={48} className="mx-auto text-primary mb-3" />
                <h3 className="font-bold text-text-primary text-base">
                  All Agents Approved
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  No pending agent registrations right now.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingAgents.map((ag) => (
                  <div
                    key={ag.id}
                    className="bg-white rounded-2xl p-4 border border-border shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-text-primary text-sm">
                          {ag.name}
                        </h3>
                        <p className="text-[11px] text-text-muted">{ag.email}</p>
                      </div>
                      <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                        Pending
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 mb-3 bg-slate-50 p-2.5 rounded-xl">
                      <p>
                        <strong>Branch:</strong> {ag.branchName}
                      </p>
                      <p>
                        <strong>Phone:</strong> {ag.phone}
                      </p>
                      <p>
                        <strong>Registered:</strong> {ag.signedUpAt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApproveAgent(ag)}
                      disabled={approvingId === ag.id}
                      className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {approvingId === ag.id ? (
                        <span>Approving...</span>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          Approve Agent Access
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ADD BRANCH MODAL ────────────────────────────────────── */}
      {showAddBranchModal && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-text-primary text-base">
                Register New Branch
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                className="p-1 text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3">
              {[
                {
                  label: "Branch Name",
                  value: newBranchNameInput,
                  setter: setNewBranchNameInput,
                  placeholder: "e.g. Muhanga Terminal",
                },
                {
                  label: "Branch Location (City) — stored as location",
                  value: newBranchLocationInput,
                  setter: setNewBranchLocationInput,
                  placeholder: "e.g. Kigali, Muhanga",
                },
                {
                  label: "Branch MoMo Code (6-7 digits) — payment",
                  value: newBranchMomoInput,
                  setter: (v: string) => setNewBranchMomoInput(v.replace(/\D/g, "")),
                  placeholder: "e.g. 5129401",
                  mono: true,
                },
                {
                  label: "Branch Phone / Helpline",
                  value: newBranchPhoneInput,
                  setter: setNewBranchPhoneInput,
                  placeholder: "e.g. +250788112233",
                  mono: true,
                },
              ].map(({ label, value, setter, placeholder, mono }) => (
                <div key={label}>
                  <label className="text-[11px] font-bold text-text-primary block mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary ${
                      mono ? "font-mono" : ""
                    }`}
                  />
                </div>
              ))}

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Station Security Code — {session ? agencyPrefix(session.agencyName) : "FAS/VIR"}-XXX (login code for this branch)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBranchStationCodeInput}
                    onChange={(e) => setNewBranchStationCodeInput(e.target.value.toUpperCase())}
                    placeholder={session ? `${agencyPrefix(session.agencyName)}-001` : "FAS-001"}
                    className="flex-1 h-10 px-3 rounded-xl border border-border text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-primary uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!session) return;
                      setNewBranchStationCodeInput(
                        nextStationCode(session.agencyName, branches.map((b) => b.stationCode || "")),
                      );
                    }}
                    className="px-3 h-10 rounded-xl bg-slate-100 border border-border text-[11px] font-bold text-text-primary whitespace-nowrap"
                  >
                    Auto-fill {session ? agencyPrefix(session.agencyName) + "-XXX" : ""}
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  Leave blank to auto-assign. Virunga → VIR-xxx, Fasta → FAS-xxx.
                </p>
              </div>

              {newBranchError && (
                <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                  {newBranchError}
                </p>
              )}

              <p className="text-[11px] text-text-muted bg-slate-50 p-2 rounded-xl">
                Saving to agency:{" "}
                <span className="font-bold text-text-primary">
                  {session?.agencyName || "— sign in again —"}
                </span>
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isCreatingBranch) return;
                    setShowAddBranchModal(false);
                  }}
                  disabled={isCreatingBranch}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-text-primary cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBranch}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isCreatingBranch ? "Saving..." : "Save Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LANGUAGE SHEET ─────────────────────────────────────── */}
      <AnimatePresence>
        {showLanguageSheet && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-white rounded-t-3xl p-5 w-full space-y-3"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-extrabold text-text-primary text-base">
                  Select Language
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLanguageSheet(false)}
                  className="p-1 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1">
                {(
                  [
                    { id: "rw" as const, name: "Kinyarwanda" },
                    { id: "en" as const, name: "English" },
                    { id: "fr" as const, name: "Français" },
                  ]
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.id);
                      setShowLanguageSheet(false);
                      showToast(`Language changed to ${lang.name}`);
                    }}
                    className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      language === lang.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-slate-50 text-text-primary"
                    }`}
                  >
                    <span>{lang.name}</span>
                    {language === lang.id && <Check size={16} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CHANGE PASSWORD ────────────────────────────────────── */}
      <AnimatePresence>
        {showPasswordDrawer && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-white rounded-t-3xl p-5 w-full space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-primary" />
                  <h3 className="font-extrabold text-text-primary text-base">
                    Change Password
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordDrawer(false);
                    setPasswordError("");
                  }}
                  className="p-1 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-3">
                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    New Master Password
                  </label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                {passwordError && (
                  <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                    {passwordError}
                  </p>
                )}

                {passwordSuccess && (
                  <p className="text-[11px] font-bold text-emerald-700 text-center bg-emerald-50 p-2 rounded-lg">
                    {passwordSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full h-11 bg-primary text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2 disabled:opacity-50"
                >
                  {isChangingPassword ? "Updating Password..." : "Update Master Password"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DELETE BRANCH CONFIRMATION MODAL ────────────────── */}
      {deletingBranchId && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-2xl border border-border text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">
                Delete Branch?
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Are you sure you want to delete <span className="font-bold text-text-primary">{deletingBranchName}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingBranchId(null);
                  setDeletingBranchName("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-text-muted hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBranchConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT BRANCH MODAL ─────────────────────────────────── */}
      {editingBranchId && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-5 w-full space-y-4 shadow-2xl border border-border">
            <h3 className="font-bold text-text-primary text-base">
              Update Branch Details
            </h3>
            <p className="text-xs text-text-muted">
              Update merchant payment code and branch contact phone.
            </p>

            <div className="space-y-3">
              {[
                {
                  label: "MoMo Pay Code (6-7 digits)",
                  value: newMomoInput,
                  setter: (v: string) => setNewMomoInput(v.replace(/\D/g, "")),
                  mono: true,
                },
                {
                  label: "Branch Phone / WhatsApp",
                  value: newPhoneInput,
                  setter: setNewPhoneInput,
                },
              ].map(({ label, value, setter, mono }) => (
                <div key={label}>
                  <label className="text-[11px] font-bold text-text-primary block mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className={`w-full p-3 bg-slate-50 border border-border rounded-xl ${
                      mono
                        ? "font-mono text-center font-black text-lg tracking-widest outline-none focus:border-primary"
                        : "font-mono text-center font-bold text-sm outline-none focus:border-primary"
                    }`}
                  />
                </div>
              ))}
            </div>

            {momoError && (
              <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                {momoError}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBranchId(null);
                  setMomoError("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveBranchDetails(editingBranchId)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastVisible && toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 left-0 right-0 px-5 z-50"
          >
            <div className="bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl text-center">
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAV BAR ────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-border px-6 py-2 flex justify-around items-center z-40">
        {(
          [
            { key: "home" as Tab, label: "Dashboard", icon: LayoutDashboard },
            { key: "branches" as Tab, label: "Branches", icon: Building2 },
            { key: "profile" as Tab, label: "Profile", icon: User },
          ]
        ).map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key && !showPendingAgentsView;
          return (
            <button
              key={key}
              type="button"
              onClick={() => goTab(key)}
              className="flex flex-col items-center gap-1 transition-colors cursor-pointer"
            >
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-colors ${
                  isActive ? "bg-primary text-white" : "text-text-muted"
                }`}
              >
                <Icon size={18} />
              </div>
              <span
                className={`text-[10px] font-bold ${
                  isActive ? "text-primary" : "text-text-muted"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
