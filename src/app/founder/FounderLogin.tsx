"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2 } from "lucide-react";
import { authenticateFounder, persistFounderSession } from "@/lib/founderAuth";

export default function FounderLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("ishimwemanid@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const res = await authenticateFounder({ email, password });
    setLoading(false);
    if (!res.ok) {
      const msg =
        res.reason === "not_found"
          ? "No founder account with that email."
          : res.reason === "bad_password"
            ? "Incorrect password."
            : res.reason === "missing_fields"
              ? "All fields are required."
              : "Login failed. Try again.";
      setError(msg);
      return;
    }
    persistFounderSession(res.founder);
    onSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]">
        <div className="bg-white rounded-[28px] border border-border p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center">
              <Crown size={20} />
            </div>
            <div>
              <h1 className="text-[18px] font-black tracking-tight text-text-primary">Founder</h1>
              <p className="text-[12px] font-medium text-text-muted">Private — Urugendo Studio</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="ishimwemanid@gmail.com"
                className="mt-1 w-full h-11 px-4 rounded-xl border border-border bg-white text-[14px] font-medium focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 w-full h-11 px-4 rounded-xl border border-border bg-white text-[14px] font-medium focus:outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-[12px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Enter Studio"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-center text-text-muted">This page is unlisted. No link to it exists in the passenger, agent, or manager apps.</p>
        </div>
      </motion.div>
    </div>
  );
}
