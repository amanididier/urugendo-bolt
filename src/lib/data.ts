import { City, Operator, Route, Trip, Booking } from "./types";

export const cities: City[] = [
  {
    code: "KGL",
    name: "Kigali",
    terminal: "Nyabugogo Terminal",
    flag: "🇷🇼",
    image:
      "https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?w=400&q=80",
  },
  {
    code: "MSZ",
    name: "Musanze",
    terminal: "Musanze Central Terminal",
    flag: "🌿",
    image:
      "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80",
  },
  {
    code: "HYE",
    name: "Huye",
    terminal: "Huye Bus Terminal",
    flag: "📚",
    image:
      "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400&q=80",
  },
  {
    code: "RBV",
    name: "Rubavu",
    terminal: "Rubavu Terminal",
    flag: "🏖️",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80",
  },
  {
    code: "NYZ",
    name: "Nyanza",
    terminal: "Nyanza Terminal",
    flag: "👑",
    image:
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80",
  },
  {
    code: "RWM",
    name: "Rwamagana",
    terminal: "Rwamagana Terminal",
    flag: "🌄",
    image:
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80",
  },
  {
    code: "BYM",
    name: "Byumba",
    terminal: "Byumba Terminal",
    flag: "⛰️",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80",
  },
  {
    code: "CYG",
    name: "Cyangugu",
    terminal: "Rusizi Terminal",
    flag: "🌊",
    image:
      "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&q=80",
  },
];

export const BUS_COLORS = [
  "#FF6B1A",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
];

export const operators: Operator[] = [];

export const popularRoutes: Route[] = [
  {
    id: "1",
    from: "Kigali",
    to: "Musanze",
    price: 3500,
    duration: "2h 30m",
    status: "active",
  },
  {
    id: "2",
    from: "Kigali",
    to: "Huye",
    price: 2500,
    duration: "2h 15m",
    status: "coming_soon",
  },
  {
    id: "3",
    from: "Kigali",
    to: "Rubavu",
    price: 4000,
    duration: "3h 00m",
    status: "coming_soon",
  },
  {
    id: "4",
    from: "Kigali",
    to: "Nyanza",
    price: 1800,
    duration: "1h 45m",
    status: "coming_soon",
  },
  {
    id: "5",
    from: "Kigali",
    to: "Rwamagana",
    price: 1200,
    duration: "1h 00m",
    status: "coming_soon",
  },
  {
    id: "6",
    from: "Kigali",
    to: "Byumba",
    price: 2000,
    duration: "1h 30m",
    status: "coming_soon",
  },
];

export function generateTrips(from: string, to: string, date: string): Trip[] {
  return [];
}

export function getTripsForRoute(
  from: string,
  to: string,
  date: string,
): Trip[] {
  return [];
}

export function getTripById(tripId: string): Trip | undefined {
  return undefined;
}

export const sampleBookings: Booking[] = [];

export function formatPrice(price: number): string {
  return (price || 0).toLocaleString() + " RWF";
}

export function generateBookingId(): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900) + 100;
  return `BK-${date}-${rand}`;
}

export function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code +=
      Math.random() > 0.5
        ? chars[Math.floor(Math.random() * chars.length)]
        : nums[Math.floor(Math.random() * nums.length)];
  }
  return code;
}
