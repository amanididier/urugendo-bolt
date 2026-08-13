"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, MapPin, Clock, Users, ArrowRight } from 'lucide-react';

const trendingRoutes = [
  { id: '1', from: 'Kigali', to: 'Musanze', bookings: 1247, trend: 'up' as const, avgPrice: 3500 },
  { id: '2', from: 'Kigali', to: 'Rubavu', bookings: 892, trend: 'up' as const, avgPrice: 4000 },
  { id: '3', from: 'Kigali', to: 'Huye', bookings: 654, trend: 'stable' as const, avgPrice: 2500 },
  { id: '4', from: 'Musanze', to: 'Rubavu', bookings: 423, trend: 'up' as const, avgPrice: 2000 },
  { id: '5', from: 'Kigali', to: 'Nyanza', bookings: 312, trend: 'up' as const, avgPrice: 1800 },
];

export default function TrendingPage() {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('week');

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-5 bg-primary rounded-b-[28px]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white">Trending Routes</h1>
            <p className="text-[12px] text-white/70">Most popular in Rwanda</p>
          </div>
        </div>
      </div>

      {/* Time Filter */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl p-1 border border-border flex">
          {(['today', 'week', 'month'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                timeFilter === filter 
                  ? 'bg-primary text-white' 
                  : 'text-text-muted'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-border text-center">
            <div className="text-[20px] font-bold text-primary">3.5K</div>
            <div className="text-[10px] text-text-muted">Total Bookings</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-border text-center">
            <div className="text-[20px] font-bold text-amber-500">5</div>
            <div className="text-[10px] text-text-muted">Active Routes</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-border text-center">
            <div className="text-[20px] font-bold text-blue-600">98%</div>
            <div className="text-[10px] text-text-muted">Satisfaction</div>
          </div>
        </div>
      </div>

      {/* Trending List */}
      <div className="px-4 mt-4">
        <h3 className="text-[15px] font-bold text-text-primary mb-3">Top Routes</h3>
        <div className="space-y-2">
          {trendingRoutes.map((route, i) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-text-primary">
                      {route.from} → {route.to}
                    </span>
                    {route.trend === 'up' && (
                      <span className="text-[10px] text-green-600 font-medium">↑ Hot</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1">
                      <Users size={12} className="text-text-muted" />
                      <span className="text-[11px] text-text-muted">{route.bookings}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-text-muted" />
                      <span className="text-[11px] text-text-muted">{route.avgPrice} RWF</span>
                    </div>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                  <ArrowRight size={18} className="text-primary" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Insight */}
      <div className="px-4 mt-4 pb-4">
        <div className="bg-gradient-to-r from-primary-light to-green-50 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-text-primary">Kigali → Musanze is #1!</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                This route has 40% more bookings than last month
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
