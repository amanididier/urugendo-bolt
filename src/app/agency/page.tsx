"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Clock,
  Ticket,
  MapPin,
  TrendingUp,
  DollarSign,
  Calendar,
  ChevronRight,
  Search,
  CheckCircle,
  Bus,
  Save,
  Phone,
  User,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  fetchTripsByDate,
  fetchAllBookings,
  updateBookingStatus,
  updateTripStatus,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Trip, Booking } from "@/lib/types";

export interface ExtendedBooking extends Omit<Partial<Booking>, "status"> {
  id: string;
  passengerName?: string;
  passengerPhone?: string;
  seatNumber?: string;
  totalAmount?: number;
  status?: string;
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

interface ManifestBus {
  id: string;
  trip: string;
  departureTime: string;
  arrivalTime: string;
  driverName: string;
  plateNumber: string;
  urugendoPassengers: number;
  totalCapacity: number;
  emptySeats: number;
  type: "incoming" | "outgoing";
  originStation?: string;
  destinationStation?: string;
}

export default function AgencyDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<ExtendedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "today" | "schedule" | "verify" | "manifest"
  >("today");
  const [manifestSubTab, setManifestSubTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );

  const [searchSeat, setSearchSeat] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    booking?: ExtendedBooking;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Agency Session Context
  const [agentBranch, setAgentBranch] = useState("Musanze");
  const [operatorId, setOperatorId] = useState("");

  const [emptySeatsInputs, setEmptySeatsInputs] = useState<
    Record<string, number>
  >({});
  const [savedManifests, setSavedManifests] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    let isMounted = true;

    // Load logged-in station details
    const branch = localStorage.getItem("urugendo_branch") || "Musanze";
    const opId = localStorage.getItem("urugendo_operator_id") || "";
    setAgentBranch(branch);
    setOperatorId(opId);

    async function loadDashboardData() {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const [todayTrips, allBookings] = await Promise.all([
          fetchTripsByDate(todayStr),
          fetchAllBookings(),
        ]);
        if (isMounted) {
          setTrips(todayTrips || []);
          setBookings((allBookings as ExtendedBooking[]) || []);
        }
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

  const pendingMoMoPayments: PendingMoMoPayment[] = bookings
    .filter((b) => b.status === "pending" || b.status === "payment_submitted")
    .map((b) => {
      const tripObj = b.trip && typeof b.trip === "object" ? b.trip : null;
      const createdDate = b.createdAt ? new Date(b.createdAt) : new Date();

      return {
        id: b.id,
        momoName: b.momoName || "MTN Subscriber",
        momoNumber: b.momoNumber || b.passengerPhone || "0780000000",
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
        amount: b.totalAmount || 5000,
        status: "pending",
        shortCode: b.shortCode || b.id.substring(0, 6).toUpperCase(),
      };
    });

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const todayRevenue = activeBookings.reduce(
    (sum, b) => sum + (b.totalAmount || 0),
    0,
  );

  const stats = {
    todayBookings: activeBookings.length,
    todayRevenue,
    totalBuses:
      new Set(trips.map((t) => t.plateNumber || t.id).filter(Boolean)).size ||
      12,
    activeRoutes: new Set(trips.map((t) => `${t.from}-${t.to}`)).size || 5,
  };

  // Dynamically mapped manifest lists bound to active station
  const manifestBuses: ManifestBus[] = [
    {
      id: "mf-1",
      trip: "Kigali → " + agentBranch,
      departureTime: "14:00",
      arrivalTime: "16:15",
      driverName: "Jean-Paul Habimana",
      plateNumber: "RAD 450 B",
      urugendoPassengers: 18,
      totalCapacity: 29,
      emptySeats: emptySeatsInputs["mf-1"] ?? 11,
      type: "incoming",
      originStation: "Kigali Nyabugogo",
      destinationStation: agentBranch + " Station",
    },
    {
      id: "mf-2",
      trip: "Rubavu → " + agentBranch,
      departureTime: "14:30",
      arrivalTime: "15:45",
      driverName: "Eric Ndayishimiye",
      plateNumber: "RAC 112 D",
      urugendoPassengers: 22,
      totalCapacity: 29,
      emptySeats: emptySeatsInputs["mf-2"] ?? 7,
      type: "incoming",
      originStation: "Rubavu Station",
      destinationStation: agentBranch + " Station",
    },
    {
      id: "mf-3",
      trip: agentBranch + " → Kigali",
      departureTime: "12:30",
      arrivalTime: "14:45",
      driverName: "Emmanuel Bizimana",
      plateNumber: "RAE 889 A",
      urugendoPassengers: 25,
      totalCapacity: 29,
      emptySeats: emptySeatsInputs["mf-3"] ?? 4,
      type: "outgoing",
      originStation: agentBranch + " Station",
      destinationStation: "Kigali Nyabugogo",
    },
    {
      id: "mf-4",
      trip: agentBranch + " → Rubavu",
      departureTime: "13:00",
      arrivalTime: "14:15",
      driverName: "Claude Mugisha",
      plateNumber: "RAD 302 C",
      urugendoPassengers: 20,
      totalCapacity: 29,
      emptySeats: emptySeatsInputs["mf-4"] ?? 9,
      type: "outgoing",
      originStation: agentBranch + " Station",
      destinationStation: "Rubavu Station",
    },
  ];

  const handleVerifySearch = () => {
    if (!searchSeat.trim()) {
      setVerifyResult(null);
      return;
    }
    const query = searchSeat.toUpperCase().trim();
    const found = bookings.find((b) => {
      return (
        b.seatNumber?.toUpperCase() === query ||
        b.id.toUpperCase().includes(query) ||
        b.passengerName?.toUpperCase().includes(query) ||
        b.shortCode?.toUpperCase() === query
      );
    });

    setVerifyResult({ found: !!found, booking: found });
  };

  const handleConfirmMoMoPayment = async (bookingId: string) => {
    setVerifying(true);
    const success = await updateBookingStatus(bookingId, "confirmed" as any);
    if (success) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "confirmed" } : b,
        ),
      );
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
    }
    setVerifying(false);
  };

  const handleSaveEmptySeats = (busId: string) => {
    setSavedManifests((prev) => ({ ...prev, [busId]: true }));
    setTimeout(() => {
      setSavedManifests((prev) => ({ ...prev, [busId]: false }));
    }, 2500);
  };

  const handleMarkDelayed = async (tripId: string) => {
    const success = await updateTripStatus(tripId, "delayed" as any);
    if (success) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId ? { ...t, status: "delayed" as Trip["status"] } : t,
        ),
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "boarding":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "departed":
        return "bg-gray-100 text-gray-600";
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
        <div className="text-text-muted text-[14px]">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-[88px] min-h-screen">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🚌
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">
              Agency Dashboard
            </h1>
            <p className="text-[12px] text-white/80 font-medium">
              Virunga Express • {agentBranch} Station
            </p>
          </div>
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

      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl p-1 border border-border flex shadow-sm">
          {(["today", "schedule", "verify", "manifest"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab === "today"
                ? "Today"
                : tab === "schedule"
                  ? "Schedule"
                  : tab === "verify"
                    ? "Verify"
                    : "Manifest"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "today" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-gradient-to-r from-emerald-600 to-primary rounded-2xl p-4 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-white/80 font-medium">
                Today&apos;s Revenue
              </span>
              <DollarSign size={18} className="text-white/80" />
            </div>
            <div className="text-[28px] font-extrabold">
              {stats.todayRevenue.toLocaleString()} RWF
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-white/90">
              <TrendingUp size={14} />
              <span>{stats.todayBookings} confirmed bookings today</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-medium text-text-muted">
                  Urugendo Online
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
              onClick={() => setActiveTab("schedule")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <Plus size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Add Schedule
              </span>
            </button>
            <button
              onClick={() => setActiveTab("verify")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <Search size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Verify Ticket
              </span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="px-4 mt-4">
          <button
            onClick={() => router.push("/agency/schedule")}
            className="w-full bg-primary text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold mb-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus size={18} />
            Add New Departure
          </button>

          {trips.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[13px]">
              No trips scheduled for today
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip, i) => {
                const tripBookings = bookings.filter((b) => {
                  const bTripId =
                    typeof b.trip === "string" ? b.trip : b.trip?.id;
                  return bTripId === trip.id && b.status !== "cancelled";
                });
                const bookedCount = tripBookings.length;

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl border border-border overflow-hidden shadow-sm"
                  >
                    <div className="px-4 py-2 bg-surface-secondary flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-text-muted" />
                        <span className="text-[13px] font-bold text-text-primary">
                          {trip.departureTime}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          → {trip.arrivalTime || "Calc"}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(
                          trip.status || "scheduled",
                        )}`}
                      >
                        {(trip.status || "SCHEDULED").toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-primary" />
                          <span className="text-[12px] font-semibold text-text-primary">
                            {trip.from} → {trip.to}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-text-muted bg-gray-100 px-2 py-0.5 rounded">
                          {trip.plateNumber || "RAC 302 C"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-primary">
                              {bookedCount}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Booked
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-green-600">
                              {Math.max(
                                0,
                                (trip.totalSeats || 29) - bookedCount,
                              )}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Remaining
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-text-muted">
                              {trip.totalSeats || 29}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Total
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {trip.status !== "delayed" && (
                            <button
                              onClick={() => handleMarkDelayed(trip.id)}
                              className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100"
                            >
                              Mark Delayed
                            </button>
                          )}
                          <div className="text-right">
                            <div className="text-[14px] font-bold text-text-primary">
                              {(trip.price * bookedCount).toLocaleString()}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              RWF
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "verify" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-white rounded-xl border border-border p-3.5 shadow-sm">
            <h3 className="text-[13px] font-bold text-text-primary mb-2">
              Lookup Ticket or Seat
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchSeat}
                  onChange={(e) => setSearchSeat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySearch()}
                  placeholder="Enter Seat Number, Ticket Code, or Name"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleVerifySearch}
                className="bg-primary text-white px-4 rounded-xl font-bold text-[12px] shadow-sm active:scale-95 transition-transform"
              >
                Search
              </button>
            </div>

            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 p-3 rounded-xl border ${
                  verifyResult.found
                    ? verifyResult.booking?.status === "boarded"
                      ? "bg-gray-100 border-gray-300 text-gray-500"
                      : "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {verifyResult.found && verifyResult.booking ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px]">
                          {verifyResult.booking.passengerName}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            verifyResult.booking.status === "boarded"
                              ? "bg-gray-200 text-gray-600 line-through"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {verifyResult.booking.shortCode ||
                            verifyResult.booking.id
                              .substring(0, 6)
                              .toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Seat: {verifyResult.booking.seatNumber || "N/A"} •
                        Amount:{" "}
                        {verifyResult.booking.totalAmount?.toLocaleString()} RWF
                      </div>
                    </div>
                    {verifyResult.booking.status === "boarded" ? (
                      <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                        EXPIRED / USED
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handleMarkAsBoardedUsed(verifyResult.booking!.id)
                        }
                        disabled={verifying}
                        className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm hover:bg-primary-dark"
                      >
                        Verify & Board
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-[12px] font-medium text-center">
                    No matching booking found for &quot;{searchSeat}&quot;
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
              <span className="text-[10px] text-text-muted">
                Instant Receiver
              </span>
            </div>

            {pendingMoMoPayments.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-6 text-center text-text-muted text-[12px]">
                No pending MoMo payment confirmations at the moment.
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <CheckCircle size={14} />
                        Confirm Payment
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-[13px] font-bold text-text-primary mb-3">
              Today&apos;s Verified & Boarded Tickets ({bookings.length})
            </h3>
            {bookings.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-[12px]">
                No verified tickets yet
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => {
                  const isBoardedUsed = b.status === "boarded";
                  const code =
                    b.shortCode || b.id.substring(0, 6).toUpperCase();

                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isBoardedUsed
                          ? "bg-gray-100/80 border-gray-200 text-gray-500"
                          : "bg-surface-secondary border-border text-text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                            isBoardedUsed
                              ? "bg-gray-200 text-gray-500 line-through"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {b.seatNumber || "A1"}
                        </div>
                        <div className="truncate">
                          <div
                            className={`text-[12px] font-semibold truncate ${
                              isBoardedUsed ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {b.passengerName}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                isBoardedUsed
                                  ? "bg-gray-200 text-gray-500 line-through decoration-red-500"
                                  : "bg-primary/10 text-primary font-bold"
                              }`}
                            >
                              {code}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {b.totalAmount?.toLocaleString()} RWF
                            </span>
                          </div>
                        </div>
                      </div>

                      {isBoardedUsed ? (
                        <span className="text-[10px] font-extrabold text-gray-400 bg-gray-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          EXPIRED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkAsBoardedUsed(b.id)}
                          disabled={verifying}
                          className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20"
                        >
                          Mark Boarded
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manifest" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-gray-200/80 p-1 rounded-xl flex">
            <button
              onClick={() => setManifestSubTab("incoming")}
              className={`flex-1 py-2 text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                manifestSubTab === "incoming"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-muted"
              }`}
            >
              <ArrowDownLeft size={14} />
              Incoming Buses
            </button>
            <button
              onClick={() => setManifestSubTab("outgoing")}
              className={`flex-1 py-2 text-[12px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                manifestSubTab === "outgoing"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-muted"
              }`}
            >
              <ArrowUpRight size={14} />
              Left / Outgoing
            </button>
          </div>

          {manifestSubTab === "incoming" && (
            <div className="space-y-3">
              {manifestBuses
                .filter((b) => b.type === "incoming")
                .map((bus) => (
                  <motion.div
                    key={bus.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-border p-3.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bus size={16} className="text-primary" />
                        <span className="text-[13px] font-bold text-text-primary">
                          {bus.trip}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        ETA {bus.arrivalTime}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted space-y-1 mb-3">
                      <div>
                        Origin:{" "}
                        <span className="font-semibold text-text-primary">
                          {bus.originStation}
                        </span>
                      </div>
                      <div>
                        Driver:{" "}
                        <span className="font-semibold text-text-primary">
                          {bus.driverName}
                        </span>{" "}
                        ({bus.plateNumber})
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                      <span className="text-text-muted">
                        Urugendo Passengers:{" "}
                        <strong className="text-primary">
                          {bus.urugendoPassengers}
                        </strong>
                      </span>
                      <span className="text-text-muted">
                        Total Capacity:{" "}
                        <strong>{bus.totalCapacity} seats</strong>
                      </span>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}

          {manifestSubTab === "outgoing" && (
            <div className="space-y-3">
              {manifestBuses
                .filter((b) => b.type === "outgoing")
                .map((bus) => (
                  <motion.div
                    key={bus.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-border p-3.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bus size={16} className="text-emerald-600" />
                        <span className="text-[13px] font-bold text-text-primary">
                          {bus.trip}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        Departed {bus.departureTime}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted space-y-1 mb-3">
                      <div>
                        Driver:{" "}
                        <span className="font-semibold text-text-primary">
                          {bus.driverName}
                        </span>{" "}
                        ({bus.plateNumber})
                      </div>
                      <div>
                        Urugendo Passengers:{" "}
                        <strong className="text-primary">
                          {bus.urugendoPassengers}
                        </strong>{" "}
                        / {bus.totalCapacity}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <div className="flex-1 flex items-center gap-2">
                        <label className="text-[11px] text-text-muted font-medium shrink-0">
                          Empty Seats:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="29"
                          value={emptySeatsInputs[bus.id] ?? bus.emptySeats}
                          onChange={(e) =>
                            setEmptySeatsInputs({
                              ...emptySeatsInputs,
                              [bus.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-16 px-2 py-1 border border-border rounded-lg text-[12px] font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveEmptySeats(bus.id)}
                        className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm active:scale-95 transition-transform"
                      >
                        <Save size={12} />
                        {savedManifests[bus.id] ? "Saved!" : "Save"}
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}

          <button
            onClick={() => router.push("/agency/reports")}
            className="w-full bg-white border border-border rounded-xl py-3 flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all mt-4"
          >
            <Calendar size={16} className="text-text-muted" />
            <span className="text-[12px] font-semibold text-text-primary">
              Generate Printable Manifest / Report Table
            </span>
            <ChevronRight size={16} className="text-text-muted" />
          </button>
        </div>
      )}
    </div>
  );
}
