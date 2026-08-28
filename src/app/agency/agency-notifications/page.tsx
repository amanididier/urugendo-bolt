"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Ticket,
  Bus,
  Megaphone,
  Check,
  Trash2,
  Clock,
  AlertTriangle,
  Building2,
  CheckCircle2,
} from "lucide-react";

interface AgentNotification {
  id: string;
  station: string;
  title: string;
  message: string;
  type: "payment" | "incoming" | "departure" | "delay" | "system";
  read: boolean;
  createdAt: string;
}

const STORAGE_KEY = "urugendo_agent_branch_notifications_v1";

const cleanName = (str: string) =>
  (str || "")
    .toLowerCase()
    .replace(/branch|station/g, "")
    .trim();

export default function AgencyNotificationsPage() {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [currentStation, setCurrentStation] = useState<string>("Musanze");

  useEffect(() => {
    const branch = localStorage.getItem("urugendo_branch") || "Musanze";
    setCurrentStation(branch);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    const defaults: AgentNotification[] = [
      {
        id: `init-1-${Date.now()}`,
        station: "Musanze",
        title: "Pending Payment Verification",
        message:
          "Passenger Jean Bosco submitted a MoMo payment of 5,000 RWF. Please verify phone number and transaction.",
        type: "payment",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: `init-2-${Date.now()}`,
        station: "Musanze",
        title: "Incoming Bus Alert",
        message:
          "Bus RAC 112D from Rubavu Station is arriving soon. Estimated ETA: 15:45. Check manifest page for more info.",
        type: "incoming",
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    setNotifications(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  }, []);

  const triggerRealPush = (title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
        try {
          const audio = new Audio(
            "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
          );
          audio.volume = 0.4;
          audio.play().catch(() => {});
        } catch (e) {}
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, { body, icon: "/favicon.ico" });
          }
        });
      }
    }
  };

  const saveToStorage = (updated: AgentNotification[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const addNewNotification = (
    title: string,
    message: string,
    type: AgentNotification["type"],
  ) => {
    const newAlert: AgentNotification = {
      id: `alert-${Date.now()}`,
      station: currentStation,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newAlert, ...notifications];
    saveToStorage(updated);
    triggerRealPush(title, message);
  };

  const currentKey = cleanName(currentStation);
  const stationNotifications = notifications.filter(
    (n) => cleanName(n.station || "musanze") === currentKey,
  );

  const filtered =
    filter === "unread"
      ? stationNotifications.filter((n) => !n.read)
      : stationNotifications;

  const unreadCount = stationNotifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    saveToStorage(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) =>
      cleanName(n.station) === currentKey ? { ...n, read: true } : n,
    );
    saveToStorage(updated);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    saveToStorage(updated);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <Ticket size={18} className="text-emerald-500" />;
      case "incoming":
        return <Bus size={18} className="text-blue-500" />;
      case "departure":
        return <Clock size={18} className="text-amber-500" />;
      case "delay":
        return <AlertTriangle size={18} className="text-red-500" />;
      default:
        return <Megaphone size={18} className="text-purple-500" />;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isNaN(diffMins) || diffMins < 0) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans antialiased text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Apple / Samsung Clean Glass Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-slate-200/80 px-5 pt-12 pb-4 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
              <Building2 size={13} /> {currentStation} Terminal
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Notifications
            </h1>
          </div>
          {unreadCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={markAllAsRead}
              className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              Mark all read
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="bg-slate-200/70 p-1 rounded-2xl flex gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Alerts ({stationNotifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === "unread"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notification Stream */}
      <div className="max-w-md mx-auto px-4 pt-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-xs mt-4 p-6"
            >
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                All caught up!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                No new branch notifications for {currentStation}.
              </p>
            </motion.div>
          ) : (
            filtered.map((notification, i) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className={`relative overflow-hidden rounded-3xl p-4 transition-all border shadow-xs ${
                  notification.read
                    ? "bg-white border-slate-200/80 text-slate-700"
                    : "bg-gradient-to-br from-white via-emerald-50/30 to-emerald-50/60 border-emerald-500/30 ring-2 ring-emerald-500/10 text-slate-900"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                      notification.read
                        ? "bg-slate-100 text-slate-500"
                        : "bg-white text-emerald-600 shadow-emerald-500/10"
                    }`}
                  >
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-black tracking-wide uppercase text-slate-800 flex-1 truncate">
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium mb-3">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400">
                        {getTimeAgo(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => markAsRead(notification.id)}
                            className="text-[11px] font-extrabold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg"
                          >
                            <Check size={13} /> Read
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => deleteNotification(notification.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
