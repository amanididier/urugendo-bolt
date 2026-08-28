"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  Clock,
  Bus,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
} from "lucide-react";
import { fetchAllBookings, fetchBookingsByUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/types";
import { addUserNotification } from "@/lib/notifications";

const tabs = ["Upcoming", "Past"] as const;
type Tab = (typeof tabs)[number];

const tabKeys: Record<Tab, "upcoming" | "past"> = {
  Upcoming: "upcoming",
  Past: "past",
};

export default function TicketsPage() {
  const router = useRouter();
  const { language, userName } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("Upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // UI Toggles for collapsible sections
  const [showOtherUpcoming, setShowOtherUpcoming] = useState(true);
  const [showOlderPast, setShowOlderPast] = useState(false);

  // Selection state for deletion in Past tab
  const [isSelectingMode, setIsSelectingMode] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      let loadedBookings: Booking[] = [];

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          loadedBookings = await fetchBookingsByUser(user.id);
        }

        if (loadedBookings.length === 0) {
          loadedBookings = await fetchAllBookings();
        }

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

        const deletedIds = JSON.parse(
          localStorage.getItem("deleted_ticket_ids") || "[]",
        );
        loadedBookings = loadedBookings.filter(
          (b) => !deletedIds.includes(b.id),
        );
      } catch (err) {
        console.error("Error loading bookings:", err);
      } finally {
        setBookings(loadedBookings);
        setLoading(false);

        // Check for completed trips and trigger referral notification
        loadedBookings.forEach((booking, index) => {
          const todayStr = new Date().toISOString().split("T")[0];
          const travelDate =
            booking.trip?.date || booking.bookingDate || todayStr;
          let isPassed = travelDate < todayStr;

          if (travelDate === todayStr && booking.trip?.departureTime) {
            const now = new Date();
            const [hours, minutes] = booking.trip.departureTime
              .split(":")
              .map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              const departure = new Date();
              departure.setHours(hours, minutes + 90, 0, 0);
              if (now > departure) isPassed = true;
            }
          }

          if (
            isPassed ||
            booking.status === "used" ||
            booking.status === "past"
          ) {
            const notifKey = `urugendo_completed_referral_${booking.id}`;
            if (!localStorage.getItem(notifKey)) {
              localStorage.setItem(notifKey, "true");
              const shareLink = `${window.location.origin}/?ref=urugendo_${booking.id}`;

              const isFirstTrip = index === loadedBookings.length - 1;
              const msg =
                language === "RW"
                  ? isFirstTrip
                    ? `✨ Wanyuzwe n'urugendo? Gutangira gukoresha Urugendo ni intangiriro nziza! Sangiza urugendo rwiza n'inshuti zawe n'abavandimwe ukoresha ubutumire bwawe bwite: ${shareLink}`
                    : `🌟 Aho wari ugiye wahageze neza! Niba Urugendo rworohereje urugendo rwawe uyu munsi, sangiza urukundo n'inshuti zawe: ${shareLink}`
                  : isFirstTrip
                    ? `✨ Loved the experience? Booking your journey through Urugendo is just the beginning! Share the smooth ride with your friends and family using your personal invite link: ${shareLink}`
                    : `🌟 Another destination reached safely! If Urugendo made your travel effortless today, spread the love with your friends: ${shareLink}`;

              addUserNotification({
                title:
                  language === "RW"
                    ? isFirstTrip
                      ? "✨ Urugendo rwarangiye!"
                      : "🌟 Wageze ku ntego!"
                    : isFirstTrip
                      ? "✨ Trip Completed!"
                      : "🌟 Destination Reached!",
                message: msg,
                type: "promo",
              });
            }
          }
        });
      }
    }

    loadBookings();

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "past") {
      setActiveTab("Past");
    }
  }, [language]);

  const handleDeleteTickets = (idsToDelete: string[]) => {
    const updated = bookings.filter((b) => !idsToDelete.includes(b.id));
    setBookings(updated);
    setSelectedTicketIds([]);
    setIsSelectingMode(false);

    try {
      const existingDeleted = JSON.parse(
        localStorage.getItem("deleted_ticket_ids") || "[]",
      );
      const newDeleted = [...new Set([...existingDeleted, ...idsToDelete])];
      localStorage.setItem("deleted_ticket_ids", JSON.stringify(newDeleted));

      const guestBookings = localStorage.getItem("guest_bookings");
      if (guestBookings) {
        const parsed: Booking[] = JSON.parse(guestBookings);
        const filteredGuest = parsed.filter((b) => !idsToDelete.includes(b.id));
        localStorage.setItem("guest_bookings", JSON.stringify(filteredGuest));
      }
    } catch (e) {
      console.error("Failed to update local storage on delete", e);
    }
  };

  const toggleSelectTicket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const isTripPast = (booking: Booking) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const travelDate = booking.trip?.date || booking.bookingDate || todayStr;

    if (travelDate < todayStr) return true;
    if (travelDate > todayStr) return false;

    if (booking.trip?.departureTime) {
      const now = new Date();
      const [hours, minutes] = booking.trip.departureTime
        .split(":")
        .map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const departure = new Date();
        departure.setHours(hours, minutes + 90, 0, 0);
        return now > departure;
      }
    }
    return false;
  };

  const currentUserName =
    userName || (language === "RW" ? "Umugenzi" : "Passenger");

  const upcomingBookings = bookings.filter((b) => {
    const hasPassed = isTripPast(b);
    const isUsedOrBoarded = b.status === "used" || b.status === "boarded";
    return (
      !hasPassed &&
      !isUsedOrBoarded &&
      b.status !== "rejected" &&
      b.status !== "cancelled" &&
      b.status !== "past"
    );
  });

  const myUpcomingBookings = upcomingBookings.filter(
    (b) =>
      !b.passengerName ||
      b.passengerName.toLowerCase() === currentUserName.toLowerCase() ||
      bookings.indexOf(b) === 0,
  );
  const otherUpcomingBookings = upcomingBookings.filter(
    (b) => !myUpcomingBookings.includes(b),
  );

  const pastBookings = bookings.filter((b) => {
    const hasPassed = isTripPast(b);
    const isUsedOrBoarded = b.status === "used" || b.status === "boarded";
    return (
      hasPassed ||
      isUsedOrBoarded ||
      b.status === "rejected" ||
      b.status === "cancelled" ||
      b.status === "past" ||
      b.status === "boarded"
    );
  });

  const sortedPast = [...pastBookings].reverse();
  const recentPast = sortedPast.slice(0, 3);
  const olderPast = sortedPast.slice(3);

  const handleTicketClick = (bookingId: string) => {
    router.push(`/ticket/${bookingId}`);
  };

  return (
    <div className="bg-slate-50/50 min-h-screen pb-[120px] font-sans">
      {/* Header */}
      <div className="bg-primary pt-[56px] px-5 pb-8 rounded-b-[32px] shadow-sm">
        <h1 className="text-[28px] font-black text-white tracking-tight">
          {t("myTickets", language)}
        </h1>
        <p className="text-[13px] text-white/80 font-medium mt-0.5">
          {t("manageTickets", language)}
        </p>
      </div>

      {/* Tabs */}
      <div className="px-5 -mt-4 mb-5 relative z-10">
        <div className="relative flex bg-white/90 backdrop-blur-md rounded-2xl p-1 border border-slate-200/80 shadow-xs">
          <motion.div
            layoutId="ticket-tab"
            className="absolute top-1 bottom-1 bg-primary rounded-xl shadow-xs"
            style={{
              width: `${100 / tabs.length}%`,
              left: `${(tabs.indexOf(activeTab) * 100) / tabs.length}%`,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          />
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === "Upcoming") {
                  setIsSelectingMode(false);
                  setSelectedTicketIds([]);
                }
              }}
              className={`flex-1 py-2.5 text-[13.5px] font-bold relative z-10 transition-colors cursor-pointer ${
                activeTab === tab
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t(tabKeys[tab], language)}
            </button>
          ))}
        </div>

        {activeTab === "Past" && pastBookings.length > 0 && (
          <div className="flex justify-end mt-2 px-1">
            <button
              onClick={() => {
                setIsSelectingMode(!isSelectingMode);
                if (isSelectingMode) setSelectedTicketIds([]);
              }}
              className="text-[12px] font-bold text-primary hover:underline cursor-pointer bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 transition-all"
            >
              {isSelectingMode
                ? language === "RW"
                  ? "Birangiye"
                  : "Done"
                : language === "RW"
                  ? "Hitamo"
                  : "select"}
            </button>
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="px-5 space-y-4">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="text-[13px] text-slate-400 font-semibold animate-pulse">
                {language === "RW"
                  ? "Amatike arimo kuzana..."
                  : "Loading tickets..."}
              </div>
            </motion.div>
          ) : activeTab === "Upcoming" && upcomingBookings.length === 0 ? (
            <motion.div
              key="empty-upcoming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-3 shadow-2xs">
                🎫
              </div>
              <p className="text-[13.5px] font-bold text-slate-700">
                {t("noUpcoming", language)}
              </p>
            </motion.div>
          ) : activeTab === "Past" && pastBookings.length === 0 ? (
            <motion.div
              key="empty-past"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-3 shadow-2xs">
                🎫
              </div>
              <p className="text-[13.5px] font-bold text-slate-700">
                {t("noPast", language)}
              </p>
            </motion.div>
          ) : activeTab === "Upcoming" ? (
            <div className="space-y-3.5">
              {myUpcomingBookings.map((booking, i) => (
                <TicketCard
                  key={booking.id}
                  booking={booking}
                  index={i}
                  onClick={() => handleTicketClick(booking.id)}
                  currentUserName={currentUserName}
                  language={language}
                />
              ))}

              {otherUpcomingBookings.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200/80">
                  <button
                    onClick={() => setShowOtherUpcoming(!showOtherUpcoming)}
                    className="w-full flex items-center justify-between py-2 px-1 text-slate-800 font-bold text-[13.5px] cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span>
                        {language === "RW" ? "Ayandi Matike" : "Other Bookings"}
                      </span>
                      <span className="text-[11px] bg-emerald-100 text-[#00B14F] px-2 py-0.5 rounded-full font-extrabold">
                        {otherUpcomingBookings.length}
                      </span>
                    </span>
                    <ChevronDown
                      size={17}
                      className={`transition-transform text-slate-500 ${
                        showOtherUpcoming ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showOtherUpcoming && (
                    <div className="space-y-3 mt-2">
                      {otherUpcomingBookings.map((booking, i) => (
                        <TicketCard
                          key={booking.id}
                          booking={booking}
                          index={i}
                          onClick={() => handleTicketClick(booking.id)}
                          showPassengerName={true}
                          currentUserName={currentUserName}
                          language={language}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {isSelectingMode && selectedTicketIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between bg-rose-50 border border-rose-200 p-3 rounded-2xl shadow-2xs mb-2"
                >
                  <span className="text-xs font-bold text-rose-700">
                    {selectedTicketIds.length}{" "}
                    {language === "RW"
                      ? "itike zahiswemo"
                      : "ticket(s) selected"}
                  </span>
                  <button
                    onClick={() => handleDeleteTickets(selectedTicketIds)}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Trash2 size={13} />{" "}
                    {language === "RW" ? "Siba Izahiswemo" : "Delete Selected"}
                  </button>
                </motion.div>
              )}

              <div className="space-y-3">
                {recentPast.map((booking, i) => (
                  <div
                    key={booking.id}
                    className="relative flex items-center gap-2.5"
                  >
                    {isSelectingMode && (
                      <button
                        onClick={(e) => toggleSelectTicket(booking.id, e)}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
                      >
                        {selectedTicketIds.includes(booking.id) ? (
                          <CheckSquare size={20} className="text-[#00B14F]" />
                        ) : (
                          <Square size={20} className="text-slate-300" />
                        )}
                      </button>
                    )}
                    <div className="flex-1">
                      <TicketCard
                        booking={booking}
                        index={i}
                        onClick={() => handleTicketClick(booking.id)}
                        showPassengerName={true}
                        currentUserName={currentUserName}
                        language={language}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {olderPast.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200/80">
                  <button
                    onClick={() => setShowOlderPast(!showOlderPast)}
                    className="w-full flex items-center justify-between py-2 px-1 text-slate-800 font-bold text-[13.5px] cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span>
                        {language === "RW" ? "Matike ya Kera" : "Older Tickets"}
                      </span>
                      <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-extrabold">
                        {olderPast.length}
                      </span>
                    </span>
                    <ChevronDown
                      size={17}
                      className={`transition-transform text-slate-500 ${
                        showOlderPast ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showOlderPast && (
                    <div className="space-y-3 mt-2">
                      {olderPast.map((booking, i) => (
                        <div
                          key={booking.id}
                          className="relative flex items-center gap-2.5"
                        >
                          {isSelectingMode && (
                            <button
                              onClick={(e) => toggleSelectTicket(booking.id, e)}
                              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
                            >
                              {selectedTicketIds.includes(booking.id) ? (
                                <CheckSquare
                                  size={20}
                                  className="text-[#00B14F]"
                                />
                              ) : (
                                <Square size={20} className="text-slate-300" />
                              )}
                            </button>
                          )}
                          <div className="flex-1">
                            <TicketCard
                              booking={booking}
                              index={i}
                              onClick={() => handleTicketClick(booking.id)}
                              showPassengerName={true}
                              currentUserName={currentUserName}
                              language={language}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TicketCard({
  booking,
  index,
  onClick,
  showPassengerName = false,
  currentUserName,
  language,
}: {
  booking: Booking;
  index: number;
  onClick: () => void;
  showPassengerName?: boolean;
  currentUserName: string;
  language: string;
}) {
  const isUsed =
    booking.status === "used" ||
    booking.status === "boarded" ||
    booking.status === "past";

  const passengerName =
    booking.passengerName || booking.momoAccountName || currentUserName;

  const operatorName =
    typeof booking.trip?.operator === "object" && booking.trip.operator !== null
      ? booking.trip.operator.name
      : (booking.trip?.operator as string) || "Virunga Express";

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-primary/40 transition-all shadow-2xs cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          {showPassengerName && passengerName && (
            <span className="text-[11px] font-bold text-primary block mb-0.5 truncate">
              {language === "RW" ? "Umugenzi:" : "Passenger:"} {passengerName}
            </span>
          )}
          <div className="flex items-center gap-2 text-[16px] font-black text-slate-900 tracking-tight whitespace-nowrap overflow-hidden">
            <span className="truncate">
              {booking.trip?.from ||
                (language === "RW" ? "Itangiriro" : "Origin")}
            </span>
            <span className="text-primary font-bold flex-shrink-0">→</span>
            <span className="truncate">
              {booking.trip?.to ||
                (language === "RW" ? "Aho Ugiye" : "Destination")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {booking.status === "pending" && (
            <span className="bg-amber-50 text-amber-700 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200">
              {language === "RW" ? "Biracyasuzumwa ⏳" : "Processing ⏳"}
            </span>
          )}
          {booking.status === "confirmed" && (
            <span className="bg-emerald-50 text-emerald-700 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {language === "RW" ? "Byemejwe ✓" : "Confirmed ✓"}
            </span>
          )}
          {isUsed && (
            <span className="bg-rose-50 text-rose-600 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
              <CheckCircle2 size={11} className="text-rose-600" />{" "}
              {language === "RW" ? "Yakoreshejwe" : "Used"}
            </span>
          )}
          {booking.status === "rejected" && (
            <span className="bg-rose-50 text-rose-700 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-200">
              {language === "RW" ? "Byanze ✕" : "Rejected ✕"}
            </span>
          )}
          <ChevronRight
            size={18}
            className="text-slate-400 group-hover:translate-x-0.5 transition-transform"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-slate-500 font-medium flex-wrap pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <MapPin size={12} className="text-slate-400" />{" "}
          {booking.trip?.date || booking.bookingDate}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-slate-400" />{" "}
          {booking.trip?.departureTime || "--:--"}
        </span>
        <span className="flex items-center gap-1">
          <Bus size={12} className="text-slate-400" /> {operatorName}
        </span>
        <span className="font-bold text-slate-700 ml-auto bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
          {language === "RW" ? "Icyafuraha" : "Seat"} {booking.seat || "3C"}
        </span>
      </div>
    </motion.button>
  );
}
