"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/context/app-context';
import { t } from '@/lib/translations';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function SplashScreen() {
  const router = useRouter();
  const { language, setLanguage, setUserRole } = useApp();

  const continueAsPassenger = () => {
    if (typeof window !== 'undefined') localStorage.setItem('urugendo_role', 'passenger');
    setUserRole('passenger');
    router.push('/home');
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0A1A12]">
      {/* Background image */}
      <motion.div
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: 'easeOut' }}
        className="absolute inset-0"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
      {/* Green glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[55%]"
        style={{
          background:
            'linear-gradient(to top, rgba(0,184,92,0.4) 0%, rgba(0,184,92,0.08) 50%, transparent 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-6 pt-[64px] pb-8">
        {/* Language toggle */}
        <div className="self-end flex items-center glass-dark rounded-full p-1 border border-white/10">
          <button
            onClick={() => setLanguage('EN')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
              language === 'EN' ? 'bg-primary text-white' : 'text-white/70'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('RW')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
              language === 'RW' ? 'bg-primary text-white' : 'text-white/70'
            }`}
          >
            RW
          </button>
        </div>

        {/* Branding */}
        <div className="mt-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 200 }}
            className="mb-5"
          >
            <div className="w-[84px] h-[84px] rounded-[24px] bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-primary border border-white/20 p-1.5">
              <Image
                src="https://assets.kiloapps.io/user_465c60a0-3d95-4712-ac67-4db616199442/5acef383-25d7-4044-8ec7-b13e367e211c/e80493e1-eb86-4e45-bc74-de15449a3015.jpg"
                alt="Urugendo Logo"
                width={68}
                height={68}
                className="rounded-[18px]"
              />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-white text-[42px] font-extrabold leading-[1.05] mb-1 tracking-tight"
          >
            Urugendo<span className="text-accent">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-white/80 text-[15px] mb-8 flex items-center gap-1.5"
          >
            <span>📍</span> {t('tagline', language)}
          </motion.p>

          {/* Continue as Passenger */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="space-y-2.5 mb-4"
          >
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={continueAsPassenger}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary active:scale-[0.98] transition-transform text-white font-bold text-[16px] shadow-lg"
            >
              Book a Ticket
              <ArrowRight size={20} />
            </motion.button>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3 }}
            onClick={() => router.push('/login?role=agency')}
            className="block mx-auto text-white/30 text-[11px] hover:text-white/50 transition-colors mb-2"
          >
            Sign in as Agency
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.3 }}
            className="text-center text-white/40 text-[12px]"
          >
            {t('madeWith', language)}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
