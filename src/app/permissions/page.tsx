"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Navigation, Check, X, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Permission {
  id: string;
  name: string;
  description: string;
  icon: string;
  granted: boolean;
  required: boolean;
}

export default function PermissionsPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([
    { id: 'notifications', name: 'Notifications', description: 'Get booking updates, departure alerts, and promotions', icon: '🔔', granted: false, required: true },
    { id: 'location', name: 'Location', description: 'Book from your current location and track your bus', icon: '📍', granted: false, required: true },
  ]);
  const [allGranted, setAllGranted] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissions(prev => prev.map(p => 
        p.id === 'notifications' ? { ...p, granted: Notification.permission === 'granted' } : p
      ));
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setPermissions(prev => prev.map(p => p.id === 'location' ? { ...p, granted: true } : p)),
        () => {},
        { timeout: 0 }
      );
    }
  }, []);

  useEffect(() => {
    const required = permissions.filter(p => p.required);
    setAllGranted(required.every(p => p.granted));
  }, [permissions]);

  const requestPermission = async (id: string) => {
    if (id === 'notifications') {
      if (!('Notification' in window)) {
        alert('Notifications not supported');
        return;
      }
      const result = await Notification.requestPermission();
      setPermissions(prev => prev.map(p => 
        p.id === 'notifications' ? { ...p, granted: result === 'granted' } : p
      ));
    } else if (id === 'location') {
      if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => setPermissions(prev => prev.map(p => p.id === 'location' ? { ...p, granted: true } : p)),
        (error) => alert('Location denied: ' + error.message)
      );
    }
  };

  const handleContinue = () => {
    router.push('/home');
  };

  return (
    <div className="bg-white min-h-screen pb-[88px]">
      {/* Header */}
      <div className="pt-[60px] px-5 pb-6 bg-primary rounded-b-[28px]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-6xl mb-4 text-center"
        >
          ⚙️
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white text-center">
          Enable Permissions
        </h1>
        <p className="text-[14px] text-white/70 text-center mt-2">
          Allow access to get the full Urugendo experience
        </p>
      </div>

      {/* Permissions List */}
      <div className="px-5 py-6">
        <div className="space-y-4">
          {permissions.map((permission, i) => (
            <motion.div
              key={permission.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl border p-4 ${
                permission.granted 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-border bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-secondary flex items-center justify-center text-2xl">
                  {permission.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-text-primary">{permission.name}</h3>
                    {permission.granted && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-muted mt-1">{permission.description}</p>
                </div>
                {!permission.granted && (
                  <button
                    onClick={() => requestPermission(permission.id)}
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Smartphone size={18} className="text-white" />
                  </button>
                )}
                {permission.granted && (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check size={18} className="text-green-600" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="px-5">
        {allGranted ? (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
            <Check size={24} className="text-green-600 mx-auto mb-2" />
            <p className="text-[14px] text-green-800 font-medium">All permissions enabled!</p>
            <p className="text-[11px] text-green-700">You're all set for the best experience.</p>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-center">
            <p className="text-[12px] text-amber-800">
              Please enable all required permissions to get booking updates and use location features.
            </p>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className="px-5 mt-6">
        <button
          onClick={handleContinue}
          className="w-full h-12 rounded-full bg-primary text-white font-bold text-[15px]"
        >
          Continue to Home
        </button>
      </div>

      {/* Skip */}
      <div className="px-5 mt-4 text-center">
        <button
          onClick={handleContinue}
          className="text-[13px] text-text-muted underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
