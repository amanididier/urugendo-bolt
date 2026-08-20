"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Clock,
  Ticket,
  MapPin,
  TrendingUp,
  DollarSign,
  Search,
  CheckCircle,
  Bus,
  Save,
  Phone,
  User,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  CheckCircle2,
  Armchair,
  Users,
} from "lucide-react";
import {
  fetchTripsByDate,
  fetchAllBookings,
  updateBookingStatus,
  updateTripStatus,
} from "@/lib/api";
import type { Trip, Booking, AgencyBranch } from "@/lib/types";

export interface ExtendedBooking extends Omit<Partial<Booking>, "status"> {
  id: string;
  passengerName?: string;
  passengerPhone?: string;
  seatNumber?: string;
  totalAmount?: number;
  status?: string;
  trip?: any;
  momoName?: string;
  momoNumber?: string;
  shortCode?: string;
  createdAt?: string;
}

interface PendingMoMoPayment {
  id: string;
  momoName: string;
  momoNumber: string;
  passengerName: string;
  tripRoute: string;
  date: string;
  amount: number;
  status: "pending" | "confirmed";
  shortCode: string;
}

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

const getBranchName = (branch: AgencyBranch | string): string =>
  typeof branch === "string" ? branch : branch?.name || "Musanze";

export default function AgencyDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<ExtendedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "today" | "schedule" | "verify" | "manifest"
  >("today");
  const [manifestSubTab, setManifestSubTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );

  const [searchSeat, setSearchSeat] = useState("");
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    booking?: ExtendedBooking;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Agency Session Context
  const [agentBranch, setAgentBranch] = useState("Musanze");
  const [, setOperatorId] = useState("");

  const [emptySeats, setEmptySeats] = useState<Record<string, number>>({
    "out-1": 3,
    "out-2": 1,
  });
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Load logged-in station details
    const branch = localStorage.getItem("urugendo_branch") || "Musanze";
    const opId = localStorage.getItem("urugendo_operator_id") || "";
    setAgentBranch(branch);
    setOperatorId(opId);

    const savedEmptySeats = localStorage.getItem("urugendo_empty_seats");
    if (savedEmptySeats) {
      try {
        setEmptySeats(JSON.parse(savedEmptySeats));
      } catch (e) {
        console.error("Failed to parse saved empty seats", e);
      }
    }

    async function loadDashboardData() {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const [todayTrips, allBookings] = await Promise.all([
          fetchTripsByDate(todayStr),
          fetchAllBookings(),
        ]);
        if (isMounted) {
          setTrips(todayTrips || []);
          setBookings((allBookings as ExtendedBooking[]) || []);
        }
      } catch (error) {
        console.error("Failed to fetch agency dashboard data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveEmptySeats = (tripId: string) => {
    localStorage.setItem("urugendo_empty_seats", JSON.stringify(emptySeats));
    setSavedFeedback(tripId);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const exportStyledExcelReport = () => {
    const branchName = getBranchName(agentBranch);
    const isIncoming = manifestSubTab === "incoming";

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
        <p style="color: #64748B; font-size: 11px; margin-top: 0;">Mode: <b>${manifestSubTab.toUpperCase()}</b> | Generated: ${new Date().toLocaleString()}</p>
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
      `manifest-${manifestSubTab}-${branchName.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.xls`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendingMoMoPayments: PendingMoMoPayment[] = bookings
    .filter((b) => b.status === "pending" || b.status === "payment_submitted")
    .map((b) => {
      const tripObj = b.trip && typeof b.trip === "object" ? b.trip : null;
      const createdDate = b.createdAt ? new Date(b.createdAt) : new Date();

      return {
        id: b.id,
        momoName: b.momoName || "MTN Subscriber",
        momoNumber: b.momoNumber || b.passengerPhone || "0780000000",
        passengerName: b.passengerName || "Passenger",
        tripRoute: tripObj
          ? `${tripObj.from} → ${tripObj.to}`
          : `${agentBranch} Route`,
        date: createdDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        amount: b.totalAmount || 5000,
        status: "pending",
        shortCode: b.shortCode || b.id.substring(0, 6).toUpperCase(),
      };
    });

  const activeBookings = bookings.filter((b) => b.status !== "cancelled");
  const todayRevenue = activeBookings.reduce(
    (sum, b) => sum + (b.totalAmount || 0),
    0,
  );

  const stats = {
    todayBookings: activeBookings.length,
    todayRevenue,
    totalBuses:
      new Set(trips.map((t) => t.plateNumber || t.id).filter(Boolean)).size ||
      12,
    activeRoutes: new Set(trips.map((t) => `${t.from}-${t.to}`)).size || 5,
  };

  const handleVerifySearch = () => {
    if (!searchSeat.trim()) {
      setVerifyResult(null);
      return;
    }
    const query = searchSeat.toUpperCase().trim();
    const found = bookings.find((b) => {
      return (
        b.seatNumber?.toUpperCase() === query ||
        b.id.toUpperCase().includes(query) ||
        b.passengerName?.toUpperCase().includes(query) ||
        b.shortCode?.toUpperCase() === query
      );
    });

    setVerifyResult({ found: !!found, booking: found });
  };

  const handleConfirmMoMoPayment = async (bookingId: string) => {
    setVerifying(true);
    const success = await updateBookingStatus(bookingId, "confirmed" as any);
    if (success) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "confirmed" } : b,
        ),
      );
    }
    setVerifying(false);
  };

  const handleMarkAsBoardedUsed = async (bookingId: string) => {
    setVerifying(true);
    const success = await updateBookingStatus(bookingId, "boarded" as any);
    if (success) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "boarded" } : b)),
      );
    }
    setVerifying(false);
  };

  const handleMarkDelayed = async (tripId: string) => {
    const success = await updateTripStatus(tripId, "delayed" as any);
    if (success) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId ? { ...t, status: "delayed" as Trip["status"] } : t,
        ),
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "boarding":
        return "bg-green-100 text-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-700";
      case "departed":
        return "bg-gray-100 text-gray-600";
      case "arrived":
        return "bg-green-100 text-green-700";
      case "delayed":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-secondary pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-[88px] min-h-screen font-sans">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px] print:hidden">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🚌
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">
              Agency Dashboard
            </h1>
            <p className="text-[12px] text-white/80 font-medium">
              Virunga Express • {agentBranch} Station
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.todayBookings}
            </div>
            <div className="text-[8px] text-white/70">Today</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {(stats.todayRevenue / 1000).toFixed(0)}K
            </div>
            <div className="text-[8px] text-white/70">Revenue</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.totalBuses}
            </div>
            <div className="text-[8px] text-white/70">Buses</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">
              {stats.activeRoutes}
            </div>
            <div className="text-[8px] text-white/70">Routes</div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 print:hidden">
        <div className="bg-white rounded-xl p-1 border border-border flex shadow-sm">
          {(["today", "schedule", "verify", "manifest"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab === "today"
                ? "Today"
                : tab === "schedule"
                  ? "Schedule"
                  : tab === "verify"
                    ? "Verify"
                    : "Manifest"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "today" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-gradient-to-r from-emerald-600 to-primary rounded-2xl p-4 text-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-white/80 font-medium">
                Today&apos;s Revenue
              </span>
              <DollarSign size={18} className="text-white/80" />
            </div>
            <div className="text-[28px] font-extrabold">
              {stats.todayRevenue.toLocaleString()} RWF
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-white/90">
              <TrendingUp size={14} />
              <span>{stats.todayBookings} confirmed bookings today</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket size={14} className="text-primary" />
                </div>
                <span className="text-[10px] font-medium text-text-muted">
                  Urugendo Online
                </span>
              </div>
              <div className="text-[20px] font-bold text-primary">
                {stats.todayBookings}
              </div>
              <div className="text-[9px] text-text-muted">Digital tickets</div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Ticket size={14} className="text-amber-600" />
                </div>
                <span className="text-[10px] font-medium text-text-muted">
                  Paper Tickets
                </span>
              </div>
              <div className="text-[20px] font-bold text-amber-600">
                Counter
              </div>
              <div className="text-[9px] text-text-muted">Manual bookings</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("schedule")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Add Schedule
              </span>
            </button>
            <button
              onClick={() => setActiveTab("verify")}
              className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Search size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">
                Verify Ticket
              </span>
            </button>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="px-4 mt-4">
          <button
            onClick={() => router.push("/agency/schedule")}
            className="w-full bg-primary text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold mb-4 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
          >
            <Plus size={18} />
            Add New Departure
          </button>

          {trips.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[13px]">
              No trips scheduled for today
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip, i) => {
                const tripBookings = bookings.filter((b) => {
                  const bTripId =
                    typeof b.trip === "string" ? b.trip : b.trip?.id;
                  return bTripId === trip.id && b.status !== "cancelled";
                });
                const bookedCount = tripBookings.length;

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl border border-border overflow-hidden shadow-sm"
                  >
                    <div className="px-4 py-2 bg-surface-secondary flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-text-muted" />
                        <span className="text-[13px] font-bold text-text-primary">
                          {trip.departureTime}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          → {trip.arrivalTime || "Calc"}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(
                          trip.status || "scheduled",
                        )}`}
                      >
                        {(trip.status || "SCHEDULED").toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-primary" />
                          <span className="text-[12px] font-semibold text-text-primary">
                            {trip.from} → {trip.to}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-text-muted bg-gray-100 px-2 py-0.5 rounded">
                          {trip.plateNumber || "RAC 302 C"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-primary">
                              {bookedCount}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Booked
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-green-600">
                              {Math.max(
                                0,
                                (trip.totalSeats || 29) - bookedCount,
                              )}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Remaining
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-text-muted">
                              {trip.totalSeats || 29}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              Total
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {trip.status !== "delayed" && (
                            <button
                              onClick={() => handleMarkDelayed(trip.id)}
                              className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100 cursor-pointer"
                            >
                              Mark Delayed
                            </button>
                          )}
                          <div className="text-right">
                            <div className="text-[14px] font-bold text-text-primary">
                              {(trip.price * bookedCount).toLocaleString()}
                            </div>
                            <div className="text-[8px] text-text-muted">
                              RWF
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "verify" && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-white rounded-xl border border-border p-3.5 shadow-sm">
            <h3 className="text-[13px] font-bold text-text-primary mb-2">
              Lookup Ticket or Seat
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchSeat}
                  onChange={(e) => setSearchSeat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySearch()}
                  placeholder="Enter Seat Number, Ticket Code, or Name"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleVerifySearch}
                className="bg-primary text-white px-4 rounded-xl font-bold text-[12px] shadow-sm active:scale-95 transition-transform cursor-pointer"
              >
                Search
              </button>
            </div>

            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 p-3 rounded-xl border ${
                  verifyResult.found
                    ? verifyResult.booking?.status === "boarded"
                      ? "bg-gray-100 border-gray-300 text-gray-500"
                      : "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {verifyResult.found && verifyResult.booking ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px]">
                          {verifyResult.booking.passengerName}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            verifyResult.booking.status === "boarded"
                              ? "bg-gray-200 text-gray-600 line-through"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {verifyResult.booking.shortCode ||
                            verifyResult.booking.id
                              .substring(0, 6)
                              .toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Seat: {verifyResult.booking.seatNumber || "N/A"} •
                        Amount:{" "}
                        {verifyResult.booking.totalAmount?.toLocaleString()} RWF
                      </div>
                    </div>
                    {verifyResult.booking.status === "boarded" ? (
                      <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                        EXPIRED / USED
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handleMarkAsBoardedUsed(verifyResult.booking!.id)
                        }
                        disabled={verifying}
                        className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm hover:bg-primary-dark cursor-pointer"
                      >
                        Verify & Board
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-[12px] font-medium text-center">
                    No matching booking found for &quot;{searchSeat}&quot;
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-extrabold text-text-primary flex items-center gap-1.5">
                <AlertCircle size={16} className="text-amber-500" />
                Submitted MoMo Payments ({pendingMoMoPayments.length})
              </h3>
              <span className="text-[10px] text-text-muted">
                Instant Receiver
              </span>
            </div>

            {pendingMoMoPayments.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-6 text-center text-text-muted text-[12px]">
                No pending MoMo payment confirmations at the moment.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMoMoPayments.map((momo) => (
                  <motion.div
                    key={momo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border-2 border-amber-300 p-3.5 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-amber-400 text-amber-950 font-bold text-[9px] px-2 py-0.5 rounded-bl-lg">
                      MTN MoMo
                    </div>

                    <div className="flex items-start justify-between pr-12 mb-2">
                      <div>
                        <div className="text-[13px] font-bold text-text-primary flex items-center gap-1">
                          <User size={13} className="text-text-muted" />
                          {momo.passengerName}
                        </div>
                        <div className="text-[11px] font-mono text-gray-600 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-text-muted" />
                          <span className="font-semibold text-text-primary">
                            MoMo Name:
                          </span>{" "}
                          <span className="font-bold text-amber-700">
                            {momo.momoName}
                          </span>{" "}
                          ({momo.momoNumber})
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-amber-50/60 p-2 rounded-lg mb-3 border border-amber-100">
                      <div>
                        <span className="text-text-muted block text-[9px]">
                          Trip
                        </span>
                        <span className="font-bold text-text-primary">
                          {momo.tripRoute}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[9px]">
                          Amount Paid
                        </span>
                        <span className="font-extrabold text-green-700">
                          {momo.amount.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-[10px] text-text-muted">
                        {momo.date}
                      </span>
                      <button
                        onClick={() => handleConfirmMoMoPayment(momo.id)}
                        disabled={verifying}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      >
                        <CheckCircle size={14} />
                        Confirm Payment
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-[13px] font-bold text-text-primary mb-3">
              Today&apos;s Verified & Boarded Tickets ({bookings.length})
            </h3>
            {bookings.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-[12px]">
                No verified tickets yet
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => {
                  const isBoardedUsed = b.status === "boarded";
                  const code =
                    b.shortCode || b.id.substring(0, 6).toUpperCase();

                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isBoardedUsed
                          ? "bg-gray-100/80 border-gray-200 text-gray-500"
                          : "bg-surface-secondary border-border text-text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                            isBoardedUsed
                              ? "bg-gray-200 text-gray-500 line-through"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {b.seatNumber || "A1"}
                        </div>
                        <div className="truncate">
                          <div
                            className={`text-[12px] font-semibold truncate ${
                              isBoardedUsed ? "line-through text-gray-500" : ""
                            }`}
                          >
                            {b.passengerName}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                isBoardedUsed
                                  ? "bg-gray-200 text-gray-500 line-through decoration-red-500"
                                  : "bg-primary/10 text-primary font-bold"
                              }`}
                            >
                              {code}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {b.totalAmount?.toLocaleString()} RWF
                            </span>
                          </div>
                        </div>
                      </div>

                      {isBoardedUsed ? (
                        <span className="text-[10px] font-extrabold text-gray-400 bg-gray-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          EXPIRED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkAsBoardedUsed(b.id)}
                          disabled={verifying}
                          className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/20 cursor-pointer"
                        >
                          Mark Boarded
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manifest" && (
        <div className="px-4 mt-4 space-y-3">
          {/* Manifest Sub-navigation Tabs */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setManifestSubTab("incoming")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                manifestSubTab === "incoming"
                  ? "bg-[#00B14F] text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ArrowDownLeft size={16} /> Incoming Buses ({INITIAL_INCOMING.length})
            </button>

            <button
              onClick={() => setManifestSubTab("outgoing")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                manifestSubTab === "outgoing"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ArrowUpRight size={16} /> Outgoing / Departed ({INITIAL_OUTGOING.length})
            </button>
          </div>

          {/* Manifest Content */}
          <div className="space-y-3">
            {manifestSubTab === "incoming"
              ? INITIAL_INCOMING.map((trip) => {
                  const paperTickets = Math.max(
                    0,
                    trip.capacity - trip.urugendoPassengers,
                  );
                  return (
                    <div
                      key={trip.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
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
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
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
                              setEmptySeats((prev) => ({
                                ...prev,
                                [trip.id]: Math.min(
                                  trip.capacity,
                                  Math.max(0, Number(e.target.value)),
                                ),
                              }))
                            }
                            className="w-16 bg-white border border-slate-300 rounded-lg py-1 px-2 text-center font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#00B14F] focus:outline-none"
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
              className="w-full mt-4 bg-[#00B14F] hover:bg-[#00B14F]/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Generate Printable Manifest ({manifestSubTab})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}