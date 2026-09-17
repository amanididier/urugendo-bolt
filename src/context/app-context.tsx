"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { Language, Trip, Booking, PaymentMethod } from "@/lib/types";
import {
  sampleBookings,
  generateBookingId,
  fetchDatabaseBranches,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { notifyUser } from "@/lib/notificationsService";
// Removed unused NotificationsPage import to prevent strict TS warnings

export type UserRole = "passenger" | "agent" | "manager";
export type AgentStatus = "approved" | "pending";

interface SearchState {
  from: string;
  to: string;
  date: string;
  passengers: number;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  agentStatus: AgentStatus;
  setAgentStatus: (status: AgentStatus) => void;
  search: SearchState;
  setSearch: (search: Partial<SearchState>) => void;
  selectedTrip: Trip | null;
  setSelectedTrip: (trip: Trip | null) => void;
  selectedSeat: string | null;
  setSelectedSeat: (seat: string | null) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, "id">) => string;
  cityPickerOpen: boolean;
  setCityPickerOpen: (open: boolean) => void;
  cityPickerField: "from" | "to";
  setCityPickerField: (field: "from" | "to") => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
  userName: string;
  setUserName: (name: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  userPhone: string;
  setUserPhone: (phone: string) => void;
  groupPassengers: string[];
  setGroupPassengers: (passengers: string[]) => void;
  branchNames: string[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("EN");
  const [userRole, setUserRoleState] = useState<UserRole>("passenger");
  const [agentStatus, setAgentStatusState] = useState<AgentStatus>("approved");
  const [isLoggedIn, setIsLoggedInState] = useState<boolean>(false);
  const [userName, setUserNameState] = useState<string>("");
  const [userEmail, setUserEmailState] = useState<string>("");
  const [userPhone, setUserPhoneState] = useState<string>("");
  const [groupPassengers, setGroupPassengers] = useState<string[]>([]);
  const [bookings, setBookings] = useState<Booking[]>(sampleBookings);
  const [branchNames, setBranchNames] = useState<string[]>([
    "Musanze",
    "Kigali",
    "Gicumbi",
    "Nyagatare",
    "Rubavu",
  ]);

  useEffect(() => {
    fetchDatabaseBranches().then((branches) => {
      if (branches && branches.length > 0) {
        setBranchNames(branches);
      }
    });

    const savedLang = localStorage.getItem("urugendo_language");
    if (savedLang === "EN" || savedLang === "FR" || savedLang === "KIN") {
      setLanguageState(savedLang as Language);
    }
    // Batch 1: role is derived from the auth session, NOT from localStorage.
    // Reading "urugendo_role" here is intentionally removed so that a stale
    // role from a previous logout cannot grant the wrong permissions to the
    // next signed-in user. The session-driven effect below sets userRole
    // after we identify the user against profiles/agency_agents.
    const savedStatus = localStorage.getItem("urugendo_agent_status");
    if (savedStatus === "approved" || savedStatus === "pending") {
      setAgentStatusState(savedStatus as AgentStatus);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        const resolvedName =
          meta?.full_name ||
          meta?.name ||
          session.user.email?.split("@")[0] ||
          "Traveler";
        const resolvedEmail = session.user.email || "";
        const resolvedPhone = meta?.phone || "";

        setIsLoggedInState(true);
        setUserNameState(resolvedName);
        setUserEmailState(resolvedEmail);
        if (resolvedPhone) setUserPhoneState(resolvedPhone);

        localStorage.setItem("urugendo_is_logged_in", "true");
        localStorage.setItem("urugendo_user_name", resolvedName);
        localStorage.setItem("urugendo_user_email", resolvedEmail);
        if (resolvedPhone)
          localStorage.setItem("urugendo_user_phone", resolvedPhone);

        // Derive role from the authenticated user: which Supabase table
        // identifies them? Manager role is determined by presence in
        // agency_managers table (see managerAuth.ts).
        const userEmail = session.user.email || "";
        const { data: managerRow } = await supabase
          .from("agency_managers")
          .select("id")
          .eq("email", userEmail)
          .maybeSingle();
        if (managerRow) {
          setUserRoleState("manager");
        } else {
          // Resolve agent by real agency_agents columns (email/phone),
          // not by `id = auth.users.id` / `user_id` — those 400.
          let isAgent = false;
          try {
            const { fetchAgentByAuth } = await import("@/lib/agencyAgentService");
            const row = await fetchAgentByAuth({
              email: (session.user.email || "") as string,
              phone: (session.user as any)?.phone || (session.user.user_metadata as any)?.phone || null,
            });
            isAgent = !!row;
          } catch {}
          if (!isAgent) {
            const em = (session.user.email || "").trim().toLowerCase();
            if (em) {
              try {
                const { data } = await supabase.from("agency_agents").select("id").eq("email", em).maybeSingle();
                isAgent = !!data;
              } catch {}
            }
          }
          if (isAgent) setUserRoleState("agent");
          else setUserRoleState("passenger");
        }
      } else {
        // No session — clear cached identity, do NOT keep stale role.
        const savedLogin = localStorage.getItem("urugendo_is_logged_in");
        if (savedLogin !== null) {
          setIsLoggedInState(savedLogin === "true");
        }
        const savedName = localStorage.getItem("urugendo_user_name");
        if (savedName) setUserNameState(savedName);
        const savedEmail = localStorage.getItem("urugendo_user_email");
        if (savedEmail) setUserEmailState(savedEmail);
        const savedPhone = localStorage.getItem("urugendo_user_phone");
        if (savedPhone) setUserPhoneState(savedPhone);
        setUserRoleState("passenger");
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const meta = session.user.user_metadata;
          const resolvedName =
            meta?.full_name ||
            meta?.name ||
            session.user.email?.split("@")[0] ||
            "Traveler";
          const resolvedEmail = session.user.email || "";

          setIsLoggedInState(true);
          setUserNameState(resolvedName);
          setUserEmailState(resolvedEmail);

          localStorage.setItem("urugendo_is_logged_in", "true");
          localStorage.setItem("urugendo_user_name", resolvedName);
          localStorage.setItem("urugendo_user_email", resolvedEmail);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!bookings || bookings.length === 0) return;
      const now = new Date();

      bookings.forEach((booking) => {
        const bookingDate = booking.trip?.date || (booking as any).bookingDate;
        const bookingTime =
          booking.trip?.departureTime || (booking as any).time;
        if (!bookingDate || !bookingTime) return;

        const departureDateTime = new Date(`${bookingDate}T${bookingTime}`);
        if (isNaN(departureDateTime.getTime())) return;

        const diffMinutes =
          (departureDateTime.getTime() - now.getTime()) / 60000;

        if (diffMinutes > 59 && diffMinutes <= 60) {
          const notificationId = `urugendo_departure_notified_1hr_${booking.id}`;
          if (!localStorage.getItem(notificationId)) {
            localStorage.setItem(notificationId, "true");
            supabase.auth.getUser().then(({ data }) => {
              if (data.user && booking.userId) notifyUser({ userId: booking.userId, title: "⏰ Upcoming Trip Reminder", message: "⏰ Upcoming Trip: Today you have a trip to Kigali! Get your bags packed and ready so you don't miss your departure.", type: "reminder", actionUrl: `/ticket/${booking.id}` });
            });
          }
        }

        if (diffMinutes > 14 && diffMinutes <= 15) {
          const notificationId = `urugendo_departure_notified_15min_${booking.id}`;
          if (!localStorage.getItem(notificationId)) {
            localStorage.setItem(notificationId, "true");
            supabase.auth.getUser().then(({ data }) => {
              if (data.user && booking.userId) notifyUser({ userId: booking.userId, title: "🚌 Final Call", message: "🚌 Final Call: Your bus will depart in 15 minutes. Please head to the terminal gate for final ticket verification.", type: "reminder", actionUrl: `/ticket/${booking.id}` });
            });
          }
        }
      });
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [bookings]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("urugendo_language", lang);
  }, []);

  const setUserRole = useCallback((role: UserRole) => {
    // Batch 1: role is now derived from the auth session. The setter is kept
    // (callers still call it) but it no longer persists to localStorage —
    // a stale role from a previous user must not survive a logout.
    setUserRoleState(role);
  }, []);

  const setAgentStatus = useCallback((status: AgentStatus) => {
    setAgentStatusState(status);
    localStorage.setItem("urugendo_agent_status", status);
  }, []);

  const setIsLoggedIn = useCallback((loggedIn: boolean) => {
    setIsLoggedInState(loggedIn);
    localStorage.setItem("urugendo_is_logged_in", String(loggedIn));
  }, []);

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
    localStorage.setItem("urugendo_user_name", name);
  }, []);

  const setUserEmail = useCallback((email: string) => {
    setUserEmailState(email);
    localStorage.setItem("urugendo_user_email", email);
  }, []);

  const setUserPhone = useCallback((phone: string) => {
    setUserPhoneState(phone);
    localStorage.setItem("urugendo_user_phone", phone);
  }, []);

  const [search, setSearchState] = useState<SearchState>({
    from: "",
    to: "",
    date: "",
    passengers: 1,
  });

  useEffect(() => {
    setSearchState((prev) => ({
      ...prev,
      date: prev.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date()),
    }));
  }, []);

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mtn");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityPickerField, setCityPickerField] = useState<"from" | "to">("from");

  const setSearch = useCallback((partial: Partial<SearchState>) => {
    setSearchState((prev) => ({ ...prev, ...partial }));
  }, []);

  const addBooking = useCallback((booking: Omit<Booking, "id">): string => {
    const id = generateBookingId();
    const newBooking = { ...booking, id };
    setBookings((prev) => [newBooking, ...prev]);
    return id;
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        userRole,
        setUserRole,
        agentStatus,
        setAgentStatus,
        search,
        setSearch,
        selectedTrip,
        setSelectedTrip,
        selectedSeat,
        setSelectedSeat,
        paymentMethod,
        setPaymentMethod,
        bookings,
        addBooking,
        cityPickerOpen,
        setCityPickerOpen,
        cityPickerField,
        setCityPickerField,
        isLoggedIn,
        setIsLoggedIn,
        userName,
        setUserName,
        userEmail,
        setUserEmail,
        userPhone,
        setUserPhone,
        groupPassengers,
        setGroupPassengers,
        branchNames,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
