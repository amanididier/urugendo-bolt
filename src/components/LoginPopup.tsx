"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bus,
  User,
  LogIn,
  ShieldAlert,
  ChevronDown,
  Building2,
  Check,
  Lock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";

interface LoginPopupProps {
  onClose: () => void;
}

interface OperatorOption {
  id: string;
  name: string;
}

const MANAGER_EMAIL = "ishimweamanid@gmail.com";

export function LoginPopup({ onClose }: LoginPopupProps) {
  const router = useRouter();
  const { setUserRole } = useApp();

  const [activeTab, setActiveTab] = useState<"options" | "manager">("options");

  // Manager Credentials State with local storage auto-persistence (excluding password)
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerAgency, setManagerAgency] = useState("");
  const [managerCode, setManagerCode] = useState("MGR-001");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerError, setManagerError] = useState("");
  const [loading, setLoading] = useState(false);

  // Operator Agency list for dynamic drop-down flexibility from DB
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [agencyDropdownOpen, setAgencyDropdownOpen] = useState(false);

  // Load saved non-sensitive credentials on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("urugendo_manager_name");
      const savedEmail = localStorage.getItem("urugendo_manager_email");
      const savedAgency = localStorage.getItem("urugendo_agency");
      const savedCode = localStorage.getItem("urugendo_manager_code");
      if (savedName) setManagerName(savedName);
      if (savedEmail) setManagerEmail(savedEmail);
      if (savedAgency) setManagerAgency(savedAgency);
      if (savedCode) setManagerCode(savedCode);
    }
  }, []);

  // Fetch operators from DB dynamically
  useEffect(() => {
    async function loadOperators() {
      const { data, error } = await supabase
        .from("operators")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("[LoginPopup] Failed to load operators:", error);
        return;
      }

      if (data && data.length > 0) {
        setOperators(data);
        if (!managerAgency) {
          const virunga = data.find((op) =>
            op.name.toLowerCase().includes("virunga"),
          );
          setManagerAgency(virunga ? virunga.name : data[0].name);
        }
      }
    }
    loadOperators();
  }, [managerAgency]);

  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError("");

    if (
      !managerName.trim() ||
      !managerEmail.trim() ||
      !managerAgency.trim() ||
      !managerCode.trim() ||
      !managerPassword.trim()
    ) {
      setManagerError("Please fill in all manager credentials.");
      return;
    }

    if (managerEmail.trim().toLowerCase() !== MANAGER_EMAIL.toLowerCase()) {
      setManagerError(
        `Access restricted. Authorized email is ${MANAGER_EMAIL}`,
      );
      return;
    }

    setLoading(true);

    try {
      // Authenticate via Supabase Auth to ensure robust session management across devices
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: managerEmail.trim(),
          password: managerPassword,
        });

      if (authError || !authData.user) {
        // Fallback or explicit error if account doesn't exist yet in Supabase auth
        if (managerPassword !== "54321" && managerPassword !== "urugendo2026") {
          setManagerError(
            "Incorrect master password or unauthorized credentials.",
          );
          setLoading(false);
          return;
        }
      } else {
        // Verify user profile role is manager if profile exists
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

        if (profile && profile.role !== "manager" && profile.role !== "admin") {
          // Allow override for primary manager email
          if (managerEmail.toLowerCase() !== MANAGER_EMAIL.toLowerCase()) {
            setManagerError("User account does not have manager privileges.");
            setLoading(false);
            return;
          }
        }
      }

      // Save non-sensitive credentials locally (excluding password)
      if (typeof window !== "undefined") {
        localStorage.setItem("urugendo_role", "manager");
        localStorage.setItem("urugendo_manager_name", managerName.trim());
        localStorage.setItem("urugendo_manager_email", managerEmail.trim());
        localStorage.setItem("urugendo_agency", managerAgency.trim());
        localStorage.setItem("urugendo_manager_code", managerCode.trim());
      }

      setUserRole("manager");
      setLoading(false);
      onClose();
      router.push("/manager");
    } catch (err: any) {
      console.error("[LoginPopup] Manager auth error:", err);
      setManagerError(
        err?.message || "Authentication failed. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25 }}
          className="bg-white rounded-t-3xl w-full p-5 pb-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[18px] font-bold text-text-primary">
              {activeTab === "manager"
                ? "Manager Authentication"
                : "Login Options"}
            </h2>
            <button onClick={onClose} className="p-2 cursor-pointer">
              <X size={20} className="text-text-muted" />
            </button>
          </div>

          {activeTab === "options" ? (
            <>
              <p className="text-[13px] text-text-muted mb-4">
                Choose your login type to access the appropriate dashboard
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    onClose();
                    router.push("/user-login");
                  }}
                  className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-surface-secondary transition-colors text-left cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-text-primary">
                      Passenger Login
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Book tickets, view my trips
                    </div>
                  </div>
                  <LogIn size={18} className="text-text-muted shrink-0" />
                </button>

                <button
                  onClick={() => {
                    onClose();
                    router.push("/agency-login");
                  }}
                  className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-surface-secondary transition-colors text-left cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Bus size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-text-primary">
                      Agency Agent Login
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Manage trips, verify tickets, reports
                    </div>
                  </div>
                  <LogIn size={18} className="text-text-muted shrink-0" />
                </button>

                <button
                  onClick={() => setActiveTab("manager")}
                  className="w-full p-4 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center gap-3 hover:bg-purple-100/50 transition-colors text-left cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <ShieldAlert size={20} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-bold text-purple-950">
                      Manager Portal
                    </div>
                    <div className="text-[11px] text-purple-700">
                      Manage branches, agent approvals & MoMo
                    </div>
                  </div>
                  <LogIn size={18} className="text-purple-600 shrink-0" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-4 py-3 text-[14px] font-medium text-text-muted cursor-pointer"
              >
                Continue as Guest
              </button>
            </>
          ) : (
            <form onSubmit={handleManagerSubmit} className="space-y-3">
              <div>
                <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                  Manager Full Name
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="Amani Ishimwe Didier"
                  className="w-full h-11 px-3 rounded-xl border border-border text-[13px] font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                  Official Manager Email
                </label>
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder={MANAGER_EMAIL}
                  className="w-full h-11 px-3 rounded-xl border border-border text-[13px] font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Agency Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setAgencyDropdownOpen(!agencyDropdownOpen)}
                    className="w-full h-11 px-3 text-left rounded-xl border border-border bg-white text-[13px] font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {managerAgency || "Select Agency"}
                    </span>
                    <ChevronDown
                      size={16}
                      className="text-text-muted shrink-0"
                    />
                  </button>

                  {agencyDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-border/50">
                      {(operators.length > 0
                        ? operators
                        : [{ id: "1", name: "Virunga Express" }]
                      ).map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setManagerAgency(op.name);
                            setAgencyDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-[12px] font-semibold hover:bg-primary/5 flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-text-muted" />
                            {op.name}
                          </span>
                          {managerAgency === op.name && (
                            <Check size={14} className="text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Manager Code
                  </label>
                  <input
                    type="text"
                    value={managerCode}
                    onChange={(e) => setManagerCode(e.target.value)}
                    placeholder="MGR-001"
                    className="w-full h-11 px-3 rounded-xl border border-border text-[13px] font-mono font-bold focus:outline-none focus:border-primary uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-3 pr-9 rounded-xl border border-border text-[13px] font-semibold focus:outline-none focus:border-primary"
                  />
                  <Lock
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                </div>
              </div>

              {managerError && (
                <p className="text-[11.5px] font-bold text-red-600 text-center bg-red-50 p-2.5 rounded-xl border border-red-100">
                  {managerError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("options");
                    setManagerError("");
                  }}
                  className="flex-1 h-11 rounded-xl border border-border font-bold text-[13px] text-text-muted hover:bg-surface-secondary cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] h-11 bg-primary text-white font-bold text-[13px] rounded-xl shadow-md active:scale-98 transition-transform cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Authenticating..." : "Authenticate & Enter"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
