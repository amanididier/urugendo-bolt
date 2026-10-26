"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Ticket, Bus, Megaphone, Check, Trash2, Clock, AlertTriangle, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { markNotificationRead } from "@/lib/notificationsService";

interface AgentNotifRow {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function AgencyNotificationsPage() {
  const [notifications, setNotifications] = useState<AgentNotifRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [currentStation, setCurrentStation] = useState("Musanze");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const branch = typeof window !== "undefined" ? localStorage.getItem("urugendo_branch") || "Musanze" : "Musanze";
    setCurrentStation(branch);
    let ch: any = null;
    let mounted = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setLoading(false); return; }
      const { data } = await supabase.from("notifications").select("id,title,message,type,read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (mounted) { setNotifications((data as any) || []); setLoading(false); }
      ch = supabase.channel(`agent-notifs-page-${user.id}`)
        .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload: any) => {
          const row = payload.new; if (!row || !mounted) return;
          setNotifications((prev) => [{ id: row.id, title: row.title, message: row.message, type: row.type, read: row.read, created_at: row.created_at }, ...prev]);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try { new Notification(row.title, { body: row.message, icon: "/favicon.png" }); } catch {}
          }
        })
        .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload: any) => {
          const row = payload.new; if (!row || !mounted) return;
          setNotifications((prev) => prev.map((n) => n.id === row.id ? { ...n, read: row.read } : n));
        })
        .subscribe();
    }
    load();
    return () => { mounted = false; if (ch) supabase.removeChannel(ch); };
  }, []);

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await markNotificationRead(id);
  };
  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  };
  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "payment": case "booking": case "verification": return <Ticket size={18} className="text-emerald-500" />;
      case "incoming": return <Bus size={18} className="text-blue-500" />;
      case "departure": case "reminder": return <Clock size={18} className="text-amber-500" />;
      case "delay": return <AlertTriangle size={18} className="text-red-500" />;
      default: return <Megaphone size={18} className="text-purple-500" />;
    }
  };
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr); const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000); const diffHours = Math.floor(diffMins / 60); const diffDays = Math.floor(diffHours / 24);
    if (isNaN(diffMins) || diffMins < 0) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans antialiased text-slate-900 selection:bg-emerald-500 selection:text-white">
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/80 px-5 pt-12 pb-4 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5"><Building2 size={13} /> {currentStation} Terminal</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Notifications</h1>
          </div>
          {unreadCount > 0 && <motion.button whileTap={{ scale: 0.95 }} onClick={markAllAsRead} className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer">Mark all read</motion.button>}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="bg-slate-200/70 p-1 rounded-2xl flex gap-1">
          <button onClick={() => setFilter("all")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>All Alerts ({notifications.length})</button>
          <button onClick={() => setFilter("unread")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === "unread" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Unread ({unreadCount})</button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {loading ? <div className="text-center py-16 text-[13px] text-slate-400 animate-pulse">Loading...</div>
          : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-xs mt-4 p-6">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"><CheckCircle2 size={26} /></div>
              <h3 className="text-base font-bold text-slate-800">All caught up!</h3>
              <p className="text-xs text-slate-500 mt-1">No new branch notifications for {currentStation}.</p>
            </motion.div>
          ) : filtered.map((notification, i) => (
            <motion.div key={notification.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, delay: i * 0.03 }}
              className={`relative overflow-hidden rounded-3xl p-4 transition-all border shadow-xs ${notification.read ? "bg-white border-slate-200/80 text-slate-700" : "bg-gradient-to-br from-white via-emerald-50/30 to-emerald-50/60 border-emerald-500/30 ring-2 ring-emerald-500/10 text-slate-900"}`}>
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${notification.read ? "bg-slate-100 text-slate-500" : "bg-white text-emerald-600 shadow-emerald-500/10"}`}>{getIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1"><h3 className="text-xs font-black tracking-wide uppercase text-slate-800 flex-1 truncate">{notification.title}</h3>{!notification.read && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />}</div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium mb-3">{notification.message}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400">{getTimeAgo(notification.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {!notification.read && <motion.button whileTap={{ scale: 0.95 }} onClick={() => markAsRead(notification.id)} className="text-[11px] font-extrabold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg"><Check size={13} /> Read</motion.button>}
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => deleteNotification(notification.id)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer" title="Delete"><Trash2 size={14} /></motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
