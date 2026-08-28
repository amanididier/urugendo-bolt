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
import { NotificationsPage } from "@/app/user-notifications/page";

export type UserRole = "passenger" | "agent" | "driver" | "manager";
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
    const savedRole = localStorage.getItem("urugendo_role");
    if (
      savedRole === "driver" ||
      savedRole === "agent" ||
      savedRole === "passenger" ||
      savedRole === "manager"
    ) {
      setUserRoleState(savedRole as UserRole);
    }
    const savedStatus = localStorage.getItem("urugendo_agent_status");
    if (savedStatus === "approved" || savedStatus === "pending") {
      setAgentStatusState(savedStatus as AgentStatus);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
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
      } else {
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
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
        if (!booking.date || !booking.time) return;
        const departureDateTime = new Date(`${booking.date}T${booking.time}`);
        if (isNaN(departureDateTime.getTime())) return;

        const diffMinutes =
          (departureDateTime.getTime() - now.getTime()) / 60000;

        if (diffMinutes > 59 && diffMinutes <= 60) {
          const notificationId = `urugendo_departure_notified_1hr_${booking.id}`;
          if (!localStorage.getItem(notificationId)) {
            localStorage.setItem(notificationId, "true");
            addUserNotification({
              title: "⏰ Upcoming Trip Reminder",
              message:
                "⏰ Upcoming Trip: Today you have a trip to Kigali! Get your bags packed and ready so you don’t miss your departure.",
              type: "departure",
            });
          }
        }

        if (diffMinutes > 14 && diffMinutes <= 15) {
          const notificationId = `urugendo_departure_notified_15min_${booking.id}`;
          if (!localStorage.getItem(notificationId)) {
            localStorage.setItem(notificationId, "true");
            addUserNotification({
              title: "🚌 Final Call",
              message:
                "🚌 Final Call: Your bus will depart in 15 minutes. Please head to the terminal gate for final ticket verification.",
              type: "departure",
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
    setUserRoleState(role);
    localStorage.setItem("urugendo_role", role);
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
      date: prev.date || new Date().toISOString().split("T")[0],
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
