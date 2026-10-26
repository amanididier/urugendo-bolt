"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Stats = {
  totalPassengers: number;
  totalAgents: number;
  totalManagers: number;
  totalAgencies: number;
  totalBranches: number;
  totalTrips: number;
  totalBookings: number;
  totalVerifiedRevenue: number;
  totalPendingAgents: number;
};

export type FounderData = {
  stats: Stats | null;
  prevStats: Stats | null;
  agencies: { id: string; name: string; branches?: string[] }[];
  managers: { id: string; name: string; email: string; agency_name: string; manager_code: string }[];
  popularTrips: { route: string; count: number; price?: number }[];
  agencyRevenue: { agency: string; revenue: number; passengers: number }[];
  loading: boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<FounderData | null>(null);

export function useFounderData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFounderData must be inside FounderDataProvider");
  return v;
}

export function FounderDataProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [prevStats, setPrevStats] = useState<Stats | null>(null);
  const [agencies, setAgencies] = useState<FounderData["agencies"]>([]);
  const [managers, setManagers] = useState<FounderData["managers"]>([]);
  const [popularTrips, setPopularTrips] = useState<FounderData["popularTrips"]>([]);
  const [agencyRevenue, setAgencyRevenue] = useState<FounderData["agencyRevenue"]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, mgrs, branches, trips, bookings, agents, profiles] = await Promise.all([
        supabase.from("operators").select("id,name,branches").order("name"),
        supabase.from("agency_managers").select("id,name,email,agency_name,manager_code").order("agency_name"),
        supabase.from("branches").select("id,agency_name,momo_code"),
        supabase.from("trips").select("id,price,route_from,route_to,operator_id"),
        supabase.from("bookings").select("id,branch_id,trip_id,payment_status,status,fare_amount,created_at,trip:trips(operator_id,price)"),
        supabase.from("agency_agents").select("id,is_approved"),
        supabase.from("profiles").select("id,role"),
      ]);

      const agenciesList = (ops.data || []) as any[];
      setAgencies(agenciesList);
      setManagers(((mgrs.data as any[]) || []).slice(0, 50));

      const totalAgencies = agenciesList.length;
      const totalBranches = (branches.data || []).length;
      const totalTrips = (trips.data || []).length;
      const totalBookings = (bookings.data || []).length;
      const pendingAgents = ((agents.data as any[]) || []).filter((a) => !a.is_approved).length;
      const totalAgents = ((agents.data as any[]) || []).length;
      const passengerProfiles = ((profiles.data as any[]) || []).filter((p) => p.role === "passenger").length;
      let verifiedRevenue = 0;
      for (const b of (bookings.data as any[]) || []) {
        const isVerified = b.payment_status === "verified" || b.status === "confirmed";
        if (isVerified) verifiedRevenue += Number(b.fare_amount ?? (b as any).trip?.price ?? 0);
      }

      setPrevStats((prev) => {
        try {
          const raw = localStorage.getItem("urugendo_founder_prev_stats");
          if (raw && !prev) return JSON.parse(raw) as Stats;
        } catch {}
        return prev;
      });
      const nextStats: Stats = {
        totalPassengers: passengerProfiles,
        totalAgents,
        totalManagers: (mgrs.data || []).length,
        totalAgencies,
        totalBranches,
        totalTrips,
        totalBookings,
        totalVerifiedRevenue: verifiedRevenue,
        totalPendingAgents: pendingAgents,
      };
      try {
        localStorage.setItem("urugendo_founder_prev_stats", JSON.stringify(nextStats));
      } catch {}
      setStats(nextStats);

      const tripCounts: Record<string, { count: number; price: number; route: string }> = {};
      for (const b of (bookings.data as any[]) || []) {
        const tid = (b as any).trip_id;
        if (!tid) continue;
        const tripRow = (trips.data as any[])?.find((t) => t.id === tid);
        const route = tripRow ? `${tripRow.route_from} → ${tripRow.route_to}` : "Unknown route";
        const entry = tripCounts[route] || { count: 0, price: Number(tripRow?.price ?? 0), route };
        entry.count += 1;
        tripCounts[route] = entry;
      }
      setPopularTrips(Object.values(tripCounts).sort((a, b) => b.count - a.count).slice(0, 5));

      const branchAgency: Record<string, string> = {};
      for (const br of (branches.data as any[]) || []) branchAgency[br.id] = br.agency_name || "—";
      const opIdToName: Record<string, string> = {};
      for (const op of agenciesList) opIdToName[op.id] = op.name;
      const byAgency: Record<string, { revenue: number; passengers: number }> = {};
      for (const b of (bookings.data as any[]) || []) {
        const isVerified = (b as any).payment_status === "verified" || (b as any).status === "confirmed";
        if (!isVerified) continue;
        const fare = Number((b as any).fare_amount ?? (b as any).trip?.price ?? 0);
        let agency: string | null = (b as any).branch_id ? branchAgency[(b as any).branch_id] : null;
        if (!agency || agency === "—") {
          const tripRow = (trips.data as any[])?.find((t) => t.id === (b as any).trip_id);
          agency = tripRow?.operator_id ? opIdToName[tripRow.operator_id] || "—" : "—";
        }
        const e = byAgency[agency] || { revenue: 0, passengers: 0 };
        e.revenue += fare;
        e.passengers += 1;
        byAgency[agency] = e;
      }
      setAgencyRevenue(Object.entries(byAgency).map(([agency, v]) => ({ agency, ...v })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return <Ctx.Provider value={{ stats, prevStats, agencies, managers, popularTrips, agencyRevenue, loading, reload: loadAll }}>{children}</Ctx.Provider>;
}
