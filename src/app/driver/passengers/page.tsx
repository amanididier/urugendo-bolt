"use client";

import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { Users, ArrowLeft, CheckCircle, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { fetchAllBookings, updateBookingStatus } from '@/lib/api';
import type { Booking } from '@/lib/types';

export default function DriverPassengersPage() {
  const router = useRouter();
  const { userRole } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllBookings();
    setBookings(data.filter(b => b.status !== 'cancelled'));
    setLoading(false);
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  if (userRole !== 'driver') {
    router.push('/login');
    return null;
  }

  const toggleVerify = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || verifying) return;
    setVerifying(bookingId);
    const newStatus = booking.status === 'boarded' ? 'upcoming' : 'boarded';
    const success = await updateBookingStatus(bookingId, newStatus);
    if (success) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    }
    setVerifying(null);
  };

  const filtered = bookings.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.passengerName || '').toLowerCase().includes(q) ||
      (b.shortCode || '').toLowerCase().includes(q) ||
      (b.seat || '').toLowerCase().includes(q)
    );
  });

  const pending = filtered.filter(p => p.status !== 'boarded');
  const verified = filtered.filter(p => p.status === 'boarded');

  if (loading) {
    return (
      <div className="bg-white pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">Loading passengers...</div>
      </div>
    );
  }

  return (
    <div className="bg-white pb-[88px]">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <button onClick={() => router.push('/driver')} className="mb-3">
          <ArrowLeft size={24} className="text-white" />
        </button>
        <h1 className="text-[24px] font-extrabold text-white">Passengers</h1>
        <p className="text-[13px] text-white/70">Verify passengers on board</p>
      </div>

      <div className="px-4 mt-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passenger or code..."
            className="w-full h-12 pl-10 pr-4 bg-surface-secondary rounded-xl border border-border text-[14px]"
          />
        </div>

        {/* Pending */}
        <div className="mb-4">
          <h2 className="text-[14px] font-bold text-text-muted mb-2">Pending ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-[13px]">No pending passengers</div>
          ) : (
            pending.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-border p-3 mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                  {p.seat}
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-text-primary">{p.passengerName || 'Unknown'}</div>
                  <div className="text-[12px] text-text-muted font-mono">{p.shortCode}</div>
                </div>
                <button
                  onClick={() => toggleVerify(p.id)}
                  disabled={verifying === p.id}
                  className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-full disabled:opacity-50"
                >
                  {verifying === p.id ? '...' : 'Verify'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Verified */}
        <div>
          <h2 className="text-[14px] font-bold text-green-600 mb-2">Verified ({verified.length})</h2>
          {verified.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-[13px]">No verified passengers yet</div>
          ) : (
            verified.map((p) => (
              <div key={p.id} className="bg-green-50 rounded-xl border border-green-200 p-3 mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">
                  {p.seat}
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-green-800">{p.passengerName || 'Unknown'}</div>
                  <div className="text-[12px] text-green-600 font-mono">{p.shortCode}</div>
                </div>
                <button
                  onClick={() => toggleVerify(p.id)}
                  disabled={verifying === p.id}
                  className="text-[11px] font-bold text-red-600 disabled:opacity-50"
                >
                  Unverify
                </button>
                <CheckCircle size={20} className="text-green-600" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
