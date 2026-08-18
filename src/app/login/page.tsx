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
  Check,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";

interface OperatorOption {
  id: string;
  name: string;
}

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

  const isAgency = searchParams.get("role") === "agency";

  // Load operators from the database — currently just Virunga Express.
  // Adding a new operator later needs zero changes here: it will simply
  // appear in this list once its row exists in the operators table.
  useEffect(() => {
    async function loadOperators() {
      const { data, error: opError } = await supabase
        .from("operators")
        .select("id, name")
        .order("name", { ascending: true });

      // Temporary connection test log:
      console.log("Supabase operators fetch result:", { data, opError });

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
  };

  const handleOperatorChange = (value: string) => {
    setOperatorQuery(value);
    setSelectedOperator(null);
    setOperatorDropdownOpen(true);
  };

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

    // Link this agent's profile to the selected operator.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ operator_id: selectedOperator.id })
      .eq("id", authData.user.id);

    setLoading(false);

    if (profileError) {
      console.error("[login] failed to link operator to profile:", {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code,
      });
      setError(
        "Signed in, but could not link your operator account. Please contact support.",
      );
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("urugendo_role", "agent");
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
          {/* Operator dropdown */}
          <div ref={operatorFieldRef}>
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
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
              />
              {selectedOperator && (
                <Check
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary"
                />
              )}

              {operatorDropdownOpen && filteredOperators.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                  {filteredOperators.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onMouseDown={() => handleOperatorSelect(op)}
                      className="w-full text-left px-4 py-3 text-[15px] hover:bg-primary/5 flex items-center gap-2 transition-colors"
                    >
                      <Building2 size={16} className="text-text-muted" />
                      {op.name}
                    </button>
                  ))}
                </div>
              )}

              {operatorDropdownOpen &&
                operatorQuery &&
                filteredOperators.length === 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-[13px] text-text-muted">
                    No matching operator found
                  </div>
                )}
            </div>
          </div>

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
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
              />
            </div>
          </div>
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
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!email || !password || !selectedOperator || loading}
            className={`w-full h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
              email && password && selectedOperator && !loading
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-400"
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
          className="text-[13px] text-text-muted font-semibold"
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
