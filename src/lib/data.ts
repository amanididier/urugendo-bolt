import { City, Operator, Route, Trip, Booking } from './types';

export const cities: City[] = [
  { code: 'KGL', name: 'Kigali', terminal: 'Nyabugogo Terminal', flag: '🇷🇼', image: 'https://images.unsplash.com/photo-1590073242678-70ee3fc28e8e?w=400&q=80' },
  { code: 'MSZ', name: 'Musanze', terminal: 'Musanze Central Terminal', flag: '🌿', image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80' },
  { code: 'HYE', name: 'Huye', terminal: 'Huye Bus Terminal', flag: '📚', image: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=400&q=80' },
  { code: 'RBV', name: 'Rubavu', terminal: 'Rubavu Terminal', flag: '🏖️', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
  { code: 'NYZ', name: 'Nyanza', terminal: 'Nyanza Terminal', flag: '👑', image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80' },
  { code: 'RWM', name: 'Rwamagana', terminal: 'Rwamagana Terminal', flag: '🌄', image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
  { code: 'BYM', name: 'Byumba', terminal: 'Byumba Terminal', flag: '⛰️', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80' },
  { code: 'CYG', name: 'Cyangugu', terminal: 'Rusizi Terminal', flag: '🌊', image: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&q=80' },
];

export const BUS_COLORS = [
  '#FF6B1A', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
  '#06B6D4', '#EC4899', '#84CC16', '#F97316'
];

export const operators: Operator[] = [
  { id: 'volcano', name: 'Volcano Express', emoji: '🌋', gradient: 'linear-gradient(135deg, #FF5C1A, #FF3D00)', logo: '🌋' },
  { id: 'ritco', name: 'RITCO', emoji: '🚌', gradient: 'linear-gradient(135deg, #00B85C, #007A3D)', logo: '🚌' },
  { id: 'trinity', name: 'Trinity Express', emoji: '🚐', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', logo: '🚐' },
  { id: 'virunga', name: 'Virunga Express', emoji: '🏔️', gradient: 'linear-gradient(135deg, #A855F7, #7C3AED)', logo: '🏔️' },
];

export const popularRoutes: Route[] = [
  { id: '1', from: 'Kigali', to: 'Musanze', price: 3500, duration: '2h 30m', status: 'active' },
  { id: '2', from: 'Kigali', to: 'Huye', price: 2500, duration: '2h 15m', status: 'coming_soon' },
  { id: '3', from: 'Kigali', to: 'Rubavu', price: 4000, duration: '3h 00m', status: 'coming_soon' },
  { id: '4', from: 'Kigali', to: 'Nyanza', price: 1800, duration: '1h 45m', status: 'coming_soon' },
  { id: '5', from: 'Kigali', to: 'Rwamagana', price: 1200, duration: '1h 00m', status: 'coming_soon' },
  { id: '6', from: 'Kigali', to: 'Byumba', price: 2000, duration: '1h 30m', status: 'coming_soon' },
];

function generateSeats(): Record<string, 'available' | 'taken'> {
  const seats: Record<string, 'available' | 'taken'> = {};
  for (let row = 1; row <= 9; row++) {
    for (const col of ['A', 'B', 'C', 'D']) {
      seats[`${row}${col}`] = Math.random() > 0.3 ? 'available' : 'taken';
    }
  }
  return seats;
}

export function generateTrips(from: string, to: string, date: string): Trip[] {
  const tripDefs = [
    { operator: operators[0], dep: '06:00', arr: '08:30', duration: '2h 30m', price: 3500, amenities: ['📶', '❄️', '🧳'] },
    { operator: operators[1], dep: '07:30', arr: '10:00', duration: '2h 30m', price: 3200, amenities: ['📶', '🕯️'] },
    { operator: operators[2], dep: '09:00', arr: '11:30', duration: '2h 30m', price: 3800, amenities: ['📶', '❄️', '🕯️', '🧳'] },
    { operator: operators[3], dep: '11:00', arr: '13:30', duration: '2h 30m', price: 3500, amenities: ['📶', '❄️'] },
  ];

  const fromCity = cities.find(c => c.name === from) || cities[0];
  const toCity = cities.find(c => c.name === to) || cities[1];

  return tripDefs.map((def, i) => ({
    id: `trip-${fromCity.code}-${toCity.code}-${i}`,
    operator: def.operator,
    from: fromCity.name,
    to: toCity.name,
    departureTime: def.dep,
    arrivalTime: def.arr,
    duration: def.duration,
    price: def.price,
    totalSeats: 36,
    availableSeats: ((fromCity.code.charCodeAt(0) + toCity.code.charCodeAt(0) + i * 7) % 20) + 5,
    amenities: def.amenities,
    date,
    terminalFrom: fromCity.terminal,
    terminalTo: toCity.terminal,
    busColor: BUS_COLORS[i % BUS_COLORS.length],
    plateNumber: `RAD ${100 + i}${String.fromCharCode(65 + i)}`,
  }));
}

export function getTripsForRoute(from: string, to: string, date: string): Trip[] {
  return generateTrips(from, to, date);
}

export function getTripById(tripId: string): Trip | undefined {
  const trips = generateTrips('Kigali', 'Musanze', new Date().toISOString().split('T')[0]);
  return trips.find(t => t.id === tripId) || trips[0];
}

export const sampleBookings: Booking[] = [
  {
    id: 'BK-20260327-001',
    trip: {
      id: 'trip-KGL-MSZ-0',
      operator: operators[0],
      from: 'Kigali',
      to: 'Musanze',
      departureTime: '06:00',
      arrivalTime: '08:30',
      duration: '2h 30m',
      price: 3500,
      totalSeats: 36,
      availableSeats: 18,
      amenities: ['📶', '❄️', '🧳'],
      date: '2026-03-28',
      terminalFrom: 'Nyabugogo Terminal',
      terminalTo: 'Musanze Central Terminal',
      busColor: '#FF6B1A',
      plateNumber: 'RAD 101A',
    },
    seat: '3B',
    passengerName: 'Jean-Paul K.',
    passengerPhone: '+250 789 123 456',
    shortCode: 'KL28',
    paymentMethod: 'MTN MoMo',
    totalAmount: 3700,
    bookingFee: 200,
    status: 'upcoming',
    bookingDate: '2026-03-27',
  },
  {
    id: 'BK-20260320-002',
    trip: {
      id: 'trip-KGL-HYE-1',
      operator: operators[1],
      from: 'Kigali',
      to: 'Huye',
      departureTime: '08:00',
      arrivalTime: '10:15',
      duration: '2h 15m',
      price: 2500,
      totalSeats: 36,
      availableSeats: 12,
      amenities: ['📶'],
      date: '2026-03-20',
      terminalFrom: 'Nyabugogo Terminal',
      terminalTo: 'Huye Bus Terminal',
      busColor: '#3B82F6',
      plateNumber: 'RAD 102B',
    },
    seat: '5A',
    passengerName: 'Jean-Paul K.',
    passengerPhone: '+250 789 123 456',
    shortCode: 'MP47',
    paymentMethod: 'Airtel Money',
    totalAmount: 2700,
    bookingFee: 200,
    status: 'past',
    bookingDate: '2026-03-19',
  },
];

export function formatPrice(price: number): string {
  return price.toLocaleString() + ' RWF';
}

export function generateBookingId(): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.floor(Math.random() * 900) + 100;
  return `BK-${date}-${rand}`;
}

export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.random() > 0.5 
      ? chars[Math.floor(Math.random() * chars.length)]
      : nums[Math.floor(Math.random() * nums.length)];
  }
  return code;
}
