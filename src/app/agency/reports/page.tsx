"use client";

import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { Download, Share, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { fetchAllBookings, fetchTripsByDate } from '@/lib/api';
import type { Booking, Trip } from '@/lib/types';

export default function AgencyReportsPage() {
  const router = useRouter();
  const { userRole } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [allBookings, todayTrips] = await Promise.all([
      fetchAllBookings(),
      fetchTripsByDate(today),
    ]);
    setBookings(allBookings);
    setTrips(todayTrips);
    setLoading(false);
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  if (userRole !== 'agent') {
    router.push('/login');
    return null;
  }

  const todayBookings = bookings.filter(b => {
    const trip = trips.find(t => t.id === b.trip.id);
    return trip && b.status !== 'cancelled';
  });
  const todayRevenue = todayBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);

  const handleWhatsApp = () => {
    const text = `*Volcano Express - Daily Report*\n\nDate: ${today}\nBookings: ${todayBookings.length}\nRevenue: ${todayRevenue.toLocaleString()} RWF\n\nTotal (all-time): ${totalBookings} bookings, ${totalRevenue.toLocaleString()} RWF`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="bg-white pb-[88px]">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <button onClick={() => router.push('/agency')} className="mb-3">
          <ArrowLeft size={24} className="text-white" />
        </button>
        <h1 className="text-[24px] font-extrabold text-white">Reports</h1>
        <p className="text-[13px] text-white/70">View and export reports</p>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <h2 className="text-[16px] font-bold text-text-primary mb-3">Today's Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[24px] font-bold text-primary">{todayBookings.length}</div>
              <div className="text-[12px] text-text-muted">Digital Bookings</div>
            </div>
            <div>
              <div className="text-[24px] font-bold text-amber-600">0</div>
              <div className="text-[12px] text-text-muted">Paper</div>
            </div>
            <div>
              <div className="text-[24px] font-bold text-text-primary">{todayBookings.length}</div>
              <div className="text-[12px] text-text-muted">Total</div>
            </div>
            <div>
              <div className="text-[24px] font-bold text-green-600">{(todayRevenue / 1000).toFixed(0)}K</div>
              <div className="text-[12px] text-text-muted">Revenue</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 mb-4">
          <h2 className="text-[16px] font-bold text-text-primary mb-3">All-Time Summary</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Total Bookings</span>
              <span className="text-[14px] font-bold text-text-primary">{totalBookings}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Total Revenue</span>
              <span className="text-[14px] font-bold text-green-600">{totalRevenue.toLocaleString()} RWF</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="flex-1 bg-primary text-white py-3 rounded-xl flex items-center justify-center gap-2 opacity-50" disabled>
            <Download size={18} />
            <span className="text-[14px] font-bold">Export PDF</span>
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 bg-green-500 text-white py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Share size={18} />
            <span className="text-[14px] font-bold">WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
