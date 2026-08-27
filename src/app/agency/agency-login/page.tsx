"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Building2,
  MapPin,
  Check,
  ChevronDown,
  KeyRound,
  User,
  X,
  AlertTriangle,
  UserPlus,
  LogIn,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";

interface OperatorOption {
  id: string;
  name: string;
  branches?: string[];
}

const DEFAULT_VIRUNGA_BRANCHES = [
  "Musanze",
  "Kigali",
  "Rubavu",
  "Nyagatare",
  "Gicumbi",
];

const MANAGER_EMAIL = "ishimweamanid@gmail.com";
const LOCKOUT_KEY_PREFIX = "urugendo_lockout_";
const FAILED_ATTEMPTS_KEY_PREFIX = "urugendo_failed_attempts_";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUserRole, setAgentStatus } = useApp();

  const [isSignUp, setIsSignUp] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchCodeInput, setBranchCodeInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Apple designed pending waiting room state for newly registered unapproved agents
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [registeredAgentEmail, setRegisteredAgentEmail] = useState("");

  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [operatorQuery, setOperatorQuery] = useState("");
  const [selectedOperator, setSelectedOperator] =
    useState<OperatorOption | null>(null);
  const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false);
  const operatorFieldRef = useRef<HTMLDivElement>(null);

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchFieldRef = useRef<HTMLDivElement>(null);

  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState<number>(0);

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerAgency, setManagerAgency] = useState("");
  const [managerCode, setManagerCode] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerError, setManagerError] = useState("");

  // Local storage auto-persistence check on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("urugendo_agent_name");
      const savedEmail = localStorage.getItem("urugendo_agent_email");
      const savedAgency = localStorage.getItem("urugendo_agency");
      if (savedName) setFullName(savedName);
      if (savedEmail) setEmail(savedEmail);
      if (savedAgency) setOperatorQuery(savedAgency);
    }
  }, []);

  // Fetch operators from DB and dynamically auto-fetch agency name on manager field
  useEffect(() => {
    async function loadOperators() {
      const { data, error: opError } = await supabase
        .from("operators")
        .select("id, name, branches")
        .order("name", { ascending: true });

      if (opError) {
        console.error("[login] failed to load operators:", opError);
        return;
      }
      if (data) {
        setOperators(data);
        if (data.length === 1) {
          setSelectedOperator(data[0]);
          setOperatorQuery(data[0].name);
        }
      }
    }
    loadOperators();
  }, []);

  // Realtime polling listener to check if the pending agent has been approved by manager
  useEffect(() => {
    if (!isWaitingApproval || !registeredAgentEmail) return;

    const interval = setInterval(async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("email", registeredAgentEmail)
          .single();

        if (profile && profile.status === "approved") {
          setIsWaitingApproval(false);
          setAgentStatus("approved");
          if (typeof window !== "undefined") {
            localStorage.setItem("urugendo_agent_status", "approved");
          }
          router.push("/agency");
        }
      } catch (err) {
        console.warn("[login] approval poll check error:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isWaitingApproval, registeredAgentEmail, router, setAgentStatus]);

  useEffect(() => {
    if (!selectedBranch) return;

    const checkLockout = () => {
      const lockoutTimeStr = localStorage.getItem(
        `${LOCKOUT_KEY_PREFIX}${selectedBranch}`,
      );
      if (lockoutTimeStr) {
        const lockoutEnd = parseInt(lockoutTimeStr, 10);
        const now = Date.now();
        if (now < lockoutEnd) {
          const remaining = Math.ceil((lockoutEnd - now) / 1000);
          setLockoutRemainingSecs(remaining);
        } else {
          localStorage.removeItem(`${LOCKOUT_KEY_PREFIX}${selectedBranch}`);
          localStorage.removeItem(
            `${FAILED_ATTEMPTS_KEY_PREFIX}${selectedBranch}`,
          );
          setLockoutRemainingSecs(0);
        }
      } else {
        setLockoutRemainingSecs(0);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const filteredOperators = operators.filter((op) =>
    op.name.toLowerCase().includes(operatorQuery.toLowerCase()),
  );

  const handleOperatorSelect = (op: OperatorOption) => {
    setSelectedOperator(op);
    setOperatorQuery(op.name);
    setOperatorDropdownOpen(false);
    setSelectedBranch("");
    setBranchCodeInput("");
  };

  const handleOperatorChange = (value: string) => {
    setOperatorQuery(value);
    setSelectedOperator(null);
    setSelectedBranch("");
    setBranchCodeInput("");
    setOperatorDropdownOpen(true);
  };

  const availableBranches =
    selectedOperator?.branches && selectedOperator.branches.length > 0
      ? selectedOperator.branches
      : selectedOperator?.name.toLowerCase().includes("virunga")
        ? DEFAULT_VIRUNGA_BRANCHES
        : [];

  const getExpectedBranchCode = (
    operatorName: string,
    branchName: string,
    branchesList: string[],
  ) => {
    const prefix = operatorName.substring(0, 3).toUpperCase();
    const branchIndex = branchesList.findIndex(
      (b) => b.toLowerCase() === branchName.toLowerCase(),
    );
    const codeNum = (branchIndex >= 0 ? branchIndex + 1 : 1)
      .toString()
      .padStart(3, "0");
    return `${prefix}-${codeNum}`;
  };

  const verifyBranchCode = (): boolean => {
    if (!selectedOperator || !selectedBranch) return false;
    const expected = getExpectedBranchCode(
      selectedOperator.name,
      selectedBranch,
      availableBranches,
    );
    return branchCodeInput.trim().toUpperCase() === expected.toUpperCase();
  };

  const recordFailedAttempt = () => {
    if (!selectedBranch) return;
    const attemptsKey = `${FAILED_ATTEMPTS_KEY_PREFIX}${selectedBranch}`;
    const current = parseInt(localStorage.getItem(attemptsKey) || "0", 10) + 1;

    if (current >= 3) {
      const lockoutEnd = Date.now() + 60 * 60 * 1000;
      localStorage.setItem(
        `${LOCKOUT_KEY_PREFIX}${selectedBranch}`,
        lockoutEnd.toString(),
      );
      localStorage.setItem(attemptsKey, "0");
      setError(
        "Too many failed verification attempts. This station portal is locked for 1 hour.",
      );
    } else {
      localStorage.setItem(attemptsKey, current.toString());
      setError(
        `Invalid Branch Code! (${3 - current} attempt${
          3 - current > 1 ? "s" : ""
        } remaining before 1-hour lock)`,
      );
    }
  };

  const handleAuth = async () => {
    setError("");
    setSuccessMsg("");

    if (lockoutRemainingSecs > 0) {
      const mins = Math.floor(lockoutRemainingSecs / 60);
      const secs = lockoutRemainingSecs % 60;
      setError(
        `Branch portal locked due to failed security attempts. Please wait ${mins}m ${secs}s.`,
      );
      return;
    }

    if (!fullName) {
      setError("Please enter your full name.");
      return;
    }
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (!selectedOperator) {
      setError("Please select your bus operator.");
      return;
    }
    if (availableBranches.length > 0 && !selectedBranch) {
      setError("Please select your agency branch station.");
      return;
    }
    if (!branchCodeInput.trim()) {
      setError("Please enter your station branch security code.");
      return;
    }

    if (!verifyBranchCode()) {
      recordFailedAttempt();
      return;
    }

    if (selectedBranch) {
      localStorage.removeItem(`${FAILED_ATTEMPTS_KEY_PREFIX}${selectedBranch}`);
    }

    setLoading(true);

    if (isSignUp) {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            operator_id: selectedOperator.id,
            branch: selectedBranch,
            role: "agent",
            status: "pending",
          },
        },
      });

      if (authErr) {
        setLoading(false);
        setError(authErr.message);
        return;
      }

      if (authData.user) {
        await supabase.from("profiles").upsert({
          id: authData.user.id,
          full_name: fullName,
          email,
          operator_id: selectedOperator.id,
          branch: selectedBranch,
          role: "agent",
          status: "pending",
        });

        try {
          await supabase.from("agency_agents").insert({
            id: authData.user.id,
            name: fullName,
            email,
            branch_name: selectedBranch,
            phone: "+250 780 000 000",
            is_approved: false,
          });
        } catch (insertErr) {
          console.error("[login] agency_agents insert error:", insertErr);
        }
      }

      // Local storage persistence
      localStorage.setItem("urugendo_agent_name", fullName);
      localStorage.setItem("urugendo_agent_email", email);
      if (selectedOperator) {
        localStorage.setItem("urugendo_agency", selectedOperator.name);
      }
      if (selectedBranch) {
        localStorage.setItem("urugendo_branch", selectedBranch);
      }

      setAgentStatus("pending");
      setLoading(false);
      setRegisteredAgentEmail(email);
      setIsWaitingApproval(true); // Trigger Apple designed pending popup with loading state
    } else {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError || !authData.user) {
        setLoading(false);
        if (
          authError?.message.includes("Invalid login credentials") ||
          authError?.message.includes("User not found")
        ) {
          setError(
            "Account not found or password incorrect. Please switch to Sign Up if you don't have an account.",
          );
        } else {
          setError(
            authError?.message || "Sign in failed. Please check credentials.",
          );
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status, role, full_name")
        .eq("id", authData.user.id)
        .single();

      if (profile && profile.status === "pending") {
        setLoading(false);
        setRegisteredAgentEmail(email);
        setIsWaitingApproval(true); // Intercept and show waiting room popup
        await supabase.auth.signOut();
        return;
      }

      await supabase
        .from("profiles")
        .update({
          full_name: fullName || profile?.full_name,
          operator_id: selectedOperator.id,
          branch: selectedBranch || null,
        })
        .eq("id", authData.user.id);

      setLoading(false);

      if (typeof window !== "undefined") {
        localStorage.setItem("urugendo_role", "agent");
        localStorage.setItem("urugendo_agent_status", "approved");
        localStorage.setItem("urugendo_agent_name", fullName);
        localStorage.setItem("urugendo_agent_email", email);
        if (selectedOperator) {
          localStorage.setItem("urugendo_agency", selectedOperator.name);
        }
        if (selectedBranch) {
          localStorage.setItem("urugendo_branch", selectedBranch);
        }
      }

      setUserRole("agent");
      setAgentStatus("approved");
      router.push("/agency");
    }
  };

  const handleManagerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError("");

    if (
      !managerName ||
      !managerEmail ||
      !managerAgency ||
      !managerCode ||
      !managerPassword
    ) {
      setManagerError("Please fill in all manager credentials.");
      return;
    }

    if (managerEmail.toLowerCase() !== MANAGER_EMAIL.toLowerCase()) {
      setManagerError(
        `Access restricted. Authorized email is ${MANAGER_EMAIL}`,
      );
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("urugendo_role", "manager");
      localStorage.setItem("urugendo_agency", managerAgency);
      localStorage.setItem("urugendo_manager_name", managerName);
      localStorage.setItem("urugendo_manager_email", managerEmail);
    }

    setUserRole("manager");
    setShowManagerModal(false);
    router.push("/manager");
  };

  return (
    <div className="bg-white min-h-screen pb-[88px] font-sans relative">
      {/* Apple Designed Pending Popup Interception Modal */}
      <AnimatePresence>
        {isWaitingApproval && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl text-center space-y-4 border border-border"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <h3 className="text-lg font-black text-text-primary">
                Approval Pending
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Your account has been submitted to the agency management. Wait
                for approval. You may exit the app; we’ll notify you when you're
                approved.
              </p>
              <div className="bg-slate-50 p-3 rounded-2xl text-[11px] font-semibold text-slate-700">
                Registered email:{" "}
                <span className="font-mono text-primary">
                  {registeredAgentEmail}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWaitingApproval(false);
                  router.push("/splash");
                }}
                className="w-full py-3 bg-primary text-white font-bold text-xs rounded-2xl shadow-md active:scale-98 cursor-pointer"
              >
                Exit to Home / Check Later
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-[60px] px-5 pb-6 bg-primary rounded-b-[28px]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-5xl mb-3 text-center"
        >
          🏢
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white text-center">
          {isSignUp ? "Agent Registration" : "Agency Sign In"}
        </h1>
        <p className="text-[13px] text-white/80 text-center mt-1 font-medium">
          {isSignUp
            ? "Create an official agent account for your station"
            : "Manage trips, verify tickets, and view station reports"}
        </p>

        <div className="mt-5 bg-white/10 p-1 rounded-2xl flex gap-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !isSignUp
                ? "bg-white text-primary shadow-sm"
                : "text-white/80 hover:text-white"
            }`}
          >
            <LogIn size={14} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isSignUp
                ? "bg-white text-primary shadow-sm"
                : "text-white/80 hover:text-white"
            }`}
          >
            <UserPlus size={14} />
            Sign Up
          </button>
        </div>
      </div>

      {lockoutRemainingSecs > 0 && (
        <div className="mx-5 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} className="shrink-0 text-red-600" />
          <div className="text-[12px]">
            <span className="font-bold block">Station Locked</span>
            Too many invalid code attempts. Retry in{" "}
            <span className="font-mono font-bold">
              {Math.floor(lockoutRemainingSecs / 60)}m{" "}
              {lockoutRemainingSecs % 60}s
            </span>
          </div>
        </div>
      )}

      <div className="px-5 mt-5 space-y-4">
        <div ref={operatorFieldRef} className="relative">
          <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
            Bus Operator Agency
          </label>
          <div className="relative">
            <Building2
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted z-10"
            />
            <input
              type="text"
              value={operatorQuery}
              onChange={(e) => handleOperatorChange(e.target.value)}
              onFocus={() => setOperatorDropdownOpen(true)}
              onBlur={() =>
                setTimeout(() => setOperatorDropdownOpen(false), 150)
              }
              placeholder="Select or type operator..."
              className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[14px] focus:outline-none focus:border-primary transition-all font-medium"
            />
            {selectedOperator && (
              <Check
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary"
              />
            )}
            {operatorDropdownOpen && filteredOperators.length > 0 && (
              <div className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-2xl shadow-xl overflow-hidden divide-y divide-border/50">
                {filteredOperators.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onMouseDown={() => handleOperatorSelect(op)}
                    className="w-full text-left px-4 py-3 text-[14px] hover:bg-primary/5 flex items-center justify-between transition-colors font-medium text-text-primary cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Building2 size={16} className="text-text-muted" />
                      {op.name}
                    </span>
                    {selectedOperator?.id === op.id && (
                      <Check size={16} className="text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedOperator && availableBranches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            ref={branchFieldRef}
            className="relative"
          >
            <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
              Station / Branch
            </label>
            <div className="relative">
              <MapPin
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary z-10"
              />
              <button
                type="button"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                onBlur={() =>
                  setTimeout(() => setBranchDropdownOpen(false), 150)
                }
                className="w-full h-12 pl-10 pr-10 text-left rounded-xl border border-border bg-white text-[14px] font-medium text-text-primary focus:outline-none focus:border-primary flex items-center justify-between cursor-pointer"
              >
                <span
                  className={
                    selectedBranch
                      ? "text-text-primary font-semibold"
                      : "text-text-muted"
                  }
                >
                  {selectedBranch
                    ? `${selectedBranch} Branch`
                    : "Select branch station..."}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-text-muted transition-transform duration-200 ${
                    branchDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {branchDropdownOpen && (
                <div className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-2xl shadow-xl overflow-hidden divide-y divide-border/50 max-h-56 overflow-y-auto">
                  {availableBranches.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      onMouseDown={() => {
                        setSelectedBranch(branch);
                        setBranchDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-[14px] flex items-center justify-between transition-colors font-medium cursor-pointer ${
                        selectedBranch === branch
                          ? "bg-primary/10 text-primary font-bold"
                          : "hover:bg-primary/5 text-text-primary"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <MapPin
                          size={15}
                          className={
                            selectedBranch === branch
                              ? "text-primary"
                              : "text-text-muted"
                          }
                        />
                        {branch} Station
                      </span>
                      {selectedBranch === branch && (
                        <Check size={16} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {selectedBranch && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
              Station Security Branch Code
            </label>
            <div className="relative">
              <KeyRound
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary"
              />
              <input
                type="text"
                value={branchCodeInput}
                onChange={(e) =>
                  setBranchCodeInput(e.target.value.toUpperCase())
                }
                disabled={lockoutRemainingSecs > 0}
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[14px] font-mono tracking-wider focus:outline-none focus:border-primary uppercase font-bold disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </motion.div>
        )}

        <div>
          <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
            Agent Full Name
          </label>
          <div className="relative">
            <User
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Didier Ishimwe"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[14px] focus:outline-none focus:border-primary font-medium"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@urugendo.rw"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[14px] focus:outline-none focus:border-primary font-medium"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-text-primary block mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[14px] focus:outline-none focus:border-primary font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted cursor-pointer"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[12.5px] text-red-600 font-semibold text-center bg-red-50 p-2.5 rounded-xl border border-red-100">
            {error}
          </p>
        )}

        {successMsg && (
          <p className="text-[12.5px] text-emerald-700 font-semibold text-center bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
            {successMsg}
          </p>
        )}

        <button
          type="button"
          onClick={handleAuth}
          disabled={
            !fullName ||
            !email ||
            !password ||
            !selectedOperator ||
            !selectedBranch ||
            !branchCodeInput ||
            lockoutRemainingSecs > 0 ||
            loading
          }
          className={`w-full h-12 rounded-2xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
            fullName &&
            email &&
            password &&
            selectedOperator &&
            selectedBranch &&
            branchCodeInput &&
            lockoutRemainingSecs === 0 &&
            !loading
              ? "bg-primary text-white shadow-primary/20 active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
          }`}
        >
          {loading
            ? isSignUp
              ? "Registering..."
              : "Signing in..."
            : isSignUp
              ? "Create Agent Account"
              : "Sign In to Branch"}
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="px-5 mt-4 text-center">
        <p className="text-[12.5px] text-text-muted">
          {isSignUp ? "Already registered?" : "New station agent?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setSuccessMsg("");
            }}
            className="text-primary font-bold hover:underline cursor-pointer"
          >
            {isSignUp ? "Sign In instead" : "Sign Up for access"}
          </button>
        </p>
      </div>

      <div className="px-5 mt-6 text-center space-y-3">
        <div>
          <button
            type="button"
            onClick={() => router.push("/splash")}
            className="text-[13px] text-text-muted font-semibold hover:text-text-primary transition-colors cursor-pointer"
          >
            Back to home
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowManagerModal(true)}
            className="text-[12px] text-primary/80 font-bold hover:text-primary transition-colors underline underline-offset-4 cursor-pointer"
          >
            Manager / Admin Access
          </button>
        </div>
      </div>

      <div className="px-5 mt-6 flex items-center justify-center gap-2 text-[11px] text-text-muted">
        <Shield size={14} />
        <span>Station Isolation Protected • 256-bit Encrypted</span>
      </div>

      <AnimatePresence>
        {showManagerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-border"
            >
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="absolute right-4 top-4 text-text-muted hover:text-text-primary p-1 rounded-full cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-text-primary">
                    Manager Portal
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Overall agency oversight & branch controls
                  </p>
                </div>
              </div>

              <form onSubmit={handleManagerLogin} className="mt-4 space-y-3">
                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Manager Full Name
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Manager Name"
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
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
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                      Agency Name
                    </label>
                    <input
                      type="text"
                      value={managerAgency}
                      onChange={(e) => setManagerAgency(e.target.value)}
                      placeholder="Virunga Express"
                      className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                    />
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
                      className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-mono font-bold focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-text-primary block mb-1">
                    Master Password
                  </label>
                  <input
                    type="password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 rounded-xl border border-border text-[13px] font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                {managerError && (
                  <p className="text-[11px] font-bold text-red-600 text-center bg-red-50 p-2 rounded-lg">
                    {managerError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full h-11 bg-primary text-white font-bold text-[13px] rounded-xl shadow-md active:scale-98 transition-transform mt-2 cursor-pointer"
                >
                  Authenticate Manager Portal
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
