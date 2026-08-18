"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Ticket,
  User,
  Bus,
  Settings,
  Users,
  MapPin,
  FileText,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

type UserRole = "passenger" | "agent" | "driver";

const passengerTabs = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/tickets", icon: Ticket, label: "Tickets" },
  { path: "/profile", icon: User, label: "Profile" },
];

const agentTabs = [
  { path: "/agency", icon: Bus, label: "Dashboard" },
  { path: "/agency/schedule", icon: Calendar, label: "Schedule" },
  { path: "/agency/reports", icon: FileText, label: "Reports" },
  { path: "/profile", icon: Settings, label: "Settings" },
];

const driverTabs = [
  { path: "/driver", icon: Bus, label: "Trips" },
  { path: "/driver/passengers", icon: Users, label: "Passengers" },
  { path: "/driver/map", icon: MapPin, label: "Map" },
  { path: "/profile", icon: User, label: "Profile" },
];

interface BottomNavProps {
  role?: UserRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Hide nav bar strictly on initial splash and authentication screens
  const isHiddenRoute =
    pathname === "/splash" ||
    pathname === "/" ||
    pathname === "/splash/" ||
    pathname === "/login" ||
    pathname === "/agency/login";

  if (isHiddenRoute) {
    return null;
  }

  // Route-first role resolution: default all passenger flow pages (including seats & payment) to passenger
  let activeRole: UserRole = "passenger";
  if (pathname.startsWith("/agency")) {
    activeRole = "agent";
  } else if (pathname.startsWith("/driver")) {
    activeRole = "driver";
  } else {
    activeRole = "passenger";
  }

  const tabs =
    activeRole === "agent"
      ? agentTabs
      : activeRole === "driver"
        ? driverTabs
        : passengerTabs;

  const isActive = (path: string) => {
    if (path === "/home") return pathname === "/home" || pathname === "/";
    if (path === "/agency")
      return (
        pathname === "/agency" ||
        (pathname.startsWith("/agency") &&
          !pathname.includes("schedule") &&
          !pathname.includes("reports"))
      );
    if (path === "/driver") return pathname === "/driver";
    if (path === "/profile") return pathname.startsWith("/profile");
    return pathname.startsWith(path);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200 z-40 safe-bottom">
      <div className="flex items-center justify-around h-[64px] px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 relative cursor-pointer"
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ scale: active ? 1.15 : 1, y: active ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative z-10"
              >
                <Icon
                  size={20}
                  className={active ? "text-primary" : "text-slate-400"}
                  strokeWidth={active ? 2.5 : 2}
                />
              </motion.div>
              <span
                className={`text-[10px] font-semibold relative z-10 ${
                  active ? "text-primary font-bold" : "text-slate-500"
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
