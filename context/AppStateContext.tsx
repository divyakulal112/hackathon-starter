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
  DEMO_FARMER,
  TRACKING_STAGES,
} from "@/lib/constants";
import { MOCK_APPOINTMENTS, MOCK_CENTRES } from "@/lib/mockData";
import { getDataSource } from "@/lib/data";
import type { QueuedOfflineRequest, SyncState } from "@/lib/offline/types";
import {
  getQueuedRequests,
  saveQueuedRequest,
  updateQueuedRequest,
  deleteQueuedRequest,
  getLastKnownSyncTime,
  setLastKnownSyncTime,
} from "@/lib/offline/offlineStorage";
import { processOfflineQueue, type SyncResult } from "@/lib/offline/syncManager";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BookTokenInput {
  centreId: string;
  request: ProcurementRequest;
  arrivalWindow: string;
  modalPrice?: number | null;
  farmerName?: string;
  farmerVillage?: string;
}

interface AppStateContextValue {
  // Data
  centres: Centre[];
  appointments: Appointment[];
  smsOutbox: SmsMessage[];
  isOffline: boolean;
  /** True when the offline banner should be shown (demo toggle or browser offline). */
  usingCachedData: boolean;

  // Offline-first additions
  syncState: SyncState;
  queuedRequests: QueuedOfflineRequest[];
  lastKnownSyncTime: number;
  saveOfflineBooking: (payload: {
    centreId?: string;
    centreName?: string;
    arrivalWindow?: string;
    request: ProcurementRequest;
    modalPrice?: number | null;
  }) => Promise<QueuedOfflineRequest>;
  cancelOfflineRequest: (requestId: string) => Promise<void>;
  retryOfflineRequest: (requestId: string) => Promise<void>;
  triggerSync: () => Promise<SyncResult>;

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

function appointmentAmount(modalPrice: number | null | undefined, qty: number): number | null {
  if (modalPrice == null || modalPrice <= 0 || Number.isNaN(modalPrice)) {
    return null;
  }
  return Math.round(modalPrice * qty);
}

function makeSms(partial: Omit<SmsMessage, "id" | "createdAt">): SmsMessage {
  return {
    deliveryStatus: "received",
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
  const [browserOffline, setBrowserOffline] = useState(false);
  const [offlineDemo, setOfflineDemoState] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("ONLINE");
  const [queuedRequests, setQueuedRequests] = useState<QueuedOfflineRequest[]>([]);
  const [lastKnownSyncTime, setSyncTimeState] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  const isOffline = browserOffline || offlineDemo;

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

  // ---- Browser online/offline events & offline queue hydration
  useEffect(() => {
    void getQueuedRequests().then((reqs) => setQueuedRequests(reqs));
    setSyncTimeState(getLastKnownSyncTime());

    const handleOnline = () => {
      setBrowserOffline(false);
      setUsingCachedData(false);
    };
    const handleOffline = () => {
      setBrowserOffline(true);
      setUsingCachedData(true);
      setSyncState("OFFLINE");
    };

    if (typeof navigator !== "undefined") {
      const offline = !navigator.onLine;
      setBrowserOffline(offline);
      if (offline) setSyncState("OFFLINE");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ---- Backend writes with automatic state reconciliation on error.
  // The UI stays optimistic; if persistence fails, reconcileState resyncs from server.
  const reconcileState = useCallback(async () => {
    try {
      const loaded = await sourceRef.current.load();
      if (loaded) {
        setCentres(loaded.centres);
        setAppointments(loaded.appointments);
        setSmsOutbox(loaded.smsOutbox);
      }
    } catch (err) {
      console.error("[KisanSync] State reconciliation failed; showing cached/offline view", err);
      setUsingCachedData(true);
    }
  }, []);

  const persistBooking = useCallback(
    (appointment: Appointment, centreAfter: Centre, request: ProcurementRequest) => {
      void sourceRef.current
        .bookToken({ centreId: appointment.centreId, request, appointment, centreAfter })
        .catch((err) => {
          console.error("[KisanSync] bookToken persist failed; reconciling state", err);
          void reconcileState();
        });
    },
    [reconcileState],
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
        farmerName: input.farmerName?.trim() || DEMO_FARMER.name,
        centreId: centre.id,
        centreName: centre.name,
        crop: input.request.crop,
        quantityQuintals: input.request.quantityQuintals,
        village: input.farmerVillage?.trim() || input.request.village || DEMO_FARMER.village,
        arrivalWindow: input.arrivalWindow,
        bookedAt: new Date().toISOString(),
        status: "slot_booked",
        stageIndex: stageIndexForStatus("slot_booked"),
        estimatedAmountInr: appointmentAmount(
          input.modalPrice,
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
          crop: input.request.crop,
          quantityQuintals: input.request.quantityQuintals,
          farmerId: DEMO_FARMER.id,
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
          .catch((err) => {
            console.error("[KisanSync] cancelBooking persist failed; reconciling state", err);
            void reconcileState();
          });
        return updated;
      }),
    );
  }, [reconcileState]);

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
          crop: target.crop,
          quantityQuintals: target.quantityQuintals,
          farmerId: target.farmerId,
          stageKey: TRACKING_STAGES[stageIndexForStatus(status)]?.key,
          amountInr: target.estimatedAmountInr,
          paymentRef,
        }),
      ]);

      void sourceRef.current
        .updateAppointmentStatus(updated)
        .catch((err) => {
          console.error("[KisanSync] status persist failed; reconciling state", err);
          void reconcileState();
        });
    },
    [appointments, reconcileState],
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
          crop: target.crop,
          quantityQuintals: target.quantityQuintals,
          farmerId: target.farmerId,
          stageKey: TRACKING_STAGES[stageIndexForStatus(next)]?.key,
          amountInr: target.estimatedAmountInr,
          paymentRef,
        }),
      ]);

      void sourceRef.current
        .updateAppointmentStatus(updated)
        .catch((err) => {
          console.error("[KisanSync] advance persist failed; reconciling state", err);
          void reconcileState();
        });
    },
    [appointments, reconcileState],
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
      .catch((err) => {
        console.error("[KisanSync] surgeQueue persist failed; reconciling state", err);
        void reconcileState();
      });
  }, [reconcileState]);

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
    void getQueuedRequests().then((reqs) => {
      for (const r of reqs) {
        void deleteQueuedRequest(r.requestId);
      }
      setQueuedRequests([]);
    });
    void sourceRef.current
      .resetDemoData({ centres: seed.centres, appointments: seed.appointments, smsOutbox: [] })
      .catch((err) => {
        console.error("[KisanSync] resetDemoData persist failed; reconciling state", err);
        void reconcileState();
      });
  }, [reconcileState]);

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
          .catch((err) => {
            console.error("[KisanSync] archive persist failed; reconciling state", err);
            void reconcileState();
          });
        return updated;
      }),
    );
  }, [reconcileState]);

  // ---- Offline Queue Management & Synchronisation ------------------------

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (isOffline) {
      return { succeeded: [], rejected: [], failed: [] };
    }

    setSyncState("SYNCING");

    try {
      const result = await processOfflineQueue({
        getCentres: () => stateRef.current.centres,
        getAppointments: () => stateRef.current.appointments,
        bookConfirmedToken: ({ requestId, centreId, request, arrivalWindow, modalPrice }) => {
          const currentCentres = stateRef.current.centres;
          const currentAppointments = stateRef.current.appointments;
          const centre =
            currentCentres.find((c) => c.id === centreId) || currentCentres[0];
          const token = nextTokenNumber(currentAppointments);
          const appointment: Appointment = {
            id: `apt-${token.toLowerCase()}-${requestId}`,
            tokenNumber: token,
            farmerId: DEMO_FARMER.id,
            farmerName: DEMO_FARMER.name,
            centreId: centre.id,
            centreName: centre.name,
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            village: DEMO_FARMER.village,
            arrivalWindow,
            bookedAt: new Date().toISOString(),
            status: "slot_booked",
            stageIndex: stageIndexForStatus("slot_booked"),
            estimatedAmountInr: appointmentAmount(
              modalPrice,
              request.quantityQuintals,
            ),
          };

          const centreAfter: Centre = {
            ...centre,
            bookedToday: centre.bookedToday + 1,
            queueCount: centre.queueCount + 1,
          };

          const newAppointments = [...currentAppointments, appointment];
          const newCentres = currentCentres.map((c) =>
            c.id === centre.id ? centreAfter : c,
          );
          const newSms = makeSms({
            kind: "booking",
            tokenNumber: token,
            centreName: centre.name,
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            farmerId: DEMO_FARMER.id,
            arrivalWindow,
          });

          // Update ref immediately so subsequent items in the loop see latest state
          stateRef.current = {
            centres: newCentres,
            appointments: newAppointments,
            smsOutbox: [...stateRef.current.smsOutbox, newSms],
          };

          setAppointments(newAppointments);
          setCentres(newCentres);
          setSmsOutbox((prev) => [...prev, newSms]);

          persistBooking(appointment, centreAfter, {
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            village: request.village,
            preferredTime: request.preferredTime,
          });

          return appointment;
        },
      });

      const updatedQueue = await getQueuedRequests();
      setQueuedRequests(updatedQueue);

      const now = Date.now();
      setLastKnownSyncTime(now);
      setSyncTimeState(now);

      if (result.succeeded.length > 0 || result.rejected.length > 0) {
        setSyncState("SYNCED");
        setTimeout(() => {
          setSyncState("ONLINE");
        }, 3500);
      } else {
        setSyncState("ONLINE");
      }

      return result;
    } catch (err) {
      console.error("[KisanSync] sync failed", err);
      setSyncState("ONLINE");
      return { succeeded: [], rejected: [], failed: [] };
    }
  }, [isOffline, persistBooking]);

  const saveOfflineBooking = useCallback(
    async (payload: {
      centreId?: string;
      centreName?: string;
      arrivalWindow?: string;
      request: ProcurementRequest;
      modalPrice?: number | null;
    }): Promise<QueuedOfflineRequest> => {
      const requestId = `req-off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const req: QueuedOfflineRequest = {
        requestId,
        operationType: "book_token",
        payload: {
          crop: payload.request.crop,
          quantityQuintals: payload.request.quantityQuintals,
          village: payload.request.village || DEMO_FARMER.village,
          preferredTime: payload.request.preferredTime,
          targetCentreId: payload.centreId,
          targetCentreName: payload.centreName,
          targetArrivalWindow: payload.arrivalWindow,
          modalPrice: payload.modalPrice,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      };

      await saveQueuedRequest(req);
      setQueuedRequests((prev) => [
        ...prev.filter((r) => r.requestId !== requestId),
        req,
      ]);
      return req;
    },
    [],
  );

  const cancelOfflineRequest = useCallback(async (requestId: string) => {
    await deleteQueuedRequest(requestId);
    setQueuedRequests((prev) => prev.filter((r) => r.requestId !== requestId));
  }, []);

  const retryOfflineRequest = useCallback(
    async (requestId: string) => {
      await updateQueuedRequest(requestId, {
        status: "PENDING_OFFLINE",
        retryCount: 0,
        rejectionReason: undefined,
        lastError: undefined,
      });
      setQueuedRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? {
                ...r,
                status: "PENDING_OFFLINE",
                retryCount: 0,
                rejectionReason: undefined,
                lastError: undefined,
              }
            : r,
        ),
      );
      if (!isOffline) {
        void triggerSync();
      }
    },
    [isOffline, triggerSync],
  );

  // Automatic sync whenever offline state returns to online
  useEffect(() => {
    if (!isOffline && hydrated) {
      void triggerSync();
    } else if (isOffline) {
      setSyncState("OFFLINE");
    }
  }, [isOffline, hydrated, triggerSync]);

  // ---- Offline demo toggle ------------------------------------------------

  const setOfflineDemo = useCallback((offline: boolean) => {
    setOfflineDemoState(offline);
    setUsingCachedData(offline);
    if (offline) {
      setSyncState("OFFLINE");
    }
  }, []);

  const currentSyncState: SyncState = isOffline ? "OFFLINE" : syncState;

  const value = useMemo(
    () => ({
      centres,
      appointments,
      smsOutbox,
      isOffline,
      usingCachedData,
      syncState: currentSyncState,
      queuedRequests,
      lastKnownSyncTime,
      saveOfflineBooking,
      cancelOfflineRequest,
      retryOfflineRequest,
      triggerSync,
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
      currentSyncState,
      queuedRequests,
      lastKnownSyncTime,
      saveOfflineBooking,
      cancelOfflineRequest,
      retryOfflineRequest,
      triggerSync,
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
