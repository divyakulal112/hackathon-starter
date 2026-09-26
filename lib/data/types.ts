/**
 * KisanSync — data-source seam.
 *
 * This is the ONLY contract the app state layer knows about persistence.
 * Two implementations exist:
 *   - LocalStorageSource  (lib/data/localStorageSource.ts) — the original demo store.
 *   - SupabaseDataSource  (lib/data/supabaseSource.ts)     — real PostgreSQL backend.
 *
 * Rules of the seam:
 *   - The recommendation engine NEVER imports this module or Supabase; it keeps
 *     receiving plain Centre[] / ProcurementRequest data.
 *   - UI components keep consuming AppStateContext and never import Supabase.
 *   - All camelCase (TS) ↔ snake_case (Postgres) mapping lives behind this seam.
 *   - SMS stays client-local in BOTH modes (approved decision): the local source
 *     stores it inside the shared demoState key (today's behavior), the Supabase
 *     source stores it under its own localStorage key.
 */

import type { Appointment, Centre, ProcurementRequest, SmsMessage } from "@/lib/types";

export type DataSourceKind = "local" | "supabase";

/** Everything the app state layer holds, exactly as it holds it. */
export interface AppStateSnapshot {
  centres: Centre[];
  appointments: Appointment[];
  smsOutbox: SmsMessage[];
}

/** Everything needed to persist a booking end-to-end. */
export interface BookTokenPayload {
  centreId: string;
  request: ProcurementRequest;
  /** The fully-formed optimistic appointment (all denormalized display fields). */
  appointment: Appointment;
  /** The centre row AFTER the booking's +1 bookedToday / +1 queueCount. */
  centreAfter: Centre;
}

export interface DataSource {
  readonly kind: DataSourceKind;

  /**
   * Initial load. Returns null when nothing is persisted yet — the caller
   * then falls back to the seed data in lib/mockData.ts.
   * Throws on network failure (caller shows the offline/cached banner).
   */
  load(): Promise<AppStateSnapshot | null>;

  /** Persist the parts this source owns, called on every state change. */
  persist(snapshot: AppStateSnapshot): void;

  /**
   * Change feed from other tabs (local) or other devices (Supabase realtime).
   * Returns an unsubscribe function.
   */
  subscribe(onChange: (snapshot: AppStateSnapshot) => void): () => void;

  /**
   * Persist a new booking (farmer + request + appointment + centre counters).
   * Returns the canonical appointment as stored (ids may differ from the
   * optimistic one), or null when the source stores nothing extra.
   */
  bookToken(payload: BookTokenPayload): Promise<Appointment | null>;

  /** Persist a status/stage/payment change (receives the full updated row). */
  updateAppointmentStatus(appointment: Appointment): Promise<void>;

  /** Persist the new absolute live-queue count for a centre. */
  surgeQueue(centreId: string, newQueueCount: number): Promise<void>;

  /** Persist the archived flag (Start New Request). */
  archiveAppointment(appointment: Appointment): Promise<void>;

  /**
   * Restore the pristine seed snapshot. Supabase restores the DB rows;
   * local mode is a no-op (the caller re-seeds state from the constants).
   */
  resetDemoData(snapshot: AppStateSnapshot): Promise<void>;
}
