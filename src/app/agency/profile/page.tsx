"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  Lock,
  Globe,
  HelpCircle,
  Phone,
  MessageCircle,
  QrCode,
  Building2,
  MapPin,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/app-context";
import { Language } from "@/lib/types";

export default function AgentProfilePage() {
  const router = useRouter();
  const { language, setLanguage } = useApp();

  // Agent State dynamically resolved
  const [agentName, setAgentName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [momoCode, setMomoCode] = useState("5129401");

  // Notifications
  const [unreadNotificationsCount] = useState(3);

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    async function loadAgentDetails() {
      let resolvedBranch = "";

      // 1. First attempt to fetch real details from Supabase active session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, branch, operator_id, momo_code")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.full_name) setAgentName(profile.full_name);
          if (profile.branch) {
            setBranchName(profile.branch);
            resolvedBranch = profile.branch;
          }
          if (profile.momo_code) setMomoCode(profile.momo_code);

          if (profile.operator_id) {
            const { data: op } = await supabase
              .from("operators")
              .select("name")
              .eq("id", profile.operator_id)
              .single();
            if (op?.name) setAgencyName(op.name);
          }
        }
      }

      // 2. Fallback to locally persisted keys
      const storedName =
        localStorage.getItem("urugendo_agent_name") ||
        localStorage.getItem("urugendo_user_name") ||
        localStorage.getItem("urugendo_name");

      const storedAgency =
        localStorage.getItem("urugendo_agency") ||
        localStorage.getItem("urugendo_company") ||
        localStorage.getItem("urugendo_operator_name");

      const storedBranch =
        localStorage.getItem("urugendo_branch") ||
        localStorage.getItem("urugendo_station");

      if (storedName && !agentName) setAgentName(storedName);
      if (storedAgency && !agencyName) setAgencyName(storedAgency);
      if (storedBranch && !branchName) {
        setBranchName(storedBranch);
        resolvedBranch = storedBranch;
      }

      const currentBranch = resolvedBranch || branchName || "Musanze";

      // Fetch live branch MoMo code matching agent's current station
      try {
        const { data: bData } = await supabase
          .from("branches")
          .select("momo_code")
          .ilike("name", `%${currentBranch}%`)
          .single();

        if (bData?.momo_code) {
          setMomoCode(bData.momo_code);
          localStorage.setItem("urugendo_branch_momo", bData.momo_code);
          return;
        }
      } catch {
        // Fall back to localized memory
      }

      const storedMomo =
        localStorage.getItem(`momo_code_${currentBranch.toLowerCase()}`) ||
        localStorage.getItem("urugendo_branch_momo") ||
        localStorage.getItem("urugendo_momo_code");

      if (storedMomo) setMomoCode(storedMomo);
    }

    loadAgentDetails();
  }, [agentName, agencyName, branchName]);

  // Get Initials for Avatar
  const getInitials = (name: string) => {
    if (!name) return "AG";
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordSuccess(true);
    setTimeout(() => {
      setPasswordSuccess(false);
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 1800);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("urugendo_agent_name");
    localStorage.removeItem("urugendo_agent_email");
    localStorage.removeItem("urugendo_role");
    router.push("/agency/agency-login");
  };

  return (
    <div className="bg-surface-secondary pb-[88px] min-h-screen font-sans">
      {/* Top Header Card */}
      <div className="bg-[#00B14F] pt-[50px] px-5 pb-6 rounded-b-[28px] text-center shadow-md relative">
        <div className="w-16 h-16 rounded-full bg-white text-[#00B14F] font-bold text-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          {getInitials(agentName)}
        </div>
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          {agentName || "Agent Station User"}
        </h1>

        {/* Agency & Branch Info Tag */}
        <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[12px] font-semibold border border-white/20">
          <Building2 size={13} />
          <span>{agencyName || "Agency Operator"}</span>
          <span className="text-white/60">•</span>
          <MapPin size={13} />
          <span>{branchName || "Main"} Branch</span>
        </div>
      </div>

      {/* Main Content Info & Actions */}
      <div className="px-4 mt-5 space-y-3">
        {/* MTN MoMo Branch Code Card - Styled clean matching system cards */}
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold">
              <QrCode size={20} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                Branch MoMo Code
              </span>
              <span className="text-[18px] font-extrabold text-slate-900 font-mono tracking-wide">
                *{momoCode}#
              </span>
            </div>
          </div>
          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full uppercase">
            MTN MoMo
          </span>
        </div>

        {/* Action Menu Items */}
        <div className="bg-white rounded-2xl border border-border divide-y divide-gray-100 shadow-sm overflow-hidden">
          {/* Notifications Button */}
          <button
            onClick={() => router.push("/agency/agency-notifications")}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00B14F] flex items-center justify-center">
                <Bell size={18} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">
                Notifications
              </span>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotificationsCount > 0 && (
                <span className="bg-[#00B14F] text-white font-extrabold text-[11px] px-2 py-0.5 rounded-full">
                  {unreadNotificationsCount} unread
                </span>
              )}
              <ChevronRight size={16} className="text-slate-400" />
            </div>
          </button>

          {/* Change Password Button */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock size={18} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">
                Change Password
              </span>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>

          {/* Language Toggle */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Globe size={18} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">
                Language
              </span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {(["EN", "RW"] as const).map((lang: Language) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    language === lang
                      ? "bg-[#00B14F] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {lang === "RW" ? "KIN" : lang}
                </button>
              ))}
            </div>
          </div>

          {/* Help & Support Button */}
          <button
            onClick={() => setShowSupportModal(true)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <HelpCircle size={18} />
              </div>
              <span className="text-[13px] font-bold text-slate-800">
                Help & Contact Support
              </span>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-red-50 transition-colors cursor-pointer text-left text-red-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <LogOut size={18} />
              </div>
              <span className="text-[13px] font-bold">Log Out</span>
            </div>
            <ChevronRight size={16} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Contact Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl relative"
          >
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Urugendo Support
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Get in touch with our team for agency system assistance.
            </p>

            <div className="space-y-3">
              <a
                href="tel:0796919900"
                className="w-full bg-slate-100 hover:bg-slate-200 p-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-[#00B14F] text-white flex items-center justify-center">
                  <Phone size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    Call Center Phone
                  </span>
                  <span className="text-xs font-black text-slate-900 font-mono">
                    0796919900
                  </span>
                </div>
              </a>

              <a
                href="https://wa.me/250796919900"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                    WhatsApp Support
                  </span>
                  <span className="text-xs font-black text-emerald-900">
                    Chat on WhatsApp
                  </span>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl relative"
          >
            <button
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Change Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Update your account credentials safely.
            </p>

            {passwordSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 size={40} className="text-[#00B14F] mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  Password updated successfully!
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                {passwordError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">
                    {passwordError}
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showCurrentPass ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00B14F]"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#00B14F] hover:bg-[#00B14F]/90 text-white font-bold py-2.5 rounded-xl text-xs mt-2 transition-colors cursor-pointer"
                >
                  Save Password
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
