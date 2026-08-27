"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  User,
  TrendingUp,
  CreditCard,
  Download,
  CheckCircle2,
  Bell,
  Lock,
  Globe,
  Phone,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Edit3,
  Calendar,
  X,
  DollarSign,
  MapPin,
  Bus,
  Check,
  KeyRound,
  QrCode,
  PlusCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  fetchAgencyBranches,
  createNewBranch,
  BranchRecord,
  PeriodStats,
} from "@/lib/branchService";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TimePeriod = "today" | "monthly" | "yearly" | "custom";
type Tab = "home" | "branches" | "profile";

interface PendingAgent {
  id: string;
  name: string;
  email: string;
  branchName: string;
  phone: string;
  signedUpAt: string;
}

/* ------------------------------------------------------------------ */
/*  Config / Seed Data Fallbacks                                       */
/* ------------------------------------------------------------------ */

const SUPPORT_PHONE = "0796919900";

const SEED_BRANCHES: BranchRecord[] = [
  {
    id: "br-1",
    name: "Nyabugogo Main Terminal",
    location: "Kigali",
    momoCode: "8291034",
    phone: "+250782490611",
    agentName: "Jean Paul N.",
    agentEmail: "jp.n@virunga.rw",
    stats: {
      today: { passengers: 42, revenue: 147000 },
      monthly: { passengers: 1240, revenue: 4340000 },
      yearly: { passengers: 14100, revenue: 49350000 },
    },
  },
  {
    id: "br-2",
    name: "Musanze Central Branch",
    location: "Musanze",
    momoCode: "5129401",
    phone: "+250788112233",
    agentName: "Marie Rose M.",
    agentEmail: "m.rose@virunga.rw",
    stats: {
      today: { passengers: 31, revenue: 108500 },
      monthly: { passengers: 890, revenue: 3115000 },
      yearly: { passengers: 10230, revenue: 35805000 },
    },
  },
  {
    id: "br-3",
    name: "Rubavu Terminal",
    location: "Rubavu",
    momoCode: "9041285",
    phone: "+250785445566",
    agentName: "Bosco Habimana",
    agentEmail: "bosco.h@virunga.rw",
    stats: {
      today: { passengers: 19, revenue: 66500 },
      monthly: { passengers: 620, revenue: 2170000 },
      yearly: { passengers: 7140, revenue: 24990000 },
    },
  },
];

const SEED_PENDING_AGENTS: PendingAgent[] = [
  {
    id: "ag-1",
    name: "Eric Hakizimana",
    email: "eric.h@virunga.rw",
    branchName: "Musanze Terminal",
    phone: "+250 788 112 233",
    signedUpAt: "10 mins ago",
  },
  {
    id: "ag-2",
    name: "Clarisse Umutoni",
    email: "clarisse.u@virunga.rw",
    branchName: "Nyabugogo Branch B",
    phone: "+250 785 445 566",
    signedUpAt: "2 hours ago",
  },
];

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

function getBranchStats(branch: BranchRecord, period: TimePeriod): PeriodStats {
  if (period === "custom") return branch.stats.today;
  return branch.stats[period] || { passengers: 0, revenue: 0 };
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

  // Navigation State
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showPendingAgentsView, setShowPendingAgentsView] = useState(false);

  // Time / Filtering State
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("today");
  const [customDate, setCustomDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Authenticated Manager Session State
  const [managerName, setManagerName] = useState("Amani Ishimwe Didier");
  const [managerEmail, setManagerEmail] = useState("ishimweamanid@gmail.com");
  const [agencyName, setAgencyName] = useState("Virunga Express");

  // App Data & Dynamic Revenue Tracking state using branchService
  const [branches, setBranches] = useState<BranchRecord[]>(SEED_BRANCHES);
  const [pendingAgents, setPendingAgents] =
    useState<PendingAgent[]>(SEED_PENDING_AGENTS);

  // Apple UI Language Sheet State
  const [language, setLanguage] = useState<"rw" | "en" | "fr">("rw");
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);

  // Password Change Drawer State
  const [showPasswordDrawer, setShowPasswordDrawer] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Branch Edit Modal State
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [newMomoInput, setNewMomoInput] = useState<string>("");
  const [newPhoneInput, setNewPhoneInput] = useState<string>("");
  const [momoError, setMomoError] = useState<string>("");

  // New Branch Creation Form Modal State
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchNameInput, setNewBranchNameInput] = useState("");
  const [newBranchLocationInput, setNewBranchLocationInput] = useState("");
  const [newBranchMomoInput, setNewBranchMomoInput] = useState("");
  const [newBranchPhoneInput, setNewBranchPhoneInput] = useState("");
  const [newBranchAgentInput, setNewBranchAgentInput] = useState("");
  const [newBranchError, setNewBranchError] = useState("");

  // Approval Loading State
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Load Session & Fetch Live Database Data from Supabase via branchService
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("urugendo_manager_name");
      const storedEmail = localStorage.getItem("urugendo_manager_email");
      const storedAgency = localStorage.getItem("urugendo_agency");

      if (storedName) setManagerName(storedName);
      if (storedEmail) setManagerEmail(storedEmail);
      if (storedAgency) setAgencyName(storedAgency);
    }

    const loadData = async () => {
      // Fetch dynamic branches using branchService
      const dbBranches = await fetchAgencyBranches();
      if (dbBranches && dbBranches.length > 0) {
        setBranches(dbBranches);
      }

      try {
        const { data: agentData } = await supabase
          .from("agency_agents")
          .select("id, name, email, branch_name, phone, created_at")
          .eq("is_approved", false);

        if (agentData && agentData.length > 0) {
          setPendingAgents(
            agentData.map((a: any) => ({
              id: a.id,
              name: a.name || "Agent",
              email: a.email,
              branchName: a.branch_name || "Station",
              phone: a.phone || "+250 780 000 000",
              signedUpAt: new Date(a.created_at).toLocaleString(),
            })),
          );
        }
      } catch (err) {
        console.warn("[manager] pending agents fetch error:", err);
      }
    };

    loadData();

    // Setup real-time listener for new agent signups
    const channel = supabase
      .channel("manager-realtime-agents")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_agents" },
        (payload) => {
          const newAgent = payload.new as any;
          if (!newAgent) return;
          setPendingAgents((prev) => [
            {
              id: newAgent.id,
              name: newAgent.name || "New Agent",
              email: newAgent.email,
              branchName: newAgent.branch_name || "Station",
              phone: newAgent.phone || "+250 780 000 000",
              signedUpAt: "Just now",
            },
            ...prev,
          ]);
          setToast(`New agent signup alert: ${newAgent.name}`);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Computed metrics (Dynamic Revenue Tracking across all active agency branches)
  const branchStats = branches.map((b) => ({
    branch: b,
    stats: getBranchStats(b, selectedPeriod),
  }));
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
      await supabase
        .from("agency_agents")
        .update({ is_approved: true })
        .eq("id", agent.id);

      await fetch("/api/send-approval-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentEmail: agent.email,
          agentName: agent.name,
          loginUrl: `${window.location.origin}/agency/agency-login`,
        }),
      }).catch(() => null);
    } catch (err) {
      console.warn("[manager] approve agent error:", err);
    } finally {
      setPendingAgents((prev) => prev.filter((a) => a.id !== agent.id));
      setApprovingId(null);
      setToast(`${agent.name} approved successfully!`);
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
      await supabase
        .from("branches")
        .update({ momo_code: newMomoInput, phone: newPhoneInput })
        .eq("id", branchId);
    } catch (err) {
      console.warn("[manager] branch update sync skipped:", err);
    }

    setEditingBranchId(null);
    setNewMomoInput("");
    setNewPhoneInput("");
    setMomoError("");
    setToast(`Branch details for ${targetBranch.name} updated successfully!`);
  };

  // Handler for creating a new agency branch using branchService
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewBranchError("");

    if (
      !newBranchNameInput ||
      !newBranchLocationInput ||
      !newBranchMomoInput ||
      !newBranchPhoneInput
    ) {
      setNewBranchError("Please fill in all required branch details.");
      return;
    }

    if (!/^\d{6,7}$/.test(newBranchMomoInput)) {
      setNewBranchError("Momo code must be 6 or 7 digits.");
      return;
    }

    const newBranchObj: BranchRecord = {
      id: `br-${Date.now()}`,
      name: newBranchNameInput,
      location: newBranchLocationInput,
      momoCode: newBranchMomoInput,
      phone: newBranchPhoneInput,
      agentName: newBranchAgentInput || "Assigned Agent",
      agentEmail: `${newBranchNameInput.toLowerCase().replace(/\s+/g, "")}@virunga.rw`,
      stats: {
        today: { passengers: 0, revenue: 0 },
        monthly: { passengers: 0, revenue: 0 },
        yearly: { passengers: 0, revenue: 0 },
      },
    };

    setBranches((prev) => [newBranchObj, ...prev]);

    // Save using branchService
    await createNewBranch(newBranchObj);

    setShowAddBranchModal(false);
    setNewBranchNameInput("");
    setNewBranchLocationInput("");
    setNewBranchMomoInput("");
    setNewBranchPhoneInput("");
    setNewBranchAgentInput("");
    setToast(`New branch ${newBranchObj.name} added successfully!`);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    const storedMasterPass =
      typeof window !== "undefined"
        ? localStorage.getItem("urugendo_manager_password") || "54321"
        : "54321";

    if (currentPasswordInput !== storedMasterPass) {
      setPasswordError("Incorrect current password.");
      return;
    }

    if (!newPasswordInput || newPasswordInput.length < 4) {
      setPasswordError("New password must be at least 4 characters.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("urugendo_manager_password", newPasswordInput);
    }

    setShowPasswordDrawer(false);
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setToast("Password changed successfully!");
  };

  const handleGenerateReport = () => {
    const label = periodLabel(selectedPeriod, customDate);
    const reportContent =
      `URUGENDO AGENCY REPORT (${label})\n` +
      `Agency: ${agencyName}\n` +
      `Manager: ${managerName} (${managerEmail})\n` +
      `Generated: ${new Date().toLocaleString()}\n` +
      `Total Passengers: ${totalPassengers}\n` +
      `Total Revenue: ${formatRwf(totalRevenue)}\n\n` +
      `Branches Breakdown:\n` +
      branchStats
        .map(
          ({ branch, stats }) =>
            `- ${branch.name} (${branch.location}): ${formatRwf(
              stats.revenue,
            )} · ${stats.passengers} passengers · MoMo: *${branch.momoCode}#`,
        )
        .join("\n");

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Urugendo_Report_${selectedPeriod}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Report downloaded successfully");
  };

  const openBranchEditor = (branch: BranchRecord) => {
    setEditingBranchId(branch.id);
    setNewMomoInput(branch.momoCode);
    setNewPhoneInput(branch.phone || SUPPORT_PHONE);
    setMomoError("");
  };

  const goTab = (tab: Tab) => {
    setActiveTab(tab);
    setShowPendingAgentsView(false);
  };

  const languageLabels = {
    rw: "Kinyarwanda",
    en: "English",
    fr: "Français",
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative h-full w-full bg-[#F5F7FA] text-text-primary font-sans flex flex-col overflow-hidden">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* PAGE 1: HOME */}
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
                      {agencyName} · {branches.length} branches
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingAgentsView(true)}
                  className="relative p-2.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 active:scale-95 transition-transform cursor-pointer"
                >
                  <Bell size={20} className="text-white" />
                  {pendingAgents.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                      {pendingAgents.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 relative z-10">
                {[
                  { label: "Branches", value: `${branches.length}` },
                  { label: "Revenue", value: formatCompact(totalRevenue) },
                  { label: "Riders", value: formatCompact(totalPassengers) },
                  { label: "Pending", value: `${pendingAgents.length}` },
                ].map((pill) => (
                  <div
                    key={pill.label}
                    className="bg-white/15 backdrop-blur-md rounded-2xl py-2 px-1 text-center border border-white/10"
                  >
                    <div className="text-sm font-black leading-none">
                      {pill.value}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-white/75 mt-1">
                      {pill.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-5">
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
                    {periodLabel(selectedPeriod, customDate)}'s Dynamic Revenue
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                </div>
                <h2 className="text-3xl font-black mt-2 relative z-10">
                  {formatRwf(totalRevenue)}
                </h2>
                <p className="text-[11px] text-white/80 mt-1 flex items-center gap-1 relative z-10">
                  <TrendingUp size={13} />
                  {totalPassengers.toLocaleString()} verified station bookings
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
                    {topBranch?.branch.name.split(" ")[0] ?? "—"}
                  </p>
                  <p className="text-[10px] text-primary font-bold">
                    {topBranch ? formatCompact(topBranch.stats.revenue) : "0"}{" "}
                    RWF
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
                  <p className="text-[10px] text-text-muted">
                    Awaiting approval
                  </p>
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

        {/* PAGE 2: BRANCHES */}
        {activeTab === "branches" && (
          <div className="p-5 space-y-5 pt-10">
            <SectionHeader
              title="Agency Branches"
              subtitle={`${agencyName} · ${branches.length} active stations`}
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
                        {b.location} · Agent: {b.agentName}
                      </p>
                      <p className="text-xs font-mono text-primary font-semibold mt-1">
                        Phone: {b.phone || SUPPORT_PHONE}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openBranchEditor(b)}
                      className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      Edit Info
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] text-text-muted block font-bold uppercase">
                        Branch Revenue
                      </span>
                      <span className="font-black text-primary text-sm">
                        {formatRwf(stats.revenue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted block font-bold uppercase">
                        Passengers
                      </span>
                      <span className="font-bold text-text-primary text-sm">
                        {stats.passengers}
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
                          *{b.momoCode}#
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
          </div>
        )}

        {/* PAGE 3: PROFILE */}
        {activeTab === "profile" && (
          <div className="p-5 space-y-5 pt-10">
            <SectionHeader
              title="Profile"
              subtitle="Manager account settings & secure persistence"
            />

            <div className="bg-white rounded-3xl p-5 border border-border shadow-sm text-center relative">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl mx-auto mb-3 border border-primary/20">
                {managerName.charAt(0)}
              </div>
              <h2 className="font-extrabold text-text-primary text-lg">
                {managerName}
              </h2>
              <p className="text-xs text-text-muted font-medium">
                {managerEmail}
              </p>
              <span className="inline-block mt-2 text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                {agencyName} Manager
              </span>
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

              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-primary" />
                  <span>Contact Urugendo Support</span>
                </div>
                <span className="text-xs font-mono text-primary font-bold">
                  {SUPPORT_PHONE}
                </span>
              </a>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("urugendo_role");
                  }
                  router.push("/agency/agency-login");
                }}
                className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-2xl pt-3 border-t border-slate-100 mt-1 cursor-pointer"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications / Pending Agents Modal */}
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
                    Instant manager authorization notifications
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
                  There are no pending agent registrations right now.
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
                        <p className="text-[11px] text-text-muted">
                          {ag.email}
                        </p>
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

      {/* Add New Branch Modal Form */}
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
              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchNameInput}
                  onChange={(e) => setNewBranchNameInput(e.target.value)}
                  placeholder="e.g. Muhanga Terminal"
                  className="w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Branch Location (City)
                </label>
                <input
                  type="text"
                  value={newBranchLocationInput}
                  onChange={(e) => setNewBranchLocationInput(e.target.value)}
                  placeholder="e.g. Muhanga"
                  className="w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Branch MoMo Code (6-7 digits)
                </label>
                <input
                  type="text"
                  maxLength={7}
                  value={newBranchMomoInput}
                  onChange={(e) =>
                    setNewBranchMomoInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="e.g. 5129401"
                  className="w-full h-10 px-3 rounded-xl border border-border font-mono text-xs font-black tracking-widest focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Branch Phone / Helpline Number
                </label>
                <input
                  type="text"
                  value={newBranchPhoneInput}
                  onChange={(e) => setNewBranchPhoneInput(e.target.value)}
                  placeholder="e.g. +250788112233"
                  className="w-full h-10 px-3 rounded-xl border border-border font-mono text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Assigned Station Agent Name
                </label>
                <input
                  type="text"
                  value={newBranchAgentInput}
                  onChange={(e) => setNewBranchAgentInput(e.target.value)}
                  placeholder="e.g. Jean Pierre"
                  className="w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

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
                  Save Branch to DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Language Selector Sheet */}
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
                    { id: "rw", name: "Kinyarwanda" },
                    { id: "en", name: "English" },
                    { id: "fr", name: "Français" },
                  ] as const
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.id);
                      setShowLanguageSheet(false);
                      setToast(`Language changed to ${lang.name}`);
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

      {/* Change Password Drawer */}
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
                    Change Account Password
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

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-text-primary block mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password (e.g. 54321)"
                    className="w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-primary block mb-1">
                    New Master Password
                  </label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full h-10 px-3 rounded-xl border border-border text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                </div>

                {passwordError && (
                  <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-11 bg-primary text-white font-bold text-xs rounded-xl shadow-md cursor-pointer mt-2"
                >
                  Update Master Password
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Branch MoMo & Phone Modal */}
      {editingBranchId && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl p-5 w-full space-y-4 shadow-2xl border border-border">
            <h3 className="font-bold text-text-primary text-base">
              Update Branch Details
            </h3>
            <p className="text-xs text-text-muted">
              Update merchant payment code and branch contact phone number.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  MoMo Pay Code (6-7 digits)
                </label>
                <input
                  type="text"
                  maxLength={7}
                  value={newMomoInput}
                  onChange={(e) =>
                    setNewMomoInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="e.g. 8291034"
                  className="w-full p-3 bg-slate-50 border border-border rounded-xl font-mono text-center font-black text-lg tracking-widest outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-primary block mb-1">
                  Branch Phone / WhatsApp Number
                </label>
                <input
                  type="text"
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="e.g. +250782490611"
                  className="w-full p-3 bg-slate-50 border border-border rounded-xl font-mono text-center font-bold text-sm outline-none focus:border-primary"
                />
              </div>
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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
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

      {/* Manager Navigation Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-border px-6 py-2 flex justify-around items-center z-40">
        {(
          [
            { key: "home", label: "Dashboard", icon: LayoutDashboard },
            { key: "branches", label: "Branches", icon: Building2 },
            { key: "profile", label: "Profile", icon: User },
          ] as { key: Tab; label: string; icon: typeof User }[]
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
