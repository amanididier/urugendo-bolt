"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Clock,
  Ticket,
  MapPin,
  TrendingUp,
  DollarSign,
  Search,
  CheckCircle,
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
  ShieldCheck,
  Bell,
  ChevronRight,
} from "lucide-react";
import {
  fetchTripsByDate,
  fetchAllBookings,
  fetchBookingById,
  updateBookingStatus,
  updateTripStatus,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
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

const getBranchName = (branch: AgencyBranch | string): string =>
  typeof branch === "string" ? branch : branch?.name || "Musanze";

const cleanStationName = (name: string) =>
  name
    .toLowerCase()
    .replace(/branch|station/g, "")
    .trim();

// Apple-style helper to save user notification into localStorage (Rule 3)
const addUserNotification = (title: string, message: string) => {
  try {
    const existing = localStorage.getItem("urugendo_user_notifications");
    const parsed = existing ? JSON.parse(existing) : [];
    const newNotif = {
      id: `notif-${Date.now()}`,
      title,
      message,
      type: "booking",
      read: false,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(
      "urugendo_user_notifications",
      JSON.stringify([newNotif, ...parsed]),
    );
  } catch {
    // Ignore storage issues
  }
};

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

  const [agentBranch, setAgentBranch] = useState("Musanze");
  const [, setOperatorId] = useState("");

  const [emptySeats, setEmptySeats] = useState<Record<string, number>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Added states for real-time agent verification status checks & Apple-designed pending modals
  const [agentStatus, setAgentStatus] = useState<string>("approved");
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const unreadCount = 3;

  // Added Supabase Real-Time Agent Approval Listener & Session Guard
  useEffect(() => {
    let channel: any = null;

    async function checkAgentApprovalStatus() {
      try {
        const storedAgentEmail =
          localStorage.getItem("urugendo_agent_email") ||
          localStorage.getItem("urugendo_user_email");
        if (!storedAgentEmail) return;

        const { data, error } = await supabase
          .from("agents")
          .select("status, branch, id")
          .eq("email", storedAgentEmail)
          .single();

        if (!error && data) {
          setAgentStatus(data.status);
          if (data.status === "pending") {
            setShowApprovalModal(true);
          } else {
            setShowApprovalModal(false);
          }
        }

        // Setup real-time subscription for instant manager approval feedback
        channel = supabase
          .channel(`agent-status-${storedAgentEmail}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "agents",
              filter: `email=eq.${storedAgentEmail}`,
            },
            (payload: any) => {
              const updated = payload.new;
              if (updated && updated.status) {
                setAgentStatus(updated.status);
                if (updated.status === "approved") {
                  setShowApprovalModal(false);
                } else if (updated.status === "pending") {
                  setShowApprovalModal(true);
                }
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.error("Error checking agent status:", err);
      }
    }

    checkAgentApprovalStatus();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

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
          const currentStation = cleanStationName(branch);

          const branchTrips = (todayTrips || []).filter((t) => {
            const fromStation = cleanStationName(t.from || "");
            const toStation = cleanStationName(t.to || "");
            return (
              fromStation.includes(currentStation) ||
              toStation.includes(currentStation)
            );
          });

          const branchBookings = (
            (allBookings as ExtendedBooking[]) || []
          ).filter((b) => {
            const tripObj =
              b.trip && typeof b.trip === "object" ? b.trip : null;
            const tripFrom = tripObj?.from
              ? cleanStationName(tripObj.from)
              : "";
            return tripFrom.includes(currentStation) || !tripFrom;
          });

          setTrips(branchTrips);
          setBookings(branchBookings);
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

  const currentStationKey = cleanStationName(agentBranch);

  const stationIncoming: ManifestTrip[] = trips
    .filter((t) => cleanStationName(t.to || "").includes(currentStationKey))
    .map((t, idx) => ({
      id: `inc-${t.id || idx}`,
      busPlate: t.plateNumber || "RAC 112D",
      driverName: t.driverName || "Station Driver",
      from: t.from,
      to: getBranchName(agentBranch),
      time: t.arrivalTime || t.departureTime,
      capacity: t.totalSeats || 29,
      urugendoPassengers: bookings.filter(
        (b) =>
          (typeof b.trip === "object" ? b.trip?.id : b.trip) === t.id &&
          b.status !== "cancelled",
      ).length,
      status: t.status || "In Transit",
    }));

  const stationOutgoing: ManifestTrip[] = trips
    .filter((t) => cleanStationName(t.from || "").includes(currentStationKey))
    .map((t, idx) => ({
      id: `out-${t.id || idx}`,
      busPlate: t.plateNumber || "RAD 882D",
      driverName: t.driverName || "Station Driver",
      from: getBranchName(agentBranch),
      to: t.to,
      time: t.departureTime,
      capacity: t.totalSeats || 29,
      urugendoPassengers: bookings.filter(
        (b) =>
          (typeof b.trip === "object" ? b.trip?.id : b.trip) === t.id &&
          b.status !== "cancelled",
      ).length,
      status: t.status || "Scheduled",
    }));

  const handleSaveEmptySeats = (tripId: string) => {
    localStorage.setItem("urugendo_empty_seats", JSON.stringify(emptySeats));
    setSavedFeedback(tripId);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const exportStyledExcelReport = () => {
    const branchName = getBranchName(agentBranch);
    const isIncoming = manifestSubTab === "incoming";
    const activeList = isIncoming ? stationIncoming : stationOutgoing;

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
      ? activeList
          .map((trip, idx) => {
            const paperTickets = Math.max(
              0,
              trip.capacity - trip.urugendoPassengers,
            );
            const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            return `
            <Row ss:Height="22" style="background-color: ${bg}; font-size: 11px;">
              <Cell style="background-color: #ECFDF5; color: #059669; font-weight: bold; text-align: center;"><Data ss:Type="String">INCOMING</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.busPlate}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.driverName}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.from}</Data></Cell>
              <Cell><Data ss:Type="String">${branchName}</Data></Cell>
              <Cell style="font-weight: bold; color: #00B14F;"><Data ss:Type="String">${trip.time}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${trip.capacity}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold; color: #00B14F;"><Data ss:Type="Number">${trip.urugendoPassengers}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${paperTickets}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="String">${trip.status}</Data></Cell>
            </Row>`;
          })
          .join("")
      : activeList
          .map((trip, idx) => {
            const empty = emptySeats[trip.id] ?? 0;
            const paperTickets = Math.max(
              0,
              trip.capacity - trip.urugendoPassengers - empty,
            );
            const totalOnboard = trip.urugendoPassengers + paperTickets;
            const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            return `
            <Row ss:Height="22" style="background-color: ${bg}; font-size: 11px;">
              <Cell style="background-color: #FEF2F2; color: #DC2626; font-weight: bold; text-align: center;"><Data ss:Type="String">DEPARTED</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.busPlate}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.driverName}</Data></Cell>
              <Cell><Data ss:Type="String">${branchName}</Data></Cell>
              <Cell><Data ss:Type="String">${trip.to}</Data></Cell>
              <Cell style="font-weight: bold;"><Data ss:Type="String">${trip.time}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${trip.capacity}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold; color: #00B14F;"><Data ss:Type="Number">${trip.urugendoPassengers}</Data></Cell>
              <Cell style="text-align: center; color: #D97706; font-weight: bold;"><Data ss:Type="Number">${empty}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="Number">${paperTickets}</Data></Cell>
              <Cell style="text-align: center; font-weight: bold;"><Data ss:Type="String">${totalOnboard}/${trip.capacity}</Data></Cell>
              <Cell style="text-align: center;"><Data ss:Type="String">${trip.status}</Data></Cell>
            </Row>`;
          })
          .join("");

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:html="http://www.w3.org/TR/REC-html40">
        <Styles>
          <Style ss:ID="Header">
            <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
            <Interior ss:Color="#00B14F" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
          </Style>
        </Styles>
        <Worksheet ss:Name="Manifest Report">
          <Table ss:ExpandedColumnCount="${tableHeaders.length}" ss:FullColumns="1" ss:FullRows="1" ss:DefaultColumnWidth="110" ss:DefaultRowHeight="20">
            <Row ss:Height="26">
              <Cell ss:StyleID="Header" ss:MergeAcross="${tableHeaders.length - 1}">
                <Data ss:Type="String">URUGENDO EXPRESS — STATION MANIFEST (${manifestSubTab.toUpperCase()})</Data>
              </Cell>
            </Row>
            <Row ss:Height="18">
              <Cell><Data ss:Type="String">Branch: ${branchName} | Generated: ${new Date().toLocaleString()}</Data></Cell>
            </Row>
            <Row ss:Height="24">
              ${tableHeaders
                .map(
                  (header) =>
                    `<Cell ss:StyleID="Header"><Data ss:Type="String">${header}</Data></Cell>`,
                )
                .join("")}
            </Row>
            ${tableRows}
          </Table>
        </Worksheet>
      </Workbook>`;

    const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" });
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
  const todayRevenue = activeBookings.reduce((sum, b) => {
    const isConfirmedOrBoarded =
      b.status === "confirmed" || b.status === "boarded";
    if (!isConfirmedOrBoarded) return sum;
    const tripObj = b.trip && typeof b.trip === "object" ? b.trip : null;
    const tripFrom = tripObj?.from
      ? cleanStationName(tripObj.from)
      : currentStationKey;
    if (tripFrom.includes(currentStationKey)) {
      return sum + (b.totalAmount || tripObj?.price || 0);
    }
    return sum;
  }, 0);

  const stats = {
    todayBookings: activeBookings.length,
    todayRevenue,
    totalBuses: new Set(trips.map((t) => t.plateNumber || t.id).filter(Boolean))
      .size,
    activeRoutes: new Set(
      trips.map(
        (t) =>
          `${cleanStationName(t.from || "")}-${cleanStationName(t.to || "")}`,
      ),
    ).size,
  };

  const handleVerifySearch = async () => {
    if (!searchSeat.trim()) {
      setVerifyResult(null);
      return;
    }
    setVerifying(true);
    const query = searchSeat.toUpperCase().trim();

    let found = bookings.find((b) => {
      return (
        b.seatNumber?.toUpperCase() === query ||
        (b.seat && String(b.seat).toUpperCase() === query) ||
        b.id.toUpperCase().includes(query) ||
        b.passengerName?.toUpperCase().includes(query) ||
        b.shortCode?.toUpperCase() === query
      );
    });

    if (!found) {
      const remoteBooking = await fetchBookingById(query);
      if (remoteBooking) {
        const tripFrom = remoteBooking.trip?.from
          ? cleanStationName(remoteBooking.trip.from)
          : "";
        if (tripFrom.includes(currentStationKey) || !tripFrom) {
          found = {
            ...remoteBooking,
            seatNumber: remoteBooking.seat,
          };
        }
      }
    }

    setVerifyResult({ found: !!found, booking: found });
    setVerifying(false);
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
      // Trigger notification according to Rule 3 copy specification
      addUserNotification(
        "Ticket Verified!",
        "Your ticket from Musanze to Kigali (08:30 AM) has been received and verified! You may check it in your tickets page.",
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
      if (verifyResult?.booking?.id === bookingId) {
        setVerifyResult((prev) =>
          prev
            ? {
                ...prev,
                booking: prev.booking
                  ? { ...prev.booking, status: "boarded" }
                  : undefined,
              }
            : null,
        );
      }
      // Trigger notification for verified ticket
      addUserNotification(
        "Ticket Verified!",
        "Your ticket from Musanze to Kigali (08:30 AM) has been received and verified! You may check it in your tickets page.",
      );
    }
    setVerifying(false);
  };

  const handleMarkDelayed = async (tripId: string) => {
    const success = await updateTripStatus(tripId, "delayed" as any);
    if (success) {
      const targetTrip = trips.find((t) => t.id === tripId);
      const destination = targetTrip?.to || "Rubavu";
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId ? { ...t, status: "delayed" as Trip["status"] } : t,
        ),
      );
      // Broadcast notification to passengers booked on this specific trip
      const tripBookings = bookings.filter((b) => {
        const bTripId = typeof b.trip === "string" ? b.trip : b.trip?.id;
        return bTripId === tripId && b.status !== "cancelled";
      });
      tripBookings.forEach(() => {
        addUserNotification(
          "Trip Alert",
          `⚠️ Trip Alert: Your trip to ${destination} has been delayed for 15 minutes due to heavy rainfall on the road. We appreciate your patience!`,
        );
      });
      // Also dispatch a custom event for global background listeners
      window.dispatchEvent(
        new CustomEvent("urugendo-trip-delayed", {
          detail: { tripId, destination },
        }),
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
        <div className="text-text-muted text-[14px]">
          Loading station dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-[88px] min-h-screen font-sans relative">
      {/* Apple-designed Glassmorphism Pending Status Guard Modal */}
      <AnimatePresence>
        {agentStatus === "pending" && showApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Clock size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Approval Pending
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your account has been submitted to the agency management. Wait
                  for approval. You may exit the app; we&apos;ll notify you when
                  you&apos;re approved.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => router.push("/")}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Exit to Home
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px] print:hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              🚌
            </div>
            <div>
              <h1 className="text-[20px] font-extrabold text-white">
                Agency Dashboard
              </h1>
              <p className="text-[12px] text-white/80 font-medium">
                Virunga Express • {agentBranch}
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push("/agency/agency-notifications")}
            className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center relative ring-1 ring-white/20 active:scale-90 transition-transform cursor-pointer"
            aria-label="Agency Notifications"
          >
            <Bell size={20} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-primary">
                {unreadCount}
              </span>
            )}
          </button>
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
                Today&apos;s Revenue ({agentBranch})
              </span>
              <DollarSign size={18} className="text-white/80" />
            </div>
            <div className="text-[28px] font-extrabold">
              {stats.todayRevenue.toLocaleString()} RWF
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-white/90">
              <TrendingUp size={14} />
              <span>{stats.todayBookings} station bookings today</span>
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
            Add New Departure from {agentBranch}
          </button>

          {trips.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[13px]">
              No departures scheduled for {agentBranch} today
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
                    onClick={() =>
                      router.push(`/agency/schedules?tripId=${trip.id}`)
                    }
                    className="bg-white rounded-xl border border-border overflow-hidden shadow-sm hover:border-primary cursor-pointer transition-all"
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(
                            trip.status || "scheduled",
                          )}`}
                        >
                          {(trip.status || "SCHEDULED").toUpperCase()}
                        </span>
                        <ChevronRight size={14} className="text-text-muted" />
                      </div>
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

                      <div className="mb-2 bg-emerald-50/70 border border-emerald-100 rounded-lg p-2 text-[11px] flex items-center justify-between">
                        <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <Users size={13} className="text-emerald-600" />
                          Urugendo Passengers:
                        </span>
                        <span className="font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md shadow-2xs">
                          {bookedCount} subscribed
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkDelayed(trip.id);
                              }}
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
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-primary" size={20} />
              <h3 className="text-[14px] font-bold text-text-primary">
                Ticket Verification ({agentBranch})
              </h3>
            </div>

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
                  placeholder="Enter Ticket Code, Seat No, or Name"
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <button
                onClick={handleVerifySearch}
                disabled={verifying}
                className="bg-primary text-white px-4 rounded-xl font-bold text-[12px] shadow-sm active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
              >
                {verifying ? "Searching..." : "Verify"}
              </button>
            </div>

            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-xl border ${
                  verifyResult.found
                    ? verifyResult.booking?.status === "boarded"
                      ? "bg-gray-100 border-gray-300 text-gray-600"
                      : "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                {verifyResult.found && verifyResult.booking ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between border-b border-gray-200/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[15px] text-text-primary">
                            {verifyResult.booking.passengerName}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${
                              verifyResult.booking.status === "boarded"
                                ? "bg-gray-200 text-gray-600 line-through"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {verifyResult.booking.shortCode ||
                              verifyResult.booking.id
                                .substring(0, 6)
                                .toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[12px] text-text-muted mt-0.5">
                          Phone: {verifyResult.booking.passengerPhone || "N/A"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">
                          Seat Number
                        </span>
                        <span className="text-[18px] font-extrabold text-primary">
                          {verifyResult.booking.seatNumber ||
                            verifyResult.booking.seat ||
                            "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          Route / Trip
                        </span>
                        <span className="font-semibold text-text-primary">
                          {verifyResult.booking.trip?.from || "Origin"} →{" "}
                          {verifyResult.booking.trip?.to || "Destination"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          Fare Paid
                        </span>
                        <span className="font-bold text-emerald-700">
                          {verifyResult.booking.totalAmount?.toLocaleString() ||
                            verifyResult.booking.trip?.price?.toLocaleString() ||
                            "2,500"}{" "}
                          RWF
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      {verifyResult.booking.status === "boarded" ? (
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-3 py-1.5 rounded-full uppercase">
                          EXPIRED / ALREADY BOARDED
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            handleMarkAsBoardedUsed(verifyResult.booking!.id)
                          }
                          disabled={verifying}
                          className="bg-primary hover:bg-primary/90 text-white text-[12px] font-extrabold px-4 py-2 rounded-xl shadow-sm cursor-pointer transition-colors"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] font-medium text-center py-2">
                    No matching booking found at {agentBranch} for &quot;
                    {searchSeat}&quot;
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
            </div>

            {pendingMoMoPayments.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-6 text-center text-text-muted text-[12px]">
                No pending MoMo payment confirmations at {agentBranch}.
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
                        confirm
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manifest" && (
        <div className="px-4 mt-4 space-y-3">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl flex gap-1.5 backdrop-blur-md border border-slate-200/60 shadow-inner">
            <button
              onClick={() => setManifestSubTab("incoming")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                manifestSubTab === "incoming"
                  ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <ArrowDownLeft
                size={15}
                className={
                  manifestSubTab === "incoming"
                    ? "text-[#00B14F]"
                    : "text-slate-400"
                }
              />
              <span>Incoming</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  manifestSubTab === "incoming"
                    ? "bg-emerald-100 text-[#00B14F]"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {stationIncoming.length}
              </span>
            </button>

            <button
              onClick={() => setManifestSubTab("outgoing")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                manifestSubTab === "outgoing"
                  ? "bg-white text-slate-900 shadow-sm font-bold scale-[1.01]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
              }`}
            >
              <ArrowUpRight
                size={15}
                className={
                  manifestSubTab === "outgoing"
                    ? "text-[#00B14F]"
                    : "text-slate-400"
                }
              />
              <span>Departed</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  manifestSubTab === "outgoing"
                    ? "bg-emerald-100 text-[#00B14F]"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {stationOutgoing.length}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {manifestSubTab === "incoming"
              ? stationIncoming.map((trip) => {
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
              : stationOutgoing.map((trip) => {
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
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            OUTBOUND TO {trip.to.toUpperCase()}
                          </span>
                          <h2 className="text-base font-black text-slate-900">
                            Bus {trip.busPlate}
                          </h2>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            Driver: {trip.driverName} · Departed: {trip.time}
                          </p>
                        </div>
                        <span className="bg-red-50/90 text-red-600 border border-red-100/80 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
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
                            className="w-16 bg-[#ffffff] border border-slate-300 rounded-lg py-1 px-2 text-center font-bold text-xs text-slate-800 focus:ring-2 focus:ring-[#00B14F] focus:outline-none"
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

            <button
              onClick={exportStyledExcelReport}
              className="w-full mt-4 bg-[#00B14F] hover:bg-[#00B14F]/90 text-white font-bold py-3.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide cursor-pointer"
            >
              <FileSpreadsheet size={16} /> Generate Printable Manifest (
              {manifestSubTab})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
