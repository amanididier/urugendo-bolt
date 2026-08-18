"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Bell,
  ArrowRightLeft,
  MapPin,
  Clock,
  Zap,
  Navigation,
  Search,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { popularRoutes, formatPrice } from "@/lib/data";
import { fetchTrips } from "@/lib/api";
import { t } from "@/lib/translations";
import type { Trip } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const {
    search,
    setSearch,
    setCityPickerOpen,
    setCityPickerField,
    setSelectedTrip,
    language,
  } = useApp();

  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [liveTrips, setLiveTrips] = useState<Trip[]>([]);

  const liveRoutes = popularRoutes.slice(0, 3);

  // Load real dynamic trips from database on mount or search date change
  useEffect(() => {
    async function loadLiveTrips() {
      const data = await fetchTrips(search.from, search.to, search.date);
      setLiveTrips(data);
    }
    loadLiveTrips();
  }, [search.from, search.to, search.date]);

  const openCityPicker = (field: "from" | "to") => {
    setCityPickerField(field);
    setCityPickerOpen(true);
  };

  const swapCities = () => {
    setSearch({ from: search.to, to: search.from });
  };

  const handleSearch = () => {
    if (search.from && search.to) {
      router.push("/search");
    }
  };

  const handleRouteClick = (route: (typeof popularRoutes)[0]) => {
    setSearch({ from: route.from, to: route.to });
    router.push("/search");
  };

  const handleLiveDeparture = (trip: Trip) => {
    setSelectedTrip(trip);
    router.push(`/seats/${trip.id}`);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setCurrentLocation("Nyabugogo, Kigali");
        setSearch({ from: "Kigali", to: search.to });
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
    );
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setCurrentLocation("Kigali Area"),
        () => {},
      );
    }
  }, []);

  return (
    <div className="bg-surface-secondary pb-[100px]">
      {/* Header */}
      <div className="bg-primary pt-[56px] px-5 pb-7 rounded-b-[32px] relative overflow-hidden">
        <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-white/8" />
        <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative flex items-center justify-between mb-5">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-full bg-white/15 p-0.5 ring-1 ring-white/20">
              <Image
                src="https://assets.kiloapps.io/user_465c60a0-3d95-4712-ac67-4db616199442/5acef383-25d7-4044-8ec7-b13e367e211c/e80493e1-eb86-4e45-bc74-de15449a3015.jpg"
                alt="Urugendo"
                width={34}
                height={34}
                className="rounded-full"
              />
            </div>
            <h1 className="text-[22px] font-extrabold text-white tracking-tight">
              Urugendo<span className="text-accent">.</span>
            </h1>
          </motion.div>
          <button className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center relative ring-1 ring-white/20 active:scale-90 transition-transform">
            <Bell size={20} className="text-white" />
            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-primary" />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-[14px] text-white/70 mb-0.5">
            {t("greeting", language)}
          </p>
          <h2 className="text-[28px] font-extrabold text-white tracking-tight">
            {t("whereTo", language)}
          </h2>
        </motion.div>
      </div>

      {/* Search Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-4 -mt-5 bg-white rounded-[24px] p-4 mb-5 relative z-10 border border-border shadow-card-lg"
      >
        <button
          onClick={() => openCityPicker("from")}
          className="w-full flex items-center gap-3 py-2.5 active:opacity-60 transition-opacity"
        >
          <div className="w-3.5 h-3.5 rounded-full bg-primary flex-shrink-0 ring-2 ring-primary/15" />
          <span
            className={`text-[15px] ${
              search.from
                ? "text-text-primary font-semibold"
                : "text-text-muted"
            }`}
          >
            {search.from || t("fromPlaceholder", language)}
          </span>
        </button>

        <div className="border-t border-dashed border-border relative">
          <button
            onClick={swapCities}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center z-10 active:scale-90 active:rotate-180 transition-all shadow-primary"
          >
            <ArrowRightLeft size={14} />
          </button>
        </div>

        <button
          onClick={() => openCityPicker("to")}
          className="w-full flex items-center gap-3 py-2.5 active:opacity-60 transition-opacity"
        >
          <div className="w-3.5 h-3.5 rounded-full bg-accent flex-shrink-0 ring-2 ring-accent/15" />
          <span
            className={`text-[15px] ${
              search.to ? "text-text-primary font-semibold" : "text-text-muted"
            }`}
          >
            {search.to || t("toPlaceholder", language)}
          </span>
        </button>

        <div className="border-t border-dashed border-border" />
        <button
          onClick={useMyLocation}
          disabled={locationLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-primary text-[13px] font-medium active:opacity-60 transition-opacity"
        >
          {locationLoading ? (
            <span>Getting location...</span>
          ) : currentLocation ? (
            <>
              <Navigation size={14} />
              <span>Book from my location ({currentLocation})</span>
            </>
          ) : (
            <>
              <Navigation size={14} />
              <span>Use my current location</span>
            </>
          )}
        </button>

        <div className="border-t border-border" />

        <div className="flex items-center gap-3 py-2.5">
          <div className="flex-1 flex items-center gap-2 bg-surface-secondary rounded-xl px-3 py-2.5">
            <Clock size={16} className="text-primary" />
            <span className="text-[14px] text-text-secondary font-medium">
              {format(
                new Date(search.date || new Date().toISOString()),
                "MMM dd, yyyy",
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                setSearch({ passengers: Math.max(1, search.passengers - 1) })
              }
              className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-primary text-[18px] font-bold active:scale-90 active:bg-primary-light transition-all"
            >
              −
            </button>
            <span className="text-[15px] font-bold text-text-primary w-5 text-center">
              {search.passengers}
            </span>
            <button
              onClick={() =>
                setSearch({ passengers: Math.min(10, search.passengers + 1) })
              }
              className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-primary text-[18px] font-bold active:scale-90 active:bg-primary-light transition-all"
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={!search.from || !search.to}
          className={`w-full h-12 rounded-2xl font-bold text-white text-[15px] mt-1 flex items-center justify-center gap-2 transition-all ${
            search.from && search.to
              ? "bg-primary shadow-primary active:scale-[0.97]"
              : "bg-primary/25 text-primary/50"
          }`}
        >
          <Search size={16} />
          {t("searchBuses", language)}
        </button>
      </motion.div>

      {/* Quick Info Strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 px-4 mb-6"
      >
        {[
          {
            icon: <MapPin size={14} />,
            label: t("cities", language),
            bg: "bg-primary-light",
            color: "text-primary",
          },
          {
            icon: <Zap size={14} />,
            label: t("operators", language),
            bg: "bg-amber-50",
            color: "text-accent",
          },
          {
            icon: <Clock size={14} />,
            label: "24/7",
            bg: "bg-blue-50",
            color: "text-blue-600",
          },
        ].map((item, i) => (
          <div
            key={i}
            className={`flex-1 flex items-center justify-center gap-1.5 ${item.bg} rounded-xl py-2.5`}
          >
            <span className={item.color}>{item.icon}</span>
            <span className={`text-[12px] font-bold ${item.color}`}>
              {item.label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Popular Routes */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between px-5 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-primary" />
            <h3 className="text-[17px] font-bold text-text-primary">
              {t("popularRoutes", language)}
            </h3>
          </div>
          <button className="text-[13px] text-primary font-semibold">
            {t("seeAll", language)}
          </button>
        </div>
        <div
          className="flex gap-3 px-5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {popularRoutes.map((route, i) => (
            <motion.button
              key={route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              onClick={() =>
                route.status === "coming_soon"
                  ? router.push("/waitlist")
                  : handleRouteClick(route)
              }
              disabled={route.status === "coming_soon"}
              className={`flex-shrink-0 rounded-2xl border p-4 min-w-[160px] active:scale-[0.97] transition-transform text-left ${
                route.status === "coming_soon"
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-white border-border shadow-card hover:shadow-card-lg transition-shadow"
              }`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    route.status === "coming_soon"
                      ? "bg-gray-200"
                      : "bg-primary-light"
                  }`}
                >
                  <MapPin
                    size={14}
                    className={
                      route.status === "coming_soon"
                        ? "text-gray-400"
                        : "text-primary"
                    }
                  />
                </div>
                <span
                  className={`text-[13px] font-bold ${
                    route.status === "coming_soon"
                      ? "text-gray-400"
                      : "text-text-primary"
                  }`}
                >
                  {route.from} → {route.to}
                </span>
              </div>
              {route.status === "coming_soon" ? (
                <div className="text-[12px] text-gray-400 font-medium">
                  Coming Soon
                </div>
              ) : (
                <>
                  <div className="text-[20px] font-extrabold text-primary">
                    {formatPrice(route.price)}
                  </div>
                  <div className="text-[12px] text-text-muted mt-1">
                    {route.duration}
                  </div>
                </>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Live Departures */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="px-4 mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <h3 className="text-[17px] font-bold text-text-primary">
            {t("liveDepartures", language)}
          </h3>
          <div className="flex items-center gap-1 bg-badge-green-bg px-2 py-0.5 rounded-full">
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-badge-green-text"
            />
            <span className="text-[11px] font-bold text-badge-green-text">
              {t("live", language)}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {liveTrips.length > 0
            ? liveTrips.slice(0, 4).map((trip, i) => (
                <motion.button
                  key={trip.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  onClick={() => handleLiveDeparture(trip)}
                  className="w-full bg-white rounded-2xl border border-border p-3.5 flex items-center gap-3 active:scale-[0.98] active:bg-primary-light transition-all shadow-card text-left"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background:
                        trip.operator.gradient ||
                        "linear-gradient(135deg, #FF6B1A, #FF8800)",
                    }}
                  >
                    {trip.operator.emoji || trip.operator.logo || "🚌"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-text-primary">
                      {trip.from} → {trip.to}
                    </div>
                    <div className="text-[12px] text-text-muted mt-0.5">
                      <span className="text-primary font-semibold">
                        {trip.operator.name}
                      </span>
                      <span className="mx-1.5">·</span>
                      <span>{trip.departureTime}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-extrabold text-primary">
                      {formatPrice(trip.price)}
                    </div>
                    <div className="text-[11px] text-badge-green-text font-medium">
                      {trip.availableSeats} {t("seats", language)}
                    </div>
                  </div>
                </motion.button>
              ))
            : liveRoutes.map((route, i) => (
                <div
                  key={route.id}
                  onClick={() => handleRouteClick(route)}
                  className="w-full bg-white rounded-2xl border border-border p-3.5 flex items-center justify-between shadow-card cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center text-xl">
                      🚌
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-text-primary">
                        {route.from} → {route.to}
                      </div>
                      <div className="text-[12px] text-text-muted">
                        {route.duration}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-extrabold text-primary">
                      {formatPrice(route.price)}
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </motion.div>

      <div className="text-center pb-4">
        <p className="text-[11px] text-text-muted font-medium">
          {t("madeWith", language)}
        </p>
      </div>
    </div>
  );
}
