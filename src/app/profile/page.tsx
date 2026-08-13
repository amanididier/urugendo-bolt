"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Users, CreditCard, Bell, Globe, HelpCircle, LogOut, X, User } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { t } from '@/lib/translations';

export default function ProfilePage() {
  const router = useRouter();
  const { bookings, language, setLanguage, userRole, setUserRole } = useApp();
  const [pitchMode, setPitchMode] = useState(false);

  const upcomingCount = bookings.filter(b => b.status === 'upcoming').length;
  const totalTrips = bookings.filter(b => b.status === 'past').length + upcomingCount;

  const handleLanguageToggle = () => {
    setLanguage(language === 'EN' ? 'RW' : 'EN');
  };

  const handleMenuClick = (label: string) => {
    if (label === t('language', language)) {
      handleLanguageToggle();
    }
  };

  const menuItems = [
    { icon: Users, label: t('savedPassengers', language), bg: 'bg-purple-100', color: 'text-purple-600' },
    { icon: CreditCard, label: t('paymentMethods', language), bg: 'bg-yellow-100', color: 'text-yellow-600' },
    { icon: Bell, label: t('notifications', language), bg: 'bg-orange-100', color: 'text-orange-500' },
    { icon: Globe, label: t('language', language), bg: 'bg-teal-100', color: 'text-teal-600', value: language === 'EN' ? 'EN / RW' : 'RW / EN', action: handleLanguageToggle },
    { icon: HelpCircle, label: t('helpSupport', language), bg: 'bg-pink-100', color: 'text-pink-600' },
  ];

  return (
    <div className="bg-white pb-[100px]">
      {/* Green header with avatar */}
      <div className="bg-primary pt-[60px] pb-8 rounded-b-3xl flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center mb-3 border-4 border-white/30">
            <span className="text-[24px] font-bold text-primary">JP</span>
          </div>
          <h1 className="text-[20px] font-bold text-white">Jean-Paul K.</h1>
          <p className="text-[14px] text-white/70">+250 789 123 456</p>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-5 -mt-4 bg-white rounded-xl border border-border flex mb-5 relative z-10"
      >
        <div className="flex-1 py-4 text-center">
          <div className="text-[26px] font-bold text-primary">{upcomingCount}</div>
          <div className="text-[12px] text-text-muted">{t('upcoming', language)}</div>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 py-4 text-center">
          <div className="text-[26px] font-bold text-accent">{totalTrips}</div>
          <div className="text-[12px] text-text-muted">{t('totalTrips', language)}</div>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 py-4 text-center">
          <div className="text-[26px] font-bold text-primary">4.8</div>
          <div className="text-[12px] text-text-muted">{t('rating', language)} ★</div>
        </div>
      </motion.div>

      {/* Menu */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mx-5 bg-white rounded-xl border border-border overflow-hidden"
      >
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMenuClick(item.label)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-primary-light transition-colors text-left ${
                i < menuItems.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className={`w-[48px] h-[48px] rounded-xl ${item.bg} flex items-center justify-center`}>
                <Icon size={22} className={item.color} />
              </div>
              <span className="flex-1 text-[15px] font-medium text-text-primary">{item.label}</span>
              {item.value && (
                <span className="text-[13px] text-primary font-bold mr-1">{item.value}</span>
              )}
              <ChevronRight size={18} className="text-text-muted" />
            </motion.button>
          );
        })}
      </motion.div>

    </div>
  );
}
