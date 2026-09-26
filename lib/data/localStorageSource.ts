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

  // The provider already applies optimistic in-memory state before calling
  // persist(), so every mutation funnels through persist(). Parameters are
  // intentionally unused — they exist to satisfy the DataSource contract.
  async bookToken(_payload: import("./types").BookTokenPayload): Promise<null> {
    return null;
  }

  async updateAppointmentStatus(_appointment: Appointment): Promise<void> {}

  async surgeQueue(_centreId: string, _newQueueCount: number): Promise<void> {}

  async archiveAppointment(_appointment: Appointment): Promise<void> {}

  async resetDemoData(_snapshot: AppStateSnapshot): Promise<void> {}
}
