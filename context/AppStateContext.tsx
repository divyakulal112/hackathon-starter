"use client";

/**
 * AppStateContext — single source of truth for the demo.
 *
 * Holds centres, appointments and the SMS outbox. The public API is unchanged
 * from the localStorage-only demo; persistence now goes through the DataSource
 * seam (lib/data):
 *   - local mode    → localStorage blob + `storage` events (original behavior).
 *   - supabase mode → PostgreSQL rows + realtime (two-window demo syncs across
 *                     devices; SMS stays client-local per the approved plan).
 *
 * The recommendation engine and UI components never import Supabase — they
 * keep consuming plain Centre/Appointment data from this context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  TRACKING_STAGES,
} from "@/lib/constants";
import { MOCK_APPOINTMENTS, MOCK_CENTRES } from "@/lib/mockData";
import { getDataSource } from "@/lib/data";

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

function freshSeedSnapshot() {
  return {
    centres: MOCK_CENTRES.map((c) => ({ ...c })),
    appointments: MOCK_APPOINTMENTS.map((a) => ({ ...a })),
    smsOutbox: [] as SmsMessage[],
  };
}

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

  // The data source is resolved once per browser session (see lib/data).
  const sourceRef = useRef(getDataSource());
  // Latest state, so async callbacks (subscribe / fire-and-forget writes)
  // always observe the current snapshot without re-subscribing.
  const stateRef = useRef({ centres, appointments, smsOutbox });
  stateRef.current = { centres, appointments, smsOutbox };

  const snapshot = useCallback(
    () => ({
      centres: stateRef.current.centres,
      appointments: stateRef.current.appointments,
      smsOutbox: stateRef.current.smsOutbox,
    }),
    [],
  );

  // ---- Hydrate after mount (SSR-safe): local blob or Supabase tables.
  useEffect(() => {
    let cancelled = false;
    const source = sourceRef.current;

    async function hydrate() {
      try {
        const loaded = await source.load();
        if (cancelled) return;
        if (loaded) {
          // Supabase mode with an unseeded project: keep the mock seeds so the
          // demo still renders; resetDemoData will seed the DB on demand.
          const empty =
            loaded.centres.length === 0 && loaded.appointments.length === 0;
          if (!empty) {
            setCentres(loaded.centres);
            setAppointments(loaded.appointments);
            setSmsOutbox(loaded.smsOutbox);
          } else if (source.kind === "supabase") {
            console.warn(
              "[KisanSync] Supabase tables are empty — showing seed data. " +
                "Run supabase/seed.sql to persist the demo dataset.",
            );
          }
        }
      } catch (err) {
        console.error("[KisanSync] data source load failed; using seed data", err);
        setUsingCachedData(true);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Persist the parts of the snapshot this source owns.
  useEffect(() => {
    if (!hydrated) return;
    sourceRef.current.persist({ centres, appointments, smsOutbox });
  }, [centres, appointments, smsOutbox, hydrated]);

  // ---- Change feed: cross-tab storage events (local) or realtime (Supabase).
  useEffect(() => {
    const unsubscribe = sourceRef.current.subscribe((next) => {
      setCentres(next.centres);
      setAppointments(next.appointments);
      setSmsOutbox(next.smsOutbox);
    });
    return unsubscribe;
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

  // ---- Backend writes (fire-and-forget with logged failures). The UI stays
  // optimistic; in Supabase mode realtime refetches reconcile remote truth.
  const persistBooking = useCallback(
    (appointment: Appointment, centreAfter: Centre, request: ProcurementRequest) => {
      void sourceRef.current
        .bookToken({ centreId: appointment.centreId, request, appointment, centreAfter })
        .catch((err) =>
          console.error("[KisanSync] bookToken persist failed", err),
        );
    },
    [],
  );

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

      const centreAfter: Centre = {
        ...centre,
        bookedToday: centre.bookedToday + 1,
        queueCount: centre.queueCount + 1,
      };

      setAppointments((prev) => [...prev, appointment]);

      // Centre load reflects the new booking immediately.
      setCentres((prev) =>
        prev.map((c) => (c.id === centre.id ? centreAfter : c)),
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

      persistBooking(appointment, centreAfter, input.request);

      return appointment;
    },
    [centres, appointments, persistBooking],
  );

  const cancelBooking = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== appointmentId) return a;
        const updated: Appointment = {
          ...a,
          status: "cancelled" as const,
          stageIndex: 7,
        };
        void sourceRef.current
          .updateAppointmentStatus(updated)
          .catch((err) =>
            console.error("[KisanSync] cancelBooking persist failed", err),
          );
        return updated;
      }),
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

      const updated: Appointment = {
        ...target,
        status,
        stageIndex: stageIndexForStatus(status),
        paymentRef,
      };

      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? updated : a)),
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

      void sourceRef.current
        .updateAppointmentStatus(updated)
        .catch((err) =>
          console.error("[KisanSync] status persist failed", err),
        );
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

      const updated: Appointment = {
        ...target,
        status: next,
        stageIndex: stageIndexForStatus(next),
        paymentRef,
      };

      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? updated : a)),
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

      void sourceRef.current
        .updateAppointmentStatus(updated)
        .catch((err) =>
          console.error("[KisanSync] advance persist failed", err),
        );
    },
    [appointments],
  );

  const surgeQueue = useCallback((centreId: string, add: number) => {
    // Compute from the ref (not inside the setState updater) so the backend
    // write fires exactly once per user action, even under StrictMode.
    const target = stateRef.current.centres.find((c) => c.id === centreId);
    if (!target) return;
    const newQueueCount = Math.max(0, target.queueCount + add);
    setCentres((prev) =>
      prev.map((c) =>
        c.id === centreId ? { ...c, queueCount: newQueueCount } : c,
      ),
    );
    void sourceRef.current
      .surgeQueue(centreId, newQueueCount)
      .catch((err) =>
        console.error("[KisanSync] surgeQueue persist failed", err),
      );
  }, []);

  /**
   * Full demo reset — restores seed centres (queue + capacity + bookedToday),
   * seed appointments and clears the SMS outbox. Repeatable: every call
   * re-clones the pristine seed constants. In Supabase mode it also re-seeds
   * the database.
   */
  const resetDemoData = useCallback(() => {
    const seed = freshSeedSnapshot();
    setCentres(seed.centres);
    setAppointments(seed.appointments);
    setSmsOutbox([]);
    void sourceRef.current
      .resetDemoData({ centres: seed.centres, appointments: seed.appointments, smsOutbox: [] })
      .catch((err) =>
        console.error("[KisanSync] resetDemoData persist failed", err),
      );
  }, []);

  /** Kept for backwards compatibility — delegates to the full reset. */
  const resetQueue = useCallback((_centreId?: string) => {
    resetDemoData();
  }, [resetDemoData]);

  const archiveAppointment = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== appointmentId) return a;
        const updated: Appointment = { ...a, archived: true };
        void sourceRef.current
          .archiveAppointment(updated)
          .catch((err) =>
            console.error("[KisanSync] archive persist failed", err),
          );
        return updated;
      }),
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
