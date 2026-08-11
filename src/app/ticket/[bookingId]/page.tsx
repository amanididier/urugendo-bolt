"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useApp } from '@/context/app-context';
import { formatPrice } from '@/lib/data';
import { fetchBookingById } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import type { Booking } from '@/lib/types';
import { 
  MapPin, Clock, Bus, Download, Share, Home, Navigation, 
  Phone, Shield, CheckCircle, AlertCircle, ArrowRight, 
  Calendar
} from 'lucide-react';

function LiveTimer() {
  const [time, setTime] = useState('');
  
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center gap-1 bg-black/10 px-2 py-1 rounded-lg">
      <motion.div 
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="w-2 h-2 rounded-full bg-red-500"
      />
      <span className="text-[11px] font-mono text-text-muted">{time}</span>
    </div>
  );
}

function SpinningLogo() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      className="text-xl"
    >
      ✦
    </motion.div>
  );
}

const midwayPoints = [
  { name: 'Nyabugogo', type: 'departure', description: 'Main bus terminal in Kigali' },
  { name: 'Shyorongi', type: 'stop', description: 'Town along the route' },
  { name: 'Nyirangarama', type: 'stop', description: 'Pickup point before Musanze' },
  { name: 'Musanze', type: 'arrival', description: 'Central terminal in Musanze' },
];

const routeDescription = {
  'Kigali-Musanze': 'A scenic 2.5 hour journey through Rwanda\'s beautiful landscape. The route passes through terraced hills and local villages. The bus makes brief stops at Shyorongi and Nyirangarama for passengers.',
  'Kigali-Huye': 'A 2h 15m journey south through Rwanda\'s academic corridor. Passengers can enjoy views of the University of Rwanda campus.',
  'Kigali-Rubavu': 'A scenic 3-hour journey to Lake Kivu. The route offers breathtaking views of the lake and nearby mountains.',
};

export default function TicketConfirmPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const router = useRouter();
  const { bookings } = useApp();
  const [showMap, setShowMap] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  const [nearestStop, setNearestStop] = useState('');
  const [dbBooking, setDbBooking] = useState<Booking | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);

  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    params.then(p => setBookingId(p.bookingId)).catch(() => {});
  }, [params]);

  useEffect(() => {
    if (!bookingId) return;
    fetchBookingById(bookingId).then(b => {
      setDbBooking(b);
      setDbLoading(false);
    });
  }, [bookingId]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setNearestStop('Nyirangarama (2km away)');
        },
        (error) => {
          setLocationError('Location access denied. Enable GPS for live tracking.');
        }
      );
    } else {
      setLocationError('Geolocation not supported');
    }
  }, []);

  const localBooking = bookings.find(b => b.id === bookingId);
  const booking = dbBooking || localBooking || null;

  if (dbLoading && !localBooking) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20">
        <div className="text-[14px] text-text-muted">Loading ticket...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white px-6 pb-20">
        <div className="text-4xl mb-4">🎫</div>
        <h2 className="text-[20px] font-bold text-text-primary mb-2">Booking not found</h2>
        <button onClick={() => router.push('/')} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-[14px]">
          Back to Home
        </button>
      </div>
    );
  }

  const isBoarded = booking.status === 'boarded';
  const isCompleted = booking.status === 'past';
  const busColor = booking.trip.busColor || '#FF6B1A';
  const routeKey = `${booking.trip.from}-${booking.trip.to}`;
  const description = routeDescription[routeKey as keyof typeof routeDescription] || 'Your journey through Rwanda\'s beautiful landscape.';

  const getTicketState = () => {
    if (isCompleted) return 'completed';
    if (isBoarded) return 'boarded';
    return 'active';
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      const state = getTicketState();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with agency branding
      doc.setFillColor(0, 184, 92);
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // Agency logo (emoji placeholder)
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text(booking.trip.operator.emoji || '🚌', 20, 25);
      
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Urugendo.', 40, 22);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(booking.id, pageWidth - 20, 22, { align: 'right' });
      
      // Passenger name at top
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`Passenger: ${booking.passengerName}`, 40, 35);
      doc.text(`Phone: ${booking.passengerPhone}`, pageWidth - 20, 35, { align: 'right' });
      
      // Trip details - big and clear
      doc.setTextColor(9, 9, 11);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(`${booking.trip.from.toUpperCase()} → ${booking.trip.to.toUpperCase()}`, 20, 70);
      
      // Trip info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(63, 63, 70);
      doc.text(`${booking.trip.date} • ${booking.trip.departureTime} → ${booking.trip.arrivalTime}`, 20, 82);
      doc.text(`${booking.trip.duration} • ${booking.trip.operator.name}`, 20, 92);
      doc.text(`Seat: ${booking.seat} • Plate: ${booking.trip.plateNumber || 'N/A'}`, 20, 102);
      
      // Booking code - big
      doc.setFontSize(40);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 184, 92);
      doc.text(booking.shortCode || 'XXXXXX', 20, 135);
      
      doc.setFontSize(10);
      doc.setTextColor(63, 63, 70);
      doc.setFont('helvetica', 'normal');
      doc.text('Booking Code', 20, 148);
      
      // Terminal info
      doc.text(`Terminal: ${booking.trip.terminalFrom}`, 20, 165);
      
      // Footer with operator
      doc.setFillColor(0, 184, 92);
      doc.rect(0, 180, pageWidth, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(booking.trip.operator.name, 20, 198);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(booking.totalAmount.toLocaleString() + ' RWF • ' + booking.paymentMethod, pageWidth - 20, 198, { align: 'right' });
      
      if (state === 'boarded') {
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 0, pageWidth, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('✓ VERIFIED - BOARDED', pageWidth / 2, 14, { align: 'center' });
      } else if (state === 'completed') {
        doc.setFillColor(161, 161, 170);
        doc.rect(0, 0, pageWidth, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('TRIP COMPLETED', pageWidth / 2, 14, { align: 'center' });
      }
      
      doc.save(`Urugendo-Ticket-${booking.shortCode}.pdf`);
    } catch (error) {
      alert('Error generating PDF. Please try again.');
    }
  };

  const shareTicket = async () => {
    const text = `🎫 Urugendo Ticket\n\n${booking.trip.from} → ${booking.trip.to}\nDate: ${booking.trip.date}\nTime: ${booking.trip.departureTime}\nSeat: ${booking.seat}\nCode: ${booking.shortCode}\n\nBook at Urugendo.rw`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('Ticket copied to clipboard!');
    }
  };

  const getStateColor = () => {
    if (isCompleted) return '#9CA3AF';
    if (isBoarded) return '#F59E0B';
    return busColor;
  };

  return (
    <div className="bg-surface-secondary pb-[88px]">
      {/* Header Banner */}
      <div 
        className="pt-[60px] px-5 pb-6 text-center"
        style={{ background: isCompleted ? '#9CA3AF' : isBoarded ? '#F59E0B' : '#00B85C' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="text-5xl mb-3"
        >
          {isCompleted ? '🏁' : isBoarded ? '✓' : '✅'}
        </motion.div>
        <h1 className="text-[24px] font-extrabold text-white mb-1">
          {isCompleted ? 'TRIP COMPLETED' : isBoarded ? 'BOARDED' : 'BOOKING CONFIRMED'}
        </h1>
        <p className="text-[13px] text-white/70">
          {isCompleted ? 'Hope you had a great journey!' : isBoarded ? 'Show this ticket to board' : 'Your e-ticket is ready'}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-lg"
            >
              <Download size={14} className="text-primary" />
              <span className="text-[12px] font-semibold text-primary">Download</span>
            </button>
            <button 
              onClick={shareTicket}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-secondary rounded-lg"
            >
              <Share size={14} className="text-text-muted" />
              <span className="text-[12px] font-semibold text-text-muted">Share</span>
            </button>
          </div>
          {isBoarded && (
            <button 
              onClick={() => setShowMap(!showMap)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200"
            >
              <Navigation size={14} className="text-blue-600" />
              <span className="text-[12px] font-semibold text-blue-600">Live Map</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Map (when active) */}
      {showMap && isBoarded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-4 mt-3"
        >
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-100">
              <span className="text-[12px] font-bold text-blue-800">Live Bus Location</span>
              <span className="text-[10px] text-blue-600">Updated just now</span>
            </div>
            <div ref={mapRef} className="h-48 bg-surface-secondary flex items-center justify-center relative">
              {/* Simulated map */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-green-100" />
              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <div className="text-[10px] text-green-700 font-medium">Your bus is near Nyirangarama</div>
                </div>
              </div>
            </div>
            {currentLocation && (
              <div className="px-4 py-2 border-t border-border text-[10px] text-text-muted">
                📍 Your location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Ticket Card */}
      <div className="px-4 mt-3">
        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          {/* Header with logo */}
          <div className="px-4 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                {booking.trip.operator.logo || booking.trip.operator.emoji}
              </div>
              <div>
                <span className="text-[16px] font-extrabold text-text-primary">{booking.trip.operator.name}</span>
                <div className="text-[11px] text-text-muted flex items-center gap-1">
                  <Bus size={10} />
                  {booking.trip.plateNumber || 'RAD 101A'}
                </div>
              </div>
            </div>
            <SpinningLogo />
          </div>

          {/* Route Display */}
          <div className="px-4 py-5 bg-surface-secondary">
            <div className="flex items-center justify-between mb-2">
              <div className="text-center flex-1">
                <div className="text-[22px] font-extrabold text-text-primary">{booking.trip.from.substring(0, 3).toUpperCase()}</div>
                <div className="text-[10px] text-text-muted">{booking.trip.terminalFrom}</div>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex flex-col items-center">
                  <ArrowRight size={24} className="text-primary" />
                  <div className="text-[10px] text-text-muted mt-1">{booking.trip.duration}</div>
                </div>
              </div>
              <div className="text-center flex-1">
                <div className="text-[22px] font-extrabold text-text-primary">{booking.trip.to.substring(0, 3).toUpperCase()}</div>
                <div className="text-[10px] text-text-muted">{booking.trip.terminalTo}</div>
              </div>
            </div>

            {/* Ticket Code */}
            <div className="text-center mt-4">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Your Code</div>
              <div 
                className="text-[42px] font-extrabold tracking-wider"
                style={{ color: getStateColor() }}
              >
                {booking.shortCode || 'XXXXXX'}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <LiveTimer />
              </div>
            </div>
          </div>

          {/* Trip Details */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock size={14} className="text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Departure</div>
                  <div className="text-[13px] font-bold text-text-primary">{booking.trip.departureTime}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock size={14} className="text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Arrival</div>
                  <div className="text-[13px] font-bold text-text-primary">{booking.trip.arrivalTime}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin size={14} className="text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Seat</div>
                  <div className="text-[13px] font-bold text-text-primary">{booking.seat}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar size={14} className="text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-text-muted">Date</div>
                  <div className="text-[13px] font-bold text-text-primary">{booking.trip.date}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Trip Description */}
          <div className="px-4 pb-4">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-blue-600" />
                <span className="text-[12px] font-bold text-blue-800">About This Trip</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Midway Stops (for active trips) */}
          {!isCompleted && (
            <div className="px-4 pb-4">
              <div className="rounded-xl p-3 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Navigation size={14} className="text-primary" />
                  <span className="text-[12px] font-bold text-text-primary">Route Stops</span>
                </div>
                <div className="space-y-2">
                  {midwayPoints.map((point, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        point.type === 'departure' ? 'bg-primary' : 
                        point.type === 'arrival' ? 'bg-amber-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-text-primary">{point.name}</div>
                        <div className="text-[9px] text-text-muted">{point.description}</div>
                      </div>
                      {point.type === 'departure' && (
                        <span className="text-[9px] text-primary font-medium">Departure</span>
                      )}
                      {point.type === 'arrival' && (
                        <span className="text-[9px] text-amber-600 font-medium">Arrival</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="px-4 py-3 bg-surface-secondary border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-green-600" />
              <span className="text-[11px] text-text-muted">{booking.paymentMethod} • Paid</span>
            </div>
            <span className="text-[16px] font-bold text-text-primary">{formatPrice(booking.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Location Info (if available) */}
      {currentLocation && !isCompleted && (
        <div className="px-4 mt-3">
          <div className="bg-green-50 rounded-xl p-3 border border-green-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Navigation size={18} className="text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold text-green-800">Your Location Detected</div>
              <div className="text-[10px] text-green-700">
                {nearestStop || 'Getting your position...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Error */}
      {locationError && !isCompleted && (
        <div className="px-4 mt-3">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-600" />
            <div className="flex-1">
              <div className="text-[11px] text-amber-800">{locationError}</div>
            </div>
            <button 
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(() => {}, (e) => setLocationError(e.message));
              }}
              className="text-[10px] text-amber-700 font-medium underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 mt-4 space-y-2.5">
        <button 
          onClick={downloadPDF}
          className="w-full h-12 rounded-full bg-primary text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <Download size={18} />
          Download Ticket (PDF)
        </button>
        <button 
          onClick={shareTicket}
          className="w-full h-12 rounded-full bg-white border border-border text-text-primary font-bold text-[15px] flex items-center justify-center gap-2 active:bg-gray-50 transition-colors"
        >
          <Share size={18} />
          Share Ticket
        </button>
        <button
          onClick={() => router.push('/home')}
          className="w-full h-12 rounded-full bg-white border border-border text-text-primary font-bold text-[15px] flex items-center justify-center gap-2 active:bg-gray-50 transition-colors"
        >
          <Home size={18} />
          Back to Home
        </button>
      </div>

      {/* Help Text */}
      <div className="px-4 mt-4 pb-4 text-center">
        <p className="text-[10px] text-text-muted">
          Need help? Contact {booking.trip.operator.name} at +250 788 XXX XXX
        </p>
      </div>
    </div>
  );
}
