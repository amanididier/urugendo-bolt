// src/lib/notificationsService.ts
//
// Batch 4: DB-backed notification utilities. Replaces the localStorage-only
// path in src/lib/notifications.ts. The legacy localStorage module is kept
// for backwards compatibility but new code should use this.
//
// Each helper inserts a row into public.notifications (created in migration
// 20260907120001_create_missing_tables.sql section 5). RLS is permissive for
// the demo phase; tighten when real auth roles exist.

import { supabase } from "./supabase";

export type NotificationType =
  | "verification"
  | "delay"
  | "reminder"
  | "promo"
  | "general"
  | "security"
  | "booking";

export interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  actionUrl?: string;
}

/**
 * Insert a single notification row. Returns the new id, or null on failure.
 * Silently logs errors — notifications are best-effort, not blocking.
 */
export async function notifyUser(input: NotificationInput): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || "general",
        action_url: input.actionUrl || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.warn("[notificationsService] insert failed:", error?.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.warn("[notificationsService] exception:", err);
    return null;
  }
}

/**
 * Fan-out helper: notify every passenger with a booking on a given trip.
 * Used when an agent marks a trip delayed — every booked passenger gets
 * a notification with the reason.
 *
 * Returns the count of notifications successfully inserted.
 */
export async function notifyPassengersOnTrip(
  tripId: string,
  template: { title: string; message: string; type?: NotificationType },
): Promise<number> {
  try {
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("user_id")
      .eq("trip_id", tripId)
      .not("user_id", "is", null);

    if (error || !bookings) {
      console.warn(
        "[notificationsService] could not fetch trip bookings:",
        error?.message,
      );
      return 0;
    }

    // Deduplicate user ids — group bookings under one user get one notification.
    const uniqueUserIds = Array.from(
      new Set(bookings.map((b) => b.user_id as string)),
    );
    if (uniqueUserIds.length === 0) return 0;

    const rows = uniqueUserIds.map((userId) => ({
      user_id: userId,
      title: template.title,
      message: template.message,
      type: template.type || "delay",
    }));

    const { error: insertErr } = await supabase
      .from("notifications")
      .insert(rows);

    if (insertErr) {
      console.warn(
        "[notificationsService] fan-out insert failed:",
        insertErr.message,
      );
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.warn("[notificationsService] fan-out exception:", err);
    return 0;
  }
}

/**
 * Subscribe to new notifications for a given user. Returns an unsubscribe
 * function. Used by the passenger notifications page to live-update.
 */
export function subscribeToUserNotifications(
  userId: string,
  onNew: (n: { id: string; title: string; message: string; type: string }) => void,
) {
  const channel = supabase
    .channel(`user-notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => {
        const row = payload.new;
        if (row) {
          onNew({
            id: row.id,
            title: row.title,
            message: row.message,
            type: row.type,
          });
        }
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch unread notification count for a user. Used for the bell icon badge.
 */
export async function fetchUnreadCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
