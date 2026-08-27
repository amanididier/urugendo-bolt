"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Ticket,
  Bus,
  Star,
  Megaphone,
  Check,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";

const initialSampleUserNotifications = [
  {
    id: "security-1",
    title: "Secure Your Account",
    message:
      "Protect your bookings and ticket data by finishing your account verification. Tap to verify now.",
    type: "security" as const,
    read: false,
    createdAt: "2026-08-24T08:00:00",
  },
  {
    id: "1",
    title: "Booking Confirmed!",
    message:
      "Your bus from Musanze to Kigali on 08:30 AM is confirmed. Code: XK7P2Q",
    type: "booking" as const,
    read: false,
    createdAt: "2026-04-13T14:30:00",
  },
];

export default function NotificationsPage() {
  const router = useRouter();
  const { language } = useApp();
  const [notifications, setNotifications] = useState(
    initialSampleUserNotifications,
  );
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("urugendo_user_notifications");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const uniqueNew = parsed.filter(
              (item: { id: string }) => !existingIds.has(item.id),
            );
            return [...uniqueNew, ...prev];
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    setNotifications(updated);
    try {
      localStorage.setItem(
        "urugendo_user_notifications",
        JSON.stringify(updated),
      );
    } catch {
      // ignore
    }
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      localStorage.setItem(
        "urugendo_user_notifications",
        JSON.stringify(updated),
      );
    } catch {
      // ignore
    }
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    try {
      localStorage.setItem(
        "urugendo_user_notifications",
        JSON.stringify(updated),
      );
    } catch {
      // ignore
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "security":
        return <ShieldAlert size={18} className="text-amber-600" />;
      case "booking":
        return <Ticket size={18} className="text-primary" />;
      case "departure":
        return <Bus size={18} className="text-blue-600" />;
      case "promo":
        return <Megaphone size={18} className="text-amber-600" />;
      case "system":
        return <Star size={18} className="text-purple-600" />;
      default:
        return <Bell size={18} className="text-gray-600" />;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isNaN(diffMins) || diffMins < 0)
      return language === "RW" ? "Ubu" : "Just now";
    if (diffMins < 60)
      return `${diffMins}m ${language === "RW" ? "ize" : "ago"}`;
    if (diffHours < 24)
      return `${diffHours}h ${language === "RW" ? "ize" : "ago"}`;
    return `${diffDays}d ${language === "RW" ? "ize" : "ago"}`;
  };

  return (
    <div className="bg-white pb-[88px] min-h-screen font-sans">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold text-slate-900">
              {language === "RW" ? "Amatangazo" : "Notifications"}
            </h1>
            <p className="text-[13px] text-slate-500">
              {unreadCount} {language === "RW" ? "atarasomwa" : "unread"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[13px] text-primary font-semibold cursor-pointer hover:underline"
            >
              {language === "RW" ? "Soma byose" : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
              filter === "all"
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {language === "RW" ? "Byose" : "All"}
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors cursor-pointer ${
              filter === "unread"
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {language === "RW"
              ? `Atarasomwa (${unreadCount})`
              : `Unread (${unreadCount})`}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-slate-500">
              {language === "RW"
                ? "Nta matangazo mashya ahari"
                : "No notifications"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {filtered.map((notification, i) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  if (!notification.read) markAsRead(notification.id);
                  if (
                    notification.message
                      .toLowerCase()
                      .includes("tickets page") ||
                    notification.message
                      .toLowerCase()
                      .includes("received and verified") ||
                    notification.type === "booking"
                  ) {
                    router.push("/tickets");
                  }
                }}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  notification.read
                    ? "bg-white border-slate-200 hover:border-slate-300"
                    : "bg-primary/5 border-primary/20 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      notification.read
                        ? "bg-slate-100"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[14px] font-bold text-slate-900 flex-1">
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-slate-600 mb-2.5 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {getTimeAgo(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="text-[11px] text-primary font-bold cursor-pointer hover:underline flex items-center gap-1"
                          >
                            <Check size={13} />{" "}
                            {language === "RW" ? "Soma" : "Mark read"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-[11px] text-slate-400 cursor-pointer hover:text-rose-600 transition-colors p-1"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
