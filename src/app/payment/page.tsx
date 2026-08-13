"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { formatPrice, generateShortCode } from '@/lib/data';
import { createBooking, decrementAvailableSeats, normalizePhone } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { t } from '@/lib/translations';

type PayState = 'idle' | 'initiating' | 'awaiting_approval' | 'polling' | 'success' | 'failed';

export default function PaymentPage() {
  const router = useRouter();
  const { selectedTrip, selectedSeat, paymentMethod, setPaymentMethod, addBooking, language } = useApp();
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<PayState>('idle');
  const [error, setError] = useState('');
  const [referenceId, setReferenceId] = useState('');

  if (!selectedTrip || !selectedSeat) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20">
        <div className="text-4xl mb-4">💳</div>
        <h2 className="text-[20px] font-bold text-text-primary mb-2">{t('noBooking', language)}</h2>
        <button onClick={() => router.push('/home')} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px]">
          {t('backToHome', language)}
        </button>
      </div>
    );
  }

  const bookingFee = Math.round(selectedTrip.price * 0.025);
  const total = selectedTrip.price + bookingFee;

  const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL}/functions/v1/mtn-payment`;

  const pollPaymentStatus = async (refId: string): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`${functionUrl}?action=status&referenceId=${refId}`, {
          headers: {
            Authorization: `Bearer ${session?.access_token || ''}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
          },
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === 'success') return true;
        if (data.status === 'failed') return false;
      } catch {
        // network hiccup, keep polling
      }
      attempts++;
    }
    return false;
  };

  const handlePay = async () => {
    setError('');
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError('Enter a valid MTN number (e.g. 0788123456 or 250788123456)');
      return;
    }

    setState('initiating');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          bookingId: selectedTrip.id,
          amount: total,
          phone: cleanPhone,
          currency: 'RWF',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Payment request failed');
      }

      const data = await res.json();
      setReferenceId(data.referenceId);
      setState('awaiting_approval');

      // Create the booking locally so the ticket page works
      const localBookingId = addBooking({
        trip: selectedTrip,
        seat: selectedSeat,
        passengerName: 'You',
        passengerPhone: cleanPhone,
        shortCode: generateShortCode(),
        paymentMethod: 'MTN MoMo',
        totalAmount: total,
        bookingFee,
        status: 'upcoming',
        bookingDate: new Date().toISOString().split('T')[0],
      });

      // Persist to database and use the DB ID for navigation
      const dbBookingId = await createBooking({
        trip: selectedTrip,
        seat: selectedSeat,
        passengerName: 'You',
        passengerPhone: cleanPhone,
        shortCode: generateShortCode(),
        paymentMethod: 'MTN MoMo',
        totalAmount: total,
        bookingFee,
        status: 'upcoming',
        bookingDate: new Date().toISOString().split('T')[0],
      });

      await decrementAvailableSeats(selectedTrip.id);

      setState('polling');
      const success = await pollPaymentStatus(data.referenceId);

      if (success) {
        setState('success');
        const navigateId = dbBookingId || localBookingId;
        setTimeout(() => router.push(`/ticket/${navigateId}`), 1500);
      } else {
        setState('failed');
        setError('Payment was not approved or timed out. Please try again.');
      }
    } catch (err) {
      setState('failed');
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  const isMTN = paymentMethod === 'mtn';

  return (
    <div className="bg-white pb-[140px] min-h-full">
      <div className="pt-[60px] px-5 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-text-primary" />
          </button>
          <h1 className="text-[20px] font-bold text-text-primary">{t('payment', language)}</h1>
        </div>
        <p className="text-[13px] text-text-muted ml-8">{t('almostThere', language)}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-5 bg-white rounded-[20px] border border-border p-4 mb-4 shadow-sm"
      >
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('route', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{selectedTrip.from} → {selectedTrip.to}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('dateTime', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{selectedTrip.date} · {selectedTrip.departureTime}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('operator', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{selectedTrip.operator.emoji} {selectedTrip.operator.name}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('seat', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{selectedSeat}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('baseFare', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{formatPrice(selectedTrip.price)}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex justify-between">
            <span className="text-[14px] text-text-muted">{t('bookingFee', language)}</span>
            <span className="text-[14px] font-semibold text-text-primary">{formatPrice(bookingFee)}</span>
          </div>
          <div className="border-t-2 border-primary/20" />
          <div className="flex justify-between items-center">
            <span className="text-[15px] font-bold text-text-primary">{t('totalLabel', language)}</span>
            <span className="text-[22px] font-extrabold text-primary">{formatPrice(total)}</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mx-5 bg-white rounded-[20px] border border-border p-4 mb-4 shadow-sm"
      >
        <h3 className="text-[15px] font-bold text-text-primary mb-3">{t('paymentMethod', language)}</h3>
        <div className="space-y-2">
          {[
            { id: 'mtn' as const, name: 'MTN MoMo', emoji: '📱', badge: 'Recommended', disabled: false },
            { id: 'airtel' as const, name: 'Airtel Money', emoji: '🔴', badge: null, disabled: true },
            { id: 'card' as const, name: 'Bank Card', emoji: '💳', badge: 'Coming Soon', disabled: true },
          ].map((method) => (
            <button
              key={method.id}
              disabled={method.disabled}
              onClick={() => setPaymentMethod(method.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                paymentMethod === method.id
                  ? 'border-primary bg-primary-light'
                  : method.disabled
                  ? 'border-border bg-gray-50 opacity-50 cursor-not-allowed'
                  : 'border-border active:bg-gray-50'
              }`}
            >
              <span className="text-xl">{method.emoji}</span>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-semibold text-text-primary">{method.name}</div>
              </div>
              {method.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  method.badge === 'Recommended' ? 'bg-badge-green-bg text-badge-green-text' : 'bg-gray-100 text-text-muted'
                }`}>
                  {method.badge}
                </span>
              )}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === method.id ? 'border-primary' : 'border-border'
              }`}>
                {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {isMTN && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-5 bg-white rounded-[20px] border border-border p-4 mb-4 shadow-sm"
        >
          <label className="text-[13px] font-semibold text-text-primary block mb-2">
            MTN MoMo Number
          </label>
          <div className="relative">
            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0788123456 or 250788123456"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
            />
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            You'll receive a prompt on your phone to approve the payment.
          </p>
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-5 mb-4 p-3 rounded-xl bg-badge-red-bg border border-red-200 flex items-start gap-2"
          >
            <AlertCircle size={16} className="text-badge-red-text flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-badge-red-text">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center text-[12px] text-text-muted mb-4 px-5">
        🔐 {t('security', language)}
      </div>

      <div className="absolute bottom-[72px] left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-border px-5 py-3 z-30">
        <button
          onClick={handlePay}
          disabled={state === 'initiating' || state === 'awaiting_approval' || state === 'polling' || !phone}
          className={`w-full h-14 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
            state === 'initiating' || state === 'awaiting_approval' || state === 'polling'
              ? 'bg-primary/70 text-white'
              : state === 'success'
              ? 'bg-green-600 text-white'
              : state === 'failed'
              ? 'bg-badge-red-text text-white'
              : phone
              ? 'bg-primary text-white shadow-[0_4px_16px_rgba(0,184,92,0.35)] active:scale-[0.97]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {state === 'idle' && <>🔒 Pay {formatPrice(total)}</>}
          {state === 'initiating' && (
            <>
              <Loader2 size={18} className="animate-spin" />
              Sending request...
            </>
          )}
          {state === 'awaiting_approval' && (
            <>
              <Loader2 size={18} className="animate-spin" />
              Approve on your phone...
            </>
          )}
          {state === 'polling' && (
            <>
              <Loader2 size={18} className="animate-spin" />
              Confirming payment...
            </>
          )}
          {state === 'success' && (
            <>
              <Check size={18} />
              Payment successful!
            </>
          )}
          {state === 'failed' && <>Try again</>}
        </button>
      </div>
    </div>
  );
}
