"use client";

import { useState } from "react";
import { Building2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFounderData } from "../FounderContext";

export default function FounderAgenciesPage() {
  const { agencies, loading, reload } = useFounderData();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const trimmed = name.trim();
    if (!trimmed) {
      setMsg("Agency name is required.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("operators").insert({ name: trimmed, branches: [] as string[] });
    setCreating(false);
    if (error) {
      setMsg(error.message.includes("duplicate") || error.message.includes("unique") ? "An agency with that name already exists." : error.message);
      return;
    }
    setMsg("Agency created.");
    setName("");
    reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-black tracking-tight text-text-primary">Agencies</h1>
        <p className="text-[13px] text-text-muted">Real agencies from operators — add a new one for your next pitch.</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-[13px] font-black text-text-primary flex items-center gap-2">
          <Building2 size={16} className="text-primary" /> All agencies
        </h3>
        {loading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : agencies.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-muted">No agencies yet. Add your first below.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {agencies.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-secondary border border-border">
                <span className="text-[13px] font-bold text-text-primary">{a.name}</span>
                <span className="text-[11px] font-medium text-text-muted">{a.branches?.length ?? 0} branches seeded</span>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-2">
          <label className="text-[11px] font-bold tracking-widest uppercase text-text-muted">Add agency</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Horizon Express"
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:border-primary"
            />
            <button disabled={creating} className="h-10 px-4 rounded-xl bg-primary text-white text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-60 hover:bg-primary-hover">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
            </button>
          </div>
          {msg && <p className={`text-[12px] font-semibold ${msg.includes("created") ? "text-primary" : "text-rose-600"}`}>{msg}</p>}
        </form>
      </div>
    </div>
  );
}
