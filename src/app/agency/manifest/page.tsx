"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bus,
  ArrowDownLeft,
  ArrowUpRight,
  Save,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  Ticket,
  Armchair,
} from "lucide-react";
import type { AgencyBranch } from "@/lib/types";

interface ManifestTrip {
  id: string;
  busPlate: string;
  driverName: string;
  from: string;
  to: string;
  time: string; // ETA or Departure time
  capacity: number;
  urugendoPassengers: number;
  status: string;
}

const INITIAL_INCOMING: ManifestTrip[] = [
  {
    id: "inc-1",
    busPlate: "RAD 100B",
    driverName: "Habimana Eric",
    from: "Kigali",
    to: "Musanze",
    time: "14:30",
    capacity: 29,
    urugendoPassengers: 18,
    status: "In Transit",
  },
  {
    id: "inc-2",
    busPlate: "RAE 204A",
    driverName: "Ndayisaba Jean",
    from: "Rubavu",
    to: "Musanze",
    time: "16:00",
    capacity: 29,
    urugendoPassengers: 22,
    status: "In Transit",
  },
];

const INITIAL_OUTGOING: ManifestTrip[] = [
  {
    id: "out-1",
    busPlate: "RAC 405C",
    driverName: "Kamali Patrick",
    from: "Musanze",
    to: "Rubavu",
    time: "10:00 AM",
    capacity: 29,
    urugendoPassengers: 16,
    status: "Departed",
  },
  {
    id: "out-2",
    busPlate: "RAD 882D",
    driverName: "Mugisha Francois",
    from: "Musanze",
    to: "Kigali",
    time: "11:30 AM",
    capacity: 29,
    urugendoPassengers: 21,
    status: "Departed",
  },
];

const BRANCHES: AgencyBranch[] = [
  "Musanze",
  "Kigali",
  "Rubavu",
  "Nyagatare",
  "Gicumbi",
];

export default function AgencyManifestPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );
  const [stationBranch, setStationBranch] = useState<AgencyBranch>("Musanze");
  const [emptySeats, setEmptySeats] = useState<Record<string, number>>({
    "out-1": 3,
    "out-2": 1,
  });
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const handleSaveEmptySeats = (tripId: string) => {
    const seats = emptySeats[tripId] ?? 0;
    setSavedFeedback(tripId);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
              STATION MANIFEST ENGINE
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <Building2 size={14} className="text-slate-400" />
              <select
                value={stationBranch}
                onChange={(e) =>
                  setStationBranch(e.target.value as AgencyBranch)
                }
                className="bg-slate-800 text-white text-xs font-bold rounded px-2 py-0.5 border border-slate-700 focus:outline-hidden"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    Branch: {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 text-xs font-extrabold flex items-center gap-1.5">
          <Bus size={14} /> Live Sync
        </div>
      </div>

      {/* Manifest Navigation Tabs */}
      <div className="bg-white p-2 border-b border-slate-200 flex gap-2 max-w-2xl mx-auto sticky top-0 z-10 shadow-xs">
        <button
          onClick={() => setActiveTab("incoming")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "incoming"
              ? "bg-[#00B14F] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ArrowDownLeft size={16} /> Incoming Buses ({INITIAL_INCOMING.length})
        </button>

        <button
          onClick={() => setActiveTab("outgoing")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "outgoing"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ArrowUpRight size={16} /> Outgoing / Departed (
          {INITIAL_OUTGOING.length})
        </button>
      </div>

      {/* Manifest Content */}
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {activeTab === "incoming"
          ? INITIAL_INCOMING.map((trip) => {
              const paperTickets = Math.max(
                0,
                trip.capacity - trip.urugendoPassengers,
              );
              return (
                <div
                  key={trip.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-[#00B14F] uppercase tracking-wider">
                        INBOUND FROM {trip.from.toUpperCase()}
                      </span>
                      <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <span>Bus {trip.busPlate}</span>
                      </h2>
                      <p className="text-xs text-slate-500 font-semibold">
                        Driver: {trip.driverName}
                      </p>
                    </div>
                    <span className="bg-emerald-100 text-[#00B14F] text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                      <Clock size={12} /> ETA: {trip.time}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                        Total Capacity
                      </span>
                      <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                        <Armchair size={12} className="text-slate-500" />
                        {trip.capacity} Seats
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-xl">
                      <span className="text-[9.5px] font-bold text-emerald-600 block uppercase">
                        Urugendo App
                      </span>
                      <span className="text-xs font-black text-[#00B14F] flex items-center justify-center gap-1">
                        <Ticket size={12} />
                        {trip.urugendoPassengers} Pass
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                        Paper Tickets
                      </span>
                      <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        {paperTickets} Pass
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          : INITIAL_OUTGOING.map((trip) => {
              const empty = emptySeats[trip.id] ?? 0;
              const paperTickets = Math.max(
                0,
                trip.capacity - trip.urugendoPassengers - empty,
              );

              return (
                <div
                  key={trip.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        OUTBOUND TO {trip.to.toUpperCase()}
                      </span>
                      <h2 className="text-base font-black text-slate-900">
                        Bus {trip.busPlate}
                      </h2>
                      <p className="text-xs text-slate-500 font-semibold">
                        Driver: {trip.driverName} · Departed: {trip.time}
                      </p>
                    </div>
                    <span className="bg-slate-100 text-slate-700 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full">
                      Left Station
                    </span>
                  </div>

                  {/* Breakdown Stats */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center">
                    <div>
                      <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                        Urugendo App
                      </span>
                      <span className="text-xs font-black text-[#00B14F]">
                        {trip.urugendoPassengers} Passengers
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                        Paper Tickets
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {paperTickets} Passengers
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                        Total Onboard
                      </span>
                      <span className="text-xs font-black text-slate-800">
                        {trip.urugendoPassengers + paperTickets} /{" "}
                        {trip.capacity}
                      </span>
                    </div>
                  </div>

                  {/* Empty Seats Input Tracker */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">
                        Record Empty Seats
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Adjusts paper ticket calculation
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={trip.capacity}
                        value={empty}
                        onChange={(e) =>
                          setEmptySeats({
                            ...emptySeats,
                            [trip.id]: Number(e.target.value),
                          })
                        }
                        className="w-16 bg-white border border-slate-300 rounded-lg py-1 px-2 text-center font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#00B14F] focus:outline-hidden"
                      />
                      <button
                        onClick={() => handleSaveEmptySeats(trip.id)}
                        className="bg-[#00B14F] hover:bg-[#00B14F]/90 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors"
                        title="Save empty seats"
                      >
                        {savedFeedback === trip.id ? (
                          <CheckCircle2 size={15} className="text-white" />
                        ) : (
                          <Save size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                  {savedFeedback === trip.id && (
                    <p className="text-[11px] font-bold text-emerald-600 text-right">
                      ✓ Empty seat record saved successfully!
                    </p>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}
