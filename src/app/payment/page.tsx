"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Phone,
  AlertCircle,
  Loader2,
  Clock,
  Pencil,
  Check,
  Users,
  ChevronDown,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { formatPrice, generateShortCode } from "@/lib/data";
import {
  createBooking,
  decrementAvailableSeats,
  normalizePhone,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/translations";

type PayState =
  | "idle"
  | "initiating"
  | "awaiting_approval"
  | "polling"
  | "success"
  | "failed";

export default function PaymentPage() {
  const router = useRouter();
  const {
    selectedTrip,
    selectedSeat,
    addBooking,
    language,
    isLoggedIn,
    userName,
    userPhone,
    search,
    groupPassengers,
    setGroupPassengers,
  } = useApp();

  const [phone, setPhone] = useState(userPhone || "");
  const [momoName, setMomoName] = useState(userName || "");
  const [editablePassengerName, setEditablePassengerName] = useState(
    userName || "Traveler",
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [state, setState] = useState<PayState>("idle");
  const [error, setError] = useState("");
  const [, setReferenceId] = useState("");
  const [branchMomoCode, setBranchMomoCode] = useState("5129401");

  // Group booking modal state & dropdown toggle state
  const groupCount = search.passengers > 1 ? search.passengers : 1;
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [tempGroupNames, setTempGroupNames] = useState<string[]>([]);
  const [verificationPopup, setVerificationPopup] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Pilot Phase Signup Notification Popup State (Rule 2)
  const [showPilotPopup, setShowPilotPopup] = useState(false);

  // Guard: Automatically redirect to login if not logged in & trigger pilot popup
  useEffect(() => {
    const savedLogin =
      typeof window !== "undefined"
        ? localStorage.getItem("urugendo_is_logged_in")
        : null;
    const effectiveLoggedIn = isLoggedIn || savedLogin === "true";

    if (!effectiveLoggedIn) {
      // Fast-trigger modal within 0.5 seconds as requested by Rule 2
      const timer = setTimeout(() => {
        setShowPilotPopup(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  // Load branch momo code from agency profile storage sync
  useEffect(() => {
    const storedBranchMomo =
      localStorage.getItem("urugendo_branch_momo") ||
      localStorage.getItem("urugendo_momo_code");
    if (storedBranchMomo) {
      setBranchMomoCode(storedBranchMomo);
    }
  }, []);

  useEffect(() => {
    if (userName && !editablePassengerName) {
      setEditablePassengerName(userName);
      setMomoName(userName);
    }
  }, [userName, editablePassengerName]);

  // Prompt for group names on mount if passengers > 1
  useEffect(() => {
    if (groupCount > 1 && groupPassengers.length === 0) {
      setShowGroupModal(true);
      setTempGroupNames(Array(groupCount - 1).fill(""));
    }
  }, [groupCount, groupPassengers.length]);

  if (!selectedTrip || !selectedSeat) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20 font-sans">
        <div className="text-4xl mb-4">🎟️</div>
        <h2 className="text-[20px] font-bold text-slate-900 mb-2">
          {t("noBooking", language)}
        </h2>
        <button
          onClick={() => router.push("/home")}
          className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px] cursor-pointer"
        >
          {t("backToHome", language)}
        </button>
      </div>
    );
  }

  const isFreePromo = isLoggedIn;
  const bookingFee = isFreePromo ? 0 : Math.round(selectedTrip.price * 0.025);
  const perPersonTotal = selectedTrip.price + bookingFee;
  const total = perPersonTotal * groupCount;

  const operatorObj =
    typeof selectedTrip.operator === "object" && selectedTrip.operator !== null
      ? selectedTrip.operator
      : null;
  const operatorEmoji = operatorObj?.emoji || "🚌";
  const operatorName =
    operatorObj?.name ||
    (typeof selectedTrip.operator === "string"
      ? selectedTrip.operator
      : "Bus Operator");

  const functionUrl = `${
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  }/functions/v1/mtn-payment`;

  const pollPaymentStatus = async (refId: string): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(
          `${functionUrl}?action=status&referenceId=${refId}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token || ""}`,
              apikey:
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                process.env.VITE_SUPABASE_ANON_KEY ||
                "",
            },
          },
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "success") return true;
        if (data.status === "failed") return false;
      } catch {
        // network hiccup, keep polling
      }
      attempts++;
    }
    return false;
  };

  const handlePay = async () => {
    setError("");
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError("Enter a valid MTN number (e.g. 0788123456 or 250788123456)");
      return;
    }
    if (!momoName.trim()) {
      setError(
        "Please enter the exact name registered on your MTN MoMo account.",
      );
      return;
    }

    setState("initiating");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "";

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          bookingId: selectedTrip.id,
          amount: total,
          phone: cleanPhone,
          currency: "RWF",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Payment request failed");
      }

      const data = await res.json();
      setReferenceId(data.referenceId);
      setState("awaiting_approval");

      setState("polling");
      const success = await pollPaymentStatus(data.referenceId);

      if (success) {
        const shortCode = generateShortCode();
        const bookingPayload = {
          trip: selectedTrip,
          seat: selectedSeat,
          passengerName: editablePassengerName,
          passengerPhone: cleanPhone,
          momoName: momoName,
          momoNumber: cleanPhone,
          shortCode,
          paymentMethod: "MTN MoMo",
          totalAmount: total,
          bookingFee,
          status: "pending",
          bookingDate: new Date().toISOString().split("T")[0],
          groupPassengers: groupPassengers,
        };

        const localBookingId = addBooking(bookingPayload);
        const dbBookingId = await createBooking(bookingPayload);
        await decrementAvailableSeats(selectedTrip.id);

        setState("success");
        setVerificationPopup(true);

        const navigateId = dbBookingId || localBookingId;
        setTimeout(() => {
          setVerificationPopup(false);
          router.push(`/tickets?pending=true&id=${navigateId}`);
        }, 3000);
      } else {
        setState("failed");
        setError("Payment was not approved or timed out. Please try again.");
      }
    } catch (err) {
      setState("failed");
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  };

  return (
    <div className="bg-white min-h-screen font-sans pb-32">
      {/* Pilot Phase Free Sign-Up Notification Popup (Rule 2) */}
      <AnimatePresence>
        {showPilotPopup && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowPilotPopup(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Sparkles size={24} />
              </div>
              <h3 className="text-[18px] font-black text-slate-900 mb-2">
                {language === "RW"
                  ? "Inyungu za Pilot 🎉"
                  : "Pilot Phase Perk 🎉"}
              </h3>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-5">
                {language === "RW"
                  ? "Twagabanyije amafaranga y'itike ukwezi kose! Iyandikishe cyangwa winjire ubu kugira ngo ubike itike yawe ubuntu mbemeza kwishyura."
                  : "We're waiving the 3% booking service fee for the entire month! Sign up or log in now to lock in your free booking instantly before confirming your payment."}
              </p>
              <div className="space-y-2.5">
                <button
                  onClick={() => router.push("/user-login?redirect=/payment")}
                  className="w-full h-12 bg-primary text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {language === "RW"
                    ? "Injira / Iyandikishe"
                    : "Quick Phone/Email Sign In"}{" "}
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          redirectTo: `${window.location.origin}/payment`,
                        },
                      });
                    } catch {
                      router.push("/user-login?redirect=/payment");
                    }
                  }}
                  className="w-full h-12 bg-slate-100 text-slate-900 font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.17 21.32 7.23 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.18C.43 8.12 0 9.82 0 12s.43 3.88 1.18 5.4l4.09-3.16z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.18 6.6l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  {language === "RW"
                    ? "Injiriha ukoresheje Google"
                    : "1-Tap Google Sign-in"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Names Modal Popup */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-[18px] font-black text-slate-900">
                  {language === "RW"
                    ? `Amazina y'Abagenzi ({groupCount} Abagenzi)`
                    : `Group Booking Names (${groupCount} Passengers)`}
                </h3>
                <p className="text-[12px] text-slate-500">
                  {language === "RW"
                    ? "Nyamuneka andika amazina y'abandi bagenzi bari kumwe nawe."
                    : "Please provide the names of additional group members."}
                </p>
              </div>
            </div>

            <div className="space-y-3 my-4">
              {tempGroupNames.map((nameVal, idx) => (
                <div key={idx}>
                  <label className="text-[12px] font-bold text-slate-700 block mb-1">
                    {language === "RW"
                      ? `Amazina y'Ugenzi #${idx + 2}`
                      : `Passenger #{idx + 2} Full Name`}
                  </label>
                  <input
                    type="text"
                    value={nameVal}
                    onChange={(e) => {
                      const updated = [...tempGroupNames];
                      updated[idx] = e.target.value;
                      setTempGroupNames(updated);
                    }}
                    placeholder={
                      language === "RW"
                        ? `Andika amazina y'ugenzi ${idx + 2}`
                        : `Enter full name for passenger ${idx + 2}`
                    }
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setGroupPassengers(
                  tempGroupNames.filter((n) => n.trim().length > 0),
                );
                setShowGroupModal(false);
              }}
              className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-[14px] shadow-lg shadow-primary/25 cursor-pointer"
            >
              {language === "RW"
                ? "Emeza Abagenzi"
                : "Confirm Group Passengers"}
            </button>
          </motion.div>
        </div>
      )}

      {/* Verification Popup Modal (Pending Verification Phase Only) */}
      <AnimatePresence>
        {verificationPopup && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-6 text-center shadow-2xl"
            >
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Clock size={28} />
              </div>
              <h3 className="text-[18px] font-black text-slate-900 mb-2">
                {language === "RW"
                  ? "Kugenzura Biracyakomeza"
                  : "Verification in Progress"}
              </h3>
              <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
                {language === "RW"
                  ? `Ubwishyu bwawe burimo kugenzurwa n'abakozi ba ${operatorName}. Tegereza gato.`
                  : `Your payment is pending verification by ${operatorName} station agents. Please wait while your ticket enters verification.`}
              </p>
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-[50px] px-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 active:scale-90 transition-transform cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-900" />
          </button>
          <h1 className="text-[20px] font-bold text-slate-900">
            {t("payment", language)}
          </h1>
        </div>
        <p className="text-[13px] text-slate-500 ml-8">
          {language === "RW"
            ? "🎉 Promosiyo yo kwishyura ubuntu irakora kuri bose!"
            : "🎉 Free booking promo active for signed-in travelers this month!"}
        </p>
      </div>

      {/* Summary Card with Apple-Style Group Dropdown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-5 bg-white rounded-[20px] border border-slate-200 p-4 mb-4 shadow-sm"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-slate-500">
              {language === "RW" ? "Ugenzi Mukuru" : "Primary Passenger"}
            </span>
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <input
                  type="text"
                  value={editablePassengerName}
                  onChange={(e) => setEditablePassengerName(e.target.value)}
                  className="px-2 py-1 border border-primary rounded-lg text-[13px] font-semibold text-slate-900 focus:outline-none"
                />
              ) : (
                <span className="text-[14px] font-semibold text-slate-900">
                  {editablePassengerName}
                </span>
              )}
              <button
                onClick={() => setIsEditingName(!isEditingName)}
                className="text-primary hover:text-primary/80 p-1 cursor-pointer"
                title="Edit name"
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between">
            <span className="text-[14px] text-slate-500">
              {t("route", language)}
            </span>
            <span className="text-[14px] font-bold text-slate-950 uppercase">
              {selectedTrip.from || search.from || "Musanze"} &rarr;{" "}
              {selectedTrip.to || search.to || "Kigali"}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between">
            <span className="text-[14px] text-slate-500">
              {t("dateTime", language)}
            </span>
            <span className="text-[14px] font-semibold text-slate-900">
              {selectedTrip.date} · {selectedTrip.departureTime}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between">
            <span className="text-[14px] text-slate-500">
              {t("operator", language)}
            </span>
            <span className="text-[14px] font-semibold text-slate-900">
              {operatorEmoji} {operatorName}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between">
            <span className="text-[14px] text-slate-500">
              {t("seat", language)}
            </span>
            <span className="text-[14px] font-semibold text-slate-900">
              {selectedSeat}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between">
            <span className="text-[14px] text-slate-500">
              {t("baseFare", language)}
            </span>
            <span className="text-[14px] font-semibold text-slate-900">
              {formatPrice(selectedTrip.price)}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-slate-500">
              {t("bookingFee", language)}
            </span>
            <span className="text-[14px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              {language === "RW" ? "UBUNTU" : "FREE"}
            </span>
          </div>

          {groupPassengers.length > 0 && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <button
                  onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                  className="w-full flex items-center justify-between text-[13px] font-semibold text-slate-700 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Users size={15} className="text-primary" />
                    {language === "RW"
                      ? `Abandi (${groupPassengers.length} abagenzi)`
                      : `Others (${groupPassengers.length} passengers)`}
                  </span>
                  <span className="flex items-center gap-1 text-[12px] text-primary font-bold">
                    {showGroupDropdown
                      ? language === "RW"
                        ? "Hisha"
                        : "Hide details"
                      : language === "RW"
                        ? "Reba amazina"
                        : "View names"}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${
                        showGroupDropdown ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>

                <AnimatePresence>
                  {showGroupDropdown && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-2 pl-3 border-l-2 border-primary/30 py-1"
                    >
                      {groupPassengers.map((passengerName, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-[12px] text-slate-700 bg-slate-50/80 px-3 py-1.5 rounded-lg"
                        >
                          <span className="font-medium">
                            #{idx + 2}:{" "}
                            {passengerName ||
                              (language === "RW"
                                ? "Ugenzi utazwi"
                                : "Unnamed Passenger")}
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatPrice(selectedTrip.price)}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          <div className="border-t-2 border-primary/20" />
          <div className="flex justify-between items-center">
            <span className="text-[15px] font-bold text-slate-900">
              {t("totalLabel", language)}
            </span>
            <span className="text-[22px] font-extrabold text-primary">
              {formatPrice(total)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* MTN MoMo Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-5 bg-[#FFCC00] rounded-[24px] p-5 mb-4 shadow-md text-slate-900 relative overflow-hidden"
      >
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-extrabold uppercase tracking-widest bg-black/10 px-3 py-1 rounded-full">
            MTN momo code
          </span>
        </div>
        <div className="text-[26px] font-black tracking-tight mb-1 font-mono">
          {branchMomoCode}
        </div>
        <p className="text-[12px] font-semibold text-slate-800 opacity-90">
          {language === "RW"
            ? `Kode y'ishami rya ${operatorName}. Koresha wandika cyangwa wemeze hasi.`
            : `Branch Scheduled Code for ${operatorName}. Dial directly or complete automatic prompt below.`}
        </p>
      </motion.div>

      {/* Phone & MoMo Name Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-5 bg-white rounded-[20px] border border-slate-200 p-4 mb-4 shadow-sm space-y-3"
      >
        <div>
          <label className="text-[13px] font-semibold text-slate-900 block mb-1">
            {language === "RW" ? "Nimero ya MoMo" : "MTN MoMo Number"}
          </label>
          <div className="relative">
            <Phone
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0788123456 or 250788123456"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-[15px] focus:outline-none focus:border-primary text-slate-900 font-bold"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-semibold text-slate-900 block mb-1">
            {language === "RW" ? "Amazina kuri MoMo" : "MTN MoMo Name"}
          </label>
          <input
            type="text"
            value={momoName}
            onChange={(e) => setMomoName(e.target.value)}
            placeholder={
              language === "RW"
                ? "Andika amazina nkuko ari kuri MoMo"
                : "Enter name as registered on MoMo"
            }
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-900 focus:outline-none focus:border-primary"
          />
        </div>
      </motion.div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-5 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2"
          >
            <AlertCircle
              size={16}
              className="text-rose-600 flex-shrink-0 mt-0.5"
            />
            <p className="text-[13px] text-rose-600 font-semibold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center text-[12px] text-slate-500 mb-6 px-5">
        🔒 {t("security", language)}
      </div>

      {/* CTA Button */}
      <div className="mx-5 mt-2">
        <button
          onClick={handlePay}
          disabled={
            state === "initiating" ||
            state === "awaiting_approval" ||
            state === "polling" ||
            !phone
          }
          className={`w-full h-14 rounded-2xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            state === "initiating" ||
            state === "awaiting_approval" ||
            state === "polling"
              ? "bg-primary/70 text-white"
              : state === "success"
                ? "bg-amber-600 text-white"
                : state === "failed"
                  ? "bg-rose-600 text-white"
                  : phone
                    ? "bg-primary text-white shadow-primary/25 active:scale-[0.98]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {state === "idle" && (
            <>
              {language === "RW"
                ? `Kwishyura ${formatPrice(total)}`
                : `Pay ${formatPrice(total)}`}
            </>
          )}
          {(state === "initiating" ||
            state === "awaiting_approval" ||
            state === "polling") && (
            <>
              <Loader2 size={18} className="animate-spin" />
              {language === "RW"
                ? "Tegereza kwemeza"
                : "Waiting for verification"}
            </>
          )}
          {state === "success" && (
            <>
              <Check size={18} />
              {language === "RW"
                ? "Bitegereje Kwemezwa"
                : "Verification Pending"}
            </>
          )}
          {state === "failed" && (
            <>{language === "RW" ? "Ongera ugerageze" : "Try again"}</>
          )}
        </button>
      </div>
    </div>
  );
}
