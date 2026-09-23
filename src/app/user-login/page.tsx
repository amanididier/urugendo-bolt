"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  X,
  Sparkles,
  User,
  Lock,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/translations";

export default function UserLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <UserLoginContent />
    </Suspense>
  );
}

function UserLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/home";
  const {
    setUserRole,
    setIsLoggedIn,
    setUserName,
    setUserEmail,
    userName,
    userEmail,
    language,
  } = useApp();

  const [isSignUp, setIsSignUp] = useState(false);
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userName && !fullName) setFullName(userName);
    if (userEmail && !email) setEmail(userEmail);
  }, [userName, userEmail, fullName, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!phone || phone.length < 9) {
        setError("Please enter a valid mobile phone number.");
        setLoading(false);
        return;
      }

      if (isSignUp && !fullName.trim()) {
        setError("Please enter your full name.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      if (isSignUp && password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }

      const resolvedName = fullName || `Traveler ${phone.slice(-4)}`;
      const authEmail = email || `${phone.replace(/\D/g, "")}@urugendo.rw`;
      const resolvedEmail = email || `${phone}@urugendo.rw`;

      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: { data: { full_name: resolvedName, phone } },
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
        if (signInErr) throw signInErr;
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("urugendo_role", "passenger");
        localStorage.setItem("urugendo_is_logged_in", "true");
        localStorage.setItem("urugendo_user_name", resolvedName);
        localStorage.setItem("urugendo_user_email", resolvedEmail);
      }

      setUserRole("passenger");
      setIsLoggedIn(true);
      setUserName(resolvedName);
      setUserEmail(resolvedEmail);
      setLoading(false);
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-white/40 rounded-[32px] shadow-2xl overflow-hidden p-6 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={() => router.back()}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="text-center mt-2 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Sparkles size={24} />
          </div>
          <h2 className="text-[22px] font-black text-slate-900 tracking-tight">
            {isSignUp
              ? language === "RW"
                ? "Fungura Konti ya Urugendo"
                : "Create Urugendo Account"
              : language === "RW"
                ? "Murakaza Neza"
                : "Welcome Back"}
          </h2>
          <p className="text-[13px] text-slate-500 mt-1 font-medium">
            {isSignUp
              ? language === "RW"
                ? "Iyandikishe ubu ubone amatike y'ubuntu ukwezi kose."
                : "Sign up now and enjoy free bookings this month."
              : language === "RW"
                ? "Injira kugira ngo ucunge amatike yawe."
                : "Sign in to manage your active bookings"}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 mb-4">
          <button
            type="button"
            onClick={() => setAuthMethod("phone")}
            className={`flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMethod === "phone"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Phone size={14} />{" "}
            {isSignUp
              ? language === "RW"
                ? "Kwiyandikisha Byihuse"
                : "Quick Sign Up"
              : language === "RW"
                ? "Kwinjira Byihuse"
                : "Quick Sign In"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("email");
              handleGoogleLogin();
            }}
            className="flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 bg-white text-slate-900 shadow-sm transition-all cursor-pointer hover:bg-slate-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.17 21.32 7.23 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.18C.43 8.12 0 9.82 0 12s.43 3.88 1.18 5.4l4.09-3.16z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.18 6.6l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Google Sign-In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1">
              {language === "RW" ? "Nimero ya Telefoni" : "Mobile Phone Number"}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">
                +250
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="788 123 456"
                className="w-full h-11 pl-16 pr-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {language === "RW" ? "Amazina Yose" : "Full Names"}
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean-Paul"
                  className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-900 focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1">
              {language === "RW" ? "Imeyili" : "Email Address"}{" "}
              <span className="text-slate-400 font-normal">
                {language === "RW" ? "(Ntibitegetswe)" : "(Optional)"}
              </span>
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1">
              {language === "RW" ? "Ijambo ry'Ibanga (Password)" : "Password"}
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="text-[12px] font-bold text-slate-700 block mb-1">
                {language === "RW"
                  ? "Emeza Ijambo ry'Ibanga"
                  : "Reconfirm Password"}
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-900 focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-[12px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/95 active:scale-[0.98] text-white font-extrabold text-[14px] flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all cursor-pointer mt-2"
          >
            {loading
              ? language === "RW"
                ? "Birimo gutunganywa..."
                : "Processing..."
              : isSignUp
                ? language === "RW"
                  ? "Arangiza Kwiyandikisha"
                  : "Complete Sign Up"
                : language === "RW"
                  ? "Injira"
                  : "Sign In"}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-[13px] font-bold text-primary hover:underline cursor-pointer"
          >
            {isSignUp
              ? language === "RW"
                ? "Ufite konti? Injira"
                : "Already have an account? Sign In"
              : language === "RW"
                ? "Nta konti ufite? Iyandikishe"
                : "Don't have an account? Sign Up"}
          </button>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck size={14} className="text-primary" />{" "}
          {language === "RW"
            ? "Kugenzura ku Kigo • Bitwikiriwe n'Umutekano"
            : "Instant Station Verification • Encrypted"}
        </div>
      </motion.div>
    </div>
  );
}
