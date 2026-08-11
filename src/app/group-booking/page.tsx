"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Minus, Trash2, Search, ArrowRight, UserPlus } from 'lucide-react';

interface Passenger {
  id: string;
  name: string;
  phone: string;
}

export default function GroupBookingPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([
    { id: '1', name: '', phone: '' },
  ]);
  const [tripSelected, setTripSelected] = useState(false);

  const addPassenger = () => {
    if (passengers.length < 10) {
      setPassengers([...passengers, { id: Date.now().toString(), name: '', phone: '' }]);
    }
  };

  const removePassenger = (id: string) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter(p => p.id !== id));
    }
  };

  const updatePassenger = (id: string, field: 'name' | 'phone', value: string) => {
    setPassengers(passengers.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const canProceed = passengers.every(p => p.name && p.phone);

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-5 bg-primary rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Users size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">Group Booking</h1>
            <p className="text-[12px] text-white/70">Book for family or team</p>
          </div>
        </div>
      </div>

      {/* Trip Info */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-text-muted">Selected Trip</span>
            <button className="text-[12px] text-primary font-semibold">Change</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
              🌋
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-text-primary">Kigali → Musanze</div>
              <div className="text-[12px] text-text-muted">Tomorrow · 08:00 · 3,500 RWF</div>
            </div>
          </div>
        </div>
      </div>

      {/* Passengers List */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-text-primary">Passengers ({passengers.length})</h3>
          <button 
            onClick={addPassenger}
            disabled={passengers.length >= 10}
            className="flex items-center gap-1 text-[12px] text-primary font-semibold disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="space-y-3">
          {passengers.map((passenger, i) => (
            <motion.div
              key={passenger.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary">
                  {i + 1}
                </div>
                <span className="text-[13px] font-semibold text-text-primary">Passenger {i + 1}</span>
                {passengers.length > 1 && (
                  <button
                    onClick={() => removePassenger(passenger.id)}
                    className="ml-auto text-text-muted"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={passenger.name}
                    onChange={(e) => updatePassenger(passenger.id, 'name', e.target.value)}
                    placeholder="Jean-Paul K."
                    className="w-full h-10 px-3 rounded-lg border border-border text-[13px] focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={passenger.phone}
                    onChange={(e) => updatePassenger(passenger.id, 'phone', e.target.value)}
                    placeholder="+250 7XX XXX XXX"
                    className="w-full h-10 px-3 rounded-lg border border-border text-[13px] focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {passengers.length >= 10 && (
          <p className="text-[11px] text-text-muted text-center mt-2">
            Maximum 10 passengers per group
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-text-muted">Base Fare × {passengers.length}</span>
            <span className="text-[14px] font-bold text-text-primary">{(passengers.length * 3500).toLocaleString()} RWF</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-text-muted">Booking Fee × {passengers.length}</span>
            <span className="text-[14px] font-bold text-text-primary">{(passengers.length * 200).toLocaleString()} RWF</span>
          </div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-text-primary">Total</span>
              <span className="text-[18px] font-extrabold text-primary">
                {(passengers.length * 3700).toLocaleString()} RWF
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Proceed Button */}
      <div className="px-4 mt-4">
        <button
          disabled={!canProceed}
          className={`w-full h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
            canProceed 
              ? 'bg-primary text-white' 
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <UserPlus size={18} />
          Continue to Payment
        </button>
      </div>

      {/* Info */}
      <div className="px-4 mt-4 pb-4">
        <p className="text-[11px] text-text-muted text-center">
          Group bookings share one payment. Each passenger gets their own seat and ticket.
        </p>
      </div>
    </div>
  );
}
