"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import { ChevronRight, MapPin, Clock, Bus } from "lucide-react";
import { fetchAllBookings, fetchBookingsByUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/types";

const tabs = ["Upcoming", "Past"] as const;
type Tab = (typeof tabs)[number];

const tabKeys: Record<Tab, "upcoming" | "past"> = {
  Upcoming: "upcoming",
  Past: "past",
};

export default function TicketsPage() {
  const router = useRouter();
  const { language } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("Upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      let loadedBookings: Booking[] = [];

      try {
        // 1. Fetch from Supabase if logged in
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          loadedBookings = await fetchBookingsByUser(user.id);
        }

        // 2. Fetch all public/guest DB bookings if empty
        if (loadedBookings.length === 0) {
          loadedBookings = await fetchAllBookings();
        }

        // 3. Fallback / Merge from Local Storage
        const localGuest = localStorage.getItem("guest_bookings");
        if (localGuest) {
          try {
            const parsed = JSON.parse(localGuest);
            const existing = new Set(loadedBookings.map((b) => b.id));
            parsed.forEach((b: Booking) => {
              if (!existing.has(b.id)) loadedBookings.push(b);
            });
          } catch (e) {
            console.error("Failed to parse guest_bookings", e);
          }
        }

        const latestBooking = localStorage.getItem("latest_booking");
        if (latestBooking) {
          try {
            const parsed = JSON.parse(latestBooking);
            if (!loadedBookings.some((b) => b.id === parsed.id)) {
              loadedBookings.unshift(parsed);
            }
          } catch (e) {
            console.error("Failed to parse latest_booking", e);
          }
        }
      } catch (err) {
        console.error("Error loading bookings:", err);
      } finally {
        setBookings(loadedBookings);
        setLoading(false);
      }
    }

    loadBookings();
  }, []);

  // Date/Time helper to check if trip departure has passed
  const isTripPast = (booking: Booking) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const travelDate = booking.trip?.date || booking.bookingDate || todayStr;

    if (travelDate < todayStr) return true;
    if (travelDate > todayStr) return false;

    // Same day: check departure time (e.g. "14:30")
    if (booking.trip?.departureTime) {
      const now = new Date();
      const [hours, minutes] = booking.trip.departureTime
        .split(":")
        .map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const departure = new Date();
        departure.setHours(hours, minutes, 0, 0);
        return now > departure;
      }
    }
    return false;
  };

  const filtered = bookings.filter((b) => {
    const hasPassed = isTripPast(b);

    if (activeTab === "Upcoming") {
      // Pending and confirmed tickets stay in Upcoming until departure time arrives
      return (
        !hasPassed &&
        b.status !== "rejected" &&
        b.status !== "cancelled" &&
        b.status !== "past"
      );
    }

    if (activeTab === "Past") {
      // Past tab holds departed trips, rejected, and cancelled tickets
      return (
        hasPassed ||
        b.status === "rejected" ||
        b.status === "cancelled" ||
        b.status === "past" ||
        b.status === "boarded"
      );
    }

    return true;
  });

  const handleTicketClick = (bookingId: string) => {
    router.push(`/ticket/${bookingId}`);
  };

  return (
    <div className="bg-white pb-[100px]">
      {/* Title Header */}
      <div className="bg-primary pt-[60px] px-5 pb-7 rounded-b-[28px]">
        <h1 className="text-[28px] font-extrabold text-white">
          {t("myTickets", language)}
        </h1>
        <p className="text-[13px] text-white/70 mt-0.5">
          {t("manageTickets", language)}
        </p>
      </div>

      {/* 2 Tabs: Upcoming & Past */}
      <div className="px-5 -mt-4 mb-4 relative z-10">
        <div className="relative flex bg-white rounded-xl p-1 border border-border">
          <motion.div
            layoutId="ticket-tab"
            className="absolute top-1 bottom-1 bg-primary rounded-lg"
            style={{
              width: `${100 / tabs.length}%`,
              left: `${(tabs.indexOf(activeTab) * 100) / tabs.length}%`,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[13px] font-semibold relative z-10 transition-colors ${
                activeTab === tab ? "text-white" : "text-text-muted"
              }`}
            >
              {t(tabKeys[tab], language)}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <div className="px-5 space-y-3">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-[14px] text-text-muted">
                Loading tickets...
              </div>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-5xl mb-4">🎫</div>
              <p className="text-[14px] text-text-muted text-center">
                {activeTab === "Upcoming"
                  ? t("noUpcoming", language)
                  : t("noPast", language)}
              </p>
            </motion.div>
          ) : (
            filtered.map((booking, i) => (
              <motion.button
                key={booking.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => handleTicketClick(booking.id)}
                className="w-full text-left bg-white rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[18px] font-bold text-text-primary">
                    {booking.trip?.from || "Origin"} →{" "}
                    {booking.trip?.to || "Destination"}
                  </div>

                  {/* Status Badges on the Top Right */}
                  <div className="flex items-center gap-1.5">
                    {booking.status === "pending" && (
                      <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                        Processing ⏳
                      </span>
                    )}
                    {booking.status === "confirmed" && (
                      <span className="bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Confirmed ✓
                      </span>
                    )}
                    {booking.status === "rejected" && (
                      <span className="bg-rose-100 text-rose-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                        Rejected ✕
                      </span>
                    )}
                    <ChevronRight size={20} className="text-text-muted" />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[13px] text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />{" "}
                    {booking.trip?.date || booking.bookingDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {booking.trip?.departureTime || "--:--"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bus size={12} />{" "}
                    {booking.trip?.operator?.name || "Virunga Express"}
                  </span>
                  <span>💺 {booking.seat}</span>
                </div>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
