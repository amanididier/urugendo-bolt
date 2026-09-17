"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function SplashScreen() {
  const router = useRouter();
  const { language, setLanguage, setUserRole } = useApp();

  const continueAsPassenger = () => {
    if (typeof window !== "undefined")
      localStorage.setItem("urugendo_role", "passenger");
    setUserRole("passenger");
    router.push("/home");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0A1A12]">
      <motion.div
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 4, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <Image
          src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1000&auto=format&fit=crop"
          alt="Rwanda Intercity Bus"
          fill
          priority
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1A12] via-[#0A1A12]/80 to-transparent" />
      </motion.div>

      <div className="relative z-10 flex flex-col justify-between h-full p-6 pb-10 text-white">
        <div className="flex justify-between items-center pt-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-black text-white text-lg shadow-md">
              U
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Urugendo
            </span>
          </div>

          <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/15">
            {(["EN", "RW", "FR"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                  language === lang
                    ? "bg-primary text-white shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 mb-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold backdrop-blur-md">
            <ShieldCheck size={14} />
            {language === "RW"
              ? "Porogaramu ya Mbere mu Rwanda"
              : "#1 Bus Booking in Rwanda"}
          </div>

          <h1 className="text-[34px] font-black leading-[1.1] tracking-tight">
            {language === "RW"
              ? "Urugendo rwawe rwose, mu ntoki zawe."
              : "Your journey across Rwanda, simplified."}
          </h1>

          <p className="text-[14px] text-white/80 leading-relaxed font-medium max-w-[320px]">
            {language === "RW"
              ? "Shakisha, gereranya kandi utegere bisi ku buryo bworoshye. Application yo gutegeraho bisi."
              : "Search, compare, and book express bus tickets from Kigali to Musanze, Rubavu, and all intercity routes instantly."}
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={continueAsPassenger}
              className="w-full h-13 bg-primary text-white font-extrabold text-[15px] rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{t("get_started", language)}</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => router.push("/agency/agency-login")}
              className="w-full h-11 bg-white/10 hover:bg-white/15 text-white/90 font-bold text-[13px] rounded-2xl backdrop-blur-md border border-white/15 transition-all cursor-pointer"
            >
              {language === "RW" ? "Injira nka Agent cyangwa Manager" : "Agency Agent / Manager Portal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
