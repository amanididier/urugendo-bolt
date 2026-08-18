// ==========================================
// 1. Extended City & Route Types
// ==========================================
export interface City {
  code: string;
  name: string;
  terminal: string;
  flag: string;
  image: string;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  price: number;
  duration: string; // e.g. "02:30"
  status: "active" | "coming_soon";
}

// ==========================================
// 2. Operator & Branch Types
// ==========================================
export interface Operator {
  id: string;
  name: string;
  logo?: string;
  gradient?: string;
  emoji?: string;
  rating?: number;
  totalReviews?: number;
  contactPhone?: string;
  whatsappNumber?: string;
  momoCode?: string; // Agency MoMo pay code
  momoAccountName?: string;
  branches?: string[]; // ["Musanze", "Kigali", "Rubavu", "Nyagatare", "Gicumbi"]
}

export interface AgencyBranchObject {
  id: string;
  agency_id?: string;
  name: string;
  location?: string;
  created_at?: string;
}

export type AgencyBranch = string | AgencyBranchObject;

// ==========================================
// 3. Extended Trip / Departure Types
// ==========================================
export interface Trip {
  id: string;
  operator: Operator;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  currency: string;
  availableSeats: number;
  totalSeats: number;
  busType: "Coaster" | "Yutong" | string; // Coaster = 29 seats
  amenities: string[];
  date: string;
  plateNumber?: string;
  driverName?: string;
  departureStation?: string;
  destinationStation?: string;
  emptySeats?: number; // Manual entry by station agent
  status?:
    | "scheduled"
    | "boarding"
    | "departed"
    | "arrived"
    | "cancelled"
    | "delayed"
    | string;
}

// ==========================================
// 4. Booking & Payment Types
// ==========================================
export interface Booking {
  id: string;
  trip: Trip;
  seat: string;
  passengerName: string;
  passengerPhone: string;
  momoAccountName?: string;
  momoPhoneNumber?: string;
  paymentTime?: string;
  shortCode: string;
  paymentMethod: string;
  totalAmount: number;
  bookingFee?: number;
  status:
    | "pending"
    | "confirmed"
    | "rejected"
    | "cancelled"
    | "upcoming"
    | "past"
    | "boarded"
    | "used"
    | string;
  bookingDate: string;
  userId?: string;
  verifiedByAgentId?: string;
}

// ==========================================
// 5. User Profile & Notification Types
// ==========================================
export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role?: "passenger" | "agency" | "admin";
  branch?: string; // Station branch (e.g., Musanze, Kigali)
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "ticket_issued" | "trip_reminder" | "trip_missed" | "delay_alert";
}

export interface SearchFilters {
  from?: string;
  to?: string;
  date?: string;
  timeOfDay?: "morning" | "afternoon" | "evening" | "all";
  maxPrice?: number;
  operatorId?: string;
}
