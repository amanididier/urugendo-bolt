"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Clock,
  Ticket,
  MapPin,
  TrendingUp,
  DollarSign,
  Search,
  CheckCircle,
  Save,
  Phone,
  User,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  CheckCircle2,
  Armchair,
  Users,
  ShieldCheck,
  Bell,
  ChevronRight,
  Bus,
} from "lucide-react";
import {
  fetchTripsByDate,
  fetchBookingsByBranch,
  fetchBookingById,
  updateBookingStatus,
  updateTripStatus,
} from "@/lib/api";
import { fetchBranchRevenue } from "@/lib/branchService";
import { notifyPassengersOnTrip, notifyUser } from "@/lib/notificationsService";
import {
  markPaymentVerified,
  markPaymentRejected,
} from "@/lib/paymentProvider";
import { supabase } from "@/lib/supabase";
import type { Trip, Booking, AgencyBranch } from "@/lib/types";

export interface ExtendedBooking extends Omit<Partial<Booking>, "status"> {
  id: string;
  passengerName?: string;
  passengerPhone?: string;
  seatNumber?: string;
  totalAmount?: number;
  status?: string;
  payment_status?: string;
  userId?: string;
  trip?: any;
  momoName?: string;
  momoNumber?: string;
  shortCode?: string;
  createdAt?: string;
}

interface PendingMoMoPayment {
  id: string;
  momoName: string;
  momoNumber: string;
  passengerName: string;
  tripRoute: string;
  date: string;
  amount: number;
  status: "pending" | "confirmed";
  shortCode: string;
}

interface ManifestTrip {
  id: string;
  busPlate: string;
  driverName: string;
  from: string;
  to: string;
  time: string;
  capacity: number;
  urugendoPassengers: number;
  status: string;
}

const getBranchName = (branch: AgencyBranch | string): string =>
  typeof branch === "string" ? branch : branch?.name || "Musanze";

const cleanStationName = (name: string) =>
  name
    .toLowerCase()
    .replace(/branch|station/g, "")
    .trim();


export default function AgencyDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<ExtendedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"today" | "verify" | "manifest">(
    "today",
  );
  const [manifestSubTab, setManifestSubTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );

  const [searchSeat, setSearchSeat] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    booking?: ExtendedBooking;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [agentBranch, setAgentBranch] = useState("Musanze");
  // Batch 2: branch_id (FK) of the logged-in agent's branch.
  // Used for branch-isolated queries (bookings, trips, revenue).
  const [agentBranchId, setAgentBranchId] = useState<string | null>(null);
  const [, setOperatorId] = useState("");
  // Batch 2: real revenue loaded from the bookings table for the "today" stat card.
  const [todayRevenueData, setTodayRevenueData] = useState<{
    passengers: number;
    revenue: number;
  }>({ passengers: 0, revenue: 0 });

  const [emptySeats, setEmptySeats] = useState<Record<string, number>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Added states for real-time agent verification status checks & Apple-designed pending modals
  const [agentStatus, setAgentStatus] = useState<string>("approved");
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [agencyLabel, setAgencyLabel] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    let ch: any = null;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id;
      if (!uid) {
        if (mounted) setUnreadCount(0);
        return;
      }
      try {
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("read", false);
        if (mounted && typeof count === "number") setUnreadCount(count);
        // live badge — no refresh needed
        ch = supabase
          .channel(`agent-notif-bell-${uid}`)
          .on(
            "postgres_changes" as any,
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${uid}`,
            },
            async () => {
              const { count: c } = await supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .eq("user_id", uid)
                .eq("read", false);
              if (mounted && typeof c === "number") setUnreadCount(c);
            },
          )
          .subscribe();
      } catch {}
    });
    return () => {
      mounted = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, []);

  // Dynamic agency header — resolve from agent's actual agency/branch
  useEffect(() => {
    const email =
      localStorage.getItem("urugendo_agent_email") ||
      localStorage.getItem("urugendo_user_email");
    if (!email) return;
    supabase
      .from("agency_agents")
      .select("agency_name, branch_name, branch_id")
      .eq("email", email)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data?.agency_name) {
          setAgencyLabel(data.agency_name);
          return;
        }
        // fallback: branches table if agency_name not set
        if ((data as any)?.branch_id) {
          const { data: br } = await supabase
            .from("branches")
            .select("agency_name")
            .eq("id", (data as any).branch_id)
            .maybeSingle();
          if ((br as any)?.agency_name) setAgencyLabel((br as any).agency_name);
        }
      });
  }, []);

  // Added Supabase Real-Time Agent Approval Listener & Session Guard
  useEffect(() => {
    let channel: any = null;

    async function checkAgentApprovalStatus() {
      try {
        const storedAgentEmail =
          localStorage.getItem("urugendo_agent_email") ||
          localStorage.getItem("urugendo_user_email");
        if (!storedAgentEmail) return;

        const { data, error } = await supabase
          .from("agency_agents")
          .select("status, branch_name, id, branch_id")
          .eq("email", storedAgentEmail)
          .maybeSingle();

        if (!error && data) {
          setAgentStatus(data.status);
          // Batch 2: store the branch FK for scoped queries.
          if (data.branch_id) {
            setAgentBranchId(data.branch_id);
            setAgentBranch(
              data.branch_name ||
                localStorage.getItem("urugendo_branch") ||
                "Musanze",
            );
          }
          if (data.status === "pending") {
            setShowApprovalModal(true);
          } else {
            setShowApprovalModal(false);
          }
        }

        // Setup real-time subscription for instant manager approval feedback
        channel = supabase
          .channel(`agent-status-${storedAgentEmail}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "agency_agents",
              filter: `email=eq.${storedAgentEmail}`,
            },
            (payload: any) => {
              const updated = payload.new;
              if (updated && updated.status) {
                setAgentStatus(updated.status);
                if (updated.status === "approved") {
                  setShowApprovalModal(false);
                } else if (updated.status === "pending") {
                  setShowApprovalModal(true);
                }
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.error("Error checking agent status:", err);
      }
    }

    checkAgentApprovalStatus();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Batch 4: every 5 minutes while the agent has pending MoMo bookings in
  // their branch, send a reminder notification. The interval is set up once
  // on mount and torn down on unmount; no per-tick re-query to Supabase.
  const bookingsRef = useRef(bookings);
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);

  useEffect(() => {
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const interval = setInterval(async () => {
      const currentBookings = bookingsRef.current || [];
      const pending = currentBookings.filter(
        (b) => b.status === "pending" || b.status === "payment_submitted",
      );
      if (pending.length === 0) return;
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      await notifyUser({
        userId: authData.user.id,
        title: "Pending MoMo Reminder",
        message: `You have ${pending.length} unverified MoMo payment${pending.length === 1 ? "" : "s"} at ${agentBranch}. Tap to review.`,
        type: "reminder",
        actionUrl: "/agency?tab=verify",
      });
    }, FIVE_MIN_MS);
    return () => clearInterval(interval);
  }, [agentBranch]);
  useEffect(() => {
    let isMounted = true;

    const branch = localStorage.getItem("urugendo_branch") || "Musanze";
    const opId = localStorage.getItem("urugendo_operator_id") || "";
    setAgentBranch(branch);
    setOperatorId(opId);

    const savedEmptySeats = localStorage.getItem("urugendo_empty_seats");
    if (savedEmptySeats) {
      try {
        setEmptySeats(JSON.parse(savedEmptySeats));
      } catch {
        // ignore
      }
    }

    async function loadDashboardData() {
      setLoading(true);
      try {
        const storedAgentEmail =
          localStorage.getItem("urugendo_agent_email") ||
          localStorage.getItem("urugendo_user_email");
        let resolvedBranchId: string | null = null;
        if (storedAgentEmail) {
          const { data: agentRow } = await supabase
            .from("agency_agents")
            .select("branch_id")
            .eq("email", storedAgentEmail)
            .maybeSingle();
          resolvedBranchId = (agentRow as any)?.branch_id ?? null;
        }

        const todayStr = new Date().toISOString().split("T")[0];
        const [todayTrips, branchRevenue, branchBookingsRaw] =
          await Promise.all([
            fetchTripsByDate(todayStr, resolvedBranchId || undefined),
            resolvedBranchId
              ? fetchBranchRevenue(resolvedBranchId, "today")
              : Promise.resolve({ passengers: 0, revenue: 0 }),
            resolvedBranchId
              ? fetchBookingsByBranch(resolvedBranchId)
              : Promise.resolve([] as any),
          ]);

        if (!isMounted) return;
        setAgentBranchId(resolvedBranchId);
        const branchTrips = (todayTrips || []).filter((t: any) => t.origin_branch_id === resolvedBranchId || t.branch_id === resolvedBranchId);
        setTrips(branchTrips);
        setBookings((branchBookingsRaw as ExtendedBooking[]) || []);
        setTodayRevenueData(branchRevenue as any);
      } catch (error) {
        console.error("Failed to fetch agency dashboard data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live realtime: bookings + trips for this branch (no refresh needed)
  useEffect(() => {
    if (!agentBranchId) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase: sb } = require("@/lib/supabase") as {
      supabase: typeof supabase;
    };
    const chBookings = sb
      .channel(`agency-bookings-${agentBranchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `branch_id=eq.${agentBranchId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          // ---> ADD THIS NATIVE NOTIFICATION TRIGGER <---
          if (
            payload.eventType === "INSERT" &&
            (row.status === "pending" || row.status === "payment_submitted")
          ) {
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("New Payment Submitted! 📱", {
                body: `A new booking requires verification. Tap to review.`,
                icon: "/icon-192.png",
              });
            }
          }
          // ----------------------------------------------
          // Map row -> ExtendedBooking shape (light), merge into list
          const mapped: any = {
            id: row.id,
            status: row.status,
            payment_status: row.payment_status ?? row.paymentStatus,
            passengerName: row.passenger_name,
            passengerPhone: row.passenger_phone,
            momoName: row.momo_name,
            momoNumber: row.momo_number,
            shortCode: row.booking_code || row.short_code,
            seat: row.seat_label || row.seat_id,
            totalAmount: row.fare_amount ?? row.total_amount,
            createdAt: row.created_at,
            trip: row.trip_id ? { id: row.trip_id } : undefined,
            branchId: row.branch_id,
          };
          setBookings((prev) => {
            if (payload.eventType === "INSERT") return [mapped, ...prev];
            if (payload.eventType === "UPDATE")
              return prev.map((b) =>
                b.id === row.id ? { ...b, ...mapped } : b,
              );
            if (payload.eventType === "DELETE")
              return prev.filter((b) => b.id !== (payload.old?.id ?? row.id));
            return prev;
          });
        },
      )
      .subscribe();
    const chTrips = sb
      .channel(`agency-trips-${agentBranchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        (payload: any) => {
          const row = payload.new;
          const oldRow = payload.old;
          // Only care about trips for this agent's branch
          const matches = row
            ? row.origin_branch_id === agentBranchId ||
              row.branch_id === agentBranchId
            : false;
          const oldMatches = oldRow
            ? oldRow.origin_branch_id === agentBranchId ||
              oldRow.branch_id === agentBranchId
            : false;
          if (payload.eventType === "INSERT" && matches) {
            // Trigger a light reload of trips (keeps operator join correct) — cheap, no bookings reload
            fetchTripsByDate(new Date().toISOString().split("T")[0], agentBranchId).then(
              (all) => {
                setTrips((prev) => {
                  const filtered = all.filter(
                    (t: any) =>
                      t.origin_branch_id === agentBranchId ||
                      t.branch_id === agentBranchId,
                  );
                  // merge by id to avoid duplicates
                  const byId = new Map(prev.map((t) => [t.id, t]));
                  for (const t of filtered) byId.set(t.id, t);
                  return Array.from(byId.values());
                });
              },
            );
            return;
          }
          if (payload.eventType === "UPDATE" && (matches || oldMatches)) {
            setTrips((prev) =>
              prev.map((t) =>
                t.id === row.id
                  ? {
                      ...t,
                      status: row.status,
                      departureTime: row.departure_time ?? t.departureTime,
                      arrivalTime: row.arrival_time ?? t.arrivalTime,
                    }
                  : t,
              ),
            );
          }
          if (payload.eventType === "DELETE" && oldMatches) {
            setTrips((prev) => prev.filter((t) => t.id !== oldRow.id));
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(chBookings);
      sb.removeChannel(chTrips);
    };
  }, [agentBranchId, agentBranch]);

  const currentStationKey = cleanStationName(agentBranch);

  const verifiedBookings = bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      (b as any).payment_status === "verified" ||
      b.status === "boarded",
  );
  const isTripDeparted = (trip: Trip) => {
    try {
      const d = (trip as any).date || new Date().toISOString().split("T")[0];
      const tm = trip.departureTime || "08:00";
      const dt = new Date(`${d}T${tm}`);
      return !isNaN(dt.getTime()) && Date.now() >= dt.getTime();
    } catch {
      return false;
    }
  };
  const displayTripStatus = (trip: Trip) => {
    if (trip.status === "delayed") return "delayed";
    if (trip.status === "cancelled") return "cancelled";
    if (trip.status === "departed" || trip.status === "arrived")
      return trip.status;
    return isTripDeparted(trip) ? "departed" : "pending";
  };

  // Threshold-based batching: notify agent at 5 pending, or at 5min if 1-4 still pending (no spam per-tx)
  const batchNotifRef = useRef<{
    lastCount: number;
    timer: ReturnType<typeof setTimeout> | null;
    lastBatchAt: number;
  }>({ lastCount: 0, timer: null, lastBatchAt: 0 });

  useEffect(() => {
    const pending = bookings.filter(
      (b) =>
        b.status === "pending" ||
        b.status === "payment_submitted" ||
        (b as any).payment_status === "submitted",
    ).length;

    const ref = batchNotifRef.current;

    // Trigger immediate batch alert if we cross into 5+ pending from a lower number
    if (pending >= 5 && ref.lastCount < 5) {
      ref.lastCount = 5; // Lock it to 5 so it cleanly resets only when it drops below 5
      ref.lastBatchAt = Date.now();
      if (ref.timer) {
        clearTimeout(ref.timer);
        ref.timer = null;
      }
      supabase.auth.getUser().then(async ({ data }) => {
        const uid = data?.user?.id;
        if (!uid) return;
        const { supabase: sb } = await import("@/lib/supabase");
        await sb.from("notifications").insert({
          user_id: uid,
          title: "MoMo queue — 5 pending",
          message: `You have ${pending} unconfirmed MoMo payments awaiting verification.`,
          type: "reminder",
        } as any);
      });
      return;
    }

    // Handle 1 to 4 pending items with a 5-minute debounce timer
    if (pending > 0 && pending < 5) {
      ref.lastCount = pending;
      if (ref.timer) clearTimeout(ref.timer);

      ref.timer = setTimeout(
        () => {
          if (Date.now() - ref.lastBatchAt < 4 * 60 * 1000) return;
          ref.lastBatchAt = Date.now();
          supabase.auth.getUser().then(async ({ data }) => {
            const uid = data?.user?.id;
            if (!uid) return;
            const { supabase: sb } = await import("@/lib/supabase");
            await sb.from("notifications").insert({
              user_id: uid,
              title: "Pending MoMo reminder",
              message: `You have ${pending} pending payment(s) waiting ≥5 min — please verify.`,
              type: "reminder",
            } as any);
          });
        },
        5 * 60 * 1000,
      );

      return () => {
        if (ref.timer) {
          clearTimeout(ref.timer);
          ref.timer = null;
        }
      };
    }

    // Reset completely if there are no pending bookings
    if (pending === 0) {
      if (ref.timer) {
        clearTimeout(ref.timer);
        ref.timer = null;
      }
      ref.lastCount = 0;
    }
  }, [bookings]);
  const stationIncoming: ManifestTrip[] = trips
    .filter((t) => cleanStationName(t.to || "").includes(currentStationKey))
    .map((t, idx) => ({
      id: `inc-${t.id || idx}`,
      busPlate: t.plateNumber || "RAC 112D",
      driverName: t.driverName || "Station Driver",
      from: t.from,
      to: getBranchName(agentBranch),
      time: t.arrivalTime || t.departureTime,
      capacity: t.totalSeats || 29,
      urugendoPassengers: verifiedBookings.filter(
        (b) =>
          (typeof b.trip === "object" ? b.trip?.id : b.trip) === t.id &&
          b.status !== "cancelled" &&
          b.status !== "rejected",
      ).length,
      status: t.status || "In Transit",
    }));
  const stationOutgoing: ManifestTrip[] = trips
    .filter((t) => cleanStationName(t.from || "").includes(currentStationKey))
    .map((t, idx) => ({
      id: `out-${t.id || idx}`,
      busPlate: t.plateNumber || "RAD 882D",
      driverName: t.driverName || "Station Driver",
      from: getBranchName(agentBranch),
      to: t.to,
      time: t.departureTime,
      capacity: t.totalSeats || 29,
      urugendoPassengers: verifiedBookings.filter(
        (b) =>
          (typeof b.trip === "object" ? b.trip?.id : b.trip) === t.id &&
          b.status !== "cancelled" &&
          b.status !== "rejected",
      ).length,
      status: displayTripStatus(t),
    }));

  const handleSaveEmptySeats = (tripId: string) => {
    localStorage.setItem("urugendo_empty_seats", JSON.stringify(emptySeats));
    setSavedFeedback(tripId);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const exportStyledExcelReport = () => {
    const branchName = getBranchName(agentBranch);
    const isIncoming = manifestSubTab === "incoming";
    const activeList = isIncoming ? stationIncoming : stationOutgoing;

    const tableHeaders = isIncoming
      ? [
          "State",
          "Bus Plate",
          "Driver Name",
          "From",
          "Destination",
          "ETA",
          "Capacity",
          "Urugendo App Pass",
          "Paper Tickets",
          "Status",
        ]
      : [
          "State",
          "Bus Plate",
          "Driver Name",
          "From",
          "To",
          "Departure Time",
          "Capacity",
          "Urugendo App Pass",
          "Empty Seats",
          "Paper Tickets",
          "Total Onboard",
          "Status",
        ];

    const tableRows = isIncoming
      ? activeList
          .map((trip, idx) => {
            const paperTickets = Math.max(
              0,
              trip.capacity - trip.urugendoPassengers,
            );
            const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            return `
            <Row ss:Height="22" style="background-color: ${bg}; font-size: 11px;">
              <Cell style="background-color: #ECFDF5; color: #059669; font-weight: bold; text-align: center;"><Data ss:Type="String">INCOMING</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.busPlate}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.driverName}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.from}</Data></Cell>
              <Cell><Data ss:Type="String">${branchName}</Data></Cell>
              <Cell style="font-weight: bold; color: #00B14F;"><Data ss:Type="String">${trip.time}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${trip.capacity}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold; color: #00B14F;"><Data ss:Type="Number">${trip.urugendoPassengers}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${paperTickets}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="String">${trip.status}</Data></Cell>
            </Row>`;
          })
          .join("")
      : activeList
          .map((trip, idx) => {
            const empty = emptySeats[trip.id] ?? 0;
            const paperTickets = Math.max(
              0,
              trip.capacity - trip.urugendoPassengers - empty,
            );
            const totalOnboard = trip.urugendoPassengers + paperTickets;
            const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            const stateLabel =
              (trip as any).status === "pending" ? "PENDING" : "DEPARTED";
            const stateBg =
              (trip as any).status === "pending" ? "#ECFDF5" : "#FEF2F2";
            const stateFg =
              (trip as any).status === "pending" ? "#059669" : "#DC2626";
            return `
            <Row ss:Height="22" style="background-color: ${bg}; font-size: 11px;">
              <Cell style="background-color: ${stateBg}; color: ${stateFg}; font-weight: bold; text-align: center;"><Data ss:Type="String">${stateLabel}</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.busPlate}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.driverName}</Data></Cell>
              <Cell><Data ss:Type="String">${branchName}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.to}</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.time}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${trip.capacity}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold; color: #00B14F;"><Data ss:Type="Number">${trip.urugendoPassengers}</Data></Cell>
              <Cell style="text-align: center; color: #D97706; font-weight: bold;"><Data ss:Type="Number">${empty}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${paperTickets}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold;"><Data ss:Type="String">${totalOnboard}/${trip.capacity}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="String">${trip.status}</Data></Cell>
            </Row>`;
          })
          .join("");

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:html="http://www.w3.org/TR/REC-html40">
        <Styles>
          <Style ss:ID="Header">
            <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
            <Interior ss:Color="#00B14F" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
          </Style>
        </Styles>
        <Worksheet ss:Name="Manifest Report">
          <Table ss:ExpandedColumnCount="${tableHeaders.length}" ss:FullColumns="1" ss:FullRows="1" ss:DefaultColumnWidth="110" ss:DefaultRowHeight="20">
            <Row ss:Height="26">
              <Cell ss:StyleID="Header" ss:MergeAcross="${tableHeaders.length - 1}">
                <Data ss:Type="String">WEKA EXPRESS — STATION MANIFEST (${manifestSubTab.toUpperCase()})</Data>
              </Cell>
            </Row>
            <Row ss:Height="18">
              <Cell><Data ss:Type="String">Branch: ${branchName} | Generated: ${new Date().toLocaleString()}</Data></Cell>
            </Row>
            <Row ss:Height="24">
              ${tableHeaders
                .map(
                  (header) =>
                    `<Cell ss:StyleID="Header"><Data ss:Type="String">${header}</Data></Cell>`,
                )
                .join("")}
            </Row>
            ${tableRows}
          </Table>
        </Worksheet>
      </Workbook>`;

    const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `manifest-${manifestSubTab}-${branchName.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingMoMoPayments: PendingMoMoPayment[] = bookings
    .filter((b) => {
      const isPendingStatus =
        b.status === "pending" ||
        b.status === "payment_submitted" ||
        (b as any).payment_status === "submitted";
      const isNotYetVerified = (b as any).payment_status !== "verified";
      return isPendingStatus && isNotYetVerified;
    })
    .map((b) => {
      const tripObj = b.trip && typeof b.trip === "object" ? b.trip : null;
      const createdDate = b.createdAt ? new Date(b.createdAt) : new Date();

      return {
        id: b.id,
        momoName: b.momoName || b.momoAccountName || "MTN Subscriber",
        momoNumber:
          b.momoNumber || b.momoPhoneNumber || b.passengerPhone || "0780000000",
        passengerName: b.passengerName || "Passenger",
        tripRoute: tripObj
          ? `${tripObj.from} → ${tripObj.to}`
          : `${agentBranch} Route`,
        date: createdDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        amount: b.totalAmount || 2500,
        status: "pending",
        shortCode: b.shortCode || b.id.substring(0, 6).toUpperCase(),
      };
    });
  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  // Batch 2: revenue comes from the bookings table via fetchBranchRevenue.
  // todayRevenueData is loaded in loadDashboardData — falls back to 0 when
  // the query returns no rows (real zero, not a placeholder).
  const stats = {
    todayBookings: todayRevenueData.passengers,
    todayRevenue: todayRevenueData.revenue,
    totalBuses: new Set(trips.map((t) => t.plateNumber || t.id).filter(Boolean))
      .size,
    activeRoutes: new Set(
      trips.map(
        (t) =>
          `${cleanStationName(t.from || "")}-${cleanStationName(t.to || "")}`,
      ),
    ).size,
  };

  const [verifySuggestions, setVerifySuggestions] = useState<ExtendedBooking[]>([]);
  const [verifyFocused, setVerifyFocused] = useState(false);
  const verifyWrapRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (verifyWrapRef.current && !verifyWrapRef.current.contains(e.target as Node)) {
        setVerifyFocused(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const q = searchSeat.trim().toLowerCase();
    if (!q) { setVerifySuggestions([]); return; }
    const hits = bookings.filter((b) => {
      const hay = [b.momoName, b.momoNumber, b.momoAccountName as any, b.momoPhoneNumber as any, b.passengerName, b.passengerPhone, b.shortCode, (b as any).seat, b.seatNumber].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);
    setVerifySuggestions(hits);
  }, [searchSeat, bookings]);

  const handleVerifySearch = async (override?: string) => {
    const raw = (override ?? searchSeat).trim();
    if (!raw) {
      setVerifyResult(null);
      return;
    }
    setVerifying(true);
    const query = raw.toUpperCase().trim();

    let found = bookings.find((b) => {
      const seatMatch =
        b.seatNumber?.toUpperCase() === query ||
        (b.seat && String(b.seat).toUpperCase() === query);
      const codeMatch =
        b.shortCode?.toUpperCase() === query ||
        b.id?.toUpperCase().includes(query);
      const nameMatch = b.passengerName?.toUpperCase().includes(query);
      const momoNameMatch = (b.momoName || (b as any).momoAccountName || "").toUpperCase().includes(query);
      const momoNumMatch = (b.momoNumber || (b as any).momoPhoneNumber || "").includes(query);
      return seatMatch || codeMatch || nameMatch || momoNameMatch || momoNumMatch;
    });

    if (!found) {
      const remoteBooking = await fetchBookingById(query);
      if (remoteBooking) {
        found = {
          ...remoteBooking,
          seatNumber: remoteBooking.seat,
        };
      }
    }

    setVerifyResult({ found: !!found, booking: found });
    setVerifying(false);
    setVerifyFocused(false);
  };

  const handleConfirmMoMoPayment = async (bookingId: string) => {
    setVerifying(true);
    // Batch 4: use the dedicated helper that writes both payment_status='verified'
    // AND status='confirmed' in one DB round-trip. The passenger sees the
    // "Confirmed ✓" badge and payment_status='verified' so the verification
    // queue clears.
    const success = await markPaymentVerified(bookingId);
    if (success) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "confirmed", payment_status: "verified" as any }
            : b,
        ),
      );
      const confirmedBooking2 = bookings.find((b) => b.id === bookingId);
      if (confirmedBooking2?.userId) {
        const route2 = confirmedBooking2?.trip
          ? `${(confirmedBooking2.trip as any)?.from || ""} → ${(confirmedBooking2.trip as any)?.to || ""}`
          : "";
        await notifyUser({
          userId: confirmedBooking2.userId,
          title: "✅ Ticket Confirmed!",
          message: `Your MoMo payment for ${route2} has been verified. Your ticket is ready!`,
          type: "verification",
          actionUrl: `/ticket/${bookingId}`,
        });
      }
    }
    setVerifying(false);
  };

  const handleMarkAsBoardedUsed = async (bookingId: string) => {
    setVerifying(true);
    const success = await updateBookingStatus(bookingId, "boarded" as any);
    if (success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "boarded" } : b)),
      );
      if (verifyResult?.booking?.id === bookingId) {
        setVerifyResult((prev) =>
          prev
            ? {
                ...prev,
                booking: prev.booking
                  ? { ...prev.booking, status: "boarded" }
                  : undefined,
              }
            : null,
        );
      }
      const boardedBooking = bookings.find((b) => b.id === bookingId);
      if (boardedBooking?.userId) {
        await notifyUser({
          userId: boardedBooking.userId,
          title: "✅ Ticket Verified — Boarded",
          message: `Your ticket ${boardedBooking.shortCode || bookingId.slice(0,6)} has been verified and marked as boarded. Have a safe trip!`,
          type: "verification",
          actionUrl: `/ticket/${bookingId}`,
        });
      }
    }
    setVerifying(false);
  };

  const handleMarkDelayed = async (tripId: string) => {
    const success = await updateTripStatus(tripId, "delayed" as any);
    if (success) {
      const targetTrip = trips.find((t) => t.id === tripId);
      const destination = targetTrip?.to || "Rubavu";
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId ? { ...t, status: "delayed" as Trip["status"] } : t,
        ),
      );
      // Batch 4: write real DB-backed delay notifications to every passenger
      // booked on this trip, plus a confirmation to the agent themselves.
      const sent = await notifyPassengersOnTrip(tripId, {
        title: "⚠️ Trip Alert",
        message: `Your trip to ${destination} has been delayed for 15 minutes due to heavy rainfall on the road. We appreciate your patience!`,
        type: "delay",
      });
      // Confirmation to the agent: "your delay alert went out to N passengers".
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        await notifyUser({
          userId: authData.user.id,
          title: "Delay Alert Sent",
          message: `Delay notification sent to ${sent} passenger${sent === 1 ? "" : "s"} booked on the ${destination} trip.`,
          type: "general",
        });
      }
      // Local toast is NOT used — DB notification is real and shown on agency-notifications page
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "boarding":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "departed":
        return "bg-red-50 text-red-700 border-red-200";
      case "arrived":
        return "bg-green-100 text-green-700";
      case "delayed":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-secondary pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">
          Loading station dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-[88px] min-h-screen font-sans relative">
      {/* Apple-designed Glassmorphism Pending Status Guard Modal */}
      <AnimatePresence>
        {agentStatus === "pending" && showApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Clock size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Approval Pending
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your account has been submitted to the agency management. Wait
                  for approval. You may exit the app; we&apos;ll notify you when
                  you&apos;re approved.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => router.push("/")}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Exit to Home
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px] print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              🚌
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold text-white">
                Agency Dashboard
              </h1>
              <p className="text-[12px] text-white/80 font-medium">
                {agencyLabel || "Weka Express"} • {agentBranch}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/agency/agency-notifications")}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center relative ring-1 ring-white/20 active:scale-90 transition-transform cursor-pointer"
            aria-label="Agency Notifications"
          >
            <Bell size={20} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-primary">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.todayBookings}
            </div>
            <div className="text-[8px] text-white/70">Today</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {(stats.todayRevenue / 1000).toFixed(0)}K
            </div>
            <div className="text-[8px] text-white/70">Revenue</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.totalBuses}
            </div>
            <div className="text-[8px] text-white/70">Buses</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.activeRoutes}
            </div>
            <div className="text-[8px] text-white/70">Routes</div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 print:hidden">
        <div className="bg-white rounded-xl p-1 border border-border flex shadow-sm">
          {(["today", "verify", "manifest"] as const).map((tab) => {
            const verifyCount =
              tab === "verify" ? pendingMoMoPayments.length : 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer relative ${
                  activeTab === tab
                    ? "bg-primary text-white"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tab === "today"
                  ? "Today"
                  : tab === "verify"
                    ? "Verify"
                    : "Manifest"}
                {tab === "verify" && verifyCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm leading-none">
                    {verifyCount > 99 ? "99+" : verifyCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "today" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-gradient-to-r from-emerald-600 to-primary rounded-2xl p-4 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-white/80 font-medium">
                Today&apos;s Revenue ({agentBranch})
              </span>
              <DollarSign size={18} className="text-white/80" />
            </div>
            <div className="text-[28px] font-extrabold">
              {stats.todayRevenue.toLocaleString()} RWF
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-white/90">
              <TrendingUp size={14} />
              <span>{stats.todayBookings} station bookings today</span>
            </div>
          </div>

          {/* Batch 2: read-only "Incoming Buses" card. Shows trips that
              terminate at this agent's branch but were scheduled by another
              branch. The agent cannot verify, board, or modify tickets for
              these trips — view only. */}
          {stationIncoming.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Bus size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-text-primary">
                      Incoming Buses
                    </div>
                    <div className="text-[10px] text-text-muted">
                      Read-only · from other branches
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {stationIncoming.length}
                </span>
              </div>
              <div className="space-y-2">
                {stationIncoming.slice(0, 3).map((trip) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">
                        {trip.from} → {trip.to}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {trip.busPlate} · {trip.time || "—"}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      View only
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-medium text-text-muted">
                  Weka Online
                </span>
              </div>
              <div className="text-[20px] font-bold text-primary">
                {stats.todayBookings}
              </div>
              <div className="text-[9px] text-text-muted">Digital tickets</div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Ticket size={14} className="text-amber-600" />
                </div>
                <span className="text-[10px] font-medium text-text-muted">
                  Paper Tickets
                </span>
              </div>
              <div className="text-[20px] font-bold text-amber-600">
                Counter
              </div>
              <div className="text-[9px] text-text-muted">Manual bookings</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/agency/schedule")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Add Schedule
              </span>
            </button>
            <button
              onClick={() => setActiveTab("verify")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Search size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Verify Ticket
              </span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "verify" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-primary" size={20} />
              <h3 className="text-[14px] font-bold text-text-primary">
                Ticket Verification ({agentBranch})
              </h3>
            </div>

            <div className="flex gap-2" ref={verifyWrapRef}>
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchSeat}
                  onChange={(e) => setSearchSeat(e.target.value)}
                  onFocus={() => setVerifyFocused(true)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySearch()}
                  placeholder="MoMo name, MoMo number, ticket code or name"
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {verifyFocused && verifySuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1.5 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {verifySuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSearchSeat(s.momoName || s.passengerName || s.shortCode || "");
                          handleVerifySearch(s.momoName || s.momoNumber || s.shortCode || s.id);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-slate-900 truncate">{s.momoName || s.passengerName} <span className="font-normal text-slate-500">· {s.momoNumber || s.passengerPhone || ""}</span></div>
                          <div className="text-[11px] text-slate-500 truncate">{s.shortCode} · {s.trip?.from || ""} → {s.trip?.to || ""} · {s.status}</div>
                        </div>
                        <span className="text-[11px] font-bold text-primary shrink-0">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleVerifySearch()}
                disabled={verifying}
                className="bg-primary text-white px-4 rounded-xl font-bold text-[12px] shadow-sm active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
              >
                {verifying ? "Searching..." : "Verify"}
              </button>
            </div>

            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-xl border ${
                  verifyResult.found
                    ? verifyResult.booking?.status === "boarded"
                      ? "bg-gray-100 border-gray-300 text-gray-600"
                      : "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {verifyResult.found && verifyResult.booking ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between border-b border-gray-200/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[15px] text-text-primary">
                            {verifyResult.booking.passengerName}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                              verifyResult.booking.status === "boarded"
                                ? "bg-gray-200 text-gray-600 line-through"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {verifyResult.booking.shortCode ||
                              verifyResult.booking.id
                                .substring(0, 6)
                                .toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-muted mt-0.5">
                          Phone: {verifyResult.booking.passengerPhone || "N/A"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">
                          Seat Number
                        </span>
                        <span className="text-[18px] font-extrabold text-primary">
                          {verifyResult.booking.seatNumber ||
                            verifyResult.booking.seat ||
                            "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          Route / Trip
                        </span>
                        <span className="font-semibold text-text-primary">
                          {verifyResult.booking.trip?.from || "Origin"} →{" "}
                          {verifyResult.booking.trip?.to || "Destination"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          Fare Paid
                        </span>
                        <span className="font-bold text-emerald-700">
                          {verifyResult.booking.totalAmount?.toLocaleString() ||
                            verifyResult.booking.trip?.price?.toLocaleString() ||
                            "2,500"}{" "}
                          RWF
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      {verifyResult.booking.status === "boarded" ? (
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-3 py-1.5 rounded-full uppercase">
                          EXPIRED / ALREADY BOARDED
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            handleMarkAsBoardedUsed(verifyResult.booking!.id)
                          }
                          disabled={verifying}
                          className="bg-primary hover:bg-primary/90 text-white text-[12px] font-extrabold px-4 py-2 rounded-xl shadow-sm cursor-pointer transition-colors"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] font-medium text-center py-2">
                    No matching booking found at {agentBranch} for &quot;
                    {searchSeat}&quot;
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-extrabold text-text-primary flex items-center gap-1.5">
                <AlertCircle size={16} className="text-amber-500" />
                Submitted MoMo Payments ({pendingMoMoPayments.length})
              </h3>
            </div>

            {pendingMoMoPayments.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-6 text-center text-text-muted text-[12px]">
                No pending MoMo payment confirmations at {agentBranch}.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMoMoPayments.map((momo) => (
                  <motion.div
                    key={momo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border-2 border-amber-300 p-3.5 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 font-bold text-[9px] px-2 py-0.5 rounded-bl-lg">
                      MTN MoMo
                    </div>

                    <div className="flex items-start justify-between pr-12 mb-2">
                      <div>
                        <div className="text-[13px] font-bold text-text-primary flex items-center gap-1">
                          <User size={13} className="text-text-muted" />
                          {momo.passengerName}
                        </div>
                        <div className="text-[11px] font-mono text-gray-600 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-text-muted" />
                          <span className="font-semibold text-text-primary">
                            MoMo Name:
                          </span>{" "}
                          <span className="font-bold text-amber-700">
                            {momo.momoName}
                          </span>{" "}
                          ({momo.momoNumber})
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-amber-50/60 p-2 rounded-lg mb-3 border border-amber-100">
                      <div>
                        <span className="text-text-muted block text-[9px]">
                          Trip
                        </span>
                        <span className="font-bold text-text-primary">
                          {momo.tripRoute}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[9px]">
                          Amount Paid
                        </span>
                        <span className="font-extrabold text-green-700">
                          {momo.amount.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-[10px] text-text-muted">
                        {momo.date}
                      </span>
                      <button
                        onClick={() => handleConfirmMoMoPayment(momo.id)}
                        disabled={verifying}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      >
                        <CheckCircle size={14} />
                        confirm
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manifest" && (
        <div className="px-4 mt-4 space-y-3">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl flex gap-1.5 backdrop-blur-md border border-slate-200/60 shadow-inner">
            <button
              onClick={() => setManifestSubTab("incoming")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                manifestSubTab === "incoming"
                  ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <ArrowDownLeft
                size={15}
                className={
                  manifestSubTab === "incoming"
                    ? "text-[#00B14F]"
                    : "text-slate-400"
                }
              />
              <span>Incoming</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  manifestSubTab === "incoming"
                    ? "bg-emerald-100 text-[#00B14F]"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {stationIncoming.length}
              </span>
            </button>

            <button
              onClick={() => setManifestSubTab("outgoing")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                manifestSubTab === "outgoing"
                  ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <ArrowUpRight
                size={15}
                className={
                  manifestSubTab === "outgoing"
                    ? "text-[#00B14F]"
                    : "text-slate-400"
                }
              />
              <span>Departed</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  manifestSubTab === "outgoing"
                    ? "bg-emerald-100 text-[#00B14F]"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {stationOutgoing.length}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {manifestSubTab === "incoming"
              ? stationIncoming.map((trip) => {
                  const paperTickets = Math.max(
                    0,
                    trip.capacity - trip.urugendoPassengers,
                  );
                  return (
                    <div
                      key={trip.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-[#00B14F] uppercase tracking-wider">
                            INBOUND FROM {trip.from.toUpperCase()}
                          </span>
                          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <span>Bus {trip.busPlate}</span>
                          </h2>
                          <p className="text-xs text-slate-500 font-semibold">
                            Driver: {trip.driverName}
                          </p>
                        </div>
                        <span className="bg-emerald-100 text-[#00B14F] text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                          <Clock size={12} /> ETA: {trip.time}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Total Capacity
                          </span>
                          <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                            <Armchair size={12} className="text-slate-500" />
                            {trip.capacity} Seats
                          </span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-xl">
                          <span className="text-[9.5px] font-bold text-emerald-600 block uppercase">
                            Weka App
                          </span>
                          <span className="text-xs font-black text-[#00B14F] flex items-center justify-center gap-1">
                            <Ticket size={12} />
                            {trip.urugendoPassengers} Pass
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Paper Tickets
                          </span>
                          <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                            <Users size={12} className="text-slate-400" />
                            {paperTickets} Pass
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              : stationOutgoing.map((trip) => {
                  const empty = emptySeats[trip.id] ?? 0;
                  const paperTickets = Math.max(
                    0,
                    trip.capacity - trip.urugendoPassengers - empty,
                  );

                  return (
                    <div
                      key={trip.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            OUTBOUND TO {trip.to.toUpperCase()}
                          </span>
                          <h2 className="text-base font-black text-slate-900">
                            Bus {trip.busPlate}
                          </h2>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            Driver: {trip.driverName} · Departed: {trip.time}
                          </p>
                        </div>
                        <span
                          className={`${trip.status === "pending" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"} border text-[10.5px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0`}
                        >
                          {trip.status === "pending"
                            ? "Pending"
                            : "Left Station"}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
                        <div>
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Weka App
                          </span>
                          <span className="text-xs font-black text-[#00B14F]">
                            {trip.urugendoPassengers} Passengers
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Paper Tickets
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {paperTickets} Passengers
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Total Onboard
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {trip.urugendoPassengers + paperTickets} /{" "}
                            {trip.capacity}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">
                            Record Empty Seats
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Adjusts paper ticket calculation
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={trip.capacity}
                            value={empty}
                            onChange={(e) =>
                              setEmptySeats((prev) => ({
                                ...prev,
                                [trip.id]: Math.min(
                                  trip.capacity,
                                  Math.max(0, Number(e.target.value)),
                                ),
                              }))
                            }
                            className="w-16 bg-[#ffffff] border border-slate-300 rounded-lg py-1 px-2 text-center font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#00B14F] focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveEmptySeats(trip.id)}
                            className="bg-[#00B14F] hover:bg-[#00B14F]/90 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
                            title="Save empty seats"
                          >
                            {savedFeedback === trip.id ? (
                              <CheckCircle2 size={15} className="text-white" />
                            ) : (
                              <Save size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                      {savedFeedback === trip.id && (
                        <p className="text-[11px] font-bold text-emerald-600 text-right">
                          ✓ Empty seat record saved successfully!
                        </p>
                      )}
                    </div>
                  );
                })}

            <button
              onClick={exportStyledExcelReport}
              className="w-full mt-4 bg-[#00B14F] hover:bg-[#00B14F]/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Generate Printable Manifest (
              {manifestSubTab})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
