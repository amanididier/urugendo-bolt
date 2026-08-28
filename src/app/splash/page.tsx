"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/app-context";
import { t } from "@/lib/translations";
import Image from "next/image";
import { ArrowRight, Download, Sparkles, X, ShieldCheck } from "lucide-react";

export default function SplashScreen() {
  const router = useRouter();
  const { language, setLanguage, setUserRole } = useApp();
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  useEffect(() => {
    const isInstalled = localStorage.getItem("urugendo_app_installed");
    const isDismissed = localStorage.getItem(
      "urugendo_install_prompt_dismissed",
    );

    if (!isInstalled && !isDismissed) {
      const timer = setTimeout(() => {
        setShowInstallPopup(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleInstallApp = () => {
    localStorage.setItem("urugendo_app_installed", "true");
    setShowInstallPopup(false);
    alert(
      language === "RW"
        ? "Urugendo yashyizwe ku Gikoresho cyawe! Ushobora kuyikoresha no mu gihe nta internet ihari."
        : "Urugendo added successfully! Cached for offline access and notification alerts.",
    );
  };

  const handleDismissInstall = () => {
    localStorage.setItem("urugendo_install_prompt_dismissed", "true");
    setShowInstallPopup(false);
  };

  const continueAsPassenger = () => {
    if (typeof window !== "undefined")
      localStorage.setItem("urugendo_role", "passenger");
    setUserRole("passenger");
    router.push("/home");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0A1A12]">
      {/* Apple-Style PWA Install Prompt Modal */}
      <AnimatePresence>
        {showInstallPopup && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-sm bg-white/95 backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl relative border border-white/50 text-slate-900"
            >
              <button
                onClick={handleDismissInstall}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                <Download size={26} />
              </div>

              <h3 className="text-[20px] font-black tracking-tight mb-2 text-slate-900">
                {language === "RW"
                  ? "Gira Urugendo Kumugaragaro"
                  : "Install Urugendo App"}
              </h3>

              <p className="text-[13px] text-slate-600 leading-relaxed mb-6 font-medium">
                {language === "RW"
                  ? "Bika urubuga rwacu ku gikoresho cyawe kugira ngo ubike amakuru yawe (cache), ubone ubutumwa bwihuse ndetse n'amatike mu buryo bworoshye."
                  : "Save Urugendo to your device home screen to cache travel data offline and receive instant ticket verification alert notifications."}
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={handleInstallApp}
                  className="w-full h-12 bg-primary text-white font-extrabold text-[14px] rounded-2xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles size={16} />
                  {language === "RW"
                    ? "Emera Kubika App"
                    : "Install to Home Screen"}
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="w-full h-11 bg-slate-100 text-slate-600 font-bold text-[13px] rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {language === "RW" ? "Nyuma yaho" : "Not Now"}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                <ShieldCheck size={14} className="text-primary" />
                {language === "RW"
                  ? "Umutekano wizewe 100%"
                  : "Fast Offline Cache Enabled"}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: "easeOut" }}
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=85)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
      <div
        className="absolute bottom-0 left-0 right-0 h-[55%]"
        style={{
          background:
            "linear-gradient(to top, rgba(0,184,92,0.4) 0%, rgba(0,184,92,0.08) 50%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full px-6 pt-[52px] pb-6 justify-between">
        <div className="self-end flex items-center glass-dark rounded-full p-1 border border-white/10">
          <button
            onClick={() => setLanguage("EN")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
              language === "EN" ? "bg-primary text-white" : "text-white/70"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage("RW")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
              language === "RW" ? "bg-primary text-white" : "text-white/70"
            }`}
          >
            RW
          </button>
        </div>

        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 0.2,
              duration: 0.6,
              type: "spring",
              stiffness: 200,
            }}
            className="mb-4"
          >
            <div className="w-[76px] h-[76px] rounded-[22px] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-primary border border-white/20 p-1.5">
              <Image
                src="https://assets.kiloapps.io/user_465c60a0-3d95-4712-ac67-4db616199442/5acef383-25d7-4044-8ec7-b13e367e211c/e80493e1-eb86-4e45-bc74-de15449a3015.jpg"
                alt="Urugendo Logo"
                width={62}
                height={62}
                className="rounded-[16px]"
              />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-white text-[38px] font-extrabold leading-[1.05] mb-1 tracking-tight"
          >
            Urugendo<span className="text-accent">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-white/80 text-[14px] mb-6 flex items-center gap-1.5"
          >
            <span>📍</span> {t("tagline", language)}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="space-y-2.5 mb-3"
          >
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={continueAsPassenger}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-primary active:scale-[0.98] transition-transform text-white font-bold text-[15px] shadow-lg cursor-pointer"
            >
              Book a Ticket
              <ArrowRight size={18} />
            </motion.button>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3 }}
            onClick={() => router.push("/agency/agency-login")}
            className="block mx-auto text-white/40 text-[11px] hover:text-white/70 transition-colors mb-2 py-1 cursor-pointer"
          >
            Sign in as Agency
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.3 }}
            className="text-center text-white/40 text-[11px]"
          >
            {t("madeWith", language)}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
