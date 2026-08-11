"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { t } from '@/lib/translations';
import { ChevronRight, MapPin, Clock, Bus } from 'lucide-react';
import { fetchAllBookings } from '@/lib/api';
import type { Booking } from '@/lib/types';

const tabs = ['Upcoming', 'Past', 'Live'] as const;
type Tab = typeof tabs[number];

const tabKeys: Record<Tab, 'upcoming' | 'past' | 'live'> = {
  Upcoming: 'upcoming',
  Past: 'past',
  Live: 'live',
};

export default function TicketsPage() {
  const router = useRouter();
  const { language } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('Upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllBookings();
    setBookings(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const filtered = bookings.filter(b => {
    if (activeTab === 'Upcoming') return b.status === 'upcoming';
    if (activeTab === 'Past') return b.status === 'past' || b.status === 'boarded' || b.status === 'expired';
    return b.status === 'upcoming';
  });

  const handleTicketClick = (bookingId: string) => {
    router.push(`/ticket/${bookingId}`);
  };

  return (
    <div className="bg-white pb-[100px]">
      {/* Title with green accent */}
      <div className="bg-primary pt-[60px] px-5 pb-7 rounded-b-[28px]">
        <h1 className="text-[28px] font-extrabold text-white">{t('myTickets', language)}</h1>
        <p className="text-[13px] text-white/70 mt-0.5">{t('manageTickets', language)}</p>
      </div>

      {/* Tab bar */}
      <div className="px-5 -mt-4 mb-4 relative z-10">
        <div className="relative flex bg-white rounded-xl p-1 border border-border">
          <motion.div
            layoutId="ticket-tab"
            className="absolute top-1 bottom-1 bg-primary rounded-lg"
            style={{
              width: `${100 / 3}%`,
              left: `${(tabs.indexOf(activeTab) * 100) / 3}%`,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[13px] font-semibold relative z-10 transition-colors ${
                activeTab === tab ? 'text-white' : 'text-text-muted'
              }`}
            >
              {t(tabKeys[tab], language)}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket cards */}
      <div className="px-5 space-y-3">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-[14px] text-text-muted">Loading tickets...</div>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-5xl mb-4">🎫</div>
              <p className="text-[14px] text-text-muted text-center">
                {activeTab === 'Upcoming'
                  ? t('noUpcoming', language)
                  : activeTab === 'Past'
                  ? t('noPast', language)
                  : 'No live trips right now'}
              </p>
            </motion.div>
          ) : (
            filtered.map((booking, i) => (
              <motion.button
                key={booking.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => handleTicketClick(booking.id)}
                className="w-full text-left bg-white rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[18px] font-bold text-text-primary">
                    {booking.trip.from} → {booking.trip.to}
                  </div>
                  <ChevronRight size={20} className="text-text-muted" />
                </div>
                <div className="flex items-center gap-3 text-[13px] text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {booking.trip.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {booking.trip.departureTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bus size={12} /> {booking.trip.operator.name}
                  </span>
                  <span>💺 {booking.seat}</span>
                </div>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
