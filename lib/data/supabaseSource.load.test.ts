/**
 * Integration-style tests for SupabaseSource.load() with a mocked Supabase
 * client — verifies the query shape and that Postgres rows come out as
 * canonical TS domain objects the engine/UI can consume directly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseSource, type AppointmentRow, type CentreRow } from "./supabaseSource";

const mockClient = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => mockClient.current,
}));

/** Minimal chainable query builder standing in for supabase-js. */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve({ data: result.data, error: result.error }).then(
        onFulfilled,
      );
    },
  };
  return builder;
}

function clientWithTables(tables: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((name: string) => makeQueryBuilder(tables[name] ?? { data: [], error: null })),
  };
}

const centreRows: CentreRow[] = [
  {
    id: "centre-belvai",
    name: "Belvai Agro Hub",
    location: "Belvai",
    latitude: 13.1114,
    longitude: 75.0022,
    distance_km: 4,
    queue_count: 21,
    booked_today: 36,
    capacity_per_day: 40,
    processing_rate_per_hour: 4,
    eligible_crops: ["Paddy / Rice", "Chilli"],
    opens_at: "09:00:00",
    closes_at: "17:00:00",
  },
  {
    id: "centre-karkala",
    name: "Karkala Co-op",
    location: "Karkala",
    latitude: 13.2167,
    longitude: 74.9972,
    distance_km: 18,
    queue_count: 4,
    booked_today: 22,
    capacity_per_day: 60,
    processing_rate_per_hour: 5,
    eligible_crops: ["Paddy / Rice", "Arecanut"],
    opens_at: "08:30",
    closes_at: "18:00",
  },
];

const appointmentRows: AppointmentRow[] = [
  {
    id: "apt-ks-101",
    token_number: "KS-101",
    farmer_id: "farmer-ks-101",
    farmer_name: "Lakshmi Rai",
    centre_id: "centre-moodbidri",
    centre_name: "Moodbidri APMC",
    crop: "Paddy / Rice",
    quantity_quintals: 12,
    village: "Moodbidri Taluk",
    arrival_window: "10:00 AM – 10:20 AM",
    status: "slot_booked",
    stage_index: 0,
    estimated_amount_inr: 27600,
    payment_ref: null,
    archived: false,
    booked_at: "2026-09-26T07:00:00.000Z",
  },
];

beforeEach(() => {
  mockClient.current = null;
  delete (globalThis as { window?: unknown }).window;
});

describe("SupabaseSource.load", () => {
  it("returns null when the Supabase client is unavailable", async () => {
    const source = new SupabaseSource();
    await expect(source.load()).resolves.toBeNull();
  });

  it("maps centres and appointments to domain objects and trims times", async () => {
    const db = clientWithTables({
      centres: { data: centreRows, error: null },
      appointments: { data: appointmentRows, error: null },
    });
    mockClient.current = db;

    const source = new SupabaseSource();
    const snapshot = await source.load();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.centres).toEqual([
      {
        id: "centre-belvai",
        name: "Belvai Agro Hub",
        latitude: 13.1114,
        longitude: 75.0022,
        distanceKm: 4,
        queueCount: 21,
        processingRatePerHour: 4,
        capacityPerDay: 40,
        bookedToday: 36,
        eligibleCrops: ["Paddy / Rice", "Chilli"],
        location: "Belvai",
        opensAt: "09:00",
        closesAt: "17:00",
      },
      {
        id: "centre-karkala",
        name: "Karkala Co-op",
        latitude: 13.2167,
        longitude: 74.9972,
        distanceKm: 18,
        queueCount: 4,
        processingRatePerHour: 5,
        capacityPerDay: 60,
        bookedToday: 22,
        eligibleCrops: ["Paddy / Rice", "Arecanut"],
        location: "Karkala",
        opensAt: "08:30",
        closesAt: "18:00",
      },
    ]);
    expect(snapshot!.appointments).toHaveLength(1);
    expect(snapshot!.appointments[0]).toMatchObject({
      id: "apt-ks-101",
      tokenNumber: "KS-101",
      farmerName: "Lakshmi Rai",
      status: "slot_booked",
      stageIndex: 0,
      estimatedAmountInr: 27600,
    });
    expect("paymentRef" in snapshot!.appointments[0]).toBe(false);
  });

  it("reads SMS from the client-local outbox key", async () => {
    const storage = new Map<string, string>([
      ["kisansync_sms_outbox", JSON.stringify([{ id: "sms-1" }])],
    ]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null });
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => storage.get(k) ?? null },
    };

    const db = clientWithTables({
      centres: { data: centreRows, error: null },
      appointments: { data: appointmentRows, error: null },
    });
    mockClient.current = db;

    const snapshot = await new SupabaseSource().load();
    expect(snapshot!.smsOutbox).toEqual([{ id: "sms-1" }]);

    vi.unstubAllGlobals();
    delete (globalThis as { window?: unknown }).window;
  });

  it("throws the query error so the provider can show the offline banner", async () => {
    const dbError = { message: "relation does not exist" };
    const db = clientWithTables({
      centres: { data: null, error: dbError },
      appointments: { data: [], error: null },
    });
    mockClient.current = db;

    const source = new SupabaseSource();
    await expect(source.load()).rejects.toBe(dbError);
  });
});
