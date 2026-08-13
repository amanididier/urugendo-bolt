"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Home, Ticket, User, Bus, Settings, Users, MapPin, FileText, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

type UserRole = 'passenger' | 'agent' | 'driver';

const passengerTabs = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/tickets', icon: Ticket, label: 'Tickets' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const agentTabs = [
  { path: '/agency', icon: Bus, label: 'Dashboard' },
  { path: '/agency/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/agency/reports', icon: FileText, label: 'Reports' },
  { path: '/profile', icon: Settings, label: 'Settings' },
];

const driverTabs = [
  { path: '/driver', icon: Bus, label: 'Trips' },
  { path: '/driver/passengers', icon: Users, label: 'Passengers' },
  { path: '/driver/map', icon: MapPin, label: 'Map' },
  { path: '/profile', icon: User, label: 'Profile' },
];

interface BottomNavProps {
  role?: UserRole;
}

export function BottomNav({ role = 'passenger' }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = role === 'agent' ? agentTabs : role === 'driver' ? driverTabs : passengerTabs;

  if (pathname === '/splash' || pathname === '/' || pathname === '/splash/' || pathname === '/login') return null;

  const isActive = (path: string) => {
    if (path === '/home') return pathname === '/home' || pathname === '/';
    if (path === '/agency') return pathname.startsWith('/agency');
    if (path === '/driver') return pathname.startsWith('/driver');
    if (path === '/profile') return pathname.startsWith('/profile');
    return pathname.startsWith(path);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-border z-40 safe-bottom">
      <div className="flex items-center justify-around h-[68px] px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative"
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary-light rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ scale: active ? 1.15 : 1, y: active ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="relative z-10"
              >
                <Icon
                  size={22}
                  className={active ? 'text-primary' : 'text-text-muted'}
                  strokeWidth={active ? 2.5 : 2}
                />
              </motion.div>
              <span
                className={`text-[10px] font-semibold relative z-10 ${
                  active ? 'text-primary' : 'text-text-muted'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
