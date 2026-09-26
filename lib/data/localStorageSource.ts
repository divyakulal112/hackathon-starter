/**
 * KisanSync — localStorage DataSource (the original demo store).
 *
 * Extracted verbatim from context/AppStateContext.tsx so behavior in local
 * mode is byte-for-byte identical to the pre-migration demo: one JSON blob
 * under STORAGE_KEYS.demoState, mirrored to STORAGE_KEYS.cachedCentres for
 * the offline banner, cross-tab sync via the `storage` event.
 */

import type {
  Appointment,
  Centre,
  SmsMessage,
} from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/constants";
import type { AppStateSnapshot, DataSource, DataSourceKind } from "./types";

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

function writeLocalState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.demoState, JSON.stringify(state));
    window.localStorage.setItem(
      STORAGE_KEYS.cachedCentres,
      JSON.stringify(state.centres),
    );
  } catch {
    // quota/blocked storage — demo continues in memory
  }
}

export class LocalStorageSource implements DataSource {
  readonly kind: DataSourceKind = "local";

  async load(): Promise<AppStateSnapshot | null> {
    const local = readLocalState();
    if (!local) return null;
    return {
      centres: local.centres,
      appointments: local.appointments,
      smsOutbox: local.sms,
    };
  }

  persist(snapshot: AppStateSnapshot): void {
    writeLocalState({
      centres: snapshot.centres,
      appointments: snapshot.appointments,
      sms: snapshot.smsOutbox,
    });
  }

  subscribe(onChange: (snapshot: AppStateSnapshot) => void): () => void {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEYS.demoState || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<StoredState>;
        if (!Array.isArray(parsed.centres) || !Array.isArray(parsed.appointments)) {
          return;
        }
        onChange({
          centres: parsed.centres,
          appointments: parsed.appointments,
          smsOutbox: Array.isArray(parsed.sms) ? parsed.sms : [],
        });
      } catch {
        // ignore malformed payloads
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }

  // The provider already applies optimistic in-memory state before calling
  // persist(), so every mutation funnels through persist().
  async bookToken(): Promise<null> {
    return null;
  }

  async updateAppointmentStatus(): Promise<void> {}

  async surgeQueue(): Promise<void> {}

  async archiveAppointment(): Promise<void> {}

  async resetDemoData(): Promise<void> {}
}
