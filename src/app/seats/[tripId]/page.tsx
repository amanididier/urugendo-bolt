"use client";

import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Armchair } from "lucide-react";
import { useApp } from "@/context/app-context";
import { formatPrice } from "@/lib/data";
import { t } from "@/lib/translations";
import { fetchTakenSeats, fetchTripById } from "@/lib/api";
import { useState, useEffect } from "react";
import type { Trip } from "@/lib/types";

export default function SeatSelectionPage() {
  const router = useRouter();
  const routeParams = useParams();
  const tripIdFromUrl = routeParams?.tripId as string;

  const {
    selectedTrip,
    setSelectedTrip,
    selectedSeat,
    setSelectedSeat,
    language,
  } = useApp();
  const [trip, setTrip] = useState<Trip | null>(selectedTrip || null);
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!selectedTrip);

  useEffect(() => {
    let isMounted = true;

    async function loadTripData() {
      if (selectedTrip) {
        setTrip(selectedTrip);
        const taken = await fetchTakenSeats(selectedTrip.id);
        if (isMounted) setTakenSeats(taken);
        setLoading(false);
        return;
      }

      if (tripIdFromUrl) {
        setLoading(true);
        const fetched = await fetchTripById(tripIdFromUrl);
        if (isMounted) {
          if (fetched) {
            setTrip(fetched);
            setSelectedTrip(fetched);
            const taken = await fetchTakenSeats(fetched.id);
            setTakenSeats(taken);
          }
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }

    loadTripData();

    return () => {
      isMounted = false;
    };
  }, [selectedTrip, tripIdFromUrl, setSelectedTrip]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-slate-500 font-medium">
          Loading seat arrangement...
        </p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6 pb-20">
        <div className="text-5xl mb-4">💺</div>
        <h2 className="text-[20px] font-bold text-slate-800 mb-2">
          {t("noTrip", language) || "No trip selected"}
        </h2>
        <p className="text-[14px] text-slate-500 text-center mb-6">
          {t("goBackHome", language) ||
            "Please select a scheduled trip to choose your seats."}
        </p>
        <button
          onClick={() => router.push("/search")}
          className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
        >
          {t("searchBuses2", language) || "Search Buses"}
        </button>
      </div>
    );
  }

  const isCoaster =
    trip.busType === "Coaster" ||
    trip.busType === "coaster" ||
    !trip.busType ||
    (trip.totalSeats && trip.totalSeats <= 29);

  const totalSeatsCount = trip.totalSeats || (isCoaster ? 29 : 45);

  const getSeatStatus = (seatId: string): "available" | "taken" => {
    return takenSeats instanceof Set && takenSeats.has(seatId)
      ? "taken"
      : "available";
  };

  const handleSeatClick = (seatId: string, status: string) => {
    if (status === "taken") return;
    setSelectedSeat(selectedSeat === seatId ? null : seatId);
  };

  const bookingFee = 200;
  const totalPrice = selectedSeat ? trip.price + bookingFee : 0;

  const renderSeat = (seatId: string, isFoldable = false) => {
    const status = getSeatStatus(seatId);
    const isSelected = selectedSeat === seatId;

    return (
      <motion.button
        key={seatId}
        whileTap={{ scale: status === "taken" ? 1 : 0.92 }}
        onClick={() => handleSeatClick(seatId, status)}
        disabled={status === "taken"}
        title={isFoldable ? `Foldable Seat ${seatId}` : `Seat ${seatId}`}
        className={`${
          isFoldable ? "h-9 text-[10px] scale-95" : "h-10 text-[12px]"
        } w-full rounded-xl font-extrabold flex items-center justify-center transition-all duration-200 relative cursor-pointer ${
          isSelected
            ? "bg-primary text-white shadow-md ring-2 ring-primary/40 scale-105 z-10"
            : status === "taken"
              ? "bg-red-50 border border-red-200 text-red-300 cursor-not-allowed"
              : "bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 active:border-primary"
        }`}
      >
        {seatId}
      </motion.button>
    );
  };

  return (
    <div className="bg-slate-50 min-h-full pb-[230px] relative w-full">
      {/* Header */}
      <div className="bg-primary pt-[50px] px-5 pb-5 rounded-b-[24px] shadow-xs">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push("/search")}
            className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="text-[18px] font-extrabold text-white">
              {trip.from} → {trip.to}
            </div>
            <div className="text-[12px] text-white/80 font-medium">
              {trip.date} · {trip.departureTime}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-extrabold text-white">
              {formatPrice(trip.price)}
            </div>
            <div className="text-[11px] text-white/80">
              {t("perSeat", language) || "per seat"}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-b border-slate-200/80 py-3 px-4 flex items-center justify-center gap-6 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md bg-emerald-50 border border-emerald-300" />
          <span className="text-[12px] font-semibold text-slate-600">
            {t("available", language) || "Available"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md bg-red-50 border border-red-200" />
          <span className="text-[12px] font-semibold text-slate-600">
            {t("taken", language) || "Occupied"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md bg-primary" />
          <span className="text-[12px] font-semibold text-slate-600">
            {t("yourPick", language) || "Selected"}
          </span>
        </div>
      </div>

      {/* Seat Layout */}
      <div className="flex justify-center px-4 py-6">
        <div className="w-full max-w-[360px] bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
                {isCoaster
                  ? "Toyota Coaster (29 Seats)"
                  : `Large Coach (${totalSeatsCount} Seats)`}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Armchair size={15} className="text-slate-400" />
              <span>Front</span>
            </div>
          </div>

          {isCoaster ? (
            <div className="space-y-2.5">
              {/* Row 1: Driver seat at 1A */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                <div className="h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 font-bold text-[10px] flex flex-col items-center justify-center">
                  <span>1A</span>
                  <span className="text-[8px] uppercase tracking-tight">
                    Driver
                  </span>
                </div>
                {renderSeat("1B")}
                {renderSeat("1M", true)}
                {renderSeat("1C")}
                {renderSeat("1D")}
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {renderSeat("2A")}
                {renderSeat("2B")}
                {renderSeat("2M", true)}
                {renderSeat("2C")}
                {renderSeat("2D")}
              </div>

              {/* Row 3: Entrance Door at 3D position */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {renderSeat("3A")}
                {renderSeat("3B")}
                {renderSeat("3M", true)}
                {renderSeat("3C")}
                <div className="h-10 rounded-xl border-2 border-dashed border-emerald-400/60 bg-emerald-50/50 text-emerald-700 font-bold text-[9px] uppercase tracking-tight flex items-center justify-center">
                  Door
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {renderSeat("4A")}
                {renderSeat("4B")}
                {renderSeat("4M", true)}
                {renderSeat("4C")}
                {renderSeat("4D")}
              </div>

              {/* Row 5 */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {renderSeat("5A")}
                {renderSeat("5B")}
                {renderSeat("5M", true)}
                {renderSeat("5C")}
                {renderSeat("5D")}
              </div>

              {/* Row 6 */}
              <div className="grid grid-cols-5 gap-1.5 items-center">
                {renderSeat("6A")}
                {renderSeat("6B")}
                {renderSeat("6M", true)}
                {renderSeat("6C")}
                {renderSeat("6D")}
              </div>

              {/* Rear Bench */}
              <div className="pt-2 border-t border-dashed border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 text-center mb-1.5 uppercase tracking-wider">
                  Rear Bench
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {renderSeat("7A")}
                  {renderSeat("7B")}
                  {renderSeat("7C")}
                  {renderSeat("7D")}
                  {renderSeat("7E")}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(
                { length: Math.floor((totalSeatsCount - 5) / 4) },
                (_, i) => {
                  const row = i + 1;
                  return (
                    <div
                      key={row}
                      className="grid grid-cols-5 gap-2 items-center text-center"
                    >
                      {renderSeat(`${row}A`)}
                      {renderSeat(`${row}B`)}
                      <span className="text-[11px] font-bold text-slate-400">
                        {row}
                      </span>
                      {renderSeat(`${row}C`)}
                      {renderSeat(`${row}D`)}
                    </div>
                  );
                },
              )}

              <div className="pt-2 border-t border-dashed border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 text-center mb-1.5 uppercase tracking-wider">
                  Rear Row
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {renderSeat("R1")}
                  {renderSeat("R2")}
                  {renderSeat("R3")}
                  {renderSeat("R4")}
                  {renderSeat("R5")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Payment Bar (Positioned above the 64px BottomNav) */}
      <div className="absolute bottom-[64px] left-0 right-0 w-full bg-white border-t border-slate-200 px-5 py-3.5 z-30 shadow-2xl safe-bottom">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {t("seat", language) || "Selected Seat"}
            </div>
            <div className="text-[16px] font-extrabold text-slate-800">
              {selectedSeat ? `Seat ${selectedSeat}` : "None"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {t("total", language) || "Total Amount"}
            </div>
            <div className="text-[18px] font-extrabold text-primary">
              {selectedSeat ? formatPrice(totalPrice) : "—"}
            </div>
          </div>
        </div>

        <button
          onClick={() => selectedSeat && router.push("/payment")}
          disabled={!selectedSeat}
          className={`w-full h-12 rounded-xl font-extrabold text-white text-[14px] flex items-center justify-center transition-all shadow-md active:scale-[0.98] ${
            selectedSeat
              ? "bg-primary hover:bg-primary/95 cursor-pointer"
              : "bg-slate-300 cursor-not-allowed"
          }`}
        >
          {selectedSeat
            ? t("pay", language) || "Proceed to Payment"
            : "Select a seat to continue"}
        </button>
      </div>
    </div>
  );
}
