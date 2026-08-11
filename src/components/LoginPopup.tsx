"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bus, User, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginPopupProps {
  onClose: () => void;
}

export function LoginPopup({ onClose }: LoginPopupProps) {
  const router = useRouter();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-white rounded-t-3xl w-full p-5 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[18px] font-bold text-text-primary">Login Options</h2>
            <button onClick={onClose} className="p-2">
              <X size={20} className="text-text-muted" />
            </button>
          </div>

          <p className="text-[13px] text-text-muted mb-4">
            Choose your login type to access the appropriate dashboard
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-surface-secondary transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={20} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-bold text-text-primary">Passenger Login</div>
                <div className="text-[11px] text-text-muted">Book tickets, view my trips</div>
              </div>
              <LogIn size={18} className="text-text-muted" />
            </button>

            <button
              onClick={() => router.push('/login')}
              className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-surface-secondary transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Bus size={20} className="text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-bold text-text-primary">Agency Login</div>
                <div className="text-[11px] text-text-muted">Manage trips, verify tickets, reports</div>
              </div>
              <LogIn size={18} className="text-text-muted" />
            </button>

            <button
              onClick={() => router.push('/login')}
              className="w-full p-4 rounded-xl border border-border flex items-center gap-3 hover:bg-surface-secondary transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Bus size={20} className="text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-bold text-text-primary">Driver Login</div>
                <div className="text-[11px] text-text-muted">Verify passengers, view manifest</div>
              </div>
              <LogIn size={18} className="text-text-muted" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-3 text-[14px] font-medium text-text-muted"
          >
            Continue as Guest
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
