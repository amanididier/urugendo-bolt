"use client";

import { useApp } from "@/context/app-context";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/BottomNav";
import { CityPicker } from "@/components/CityPicker";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { userRole } = useApp();
  
  return (
    <PhoneFrame
      nav={<BottomNav role={userRole} />}
      picker={<CityPicker />}
    >
      {children}
    </PhoneFrame>
  );
}
