"use client";

/**
 * AppStateContext — single source of truth for the demo.
 *
 * Holds centres, appointments and the SMS outbox. Every mutation is
 * persisted to localStorage and broadcast to other tabs, so the farmer
 * dashboard and centre dashboard (opened side by side) stay in sync.
 *
 * When Supabase is wired up, replace the persistence layer here with
 * table reads/writes — the UI components do not need to change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Appointment,
  AppointmentStatus,
  Centre,
  ProcurementRequest,
  SmsMessage,
} from "@/lib/types";
import {
  CROP_RATES_INR_PER_QUINTAL,
  DEMO_FARMER,
  STORAGE_KEYS,
  TRACKING_STAGES,
} from "@/lib/constants";
import { MOCK_APPOINTMENTS, MOCK_CENTRES } from "@/lib/mockData";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BookTokenInput {
  centreId: string;
  request: ProcurementRequest;
  arrivalWindow: string;
}

interface AppStateContextValue {
  // Data
  centres: Centre[];
  appointments: Appointment[];
  smsOutbox: SmsMessage[];
  isOffline: boolean;
  /** True when the offline banner should be shown (demo toggle or browser offline). */
  usingCachedData: boolean;

  // Farmer actions
  bookToken: (input: BookTokenInput) => Appointment;
  cancelBooking: (appointmentId: string) => void;

  // Centre actions
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => void;
  /** Pushes an appointment forward along the normal status flow. */
  advanceAppointment: (appointmentId: string) => void;
  /** Adds walk-in farmers to the live queue (congestion demo). */
  surgeQueue: (centreId: string, add: number) => void;
  /** DEPRECATED alias of resetDemoData (kept so no caller breaks). */
  resetQueue: (centreId: string) => void;
  /** Full demo reset: seed centres, queues, capacity, appointments, SMS. */
  resetDemoData: () => void;
  /** Marks the farmer's current appointment archived (Start New Request). */
  archiveAppointment: (appointmentId: string) => void;

  // Offline demo toggle
  setOfflineDemo: (offline: boolean) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextTokenNumber(appointments: Appointment[]): string {
  const numbers = appointments
    .map((a) => Number(a.tokenNumber.replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 100;
  return `KS-${max + 1}`;
}

function stageIndexForStatus(status: AppointmentStatus): number {
  const idx = TRACKING_STAGES.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

function appointmentAmount(crop: string, qty: number): number {
  return (CROP_RATES_INR_PER_QUINTAL[crop] ?? 2000) * qty;
}

function makeSms(partial: Omit<SmsMessage, "id" | "createdAt">): SmsMessage {
  return {
    ...partial,
    id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
}

interface StoredState {
  centres: Centre[];
  appointments: Appointment[];
  sms: SmsMessage[];
}

function readLocalState(): StoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoState);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (!Array.isArray(parsed.centres) || !Array.isArray(parsed.appointments)) {
      return null;
    }
    return {
      centres: parsed.centres,
      appointments: parsed.appointments,
      sms: Array.isArray(parsed.sms) ? parsed.sms : [],
    };
  } catch {
    return null;
  }
}

/** Status flow used by "advance" — mirrors CENTRE_STATUS_FLOW order. */
const STATUS_FLOW: AppointmentStatus[] = [
  "slot_booked",
  "arrived",
  "weighed",
  "quality_verified",
  "procurement_completed",
  "payment_initiated",
  "payment_received",
];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [centres, setCentres] = useState<Centre[]>(MOCK_CENTRES);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [smsOutbox, setSmsOutbox] = useState<SmsMessage[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ---- Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    const local = readLocalState();
    if (local) {
      setCentres(local.centres);
      setAppointments(local.appointments);
      setSmsOutbox(local.sms);
    }
    setHydrated(true);
  }, []);

  // ---- Persist live state + refresh the offline centre cache.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.demoState,
        JSON.stringify({ centres, appointments, sms: smsOutbox }),
      );
      window.localStorage.setItem(
        STORAGE_KEYS.cachedCentres,
        JSON.stringify(centres),
      );
    } catch {
      // quota/blocked storage — demo continues in memory
    }
  }, [centres, appointments, smsOutbox, hydrated]);

  // ---- Cross-tab sync so farmer + centre dashboards can run side by side.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEYS.demoState || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<StoredState>;
        if (Array.isArray(parsed.centres)) setCentres(parsed.centres);
        if (Array.isArray(parsed.appointments)) setAppointments(parsed.appointments);
        if (Array.isArray(parsed.sms)) setSmsOutbox(parsed.sms);
      } catch {
        // ignore malformed payloads
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---- Browser online/offline events.
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ---- Farmer actions ----------------------------------------------------

  const bookToken = useCallback(
    (input: BookTokenInput): Appointment => {
      const centre = centres.find((c) => c.id === input.centreId);
      if (!centre) throw new Error("Unknown centre");

      // Compute everything synchronously from current state — React defers
      // setState updaters, so side effects must not live inside them.
      const token = nextTokenNumber(appointments);
      const appointment: Appointment = {
        id: `apt-${token.toLowerCase()}-${Date.now()}`,
        tokenNumber: token,
        farmerId: DEMO_FARMER.id,
        farmerName: DEMO_FARMER.name,
        centreId: centre.id,
        centreName: centre.name,
        crop: input.request.crop,
        quantityQuintals: input.request.quantityQuintals,
        village: DEMO_FARMER.village,
        arrivalWindow: input.arrivalWindow,
        bookedAt: new Date().toISOString(),
        status: "slot_booked",
        stageIndex: stageIndexForStatus("slot_booked"),
        estimatedAmountInr: appointmentAmount(
          input.request.crop,
          input.request.quantityQuintals,
        ),
      };

      setAppointments((prev) => [...prev, appointment]);

      // Centre load reflects the new booking immediately.
      setCentres((prev) =>
        prev.map((c) =>
          c.id === centre.id
            ? { ...c, bookedToday: c.bookedToday + 1, queueCount: c.queueCount + 1 }
            : c,
        ),
      );

      setSmsOutbox((prev) => [
        ...prev,
        makeSms({
          kind: "booking",
          tokenNumber: token,
          centreName: centre.name,
          arrivalWindow: input.arrivalWindow,
        }),
      ]);

      return appointment;
    },
    [centres, appointments],
  );

  const cancelBooking = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId
          ? { ...a, status: "cancelled" as const, stageIndex: 7 }
          : a,
      ),
    );
  }, []);

  // ---- Centre actions ----------------------------------------------------

  const updateAppointmentStatus = useCallback(
    (appointmentId: string, status: AppointmentStatus) => {
      const target = appointments.find((a) => a.id === appointmentId);
      if (!target) return;

      const paymentRef =
        status === "payment_received"
          ? `PAY-${target.tokenNumber.replace("KS-", "")}-${new Date().getFullYear()}`
          : target.paymentRef;

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? { ...a, status, stageIndex: stageIndexForStatus(status), paymentRef }
            : a,
        ),
      );

      setSmsOutbox((prev) => [
        ...prev,
        makeSms({
          kind: status === "payment_received" ? "payment" : "status",
          tokenNumber: target.tokenNumber,
          centreName: target.centreName,
          stageKey: TRACKING_STAGES[stageIndexForStatus(status)]?.key,
          amountInr: target.estimatedAmountInr,
          paymentRef,
        }),
      ]);
    },
    [appointments],
  );

  const advanceAppointment = useCallback(
    (appointmentId: string) => {
      const target = appointments.find((a) => a.id === appointmentId);
      if (!target || target.status === "cancelled") return;

      const idx = STATUS_FLOW.indexOf(target.status);
      const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
      if (next === target.status) return;

      const paymentRef =
        next === "payment_received"
          ? `PAY-${target.tokenNumber.replace("KS-", "")}-${new Date().getFullYear()}`
          : target.paymentRef;

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? { ...a, status: next, stageIndex: stageIndexForStatus(next), paymentRef }
            : a,
        ),
      );

      setSmsOutbox((prev) => [
        ...prev,
        makeSms({
          kind: next === "payment_received" ? "payment" : "status",
          tokenNumber: target.tokenNumber,
          centreName: target.centreName,
          stageKey: TRACKING_STAGES[stageIndexForStatus(next)]?.key,
          amountInr: target.estimatedAmountInr,
          paymentRef,
        }),
      ]);
    },
    [appointments],
  );

  const surgeQueue = useCallback((centreId: string, add: number) => {
    setCentres((prev) =>
      prev.map((c) =>
        c.id === centreId
          ? { ...c, queueCount: Math.max(0, c.queueCount + add) }
          : c,
      ),
    );
  }, []);

  /**
   * Full demo reset — restores seed centres (queue + capacity + bookedToday),
   * seed appointments and clears the SMS outbox. Repeatable: every call
   * re-clones the pristine seed constants.
   */
  const resetDemoData = useCallback(() => {
    setCentres(MOCK_CENTRES.map((c) => ({ ...c })));
    setAppointments(MOCK_APPOINTMENTS.map((a) => ({ ...a })));
    setSmsOutbox([]);
  }, []);

  /** Kept for backwards compatibility — delegates to the full reset. */
  const resetQueue = useCallback((_centreId?: string) => {
    resetDemoData();
  }, [resetDemoData]);

  const archiveAppointment = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId ? { ...a, archived: true } : a,
      ),
    );
  }, []);

  // ---- Offline demo toggle ------------------------------------------------

  const setOfflineDemo = useCallback((offline: boolean) => {
    if (!offline) {
      setUsingCachedData(false);
      return;
    }
    // Demo-only banner. We intentionally do NOT replace live centre state —
    // the cache is a stale snapshot and overwriting live data caused data
    // loss in earlier builds. Live data keeps flowing; the banner shows.
    setUsingCachedData(true);
  }, []);

  const value = useMemo(
    () => ({
      centres,
      appointments,
      smsOutbox,
      isOffline,
      usingCachedData,
      bookToken,
      cancelBooking,
      updateAppointmentStatus,
      advanceAppointment,
      surgeQueue,
      resetQueue,
      resetDemoData,
      archiveAppointment,
      setOfflineDemo,
    }),
    [
      centres,
      appointments,
      smsOutbox,
      isOffline,
      usingCachedData,
      bookToken,
      cancelBooking,
      updateAppointmentStatus,
      advanceAppointment,
      surgeQueue,
      resetQueue,
      resetDemoData,
      archiveAppointment,
      setOfflineDemo,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
