"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type RealtimeCb = (payload: { eventType: string; new: any; old: any }) => void;

function useRealtimeTable(
  table: string,
  cb: RealtimeCb,
  opts?: { filter?: string; enabled?: boolean },
) {
  useEffect(() => {
    if (opts?.enabled === false) return;
    const ch = supabase
      .channel(`rt-${table}-${opts?.filter ?? "all"}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(opts?.filter ? { filter: opts.filter } : {}) },
        (payload: any) => cb({ eventType: payload.eventType, new: payload.new, old: payload.old }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [table, opts?.filter, opts?.enabled, cb]);
}

export function useRealtimeBookings(cb: RealtimeCb, opts?: { branchId?: string }) {
  useRealtimeTable("bookings", cb, opts?.branchId ? { filter: `branch_id=eq.${opts.branchId}` } : undefined);
}
export function useRealtimeTrips(cb: RealtimeCb, opts?: { originBranch?: string }) {
  useRealtimeTable("trips", cb, opts?.originBranch ? { filter: `origin_branch=eq.${opts.originBranch}` } : undefined);
}
export function useRealtimeBranches(cb: RealtimeCb, opts?: { agencyName?: string }) {
  useRealtimeTable("branches", cb, opts?.agencyName ? { filter: `agency_name=eq.${opts.agencyName}` } : undefined);
}
export function useRealtimeAgents(cb: RealtimeCb, opts?: { agencyName?: string }) {
  useRealtimeTable("agency_agents", cb, opts?.agencyName ? { filter: `agency_name=eq.${opts.agencyName}` } : undefined);
}
export function useRealtimeNotifications(userId: string | null, cb: RealtimeCb) {
  useRealtimeTable("notifications", cb, { enabled: !!userId, filter: userId ? `user_id=eq.${userId}` : undefined });
}
