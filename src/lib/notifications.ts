"use client";

import { useState, useEffect } from "react";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type?: "verification" | "delay" | "reminder" | "promo" | "general" | "security" | "booking";
  actionUrl?: string;
}

const STORAGE_KEY = "urugendo_user_notifications";

// Default initial sample notification if storage is empty
const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    title: "Welcome to Urugendo! 🎉",
    message:
      "Explore our live bus schedules and book your trips seamlessly across Rwanda.",
    timestamp: new Date().toISOString(),
    read: false,
    type: "promo",
  },
];

export function getStoredNotifications(): AppNotification[] {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATIONS;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
      return DEFAULT_NOTIFICATIONS;
    }
    const parsed = JSON.parse(data);
    return parsed.map((n: any) => ({
      ...n,
      timestamp: n.timestamp || n.createdAt || new Date().toISOString(),
    }));
  } catch (e) {
    return DEFAULT_NOTIFICATIONS;
  }
}

export function saveNotifications(notifications: AppNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    // Dispatch a custom window event so all open tabs/components update instantly
    window.dispatchEvent(new Event("urugendo_notifications_updated"));
  } catch (e) {
    console.error("Failed to save notifications", e);
  }
}

export function addUserNotification(
  notification: Omit<AppNotification, "id" | "timestamp" | "read"> & { createdAt?: string },
) {
  const current = getStoredNotifications();
  const nowStr = new Date().toISOString();
  const newNotification: AppNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    timestamp: notification.createdAt || nowStr,
    read: false,
  };
  saveNotifications([newNotification, ...current]);

  // Trigger a browser notification popup if permission is granted
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification(newNotification.title, {
      body: newNotification.message,
      icon: "/icon.png",
    });
  }
}

export function markNotificationAsRead(id: string) {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
}

export function clearAllNotifications() {
  saveNotifications([]);
}

// React Hook for real-time notification states across components
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(getStoredNotifications());

    function handleUpdate() {
      setNotifications(getStoredNotifications());
    }

    window.addEventListener("urugendo_notifications_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(
        "urugendo_notifications_updated",
        handleUpdate,
      );
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification: addUserNotification,
    markAsRead: markNotificationAsRead,
    clearAll: clearAllNotifications,
  };
}