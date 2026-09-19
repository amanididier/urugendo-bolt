"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import Image from "next/image";
import { ArrowRight, ShieldCheck, X } from "lucide-react";

export default function SplashScreen() {
  const router = useRouter();
  const { language, setLanguage, setUserRole } = useApp();

  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const continueAsPassenger = () => {
    if (typeof window !== "undefined")
      localStorage.setItem("urugendo_role", "passenger");
    setUserRole("passenger");
    router.push("/home");
  };

  // Listen for the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBanner(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User ${outcome} installing app`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
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
            <div className="w-9 h-9 rounded-xl bg-white/95 flex items-center justify-center shadow-md overflow-hidden">
              <Image
                src="/favicon.png"
                alt="Urugendo"
                width={28}
                height={28}
                priority
                className="object-contain"
              />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Urugendo
            </span>
          </div>

          <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/15">
            {(["EN", "RW"] as const).map((lang) => (
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
              : "Search, compare, and book express bus tickets for all routes instantly."}
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={continueAsPassenger}
              className="w-full h-13 bg-primary text-white font-extrabold text-[15px] rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{t("getStarted", language)}</span>
              <ArrowRight size={18} />
            </button>

          </div>

          {/* PWA Install Banner — Apple-level slide-down card with favicon */}
          <AnimatePresence>
            {showInstallBanner && deferredPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ type: "spring", damping: 24, stiffness: 320 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[352px] px-4"
              >
                <div className="relative bg-[#F7F8FA]/95 backdrop-blur-2xl border border-white/60 rounded-3xl p-4 shadow-2xl shadow-black/20 ring-1 ring-black/5">
                  <button
                    type="button"
                    onClick={() => setShowInstallBanner(false)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-300/80 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>

                  <div className="flex items-start gap-3.5 pr-8">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <Image
                        src="/favicon.png"
                        alt="Urugendo"
                        width={40}
                        height={40}
                        priority
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-black text-[15px] text-slate-900 tracking-tight leading-none">
                          Urugendo
                        </p>
                        <span className="text-[9px] font-black text-white bg-[#00B85C] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          App
                        </span>
                      </div>
                      <p className="text-[12.5px] font-semibold text-slate-700 leading-snug mt-1">
                        {language === "RW"
                          ? "Ongeraho Urugendo kuri ecran yawe"
                          : "Add Urugendo to your Home Screen"}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium leading-snug mt-1">
                        {language === "RW"
                          ? "Gusubiza ntarengwa, kunoza kumenya."
                          : "One-tap access, offline icon, faster launches."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3.5">
                    <button
                      type="button"
                      onClick={() => setShowInstallBanner(false)}
                      className="py-2.5 rounded-2xl text-[12px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
                    >
                      {language === "RW" ? "Ntabwo" : "Not now"}
                    </button>
                    <button
                      type="button"
                      onClick={handleInstallApp}
                      className="py-2.5 rounded-2xl text-[12px] font-black text-white bg-[#00B85C] hover:bg-[#009e50] shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {language === "RW" ? "Kora Ibiranga" : "Install"}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 text-center">
            <button
              onClick={() => router.push("/agency/agency-login")}
              className="text-[11px] font-medium text-white/35 hover:text-white/60 underline underline-offset-4 decoration-white/20 transition-colors cursor-pointer"
            >
              {language === "RW"
                ? "Injira nka Agent cyangwa Manager"
                : "Agency Agent / Manager Portal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}