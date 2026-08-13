"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { formatPrice } from '@/lib/data';
import { t } from '@/lib/translations';
import { fetchTakenSeats } from '@/lib/api';
import { useState, useEffect } from 'react';

const ROWS = 9;
const COLS = ['A', 'B', 'C', 'D'];

export default function SeatSelectionPage() {
  const router = useRouter();
  const { selectedTrip, selectedSeat, setSelectedSeat, language } = useApp();
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!selectedTrip) return;
    fetchTakenSeats(selectedTrip.id).then(setTakenSeats);
  }, [selectedTrip]);

  if (!selectedTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20">
        <div className="text-4xl mb-4">💺</div>
        <h2 className="text-[20px] font-bold text-text-primary mb-2">{t('noTrip', language)}</h2>
        <p className="text-[14px] text-text-muted text-center mb-6">{t('goBackHome', language)}</p>
        <button onClick={() => router.push('/search')} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px]">
          {t('searchBuses2', language)}
        </button>
      </div>
    );
  }

  const getSeatStatus = (row: number, col: string): 'available' | 'taken' => {
    const seatId = `${row}${col}`;
    return takenSeats.has(seatId) ? 'taken' : 'available';
  };

  const handleSeatClick = (seatId: string, status: string) => {
    if (status === 'taken') return;
    setSelectedSeat(selectedSeat === seatId ? null : seatId);
  };

  const total = selectedSeat ? selectedTrip.price + 200 : 0;

  return (
    <div className="bg-white pb-[130px]">
      {/* Trip strip */}
      <div className="bg-primary pt-[60px] px-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push('/search')} className="p-1 -ml-1">
            <ChevronLeft size={24} className="text-white" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-bold text-white">{selectedTrip.from} → {selectedTrip.to}</div>
            <div className="text-[12px] text-white/70">{selectedTrip.date} · {selectedTrip.departureTime}</div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-bold text-white">{formatPrice(selectedTrip.price)}</div>
            <div className="text-[12px] text-white/70">{t('perSeat', language)}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-badge-green-bg border border-green-300" />
          <span className="text-[12px] text-text-muted">{t('available', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-badge-red-bg border border-red-300" />
          <span className="text-[12px] text-text-muted">{t('taken', language)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-primary" />
          <span className="text-[12px] text-text-muted">{t('yourPick', language)}</span>
        </div>
      </div>

      {/* Bus diagram */}
      <div className="flex justify-center py-4">
        <div className="w-[280px]">
          {/* Driver area */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="text-[12px] text-text-muted font-medium">{t('driver', language)}</div>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[16px]">🚌</div>
          </div>

          {/* Seat grid */}
          <div className="space-y-2">
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={row} className="flex items-center gap-2">
                {/* Row number */}
                <span className="w-5 text-[11px] text-text-muted font-medium text-right">{row + 1}</span>

                {/* Left seats (A, B) */}
                <div className="flex gap-1.5">
                  {COLS.slice(0, 2).map(col => {
                    const seatId = `${row + 1}${col}`;
                    const status = getSeatStatus(row + 1, col);
                    const isSelected = selectedSeat === seatId;

                    return (
                      <motion.button
                        key={seatId}
                        whileTap={{ scale: status === 'taken' ? 1 : 1.08 }}
                        onClick={() => handleSeatClick(seatId, status)}
                        disabled={status === 'taken'}
                        className={`w-[42px] h-[42px] rounded-lg text-[12px] font-semibold flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary text-white'
                            : status === 'taken'
                            ? 'bg-badge-red-bg border border-red-300 text-text-muted cursor-not-allowed'
                            : 'bg-badge-green-bg border border-green-300 text-badge-green-text active:border-primary'
                        }`}
                      >
                        {seatId}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Aisle */}
                <div className="w-6" />

                {/* Right seats (C, D) */}
                <div className="flex gap-1.5">
                  {COLS.slice(2, 4).map(col => {
                    const seatId = `${row + 1}${col}`;
                    const status = getSeatStatus(row + 1, col);
                    const isSelected = selectedSeat === seatId;

                    return (
                      <motion.button
                        key={seatId}
                        whileTap={{ scale: status === 'taken' ? 1 : 1.08 }}
                        onClick={() => handleSeatClick(seatId, status)}
                        disabled={status === 'taken'}
                        className={`w-[42px] h-[42px] rounded-lg text-[12px] font-semibold flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary text-white'
                            : status === 'taken'
                            ? 'bg-badge-red-bg border border-red-300 text-text-muted cursor-not-allowed'
                            : 'bg-badge-green-bg border border-green-300 text-badge-green-text active:border-primary'
                        }`}
                      >
                        {seatId}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA bar */}
      <div className="absolute bottom-[72px] left-0 right-0 bg-white border-t border-border px-5 py-3 z-30">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[12px] text-text-muted">{t('seat', language)}</div>
            <div className="text-[15px] font-bold text-text-primary">{selectedSeat || '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-text-muted">{t('total', language)}</div>
            <div className="text-[20px] font-bold text-primary">
              {selectedSeat ? formatPrice(total) : '—'}
            </div>
          </div>
        </div>
        <button
          onClick={() => selectedSeat && router.push('/payment')}
          disabled={!selectedSeat}
          className={`w-full h-12 rounded-full font-bold text-white text-[15px] flex items-center justify-center active:scale-[0.97] transition-all ${
            selectedSeat ? 'bg-primary' : 'bg-primary/30 cursor-not-allowed'
          }`}
        >
          {t('pay', language)} →
        </button>
      </div>
    </div>
  );
}
