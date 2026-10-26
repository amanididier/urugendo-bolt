"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { useFounderData } from "../FounderContext";
import { getFounderSession } from "@/lib/founderAuth";
import { updateFounderPassword } from "@/lib/founderAuth";

export default function FounderProfilePage() {
  const session = getFounderSession();
  const email = session?.email ?? "";
  const name = session?.name ?? "Founder";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!current || !next || !confirm) {
      setMsg({ kind: "err", text: "Please fill in all password fields." });
      return;
    }
    if (next !== confirm) {
      setMsg({ kind: "err", text: "New passwords do not match." });
      return;
    }
    if (next.length < 6) {
      setMsg({ kind: "err", text: "New password must be at least 6 characters." });
      return;
    }
    setSaving(true);
    const res = await updateFounderPassword({ email, currentPassword: current, newPassword: next });
    setSaving(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        bad_password: "Current password is incorrect.",
        weak_password: "New password must be at least 6 characters.",
        missing_fields: "All fields are required.",
      };
      setMsg({ kind: "err", text: map[res.reason] || res.reason || "Update failed." });
      return;
    }
    setMsg({ kind: "ok", text: "Password updated in DB. Use it next login." });
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <div className="space-y-6 max-w-[560px]">
      <div>
        <h1 className="text-[20px] font-black tracking-tight text-text-primary">Profile</h1>
        <p className="text-[13px] text-text-muted">Your private founder account — change your password anytime.</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-2">
          <Crown size={16} className="text-primary" /> Founder Profile
        </h3>
        <div className="mt-3 rounded-xl bg-surface-secondary border border-border px-3 py-3">
          <div className="text-[13px] font-bold text-text-primary">{name}</div>
          <div className="text-[12px] text-text-secondary break-all">{email}</div>
          <div className="text-[11px] text-text-muted mt-1">Password is PBKDF2-hashed in founder_admins. Change it here — saved to DB for any device.</div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Change password</p>
          <div>
            <label className="text-[11px] font-semibold text-text-secondary">Current password</label>
            <div className="relative mt-1">
              <input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pr-10 pl-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-surface-secondary">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-text-secondary">New password</label>
            <div className="relative mt-1">
              <input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full h-10 pr-10 pl-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary"
              />
              <button type="button" onClick={() => setShowNext((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-surface-secondary">
                {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {next.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <label className="text-[11px] font-semibold text-text-secondary">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="mt-1 w-full h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary"
              />
            </motion.div>
          )}
          {msg && <p className={`text-[12px] font-semibold rounded-xl px-3 py-2 border ${msg.kind === "ok" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{msg.text}</p>}
          <button disabled={saving} className="w-full h-10 rounded-xl bg-primary text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 hover:bg-primary-hover">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Update password
          </button>
        </form>
      </div>
    </div>
  );
}
