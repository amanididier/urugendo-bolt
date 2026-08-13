"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Clock, Ticket, ArrowRight, MapPin, Bus, TrendingUp, DollarSign, Calendar, ChevronRight, Search, CheckCircle, XCircle } from 'lucide-react';
import { fetchTripsByDate, fetchAllBookings, updateBookingStatus, updateTripStatus } from '@/lib/api';
import type { Trip, Booking } from '@/lib/types';

interface PassengerRow {
  id: string;
  name: string;
  seat: string;
  code: string;
  type: 'digital';
  verified: boolean;
}

export default function AgencyDashboard() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'schedule' | 'reports' | 'verify'>('today');
  const [searchSeat, setSearchSeat] = useState('');
  const [verifyResult, setVerifyResult] = useState<{found: boolean; passenger?: PassengerRow} | null>(null);
  const [verifying, setVerifying] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [todayTrips, allBookings] = await Promise.all([
      fetchTripsByDate(today),
      fetchAllBookings(),
    ]);
    setTrips(todayTrips);
    setBookings(allBookings);
    setLoading(false);
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derive passengers from real bookings for today's trips
  const passengers: PassengerRow[] = bookings
    .filter(b => {
      const trip = trips.find(t => t.id === b.trip.id);
      return trip && b.status !== 'cancelled';
    })
    .map(b => ({
      id: b.id,
      name: b.passengerName || 'Unknown',
      seat: b.seat,
      code: b.shortCode,
      type: 'digital' as const,
      verified: b.status === 'boarded',
    }));

  const todayBookingsCount = passengers.length;
  const todayRevenue = passengers.reduce((sum, b) => {
    const trip = trips.find(t => t.id === bookings.find(bk => bk.id === b.id)?.trip.id);
    return sum + (trip?.price || 0);
  }, 0);

  const stats = {
    todayBookings: todayBookingsCount,
    todayRevenue,
    weekBookings: bookings.length,
    weekRevenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
    totalBuses: new Set(trips.map(t => t.plateNumber || t.id).filter(Boolean)).size,
    activeRoutes: new Set(trips.map(t => `${t.from}-${t.to}`)).size,
  };

  const handleVerify = () => {
    if (!searchSeat.trim()) {
      setVerifyResult({ found: false });
      return;
    }
    const seat = searchSeat.toUpperCase().trim();
    const found = passengers.find(p => p.seat.toUpperCase() === seat);
    if (found) {
      setVerifyResult({ found: true, passenger: found });
    } else {
      setVerifyResult({ found: false });
    }
  };

  const toggleVerify = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || verifying) return;
    setVerifying(true);
    const newStatus = booking.status === 'boarded' ? 'upcoming' : 'boarded';
    const success = await updateBookingStatus(bookingId, newStatus);
    if (success) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
      setVerifyResult(prev => {
        if (prev?.passenger?.id === bookingId) {
          return { found: true, passenger: { ...prev.passenger, verified: newStatus === 'boarded' } };
        }
        return prev;
      });
    }
    setVerifying(false);
  };

  const handleMarkDelayed = async (tripId: string) => {
    const success = await updateTripStatus(tripId, 'delayed');
    if (success) {
      setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'delayed' as any } : t));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'boarding': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'departed': return 'bg-gray-100 text-gray-600';
      case 'arrived': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'delayed': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-secondary pb-[88px] min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-[14px]">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header */}
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            🏢
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">Agency Dashboard</h1>
            <p className="text-[12px] text-white/70">Volcano Express</p>
          </div>
        </div>
        
        {/* Agency Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">{stats.todayBookings}</div>
            <div className="text-[8px] text-white/70">Today</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">{(stats.todayRevenue/1000).toFixed(0)}K</div>
            <div className="text-[8px] text-white/70">Revenue</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">{stats.totalBuses}</div>
            <div className="text-[8px] text-white/70">Buses</div>
          </div>
          <div className="bg-white/10 rounded-xl p-2 text-center">
            <div className="text-[16px] font-bold text-white">{stats.activeRoutes}</div>
            <div className="text-[8px] text-white/70">Routes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl p-1 border border-border flex">
          {(['today', 'schedule', 'verify', 'reports'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                activeTab === tab ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {tab === 'today' ? 'Today' : tab === 'schedule' ? 'Schedule' : tab === 'verify' ? 'Verify' : 'Reports'}
            </button>
          ))}
        </div>
      </div>

      {/* Today Tab */}
      {activeTab === 'today' && (
        <div className="px-4 mt-4">
          {/* Revenue Card */}
          <div className="bg-gradient-to-r from-green-500 to-primary rounded-2xl p-4 text-white mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-white/70">Today's Revenue</span>
              <DollarSign size={18} className="text-white/70" />
            </div>
            <div className="text-[28px] font-extrabold">{stats.todayRevenue.toLocaleString()} RWF</div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-white/80">
              <TrendingUp size={14} />
              <span>{stats.todayBookings} bookings today</span>
            </div>
          </div>

          {/* Booking Summary */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ticket size={14} className="text-primary" />
                </div>
                <span className="text-[10px] text-text-muted">Urugendo</span>
              </div>
              <div className="text-[20px] font-bold text-primary">{stats.todayBookings}</div>
              <div className="text-[9px] text-text-muted">Digital bookings</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Ticket size={14} className="text-amber-600" />
                </div>
                <span className="text-[10px] text-text-muted">Paper</span>
              </div>
              <div className="text-[20px] font-bold text-amber-600">0</div>
              <div className="text-[9px] text-text-muted">Manual tickets</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => router.push('/agency/schedule')} className="bg-white rounded-xl py-3 border border-border flex items-center justify-center gap-2">
              <Plus size={16} className="text-primary" />
              <span className="text-[12px] font-semibold text-text-primary">Add Trip</span>
            </button>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="px-4 mt-4">
          <button onClick={() => router.push('/agency/schedule')} className="w-full bg-primary text-white rounded-xl py-3 flex items-center justify-center gap-2 font-bold mb-4">
            <Plus size={18} />
            Add New Departure
          </button>

          {trips.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-[13px]">No trips scheduled for today</div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip, i) => {
                const tripBookings = bookings.filter(b => b.trip.id === trip.id && b.status !== 'cancelled');
                const bookedCount = tripBookings.length;
                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-xl border border-border overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-surface-secondary flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-text-muted" />
                        <span className="text-[13px] font-bold text-text-primary">{trip.departureTime}</span>
                        <span className="text-[11px] text-text-muted">→ {trip.arrivalTime}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(trip.status || 'scheduled')}`}>
                        {(trip.status || 'SCHEDULED').toUpperCase()}
                      </span>
                    </div>

                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-primary" />
                          <span className="text-[12px] font-semibold text-text-primary">{trip.from} → {trip.to}</span>
                        </div>
                        <span className="text-[10px] text-text-muted">{trip.plateNumber || 'N/A'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-primary">{bookedCount}</div>
                            <div className="text-[8px] text-text-muted">Booked</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-green-600">{trip.totalSeats - bookedCount}</div>
                            <div className="text-[8px] text-text-muted">Remaining</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[14px] font-bold text-text-muted">{trip.totalSeats}</div>
                            <div className="text-[8px] text-text-muted">Total</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {trip.status !== 'delayed' && trip.status !== 'departed' && trip.status !== 'arrived' && (
                            <button
                              onClick={() => handleMarkDelayed(trip.id)}
                              className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full"
                            >
                              Mark Delayed
                            </button>
                          )}
                          <div className="text-right">
                            <div className="text-[14px] font-bold text-text-primary">{(trip.price * bookedCount).toLocaleString()}</div>
                            <div className="text-[8px] text-text-muted">RWF</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Verify Tab */}
      {activeTab === 'verify' && (
        <div className="px-4 mt-4">
          {/* Quick Verify by Seat */}
          <div className="bg-white rounded-xl border border-border p-4 mb-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-3">Quick Verify by Seat</h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchSeat}
                  onChange={(e) => setSearchSeat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="Enter seat (e.g., 3B)"
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-[14px]"
                />
              </div>
              <button
                onClick={handleVerify}
                className="bg-primary text-white px-4 rounded-xl font-bold"
              >
                Verify
              </button>
            </div>

            {/* Result */}
            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-xl ${
                  verifyResult.found && verifyResult.passenger?.verified
                    ? 'bg-green-50 border border-green-200'
                    : verifyResult.found
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {verifyResult.found ? (
                  <div className="flex items-center gap-3">
                    {verifyResult.passenger?.verified ? (
                      <CheckCircle size={24} className="text-green-600" />
                    ) : (
                      <XCircle size={24} className="text-amber-600" />
                    )}
                    <div className="flex-1">
                      <div className="text-[14px] font-bold text-text-primary">{verifyResult.passenger?.name}</div>
                      <div className="text-[12px] text-text-muted">
                        Seat {verifyResult.passenger?.seat} • Urugendo Ticket
                      </div>
                    </div>
                    <button
                      onClick={() => verifyResult.passenger && toggleVerify(verifyResult.passenger.id)}
                      disabled={verifying}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${
                        verifyResult.passenger?.verified
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {verifyResult.passenger?.verified ? 'Unverify' : 'Mark Verified'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-red-600 text-[13px]">No passenger found with that seat</div>
                )}
              </motion.div>
            )}
          </div>

          {/* All Passengers */}
          <div className="bg-white rounded-xl border border-border p-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-3">All Passengers Today</h3>
            {passengers.length === 0 ? (
              <div className="text-center py-4 text-text-muted text-[13px]">No bookings yet</div>
            ) : (
              <div className="space-y-2">
                {passengers.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      p.verified ? 'bg-green-50' : 'bg-surface-secondary'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold bg-primary/10 text-primary">
                      {p.seat}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-text-primary">{p.name}</div>
                      <div className="text-[11px] text-text-muted">Urugendo</div>
                    </div>
                    {p.verified ? (
                      <div className="flex items-center gap-1 text-green-600 text-[11px] font-bold">
                        <CheckCircle size={14} />
                        Verified
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleVerify(p.id)}
                        disabled={verifying}
                        className="text-[11px] font-bold text-primary"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-xl border border-border p-4 mb-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-3">Weekly Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Total Bookings</span>
                <span className="text-[14px] font-bold text-text-primary">{stats.weekBookings}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Total Revenue</span>
                <span className="text-[14px] font-bold text-green-600">{stats.weekRevenue.toLocaleString()} RWF</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-muted">Avg per Trip</span>
                <span className="text-[14px] font-bold text-text-primary">
                  {stats.weekBookings > 0 ? Math.round(stats.weekRevenue / stats.weekBookings).toLocaleString() : 0} RWF
                </span>
              </div>
            </div>
          </div>

          <button onClick={() => router.push('/agency/reports')} className="w-full bg-white border border-border rounded-xl py-3 flex items-center justify-center gap-2">
            <Calendar size={16} className="text-text-muted" />
            <span className="text-[13px] font-semibold text-text-primary">View Full Report</span>
            <ChevronRight size={16} className="text-text-muted" />
          </button>
        </div>
      )}
    </div>
  );
}
