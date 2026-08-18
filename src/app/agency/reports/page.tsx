"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import {
  Download,
  Share,
  ArrowLeft,
  TrendingUp,
  Calendar,
  Ticket,
  DollarSign,
  Bus,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  ChevronDown,
  RefreshCw,
  Search,
  Users,
  Armchair,
} from "lucide-react";
import { fetchAllBookings, fetchTripsByDate } from "@/lib/api";
import type { Booking, Trip, AgencyBranch } from "@/lib/types";

interface ManifestRow {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  trip: string;
  driverName: string;
  busPlate: string;
  emptySeats: number;
  urugendoPassengers: number;
  totalPassengers: number;
  branch: AgencyBranch;
}

const SAMPLE_MANIFEST_DATA: ManifestRow[] = [
  {
    id: "man-1",
    date: new Date().toISOString().split("T")[0],
    departureTime: "08:00 AM",
    arrivalTime: "10:30 AM",
    trip: "Musanze → Kigali",
    driverName: "Habimana Eric",
    busPlate: "RAD 100B",
    emptySeats: 2,
    urugendoPassengers: 18,
    totalPassengers: 27,
    branch: "Musanze",
  },
  {
    id: "man-2",
    date: new Date().toISOString().split("T")[0],
    departureTime: "10:30 AM",
    arrivalTime: "01:00 PM",
    trip: "Musanze → Rubavu",
    driverName: "Ndayisaba Jean",
    busPlate: "RAE 204A",
    emptySeats: 0,
    urugendoPassengers: 22,
    totalPassengers: 29,
    branch: "Musanze",
  },
  {
    id: "man-3",
    date: new Date().toISOString().split("T")[0],
    departureTime: "01:15 PM",
    arrivalTime: "03:45 PM",
    trip: "Musanze → Kigali",
    driverName: "Kamali Patrick",
    busPlate: "RAC 405C",
    emptySeats: 4,
    urugendoPassengers: 15,
    totalPassengers: 25,
    branch: "Musanze",
  },
  {
    id: "man-4",
    date: new Date().toISOString().split("T")[0],
    departureTime: "04:00 PM",
    arrivalTime: "06:30 PM",
    trip: "Kigali → Musanze",
    driverName: "Mugisha Francois",
    busPlate: "RAD 882D",
    emptySeats: 1,
    urugendoPassengers: 20,
    totalPassengers: 28,
    branch: "Kigali",
  },
];

const BRANCHES: AgencyBranch[] = [
  "Musanze",
  "Kigali",
  "Rubavu",
  "Nyagatare",
  "Gicumbi",
];

export default function AgencyReportsPage() {
  const router = useRouter();
  const { userRole } = useApp();

  const todayStr = new Date().toISOString().split("T")[0];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [reportType, setReportType] = useState<"urugendo" | "manifest">(
    "urugendo",
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [filterPeriod, setFilterPeriod] = useState<"day" | "month" | "year">(
    "day",
  );
  const [selectedBranch, setSelectedBranch] = useState<AgencyBranch | "All">(
    "Musanze",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [manifestGenerated, setManifestGenerated] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allBookings, todayTrips] = await Promise.all([
        fetchAllBookings(),
        fetchTripsByDate(selectedDate),
      ]);
      setBookings(allBookings || []);
      setTrips(todayTrips || []);
    } catch (error) {
      console.error("Failed to load agency reports data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (userRole !== "agent") {
      router.push("/login");
    }
  }, [userRole, router]);

  // Urugendo Digital Tickets Calculations
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "cancelled") return false;
      if (!b.createdAt) return true;

      const bookingDate = new Date(b.createdAt).toISOString().split("T")[0];

      if (filterPeriod === "day") {
        return bookingDate === selectedDate;
      } else if (filterPeriod === "month") {
        return bookingDate.slice(0, 7) === selectedDate.slice(0, 7);
      } else {
        return bookingDate.slice(0, 4) === selectedDate.slice(0, 4);
      }
    });
  }, [bookings, selectedDate, filterPeriod]);

  const urugendoRevenue = useMemo(() => {
    return filteredBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }, [filteredBookings]);

  const totalBookingsAllTime = bookings.filter(
    (b) => b.status !== "cancelled",
  ).length;
  const totalRevenueAllTime = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Manifest Data Filtering
  const filteredManifest = useMemo(() => {
    return SAMPLE_MANIFEST_DATA.filter((m) => {
      const branchMatch =
        selectedBranch === "All" || m.branch === selectedBranch;
      const searchMatch =
        m.busPlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.trip.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterPeriod === "day") {
        return branchMatch && searchMatch && m.date === selectedDate;
      } else if (filterPeriod === "month") {
        return (
          branchMatch &&
          searchMatch &&
          m.date.slice(0, 7) === selectedDate.slice(0, 7)
        );
      }
      return branchMatch && searchMatch;
    });
  }, [selectedDate, filterPeriod, selectedBranch, searchQuery]);

  // Export CSV Handlers
  const handleExportUrugendoCSV = () => {
    const csvHeader =
      "Booking ID,Passenger,Route,Seat,Amount (RWF),Status,Date\n";
    const csvRows = filteredBookings
      .map((b) => {
        const routeName =
          typeof b.trip === "object" && b.trip
            ? `"${b.trip.from} to ${b.trip.to}"`
            : "N/A";
        return `${b.id},"${b.passengerName || "N/A"}",${routeName},${
          b.seatNumber || "N/A"
        },${b.totalAmount || 0},${b.status || "confirmed"},${
          b.createdAt
            ? new Date(b.createdAt).toISOString().split("T")[0]
            : selectedDate
        }`;
      })
      .join("\n");

    downloadFile(
      csvHeader + csvRows,
      `urugendo-digital-report-${selectedDate}.csv`,
    );
  };

  const handleExportManifestCSV = () => {
    const csvHeader =
      "Date,Departure Time,Arrival Time,Trip,Driver Name,Bus Plate,Empty Seats,Urugendo Passengers,Total Onboard\n";
    const csvRows = filteredManifest
      .map(
        (m) =>
          `"${m.date}","${m.departureTime}","${m.arrivalTime}","${m.trip}","${m.driverName}","${m.busPlate}",${m.emptySeats},${m.urugendoPassengers},${m.totalPassengers}`,
      )
      .join("\n");

    downloadFile(
      csvHeader + csvRows,
      `station-manifest-report-${selectedDate}.csv`,
    );
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleWhatsApp = () => {
    const text =
      reportType === "urugendo"
        ? `*Virunga Express - Urugendo Digital Report*\n\nPeriod: ${selectedDate} (${filterPeriod})\nDigital Tickets Issued: ${
            filteredBookings.length
          }\nTotal Digital Revenue: ${urugendoRevenue.toLocaleString()} RWF\n\nAll-Time Digital: ${totalBookingsAllTime} tickets (${totalRevenueAllTime.toLocaleString()} RWF)`
        : `*Virunga Express - Station Manifest Report*\n\nStation Branch: ${selectedBranch}\nDate: ${selectedDate}\nTotal Buses Manifested: ${filteredManifest.length}\nTotal Urugendo Onboard: ${filteredManifest.reduce(
            (acc, m) => acc + m.urugendoPassengers,
            0,
          )}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (userRole !== "agent") return null;

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center text-white">
        <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Generating Analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* High-Contrast Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md bg-opacity-90">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/agency")}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all duration-200 active:scale-95 border border-slate-700/60"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-bold block">
                ANALYTICS & MANIFEST ENGINE
              </span>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Agency Reports
              </h1>
            </div>
          </div>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-xl transition-colors border border-slate-700/60"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-5 space-y-5">
        {/* Apple/Claude Toggle Switcher */}
        <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex gap-2 shadow-inner">
          <button
            onClick={() => setReportType("urugendo")}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 ${
              reportType === "urugendo"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Ticket size={16} /> Urugendo Digital Tickets
          </button>

          <button
            onClick={() => setReportType("manifest")}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 ${
              reportType === "manifest"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Bus size={16} /> Station Bus Manifest
          </button>
        </div>

        {/* Dynamic High-Contrast Control Console */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-4 backdrop-blur-sm">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            {/* Date Input */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 flex-1 min-w-[200px]">
              <Calendar size={16} className="text-emerald-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-hidden w-full cursor-pointer font-mono"
              />
            </div>

            {/* Period Selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(["day", "month", "year"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setFilterPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                    filterPeriod === period
                      ? "bg-slate-800 text-emerald-400 border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Station Branch Filter (Manifest Mode) */}
            {reportType === "manifest" && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                <Building2 size={15} className="text-slate-400" />
                <select
                  value={selectedBranch}
                  onChange={(e) =>
                    setSelectedBranch(e.target.value as AgencyBranch | "All")
                  }
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-hidden cursor-pointer"
                >
                  <option value="All" className="bg-slate-900">
                    All Branches
                  </option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b} className="bg-slate-900">
                      Branch: {b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search bar for Manifest */}
          {reportType === "manifest" && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <Search size={15} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search bus plate, driver name, route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden w-full"
              />
            </div>
          )}
        </div>

        {/* SECTION 1: URUGENDO DIGITAL TICKETS REPORT */}
        {reportType === "urugendo" && (
          <div className="space-y-4 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Urugendo Tickets
                </div>
                <div className="text-2xl font-black text-white">
                  {filteredBookings.length}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {filterPeriod} report
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Digital Revenue
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {urugendoRevenue.toLocaleString()}
                  <span className="text-xs text-slate-400 ml-1 font-normal">
                    RWF
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Excludes paper tickets
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                  All-Time Tickets
                </div>
                <div className="text-2xl font-black text-slate-200">
                  {totalBookingsAllTime}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Total platform sales
                </div>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                  All-Time Revenue
                </div>
                <div className="text-2xl font-black text-slate-200">
                  {totalRevenueAllTime.toLocaleString()}
                  <span className="text-xs text-slate-400 ml-1 font-normal">
                    RWF
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Cumulative digital total
                </div>
              </div>
            </div>

            {/* Digital Bookings High-Contrast List */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Ticket size={16} className="text-emerald-400" />
                    Urugendo Digital Bookings Record
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Showing {filteredBookings.length} digital transactions for{" "}
                    {selectedDate}
                  </p>
                </div>
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                  Verified Online
                </span>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  No Urugendo digital bookings found for this period.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 overflow-x-auto">
                  {filteredBookings.map((b) => {
                    const routeName =
                      typeof b.trip === "object" && b.trip
                        ? `${b.trip.from} → ${b.trip.to}`
                        : "Route Direct";
                    return (
                      <div
                        key={b.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-200">
                              #{b.id.slice(0, 8)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="font-bold text-white">
                              {b.passengerName || "Passenger"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{routeName}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-300">
                              Seat {b.seatNumber || "N/A"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-extrabold text-emerald-400">
                            +{(b.totalAmount || 0).toLocaleString()} RWF
                          </div>
                          <span className="inline-block text-[9.5px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md mt-0.5">
                            {b.status || "CONFIRMED"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2: APPLE & CLAUDE INSPIRED STATION MANIFEST REPORT */}
        {reportType === "manifest" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  Manifest for Branch:{" "}
                  <strong className="text-emerald-400">{selectedBranch}</strong>
                </span>
              </div>
              <button
                onClick={() => setManifestGenerated(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Generate Manifest
              </button>
            </div>

            {/* High-Contrast Apple & Claude Inspired Manifest Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 text-[10.5px] font-mono uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4 font-bold">Date</th>
                      <th className="py-3.5 px-4 font-bold">Departure</th>
                      <th className="py-3.5 px-4 font-bold">Arrival ETA</th>
                      <th className="py-3.5 px-4 font-bold">Trip Route</th>
                      <th className="py-3.5 px-4 font-bold">Driver Name</th>
                      <th className="py-3.5 px-4 font-bold">Bus Plate</th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Empty Seats
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center text-emerald-400">
                        Urugendo Passengers
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Total Onboard
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs text-slate-200">
                    {filteredManifest.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-slate-500 font-mono text-xs"
                        >
                          No bus departures recorded for {selectedBranch} on
                          this date.
                        </td>
                      </tr>
                    ) : (
                      filteredManifest.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-slate-800/50 transition-colors group"
                        >
                          <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold whitespace-nowrap">
                            {m.date}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                            {m.departureTime}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {m.arrivalTime}
                          </td>
                          <td className="py-3.5 px-4 font-black text-emerald-400 whitespace-nowrap">
                            {m.trip}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-300 whitespace-nowrap">
                            {m.driverName}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-amber-300 bg-amber-500/10 px-2 rounded whitespace-nowrap">
                            {m.busPlate}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-400 whitespace-nowrap">
                            {m.emptySeats}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-black text-emerald-400 bg-emerald-500/10 whitespace-nowrap">
                            {m.urugendoPassengers}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-100 whitespace-nowrap">
                            {m.totalPassengers} / 29
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Global Export & Sharing Action Footer Bar */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={
              reportType === "urugendo"
                ? handleExportUrugendoCSV
                : handleExportManifestCSV
            }
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
          >
            <Download size={16} /> Export CSV Report
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
          >
            <Share size={16} /> Share via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
