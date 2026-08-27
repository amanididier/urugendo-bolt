"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CityPicker } from "@/components/CityPicker";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();

  // Hide global passenger nav for manager and login routes
  const isNavHidden =
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/splash") ||
    pathname.startsWith("/user-login") ||
    pathname.startsWith("/agency/agency-login") ||
    pathname.startsWith("/manager");

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-0 md:p-6">
      {/* Phone Shell */}
      <div className="relative w-full max-w-[390px] h-[100dvh] md:h-[844px] bg-white md:rounded-[48px] md:border-[9px] md:border-[#111111] overflow-hidden flex flex-col shadow-2xl">
        {/* Dynamic Island Notch Overlay */}
        <div className="absolute top-0 inset-x-0 h-11 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-[118px] h-[33px] bg-black rounded-full mt-2" />
        </div>

        {/* Scrollable Screen Body */}
        <main
          className={`flex-1 overflow-y-auto relative ${
            isNavHidden ? "pb-0" : "pb-[68px]"
          }`}
        >
          {children}
        </main>

        {/* Global Passenger Nav & City Picker */}
        <BottomNav />
        <CityPicker />
      </div>
    </div>
  );
}
