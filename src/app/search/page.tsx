"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Bus, MapPin, Users } from "lucide-react";
import { useApp } from "@/context/app-context";
import { getTripsForRoute, formatPrice } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Trip } from "@/lib/types";
import { t } from "@/lib/translations";
import { format } from "date-fns";

type FilterKey = "all" | "earliest" | "cheapest" | "ac" | "wifi";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "earliest", label: "Earliest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "ac", label: "⚡ AC" },
  { key: "wifi", label: "📶 WiFi" },
];

const cleanStationName = (name: string) =>
  name
    .toLowerCase()
    .replace(/branch|station/g, "")
    .trim();

const isDepartureTimeValid = (tripDate?: string, departureTime?: string) => {
  if (!departureTime) return true;

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  if (tripDate && tripDate > todayStr) return true;
  if (tripDate && tripDate < todayStr) return false;

  const [depHours, depMins] = departureTime.split(":").map(Number);
  if (isNaN(depHours) || isNaN(depMins)) return true;

  const currentHours = now.getHours();
  const currentMins = now.getMinutes();

  if (depHours > currentHours) return true;
  if (depHours === currentHours && depMins > currentMins) return true;

  return false;
};

export default function SearchPage() {
  const router = useRouter();
  const { search, setSelectedTrip, language } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!search?.from || !search?.to) return;
    let cancelled = false;
    setLoading(true);

    async function loadFilteredTrips() {
      try {
        const searchFromClean = cleanStationName(search.from);
        const searchToClean = cleanStationName(search.to);

        const { data: rawDbTrips, error: dbError } = await supabase
          .from("trips")
          .select("*");

        if (!cancelled && !dbError && rawDbTrips && rawDbTrips.length > 0) {
          const matchedDbTrips = rawDbTrips.filter((t: any) => {
            const dbFrom = cleanStationName(t.from || "");
            const dbTo = cleanStationName(t.to || "");
            const dbDate = t.travel_date || t.travelDate || t.date;
            const depTime = t.departure_time || t.departureTime;

            // Strict exact match check to prevent cross-branch mixing (e.g. Kigali->Huye vs Musanze->Kigali)
            const matchesRoute =
              dbFrom === searchFromClean && dbTo === searchToClean;

            const matchesDate =
              !search.date || !dbDate || dbDate === search.date;
            const isUpcoming = isDepartureTimeValid(
              dbDate || search.date,
              depTime,
            );

            return matchesRoute && matchesDate && isUpcoming;
          });

          if (matchedDbTrips.length > 0) {
            setTrips(
              matchedDbTrips.map((t: any) => ({
                id: t.id,
                from: t.from,
                to: t.to,
                departureTime: t.departure_time || t.departureTime,
                arrivalTime: t.arrival_time || t.arrivalTime,
                price: t.price,
                availableSeats: t.available_seats ?? t.total_seats ?? 29,
                totalSeats: t.total_seats ?? 29,
                plateNumber: t.plate_number || t.plateNumber,
                operator: t.operator || "Virunga Express",
                amenities: t.amenities || ["⚡", "📶"],
                duration: t.duration || "2h 30m",
                terminalFrom: t.from,
                terminalTo: t.to,
                busType: t.bus_type || t.busType,
              })),
            );
            setLoading(false);
            return;
          }
        }

        const staticTrips = getTripsForRoute(
          search.from,
          search.to,
          search.date,
        ).filter((trip) =>
          isDepartureTimeValid(search.date, trip.departureTime),
        );

        setTrips(staticTrips);
      } catch (err) {
        console.error("Failed to load available trips:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFilteredTrips();

    return () => {
      cancelled = true;
    };
  }, [search?.from, search?.to, search?.date]);

  if (!search?.from || !search?.to) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-[20px] font-bold text-text-primary mb-2">
          {t("noRoute", language)}
        </h2>
        <p className="text-[14px] text-text-muted text-center mb-6">
          {t("goBackHome", language)}
        </p>
        <button
          onClick={() => router.push("/home")}
          className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px]"
        >
          {t("backToHome", language)}
        </button>
      </div>
    );
  }

  const filteredTrips = trips
    .filter((trip) => {
      if (activeFilter === "ac")
        return trip.amenities?.includes("⚡") || trip.amenities?.includes("❄️");
      if (activeFilter === "wifi") return trip.amenities?.includes("📶");
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === "earliest")
        return (a.departureTime || "").localeCompare(b.departureTime || "");
      if (activeFilter === "cheapest") return (a.price ?? 0) - (b.price ?? 0);
      return 0;
    });

  const handleSelect = (trip: Trip) => {
    setSelectedTrip(trip);
    router.push(`/seats/${trip.id}`);
  };

  const getSeatBadge = (available: number = 0) => {
    if (available <= 2)
      return {
        bg: "bg-red-100 border border-red-200",
        text: "text-red-700",
        label: `${available} seats left!`,
      };
    if (available <= 5)
      return {
        bg: "bg-amber-100 border border-amber-200",
        text: "text-amber-800",
        label: `${available} seats left`,
      };
    return {
      bg: "bg-emerald-100 border border-emerald-200",
      text: "text-emerald-800",
      label: `${available} seats available`,
    };
  };

  return (
    <div className="bg-surface-secondary pb-[100px] min-h-full">
      <div className="bg-primary pt-[56px] px-5 pb-5 rounded-b-[28px] relative overflow-hidden">
        <div className="absolute -top-16 -right-12 w-44 h-44 rounded-full bg-white/8" />
        <div className="relative flex items-center gap-3">
          <button
            onClick={() => router.push("/home")}
            className="p-1 -ml-1 active:scale-90 transition-transform"
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold text-white truncate">
              {search.from} → {search.to}
            </h1>
            <p className="text-[13px] text-white/70">
              {search.date ? format(new Date(search.date), "MMM dd") : ""} ·{" "}
              {search.passengers || 1} passenger
              {(search.passengers || 1) > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div
        className="flex gap-2 px-5 py-3 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
              activeFilter === f.key
                ? "bg-primary text-white shadow-primary"
                : "bg-white border border-border text-text-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-1">
        <p className="text-[14px] text-text-muted">
          <span className="font-bold text-primary">{filteredTrips.length}</span>{" "}
          {t("busesFound", language)}
        </p>
      </div>

      {loading ? (
        <div className="px-5 space-y-3 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-border p-4 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
                </div>
              </div>
              <div className="flex justify-between mb-3">
                <div className="h-8 bg-gray-200 rounded w-16" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
              <div className="h-10 bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16">
          <div className="text-4xl mb-4">🚏</div>
          <p className="text-[15px] text-text-muted text-center">
            No available trips for this route right now.
          </p>
        </div>
      ) : (
        <div className="px-5 space-y-3 mt-2">
          {filteredTrips.map((trip, i) => {
            const badge = getSeatBadge(trip.availableSeats ?? 0);
            const operatorObj =
              typeof trip.operator === "object" && trip.operator !== null
                ? trip.operator
                : null;
            const operatorEmoji = operatorObj?.emoji || "🚌";
            const operatorName =
              operatorObj?.name ||
              (typeof trip.operator === "string"
                ? trip.operator
                : "Virunga Express");
            const operatorGradient = operatorObj?.gradient;

            const fromStation = trip.terminalFrom || trip.from || search.from;
            const toStation = trip.terminalTo || trip.to || search.to;

            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-border p-4 shadow-card active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-primary/10"
                      style={
                        operatorGradient
                          ? { background: operatorGradient }
                          : undefined
                      }
                    >
                      {operatorEmoji}
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-text-primary leading-tight">
                        {operatorName}
                      </div>
                      {trip.plateNumber && (
                        <span className="text-[11px] text-text-muted bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {trip.plateNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${badge.bg}`}
                  >
                    <Users size={12} className={badge.text} />
                    <span className={`text-[11px] font-bold ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase font-bold text-primary tracking-wider mb-0.5">
                      Departs
                    </div>
                    <div className="text-[26px] font-black text-text-primary leading-none">
                      {trip.departureTime}
                    </div>
                    <div className="flex items-center gap-1 text-[12px] font-semibold text-text-secondary mt-1 truncate">
                      <MapPin
                        size={12}
                        className="text-primary flex-shrink-0"
                      />
                      <span className="truncate">{fromStation}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
                    <span className="text-[11px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                      {trip.duration || "2h 30m"}
                    </span>
                    <div className="w-12 h-[2px] bg-primary/30 relative rounded-full my-1">
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                      <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-0.5">
                      Arrives
                    </div>
                    <div className="text-[26px] font-black text-text-primary leading-none">
                      {trip.arrivalTime}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[12px] font-semibold text-text-secondary mt-1 truncate">
                      <span className="truncate">{toStation}</span>
                      <MapPin
                        size={12}
                        className="text-text-muted flex-shrink-0"
                      />
                    </div>
                  </div>
                </div>

                {trip.amenities && trip.amenities.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {trip.amenities.map((a, j) => (
                      <div
                        key={j}
                        className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[12px] text-text-muted flex items-center gap-1"
                      >
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-dashed border-gray-200">
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("perSeat", language)}
                    </div>
                    <div className="text-[20px] font-extrabold text-primary">
                      {formatPrice(trip.price ?? 0)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelect(trip)}
                    className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] active:scale-[0.97] transition-transform shadow-primary"
                  >
                    {t("select", language)}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
