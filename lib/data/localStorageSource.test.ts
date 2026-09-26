/**
 * Unit tests for LocalStorageSource — verifies the extracted persistence
 * logic behaves identically to the original in-context implementation:
 * same key, same blob shape, same cross-tab `storage`-event sync, and the
 * offline centre cache kept up to date.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageSource } from "./localStorageSource";
import { STORAGE_KEYS } from "@/lib/constants";
import { MOCK_APPOINTMENTS, MOCK_CENTRES } from "@/lib/mockData";
import type { Appointment, Centre, SmsMessage } from "@/lib/types";
import type { AppStateSnapshot } from "./types";

// ---------------------------------------------------------------------------
// Minimal DOM shims — Node has no window/localStorage; the source needs
// window.localStorage everywhere and window.add/removeEventListener in
// subscribe().
// ---------------------------------------------------------------------------

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

type StorageListener = (e: { key: string | null; newValue: string | null }) => void;

interface WindowStub {
  localStorage: MemoryStorage;
  addEventListener(type: string, fn: StorageListener): void;
  removeEventListener(type: string, fn: StorageListener): void;
  emitStorage(e: { key: string | null; newValue: string | null }): void;
}

function makeWindowStub(storageImpl: MemoryStorage): WindowStub {
  const listeners = new Map<string, Set<StorageListener>>();
  return {
    localStorage: storageImpl,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emitStorage(e) {
      listeners.get("storage")?.forEach((fn) => fn(e));
    },
  };
}

const storage = new MemoryStorage();
let windowStub: WindowStub;

beforeEach(() => {
  storage.clear();
  windowStub = makeWindowStub(storage);
  vi.stubGlobal("localStorage", storage);
  (globalThis as { window?: unknown }).window = windowStub;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { window?: unknown }).window;
});

function seedSnapshot(): AppStateSnapshot {
  return {
    centres: MOCK_CENTRES.map((c) => ({ ...c })),
    appointments: MOCK_APPOINTMENTS.map((a) => ({ ...a })),
    smsOutbox: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocalStorageSource.kind", () => {
  it("reports the local data kind", () => {
    expect(new LocalStorageSource().kind).toBe("local");
  });
});

describe("LocalStorageSource.load / persist", () => {
  it("returns null when nothing is persisted yet", async () => {
    const source = new LocalStorageSource();
    await expect(source.load()).resolves.toBeNull();
  });

  it("returns null (not a throw) when the stored blob is malformed", async () => {
    storage.setItem(STORAGE_KEYS.demoState, "{not json");
    const source = new LocalStorageSource();
    await expect(source.load()).resolves.toBeNull();
  });

  it("returns null when the blob lacks centres/appointments arrays", async () => {
    storage.setItem(STORAGE_KEYS.demoState, JSON.stringify({ sms: [] }));
    const source = new LocalStorageSource();
    await expect(source.load()).resolves.toBeNull();
  });

  it("persists to the shared demoState key and round-trips a snapshot", async () => {
    const source = new LocalStorageSource();
    const snapshot = seedSnapshot();

    source.persist(snapshot);

    expect(storage.getItem(STORAGE_KEYS.demoState)).toBeTruthy();
    const loaded = await source.load();
    expect(loaded).toEqual(snapshot);
  });

  it("keeps the offline centre cache in sync on every persist", () => {
    const source = new LocalStorageSource();
    const snapshot = seedSnapshot();

    source.persist(snapshot);

    const cached = JSON.parse(
      storage.getItem(STORAGE_KEYS.cachedCentres) ?? "[]",
    ) as Centre[];
    expect(cached).toEqual(snapshot.centres);
  });

  it("persists SMS inside the demoState blob (original blob shape)", () => {
    const source = new LocalStorageSource();
    const sms: SmsMessage[] = [
      {
        id: "sms-1",
        createdAt: 1727300000000,
        kind: "booking",
        tokenNumber: "KS-108",
        centreName: "Moodbidri APMC",
        arrivalWindow: "2:15 PM – 2:35 PM",
      },
    ];

    source.persist({ ...seedSnapshot(), smsOutbox: sms });

    const raw = JSON.parse(
      storage.getItem(STORAGE_KEYS.demoState) ?? "{}",
    ) as { sms?: SmsMessage[] };
    expect(raw.sms).toEqual(sms);
  });

  it("continues silently when storage quota is exceeded", () => {
    const failing = new MemoryStorage();
    failing.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
    vi.stubGlobal("localStorage", failing);
    (globalThis as { window?: unknown }).window = makeWindowStub(failing);

    const source = new LocalStorageSource();
    expect(() => source.persist(seedSnapshot())).not.toThrow();
  });
});

describe("LocalStorageSource.subscribe", () => {
  it("delivers a valid cross-tab update to the listener", () => {
    const source = new LocalStorageSource();
    const onChange = vi.fn();
    const unsubscribe = source.subscribe(onChange);

    const snapshot = seedSnapshot();
    windowStub.emitStorage({
      key: STORAGE_KEYS.demoState,
      newValue: JSON.stringify({
        centres: snapshot.centres,
        appointments: snapshot.appointments,
        sms: [],
      }),
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      centres: snapshot.centres,
      appointments: snapshot.appointments,
      smsOutbox: [],
    });

    unsubscribe();
  });

  it("ignores writes to other keys and malformed payloads", () => {
    const source = new LocalStorageSource();
    const onChange = vi.fn();
    const unsubscribe = source.subscribe(onChange);

    windowStub.emitStorage({ key: "kisansync_language", newValue: '"en"' });
    windowStub.emitStorage({
      key: STORAGE_KEYS.demoState,
      newValue: "{broken json",
    });
    windowStub.emitStorage({
      key: STORAGE_KEYS.demoState,
      newValue: JSON.stringify({ centres: "not-an-array" }),
    });

    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops listening after unsubscribe", () => {
    const source = new LocalStorageSource();
    const onChange = vi.fn();
    const unsubscribe = source.subscribe(onChange);

    unsubscribe();

    windowStub.emitStorage({
      key: STORAGE_KEYS.demoState,
      newValue: JSON.stringify({ centres: [], appointments: [], sms: [] }),
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("LocalStorageSource mutation methods", () => {
  it("mutation methods are no-ops — the provider owns optimistic state", async () => {
    const source = new LocalStorageSource();
    const appointment = MOCK_APPOINTMENTS[0] as Appointment;

    await expect(
      source.bookToken({
        centreId: "centre-moodbidri",
        request: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai, Moodbidri Taluk",
          preferredTime: "afternoon",
        },
        appointment,
        centreAfter: MOCK_CENTRES[0],
      }),
    ).resolves.toBeNull();
    await expect(
      source.updateAppointmentStatus(appointment),
    ).resolves.toBeUndefined();
    await expect(source.surgeQueue("centre-moodbidri", 5)).resolves.toBeUndefined();
    await expect(
      source.archiveAppointment(appointment),
    ).resolves.toBeUndefined();
    await expect(source.resetDemoData(seedSnapshot())).resolves.toBeUndefined();
  });
});
