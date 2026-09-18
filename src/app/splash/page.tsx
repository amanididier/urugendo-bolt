"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";

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

          {/* PWA Install Banner - appears at the bottom after the language selector */}
          {showInstallBanner && deferredPrompt && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary/90 backdrop-blur-md border border-primary/30 rounded-xl p-5 shadow-lg max-w-md w-full z-50"
              style={{
                animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <style>{`
                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ArrowRight size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">
                    {language === "RW"
                      ? "Tegere urugendo rwacu mu hejuru y'umuryango"
                      : "Install Urugendo on your home screen"}
                  </p>
                  <p className="text-white/80 text-sm mt-0.5">
                    {language === "RW"
                      ? "Komeza kugera bisi mu giciro cy'umuryango kugera bisi mu buryo bwo gusohoka."
                      : "Get instant access to all routes from your home screen."}
                  </p>
                </div>
              </div>
              <button
                onClick={handleInstallApp}
                className="mt-3 w-full bg-primary text-white font-bold py-2 rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
              >
                {language === "RW" ? "Gura ubwiyunge" : "Install App"}
              </button>
            </div>
          )}

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