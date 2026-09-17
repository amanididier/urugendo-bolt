"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bell, X, Ticket, Bus, AlertTriangle, CheckCircle2, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface ToastNotif {
  id: string;
  title: string;
  message: string;
  type: string;
  action_url?: string | null;
}

const getIcon = (type: string) => {
  switch (type) {
    case "booking": case "verification": return <Ticket size={16} className="text-emerald-600" />;
    case "delay": return <AlertTriangle size={16} className="text-amber-600" />;
    case "reminder": return <Bus size={16} className="text-blue-600" />;
    case "promo": return <Megaphone size={16} className="text-purple-600" />;
    default: return <Bell size={16} className="text-slate-600" />;
  }
};

export function NotificationToast() {
  const router = useRouter();
  const [queue, setQueue] = useState<ToastNotif[]>([]);

  const dismiss = useCallback((id: string) => {
    setQueue((q) => q.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    let ch: any = null;
    let uid: string | null = null;

    supabase.auth.getUser().then(({ data }) => {
      uid = data.user?.id || null;
      if (!uid) return;
      ch = supabase
        .channel(`toast-notifs-${uid}`)
        .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (payload: any) => {
          const row = payload.new;
          if (!row) return;
          const notif: ToastNotif = { id: row.id, title: row.title, message: row.message, type: row.type, action_url: row.action_url };
          setQueue((q) => [...q, notif]);
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try { new Notification(row.title, { body: row.message, icon: "/favicon.png" }); } catch {}
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().catch(() => {});
            }
          }
          try { const a = new Audio("/notification.mp3"); a.volume = 0.45; a.play().catch(() => {}); } catch {}
          setTimeout(() => dismiss(row.id), 6000);
        })
        .subscribe();
    });

    return () => { if (ch) supabase.removeChannel(ch); };
  }, [dismiss]);

  return (
    <div className="fixed top-3 inset-x-3 z-[60] flex flex-col gap-2 pointer-events-none max-w-md mx-auto">
      <AnimatePresence>
        {queue.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={() => {
              dismiss(n.id);
              if (n.action_url) router.push(n.action_url);
              else router.push("/user-notifications");
            }}
            className="pointer-events-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 flex gap-3 cursor-pointer hover:border-primary/30 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
              {getIcon(n.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-slate-900 leading-tight">{n.title}</div>
              <div className="text-[12px] text-slate-600 leading-snug mt-0.5 line-clamp-2">{n.message}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 hover:bg-slate-200"
            >
              <X size={12} className="text-slate-500" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
