import { supabase } from './supabase';
import type { Trip, Operator, Booking } from './types';
import { cities, operators as fallbackOperators, formatPrice as fmt } from './data';

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 30000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/\s/g, '').replace(/^\+/, '');
  if (p.match(/^07\d{8}$/)) return '25' + p;
  if (p.match(/^2507\d{8}$/)) return p;
  if (p.match(/^25\d{10}$/)) return p;
  return null;
}

export interface TripRow {
  id: string;
  operator_id: string;
  bus_id: string | null;
  driver_id: string | null;
  route_from: string;
  route_to: string;
  terminal_from: string;
  terminal_to: string;
  departure_time: string;
  arrival_time: string;
  duration: string;
  travel_date: string;
  price: number;
  total_seats: number;
  available_seats: number;
  status: string;
  operators: Operator | null;
  buses: { plate_number: string } | null;
}

export interface BookingRow {
  id: string;
  trip_id: string;
  user_id: string;
  seat_label: string;
  passenger_name: string;
  passenger_phone: string;
  short_code: string;
  payment_method: string;
  total_amount: number;
  booking_fee: number;
  status: string;
  booking_date: string;
  created_at: string;
  trips: TripRow | null;
}

export async function fetchOperators(): Promise<Operator[]> {
  const { data, error } = await supabase.from('operators').select('*');
  if (error || !data || data.length === 0) return fallbackOperators;
  return data.map((o) => ({
    id: o.id,
    name: o.name,
    emoji: o.emoji,
    gradient: o.gradient,
  }));
}

export async function fetchTrips(
  from: string,
  to: string,
  date: string
): Promise<Trip[]> {
  const cacheKey = `trips:${from}:${to}:${date}`;
  const cached = getCached<Trip[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('trips')
    .select('*, operators(*), buses(*)')
    .eq('route_from', from)
    .eq('route_to', to)
    .eq('travel_date', date)
    .neq('status', 'cancelled')
    .order('departure_time', { ascending: true });

  if (error || !data || data.length === 0) return [];
  const trips = (data as TripRow[]).map(rowToTrip);
  setCached(cacheKey, trips);
  return trips;
}

export async function fetchTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, operators(*), buses(*)')
    .eq('id', tripId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToTrip(data as TripRow);
}

export async function fetchBookingsByUser(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, trips(*, operators(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as BookingRow[]).map(rowToBooking);
}

export async function fetchAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, trips(*, operators(*))')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as BookingRow[]).map(rowToBooking);
}

export async function fetchBookingById(bookingId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, trips(*, operators(*))')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToBooking(data as BookingRow);
}

export async function fetchTripsByDate(date: string): Promise<Trip[]> {
  const cacheKey = `tripsByDate:${date}`;
  const cached = getCached<Trip[]>(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('trips')
    .select('*, operators(*), buses(*)')
    .eq('travel_date', date)
    .neq('status', 'cancelled')
    .order('departure_time', { ascending: true });
  if (error || !data) return [];
  const trips = (data as TripRow[]).map(rowToTrip);
  setCached(cacheKey, trips);
  return trips;
}

export async function fetchTakenSeats(tripId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('bookings')
    .select('seat_label')
    .eq('trip_id', tripId)
    .neq('status', 'cancelled');
  if (error || !data) return new Set();
  return new Set(data.map((row: { seat_label: string }) => row.seat_label));
}

export async function fetchBookingsByTrip(tripId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, trips(*, operators(*))')
    .eq('trip_id', tripId)
    .order('seat_label', { ascending: true });
  if (error || !data) return [];
  return (data as BookingRow[]).map(rowToBooking);
}

export async function createBooking(
  booking: Omit<Booking, 'id'>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      trip_id: booking.trip.id,
      seat_label: booking.seat,
      passenger_name: booking.passengerName,
      passenger_phone: booking.passengerPhone,
      short_code: booking.shortCode,
      payment_method: booking.paymentMethod,
      total_amount: booking.totalAmount,
      booking_fee: booking.bookingFee,
      status: booking.status,
      booking_date: booking.bookingDate,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function updateBookingStatus(
  bookingId: string,
  status: Booking['status']
): Promise<boolean> {
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId);
  return !error;
}

export async function createTrip(trip: {
  operatorId: string;
  routeFrom: string;
  routeTo: string;
  departureTime: string;
  arrivalTime: string;
  travelDate: string;
  price: number;
  totalSeats: number;
  terminalFrom?: string;
  terminalTo?: string;
  plateNumber?: string;
}): Promise<string | null> {
  const operatorName = trip.operatorId || 'Virunga Express';

  // Resolve operator UUID by name; create default if missing
  let { data: op } = await supabase
    .from('operators')
    .select('id')
    .eq('name', operatorName)
    .maybeSingle();
  let operatorId = op?.id as string | undefined;
  if (!operatorId) {
    const { data: newOp, error: opErr } = await supabase
      .from('operators')
      .insert({ name: operatorName, emoji: '🚌', gradient: 'linear-gradient(135deg, #00B85C, #007A3D)' })
      .select('id')
      .single();
    if (opErr) console.error('[createTrip] operator insert failed:', opErr);
    operatorId = newOp?.id;
  }
  if (!operatorId) {
    console.error('[createTrip] could not resolve or create operator');
    return null;
  }

  // Resolve or create bus by plate number
  let busId: string | undefined;
  if (trip.plateNumber) {
    const { data: bus } = await supabase
      .from('buses')
      .select('id')
      .eq('plate_number', trip.plateNumber)
      .maybeSingle();
    busId = bus?.id as string | undefined;
    if (!busId) {
      const { data: newBus, error: busErr } = await supabase
        .from('buses')
        .insert({ operator_id: operatorId, plate_number: trip.plateNumber, total_seats: trip.totalSeats })
        .select('id')
        .single();
      if (busErr) console.error('[createTrip] bus insert failed:', busErr);
      busId = newBus?.id;
    }
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      operator_id: operatorId,
      bus_id: busId ?? null,
      route_from: trip.routeFrom,
      route_to: trip.routeTo,
      departure_time: trip.departureTime,
      arrival_time: trip.arrivalTime,
      travel_date: trip.travelDate,
      price: trip.price,
      total_seats: trip.totalSeats,
      available_seats: trip.totalSeats,
      status: 'scheduled',
      terminal_from: trip.terminalFrom || 'Main Terminal',
      terminal_to: trip.terminalTo || 'Main Terminal',
      duration: '2h 30m',
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createTrip] insert failed:', error);
    return null;
  }
  return data.id;
}

export async function updateTripStatus(tripId: string, status: string): Promise<boolean> {
  const { error } = await supabase
    .from('trips')
    .update({ status })
    .eq('id', tripId);
  return !error;
}

export async function decrementAvailableSeats(tripId: string): Promise<void> {
  const { data } = await supabase
    .from('trips')
    .select('available_seats')
    .eq('id', tripId)
    .maybeSingle();
  if (data && data.available_seats > 0) {
    await supabase
      .from('trips')
      .update({ available_seats: data.available_seats - 1 })
      .eq('id', tripId);
  }
}

export { cities, fmt as formatPrice };

function rowToTrip(row: TripRow): Trip {
  const op = row.operators || fallbackOperators[0];
  return {
    id: row.id,
    operator: op,
    from: row.route_from,
    to: row.route_to,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    duration: row.duration,
    price: row.price,
    totalSeats: row.total_seats,
    availableSeats: row.available_seats,
    amenities: [],
    date: row.travel_date,
    terminalFrom: row.terminal_from,
    terminalTo: row.terminal_to,
    busColor: op.gradient,
    plateNumber: row.buses?.plate_number,
    status: row.status,
  };
}

function rowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    trip: row.trips ? rowToTrip(row.trips) : ({} as Trip),
    seat: row.seat_label,
    passengerName: row.passenger_name,
    passengerPhone: row.passenger_phone,
    shortCode: row.short_code,
    paymentMethod: row.payment_method,
    totalAmount: row.total_amount,
    bookingFee: row.booking_fee,
    status: row.status as Booking['status'],
    bookingDate: row.booking_date,
  };
}
