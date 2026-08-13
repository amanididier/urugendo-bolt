"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, ArrowUp, ArrowDown, History, ChevronRight, Star, Ticket, Users } from 'lucide-react';

const samplePointsHistory = [
  { id: '1', amount: 10, reason: 'Completed trip Kigali → Musanze', date: '2026-04-13', type: 'earn' },
  { id: '2', amount: 30, reason: 'Shared location during trip', date: '2026-04-13', type: 'earn' },
  { id: '3', amount: 5, reason: 'Rated trip after arrival', date: '2026-04-12', type: 'earn' },
  { id: '4', amount: -100, reason: 'Redeemed: Free booking fee', date: '2026-04-10', type: 'redeem' },
  { id: '5', amount: 15, reason: 'Referred a friend who booked', date: '2026-04-08', type: 'earn' },
  { id: '6', amount: 10, reason: 'Completed trip Kigali → Huye', date: '2026-04-05', type: 'earn' },
];

const rewards = [
  { points: 100, name: 'Free booking fee', value: '~200 RWF', discount: true },
  { points: 300, name: '10% off any ticket', value: '~350 RWF', discount: true },
  { points: 500, name: 'Free ticket (lowest route)', value: 'Up to 1,200 RWF', discount: true },
];

export default function PointsPage() {
  const [points] = useState(145);
  const [history] = useState(samplePointsHistory);

  const earnedTotal = history.filter(h => h.type === 'earn').reduce((sum, h) => sum + h.amount, 0);
  const redeemedTotal = history.filter(h => h.type === 'redeem').reduce((sum, h) => sum + Math.abs(h.amount), 0);

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-500 to-amber-600 pt-[60px] px-5 pb-8 rounded-b-[28px]">
        <div className="text-center">
          <p className="text-[12px] text-white/70 mb-1">Your Points Balance</p>
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-[56px] font-extrabold text-white"
          >
            {points}
          </motion.div>
          <p className="text-[13px] text-white/80">Points</p>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 mt-6">
          <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
            <div className="text-[18px] font-bold text-white">+{earnedTotal}</div>
            <div className="text-[10px] text-white/70">Earned</div>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
            <div className="text-[18px] font-bold text-white">-{redeemedTotal}</div>
            <div className="text-[10px] text-white/70">Redeemed</div>
          </div>
        </div>
      </div>

      {/* How to Earn */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl border border-border p-4">
          <h3 className="text-[15px] font-bold text-text-primary mb-3 flex items-center gap-2">
            <Star size={16} className="text-amber-500" />
            How to Earn Points
          </h3>
          <div className="space-y-2">
            {[
              { points: 10, action: 'Complete a trip' },
              { points: 30, action: 'Share location during trip' },
              { points: 5, action: 'Rate trip after arrival' },
              { points: 15, action: 'Refer a friend who books' },
              { points: 20, action: 'Check out when dropping midway' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-[13px] text-text-primary">{item.action}</span>
                <span className="text-[13px] font-bold text-primary">+{item.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Redeem Rewards */}
      <div className="px-4 mt-4">
        <h3 className="text-[15px] font-bold text-text-primary mb-3">Redeem Rewards</h3>
        <div className="space-y-2">
          {rewards.map((reward, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="w-full bg-white rounded-xl border border-border p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift size={20} className="text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-[14px] font-bold text-text-primary">{reward.name}</div>
                  <div className="text-[11px] text-text-muted">{reward.value}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-amber-600">{reward.points} pts</span>
                <ChevronRight size={16} className="text-text-muted" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="px-4 mt-4">
        <h3 className="text-[15px] font-bold text-text-primary mb-3 flex items-center gap-2">
          <History size={16} />
          Points History
        </h3>
        <div className="bg-white rounded-2xl border border-border divide-y divide-border">
          {history.map((item, i) => (
            <div key={item.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.type === 'earn' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {item.type === 'earn' ? (
                    <ArrowUp size={14} className="text-green-600" />
                  ) : (
                    <ArrowDown size={14} className="text-red-600" />
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-text-primary">{item.reason}</div>
                  <div className="text-[11px] text-text-muted">{item.date}</div>
                </div>
              </div>
              <span className={`text-[14px] font-bold ${
                item.type === 'earn' ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.amount > 0 ? '+' : ''}{item.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="px-4 mt-4 pb-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-[12px] text-blue-800">
            <strong>Note:</strong> Points never expire and are non-transferable. 
            Keep earning to unlock more rewards!
          </p>
        </div>
      </div>
    </div>
  );
}
