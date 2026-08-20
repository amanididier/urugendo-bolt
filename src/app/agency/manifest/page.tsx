"use client";

import { useState, useEffect } from "react";
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
  FileSpreadsheet,
} from "lucide-react";
import type { AgencyBranch } from "@/lib/types";

interface ManifestTrip {
  id: string;
  busPlate: string;
  driverName: string;
  from: string;
  to: string;
  time: string;
  capacity: number;
  urugendoPassengers: number;
  status: string;
}

const INITIAL_INCOMING: ManifestTrip[] = [
  {
    id: "inc-1",
    busPlate: "RAD 450B",
    driverName: "Jean-Paul Habimana",
    from: "Kigali Nyabugogo",
    to: "Musanze",
    time: "16:15",
    capacity: 29,
    urugendoPassengers: 18,
    status: "In Transit",
  },
  {
    id: "inc-2",
    busPlate: "RAC 112D",
    driverName: "Eric Ndayishimiye",
    from: "Rubavu Station",
    to: "Musanze",
    time: "15:45",
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

const BRANCHES: string[] = [
  "Musanze",
  "Kigali",
  "Rubavu",
  "Nyagatare",
  "Gicumbi",
];

const getBranchName = (branch: AgencyBranch | string): string =>
  typeof branch === "string" ? branch : branch?.name || "Musanze";

export default function AgencyManifestPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );
  const [stationBranch, setStationBranch] = useState<string>("Musanze");
  const [emptySeats, setEmptySeats] = useState<Record<string, number>>({
    "out-1": 3,
    "out-2": 1,
  });
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  useEffect(() => {
    const savedBranch = localStorage.getItem("urugendo_branch");
    if (savedBranch) {
      setStationBranch(savedBranch);
    }
  }, []);

  const handleBranchChange = (newBranch: string) => {
    setStationBranch(newBranch);
    localStorage.setItem("urugendo_branch", newBranch);
  };

  const handleSaveEmptySeats = (tripId: string) => {
    setSavedFeedback(tripId);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const exportStyledExcelReport = () => {
    const branchName = getBranchName(stationBranch);
    const isIncoming = activeTab === "incoming";

    const tableHeaders = isIncoming
      ? [
          "State",
          "Bus Plate",
          "Driver Name",
          "From",
          "Destination",
          "ETA",
          "Capacity",
          "Urugendo App Pass",
          "Paper Tickets",
          "Status",
        ]
      : [
          "State",
          "Bus Plate",
          "Driver Name",
          "From",
          "To",
          "Departure Time",
          "Capacity",
          "Urugendo App Pass",
          "Empty Seats",
          "Paper Tickets",
          "Total Onboard",
          "Status",
        ];

    const tableRows = isIncoming
      ? INITIAL_INCOMING.map((trip) => {
          const paperTickets = Math.max(
            0,
            trip.capacity - trip.urugendoPassengers,
          );
          return `
            <tr>
              <td style="padding: 8px; text-align: center;"><span style="background-color: #DCFCE7; color: #15803D; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; display: inline-block;">INCOMING</span></td>
              <td style="padding: 8px; font-weight: bold;">${trip.busPlate}</td>
              <td style="padding: 8px;">${trip.driverName}</td>
              <td style="padding: 8px;">${trip.from}</td>
              <td style="padding: 8px;">${branchName}</td>
              <td style="padding: 8px; font-weight: bold; color: #047857;">${trip.time}</td>
              <td style="padding: 8px; text-align: center;">${trip.capacity}</td>
              <td style="padding: 8px; text-align: center; font-weight: bold; color: #00B14F;">${trip.urugendoPassengers}</td>
              <td style="padding: 8px; text-align: center;">${paperTickets}</td>
              <td style="padding: 8px; text-align: center;">${trip.status}</td>
            </tr>`;
        }).join("")
      : INITIAL_OUTGOING.map((trip) => {
          const empty = emptySeats[trip.id] ?? 0;
          const paperTickets = Math.max(
            0,
            trip.capacity - trip.urugendoPassengers - empty,
          );
          const totalOnboard = trip.urugendoPassengers + paperTickets;
          return `
            <tr>
              <td style="padding: 8px; text-align: center;"><span style="background-color: #FEE2E2; color: #B91C1C; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; display: inline-block;">OUTGOING</span></td>
              <td style="padding: 8px; font-weight: bold;">${trip.busPlate}</td>
              <td style="padding: 8px;">${trip.driverName}</td>
              <td style="padding: 8px;">${branchName}</td>
              <td style="padding: 8px;">${trip.to}</td>
              <td style="padding: 8px; font-weight: bold; color: #1E293B;">${trip.time}</td>
              <td style="padding: 8px; text-align: center;">${trip.capacity}</td>
              <td style="padding: 8px; text-align: center; font-weight: bold; color: #00B14F;">${trip.urugendoPassengers}</td>
              <td style="padding: 8px; text-align: center; color: #D97706; font-weight: bold;">${empty}</td>
              <td style="padding: 8px; text-align: center;">${paperTickets}</td>
              <td style="padding: 8px; text-align: center; font-weight: bold;">${totalOnboard}/${trip.capacity}</td>
              <td style="padding: 8px; text-align: center;">${trip.status}</td>
            </tr>`;
        }).join("");

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Manifest Report</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 12px;">
        <h2 style="color: #0F172A; margin-bottom: 4px;">Station Manifest Report (${branchName} Branch)</h2>
        <p style="color: #64748B; font-size: 11px; margin-top: 0;">Mode: <b>${activeTab.toUpperCase()}</b> | Generated: ${new Date().toLocaleString()}</p>
        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #E2E8F0; width: 100%;">
          <thead>
            <tr style="background-color: #0F172A; color: #FFFFFF; font-weight: bold; text-align: left;">
              ${tableHeaders
                .map(
                  (header) =>
                    `<th style="padding: 10px; border: 1px solid #334155;">${header}</th>`,
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>`;

    const blob = new Blob([htmlContent], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `manifest-${activeTab}-${branchName.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
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
                value={getBranchName(stationBranch)}
                onChange={(e) => handleBranchChange(e.target.value)}
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
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === "incoming"
              ? "bg-[#00B14F] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ArrowDownLeft size={16} /> Incoming Buses ({INITIAL_INCOMING.length})
        </button>

        <button
          onClick={() => setActiveTab("outgoing")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
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
                        className="bg-[#00B14F] hover:bg-[#00B14F]/90 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors cursor-pointer"
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

        {/* Styled Printable Excel Manifest Action Button */}
        <button
          onClick={exportStyledExcelReport}
          className="w-full mt-4 bg-[#00B14F] hover:bg-[#00B14F]/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide cursor-pointer"
        >
          <FileSpreadsheet size={16} /> Generate Printable Manifest ({activeTab}
          )
        </button>
      </div>
    </div>
  );
}
