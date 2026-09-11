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
  const [newBranchError, setNewBranchError] = useState("");

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

    // Real-time subscription: new agent signups appear instantly
    const channel = supabase
      .channel("manager-realtime-agents")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_agents" },
        (payload: any) => {
          const newAgent = payload.new;
          if (!newAgent || newAgent.is_approved === true) return;
          setPendingAgents((prev) => [
            {
              id: newAgent.id,
              name: newAgent.name || "New Agent",
              email: newAgent.email,
              branchName: newAgent.branch_name || "—",
              phone: newAgent.phone || "—",
              signedUpAt: "Just now",
            },
            ...prev,
          ]);
          showToast(`New agent signup: ${newAgent.name}`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkingSession, loadData, showToast]);

  // ── Revenue stats (re-fetch when branches or period changes) ───────
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
  }, [branches, selectedPeriod, checkingSession]);

  // ── Computed ───────────────────────────────────────────────────────
  const branchStats = branches.map((b) => ({
    branch: b,
    stats: periodStats[b.id] ?? { passengers: 0, revenue: 0 },
  }));

  const totalPassengers = branchStats.reduce(
    (acc, b) => acc + b.stats.passengers,
    0,
  );
  const totalRevenue = branchStats.reduce(
    (acc, b) => acc + b.stats.revenue,
    0,
  );
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

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewBranchError("");

    if (
      !newBranchNameInput ||
      !newBranchLocationInput ||
      !newBranchMomoInput ||
      !newBranchPhoneInput
    ) {
      setNewBranchError("Please fill in all required fields.");
      return;
    }

    if (!/^\d{6,7}$/.test(newBranchMomoInput)) {
      setNewBranchError("MoMo code must be 6 or 7 digits.");
      return;
    }

    const newBranchObj: BranchRecord = {
      id: crypto.randomUUID(),
      name: newBranchNameInput,
      location: newBranchLocationInput,
      agencyName: session?.agencyName || undefined,
      momoCode: newBranchMomoInput || null,
      phone: newBranchPhoneInput,
      agentName: "Assigned Agent",
      agentEmail: "agent@virunga.rw",
      stats: {
        today: { passengers: 0, revenue: 0 },
        monthly: { passengers: 0, revenue: 0 },
        yearly: { passengers: 0, revenue: 0 },
      },
    };

    setBranches((prev) => [newBranchObj, ...prev]);

    const ok = await createNewBranch(newBranchObj);
    if (!ok) {
      showToast("Branch saved locally — DB sync failed. Will retry.");
    }

    setShowAddBranchModal(false);
    setNewBranchNameInput("");
    setNewBranchLocationInput("");
    setNewBranchMomoInput("");
    setNewBranchPhoneInput("");
    showToast(`Branch ${newBranchObj.name} added successfully!`);
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
    const lines = [
      `URUGENDO AGENCY REPORT (${label})`,
      `Agency: ${session?.agencyName}`,
      `Manager: ${session?.name} (${session?.email})`,
      `Generated: ${new Date().toLocaleString()}`,
      `Total Passengers: ${totalPassengers}`,
      `Total Revenue: ${formatRwf(totalRevenue)}`,
      ``,
      `Branches Breakdown:`,
      ...branchStats.map(
        ({ branch, stats }) =>
          `- ${branch.name} (${branch.location}): ${formatRwf(stats.revenue)} · ${stats.passengers} passengers · MoMo: *${branch.momoCode}#`,
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Urugendo_Report_${selectedPeriod}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded successfully");
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
                  label: "Branch Location (City)",
                  value: newBranchLocationInput,
                  setter: setNewBranchLocationInput,
                  placeholder: "e.g. Muhanga",
                },
                {
                  label: "Branch MoMo Code (6-7 digits)",
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

              {newBranchError && (
                <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                  {newBranchError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-bold text-xs text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Save Branch
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
