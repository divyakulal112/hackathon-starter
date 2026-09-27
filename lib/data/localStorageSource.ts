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
  Location,
  SmsMessage,
} from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/constants";
import { LOCATIONS, MOCK_CENTRES } from "@/lib/mockData";
import { calculateHaversineDistanceKm } from "@/lib/geo";
import type { AppStateSnapshot, DataSource, DataSourceKind } from "./types";

interface StoredState {
  centres: Centre[];
  appointments: Appointment[];
  sms: SmsMessage[];
}

function readLocalState(): StoredState | null {
  try {
    let raw = window.localStorage.getItem(STORAGE_KEYS.demoState);
    if (!raw) {
      // Check legacy storage keys for seamless migration
      raw =
        window.localStorage.getItem("kisansync_shared_state") ||
        window.localStorage.getItem("kisansync_demo_state");
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (!Array.isArray(parsed.centres) || !Array.isArray(parsed.appointments)) {
      return null;
    }

    // Detect stale demo centres lacking geocoded coordinates or full national coverage
    const isStale =
      parsed.centres.length < MOCK_CENTRES.length ||
      parsed.centres.some(
        (c) => typeof c.latitude !== "number" || typeof c.longitude !== "number",
      );

    if (isStale) {
      const upgraded: StoredState = {
        centres: MOCK_CENTRES,
        appointments: parsed.appointments,
        sms: Array.isArray(parsed.sms) ? parsed.sms : [],
      };
      writeLocalState(upgraded);
      return upgraded;
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
    // Safely remove superseded legacy keys
    window.localStorage.removeItem("kisansync_shared_state");
    window.localStorage.removeItem("kisansync_cached_centres");
    window.localStorage.removeItem("kisansync_demo_state");
  } catch {
    // quota/blocked storage — demo continues in memory
  }
}

export const BROADCAST_CHANNEL_NAME = "kisansync_shared_channel";

export class LocalStorageSource implements DataSource {
  readonly kind: DataSourceKind = "local";
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(snapshot: AppStateSnapshot) => void>();

  constructor() {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (
            event.data &&
            Array.isArray(event.data.centres) &&
            Array.isArray(event.data.appointments)
          ) {
            const snapshot: AppStateSnapshot = {
              centres: event.data.centres,
              appointments: event.data.appointments,
              smsOutbox: Array.isArray(event.data.smsOutbox) ? event.data.smsOutbox : [],
            };
            this.listeners.forEach((fn) => {
              try {
                fn(snapshot);
              } catch (err) {
                console.error("[KisanSync] Broadcast listener error:", err);
              }
            });
          }
        };
      } catch {
        // Fallback to storage event if BroadcastChannel creation fails
      }
    }
  }

  private broadcast(snapshot: AppStateSnapshot): void {
    if (this.channel) {
      try {
        this.channel.postMessage({
          centres: snapshot.centres,
          appointments: snapshot.appointments,
          smsOutbox: snapshot.smsOutbox,
        });
      } catch {
        // BroadcastChannel failed, fallback to storage event
      }
    }
  }

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
    this.broadcast(snapshot);
  }

  subscribe(onChange: (snapshot: AppStateSnapshot) => void): () => void {
    this.listeners.add(onChange);

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
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("storage", onStorage);
    }

    return () => {
      this.listeners.delete(onChange);
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("storage", onStorage);
      }
    };
  }

  async searchLocations(query: string, limit: number = 10): Promise<Location[]> {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim().toLowerCase();
    const normalizedQuery = cleanQuery.replace(/[^a-z0-9]/g, "");

    return LOCATIONS.filter(
      (l) =>
        l.name.toLowerCase().includes(cleanQuery) ||
        l.normalizedName.includes(normalizedQuery) ||
        (l.district && l.district.toLowerCase().includes(cleanQuery)) ||
        (l.state && l.state.toLowerCase().includes(cleanQuery)),
    ).slice(0, limit);
  }

  async getLocationById(id: string): Promise<Location | null> {
    return LOCATIONS.find((l) => l.id === id) ?? null;
  }

  async getNearbyCentres(
    latitude: number,
    longitude: number,
    radiusKm: number = 75,
  ): Promise<Centre[]> {
    const local = await this.load();
    const allCentres = local?.centres ?? MOCK_CENTRES;
    return allCentres.filter((c) => {
      const d = calculateHaversineDistanceKm(latitude, longitude, c.latitude, c.longitude);
      return d <= radiusKm;
    });
  }

  async bookToken(payload: import("./types").BookTokenPayload): Promise<null> {
    const local = readLocalState() ?? {
      centres: MOCK_CENTRES,
      appointments: [],
      sms: [],
    };
    const updatedAppointments = [
      ...local.appointments.filter((a) => a.id !== payload.appointment.id),
      payload.appointment,
    ];
    const updatedCentres = local.centres.map((c) =>
      c.id === payload.centreId ? payload.centreAfter : c,
    );
    const updatedState: StoredState = {
      centres: updatedCentres,
      appointments: updatedAppointments,
      sms: local.sms,
    };
    writeLocalState(updatedState);
    this.broadcast({
      centres: updatedState.centres,
      appointments: updatedState.appointments,
      smsOutbox: updatedState.sms,
    });
    return null;
  }

  async updateAppointmentStatus(appointment: Appointment): Promise<void> {
    const local = readLocalState() ?? {
      centres: MOCK_CENTRES,
      appointments: [],
      sms: [],
    };
    const exists = local.appointments.some((a) => a.id === appointment.id);
    const updatedAppointments = exists
      ? local.appointments.map((a) => (a.id === appointment.id ? appointment : a))
      : [...local.appointments, appointment];

    const updatedState: StoredState = {
      ...local,
      appointments: updatedAppointments,
    };
    writeLocalState(updatedState);
    this.broadcast({
      centres: updatedState.centres,
      appointments: updatedState.appointments,
      smsOutbox: updatedState.sms,
    });
  }

  async surgeQueue(centreId: string, newQueueCount: number): Promise<void> {
    const local = readLocalState() ?? {
      centres: MOCK_CENTRES,
      appointments: [],
      sms: [],
    };
    const updatedCentres = local.centres.map((c) =>
      c.id === centreId ? { ...c, queueCount: newQueueCount } : c,
    );
    const updatedState: StoredState = {
      ...local,
      centres: updatedCentres,
    };
    writeLocalState(updatedState);
    this.broadcast({
      centres: updatedState.centres,
      appointments: updatedState.appointments,
      smsOutbox: updatedState.sms,
    });
  }

  async archiveAppointment(appointment: Appointment): Promise<void> {
    const local = readLocalState() ?? {
      centres: MOCK_CENTRES,
      appointments: [],
      sms: [],
    };
    const updatedAppointments = local.appointments.map((a) =>
      a.id === appointment.id ? { ...a, archived: true } : a,
    );
    const updatedState: StoredState = {
      ...local,
      appointments: updatedAppointments,
    };
    writeLocalState(updatedState);
    this.broadcast({
      centres: updatedState.centres,
      appointments: updatedState.appointments,
      smsOutbox: updatedState.sms,
    });
  }

  async resetDemoData(snapshot: AppStateSnapshot): Promise<void> {
    this.persist(snapshot);
  }
}
