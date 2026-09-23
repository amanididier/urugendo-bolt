"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFounderData } from "../FounderContext";
import { generateManagerPasswordHash } from "@/lib/managerAuth";

export default function FounderManagersPage() {
  const { agencies, managers, reload } = useFounderData();
  const [mgrName, setMgrName] = useState("");
  const [mgrEmail, setMgrEmail] = useState("");
  const [mgrCode, setMgrCode] = useState("");
  const [mgrAgency, setMgrAgency] = useState("");
  const [mgrPassword, setMgrPassword] = useState("manager@123");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!mgrAgency && agencies.length > 0) setMgrAgency(agencies[0].name);
  }, [agencies, mgrAgency]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!mgrName.trim() || !mgrEmail.trim() || !mgrCode.trim() || !mgrAgency.trim() || !mgrPassword) {
      setMsg("All manager fields are required.");
      return;
    }
    setCreating(true);
    try {
      const { hash, salt, iterations } = await generateManagerPasswordHash(mgrPassword);
      const { error } = await supabase.from("agency_managers").insert({
        name: mgrName.trim(),
        email: mgrEmail.trim().toLowerCase(),
        manager_code: mgrCode.trim().toUpperCase(),
        agency_name: mgrAgency.trim(),
        password_hash: hash,
        password_salt: salt,
        password_iter: iterations,
        is_active: true,
      });
      if (error) {
        setMsg(error.message.includes("duplicate") || (error as any).code === "23505" ? "Email or manager code already exists." : error.message);
        return;
      }
      setMsg("Manager created and active. They can now log in.");
      setMgrName("");
      setMgrEmail("");
      setMgrCode("");
      reload();
    } catch (err: any) {
      setMsg(err?.message || "Failed to create manager.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary rounded-[20px] p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <h1 className="text-[18px] font-black tracking-tight relative">Managers</h1>
        <p className="text-[13px] text-white/80 relative">Create and approve a manager for any agency — they log in immediately.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-4 sm:gap-6">
        <div className="bg-white rounded-[20px] border border-border p-5 sm:p-6 shadow-sm">
          <h3 className="text-[13px] font-black text-text-primary flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" /> Active managers
          </h3>
          <div className="mt-3 space-y-2">
            {managers.length === 0 ? (
              <p className="text-[13px] text-text-muted">No managers yet.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {managers.map((m) => (
                  <div key={m.id} className="py-3 px-3 rounded-xl bg-surface-secondary border border-border hover:border-primary/20 transition-colors">
                    <div className="text-[13px] font-bold text-text-primary">
                      {m.name} <span className="font-mono text-[11px] text-text-muted">· {m.manager_code}</span>
                    </div>
                    <div className="text-[12px] text-text-secondary truncate">
                      {m.email} · {m.agency_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-[20px] border border-border p-5 sm:p-6 shadow-sm space-y-3 h-fit">
          <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Approve & create manager</p>
          <input value={mgrName} onChange={(e) => setMgrName(e.target.value)} placeholder="Full name" className="h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary w-full" />
          <input value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} placeholder="manager@agency.com" type="email" className="h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={mgrCode}
              onChange={(e) => setMgrCode(e.target.value.toUpperCase())}
              placeholder="MGR-003"
              className="h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-mono font-bold focus:outline-none focus:border-primary uppercase"
            />
            <select value={mgrAgency} onChange={(e) => setMgrAgency(e.target.value)} className="h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary">
              {agencies.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <input value={mgrPassword} onChange={(e) => setMgrPassword(e.target.value)} placeholder="Initial password" type="password" className="h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary w-full" />
          <button disabled={creating} className="w-full h-10 rounded-xl bg-primary text-white text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 hover:bg-primary-hover">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create manager
          </button>
          {msg && <p className={`text-[12px] font-semibold ${msg.includes("created") ? "text-primary" : "text-rose-600"}`}>{msg}</p>}
        </form>
      </div>
    </div>
  );
}
