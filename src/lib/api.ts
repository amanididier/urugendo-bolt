import { createClient } from "@supabase/supabase-js";
import type { Trip, Booking } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Normalize phone numbers for MTN MoMo payments (Rwanda format handling)
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("250") && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    return "250" + cleaned.slice(1);
  }
  if (
    cleaned.length === 9 &&
    (cleaned.startsWith("7") || cleaned.startsWith("8"))
  ) {
    return "250" + cleaned;
  }
  return null;
}

// Fetch taken/occupied seats for a given trip ID from Supabase
export async function fetchTakenSeats(tripId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("seat_id, seat_label")
      .eq("trip_id", tripId)
      .neq("status", "rejected");

    if (error || !data) {
      console.warn(
        "Could not fetch taken seats for trip:",
        tripId,
        error?.message || error,
      );
      return new Set();
    }

    const seats = data
      .map((b) => b.seat_id || b.seat_label)
      .filter(Boolean) as string[];

    return new Set(seats);
  } catch (err) {
    console.error("Error fetching taken seats:", err);
    return new Set();
  }
}

// Fetch all public trips from Supabase DB
export async function fetchTrips(
  from?: string,
  to?: string,
  date?: string,
): Promise<Trip[]> {
  try {
    let query = supabase.from("trips").select(`
      *,
      operator:operators(*)
    `);

    if (from) query = query.ilike("route_from", `%${from}%`);
    if (to) query = query.ilike("route_to", `%${to}%`);
    if (date) query = query.eq("travel_date", date);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching trips from DB:", error.message || error);
      return [];
    }

    return (data || []).map((t) => {
      const op = t.operator;
      return {
        id: t.id,
        operator: {
          id: op?.id || t.operator_id || "virunga",
          name: op?.name || "Virunga Express",
          logo: op?.logo || "🚌",
          gradient: op?.gradient || "linear-gradient(135deg, #FF6B1A, #FF8800)",
          emoji: op?.emoji || op?.logo || "🚌",
          rating: 4.8,
          totalReviews: 120,
        },
        from: t.route_from || "Kigali",
        to: t.route_to || "Musanze",
        departureTime: t.departure_time || "08:00",
        arrivalTime: t.arrival_time || "10:00",
        duration: t.duration || "2h 00m",
        price: t.price || 2500,
        currency: t.currency || "RWF",
        availableSeats: t.available_seats ?? 36,
        totalSeats: t.total_seats ?? 36,
        busType: t.bus_type || "Coaster",
        amenities: t.amenities || ["WiFi", "AC"],
        date: t.travel_date || t.date || new Date().toISOString().split("T")[0],
        plateNumber: t.plate_number || "RAD100B",
        status: t.status || "scheduled",
      };
    });
  } catch (err) {
    console.error("Failed to query trips:", err);
    return [];
  }
}

// Fetch a single trip by ID from Supabase DB
export async function fetchTripById(id: string): Promise<Trip | null> {
  try {
    const { data, error } = await supabase
      .from("trips")
      .select(
        `
        *,
        operator:operators(*)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching trip by ID:", error?.message || error);
      return null;
    }

    const op = data.operator;
    return {
      id: data.id,
      operator: {
        id: op?.id || data.operator_id || "virunga",
        name: op?.name || "Virunga Express",
        logo: op?.logo || "🚌",
        gradient: op?.gradient || "linear-gradient(135deg, #FF6B1A, #FF8800)",
        emoji: op?.emoji || op?.logo || "🚌",
        rating: 4.8,
        totalReviews: 120,
      },
      from: data.route_from || "Kigali",
      to: data.route_to || "Musanze",
      departureTime: data.departure_time || "08:00",
      arrivalTime: data.arrival_time || "10:00",
      duration: data.duration || "2h 00m",
      price: data.price || 2500,
      currency: data.currency || "RWF",
      availableSeats: data.available_seats ?? 36,
      totalSeats: data.total_seats ?? 36,
      busType: data.bus_type || "Coaster",
      amenities: data.amenities || ["WiFi", "AC"],
      date:
        data.travel_date || data.date || new Date().toISOString().split("T")[0],
      plateNumber: data.plate_number || "RAD100B",
      status: data.status || "scheduled",
    };
  } catch (err) {
    console.error("Failed to fetch trip by ID:", err);
    return null;
  }
}

// Alias export for fetchTripById
export async function fetchTrip(id: string): Promise<Trip | null> {
  return fetchTripById(id);
}

// Fetch trips specifically by date (Used by Agency Dashboard)
export async function fetchTripsByDate(date?: string): Promise<Trip[]> {
  return fetchTrips(undefined, undefined, date);
}

// Create a new trip/departure in Supabase matching table constraints
export async function createTrip(
  tripData: Partial<Trip> & {
    origin?: string;
    destination?: string;
    travelDate?: string;
  },
): Promise<Trip | null> {
  try {
    let operatorId = tripData.operator?.id;

    if (!operatorId) {
      const { data: ops } = await supabase
        .from("operators")
        .select("id")
        .limit(1);
      if (ops && ops.length > 0) {
        operatorId = ops[0].id;
      }
    }

    const resolvedFrom = tripData.from || tripData.origin || "Kigali";
    const resolvedTo = tripData.to || tripData.destination || "Musanze";
    const resolvedDate =
      tripData.date ||
      tripData.travelDate ||
      new Date().toISOString().split("T")[0];
    const totalSeats = tripData.totalSeats || 36;

    const payload: Record<string, any> = {
      route_from: resolvedFrom,
      route_to: resolvedTo,
      travel_date: resolvedDate,
      price: tripData.price || 2500,
      currency: tripData.currency || "RWF",
      operator_id: operatorId || null,
      total_seats: totalSeats,
      available_seats: tripData.availableSeats ?? totalSeats,
      status: "scheduled",
    };

    if (tripData.departureTime) payload.departure_time = tripData.departureTime;
    if (tripData.arrivalTime) payload.arrival_time = tripData.arrivalTime;
    if (tripData.duration) payload.duration = tripData.duration;
    if (tripData.busType) payload.bus_type = tripData.busType;
    if (tripData.amenities) payload.amenities = tripData.amenities;
    if (tripData.plateNumber) payload.plate_number = tripData.plateNumber;

    const { data, error } = await supabase
      .from("trips")
      .insert([payload])
      .select(`*, operator:operators(*)`)
      .single();

    if (error || !data) {
      console.error("Error creating trip:", error?.message || error);
      return null;
    }

    const op = data.operator;
    return {
      id: data.id,
      operator: {
        id: op?.id || data.operator_id || "virunga",
        name: op?.name || "Virunga Express",
        logo: op?.logo || "🚌",
        gradient: op?.gradient || "linear-gradient(135deg, #FF6B1A, #FF8800)",
        emoji: op?.emoji || op?.logo || "🚌",
        rating: 4.8,
        totalReviews: 120,
      },
      from: data.route_from || resolvedFrom,
      to: data.route_to || resolvedTo,
      departureTime: data.departure_time || "08:00",
      arrivalTime: data.arrival_time || "10:00",
      duration: data.duration || "2h 00m",
      price: data.price,
      currency: data.currency || "RWF",
      availableSeats: data.available_seats ?? 36,
      totalSeats: data.total_seats ?? 36,
      busType: data.bus_type || "Coaster",
      amenities: data.amenities || ["WiFi"],
      date: data.travel_date || resolvedDate,
      plateNumber: data.plate_number || "",
      status: data.status || "scheduled",
    };
  } catch (err) {
    console.error("Unexpected error in createTrip:", err);
    return null;
  }
}

// Create a booking in Supabase DB from the payment flow
export async function createBooking(bookingData: {
  trip: Trip;
  seat: string;
  passengerName: string;
  passengerPhone: string;
  shortCode: string;
  paymentMethod: string;
  totalAmount: number;
  bookingFee?: number;
  status: string;
  bookingDate: string;
}): Promise<string | null> {
  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        bookingData.seat,
      );

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          trip_id: bookingData.trip.id,
          seat_id: isUuid ? bookingData.seat : null,
          seat_label: bookingData.seat,
          passenger_name: bookingData.passengerName,
          passenger_phone: bookingData.passengerPhone,
          booking_code: bookingData.shortCode,
          status:
            bookingData.status === "upcoming" ? "active" : bookingData.status,
          booking_date: bookingData.bookingDate,
        },
      ])
      .select("id")
      .single();

    if (error || !data) {
      console.error("Error creating booking in DB:", error?.message || error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error("Unexpected error in createBooking:", err);
    return null;
  }
}

// Decrement available seats count on a trip (Atomic RPC with manual fallback)
export async function decrementAvailableSeats(
  tripId: string,
): Promise<boolean> {
  try {
    const { error: rpcError } = await supabase.rpc(
      "decrement_available_seats",
      {
        p_trip_id: tripId,
      },
    );

    if (!rpcError) return true;

    console.warn(
      "RPC failed or non-existent, using fallback update:",
      rpcError.message,
    );
    const { data: trip, error: fetchError } = await supabase
      .from("trips")
      .select("available_seats")
      .eq("id", tripId)
      .single();

    if (fetchError || !trip) return false;

    const newSeats = Math.max(0, (trip.available_seats ?? 36) - 1);

    const { error: updateError } = await supabase
      .from("trips")
      .update({ available_seats: newSeats })
      .eq("id", tripId);

    if (updateError) {
      console.error("Error updating available seats:", updateError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error decrementing seats:", err);
    return false;
  }
}

// Fetch single booking by ID OR shortCode
export async function fetchBookingById(
  idOrCode: string,
): Promise<Booking | null> {
  try {
    let query = supabase.from("bookings").select(`
      *,
      trip:trips(
        *,
        operator:operators(*)
      )
    `);

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrCode,
      );

    if (isUuid) {
      query = query.eq("id", idOrCode);
    } else {
      query = query.eq("booking_code", idOrCode);
    }

    const { data, error } = await query.limit(1);

    if (error || !data || data.length === 0) {
      console.warn(
        "Booking not found in DB:",
        idOrCode,
        error?.message || error,
      );
      return null;
    }

    return formatBookingData(data[0]);
  } catch (err) {
    console.error("Error in fetchBookingById:", err);
    return null;
  }
}

// Fetch all bookings for agency dashboard / passenger view
export async function fetchAllBookings(): Promise<Booking[]> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        trip:trips(
          *,
          operator:operators(*)
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error)
        console.error("Error fetching all bookings:", error.message || error);
      return [];
    }

    return data.map(formatBookingData);
  } catch (err) {
    console.error("Error fetching all bookings:", err);
    return [];
  }
}

// Fetch bookings by specific User ID
export async function fetchBookingsByUser(userId: string): Promise<Booking[]> {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        trip:trips(
          *,
          operator:operators(*)
        )
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error)
        console.error("Error fetching user bookings:", error.message || error);
      return [];
    }

    return data.map(formatBookingData);
  } catch (err) {
    console.error("Error fetching user bookings:", err);
    return [];
  }
}

// Update passenger name for a booking in Supabase
export async function updatePassengerName(
  bookingId: string,
  passengerName: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({ passenger_name: passengerName })
      .eq("id", bookingId);

    if (error) {
      console.error("Error updating passenger name:", error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error updating passenger name:", err);
    return false;
  }
}

// Update booking status from agency panel
export async function updateBookingStatus(
  bookingId: string,
  status: Booking["status"],
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (error) {
      console.error("Error updating booking status:", error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error updating booking:", err);
    return false;
  }
}

// Update trip status from agency panel
export async function updateTripStatus(
  tripId: string,
  status: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("trips")
      .update({ status })
      .eq("id", tripId);

    if (error) {
      console.error("Error updating trip status:", error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error updating trip:", err);
    return false;
  }
}

// Helper formatter to map DB snakes to TS camels
function formatBookingData(b: any): Booking {
  return {
    id: b.id,
    shortCode: b.booking_code || b.short_code || b.id?.slice(0, 8),
    passengerName: b.passenger_name || "Passenger",
    passengerPhone: b.passenger_phone || "",
    momoAccountName: b.momo_account_name,
    momoPhoneNumber: b.momo_phone_number,
    paymentTime: b.payment_time || b.created_at,
    seat: b.seat_id || b.seat_label || "1A",
    paymentMethod: "MTN Mobile Money",
    totalAmount: b.trip?.price || 2500,
    status: b.status || "active",
    bookingDate:
      b.booking_date ||
      b.created_at?.split("T")[0] ||
      new Date().toISOString().split("T")[0],
    trip: {
      id: b.trip?.id || "trip-1",
      operator: {
        id: b.trip?.operator?.id || "virunga",
        name: b.trip?.operator?.name || "Virunga Express",
        logo: b.trip?.operator?.logo || "🚌",
        gradient:
          b.trip?.operator?.gradient ||
          "linear-gradient(135deg, #FF6B1A, #FF8800)",
        emoji: b.trip?.operator?.emoji || "🚌",
        rating: 4.8,
        totalReviews: 120,
      },
      from: b.trip?.route_from || "Kigali",
      to: b.trip?.route_to || "Musanze",
      departureTime: b.trip?.departure_time || "08:00",
      arrivalTime: b.trip?.arrival_time || "10:00",
      duration: b.trip?.duration || "2h 00m",
      price: b.trip?.price || 2500,
      currency: b.trip?.currency || "RWF",
      availableSeats: b.trip?.available_seats || 36,
      totalSeats: b.trip?.total_seats || 36,
      busType: b.trip?.bus_type || "Coaster",
      amenities: b.trip?.amenities || ["WiFi"],
      date: b.trip?.travel_date || new Date().toISOString().split("T")[0],
      plateNumber: b.trip?.plate_number || "",
      status: b.trip?.status || "scheduled",
    },
  };
}
