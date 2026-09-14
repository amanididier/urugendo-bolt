import { supabase } from "./supabase";
import type { Trip, Booking, Route } from "./types";

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
// Optimized: explicit column list (no select(*)), limit + index-friendly filters
export async function fetchTrips(
  from?: string,
  to?: string,
  date?: string,
): Promise<Trip[]> {
  try {
    let query = supabase.from("trips").select(`
      id, route_from, route_to, departure_time, arrival_time, duration, travel_date, date,
      price, currency, total_seats, available_seats, bus_type, amenities, plate_number, status,
      origin_branch, origin_branch_id, branch_id,
      operator_id,
      operator:operators(id, name, emoji)
    `);

    if (from) query = query.ilike("route_from", `%${from}%`);
    if (to) query = query.ilike("route_to", `%${to}%`);
    if (date) query = query.eq("travel_date", date);

    const { data, error } = await query.order("travel_date", { ascending: true }).limit(200);

    if (error) {
      console.error("Error fetching trips from DB:", error.message || error);
      return [];
    }

    return (data || []).map((t: any) => {
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
        from: t.route_from || t.from || "Kigali",
        to: t.route_to || t.to || "Musanze",
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
        // keep FKs for isolation / realtime dedup
        origin_branch_id: t.origin_branch_id,
        branch_id: t.branch_id,
      } as any;
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
      from: data.route_from || data.from || "Kigali",
      to: data.route_to || data.to || "Musanze",
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

// Fetch popular routes — optimized: single routes query, no full bookings scan (kills heavy 400+ row fetch on every home load)
export async function fetchPopularRoutes(): Promise<Route[]> {
  try {
    const { data, error } = await supabase
      .from("routes")
      .select("id, from_city, to_city, base_price, duration_minutes")
      .order("base_price", { ascending: true })
      .limit(5);
    if (error || !data) {
      console.warn("[api] fetchPopularRoutes error:", error?.message);
      return [];
    }
    return data.map((r: any) => ({
      id: r.id, from: r.from_city, to: r.to_city, price: r.base_price || 2500,
      duration: r.duration_minutes ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}0m` : "2h 30m",
      status: "active" as const,
    })) as Route[];
  } catch (err) {
    console.error("fetchPopularRoutes failed:", err);
    return [];
  }
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
    let operatorId =
      typeof tripData.operator === "object" && tripData.operator !== null
        ? tripData.operator.id
        : undefined;

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

    // Branch isolation on insert: store origin_branch_id so only this branch sees the schedule
    let originBranchId: string | null = null;
    try {
      const em = typeof window !== "undefined" ? (localStorage.getItem("urugendo_agent_email") || localStorage.getItem("urugendo_user_email")) : null;
      if (em) {
        const { data: ar } = await supabase.from("agency_agents").select("branch_id").eq("email", em).maybeSingle();
        if ((ar as any)?.branch_id) originBranchId = (ar as any).branch_id;
      }
      if (!originBranchId && resolvedFrom) {
        const { data: br } = await supabase.from("branches").select("id").ilike("name", resolvedFrom).limit(1).maybeSingle();
        if ((br as any)?.id) originBranchId = (br as any).id;
      }
    } catch {}
    const payload: Record<string, any> = {
      route_from: resolvedFrom,
      route_to: resolvedTo,
      from: resolvedFrom,
      to: resolvedTo,
      travel_date: resolvedDate,
      price: tripData.price || 2500,
      currency: tripData.currency || "RWF",
      operator_id: operatorId || null,
      origin_branch: resolvedFrom,
      origin_branch_id: originBranchId,
      branch_id: originBranchId,
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
      from: data.route_from || data.from || resolvedFrom,
      to: data.route_to || data.to || resolvedTo,
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

// Create a booking in Supabase DB from the payment flow.
// Attaches auth.uid() as user_id — returns { id, error } so callers can
// distinguish "not signed in" from "db error".
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
  momoName?: string; // The MoMo account holder name
  momoNumber?: string; // The MoMo number used for payment
}): Promise<{ id: string | null; error?: string }> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return { id: null, error: "SIGN_IN_REQUIRED" };
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        bookingData.seat,
      );

    // Map our internal status names to what the DB allows.
    // 'pending' / 'payment_submitted' → stored as-is (DB allows these per Batch 4 migration).
    // 'upcoming' / 'active' → store as 'active' for backward compat.
    const resolvedStatus =
      bookingData.status === "upcoming" ? "active" : bookingData.status;

    // Branch isolation: tie booking to its origin branch so it appears
    // on the correct station agent's Verify tab (fixes "0 pending MoMo").
    // Look up branch_id from agency_agents → agency_agents.branch_id → branches.id
    let resolvedBranchId: string | null = null;
    try {
      const authEmail = (authData.user.email || "").trim().toLowerCase();
      const authPhone = (authData.user as any)?.phone || (authData.user.user_metadata as any)?.phone || null;
      let agentRow: any = null;
      const { fetchAgentByAuth } = await import("@/lib/agencyAgentService");
      agentRow = await fetchAgentByAuth({ email: authEmail, phone: authPhone });
      if ((agentRow as any)?.branch_id) resolvedBranchId = (agentRow as any).branch_id;
      if (!resolvedBranchId && authEmail) {
        const { data } = await supabase.from("agency_agents").select("branch_id").eq("email", authEmail).maybeSingle();
        if ((data as any)?.branch_id) resolvedBranchId = (data as any).branch_id;
      }
    } catch {}
    // Fallback: origin station from trip (most common: trips created at origin branch)
    if (!resolvedBranchId) {
      try {
        const originName = (bookingData.trip as any)?.from || (bookingData.trip as any)?.route_from;
        if (originName) {
          const { data: br } = await supabase.from("branches").select("id").ilike("name", originName).limit(1).maybeSingle();
          if ((br as any)?.id) resolvedBranchId = (br as any).id;
        }
      } catch {}
    }
    const originBranchText = (bookingData.trip as any)?.from || (bookingData.trip as any)?.route_from || null;

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          trip_id: bookingData.trip.id,
          // seat_id is uuid-only if seat looks like uuid; fallback to seat_label for string seats like "A1"
          seat_id: null,
          seat_label: bookingData.seat,
          passenger_name: bookingData.passengerName,
          passenger_phone: bookingData.passengerPhone,
          // Dual-write code/amount columns so both old and new schema reads work (prevents 400 on NOT NULL)
          booking_code: bookingData.shortCode,
          short_code: bookingData.shortCode,
          fare_amount: bookingData.totalAmount,
          total_amount: bookingData.totalAmount,
          booking_fee: bookingData.bookingFee ?? 0,
          payment_method: bookingData.paymentMethod || "MTN MoMo",
          user_id: authData.user.id,
          branch_id: resolvedBranchId,
          // legacy text branch name kept for manifest back-compat
          agency_branch: originBranchText,
          status: resolvedStatus,
          booking_date: bookingData.bookingDate,
          // Batch 4: store MoMo details so the agent's "Verify" tab shows
          // the name and number from the payment form.
          momo_name: bookingData.momoName || null,
          momo_number: bookingData.momoNumber || null,
          // Default: payment submitted (the user already sent the MoMo).
          // The agent will flip this to 'verified' or 'failed' after checking.
          payment_status: "submitted",
        },
      ])
      .select("id")
      .single();

    if (error || !data) {
      console.error("Error creating booking in DB:", error?.message || error);
      return { id: null, error: error?.message || "DB_ERROR" };
    }

    return { id: data.id };
  } catch (err) {
    console.error("Unexpected error in createBooking:", err);
    return { id: null, error: "UNEXPECTED_ERROR" };
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

// Fetch all bookings scoped to a specific branch.
// Optimized: explicit light payload (no select(*) on nested trips/operators)
// Falls back to agency_branch text match when branch_id is null on legacy rows.
export async function fetchBookingsByBranch(
  branchId: string,
): Promise<Booking[]> {
  try {
    let branchName: string | null = null;
    try {
      const { data: br } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
      if ((br as any)?.name) branchName = (br as any).name;
    } catch {}

    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        id, trip_id, branch_id, agency_branch, user_id, seat_label, passenger_name, passenger_phone,
        booking_code, short_code, booking_date, status, payment_status,
        fare_amount, total_amount, momo_name, momo_number, created_at,
        trip:trips(id, route_from, route_to, departure_time, arrival_time, travel_date, price, operator:operators(id, name))
      `,
      )
      .or(branchName ? `branch_id.eq.${branchId},agency_branch.ilike.${branchName}` : `branch_id.eq.${branchId}`)
      .order("created_at", { ascending: false })
      .limit(400);

    if (error || !data) {
      if (error)
        console.error("Error fetching branch bookings:", error.message || error);
      return [];
    }

    return data.map(formatBookingData);
  } catch (err) {
    console.error("Error fetching branch bookings:", err);
    return [];
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
    momoAccountName: b.momo_name || b.momo_account_name,
    momoPhoneNumber: b.momo_number || b.momo_phone_number,
    paymentTime: b.payment_time || b.created_at,
    seat: b.seat_id || b.seat_label || "1A",
    paymentMethod: "MTN Mobile Money",
    totalAmount: b.trip?.price || 2500,
    // Batch 4: expose status and payment_status for the verification workflow.
    // status: booking lifecycle (pending → confirmed → boarded / rejected).
    // payment_status: MoMo receipt state (submitted → verified / failed).
    status: b.status || "active",
    payment_status: b.payment_status || "unpaid",
    bookingDate:
      b.booking_date ||
      b.created_at?.split("T")[0] ||
      new Date().toISOString().split("T")[0],
    // Batch 3: expose the booking's branch FK so the ticket page can
    // look up branches.phone without re-deriving from city name.
    branchId: b.branch_id || null,
    userId: b.user_id || null,
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
      from: b.trip?.route_from || b.trip?.from || "Kigali",
      to: b.trip?.route_to || b.trip?.to || "Musanze",
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
