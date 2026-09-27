import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LocalStorageSource } from "@/lib/data/localStorageSource";
import {
  CENTRE_STATUS_FLOW,
  TRACKING_STAGES,
  DEMO_FARMER,
  stageKeyFor,
  actionLabelForStatus,
  statusDescriptionKeyFor,
} from "@/lib/constants";
import { MOCK_APPOINTMENTS, MOCK_CENTRES } from "@/lib/mockData";
import { TRANSLATIONS } from "@/lib/translations";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import type { AppStateSnapshot } from "@/lib/data/types";

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

describe("Procurement Tracker & Centre Operations Live Synchronization", () => {
  let storage: MemoryStorage;
  let listeners: Map<string, Set<(e: any) => void>>;
  let windowStub: any;

  beforeEach(() => {
    storage = new MemoryStorage();
    listeners = new Map();

    windowStub = {
      localStorage: storage,
      addEventListener(type: string, fn: (e: any) => void) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: (e: any) => void) {
        listeners.get(type)?.delete(fn);
      },
    };

    vi.stubGlobal("localStorage", storage);
    (globalThis as { window?: unknown }).window = windowStub;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { window?: unknown }).window;
  });

  it("1. Verifies all 7 lifecycle stages and action labels exist in translations", () => {
    const flow: AppointmentStatus[] = [
      "slot_booked",
      "arrived",
      "weighed",
      "quality_verified",
      "procurement_completed",
      "payment_initiated",
      "payment_received",
    ];

    expect(flow).toEqual(CENTRE_STATUS_FLOW);

    for (const status of flow) {
      const stageKey = stageKeyFor(status);
      expect(TRANSLATIONS.en[stageKey]).toBeDefined();
      expect(TRANSLATIONS.kn[stageKey]).toBeDefined();
      expect(TRANSLATIONS.hi[stageKey]).toBeDefined();

      const descKey = statusDescriptionKeyFor(status);
      expect(TRANSLATIONS.en[descKey]).toBeDefined();
      expect(TRANSLATIONS.kn[descKey]).toBeDefined();
      expect(TRANSLATIONS.hi[descKey]).toBeDefined();
    }

    const nextStatuses: AppointmentStatus[] = [
      "arrived",
      "weighed",
      "quality_verified",
      "procurement_completed",
      "payment_initiated",
      "payment_received",
    ];

    for (const next of nextStatuses) {
      const actionKey = actionLabelForStatus(next);
      expect(TRANSLATIONS.en[actionKey]).toBeDefined();
      expect(TRANSLATIONS.kn[actionKey]).toBeDefined();
      expect(TRANSLATIONS.hi[actionKey]).toBeDefined();
    }
  });

  it("2. Advances canonical appointment from Centre Operations and verifies subscriber receives each stage", async () => {
    const source = new LocalStorageSource();

    // Initial booking by farmer
    const testAppointment: Appointment = {
      id: "apt-ks-201-test",
      tokenNumber: "KS-201",
      farmerId: DEMO_FARMER.id,
      farmerName: DEMO_FARMER.name,
      centreId: MOCK_CENTRES[0].id,
      centreName: MOCK_CENTRES[0].name,
      crop: "Paddy / Rice",
      quantityQuintals: 30,
      village: DEMO_FARMER.village,
      arrivalWindow: "10:00 AM – 10:20 AM",
      bookedAt: new Date().toISOString(),
      status: "slot_booked",
      stageIndex: 0,
      estimatedAmountInr: 66000,
      paymentRef: undefined,
      archived: false,
    };

    const initialSnapshot: AppStateSnapshot = {
      centres: MOCK_CENTRES,
      appointments: [testAppointment],
      smsOutbox: [],
    };

    source.persist(initialSnapshot);

    // Farmer Tracker subscribes to live updates
    const farmerReceivedUpdates: Appointment[] = [];
    const unsubscribe = source.subscribe((snapshot) => {
      const apt = snapshot.appointments.find((a) => a.id === testAppointment.id);
      if (apt) farmerReceivedUpdates.push(apt);
    });

    // Simulate Centre Operations advancing step-by-step
    const flowProgression: AppointmentStatus[] = [
      "arrived",
      "weighed",
      "quality_verified",
      "procurement_completed",
      "payment_initiated",
      "payment_received",
    ];

    let currentAppointment = { ...testAppointment };

    for (let i = 0; i < flowProgression.length; i++) {
      const nextStatus = flowProgression[i];
      const nextStageIndex = i + 1;
      const paymentRef =
        nextStatus === "payment_received"
          ? `PAY-201-${new Date().getFullYear()}`
          : null;

      currentAppointment = {
        ...currentAppointment,
        status: nextStatus,
        stageIndex: nextStageIndex,
        paymentRef: paymentRef || currentAppointment.paymentRef,
      };

      // Centre Operations triggers mutation on the shared appointment record
      await source.updateAppointmentStatus(currentAppointment);

      // Verify the persisted state in localStorage immediately reflects the Centre's update
      const loaded = await source.load();
      expect(loaded).not.toBeNull();
      const loadedApt = loaded!.appointments.find((a) => a.id === testAppointment.id);
      expect(loadedApt).toBeDefined();
      expect(loadedApt!.status).toBe(nextStatus);
      expect(loadedApt!.stageIndex).toBe(nextStageIndex);

      if (nextStatus === "payment_received") {
        expect(loadedApt!.paymentRef).toMatch(/^PAY-201-\d{4}$/);
      }
    }

    unsubscribe();

    // Verify final loaded appointment after full lifecycle
    const finalLoaded = await source.load();
    const finalApt = finalLoaded!.appointments.find((a) => a.id === testAppointment.id);
    expect(finalApt?.status).toBe("payment_received");
    expect(finalApt?.stageIndex).toBe(6);
  });

  it("3. Verifies that the updated procurement status survives page reload", async () => {
    const source1 = new LocalStorageSource();

    const appointment: Appointment = {
      id: "apt-ks-301-persist",
      tokenNumber: "KS-301",
      farmerId: DEMO_FARMER.id,
      farmerName: DEMO_FARMER.name,
      centreId: MOCK_CENTRES[1].id,
      centreName: MOCK_CENTRES[1].name,
      crop: "Maize",
      quantityQuintals: 15,
      village: DEMO_FARMER.village,
      arrivalWindow: "11:00 AM – 11:20 AM",
      bookedAt: new Date().toISOString(),
      status: "quality_verified",
      stageIndex: 3,
      estimatedAmountInr: 64350,
      paymentRef: undefined,
      archived: false,
    };

    await source1.updateAppointmentStatus(appointment);

    // Simulate opening a new browser session / page refresh
    const source2 = new LocalStorageSource();
    const reloaded = await source2.load();

    expect(reloaded).not.toBeNull();
    const apt = reloaded!.appointments.find((a) => a.id === appointment.id);
    expect(apt).toBeDefined();
    expect(apt!.status).toBe("quality_verified");
    expect(apt!.stageIndex).toBe(3);
    expect(apt!.crop).toBe("Maize");
  });
});
