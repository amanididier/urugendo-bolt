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
      price, currency, total_seats, available_seats, empty_seats, bus_type, amenities, plate_number, status,
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
          id: op?.id || t.operator_id || "unknown",
          name: op?.name || "Bus Operator",
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
        emptySeats: t.empty_seats ?? 0,
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
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("Error fetching trip by ID:", error?.message || error);
      return null;
    }

    const op = data.operator;
    return {
      id: data.id,
      operator: {
        id: op?.id || data.operator_id || "unknown",
        name: op?.name || "Bus Operator",
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
      emptySeats: data.empty_seats ?? 0,
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

// Fetch trips specifically by date, scoped to a branch FK when provided.
// When branchId is set, the query is branch-isolated at the DB level (no text fallback).
export async function fetchTripsByDate(date?: string, branchId?: string): Promise<Trip[]> {
  if (branchId) {
    try {
      const { data, error } = await supabase
        .from("trips")
        .select(`id, route_from, route_to, departure_time, arrival_time, duration, travel_date, date, price, currency, total_seats, available_seats, empty_seats, bus_type, amenities, plate_number, status, origin_branch, origin_branch_id, branch_id, operator_id, operator:operators(id, name, emoji)`)
        .eq("travel_date", date || new Date().toISOString().split("T")[0])
        .or(`origin_branch_id.eq.${branchId},branch_id.eq.${branchId}`)
        .order("travel_date", { ascending: true })
        .limit(200);
      if (!error && data) {
        return data.map((t: any) => {
          const op = t.operator;
          return {
            id: t.id,
            operator: { id: op?.id || t.operator_id || "unknown", name: op?.name || "Bus Operator", logo: op?.logo || "🚌", gradient: op?.gradient || "linear-gradient(135deg, #FF6B1A, #FF8800)", emoji: op?.emoji || op?.logo || "🚌", rating: 4.8, totalReviews: 120 },
            from: t.route_from || t.from || "Kigali", to: t.route_to || t.to || "Musanze",
            departureTime: t.departure_time || "08:00", arrivalTime: t.arrival_time || "10:00",
            duration: t.duration || "2h 00m", price: t.price || 2500, currency: t.currency || "RWF",
            availableSeats: t.available_seats ?? 36, totalSeats: t.total_seats ?? 36,
            busType: t.bus_type || "Coaster", amenities: t.amenities || ["WiFi", "AC"],
            date: t.travel_date || t.date || new Date().toISOString().split("T")[0],
            plateNumber: t.plate_number || "RAD100B", status: t.status || "scheduled",
            emptySeats: t.empty_seats ?? 0,
            origin_branch_id: t.origin_branch_id, branch_id: t.branch_id,
          } as any;
        });
      }
    } catch {}
  }
  return fetchTrips(undefined, undefined, date);
}

export async function fetchTripsForBranchRange(
  branchId: string,
  startDate: string,
  endDate: string,
): Promise<Trip[]> {
  try {
    const { data, error } = await supabase
      .from("trips")
      .select(
        `id, route_from, route_to, departure_time, arrival_time, duration, travel_date, date, price, currency, total_seats, available_seats, empty_seats, bus_type, amenities, plate_number, status, origin_branch, origin_branch_id, branch_id, operator_id, operator:operators(id, name, emoji)`,
      )
      .or(`origin_branch_id.eq.${branchId},branch_id.eq.${branchId}`)
      .gte("travel_date", startDate)
      .lte("travel_date", endDate)
      .order("travel_date", { ascending: true })
      .limit(500);
    if (error || !data) {
      if (error) console.error("Error fetching trips range:", error.message || error);
      return [];
    }
    return data.map((t: any) => {
      const op = t.operator;
      return {
        id: t.id,
        operator: {
          id: op?.id || t.operator_id || "unknown",
          name: op?.name || "Bus Operator",
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
        emptySeats: t.empty_seats ?? 0,
        origin_branch_id: t.origin_branch_id,
        branch_id: t.branch_id,
        driverName: t.driver_name || t.driverName,
      } as any;
    });
  } catch (err) {
    console.error("Failed to fetch trips range:", err);
    return [];
  }
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
      // No leaked default: resolve via the logged-in agent's branch → branch.agency_name → operators.name,
      // so a Fasta agent never schedules under Virunga.
      let resolvedFromAgent = false;
      try {
        const em = typeof window !== "undefined" ? (localStorage.getItem("urugendo_agent_email") || localStorage.getItem("urugendo_user_email")) : null;
        if (em) {
          const { data: ar } = await supabase.from("agency_agents").select("branch_id").eq("email", em).maybeSingle();
          const bid = (ar as any)?.branch_id || null;
          if (bid) {
            const { data: br } = await supabase.from("branches").select("agency_name").eq("id", bid).maybeSingle();
            const agency = (br as any)?.agency_name?.trim();
            if (agency) {
              const { data: op } = await supabase.from("operators").select("id").ilike("name", agency).maybeSingle();
              if ((op as any)?.id) { operatorId = (op as any).id as string; resolvedFromAgent = true; }
              else {
                // operator row missing — create would 400 otherwise; keep null and let insert fail loudly
                operatorId = undefined;
                resolvedFromAgent = true;
              }
            }
          }
        }
      } catch {}
      if (!resolvedFromAgent) {
        // No agent session — caller should supply operator; do NOT fall back to arbitrary first row.
        operatorId = undefined;
      }
      if (!operatorId) {
        console.error("[api] createTrip: cannot resolve operator_id — Fasta/Virunga leak guard fired. Supply tripData.operator or log in as agent.");
        return null;
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
      .maybeSingle();

    if (error || !data) {
      console.error("Error creating trip:", error?.message || error);
      return null;
    }

    const op = data.operator;
    return {
      id: data.id,
      operator: {
        id: op?.id || data.operator_id || "unknown",
        name: op?.name || "Bus Operator",
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

    // Branch isolation: a *passenger* booking must land on the selling branch,
    // which is the trip's origin branch (FK-authoritative), not the passenger's own agency_agents row.
    // Using the passenger's agency_agents row would mis-route bookings when a user has never been an agent.
    let resolvedBranchId: string | null = null;
    try {
      const tid = (bookingData.trip as any)?.id;
      if (tid) {
        const { data: trow } = await supabase.from("trips").select("origin_branch_id, branch_id").eq("id", tid).maybeSingle();
        const anyRow = trow as any;
        if (anyRow?.origin_branch_id) resolvedBranchId = anyRow.origin_branch_id;
        else if (anyRow?.branch_id) resolvedBranchId = anyRow.branch_id;
      }
    } catch {}
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
      .maybeSingle();

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
      .maybeSingle();

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
      .eq("branch_id", branchId)
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

// Persist the agent-recorded empty seat count for a departed trip.
export async function updateTripEmptySeats(
  tripId: string,
  emptySeats: number,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("trips")
      .update({ empty_seats: Math.max(0, Math.round(emptySeats)) })
      .eq("id", tripId);

    if (error) {
      console.error("Error updating trip empty seats:", error.message || error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Unexpected error updating trip empty seats:", err);
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
    totalAmount: Number(b.fare_amount) || Number(b.total_amount) || b.trip?.price || 0,
    createdAt: b.created_at,
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
        id: b.trip?.operator?.id || "unknown",
        name: b.trip?.operator?.name || "Bus Operator",
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

/* ------------------------------------------------------------------ */
/*  Branch Isolation: Source-of-truth resolver (Kigali ≠ Musanze)     */
/* ------------------------------------------------------------------ */

export interface AgentBranchContext {
  branchId: string;
  branchName: string;
  agencyName: string;
  stationCode: string | null;
  momoCode: string | null;
  phone: string | null;
  location: string | null;
  agentName: string | null;
  agentEmail: string | null;
  /** True if we found a branches row matching agency+name exactly */
  matched: boolean;
  /** True when the email in agency_agents is actually assigned to this branch */
  ownershipVerified: boolean;
  /** If not matched, a human-readable reason (for debugging / UI warnings) */
  reason?: string;
}

const BRANCH_LS_KEYS = [
  "urugendo_agency",
  "urugendo_branch",
  "urugendo_agent_email",
  "urugendo_user_email",
] as const;

function readLS(key: string): string | null {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function cleanStationName(n: string): string {
  return (n || "").toLowerCase().replace(/branch|station|terminal/g, "").trim();
}

/**
 * SOURCE-OF-TRUTH: resolve the active branch using the SAME tokens the user
 * verified with their station security code on login (agency + branch name).
 * NEVER trust agency_agents.branch_id alone — it can be stale/NULL on legacy rows.
 */
export async function resolveAgentBranchContext(): Promise<AgentBranchContext> {
  const agencyFromLogin = (readLSKey("urugendo_agency") || "").trim();
  const branchFromLogin = (readLSKey("urugendo_branch") || readLSKey("urugendo_station") || "").trim();
  const email = readLSKey("urugendo_agent_email") || readLSKey("urugendo_user_email");

  const fallback: AgentBranchContext = {
    branchId: "",
    branchName: branchFromLogin || "Musanze",
    agencyName: agencyFromLogin || "",
    stationCode: null,
    momoCode: null,
    phone: null,
    location: null,
    agentName: null,
    agentEmail: email,
    matched: false,
    ownershipVerified: false,
    reason: "Missing agency/branch in localStorage",
  };

  if (!agencyFromLogin || !branchFromLogin) {
    // Best-effort: try to resolve from email only if storage was wiped
    if (email) {
      try {
        const { data: ar } = await supabase.from("agency_agents").select("id,branch_id,branch_name,agency_name,name,email").eq("email", email).maybeSingle();
        const row = ar as any;
        if (row?.branch_id) {
          const { data: br } = await supabase.from("branches").select("id,name,agency_name,station_code,momo_code,phone,location,agent_name,agent_email").eq("id", row.branch_id).maybeSingle();
          const b = br as any;
          if (b) {
            return {
              branchId: b.id,
              branchName: b.name,
              agencyName: b.agency_name || row.agency_name || agencyFromLogin,
              stationCode: b.station_code || null,
              momoCode: b.momo_code || null,
              phone: b.phone || null,
              location: b.location || null,
              agentName: b.agent_name || row.name || null,
              agentEmail: b.agent_email || email || null,
              matched: true,
              ownershipVerified: true,
            };
          }
        }
      } catch {}
    }
    return fallback;
  }

  try {
    // 1. Look up branches table: MUST match agency_name (case-insensitive) AND name (case-insensitive, normalized)
    const { data: agencies } = await supabase
      .from("branches")
      .select("id,name,agency_name,station_code,momo_code,phone,location,agent_name,agent_email")
      .ilike("agency_name", agencyFromLogin);

    const normalizedBranch = cleanStationName(branchFromLogin);
    const exactBranch = (agencies as any[] || []).find(
      (b) => cleanStationName(b.name) === normalizedBranch,
    ) || (agencies as any[] || []).find(
      (b) => cleanStationName(b.name).includes(normalizedBranch) || normalizedBranch.includes(cleanStationName(b.name)),
    );

    if (!exactBranch) {
      fallback.reason = `No public.branches row matched agency="${agencyFromLogin}" branch="${branchFromLogin}". Ask manager to add it.`;
      return fallback;
    }

    // 2. Verify the email in agency_agents belongs to this branch
    let ownershipVerified = false;
    let agentName: string | null = exactBranch.agent_name || null;
    if (email) {
      try {
        const { data: ar } = await supabase.from("agency_agents").select("id,name,email,branch_id,branch_name,agency_name").eq("email", email).maybeSingle();
        const row = ar as any;
        if (row) {
          agentName = row.name || agentName;
          // Ownership passes IF (branch_id matches) OR (agency + name matches) OR (not yet set — we'll repair it below)
          const sameBranchId = row.branch_id && row.branch_id === exactBranch.id;
          const sameAgencyPlusName =
            (!row.agency_name || cleanStationName(row.agency_name) === cleanStationName(exactBranch.agency_name)) &&
            (!row.branch_name || cleanStationName(row.branch_name) === cleanStationName(exactBranch.name));
          const noBranchYet = !row.branch_id && !row.branch_name;
          ownershipVerified = !!sameBranchId || !!sameAgencyPlusName || !!noBranchYet;
        }
      } catch {}
    } else {
      ownershipVerified = true; // No email session on first-run pages
    }

    return {
      branchId: exactBranch.id,
      branchName: exactBranch.name,
      agencyName: exactBranch.agency_name || agencyFromLogin,
      stationCode: exactBranch.station_code || null,
      momoCode: exactBranch.momo_code || null,
      phone: exactBranch.phone || null,
      location: exactBranch.location || null,
      agentName: exactBranch.agent_name || agentName,
      agentEmail: exactBranch.agent_email || email || null,
      matched: true,
      ownershipVerified,
    };
  } catch (e: any) {
    fallback.reason = e?.message || String(e);
    return fallback;
  }
}

/** Repair helper — call on every successful login: this guarantees that the
 *  agency_agents foreign key + denorm fields stay in sync with the real branch.
 *  Legacy rows that had NULL/Wrong branch_id are fixed forever on first login. */
export async function repairAgentBranchOwnership(
  opts: { email: string; agencyName: string; branchName: string; branchId: string; agentName?: string | null },
): Promise<void> {
  try {
    await supabase.from("agency_agents")
      .update({
        agency_name: opts.agencyName.trim(),
        branch_name: opts.branchName.trim(),
        branch_id: opts.branchId,
        ...(opts.agentName ? { name: opts.agentName.trim() } : {}),
      })
      .ilike("email", opts.email.trim().toLowerCase());
  } catch (e) {
    console.warn("[branch] repairAgentBranchOwnership skipped:", e);
  }
}

// localStorage reader wrapper (tiny adapter to avoid try/catch repetition above)
function readLSKey(key: string): string | null {
  return readLS(key);
}

// Re-export cleanStationName for pages (keep alias for api callers)

/* ------------------------------------------------------------------ */
/*  Safety helpers: cross-account leakage guard for shared-device use  */
/* ------------------------------------------------------------------ */

/**
 * Removes every localStorage key with the `urugendo_` or Supabase `sb-`
 * prefix, EXCEPT the ones in the allowlist (login form fields we want
 * to keep between sweep and successful auth completion).
 */
export function clearUrugendoSweepableStorage(allowlist: string[] = []): void {
  if (typeof window === "undefined") return;
  const keep = new Set(allowlist.map((k) => k.toLowerCase()));
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith("urugendo_") && !k.startsWith("sb-")) continue;
    if (keep.has(k.toLowerCase())) continue;
    keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  // sessionStorage sweep (rare but some SSR frameworks use it)
  try {
    const skeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith("urugendo_") || k.startsWith("sb-")) skeysToRemove.push(k);
    }
    skeysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

/**
 * Session guard: MUST be called on mount of every page that renders
 * branch-scoped data (dashboard/schedule/reports/manifest/profile/manager).
 *
 * Checks: 1) if localStorage `urugendo_branch_id` disagrees with the
 * source-of-truth resolver (agency+branch name → branches table), the
 * previous user's session was NOT logged out properly → perform a full
 * sweep and hard-redirect to login.  2) if resolver returns ownership
 * not verified → also force re-login (prevents agency_agents FK swap
 * attack: e.g. old FK points to Musanze but new login is Kigali).
 *
 * Returns true when ownership passes (page may continue loading).
 * Returns false when we triggered the redirect (caller should bail).
 */
export async function validateAgentBranchOwnershipOrLogout(opts: {
  router: { push: (href: string) => void };
  loginHref?: string;
  mode?: "agent" | "manager" | "any";
}): Promise<boolean> {
  const { router, loginHref = "/agency/agency-login", mode = "any" } = opts;
  if (typeof window === "undefined") return true;

  // Manager pages: only need the manager_id presence check (they don't use branches)
  if (mode === "manager") {
    const mid = localStorage.getItem("urugendo_manager_id");
    const mcode = localStorage.getItem("urugendo_manager_code");
    const memail = localStorage.getItem("urugendo_manager_email");
    if (!mid || !mcode || !memail) {
      clearUrugendoSweepableStorage();
      try { await supabase.auth.signOut(); } catch {}
      window.location.href = loginHref;
      return false;
    }
    return true;
  }

  // Agent pages
  const ctx = await resolveAgentBranchContext();
  const cachedId = localStorage.getItem("urugendo_branch_id");

  let needsLogout = false;
  let reason = "";

  if (ctx.matched && cachedId && cachedId !== ctx.branchId) {
    needsLogout = true;
    reason = `cached branch_id (${cachedId.slice(0, 8)}…) ≠ resolved branch_id (${ctx.branchId.slice(0, 8)}…)`;
  }
  if (ctx.matched && !ctx.ownershipVerified && storedAgentEmailPresentAny()) {
    // Email in agency_agents is NOT attached to this branches row; could be cross-branch leak
    needsLogout = true;
    reason = `agency_agents ownership not verified for branch="${ctx.branchName}"`;
  }
  if (!ctx.matched && storedAgentEmailPresentAny()) {
    // No branches row at all for the storage tokens → logout forces fresh login to repair
    needsLogout = true;
    reason = `resolver could not match branches row for stored session`;
  }

  if (needsLogout) {
    console.warn("[branch-safety] logging out due to:", reason, { ctx: { matched: ctx.matched, branchName: ctx.branchName, ownershipVerified: ctx.ownershipVerified }, cachedId });
    clearUrugendoSweepableStorage();
    try { await supabase.auth.signOut(); } catch {}
    // Hard reload (clears all in-memory React state)
    window.location.href = loginHref;
    return false;
  }
  return true;
}

function storedAgentEmailPresentAny(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("urugendo_agent_email") || localStorage.getItem("urugendo_user_email"));
}

