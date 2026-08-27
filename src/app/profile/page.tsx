"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Bell,
  Globe,
  LogOut,
  LogIn,
  KeyRound,
  CreditCard,
  MapPin,
  Check,
} from "lucide-react";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/lib/notifications";

export default function ProfilePage() {
  const router = useRouter();
  const {
    bookings,
    language,
    setLanguage,
    isLoggedIn,
    setIsLoggedIn,
    userName,
    userPhone,
  } = useApp();

  const { unreadCount } = useNotifications();

  // Profile management state
  const [defaultMomo, setDefaultMomo] = useState("");
  const [momoHolderName, setMomoHolderName] = useState("");
  const [savedMomoStatus, setSavedMomoStatus] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const storedMomo =
      localStorage.getItem("urugendo_default_momo") || userPhone || "";
    const storedMomoName =
      localStorage.getItem("urugendo_default_momo_name") || userName || "";
    setDefaultMomo(storedMomo);
    setMomoHolderName(storedMomoName);
  }, [userPhone, userName]);

  const handleSaveDefaultMomo = () => {
    localStorage.setItem("urugendo_default_momo", defaultMomo);
    localStorage.setItem("urugendo_default_momo_name", momoHolderName);
    setSavedMomoStatus(true);
    setTimeout(() => setSavedMomoStatus(false), 2500);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("Updating password...");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordMessage("Password updated successfully!");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage("");
        setNewPassword("");
        setCurrentPassword("");
      }, 2000);
    } catch (err: any) {
      setPasswordMessage(err.message || "Failed to update password");
    }
  };

  const totalTrips = bookings.filter(
    (b) => b.status === "past" || b.status === "used" || b.status === "boarded",
  ).length;

  const handleLanguageToggle = () => {
    setLanguage(language === "EN" ? "RW" : "EN");
  };

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("urugendo_role");
        localStorage.removeItem("urugendo_is_logged_in");
        localStorage.removeItem("urugendo_user_name");
        localStorage.removeItem("urugendo_user_email");
      }
      setIsLoggedIn(false);
      router.refresh();
    } else {
      router.push("/user-login");
    }
  };

  return (
    <div className="bg-slate-50/50 min-h-screen pb-[120px] font-sans">
      {/* Green Header - Unmodified and Consistent */}
      <div className="bg-primary pt-[60px] pb-8 rounded-b-[32px] flex flex-col items-center shadow-sm">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center mb-3 border-4 border-white/30 shadow-xs">
            <span className="text-[24px] font-extrabold text-primary">
              {isLoggedIn && userName
                ? userName.substring(0, 2).toUpperCase()
                : "GU"}
            </span>
          </div>
          <h1 className="text-[20px] font-extrabold text-white tracking-tight">
            {isLoggedIn && userName ? userName : "Guest User"}
          </h1>
          <p className="text-[13px] text-white/80 font-medium">
            {isLoggedIn && userPhone
              ? userPhone
              : "Please sign in to view details"}
          </p>
        </motion.div>
      </div>

      {/* Stats Section: Total Trips Taken */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-5 -mt-4 bg-white rounded-2xl border border-slate-200/90 p-4 mb-4 relative z-10 shadow-xs flex items-center justify-around"
      >
        <div className="text-center flex-1">
          <div className="text-[28px] font-black text-primary tracking-tight">
            {totalTrips}
          </div>
          <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
            {t("totalTrips", language)}
          </div>
        </div>
      </motion.div>

      {/* Apple Settings Group: Default MoMo & Password */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-5 space-y-4 mb-4"
      >
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <h3 className="text-[14px] font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <CreditCard size={17} className="text-primary" /> Default MoMo
            Payment Info
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                Phone Number
              </label>
              <input
                type="tel"
                value={defaultMomo}
                onChange={(e) => setDefaultMomo(e.target.value)}
                placeholder="0788000000"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-900 focus:outline-none focus:border-primary bg-slate-50/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">
                Registered Name
              </label>
              <input
                type="text"
                value={momoHolderName}
                onChange={(e) => setMomoHolderName(e.target.value)}
                placeholder="Account Holder Name"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13.5px] font-semibold text-slate-900 focus:outline-none focus:border-primary bg-slate-50/50"
              />
            </div>
            <button
              onClick={handleSaveDefaultMomo}
              className="w-full h-10 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {savedMomoStatus ? <Check size={16} /> : null}
              {savedMomoStatus ? "Saved to Autofill ✓" : "Save Default MoMo"}
            </button>
          </div>
        </div>

        {/* Apple Style Menu List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-100"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-primary flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <span className="flex-1 text-[14px] font-bold text-slate-800">
              Change Password
            </span>
            <ChevronRight size={17} className="text-slate-400" />
          </button>

          <button
            onClick={() => router.push("/user-notifications")}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-100"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center relative">
              <Bell size={18} />
            </div>
            <span className="flex-1 text-[14px] font-bold text-slate-800">
              {t("notifications", language)}
            </span>
            {unreadCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
            <ChevronRight size={17} className="text-slate-400" />
          </button>

          <button
            onClick={handleLanguageToggle}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Globe size={18} />
            </div>
            <span className="flex-1 text-[14px] font-bold text-slate-800">
              {t("language", language)}
            </span>
            <span className="text-[12.5px] text-primary font-extrabold mr-1 bg-emerald-50 px-2 py-0.5 rounded-md">
              {language === "EN" ? "EN / RW" : "RW / EN"}
            </span>
            <ChevronRight size={17} className="text-slate-400" />
          </button>
        </div>
      </motion.div>

      {/* Log Out / Sign In Action */}
      <div className="mx-5">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleAuthAction}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[14.5px] transition-colors cursor-pointer shadow-xs ${
            isLoggedIn
              ? "bg-rose-50 text-rose-600 border border-rose-200"
              : "bg-primary text-white"
          }`}
        >
          {isLoggedIn ? (
            <>
              <LogOut size={17} /> Sign Out of Account
            </>
          ) : (
            <>
              <LogIn size={17} /> Sign In / Log In
            </>
          )}
        </motion.button>
      </div>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-[18px] font-black text-slate-900 mb-4">
                Change Password
              </h3>
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="At least 6 characters"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>
                {passwordMessage && (
                  <p className="text-[12px] font-bold text-center text-primary py-1">
                    {passwordMessage}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 h-11 bg-slate-100 text-slate-700 font-bold text-[13px] rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 bg-primary text-white font-bold text-[13px] rounded-xl cursor-pointer shadow-xs"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
