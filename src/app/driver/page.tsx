"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bus, MapPin, Users, Clock, CheckCircle, Navigation, FileText, Phone } from 'lucide-react';
import dynamic from 'next/dynamic';
import { fetchTripsByDate, fetchAllBookings, updateBookingStatus } from '@/lib/api';
import type { Trip, Booking } from '@/lib/types';

const MapTracking = dynamic(() => import('@/components/MapTracking').then(m => ({ default: m.MapTracking })), {
  ssr: false,
  loading: () => <div className="h-[300px] bg-gray-100 rounded-xl animate-pulse" />,
});

export default function DriverDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [todayTrips, allBookings] = await Promise.all([
      fetchTripsByDate(today),
      fetchAllBookings(),
    ]);
    setTrips(todayTrips);
    setBookings(allBookings.filter(b => b.status !== 'cancelled'));
    setVerifiedIds(new Set(allBookings.filter(b => b.status === 'boarded').map(b => b.id)));
    setLoading(false);
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'departed': return 'bg-blue-100 text-blue-700';
      case 'arrived': return 'bg-green-100 text-green-700';
      case 'boarding': return 'bg-amber-100 text-amber-700';
      case 'delayed': return 'bg-orange-100 text-orange-700';
      case 'assigned':
      case 'scheduled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const markBoarded = async (bookingId: string) => {
    if (verifiedIds.has(bookingId)) return;
    const success = await updateBookingStatus(bookingId, 'boarded');
    if (success) setVerifiedIds(prev => new Set(prev).add(bookingId));
  };

  if (loading) {
    return (
      <div className="bg-surface-secondary pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">Loading dashboard...</div>
      </div>
    );
  }

  const currentTrip = trips.find(t => t.status === 'departed' || t.status === 'boarding') || trips[0];
  const currentTripBookings = currentTrip ? bookings.filter(b => b.trip?.id === currentTrip.id) : [];
  const pendingPassengers = currentTrip ? currentTripBookings.filter(b => !verifiedIds.has(b.id)) : [];
  const verifiedList = currentTrip ? currentTripBookings.filter(b => verifiedIds.has(b.id)) : [];
  const upcomingTrips = trips.filter(t => t !== currentTrip && (t.status === 'scheduled' || t.status === 'assigned'));

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header */}
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🚐
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">Driver Dashboard</h1>
            <p className="text-[12px] text-white/70">Volcano Express</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <div className="text-[20px] font-bold text-white">{trips.length}</div>
            <div className="text-[10px] text-white/70">Trips Today</div>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <div className="text-[20px] font-bold text-white">{pendingPassengers.length}</div>
            <div className="text-[10px] text-white/70">Pending</div>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <div className="text-[20px] font-bold text-white">{verifiedList.length}</div>
            <div className="text-[10px] text-white/70">Verified</div>
          </div>
        </div>
      </div>

      {/* Current Trip */}
      {currentTrip && (
        <div className="px-4 -mt-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-bold text-primary uppercase">Current Trip</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(currentTrip.status || 'scheduled')}`}>
                {(currentTrip.status || 'scheduled').toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-text-primary">{currentTrip.from} → {currentTrip.to}</div>
                <div className="text-[12px] text-text-muted">{currentTrip.plateNumber || 'N/A'}</div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-bold text-text-primary">{currentTrip.departureTime}</div>
                <div className="text-[10px] text-text-muted">Departure</div>
              </div>
            </div>

            {/* Live Map */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-primary">Live Map</span>
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="flex items-center gap-1"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[10px] text-green-600 font-bold">LIVE</span>
                </motion.div>
              </div>
              <MapTracking
                busLocation={[-1.9157, 29.7444]}
                route="Kigali-Musanze"
                showRoute={true}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-white rounded-xl p-3 border border-border flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <span className="text-[12px] font-semibold text-text-primary">Manifest PDF</span>
          </button>
          <button className="bg-white rounded-xl p-3 border border-border flex items-center gap-2">
            <Phone size={18} className="text-primary" />
            <span className="text-[12px] font-semibold text-text-primary">Contact HQ</span>
          </button>
        </div>
      </div>

      {/* Pending Passengers */}
      <div className="px-4 mt-4">
        <h3 className="text-[15px] font-bold text-text-primary mb-3">Pending ({pendingPassengers.length})</h3>

        <div className="space-y-2">
          {pendingPassengers.length === 0 ? (
            <div className="text-center py-4 text-text-muted text-[13px]">All passengers verified</div>
          ) : pendingPassengers.map((passenger, i) => (
            <motion.div
              key={passenger.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-border p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center text-[12px] font-bold text-text-primary">
                {passenger.seat}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-text-primary">{passenger.passengerName || 'Unknown'}</div>
                <div className="text-[11px] text-text-muted font-mono">{passenger.shortCode}</div>
              </div>
              <button
                onClick={() => markBoarded(passenger.id)}
                className="bg-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-full"
              >
                Verify
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Verified Passengers */}
      {verifiedList.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-[15px] font-bold text-green-600 mb-3">Verified ({verifiedList.length})</h3>

          <div className="space-y-2">
            {verifiedList.map((passenger, i) => (
              <motion.div
                key={passenger.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-green-50 rounded-xl border border-green-200 p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-[12px] font-bold text-green-700">
                  {passenger.seat}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-green-800">{passenger.passengerName || 'Unknown'}</div>
                  <div className="text-[11px] text-green-600 font-mono">{passenger.shortCode}</div>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={16} />
                  <span className="text-[11px] font-bold">Verified</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Other Trips */}
      {upcomingTrips.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-[15px] font-bold text-text-primary mb-3">Upcoming Trips</h3>

          <div className="space-y-2">
            {upcomingTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-xl border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{trip.from} → {trip.to}</div>
                    <div className="text-[11px] text-text-muted">{trip.departureTime} • {trip.plateNumber || 'N/A'}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(trip.status || 'scheduled')}`}>
                    {trip.status || 'scheduled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}