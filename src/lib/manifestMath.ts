/** Shared post-departure manifest / paper-ticket math. */

export function isVerifiedDigitalBooking(booking: {
  status?: string | null;
  payment_status?: string | null;
  paymentStatus?: string | null;
}): boolean {
  const status = (booking.status || "").toLowerCase();
  if (status === "cancelled" || status === "rejected") return false;
  const payment =
    booking.payment_status || booking.paymentStatus || "";
  return (
    status === "confirmed" ||
    status === "boarded" ||
    payment === "verified"
  );
}

export function bookingTripId(booking: {
  trip_id?: string | null;
  trip?: { id?: string } | string | null;
}): string | undefined {
  if (typeof booking.trip === "object" && booking.trip?.id) {
    return booking.trip.id;
  }
  if (typeof booking.trip === "string" && booking.trip) return booking.trip;
  return booking.trip_id || undefined;
}

/** Parse trip travel_date + departure_time as Africa/Kigali (UTC+2, no DST). */
export function parseTripDeparture(
  travelDate?: string | null,
  departureTime?: string | null,
): Date | null {
  const date = (travelDate || "").toString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  let hours = 0;
  let minutes = 0;
  const raw = (departureTime || "00:00").toString().trim();
  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    hours = parseInt(ampm[1], 10);
    minutes = parseInt(ampm[2], 10);
    const mer = ampm[3].toUpperCase();
    if (mer === "PM" && hours < 12) hours += 12;
    if (mer === "AM" && hours === 12) hours = 0;
  } else {
    const hm = raw.match(/(\d{1,2}):(\d{2})/);
    if (hm) {
      hours = parseInt(hm[1], 10);
      minutes = parseInt(hm[2], 10);
    }
  }

  const iso = `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+02:00`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function hasTripDeparted(
  travelDate?: string | null,
  departureTime?: string | null,
  now: Date = new Date(),
): boolean {
  const dt = parseTripDeparture(travelDate, departureTime);
  return !!dt && now.getTime() >= dt.getTime();
}

/**
 * Paper passengers for one trip.
 * P_actual = C_total - C_empty
 * P_paper  = max(0, P_actual - U_digital)
 * Upcoming trips (departure not yet passed) always return 0.
 */
export function computePaperPassengers(
  totalSeats: number,
  emptySeats: number,
  digitalCount: number,
  departed: boolean,
): number {
  if (!departed) return 0;
  const actual = Math.max(0, (Number(totalSeats) || 0) - (Number(emptySeats) || 0));
  return Math.max(0, actual - (Number(digitalCount) || 0));
}

export function computePaperRevenue(
  paperPassengers: number,
  ticketPrice: number,
): number {
  return paperPassengers * (Number(ticketPrice) || 0);
}
