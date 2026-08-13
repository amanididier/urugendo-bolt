"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/context/app-context';
import { Bus, MapPin, Clock, Users, ArrowRight, Navigation, Radio } from 'lucide-react';
import { formatPrice } from '@/lib/data';

export default function LivePage() {
  const router = useRouter();
  const { bookings } = useApp();

  const liveTrips = bookings.filter(b => b.status === 'upcoming');

  const handleTripClick = (tripId: string) => {
    router.push(`/seats/${tripId}`);
  };

  return (
    <div className="bg-white pb-[100px]">
      {/* Header */}
      <div className="bg-primary pt-[60px] px-5 pb-7 rounded-b-[28px]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Radio size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-extrabold text-white">Live Trips</h1>
            <p className="text-[13px] text-white/70 mt-0.5">Track your active journeys</p>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="px-5 -mt-4 mb-4">
        <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-green-500"
          />
          <span className="text-[14px] font-semibold text-text-primary">Live Tracking Active</span>
        </div>
      </div>

      {/* Live trip cards */}
      <div className="px-5 space-y-3">
        {liveTrips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="text-5xl mb-4">🚍</div>
            <p className="text-[14px] text-text-muted text-center">
              No active trips right now
            </p>
            <p className="text-[12px] text-text-muted text-center mt-2">
              Book a trip to track it live
            </p>
          </motion.div>
        ) : (
          liveTrips.map((booking, i) => (
            <motion.button
              key={booking.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => router.push(`/ticket/${booking.id}`)}
              className="w-full text-left bg-white rounded-xl border border-border p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: booking.trip.operator.gradient }}
                  >
                    {booking.trip.operator.emoji}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-text-primary">
                      {booking.trip.from} → {booking.trip.to}
                    </div>
                    <div className="text-[12px] text-text-muted">
                      {booking.trip.operator.name} · {booking.seat}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {booking.status.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[12px] text-text-muted mb-3">
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {booking.trip.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {booking.trip.departureTime}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} /> {booking.trip.totalSeats - booking.trip.availableSeats}/{booking.trip.totalSeats}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 bg-primary text-white text-[13px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2">
                  <Navigation size={14} /> View Live
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/ticket/${booking.id}`);
                  }}
                  className="flex-1 bg-surface-secondary text-text-primary text-[13px] font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  View Ticket
                </button>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}