"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, ArrowLeft, Check } from 'lucide-react';
import { normalizePhone } from '@/lib/api';

export default function WaitlistPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized) {
      setSubmitted(true);
    }
  };

  return (
    <div className="bg-white min-h-screen pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-6 bg-primary rounded-b-[28px]">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/80 mb-4"
        >
          <ArrowLeft size={20} />
          <span className="text-[14px]">Go back</span>
        </button>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-6xl mb-4 text-center"
        >
          🚧
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white text-center">
          Coming Soon!
        </h1>
        <p className="text-[14px] text-white/70 text-center mt-2">
          We're expanding to this route!
        </p>
      </div>

      {/* Content */}
      <div className="px-5 py-8">
        {!submitted ? (
          <>
            <p className="text-[15px] text-text-secondary text-center mb-6">
              Enter your phone number to be the first to know when this route opens. 
              You'll get priority access and special discounts!
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-text-primary block mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+250 7XX XXX XXX"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={!phone}
                className={`w-full h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
                  phone 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Bell size={18} />
                Notify Me
              </button>
            </form>

            <p className="text-[11px] text-text-muted text-center mt-4">
              By joining, you agree to receive SMS notifications about this route.
            </p>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check size={40} className="text-green-600" />
            </div>
            <h2 className="text-[20px] font-bold text-text-primary mb-2">
              You're on the list!
            </h2>
            <p className="text-[14px] text-text-muted">
              We'll notify you as soon as this route becomes available.
            </p>
            <button
              onClick={() => router.push('/home')}
              className="mt-6 text-[14px] text-primary font-semibold"
            >
              Back to Home
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
