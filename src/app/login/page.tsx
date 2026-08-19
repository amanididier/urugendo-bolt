"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
  const { setUserRole } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Operator dropdown state ---
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [operatorQuery, setOperatorQuery] = useState("");
  const [selectedOperator, setSelectedOperator] =
    useState<OperatorOption | null>(null);
  const [operatorDropdownOpen, setOperatorDropdownOpen] = useState(false);
  const operatorFieldRef = useRef<HTMLDivElement>(null);

  // --- Branch dropdown state ---
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchFieldRef = useRef<HTMLDivElement>(null);

  // Load operators from database
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

  const filteredOperators = operators.filter((op) =>
    op.name.toLowerCase().includes(operatorQuery.toLowerCase()),
  );

  const handleOperatorSelect = (op: OperatorOption) => {
    setSelectedOperator(op);
    setOperatorQuery(op.name);
    setOperatorDropdownOpen(false);
    setSelectedBranch(""); // Reset selected branch when operator changes
  };

  const handleOperatorChange = (value: string) => {
    setOperatorQuery(value);
    setSelectedOperator(null);
    setSelectedBranch("");
    setOperatorDropdownOpen(true);
  };

  // Determine available branches for the selected agency
  const availableBranches =
    selectedOperator?.branches && selectedOperator.branches.length > 0
      ? selectedOperator.branches
      : selectedOperator?.name.toLowerCase().includes("virunga")
        ? DEFAULT_VIRUNGA_BRANCHES
        : [];

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    if (!selectedOperator) {
      setError("Please select your bus operator");
      return;
    }
    if (availableBranches.length > 0 && !selectedBranch) {
      setError("Please select your agency branch");
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      setLoading(false);
      setError(
        authError?.message ||
          "Sign in failed. Please check your email and password.",
      );
      return;
    }

    // Link agent's profile to selected operator and branch
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        operator_id: selectedOperator.id,
        branch: selectedBranch || null,
      })
      .eq("id", authData.user.id);

    setLoading(false);

    if (profileError) {
      console.error("[login] failed to link profile:", profileError);
      setError(
        "Signed in, but could not update profile branch details. Please contact support.",
      );
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("urugendo_role", "agent");
      if (selectedBranch) {
        localStorage.setItem("urugendo_branch", selectedBranch);
      }
    }

    setUserRole("agent");
    router.push("/agency");
  };

  return (
    <div className="bg-white min-h-screen pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-6 bg-primary rounded-b-[28px]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-5xl mb-4 text-center"
        >
          🏢
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white text-center">
          Agency Sign In
        </h1>
        <p className="text-[14px] text-white/70 text-center mt-2">
          Manage trips, verify tickets, and view reports
        </p>
      </div>

      {/* Login Form */}
      <div className="px-5 mt-6">
        <div className="space-y-4">
          {/* Operator Dropdown Field */}
          <div ref={operatorFieldRef} className="relative">
            <label className="text-[13px] font-semibold text-text-primary block mb-2">
              Bus Operator
            </label>
            <div className="relative">
              <Building2
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10"
              />
              <input
                type="text"
                value={operatorQuery}
                onChange={(e) => handleOperatorChange(e.target.value)}
                onFocus={() => setOperatorDropdownOpen(true)}
                onBlur={() =>
                  setTimeout(() => setOperatorDropdownOpen(false), 150)
                }
                placeholder="Start typing your operator..."
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary transition-all font-medium"
              />
              {selectedOperator && (
                <Check
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary"
                />
              )}
              {operatorDropdownOpen && filteredOperators.length > 0 && (
                <div className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-2xl shadow-xl overflow-hidden divide-y divide-border/50">
                  {filteredOperators.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onMouseDown={() => handleOperatorSelect(op)}
                      className="w-full text-left px-4 py-3 text-[14px] hover:bg-primary/5 flex items-center justify-between transition-colors font-medium text-text-primary"
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

          {/* Branch Selection Dropdown - Rendered after Agency Selection */}
          {selectedOperator && availableBranches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              ref={branchFieldRef}
              className="relative"
            >
              <label className="text-[13px] font-semibold text-text-primary block mb-2">
                Station / Agency Branch
              </label>
              <div className="relative">
                <MapPin
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-primary z-10"
                />
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  onBlur={() =>
                    setTimeout(() => setBranchDropdownOpen(false), 150)
                  }
                  className="w-full h-12 pl-10 pr-10 text-left rounded-xl border border-border bg-white text-[15px] font-medium text-text-primary focus:outline-none focus:border-primary flex items-center justify-between"
                >
                  <span
                    className={
                      selectedBranch ? "text-text-primary" : "text-text-muted"
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
                        className={`w-full text-left px-4 py-3 text-[14px] flex items-center justify-between transition-colors font-medium ${
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

          {/* Email Input */}
          <div>
            <label className="text-[13px] font-semibold text-text-primary block mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agency@virunga.rw"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary font-medium"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="text-[13px] font-semibold text-text-primary block mb-2">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 text-center font-medium">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={
              !email ||
              !password ||
              !selectedOperator ||
              (availableBranches.length > 0 && !selectedBranch) ||
              loading
            }
            className={`w-full h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all shadow-md ${
              email &&
              password &&
              selectedOperator &&
              (!availableBranches.length || selectedBranch) &&
              !loading
                ? "bg-primary text-white shadow-primary/20 active:scale-[0.98]"
                : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
            }`}
          >
            {loading ? "Signing in..." : "Sign In"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Back to passenger */}
      <div className="px-5 mt-6 text-center">
        <button
          onClick={() => router.push("/splash")}
          className="text-[13px] text-text-muted font-semibold hover:text-text-primary transition-colors"
        >
          Back to home
        </button>
      </div>

      {/* Security Note */}
      <div className="px-5 mt-6 flex items-center justify-center gap-2 text-[11px] text-text-muted">
        <Shield size={14} />
        <span>256-bit encrypted • Safe & secure</span>
      </div>
    </div>
  );
}
