"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { fetchTripById } from "@/lib/api";

export default function SeatSelectionRedirect() {
  const router = useRouter();
  const params = useParams();
  const tripId = String(params?.tripId || "");
  const { selectedTrip, setSelectedTrip, setSelectedSeat } = useApp();
  const [message, setMessage] = useState("Preparing your booking…");

  useEffect(() => {
    let cancelled = false;
    const continueToPayment = async () => {
      try {
        let trip = selectedTrip;
        if (!trip || trip.id !== tripId) trip = await fetchTripById(tripId);
        if (!trip) {
          if (!cancelled) {
            setMessage("We could not find that trip. Returning to trip search…");
            router.replace("/search");
          }
          return;
        }
        if (cancelled) return;
        setSelectedTrip(trip);
        setSelectedSeat("AUTO");
        router.replace("/payment");
      } catch {
        if (!cancelled) {
          setMessage("Could not load this trip. Returning to search…");
          router.replace("/search");
        }
      }
    };
    if (tripId) continueToPayment();
    else router.replace("/search");
    return () => { cancelled = true; };
  }, [tripId, selectedTrip, setSelectedTrip, setSelectedSeat, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div>
        <div className="mx-auto mb-4 h-9 w-9 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-600">{message}</p>
        <p className="mt-2 text-xs text-slate-400">Seat numbers are assigned automatically; no seat map is needed.</p>
      </div>
    </main>
  );
}
