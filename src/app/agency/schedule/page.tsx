"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Plus,
  X,
  MapPin,
  Bus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { fetchTripsByDate, createTrip, updateTripStatus } from "@/lib/api";
import type { Trip } from "@/lib/types";

// Virunga Express Terminal MoMo Merchant Codes
const VIRUNGA_MOMO_CODES = [
  { terminal: "Main / Central", code: "102030", ussd: "*182*8*1*102030#" },
  { terminal: "Kigali Nyabugogo", code: "102031", ussd: "*182*8*1*102031#" },
  { terminal: "Musanze Terminal", code: "102032", ussd: "*182*8*1*102032#" },
  { terminal: "Rubavu Terminal", code: "102033", ussd: "*182*8*1*102033#" },
];

// Helper to normalize route key (bidirectional route lookup)
const getRouteKey = (from: string, to: string) => {
  if (!from || !to) return "";
  const sorted = [from.trim().toLowerCase(), to.trim().toLowerCase()].sort();
  return sorted.join("<->");
};

// Default initial route estimations (Duration in minutes, Price in RWF)
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

// Calculate arrival time string given departure time (HH:mm) and duration in minutes
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

// Calculate duration in minutes between two HH:mm time strings
const calculateDurationMinutes = (timeFrom: string, timeTo: string): number => {
  if (!timeFrom || !timeTo || !timeFrom.includes(":") || !timeTo.includes(":"))
    return 0;
  const [h1, m1] = timeFrom.split(":").map(Number);
  const [h2, m2] = timeTo.split(":").map(Number);
  let totalMin1 = h1 * 60 + m1;
  let totalMin2 = h2 * 60 + m2;
  // Handle midnight crossover
  if (totalMin2 < totalMin1) {
    totalMin2 += 24 * 60;
  }
  return totalMin2 - totalMin1;
};

export default function AgencySchedulePage() {
  const router = useRouter();
  const { userRole } = useApp();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMoMoModal, setShowMoMoModal] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Scheduling Form State with flexible dynamic inputs
  const [form, setForm] = useState({
    routeFrom: "",
    routeTo: "",
    date: today,
    time: "08:00",
    arrivalTime: "10:30",
    plate: "",
    busType: "coaster" as "coaster" | "coach",
    totalSeats: "29",
    price: "3500",
  });

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const data = await fetchTripsByDate(todayStr);
    setTrips(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (userRole !== "agent") {
      router.push("/agency/login");
    }
  }, [userRole, router]);

  // Route Auto-lookup logic for duration and price
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
          // ignore parse error
        }
      }
    }
    if (routeInfo) {
      setForm((prev) => {
        let updatedPrice = prev.price;
        let updatedArrival = prev.arrivalTime;
        if (routeInfo.price && prev.price === "") {
          updatedPrice = String(routeInfo.price);
        }
        if (routeInfo.durationMinutes && prev.time) {
          const autoArrival = addMinutesToTime(
            prev.time,
            routeInfo.durationMinutes,
          );
          if (autoArrival) {
            updatedArrival = autoArrival;
          }
        }
        if (
          updatedPrice === prev.price &&
          updatedArrival === prev.arrivalTime
        ) {
          return prev;
        }
        return { ...prev, price: updatedPrice, arrivalTime: updatedArrival };
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

    // Calculate duration & persist to route meta memory for smart future auto-fills
    const calculatedDuration = calculateDurationMinutes(
      form.time,
      form.arrivalTime,
    );

    if (calculatedDuration > 0) {
      const rKey = getRouteKey(form.routeFrom, form.routeTo);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `route_meta_${rKey}`,
          JSON.stringify({
            durationMinutes: calculatedDuration,
            price: priceNum,
          }),
        );
      }
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
      setForm({
        routeFrom: "",
        routeTo: "",
        date: today,
        time: "08:00",
        arrivalTime: "10:30",
        plate: "",
        busType: "coaster",
        totalSeats: "29",
        price: "3500",
      });
      await loadTrips();
    } else {
      setError(
        "Failed to create departure. Account may not be linked to an operator. Please check agent credentials.",
      );
    }
  };

  const handleMarkDelayed = async (tripId: string) => {
    await updateTripStatus(tripId, "delayed");
    await loadTrips();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "arrived":
        return "bg-green-100 text-green-700 border-green-200";
      case "in-progress":
      case "departed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "boarding":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "delayed":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "scheduled":
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-[100px]">
      {/* Header */}
      <div className="bg-primary pt-[50px] px-5 pb-6 rounded-b-[28px] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push("/agency")}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => setShowMoMoModal(true)}
            className="bg-amber-400 text-slate-900 px-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Info size={14} /> MoMo Codes
          </button>
        </div>
        <h1 className="text-[24px] font-extrabold text-white">
          Schedule Engine
        </h1>
        <p className="text-[13px] text-white/80">
          Smart route dispatching &amp; departure management
        </p>
      </div>

      <div className="px-4 mt-5">
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold shadow-md hover:bg-primary/95 transition-all mb-5"
        >
          <Plus size={20} />
          Add New Departure
        </button>

        {/* Departure List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-[13px]">
            Loading today&apos;s scheduled departures...
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
            <Bus className="mx-auto text-slate-300 mb-2" size={36} />
            <p className="text-[14px] font-semibold text-slate-700">
              No departures scheduled
            </p>
            <p className="text-[12px] text-slate-400 mt-1">
              Tap &quot;Add New Departure&quot; to dispatch a bus on a route.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-extrabold text-slate-800">
                      {trip.from} → {trip.to}
                    </span>
                    {trip.busType && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {trip.busType}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusColor(
                      trip.status || "scheduled",
                    )}`}
                  >
                    {trip.status || "scheduled"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[13px] text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-primary" />
                    <span>
                      {trip.departureTime}
                      {trip.arrivalTime ? ` - ${trip.arrivalTime}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bus size={14} className="text-slate-400" />
                    <span className="font-mono font-bold text-slate-700">
                      {trip.plateNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      Seats:
                    </span>
                    <span>{trip.totalSeats} capacity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      Price:
                    </span>
                    <span className="font-semibold text-emerald-600">
                      {trip.price
                        ? `${trip.price.toLocaleString()} RWF`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {trip.status !== "delayed" &&
                  trip.status !== "departed" &&
                  trip.status !== "arrived" && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleMarkDelayed(trip.id)}
                        className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors"
                      >
                        Mark as Delayed
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Departure Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl border-t border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-[18px] font-extrabold text-slate-800">
                  New Departure
                </h2>
                <p className="text-[12px] text-slate-500">
                  Smart route auto-calculation &amp; dispatch
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Route Input */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    From
                  </label>
                  <input
                    type="text"
                    value={form.routeFrom}
                    onChange={(e) =>
                      setForm({ ...form, routeFrom: e.target.value })
                    }
                    placeholder="e.g. Kigali"
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    To
                  </label>
                  <input
                    type="text"
                    value={form.routeTo}
                    onChange={(e) =>
                      setForm({ ...form, routeTo: e.target.value })
                    }
                    placeholder="e.g. Musanze"
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              {/* Date & Departure Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    Travel Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    Departure Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              {/* Estimated Arrival Time */}
              <div>
                <label className="text-[12px] font-bold text-slate-600">
                  Arrival Time (Est.)
                </label>
                <input
                  type="time"
                  value={form.arrivalTime}
                  onChange={(e) =>
                    setForm({ ...form, arrivalTime: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>

              {/* Bus Type & Total Seats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    Bus Category
                  </label>
                  <div className="grid grid-cols-2 gap-1 mt-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleBusTypeChange("coaster")}
                      className={`py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        form.busType === "coaster"
                          ? "bg-white text-primary shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Coaster
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBusTypeChange("coach")}
                      className={`py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        form.busType === "coach"
                          ? "bg-white text-primary shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Coach
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    Total Seats
                  </label>
                  <input
                    type="number"
                    value={form.totalSeats}
                    onChange={(e) =>
                      setForm({ ...form, totalSeats: e.target.value })
                    }
                    placeholder="29"
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              {/* Vehicle Plate & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-bold text-slate-600">
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
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-bold text-slate-600">
                    Price (RWF)
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    placeholder="3500"
                    className="w-full mt-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
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
                className="w-full mt-2 bg-primary text-white font-bold py-3.5 rounded-2xl shadow-md hover:bg-primary/95 active:scale-[0.99] transition-all text-[14px] flex items-center justify-center gap-2"
              >
                {saving ? (
                  "Dispatching..."
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Confirm &amp; Dispatch Departure
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MoMo Merchant Codes Modal */}
      {showMoMoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-[14px]">
                  💳
                </div>
                <h3 className="text-[16px] font-extrabold text-slate-800">
                  MoMo Merchant Codes
                </h3>
              </div>
              <button
                onClick={() => setShowMoMoModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[12px] text-slate-500 mb-3">
              Official station merchant codes for ticket collection payment
            </p>

            <div className="space-y-2 mb-4">
              {VIRUNGA_MOMO_CODES.map((momo, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[12px] font-bold text-slate-800">
                      {momo.terminal}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {momo.ussd}
                    </p>
                  </div>
                  <span className="text-[14px] font-black font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                    {momo.code}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowMoMoModal(false)}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-[13px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
