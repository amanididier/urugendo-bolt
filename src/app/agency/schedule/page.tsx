"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/app-context";
import {
  Clock,
  ArrowLeft,
  Plus,
  X,
  MapPin,
  Bus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Armchair,
  Building,
  Users,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchTripsByDate,
  createTrip,
  updateTripStatus,
  fetchAllBookings,
  updateBookingStatus,
} from "@/lib/api";
import type { Trip, Booking } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface BranchMomo {
  terminal: string;
  code: string;
  ussd: string;
}

const cleanStationName = (name: string) =>
  name
    .toLowerCase()
    .replace(/branch|station|terminal/g, "")
    .trim();

const getRouteKey = (from: string, to: string) => {
  if (!from || !to) return "";
  const sorted = [from.trim().toLowerCase(), to.trim().toLowerCase()].sort();
  return sorted.join("<->");
};

const INITIAL_ROUTE_DEFAULTS: Record<
  string,
  { durationMinutes: number; price: number }
> = {
  [getRouteKey("Kigali", "Musanze")]: { durationMinutes: 150, price: 3500 },
  [getRouteKey("Kigali", "Rubavu")]: { durationMinutes: 210, price: 4500 },
  [getRouteKey("Kigali", "Gicumbi")]: { durationMinutes: 90, price: 2000 },
  [getRouteKey("Kigali", "Nyagatare")]: { durationMinutes: 180, price: 4000 },
  [getRouteKey("Musanze", "Rubavu")]: { durationMinutes: 75, price: 2000 },
};

const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr || !timeStr.includes(":")) return "";
  const [hStr, mStr] = timeStr.split(":");
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return "";
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() + minutesToAdd);
  const newH = String(date.getHours()).padStart(2, "0");
  const newM = String(date.getMinutes()).padStart(2, "0");
  return `${newH}:${newM}`;
};

const calculateDurationMinutes = (timeFrom: string, timeTo: string): number => {
  if (!timeFrom || !timeTo || !timeFrom.includes(":") || !timeTo.includes(":"))
    return 0;
  const [h1, m1] = timeFrom.split(":").map(Number);
  const [h2, m2] = timeTo.split(":").map(Number);
  let totalMin1 = h1 * 60 + m1;
  let totalMin2 = h2 * 60 + m2;
  if (totalMin2 < totalMin1) {
    totalMin2 += 24 * 60;
  }
  return totalMin2 - totalMin1;
};

function AgencyScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTripId = searchParams.get("tripId");

  const { userRole } = useApp();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [specificTrip, setSpecificTrip] = useState<Trip | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [agentBranch, setAgentBranch] = useState("Musanze");
  const [momoBranchCodes, setMomoBranchCodes] = useState<BranchMomo[]>([]);

  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayTripTarget, setDelayTripTarget] = useState<Trip | null>(null);
  const [delayCause, setDelayCause] = useState("");
  const [delayTimeEst, setDelayTimeEst] = useState("30 mins");
  const [submittingDelay, setSubmittingDelay] = useState(false);

  const [form, setForm] = useState({
    routeFrom: "",
    routeTo: "",
    date: "",
    time: "08:00",
    arrivalTime: "10:30",
    plate: "",
    busType: "coaster" as "coaster" | "coach",
    totalSeats: "29",
    price: "3500",
    branchMomoCode: "",
  });

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const branch =
      localStorage.getItem("urugendo_branch") ||
      localStorage.getItem("urugendo_station") ||
      "Musanze";

    setAgentBranch(branch);

    const localMomo =
      localStorage.getItem(`momo_code_${branch.toLowerCase()}`) ||
      localStorage.getItem("urugendo_branch_momo") ||
      "5129401";

    setForm((prev) => ({
      ...prev,
      date: todayStr,
      routeFrom: branch,
      branchMomoCode: localMomo,
    }));

    (async () => {
      try {
        const { data: dbBranches } = await supabase
          .from("branches")
          .select("*");
        if (dbBranches && dbBranches.length > 0) {
          const formatted = dbBranches.map(
            (b: { name: string; momo_code: string }) => ({
              terminal: b.name,
              code: b.momo_code || "0000000",
              ussd: `*182*8*1*${b.momo_code || "0000000"}#`,
            }),
          );
          setMomoBranchCodes(formatted);

          const currentB = dbBranches.find(
            (b: { name: string; momo_code: string }) =>
              cleanStationName(b.name) === cleanStationName(branch),
          );

          if (currentB?.momo_code) {
            setForm((prev) => ({
              ...prev,
              branchMomoCode: currentB.momo_code,
            }));
          }
        }
      } catch {
        // Fallback default codes handled safely
      }
    })();
  }, []);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const [tripData, bookingData] = await Promise.all([
      fetchTripsByDate(todayStr),
      fetchAllBookings(),
    ]);

    const currentBranch =
      localStorage.getItem("urugendo_branch") || agentBranch;
    const branchClean = cleanStationName(currentBranch);

    const branchTrips = (tripData || []).filter((trip) => {
      const tripFromClean = cleanStationName(trip.from || "");
      return tripFromClean === branchClean;
    });

    setTrips(branchTrips);
    setBookings((bookingData as Booking[]) || []);
    setLoading(false);
  }, [agentBranch]);

  useEffect(() => {
    if (selectedTripId) {
      supabase
        .from("trips")
        .select("*")
        .eq("id", selectedTripId)
        .single()
        .then(({ data }) => {
          if (data) setSpecificTrip(data as Trip);
        });
    } else {
      setSpecificTrip(null);
    }
  }, [selectedTripId]);

  const activeTrip = trips.find((t) => t.id === selectedTripId) || specificTrip;

  useEffect(() => {
    if (userRole === "agent") {
      loadTrips();
    } else {
      router.push("/agency/agency-login");
    }
  }, [userRole, router, loadTrips]);

  useEffect(() => {
    if (!form.routeFrom || !form.routeTo) return;
    const rKey = getRouteKey(form.routeFrom, form.routeTo);
    let routeInfo = INITIAL_ROUTE_DEFAULTS[rKey];

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`route_meta_${rKey}`);
      if (stored) {
        try {
          routeInfo = JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }

    if (routeInfo) {
      const computedArrival = addMinutesToTime(
        form.time,
        routeInfo.durationMinutes,
      );
      setForm((prev) => {
        if (
          prev.arrivalTime === computedArrival &&
          (prev.price !== "" || prev.price === String(routeInfo.price))
        ) {
          return prev;
        }
        return {
          ...prev,
          price: prev.price === "" ? String(routeInfo.price) : prev.price,
          arrivalTime: computedArrival || prev.arrivalTime,
        };
      });
    }
  }, [form.routeFrom, form.routeTo, form.time]);

  if (userRole !== "agent") {
    return null;
  }

  const handleBusTypeChange = (type: "coaster" | "coach") => {
    setForm((prev) => ({
      ...prev,
      busType: type,
      totalSeats: type === "coaster" ? "29" : "45",
    }));
  };

  const handleCreate = async () => {
    if (!form.routeFrom || !form.routeTo || !form.time || !form.plate) {
      setError("Please fill in all required route and vehicle details");
      return;
    }
    const seatsNum = parseInt(form.totalSeats, 10);
    if (isNaN(seatsNum) || seatsNum < 1) {
      setError("Enter a valid total seat count");
      return;
    }
    const priceNum = parseInt(form.price, 10);
    if (isNaN(priceNum) || priceNum < 1) {
      setError("Enter a valid ticket price");
      return;
    }

    setSaving(true);
    setError("");

    const calculatedDuration = calculateDurationMinutes(
      form.time,
      form.arrivalTime,
    );

    if (calculatedDuration > 0) {
      const rKey = getRouteKey(form.routeFrom, form.routeTo);
      localStorage.setItem(
        `route_meta_${rKey}`,
        JSON.stringify({
          durationMinutes: calculatedDuration,
          price: priceNum,
        }),
      );
    }

    const tripId = await createTrip({
      from: form.routeFrom,
      to: form.routeTo,
      departureTime: form.time,
      arrivalTime: form.arrivalTime || form.time,
      travelDate: form.date,
      price: priceNum,
      totalSeats: seatsNum,
      plateNumber: form.plate,
      busType: form.busType,
    });

    setSaving(false);

    if (tripId) {
      setShowForm(false);
      const branch = localStorage.getItem("urugendo_branch") || "Musanze";
      const todayStr = new Date().toISOString().split("T")[0];
      setForm((prev) => ({
        ...prev,
        routeFrom: branch,
        routeTo: "",
        date: todayStr,
        time: "08:00",
        arrivalTime: "10:30",
        plate: "",
        busType: "coaster",
        totalSeats: "29",
        price: "3500",
      }));
      await loadTrips();
    } else {
      setError(
        "Failed to create departure. Account may not be linked to an operator.",
      );
    }
  };

  const handleOpenDelayModal = (trip: Trip, e: React.MouseEvent) => {
    e.stopPropagation();
    setDelayTripTarget(trip);
    setDelayCause("");
    setDelayTimeEst("30 mins");
    setShowDelayModal(true);
  };

  const handleConfirmDelaySubmit = async () => {
    if (!delayTripTarget) return;
    setSubmittingDelay(true);

    await updateTripStatus(delayTripTarget.id, "delayed");

    try {
      const destinationCity = delayTripTarget.to;
      const successMessage = `The delay message of a trip to ${destinationCity} has successfully been sent to passengers.`;

      const existingUserNotifs = JSON.parse(
        localStorage.getItem("urugendo_user_notifications") || "[]",
      );
      const newNotifItem = {
        id: `delay-${Date.now()}`,
        title: "Trip Delay Notice",
        message: `${successMessage} Reason: ${delayCause || "operational adjustments"}. Est: ${delayTimeEst}.`,
        type: "departure",
        read: false,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(
        "urugendo_user_notifications",
        JSON.stringify([newNotifItem, ...existingUserNotifs]),
      );

      const existingAgentNotifs = JSON.parse(
        localStorage.getItem("urugendo_agent_branch_notifications_v1") || "[]",
      );
      const newAgentNotif = {
        id: `agent-delay-${Date.now()}`,
        station: delayTripTarget.from || agentBranch,
        title: `Trip Delay: ${destinationCity}`,
        message: successMessage,
        type: "delay" as const,
        read: false,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(
        "urugendo_agent_branch_notifications_v1",
        JSON.stringify([newAgentNotif, ...existingAgentNotifs]),
      );
    } catch {
      // Storage handled gracefully
    }

    setSubmittingDelay(false);
    setShowDelayModal(false);
    await loadTrips();
  };

  const handleVerifyTicket = async (bookingId: string) => {
    const success = await updateBookingStatus(bookingId, "boarded" as any);
    if (success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "boarded" } : b)),
      );

      try {
        const tripInfo = activeTrip
          ? `from ${activeTrip.from} to ${activeTrip.to} ${activeTrip.departureTime}`
          : "for your trip";
        const userNotifs = JSON.parse(
          localStorage.getItem("urugendo_user_notifications") || "[]",
        );
        const verifiedNotif = {
          id: `verify-${Date.now()}`,
          title: "Ticket Verified!",
          message: `Your ticket ${tripInfo} has been received .you may check it in your tickets page.`,
          type: "booking",
          read: false,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(
          "urugendo_user_notifications",
          JSON.stringify([verifiedNotif, ...userNotifs]),
        );
      } catch {
        // Storage handled gracefully
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "arrived":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "in-progress":
      case "departed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "boarding":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "delayed":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "scheduled":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-surface-secondary min-h-screen pb-[100px] font-sans">
      <div className="bg-primary pt-[50px] px-5 pb-6 rounded-b-[28px] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => router.push("/agency")}
            className="p-2.5 bg-white/15 backdrop-blur-md rounded-full text-white hover:bg-white/25 transition-all cursor-pointer shadow-sm flex items-center justify-center"
            title="Minimize and return to schedule"
          >
            <ArrowLeft size={20} />
          </motion.button>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-[12px] font-semibold mb-1">
          <Building size={14} /> Virunga Express • {agentBranch} Branch
        </div>
        <h1 className="text-[22px] font-extrabold text-white tracking-tight">
          {activeTrip
            ? `Trip Details: ${activeTrip.from} → ${activeTrip.to}`
            : "Schedule & Dispatch Engine"}
        </h1>
        <p className="text-[12px] text-white/80 mt-0.5">
          {activeTrip
            ? `Bus ${activeTrip.plateNumber || "N/A"} • ${activeTrip.departureTime}`
            : "Dispatch route departures and set trip availability"}
        </p>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {activeTrip ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  <span className="text-[15px] font-black text-text-primary">
                    {activeTrip.from} → {activeTrip.to}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const tripBookings = bookings.filter(
                      (b) =>
                        (typeof b.trip === "string" ? b.trip : b.trip?.id) ===
                          activeTrip.id && b.status !== "cancelled",
                    );
                    const allVerified =
                      tripBookings.length > 0 &&
                      tripBookings.every((b) => b.status === "boarded");
                    return (
                      <div
                        className={`w-3.5 h-3.5 rounded-full ${
                          allVerified
                            ? "bg-emerald-500"
                            : "bg-orange-500 animate-pulse"
                        }`}
                        title={
                          allVerified
                            ? "All passengers verified"
                            : "Bus/Passengers not yet fully verified"
                        }
                      />
                    );
                  })()}
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${getStatusColor(
                      activeTrip.status || "scheduled",
                    )}`}
                  >
                    {activeTrip.status || "scheduled"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px] text-text-muted bg-surface-secondary p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-primary shrink-0" />
                  <span className="font-semibold text-text-primary">
                    {activeTrip.departureTime}
                    {activeTrip.arrivalTime
                      ? ` - ${activeTrip.arrivalTime}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bus size={14} className="text-slate-400 shrink-0" />
                  <span className="font-mono font-bold text-text-primary">
                    {activeTrip.plateNumber || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Armchair size={14} className="text-slate-400 shrink-0" />
                  <span>{activeTrip.totalSeats} capacity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-600 shrink-0" />
                  <span className="font-extrabold text-emerald-700">
                    {activeTrip.price
                      ? `${activeTrip.price.toLocaleString()} RWF`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="text-[14px] font-extrabold text-text-primary flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Urugendo Subscribed Passengers
                </h3>
                <div className="flex items-center gap-2">
                  {(() => {
                    const count = bookings.filter(
                      (b) =>
                        (typeof b.trip === "string" ? b.trip : b.trip?.id) ===
                          activeTrip.id && b.status !== "cancelled",
                    ).length;
                    const allVerified =
                      count > 0 &&
                      bookings
                        .filter(
                          (b) =>
                            (typeof b.trip === "string"
                              ? b.trip
                              : b.trip?.id) === activeTrip.id &&
                            b.status !== "cancelled",
                        )
                        .every((b) => b.status === "boarded");

                    return (
                      <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            allVerified
                              ? "bg-emerald-500"
                              : "bg-orange-500 animate-pulse"
                          }`}
                        />
                        <span className="text-[11px] font-bold text-orange-900">
                          {count} Urugendo Passenger{count === 1 ? "" : "s"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {bookings.filter(
                (b) =>
                  (typeof b.trip === "string" ? b.trip : b.trip?.id) ===
                    activeTrip.id && b.status !== "cancelled",
              ).length === 0 ? (
                <div className="text-center py-6 text-text-muted text-[12px]">
                  No Urugendo passengers have subscribed to this exact trip yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {bookings
                    .filter(
                      (b) =>
                        (typeof b.trip === "string" ? b.trip : b.trip?.id) ===
                          activeTrip.id && b.status !== "cancelled",
                    )
                    .sort((a, b) => {
                      const aVerified = a.status === "boarded" ? 1 : 0;
                      const bVerified = b.status === "boarded" ? 1 : 0;
                      return aVerified - bVerified;
                    })
                    .map((booking) => {
                      const isVerified = booking.status === "boarded";
                      return (
                        <div
                          key={booking.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                            isVerified
                              ? "bg-gray-50 border-gray-200 opacity-60"
                              : "bg-surface-secondary border-border"
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="font-mono font-black text-[14px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 shrink-0">
                              {booking.shortCode ||
                                booking.id.substring(0, 6).toUpperCase()}
                            </span>

                            <div className="min-w-0">
                              <div className="font-bold text-[13px] text-text-primary truncate flex items-center gap-2">
                                <span className="truncate">
                                  {booking.passengerName || "Passenger"}
                                </span>
                                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 font-extrabold shrink-0">
                                  Seat{" "}
                                  {booking.seatNumber || booking.seat || "N/A"}
                                </span>
                              </div>
                              <div className="text-[10px] text-text-muted truncate mt-0.5">
                                {booking.passengerPhone || "N/A"}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2">
                            {isVerified ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <Check size={12} /> Verified
                              </span>
                            ) : (
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => handleVerifyTicket(booking.id)}
                                className="bg-primary hover:bg-primary/90 text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              >
                                Verify
                              </motion.button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-primary text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold shadow-sm hover:bg-primary/95 active:scale-[0.99] transition-all cursor-pointer text-[14px]"
            >
              <Plus size={20} />
              Add New Departure
            </button>

            {loading ? (
              <div className="text-center py-12 text-text-muted text-[13px]">
                Loading scheduled departures...
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-border p-6 shadow-sm">
                <Bus className="mx-auto text-slate-300 mb-2" size={36} />
                <p className="text-[14px] font-semibold text-text-primary">
                  No departures scheduled
                </p>
                <p className="text-[12px] text-text-muted mt-1">
                  Tap &quot;Add New Departure&quot; to dispatch a bus on a
                  route.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => {
                  const tripBookings = bookings.filter(
                    (b) =>
                      (typeof b.trip === "string" ? b.trip : b.trip?.id) ===
                        trip.id && b.status !== "cancelled",
                  );
                  const urugendoPassengersCount = tripBookings.length;
                  const allVerified =
                    urugendoPassengersCount > 0 &&
                    tripBookings.every((b) => b.status === "boarded");

                  return (
                    <div
                      key={trip.id}
                      onClick={() =>
                        router.push(`/agency/schedule?tripId=${trip.id}`)
                      }
                      className="bg-white rounded-2xl border border-border p-4 shadow-sm space-y-3 cursor-pointer hover:border-primary transition-all relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className="text-primary" />
                          <span className="text-[15px] font-black text-text-primary">
                            {trip.from} → {trip.to}
                          </span>
                          {trip.busType && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider bg-gray-100 text-slate-600 px-2 py-0.5 rounded-md border border-gray-200">
                              {trip.busType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3.5 h-3.5 rounded-full ${
                              allVerified
                                ? "bg-emerald-500"
                                : "bg-orange-500 animate-pulse"
                            }`}
                            title={
                              allVerified
                                ? "All passengers verified"
                                : "Bus not yet fully verified for users"
                            }
                          />
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${getStatusColor(
                              trip.status || "scheduled",
                            )}`}
                          >
                            {trip.status || "scheduled"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[12px] text-text-muted bg-surface-secondary p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-primary shrink-0" />
                          <span className="font-semibold text-text-primary">
                            {trip.departureTime}
                            {trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Bus size={14} className="text-slate-400 shrink-0" />
                          <span className="font-mono font-bold text-text-primary">
                            {trip.plateNumber || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Armchair
                            size={14}
                            className="text-slate-400 shrink-0"
                          />
                          <span>{trip.totalSeats} capacity</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-primary shrink-0" />
                          <span className="font-extrabold text-primary">
                            {urugendoPassengersCount} Urugendo Passenger
                            {urugendoPassengersCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              allVerified
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-orange-50 text-orange-700"
                            }`}
                          >
                            {allVerified
                              ? "✓ Verified for departure"
                              : "⚠️ Pending full verification"}
                          </span>
                        </div>

                        {trip.status !== "delayed" &&
                          trip.status !== "departed" &&
                          trip.status !== "arrived" && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => handleOpenDelayModal(trip, e)}
                              className="text-[11px] font-bold text-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 px-3.5 py-1.5 rounded-xl border border-orange-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                            >
                              <AlertTriangle size={13} />
                              Mark as Delayed
                            </motion.button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showDelayModal && delayTripTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 text-orange-700 rounded-2xl">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-text-primary">
                      Mark Trip as Delayed
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      {delayTripTarget.from} → {delayTripTarget.to} (
                      {delayTripTarget.departureTime})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDelayModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-slate-400 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Cause of Delay
                  </label>
                  <input
                    type="text"
                    value={delayCause}
                    onChange={(e) => setDelayCause(e.target.value)}
                    placeholder="e.g. Heavy traffic jam or mechanical check"
                    className="w-full px-3.5 py-3 bg-surface-secondary border border-border rounded-2xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Estimated Delay Time
                  </label>
                  <select
                    value={delayTimeEst}
                    onChange={(e) => setDelayTimeEst(e.target.value)}
                    className="w-full px-3.5 py-3 bg-surface-secondary border border-border rounded-2xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="15 mins">15 minutes</option>
                    <option value="30 mins">30 minutes</option>
                    <option value="45 mins">45 minutes</option>
                    <option value="1 hour">1 hour</option>
                    <option value="2 hours">2 hours</option>
                  </select>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                  ℹ️ Submitting this will automatically broadcast polite
                  notifications to all booked passengers and notify agent logs
                  instantly.
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowDelayModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-text-primary font-bold rounded-2xl text-[13px] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirmDelaySubmit}
                    disabled={submittingDelay}
                    className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl text-[13px] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {submittingDelay ? "Broadcasting..." : "Confirm & Notify"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-[18px] font-extrabold text-text-primary">
                  New Departure
                </h2>
                <p className="text-[12px] text-text-muted">
                  Smart route auto-calculation &amp; dispatch
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    From
                  </label>
                  <input
                    type="text"
                    value={form.routeFrom}
                    onChange={(e) =>
                      setForm({ ...form, routeFrom: e.target.value })
                    }
                    placeholder="e.g. Kigali"
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    To
                  </label>
                  <input
                    type="text"
                    value={form.routeTo}
                    onChange={(e) =>
                      setForm({ ...form, routeTo: e.target.value })
                    }
                    placeholder="e.g. Musanze"
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-text-muted block mb-1">
                  Branch Merchant MoMo Code (Autofilled)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={`*${form.branchMomoCode}#`}
                    readOnly
                    className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-900 font-mono font-extrabold tracking-wider outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                    Branch Code
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Travel Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Departure Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-bold text-text-muted block mb-1">
                  Arrival Time (Est.)
                </label>
                <input
                  type="time"
                  value={form.arrivalTime}
                  onChange={(e) =>
                    setForm({ ...form, arrivalTime: e.target.value })
                  }
                  className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Bus Category
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-surface-secondary p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => handleBusTypeChange("coaster")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        form.busType === "coaster"
                          ? "bg-white text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      Coaster
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBusTypeChange("coach")}
                      className={`py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        form.busType === "coach"
                          ? "bg-white text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      Coach
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Total Seats
                  </label>
                  <input
                    type="number"
                    value={form.totalSeats}
                    onChange={(e) =>
                      setForm({ ...form, totalSeats: e.target.value })
                    }
                    placeholder="29"
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={form.plate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        plate: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="RAC 123 A"
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-mono font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-text-muted block mb-1">
                    Price (RWF)
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="3500"
                    className="w-full px-3 py-2.5 bg-surface-secondary border border-border rounded-xl text-[13px] text-text-primary font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[12px] font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full mt-2 bg-primary text-white font-bold py-3.5 rounded-2xl shadow-sm hover:bg-primary/95 active:scale-[0.99] transition-all text-[14px] flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  "Creating..."
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Create Departure
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgencySchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-text-muted">
          Loading schedule...
        </div>
      }
    >
      <AgencyScheduleContent />
    </Suspense>
  );
}
