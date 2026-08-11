"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { useApp } from '@/context/app-context';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUserRole } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAgency = searchParams.get('role') === 'agency';

  const handleLogin = () => {
    setError('');
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('urugendo_role', 'agent');
      }
      setUserRole('agent');
      router.push('/agency');
    }, 1000);
  };

  return (
    <div className="bg-white min-h-screen pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-6 bg-primary rounded-b-[28px]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-5xl mb-4 text-center"
        >
          🏢
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white text-center">
          Agency Sign In
        </h1>
        <p className="text-[14px] text-white/70 text-center mt-2">
          Manage trips, verify tickets, and view reports
        </p>
      </div>

      {/* Login Form */}
      <div className="px-5 mt-6">
        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-text-primary block mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agency@virunga.rw"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-[13px] font-semibold text-text-primary block mb-2">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border bg-white text-[15px] focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!email || !password || loading}
            className={`w-full h-12 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
              email && password && !loading ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {loading ? 'Signing in...' : 'Sign In'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* Back to passenger */}
      <div className="px-5 mt-6 text-center">
        <button
          onClick={() => router.push('/splash')}
          className="text-[13px] text-text-muted font-semibold"
        >
          Back to home
        </button>
      </div>

      {/* Security Note */}
      <div className="px-5 mt-6 flex items-center justify-center gap-2 text-[11px] text-text-muted">
        <Shield size={14} />
        <span>256-bit encrypted • Safe & secure</span>
      </div>
    </div>
  );
}
