"use client";

import { useRouter } from 'next/navigation';
import { useApp } from '@/context/app-context';
import { ArrowLeft, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapTracking = dynamic(() => import('@/components/MapTracking').then(m => ({ default: m.MapTracking })), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-100 animate-pulse rounded-xl" />,
});

export default function DriverMapPage() {
  const router = useRouter();
  const { userRole } = useApp();
  
  if (userRole !== 'driver') {
    router.push('/login');
    return null;
  }

  return (
    <div className="bg-white pb-[88px]">
      <div className="bg-primary pt-[60px] px-5 pb-5 rounded-b-[28px]">
        <button onClick={() => router.push('/driver')} className="mb-3">
          <ArrowLeft size={24} className="text-white" />
        </button>
        <h1 className="text-[24px] font-extrabold text-white">Live Map</h1>
        <p className="text-[13px] text-white/70">Track your current trip</p>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-primary rounded-xl p-3 mb-4 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-[12px] font-medium">Live tracking active</span>
        </div>

        <MapTracking 
          busLocation={[-1.9157, 29.7444]}
          route="Kigali-Musanze"
          showRoute={true}
        />
      </div>
    </div>
  );
}