"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import {
  Download,
  Share,
  ArrowLeft,
  Calendar,
  Ticket,
  Bus,
  Building2,
  RefreshCw,
  Search,
  ChevronRight,
} from "lucide-react";
import {
  fetchBookingsByBranch,
  fetchTripsByDate,
  fetchTripsForBranchRange,
  resolveAgentBranchContext,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Booking, Trip, AgencyBranch } from "@/lib/types";
import {
  bookingTripId,
  computePaperPassengers,
  hasTripDeparted,
  isVerifiedDigitalBooking,
} from "@/lib/manifestMath";

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
  paperPassengers: number;
  totalPassengers: number;
  branch: AgencyBranch;
  capacity: number;
  priceRwf: number;
  paperRevenue: number;
  digitalRevenue: number;
}



const BRANCHES: AgencyBranch[] = [
  "Musanze",
  "Kigali",
  "Rubavu",
  "Nyagatare",
  "Gicumbi",
];

const getBranchName = (branch: AgencyBranch | "All"): string => {
  if (typeof branch === "object" && branch !== null) {
    return (branch as { name: string }).name;
  }
  return String(branch || "");
};

export default function AgencyReportsPage() {
  const router = useRouter();
  const { userRole } = useApp();

  const todayStr = new Date().toISOString().split("T")[0];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [manifestTrips, setManifestTrips] = useState<Trip[]>([]);
  const [manifestBookings, setManifestBookings] = useState<any[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // ── SOURCE OF TRUTH: branches table resolver ───────────────
      const ctx = await resolveAgentBranchContext();
      let branchId: string | null = ctx.matched ? ctx.branchId : null;
      if (!branchId) {
        const cached = localStorage.getItem("urugendo_branch_id");
        if (cached) branchId = cached;
      }
      if (!branchId) {
        const em = localStorage.getItem("urugendo_agent_email") || localStorage.getItem("urugendo_user_email");
        if (em) {
          const { data: ar } = await supabase.from("agency_agents").select("branch_id").eq("email", em).maybeSingle();
          branchId = (ar as any)?.branch_id || null;
        }
      }
      if (!branchId) { setBookings([]); setTrips([]); setManifestTrips([]); setManifestBookings([]); setLoading(false); return; }

      const baseDate = new Date(selectedDate);
      const y = baseDate.getUTCFullYear();
      const m = baseDate.getUTCMonth();
      let rangeStart = selectedDate;
      let rangeEnd = selectedDate;
      if (filterPeriod === "month") {
        rangeStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        rangeEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      } else if (filterPeriod === "year") {
        rangeStart = `${y}-01-01`;
        rangeEnd = `${y}-12-31`;
      }

      const [branchBookings, todayTrips, rangeTrips] = await Promise.all([
        fetchBookingsByBranch(branchId),
        fetchTripsByDate(selectedDate, branchId),
        fetchTripsForBranchRange(branchId, rangeStart, rangeEnd),
      ]);
      setBookings(branchBookings || []);
      setTrips(todayTrips || []);
      setManifestTrips(rangeTrips || []);
      const tripIds = new Set((rangeTrips || []).map((t) => t.id));
      if (tripIds.size > 0) {
        const { data: allBookings } = await supabase
          .from("bookings")
          .select("id,trip_id,status,payment_status,fare_amount,total_amount,passenger_name,branch_id")
          .in("trip_id", [...tripIds]);
        setManifestBookings((allBookings as any[]) || []);
      } else {
        setManifestBookings([]);
      }
    } catch (error) {
      console.error("Failed to load agency reports data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterPeriod]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (userRole !== "agent") {
      router.push("/agency/agency-login");
    }
  }, [userRole, router]);

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: 200,
        behavior: "smooth",
      });
    }
  };

  // Urugendo Digital Tickets Calculations
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === "cancelled") return false;
      const bDateStr = b.createdAt || b.bookingDate;
      if (!bDateStr) return true;

      const bookingDate = new Date(bDateStr).toISOString().split("T")[0];

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

  const cleanStationName = (n: string) =>
    n.toLowerCase().replace(/branch|station/g, "").trim();

  // Manifest Data: real DB-driven rows computed with the canonical formula
  const filteredManifest = useMemo(() => {
    const cleanSearch = searchQuery.toLowerCase().replace(/\s+/g, "");
    const verifiedPerTrip = new Map<string, number>();
    const digitalRevPerTrip = new Map<string, number>();
    for (const b of manifestBookings) {
      if (!isVerifiedDigitalBooking(b)) continue;
      const tid = bookingTripId(b);
      if (!tid) continue;
      verifiedPerTrip.set(tid, (verifiedPerTrip.get(tid) ?? 0) + 1);
      const rev = Number(b.fare_amount) || Number(b.total_amount) || 0;
      digitalRevPerTrip.set(tid, (digitalRevPerTrip.get(tid) ?? 0) + rev);
    }

    const now = new Date();
    const rows: ManifestRow[] = manifestTrips
      .filter((trip) => {
        const td = (trip as any).date || (trip as any).travel_date;
        if (!td) return false;
        const tdShort = String(td).slice(0, 10);
        if (filterPeriod === "day") {
          if (tdShort !== selectedDate) return false;
        } else if (filterPeriod === "month") {
          if (tdShort.slice(0, 7) !== selectedDate.slice(0, 7)) return false;
        } else {
          if (tdShort.slice(0, 4) !== selectedDate.slice(0, 4)) return false;
        }
        if (selectedBranch !== "All") {
          const branchName = getBranchName(selectedBranch).toLowerCase();
          const from = cleanStationName(trip.from || "");
          const to = cleanStationName(trip.to || "");
          if (!from.includes(branchName) && !to.includes(branchName)) return false;
        }
        return true;
      })
      .map((trip) => {
        const td = String((trip as any).date || (trip as any).travel_date || "");
        const digital = verifiedPerTrip.get(trip.id) ?? 0;
        const digitalRev = digitalRevPerTrip.get(trip.id) ?? 0;
        const empty = Number(trip.emptySeats) || 0;
        const capacity = Number(trip.totalSeats) || 29;
        const price = Number(trip.price) || 0;
        const departed = hasTripDeparted(td, trip.departureTime, now);
        const paper = computePaperPassengers(capacity, empty, digital, departed);
        const paperRev = paper * price;
        return {
          id: trip.id,
          date: td.slice(0, 10),
          departureTime: trip.departureTime || "—",
          arrivalTime: trip.arrivalTime || "—",
          trip: `${trip.from} → ${trip.to}`,
          driverName: (trip as any).driverName || "Assigned Driver",
          busPlate: trip.plateNumber || "UNASSIGNED",
          emptySeats: empty,
          urugendoPassengers: digital,
          paperPassengers: paper,
          totalPassengers: digital + paper,
          branch: (trip.from || "") as AgencyBranch,
          capacity,
          priceRwf: price,
          paperRevenue: paperRev,
          digitalRevenue: digitalRev,
        };
      });

    if (!cleanSearch) return rows;
    return rows.filter((m) => {
      const cleanPlate = m.busPlate.toLowerCase().replace(/\s+/g, "");
      const cleanDriver = m.driverName.toLowerCase().replace(/\s+/g, "");
      const cleanTrip = m.trip.toLowerCase().replace(/\s+/g, "");
      return (
        cleanPlate.includes(cleanSearch) ||
        cleanDriver.includes(cleanSearch) ||
        cleanTrip.includes(cleanSearch)
      );
    });
  }, [manifestTrips, manifestBookings, selectedDate, filterPeriod, selectedBranch, searchQuery]);

  // Export File Handlers
  const handleExportUrugendo = () => {
    const csvHeader =
      "Booking ID,Passenger,Route,Seat,Amount (RWF),Status,Date\n";
    const csvRows = filteredBookings
      .map((b) => {
        const routeName =
          typeof b.trip === "object" && b.trip
            ? `"${b.trip.from} to ${b.trip.to}"`
            : "N/A";
        const dateVal = b.createdAt || b.bookingDate;
        return `${b.id},"${b.passengerName || "N/A"}",${routeName},${
          b.seatNumber || b.seat || "N/A"
        },${b.totalAmount || 0},${b.status || "confirmed"},${
          dateVal ? new Date(dateVal).toISOString().split("T")[0] : selectedDate
        }`;
      })
      .join("\n");

    downloadFile(
      csvHeader + csvRows,
      `urugendo-digital-report-${selectedDate}.csv`,
    );
  };

  const handleExportManifest = () => {
    const csvHeader =
      "Date,Departure Time,Arrival Time,Trip,Driver Name,Bus Plate,Capacity,Empty Seats,Urugendo Digital,Paper Tickets,Total Onboard,Urugendo Revenue (RWF),Paper Revenue (RWF),Total Revenue (RWF),Ticket Price (RWF)\n";
    const csvRows = filteredManifest
      .map(
        (m) =>
          `"${m.date}","${m.departureTime}","${m.arrivalTime}","${m.trip}","${m.driverName}","${m.busPlate}",${m.capacity},${m.emptySeats},${m.urugendoPassengers},${m.paperPassengers},${m.totalPassengers},${m.digitalRevenue},${m.paperRevenue},${m.digitalRevenue + m.paperRevenue},${m.priceRwf}`,
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

  // WhatsApp Summary - uses real manifest + booking math to report accurate pax + revenue totals
  const handleWhatsApp = () => {
    const reportTypeLabel = reportType === "urugendo" ? "Urugendo Digital Report" : "Station Manifest Report";
    const branchStr = getBranchName(selectedBranch);

    let text: string;
    if (reportType === "urugendo") {
      text = `*Bus Operator - Urugendo Digital Report*\n\nPeriod: ${selectedDate} (${filterPeriod})\nDigital Tickets Issued: ${filteredBookings.length}\nTotal Digital Revenue: ${urugendoRevenue.toLocaleString()} RWF\n\nAll-Time Digital: ${totalBookingsAllTime} tickets (${totalRevenueAllTime.toLocaleString()} RWF)`;
    } else {
      const totalDigital = filteredManifest.reduce((acc, m) => acc + (m.urugendoPassengers ?? 0), 0);
      const totalPaper = filteredManifest.reduce(
        (acc, m) => acc + Math.max(0, (m.totalPassengers ?? 0) - (m.urugendoPassengers ?? 0)),
        0,
      );
      const totalOnboard = totalDigital + totalPaper;
      const manifestRev = filteredManifest.reduce((acc, m) => {
        const paperPax = Math.max(0, (m.totalPassengers ?? 0) - (m.urugendoPassengers ?? 0));
        const price = typeof (m as any).priceRwf === "number" ? (m as any).priceRwf : 0;
        return acc + paperPax * price + ((m as any).digitalRevenue ?? 0);
      }, 0);
      text = `*Bus Operator - Station Manifest Report*\n\nBranch: ${branchStr}\nPeriod: ${selectedDate} (${filterPeriod})\nBuses Manifested: ${filteredManifest.length}\n\nUrugendo Digital Onboard: ${totalDigital}\nPaper Ticket Onboard: ${totalPaper}\nTotal Passengers: ${totalOnboard}\n\nManifest Revenue (Digital + Paper): ${manifestRev.toLocaleString()} RWF`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (userRole !== "agent") return null;

  if (loading) {
    return (
      <div className="bg-surface-secondary min-h-screen flex flex-col items-center justify-center text-text-primary">
        <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <div className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          Generating Analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary text-text-primary pb-28 font-sans">
      {/* Brand Header Bar */}
      <div className="bg-primary text-white sticky top-0 z-30 shadow-card">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/agency")}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-white/80 uppercase font-bold block">
                ANALYTICS & MANIFEST ENGINE
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Agency Reports
              </h1>
            </div>
          </div>

          <button
            onClick={() => void loadData()}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 mt-6 space-y-5">
        {/* Toggle Switcher */}
        <div className="bg-white p-1 rounded-2xl border border-border flex gap-1.5 shadow-card">
          <button
            onClick={() => setReportType("urugendo")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${
              reportType === "urugendo"
                ? "bg-primary text-white shadow-primary"
                : "text-text-muted hover:text-text-primary hover:bg-surface-secondary"
            }`}
          >
            <Ticket size={15} /> Digital Tickets
          </button>

          <button
            onClick={() => setReportType("manifest")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${
              reportType === "manifest"
                ? "bg-primary text-white shadow-primary"
                : "text-text-muted hover:text-text-primary hover:bg-surface-secondary"
            }`}
          >
            <Bus size={15} /> Bus Manifest
          </button>
        </div>

        {/* Dynamic Control Console */}
        <div className="bg-white rounded-2xl border border-border p-4 space-y-3 shadow-card">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            {/* Styled Date Calendar Input */}
            <div className="flex items-center gap-2 bg-surface-secondary px-3.5 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors flex-1 min-w-[190px]">
              <Calendar size={16} className="text-primary shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-text-primary focus:outline-none w-full cursor-pointer font-sans"
              />
            </div>

            {/* Period Selector */}
            <div className="flex items-center bg-surface-secondary p-1 rounded-xl border border-border">
              {(["day", "month", "year"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setFilterPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                    filterPeriod === period
                      ? "bg-white text-primary shadow-sm border border-border"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Styled Station Branch Dropdown */}
            {reportType === "manifest" && (
              <div className="flex items-center gap-2 bg-surface-secondary px-3.5 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors focus-within:ring-2 focus-within:ring-primary/20">
                <Building2 size={15} className="text-primary shrink-0" />
                <select
                  value={getBranchName(selectedBranch)}
                  onChange={(e) =>
                    setSelectedBranch(e.target.value as AgencyBranch | "All")
                  }
                  className="bg-transparent text-xs font-bold text-text-primary focus:outline-none cursor-pointer pr-1"
                >
                  <option value="All">All Branches</option>
                  {BRANCHES.map((b) => {
                    const bName = getBranchName(b);
                    return (
                      <option key={bName} value={bName}>
                        {bName} Station
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Bus Search Field */}
          {reportType === "manifest" && (
            <div className="flex items-center gap-2 bg-surface-secondary px-3 py-2 rounded-xl border border-border focus-within:border-primary/50 transition-colors">
              <Search size={15} className="text-text-muted shrink-0" />
              <input
                type="text"
                placeholder="Search bus plate (e.g. RAD100B), driver name, route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none w-full font-medium"
              />
            </div>
          )}
        </div>

        {/* SECTION 1: URUGENDO DIGITAL TICKETS REPORT */}
        {reportType === "urugendo" && (
          <div className="bg-white rounded-2xl border border-border p-4 space-y-4 shadow-card">
            {/* Digital Title Header */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Ticket size={18} className="text-primary" />
                  Digital Booking Record
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Showing {filteredBookings.length} digital transactions for{" "}
                  {selectedDate}
                </p>
              </div>
              <span className="bg-badge-green-bg text-badge-green-text text-[10px] font-bold px-3 py-1 rounded-full border border-badge-green-text/20">
                Verified Online
              </span>
            </div>

            {/* Horizontal Scrollable Cards Container */}
            <div className="relative group">
              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth py-1"
              >
                <div className="min-w-[calc(50%-6px)] max-w-[calc(50%-6px)] snap-start bg-surface-secondary/70 p-3.5 rounded-2xl border border-border shadow-sm flex-shrink-0">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 truncate">
                    Tickets Issued
                  </div>
                  <div className="text-xl font-extrabold text-text-primary">
                    {filteredBookings.length}
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 capitalize truncate">
                    {filterPeriod} report
                  </div>
                </div>

                <div className="min-w-[calc(50%-6px)] max-w-[calc(50%-6px)] snap-start bg-surface-secondary/70 p-3.5 rounded-2xl border border-border shadow-sm flex-shrink-0">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 truncate">
                    Digital Revenue
                  </div>
                  <div className="text-xl font-extrabold text-primary truncate">
                    {urugendoRevenue.toLocaleString()}
                    <span className="text-[10px] text-text-muted ml-0.5 font-normal">
                      RWF
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 truncate">
                    Excludes paper
                  </div>
                </div>

                <div className="min-w-[calc(50%-6px)] max-w-[calc(50%-6px)] snap-start bg-surface-secondary/70 p-3.5 rounded-2xl border border-border shadow-sm flex-shrink-0">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 truncate">
                    All-Time Tickets
                  </div>
                  <div className="text-xl font-extrabold text-text-primary">
                    {totalBookingsAllTime}
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 truncate">
                    Total sales
                  </div>
                </div>

                <div className="min-w-[calc(50%-6px)] max-w-[calc(50%-6px)] snap-start bg-surface-secondary/70 p-3.5 rounded-2xl border border-border shadow-sm flex-shrink-0">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 truncate">
                    All-Time Revenue
                  </div>
                  <div className="text-xl font-extrabold text-text-primary truncate">
                    {totalRevenueAllTime.toLocaleString()}
                    <span className="text-[10px] text-text-muted ml-0.5 font-normal">
                      RWF
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 truncate">
                    Total digital
                  </div>
                </div>
              </div>

              {/* Circle Scroll Arrow Button */}
              <button
                onClick={handleScrollRight}
                className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-border shadow-md rounded-full flex items-center justify-center text-primary hover:bg-surface-secondary active:scale-95 transition-all"
                aria-label="Scroll right"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: STATION MANIFEST REPORT */}
        {reportType === "manifest" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-border shadow-card">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                <span className="text-xs font-bold text-text-primary">
                  Branch Selected:{" "}
                  <strong className="text-primary">
                    {getBranchName(selectedBranch)}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-bold text-text-muted bg-surface-secondary px-3 py-1 rounded-lg border border-border">
                {filteredManifest.length} Buses Listed
              </span>
            </div>

            {/* Manifest Table */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-secondary text-text-muted text-[10.5px] font-bold uppercase tracking-wider border-b border-border">
                      <th className="py-3.5 px-4 font-bold">Date</th>
                      <th className="py-3.5 px-4 font-bold">Departure</th>
                      <th className="py-3.5 px-4 font-bold">Arrival ETA</th>
                      <th className="py-3.5 px-4 font-bold">Trip Route</th>
                      <th className="py-3.5 px-4 font-bold">Driver Name</th>
                      <th className="py-3.5 px-4 font-bold">Bus Plate</th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Empty Seats
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center text-primary">
                        Urugendo Digital
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center text-indigo-600">
                        Paper Tickets
                      </th>
                      <th className="py-3.5 px-4 font-bold text-center">
                        Total Onboard
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs text-text-primary">
                    {filteredManifest.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-12 text-center text-text-muted text-xs"
                        >
                          No bus departures recorded for{" "}
                          {getBranchName(selectedBranch)} on this date.
                        </td>
                      </tr>
                    ) : (
                      filteredManifest.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-surface-secondary transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-text-muted font-semibold whitespace-nowrap">
                            {m.date}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-text-primary whitespace-nowrap">
                            {m.departureTime}
                          </td>
                          <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                            {m.arrivalTime}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-primary whitespace-nowrap">
                            {m.trip}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-text-secondary whitespace-nowrap">
                            {m.driverName}
                          </td>
                          <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                            <span className="bg-badge-amber-bg text-badge-amber-text px-2 py-0.5 rounded-md font-mono">
                              {m.busPlate}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-badge-red-text whitespace-nowrap">
                            {m.emptySeats}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-badge-green-text bg-badge-green-bg/30 whitespace-nowrap">
                            {m.urugendoPassengers}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold whitespace-nowrap text-indigo-600 bg-indigo-50/40">
                            {m.paperPassengers}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-text-primary whitespace-nowrap">
                            {m.totalPassengers} / {m.capacity ?? 29}
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

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={
              reportType === "urugendo"
                ? handleExportUrugendo
                : handleExportManifest
            }
            className="flex-1 bg-primary hover:bg-primary-hover text-white py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-primary active:scale-[0.98] transition-all"
          >
            <Download size={16} /> Export
          </button>

          <button
            onClick={handleWhatsApp}
            className="flex-1 bg-white hover:bg-surface-secondary text-primary border border-border py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition-all"
          >
            <Share size={16} /> Share via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
