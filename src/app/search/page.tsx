"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
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
        // Call Supabase RPC function (Hides buses departing within 10 minutes)
        const { data: dbTrips, error } = await supabase.rpc(
          "get_available_trips",
          {
            search_origin: search.from,
            search_destination: search.to,
          },
        );

        if (cancelled) return;

        if (!error && dbTrips && dbTrips.length > 0) {
          setTrips(dbTrips);
        } else {
          // Fallback static data filtered client-side for 10-minute departure limit
          const now = new Date();
          const tenMinsFromNow = new Date(now.getTime() + 10 * 60 * 1000);
          const staticTrips = getTripsForRoute(
            search.from,
            search.to,
            search.date,
          ).filter((trip) => {
            if (!trip.departureTime) return true;
            const [hours, minutes] = trip.departureTime.split(":").map(Number);
            const tripDate = new Date();
            tripDate.setHours(hours, minutes, 0, 0);
            return tripDate > tenMinsFromNow;
          });
          setTrips(staticTrips);
        }
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
      if (activeFilter === "ac") return trip.amenities?.includes("❄️");
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
        bg: "bg-badge-red-bg",
        text: "text-badge-red-text",
        label: `${available} left!`,
      };
    if (available <= 5)
      return {
        bg: "bg-badge-amber-bg",
        text: "text-badge-amber-text",
        label: `${available} left`,
      };
    return {
      bg: "bg-badge-green-bg",
      text: "text-badge-green-text",
      label: `${available} seats`,
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

      {/* Filters */}
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
                : "Bus Operator");
            const operatorGradient = operatorObj?.gradient;

            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl border border-border p-4 shadow-card active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-primary/10"
                    style={
                      operatorGradient
                        ? { background: operatorGradient }
                        : undefined
                    }
                  >
                    {operatorEmoji}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-bold text-text-primary">
                      {operatorName}
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                    <span className={`text-[11px] font-bold ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[28px] font-black text-text-primary leading-none">
                      {trip.departureTime}
                    </div>
                    <div className="text-[11px] text-text-muted mt-1 truncate">
                      {trip.terminalFrom}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[12px] text-primary font-medium">
                      {trip.duration}
                    </span>
                    <div className="w-14 h-[2px] bg-primary/20 relative rounded-full">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[28px] font-black text-text-primary leading-none">
                      {trip.arrivalTime}
                    </div>
                    <div className="text-[11px] text-text-muted mt-1 truncate">
                      {trip.terminalTo}
                    </div>
                  </div>
                </div>

                {trip.amenities && trip.amenities.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {trip.amenities.map((a, j) => (
                      <div
                        key={j}
                        className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-[14px]"
                      >
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-[11px] text-text-muted">
                      {t("perSeat", language)}
                    </div>
                    <div className="text-[20px] font-bold text-primary">
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
