export interface City {
  code: string;
  name: string;
  terminal: string;
  flag: string;
  image: string;
}

export interface Operator {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  logo?: string;
}

export interface Bus {
  id: string;
  plateNumber: string;
  operatorId: string;
  totalSeats: number;
  amenities: string[];
}

export interface AgencySchedule {
  id: string;
  busId: string;
  operatorId: string;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  arrivalTime: string;
  date: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  status: 'scheduled' | 'boarding' | 'departed' | 'arrived' | 'cancelled';
  bookedCount: number;
  paperCount: number;
}

export interface Route {
  id: string;
  from: string;
  to: string;
  price: number;
  duration: string;
  status: 'active' | 'coming_soon';
}

export interface Trip {
  id: string;
  operator: Operator;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  amenities: string[];
  date: string;
  terminalFrom: string;
  terminalTo: string;
  busColor: string;
  plateNumber?: string;
  status?: string;
}

export interface Seat {
  id: string;
  row: number;
  col: string;
  status: 'available' | 'taken' | 'selected';
}

export interface Booking {
  id: string;
  trip: Trip;
  seat: string;
  passengerName: string;
  passengerPhone: string;
  shortCode: string;
  paymentMethod: string;
  totalAmount: number;
  bookingFee: number;
  status: 'upcoming' | 'boarded' | 'expired' | 'past' | 'cancelled';
  bookingDate: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'rugendo';
  timestamp: number;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'passenger' | 'agent' | 'driver' | 'admin';
  points: number;
  rating: number;
  totalTrips: number;
  createdAt: string;
}

export interface DriverTrip {
  id: string;
  tripId: string;
  driverId: string;
  departureTime: string;
  arrivalTime: string;
  status: 'assigned' | 'boarding' | 'departed' | 'arrived';
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: number;
  };
  passengers: {
    name: string;
    seat: string;
    code: string;
    status: 'booked' | 'boarded' | 'no_show';
  }[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'departure' | 'arrival' | 'promo' | 'system';
  read: boolean;
  createdAt: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface TrendingRoute {
  route: string;
  bookings: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MultiLegJourney {
  id: string;
  legs: {
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    operator: string;
    price: number;
  }[];
  totalPrice: number;
  totalDuration: string;
}

export interface GroupBooking {
  id: string;
  leaderId: string;
  passengers: {
    name: string;
    phone: string;
    seat?: string;
  }[];
  tripId: string;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface Location {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface BusTracking {
  tripId: string;
  locations: Location[];
  estimatedArrival: string;
  status: 'on_time' | 'delayed' | 'early';
}

export type Language = 'EN' | 'RW';
export type PaymentMethod = 'mtn' | 'airtel' | 'card';
export type SearchFilter = 'all' | 'earliest' | 'cheapest' | 'ac' | 'wifi';
