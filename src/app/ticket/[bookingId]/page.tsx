"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useApp } from "@/context/app-context";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Clock,
  Bus,
  Phone,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  Share2,
  Calendar,
  Sparkles,
  Info,
  Car,
  QrCode,
  ShieldCheck,
  CheckCheck,
  Edit3,
} from "lucide-react";
import { fetchBookingById } from "@/lib/api";
import type { Booking } from "@/lib/types";

// Agency Contact Details
const VIRUNGA_PHONE = "+250782490611";
const VIRUNGA_WHATSAPP = "250782490611";

// Multilingual Translations Dictionary
const translations = {
  en: {
    eTicket: "E-Ticket",
    bookingConfirmed: "Booking Confirmed",
    verificationPending: "Verification Pending",
    paymentUnverified: "Payment Unverified",
    ticketMissed: "Trip Missed",
    ticketUsed: "Ticket Used",
    passActive: "Your digital bus pass is active",
    passMissed: "Departure time has passed",
    passUsed: "This ticket was verified & used",
    momoPending: "MoMo payment is being verified",
    recordNotFound: "Record not found by agency",
    paymentInProgress: "Payment Verification in Progress",
    momoNotice:
      "Agents are cross-checking your MoMo payment. If delayed, contact support below.",
    from: "FROM",
    to: "TO",
    seat: "Seat",
    ticketCode: "YOUR TICKET CODE",
    scanPrompt: "Scan QR at terminal gate for instant boarding",
    departure: "Departure",
    arrival: "Arrival",
    date: "Date",
    plateNo: "Plate No.",
    passenger: "Passenger",
    momoAccount: "MoMo Account",
    totalPaid: "Total Paid",
    downloadTicket: "Download",
    downloading: "Generating...",
    shareTicket: "Share Ticket",
    linkCopied: "Link Copied!",
    aboutTrip: "About This Trip",
    tripDescription:
      "A scenic journey through Rwanda's beautiful landscape. The route passes through terraced hills and local villages with brief terminal stops.",
    needHelp: "Need Help with",
    helpDesc: `Contact agency support directly at ${VIRUNGA_PHONE} for route inquiries or status assistance.`,
    whatsapp: "WhatsApp",
    callAgency: "Call Agency",
    loading: "Loading e-ticket...",
    notFoundTitle: "Ticket Not Found",
    notFoundDesc: "We couldn't retrieve booking details for",
    backToTickets: "Back to Tickets",
  },
  rw: {
    eTicket: "Ikarita Y'urugendo",
    bookingConfirmed: "Urugendo Yaremejwe",
    verificationPending: "Kugenzura Biracyakorwa",
    paymentUnverified: "Kwishyura Ntibyemejwe",
    ticketMissed: "Urugendo Rwacitse",
    ticketUsed: "Ikarita Yakoreshejwe",
    passActive: "Ikarita yawe ya mu bus irakora",
    passMissed: "Igihe cyo guhaguruka cyararenze",
    passUsed: "Ikarita yegenzuwe n'abayobozi",
    momoPending: "Ikwishyuza rya MoMo riracyasuzumwa",
    recordNotFound: "Ntitwashoboye kubona amakuru mu buyobozi",
    paymentInProgress: "Gusuzuma Kwishyura Biragenda Korwa",
    momoNotice:
      "Aba agent barimo baragenzura kwishyura kwa MoMo. Niba bitinze, hamagara ubufasha bukurikira.",
    from: "KUVA",
    to: "KUGERA",
    seat: "Icyafuraha",
    ticketCode: "ICODE Y'IKARITA YAWE",
    scanPrompt: "Sikana kugira ngo wemezwe ku irembo",
    departure: "Guhaguruka",
    arrival: "Kugera",
    date: "Itariki",
    plateNo: "Pulaaki",
    passenger: "Umugenzi",
    momoAccount: "Konti ya MoMo",
    totalPaid: "Ayishyuwe Yose",
    downloadTicket: "Manura",
    downloading: "Gukora PDF...",
    shareTicket: "Sangiza Ikarita",
    linkCopied: "Ihuza Ryakopywe!",
    aboutTrip: "Ibyerekeye Uru Rugendo",
    tripDescription:
      "Urugendo rwiza mu birunga no mu cyaro cya Rwanda. Bisi ihagarara mu nzira igihe gito ku bitegyerezo byagenwe.",
    needHelp: "Ukeneye Ubufasha kuri",
    helpDesc: `Hamagara abakozi ba agence kuri ${VIRUNGA_PHONE} ku bindi bisobanuro n'ubufasha bw'urugendo.`,
    whatsapp: "WhatsApp",
    callAgency: "Hamagara Agence",
    loading: "Ikarita irimo kurundwa...",
    notFoundTitle: "Ikarita Ntiyabonetse",
    notFoundDesc: "Ntitwashoboye kubona amakuru y'itike",
    backToTickets: "Subira ku Matike",
  },
};

function getCityName(city?: string, fallback = "Kigali"): string {
  if (!city) return fallback;
  const trimmed = city.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getTerminalName(city?: string): string {
  if (!city) return "Nyabugogo Terminal";
  const c = city.toLowerCase();
  if (c.includes("kigali")) return "Nyabugogo Terminal";
  if (c.includes("musanze")) return "Musanze Terminal";
  if (c.includes("huye") || c.includes("butare")) return "Huye Bus Terminal";
  if (c.includes("rubavu") || c.includes("gisenyi"))
    return "Rubavu Main Station";
  return `${getCityName(city)} Central Terminal`;
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useApp();

  const langKey = language === "rw" ? "rw" : "en";
  const t = translations[langKey];

  const rawId = (params.bookingId ||
    params.boking ||
    params.booking ||
    params.id) as string;
  const bookingId = rawId ? decodeURIComponent(rawId) : "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [liveTime, setLiveTime] = useState("");

  // Passenger Name Customization States
  const [passengerNameInput, setPassengerNameInput] = useState("");
  const [isSavedName, setIsSavedName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  const pdfCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toTimeString().split(" ")[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadTicket() {
      setLoading(true);
      try {
        let found = await fetchBookingById(bookingId);

        if (!found) {
          const guestBookings = localStorage.getItem("guest_bookings");
          if (guestBookings) {
            const parsed: Booking[] = JSON.parse(guestBookings);
            found =
              parsed.find(
                (b) => b.id === bookingId || b.shortCode === bookingId,
              ) || null;
          }
        }

        if (!found) {
          const latest = localStorage.getItem("latest_booking");
          if (latest) {
            const parsed: Booking = JSON.parse(latest);
            if (parsed.id === bookingId || parsed.shortCode === bookingId) {
              found = parsed;
            }
          }
        }

        if (found) {
          setBooking(found);
          setPassengerNameInput(
            found.passengerName || found.momoAccountName || "Passenger",
          );
        }
      } catch (err) {
        console.error("Error loading ticket details:", err);
      } finally {
        setLoading(false);
      }
    }

    if (bookingId) loadTicket();
  }, [bookingId]);

  const handleSavePassengerName = () => {
    if (!booking || !passengerNameInput.trim()) return;

    const updatedBooking = {
      ...booking,
      passengerName: passengerNameInput.trim(),
    };

    setBooking(updatedBooking);
    setIsSavedName(true);
    setNameSavedSuccess(true);
    setTimeout(() => setNameSavedSuccess(false), 2500);

    // Persist saved name across local storage
    try {
      const latest = localStorage.getItem("latest_booking");
      if (latest) {
        const parsed: Booking = JSON.parse(latest);
        if (
          parsed.id === booking.id ||
          parsed.shortCode === booking.shortCode
        ) {
          localStorage.setItem(
            "latest_booking",
            JSON.stringify({
              ...parsed,
              passengerName: passengerNameInput.trim(),
            }),
          );
        }
      }

      const guestBookings = localStorage.getItem("guest_bookings");
      if (guestBookings) {
        const parsed: Booking[] = JSON.parse(guestBookings);
        const updatedList = parsed.map((b) =>
          b.id === booking.id || b.shortCode === booking.shortCode
            ? { ...b, passengerName: passengerNameInput.trim() }
            : b,
        );
        localStorage.setItem("guest_bookings", JSON.stringify(updatedList));
      }
    } catch (e) {
      console.error("Failed to update passenger name in localStorage", e);
    }
  };

  const copyShortCode = () => {
    if (booking?.shortCode) {
      navigator.clipboard.writeText(booking.shortCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      `Hello Virunga Express, I am inquiring about my booking ID: ${
        booking?.shortCode || bookingId
      }.`,
    );
    window.open(`https://wa.me/${VIRUNGA_WHATSAPP}?text=${message}`, "_blank");
  };

  const callAgency = () => {
    window.open(`tel:${VIRUNGA_PHONE}`, "_self");
  };

  // High-Resolution PDF Generator
  const handleDownload = async () => {
    if (!pdfCardRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      const element = pdfCardRef.current;

      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: "#FFFFFF",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdf = new jsPDF("landscape", "mm", "a5");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 6;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (img.height * contentWidth) / img.width;
      const yOffset = (pdfHeight - contentHeight) / 2;

      pdf.addImage(
        dataUrl,
        "PNG",
        margin,
        yOffset,
        contentWidth,
        contentHeight,
      );
      pdf.save(`BoardingPass-${booking?.shortCode || "Pass"}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Could not generate PDF download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Bus Ticket - ${booking?.shortCode || "Virunga Express"}`,
      text: `My ticket from ${getCityName(booking?.trip?.from)} to ${getCityName(
        booking?.trip?.to,
      )}. Code: ${booking?.shortCode}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share cancelled", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
        <p className="text-[13px] text-slate-500 animate-pulse font-semibold">
          {t.loading}
        </p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-3">🎫</div>
        <h2 className="text-[17px] font-bold text-slate-900 mb-1">
          {t.notFoundTitle}
        </h2>
        <p className="text-[13px] text-slate-500 mb-5">
          {t.notFoundDesc} &quot;{bookingId}&quot;.
        </p>
        <button
          onClick={() => router.push("/tickets")}
          className="bg-[#00B14F] text-white text-[13px] font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-[#009643] transition-colors"
        >
          {t.backToTickets}
        </button>
      </div>
    );
  }

  // Ticket Status State Logic
  const status = (booking.status || "confirmed").toLowerCase();
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const isMissed = status === "missed";
  const isUsed = status === "used";

  const operatorName = booking.trip?.operator?.name || "Virunga Express";
  const plateNumber = booking.trip?.plateNumber || "RAD 100B";
  const busType = booking.trip?.busType || "Coaster Express";

  const fromCity = getCityName(booking.trip?.from, "Kigali");
  const toCity = getCityName(booking.trip?.to, "Musanze");
  const fromTerminal = getTerminalName(booking.trip?.from);
  const toTerminal = getTerminalName(booking.trip?.to);

  const qrPayload = JSON.stringify({
    code: booking.shortCode,
    passenger: booking.passengerName,
    route: `${fromCity}-${toCity}`,
    seat: booking.seat || "3C",
    agency: operatorName,
    status: booking.status || "confirmed",
  });

  return (
    <div className="min-h-screen bg-slate-100/80 pb-12 font-sans antialiased">
      {/* Off-Screen Clean Pass Template (Captured for PDF Download) */}
      <div className="fixed -left-[9999px] top-0 pointer-events-none">
        <div
          ref={pdfCardRef}
          className="w-[840px] bg-white rounded-[28px] overflow-hidden p-0 font-sans shadow-2xl relative border-2 border-emerald-600/30 text-slate-900"
        >
          {/* Top Brand Green Header */}
          <div className="bg-[#00B14F] text-white px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                ⛰️
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white uppercase leading-none">
                  {operatorName}
                </h1>
                <p className="text-xs text-emerald-100 font-semibold tracking-wide mt-1">
                  URUGENDO OFFICIAL DIGITAL PASS
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-sm ${
                  isMissed
                    ? "bg-amber-500 text-white"
                    : isUsed
                      ? "bg-slate-800 text-slate-100"
                      : isRejected
                        ? "bg-rose-700 text-white"
                        : isPending
                          ? "bg-amber-400 text-slate-900"
                          : "bg-white text-[#00B14F]"
                }`}
              >
                <ShieldCheck size={15} />
                {isMissed
                  ? "MISSED PASS"
                  : isUsed
                    ? "USED PASS"
                    : isRejected
                      ? "UNVERIFIED"
                      : isPending
                        ? "PENDING"
                        : "CONFIRMED PASS"}
              </span>
            </div>
          </div>

          {/* Clean Main Pass Content */}
          <div className="p-6 bg-slate-50/60 grid grid-cols-12 gap-4 items-stretch">
            {/* Left Section - Route & Details Grid */}
            <div className="col-span-8 flex flex-col justify-between pr-2 border-r border-dashed border-slate-200">
              {/* Route Indicator */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs mb-3">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    DEPARTURE
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {fromCity}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {fromTerminal}
                  </p>
                </div>

                <div className="flex flex-col items-center px-3">
                  <span className="text-[11px] font-extrabold text-[#00B14F] mb-0.5">
                    {booking.trip?.duration || "2h 00m"}
                  </span>
                  <div className="flex items-center gap-1 text-slate-300">
                    <div className="w-8 h-[2px] bg-emerald-200 rounded-full" />
                    <Bus size={15} className="text-[#00B14F]" />
                    <div className="w-8 h-[2px] bg-emerald-200 rounded-full" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Direct Express
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                    DESTINATION
                  </span>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {toCity}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {toTerminal}
                  </p>
                </div>
              </div>

              {/* Structured Ticket Details */}
              <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    PASSENGER
                  </span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {booking.passengerName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    DATE & TIME
                  </span>
                  <p className="text-sm font-bold text-slate-900">
                    {booking.trip?.date || booking.bookingDate}
                  </p>
                  <p className="text-xs font-bold text-[#00B14F]">
                    {booking.trip?.departureTime || "22:00"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    ASSIGNED SEAT
                  </span>
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-[#00B14F] font-black text-sm rounded-lg border border-emerald-200">
                    SEAT {booking.seat || "3C"}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    BUS PLATE
                  </span>
                  <p className="text-xs font-bold text-slate-700">
                    {plateNumber}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    VEHICLE CLASS
                  </span>
                  <p className="text-xs font-bold text-slate-700">{busType}</p>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                    TOTAL FARE
                  </span>
                  <p className="text-sm font-black text-[#00B14F]">
                    {booking.totalAmount?.toLocaleString() ||
                      booking.trip?.price ||
                      "5,000"}{" "}
                    RWF
                  </p>
                </div>
              </div>
            </div>

            {/* Dedicated Clear QR Verification Box */}
            <div className="col-span-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col items-center justify-center text-center">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center mb-2">
                <QRCodeCanvas
                  value={qrPayload}
                  size={150}
                  bgColor={"#FFFFFF"}
                  fgColor={"#0F172A"}
                  level={"H"}
                  includeMargin={false}
                />
              </div>

              <div className="w-full space-y-1">
                <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase block">
                  BOOKING REFERENCE
                </span>
                <div className="text-xl font-black font-mono tracking-widest text-[#00B14F] bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                  {booking.shortCode}
                </div>
                <p className="text-[9.5px] text-slate-400 font-semibold pt-1">
                  Scan QR at terminal gate for instant boarding
                </p>
              </div>
            </div>
          </div>

          {/* Clean Footer */}
          <div className="px-8 py-2.5 bg-slate-900 text-slate-300 text-[11px] font-semibold flex items-center justify-between border-t border-slate-800">
            <span>Issued via Urugendo Digital Ticketing System</span>
            <span>Support: {VIRUNGA_PHONE}</span>
          </div>
        </div>
      </div>

      {/* Mobile App Header Banner */}
      <div
        className={`pt-5 pb-7 px-4 text-white transition-colors relative rounded-b-3xl shadow-md ${
          isRejected
            ? "bg-rose-600"
            : isMissed
              ? "bg-amber-600"
              : isUsed
                ? "bg-slate-700"
                : isPending
                  ? "bg-amber-500"
                  : "bg-[#00B14F]"
        }`}
      >
        <div className="flex items-center justify-between mb-3 max-w-md mx-auto">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-1 text-[13px] font-semibold tracking-wide opacity-90">
            <span>{t.eTicket}</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
              {langKey.toUpperCase()}
            </span>
          </div>
          <div className="w-8" />
        </div>

        <div className="flex items-center justify-center gap-3 text-center max-w-md mx-auto">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0">
            {isRejected ? (
              <XCircle size={20} className="text-white" />
            ) : isMissed ? (
              <AlertCircle size={20} className="text-white" />
            ) : isUsed ? (
              <CheckCheck size={22} className="text-white opacity-90" />
            ) : isPending ? (
              <AlertCircle size={20} className="text-white" />
            ) : (
              <CheckCircle2 size={22} className="text-white" />
            )}
          </div>
          <div className="text-left">
            <h1 className="text-[15px] font-black tracking-tight text-white uppercase leading-tight">
              {isRejected
                ? t.paymentUnverified
                : isMissed
                  ? t.ticketMissed
                  : isUsed
                    ? t.ticketUsed
                    : isPending
                      ? t.verificationPending
                      : t.bookingConfirmed}
            </h1>
            <p className="text-[11px] text-white/90 font-medium leading-none mt-0.5">
              {isRejected
                ? t.recordNotFound
                : isMissed
                  ? t.passMissed
                  : isUsed
                    ? t.passUsed
                    : isPending
                      ? t.momoPending
                      : t.passActive}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content View Area */}
      <div className="px-3.5 mt-3 space-y-3 max-w-md mx-auto">
        {/* Pending Notice Banner */}
        {isPending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl space-y-1 shadow-2xs"
          >
            <div className="flex items-center gap-2 text-amber-900 font-bold text-[13px]">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
              <span>{t.paymentInProgress}</span>
            </div>
            <p className="text-[11.5px] text-amber-700 leading-tight">
              {t.momoNotice}
            </p>
          </motion.div>
        )}

        {/* Visible Mobile App Ticket Pass */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm p-0">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-100/80 flex items-center justify-center text-[14px] shadow-2xs">
                ⛰️
              </div>
              <div>
                <h3 className="font-bold text-[13.5px] text-slate-900 leading-none">
                  {operatorName}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <Bus size={11} className="text-slate-400" />
                  <span>{busType}</span>
                </p>
              </div>
            </div>
            <Sparkles size={15} className="text-slate-400" />
          </div>

          <div className="p-3.5 border-b border-dashed border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-1">
              <div className="text-left flex-1 min-w-0">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block">
                  {t.from}
                </span>
                <h2 className="text-[17px] font-black text-slate-900 leading-tight truncate">
                  {fromCity}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {fromTerminal}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center px-1 min-w-[95px] flex-shrink-0">
                <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-[#00B14F] px-2 py-0.5 rounded-full text-[10.5px] font-bold mb-1 shadow-2xs">
                  <span>💺</span>
                  <span>
                    {t.seat} {booking.seat || "3C"}
                  </span>
                </div>
                <div className="w-full flex items-center justify-center gap-1 text-slate-300">
                  <div className="h-[1.5px] bg-slate-200 flex-1 rounded-full" />
                  <span className="text-[11px] font-bold text-[#00B14F]">
                    →
                  </span>
                  <div className="h-[1.5px] bg-slate-200 flex-1 rounded-full" />
                </div>
                <span className="text-[9.5px] font-bold text-slate-400 mt-0.5">
                  {booking.trip?.duration || "2h 00m"}
                </span>
              </div>

              <div className="text-right flex-1 min-w-0">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block">
                  {t.to}
                </span>
                <h2 className="text-[17px] font-black text-slate-900 leading-tight truncate">
                  {toCity}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {toTerminal}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-center flex flex-col items-center justify-center">
              <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                {t.ticketCode}
              </span>

              <div className="flex items-center justify-center gap-2 mt-0.5">
                <span className="text-[28px] font-black tracking-wider text-[#7C3AED]">
                  {booking.shortCode}
                </span>
                <button
                  onClick={copyShortCode}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl active:scale-95 transition-transform"
                >
                  {copied ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-slate-500 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>{liveTime || "10:48:52"}</span>
              </div>
            </div>

            {/* Clear QR Code Display Section */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-center">
                <QRCodeCanvas
                  value={qrPayload}
                  size={140}
                  bgColor={"#FFFFFF"}
                  fgColor={"#0F172A"}
                  level={"M"}
                  includeMargin={false}
                />
              </div>
              <span className="text-[10px] font-semibold text-slate-500 mt-2 flex items-center gap-1">
                <QrCode size={12} className="text-slate-400" />
                {t.scanPrompt}
              </span>
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-2 gap-2.5 border-b border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#00B14F] flex items-center justify-center flex-shrink-0">
                <Clock size={15} />
              </div>
              <div>
                <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  {t.departure}
                </div>
                <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                  {booking.trip?.departureTime || "22:00"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#00B14F] flex items-center justify-center flex-shrink-0">
                <Clock size={15} />
              </div>
              <div>
                <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  {t.arrival}
                </div>
                <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                  {booking.trip?.arrivalTime || "00:00"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#00B14F] flex items-center justify-center flex-shrink-0">
                <Calendar size={15} />
              </div>
              <div>
                <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  {t.date}
                </div>
                <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                  {booking.trip?.date || booking.bookingDate || "2026-08-14"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#00B14F] flex items-center justify-center flex-shrink-0">
                <Car size={15} />
              </div>
              <div>
                <div className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                  {t.plateNo}
                </div>
                <div className="text-[12.5px] font-bold text-slate-900 leading-tight truncate max-w-[100px]">
                  {plateNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Passenger Information & Editing Box */}
          <div className="p-3.5 bg-slate-50/90 space-y-2 text-[12px]">
            {/* Helper Notice Banner (Hidden on saved ticket & download) */}
            {!isSavedName && (
              <div className="bg-amber-50 border border-amber-200/80 p-2.5 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <Info
                  size={14}
                  className="text-amber-600 flex-shrink-0 mt-0.5"
                />
                <span>
                  You can change the passenger name below if you used another
                  MoMo account or booked for someone else. Click{" "}
                  <strong>Save</strong> when done.
                </span>
              </div>
            )}

            {nameSavedSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                <span>Passenger name saved successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-medium">{t.passenger}:</span>
              <div className="flex items-center gap-1.5 flex-1 justify-end">
                <input
                  type="text"
                  value={passengerNameInput}
                  onChange={(e) => setPassengerNameInput(e.target.value)}
                  placeholder="Enter passenger name"
                  className="font-bold text-slate-900 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1 text-right focus:outline-none focus:ring-2 focus:ring-[#00B14F] text-[12.5px] max-w-[170px]"
                />
                <button
                  onClick={handleSavePassengerName}
                  className="bg-[#00B14F] hover:bg-[#009643] text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1 active:scale-95 shadow-2xs"
                >
                  <Check size={12} />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {booking.momoAccountName && (
              <div className="flex justify-between items-center text-[11.5px]">
                <span className="text-slate-400 font-medium">
                  {t.momoAccount}:
                </span>
                <span className="font-semibold text-slate-700">
                  {booking.momoAccountName}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">{t.totalPaid}:</span>
              <span className="font-black text-[#00B14F] text-[14px]">
                {booking.totalAmount?.toLocaleString() ||
                  booking.trip?.price ||
                  "5,000"}{" "}
                RWF
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200/70 flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#00B14F] hover:bg-[#009643] text-white font-bold text-[13px] py-2.5 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm"
          >
            <Download size={15} />
            <span>{isDownloading ? t.downloading : t.downloadTicket}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] py-2.5 rounded-xl transition-colors active:scale-[0.98]"
          >
            {shared ? (
              <Check size={15} className="text-emerald-600" />
            ) : (
              <Share2 size={15} />
            )}
            <span>{shared ? t.linkCopied : t.shareTicket}</span>
          </button>
        </div>

        {/* About Trip Info Box */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-800 font-bold text-[13px]">
            <Info size={15} className="text-blue-600" />
            <span>{t.aboutTrip}</span>
          </div>
          <p className="text-[11.5px] text-blue-700/90 leading-relaxed">
            {t.tripDescription}
          </p>
        </div>

        {/* Agency Support Box */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 space-y-2.5 shadow-sm">
          <div>
            <div className="text-[13px] font-bold text-slate-900">
              {t.needHelp} {operatorName}?
            </div>
            <p className="text-[11.5px] text-slate-500 leading-tight mt-0.5">
              {t.helpDesc}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={openWhatsApp}
              className="flex items-center justify-center gap-1.5 bg-[#00B14F] text-white font-bold text-[12.5px] py-2 rounded-xl hover:bg-[#009643] active:scale-95 transition-all shadow-2xs"
            >
              <MessageCircle size={15} /> {t.whatsapp}
            </button>
            <button
              onClick={callAgency}
              className="flex items-center justify-center gap-1.5 bg-slate-900 text-white font-bold text-[12.5px] py-2 rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-2xs"
            >
              <Phone size={15} /> {t.callAgency}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
