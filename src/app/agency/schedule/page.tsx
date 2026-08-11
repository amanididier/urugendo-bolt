"use client";

import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { Calendar, Clock, ArrowLeft, Plus, X, MapPin } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { fetchTripsByDate, createTrip, updateTripStatus } from '@/lib/api';
import type { Trip } from '@/lib/types';

export default function AgencySchedulePage() {
  const router = useRouter();
  const { userRole } = useApp();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    routeFrom: '',
    routeTo: '',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    plate: '',
    totalSeats: 45,
    price: 5000,
  });

  const today = new Date().toISOString().split('T')[0];

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const data = await fetchTripsByDate(today);
    setTrips(data);
    setLoading(false);
  }, [today]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  if (userRole !== 'agent') {
    router.push('/login');
    return null;
  }

  const handleCreate = async () => {
    if (!form.routeFrom || !form.routeTo || !form.time || !form.plate) {
      setError('Please fill in all fields');
      return;
    }
    if (!form.totalSeats || form.totalSeats < 1) {
      setError('Enter a valid seat count');
      return;
    }
    if (!form.price || form.price < 1) {
      setError('Enter a valid price');
      return;
    }
    setSaving(true);
    setError('');
    const tripId = await createTrip({
      operatorId: 'Virunga Express',
      routeFrom: form.routeFrom,
      routeTo: form.routeTo,
      departureTime: form.time,
      arrivalTime: form.time,
      travelDate: form.date,
      price: form.price,
      totalSeats: form.totalSeats,
      plateNumber: form.plate,
    });
    setSaving(false);
    if (tripId) {
      setShowForm(false);
      setForm({ routeFrom: '', routeTo: '', date: today, time: '08:00', plate: '', totalSeats: 45, price: 5000 });
      await loadTrips();
    } else {
      setError('Failed to create trip. Please try again.');
    }
  };

  const handleMarkDelayed = async (tripId: string) => {
    await updateTripStatus(tripId, 'delayed');
    await loadTrips();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'arrived': return 'bg-green-100 text-green-700';
      case 'in-progress': case 'departed': return 'bg-blue-100 text-blue-700';
      case 'boarding': return 'bg-amber-100 text-amber-700';
      case 'delayed': return 'bg-orange-100 text-orange-700';
      case 'scheduled': default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white pb-[88px]">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <button onClick={() => router.push('/agency')} className="mb-3">
          <ArrowLeft size={24} className="text-white" />
        </button>
        <h1 className="text-[24px] font-extrabold text-white">Schedule</h1>
        <p className="text-[13px] text-white/70">Manage your trips</p>
      </div>

      <div className="px-4 mt-4">
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold mb-4"
        >
          <Plus size={18} />
          Add New Departure
        </button>

        {loading ? (
          <div className="text-center py-8 text-text-muted text-[13px]">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-[13px]">No trips scheduled</div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[16px] font-bold text-text-primary">{trip.from} → {trip.to}</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${getStatusColor(trip.status || 'scheduled')}`}>
                    {trip.status || 'scheduled'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-text-muted mb-2">
                  <Clock size={14} />
                  <span className="text-[14px]">{trip.departureTime}</span>
                  <span className="text-[11px]">• {trip.plateNumber || 'N/A'}</span>
                </div>
                {trip.status !== 'delayed' && trip.status !== 'departed' && trip.status !== 'arrived' && (
                  <button
                    onClick={() => handleMarkDelayed(trip.id)}
                    className="text-[11px] font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full"
                  >
                    Mark as Delayed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Departure Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-bold text-text-primary">New Departure</h2>
              <button onClick={() => setShowForm(false)}>
                <X size={22} className="text-text-muted" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-text-muted">From</label>
                <input
                  type="text"
                  value={form.routeFrom}
                  onChange={(e) => setForm({ ...form, routeFrom: e.target.value })}
                  placeholder="Kigali"
                  className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-muted">To</label>
                <input
                  type="text"
                  value={form.routeTo}
                  onChange={(e) => setForm({ ...form, routeTo: e.target.value })}
                  placeholder="Musanze"
                  className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-text-muted">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-text-muted">Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-muted">Plate Number</label>
                <input
                  type="text"
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value })}
                  placeholder="RAB 123 B"
                  className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-text-muted">Total Seats</label>
                  <input
                    type="number"
                    value={form.totalSeats === 0 ? '' : form.totalSeats}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, totalSeats: v === '' ? 0 : parseInt(v) });
                    }}
                    className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-text-muted">Price (RWF)</label>
                  <input
                    type="number"
                    value={form.price === 0 ? '' : form.price}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, price: v === '' ? 0 : parseInt(v) });
                    }}
                    className="w-full mt-1 px-3 py-2.5 border border-border rounded-xl text-[14px]"
                  />
                </div>
              </div>

              {error && <div className="text-[12px] text-red-600">{error}</div>}

              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full bg-primary text-white rounded-xl py-3 font-bold disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Departure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
