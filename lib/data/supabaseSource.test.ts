/**
 * Unit tests for the SupabaseDataSource row mappers — the camelCase (TS
 * domain) ↔ snake_case (Postgres) boundary of the DataSource seam.
 *
 * These mappers are the single point where a silent shape bug would corrupt
 * demo state, so each is tested for exact round-trip fidelity.
 */

import { describe, expect, it } from "vitest";
import {
  appointmentToRow,
  centreToRow,
  rowToAppointment,
  rowToCentre,
  type AppointmentRow,
  type CentreRow,
} from "./supabaseSource";
import type { Appointment, Centre } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures — one Centre and one Appointment covering optional-field edges.
// ---------------------------------------------------------------------------

const centreFixture: Centre = {
  id: "centre-moodbidri",
  name: "Moodbidri APMC",
  latitude: 13.0697,
  longitude: 74.9983,
  distanceKm: 8,
  queueCount: 14,
  processingRatePerHour: 6,
  capacityPerDay: 100,
  bookedToday: 68,
  eligibleCrops: ["Paddy / Rice", "Maize", "Coconut"],
  location: "Moodbidri",
  opensAt: "08:00",
  closesAt: "19:00",
};

const appointmentFixture: Appointment = {
  id: "apt-ks-108-1727300000000",
  tokenNumber: "KS-108",
  farmerId: "farmer-ramesh",
  farmerName: "Ramesh Gowda",
  centreId: "centre-moodbidri",
  centreName: "Moodbidri APMC",
  crop: "Paddy / Rice",
  quantityQuintals: 15,
  village: "Belvai, Moodbidri Taluk",
  arrivalWindow: "2:15 PM – 2:35 PM",
  bookedAt: "2026-09-26T10:00:00.000Z",
  status: "slot_booked",
  stageIndex: 0,
  estimatedAmountInr: 34500,
};

const fullAppointmentFixture: Appointment = {
  ...appointmentFixture,
  paymentRef: "PAY-108-2026",
  archived: true,
  status: "payment_received",
  stageIndex: 6,
};

// ---------------------------------------------------------------------------
// Centre mappers
// ---------------------------------------------------------------------------

describe("rowToCentre", () => {
  it("maps every snake_case column to its camelCase field", () => {
    const row: CentreRow = {
      id: "centre-moodbidri",
      name: "Moodbidri APMC",
      location: "Moodbidri",
      latitude: 13.0697,
      longitude: 74.9983,
      distance_km: 8,
      queue_count: 14,
      booked_today: 68,
      capacity_per_day: 100,
      processing_rate_per_hour: 6,
      eligible_crops: ["Paddy / Rice", "Maize", "Coconut"],
      opens_at: "08:00",
      closes_at: "19:00",
    };

    expect(rowToCentre(row)).toEqual(centreFixture);
  });

  it("trims Postgres time 'HH:mm:ss' to the 'HH:mm' the engine expects", () => {
    const row: CentreRow = {
      ...centreToRow(centreFixture),
      opens_at: "08:00:00",
      closes_at: "19:00:00",
    };

    const centre = rowToCentre(row);
    expect(centre.opensAt).toBe("08:00");
    expect(centre.closesAt).toBe("19:00");
  });

  it("leaves already-trimmed 'HH:mm' values untouched", () => {
    const centre = rowToCentre(centreToRow(centreFixture));
    expect(centre.opensAt).toBe("08:00");
    expect(centre.closesAt).toBe("19:00");
  });

  it("coerces numeric Postgres values that arrive as strings", () => {
    const row = {
      ...centreToRow(centreFixture),
      distance_km: "8" as unknown as number,
      queue_count: "14" as unknown as number,
      processing_rate_per_hour: "6.5" as unknown as number,
    };

    const centre = rowToCentre(row);
    expect(centre.distanceKm).toBe(8);
    expect(centre.queueCount).toBe(14);
    expect(centre.processingRatePerHour).toBe(6.5);
  });

  it("defaults eligible_crops to an empty array when null", () => {
    const row = {
      ...centreToRow(centreFixture),
      eligible_crops: null as unknown as string[],
    };

    expect(rowToCentre(row).eligibleCrops).toEqual([]);
  });
});

describe("centreToRow", () => {
  it("maps every camelCase field to its snake_case column", () => {
    expect(centreToRow(centreFixture)).toEqual({
      id: "centre-moodbidri",
      name: "Moodbidri APMC",
      location: "Moodbidri",
      latitude: 13.0697,
      longitude: 74.9983,
      distance_km: 8,
      queue_count: 14,
      booked_today: 68,
      capacity_per_day: 100,
      processing_rate_per_hour: 6,
      eligible_crops: ["Paddy / Rice", "Maize", "Coconut"],
      opens_at: "08:00",
      closes_at: "19:00",
    });
  });
});

describe("centre mapper round-trip", () => {
  it("preserves a Centre exactly through row → domain → row", () => {
    const row = centreToRow(centreFixture);
    const domain = rowToCentre(row);
    expect(centreToRow(domain)).toEqual(row);
    expect(domain).toEqual(centreFixture);
  });
});

// ---------------------------------------------------------------------------
// Appointment mappers
// ---------------------------------------------------------------------------

describe("rowToAppointment", () => {
  it("maps every snake_case column to its camelCase field", () => {
    const row: AppointmentRow = appointmentToRow(appointmentFixture);
    expect(rowToAppointment(row)).toEqual(appointmentFixture);
  });

  it("omits paymentRef when payment_ref is null", () => {
    const row: AppointmentRow = {
      ...appointmentToRow(appointmentFixture),
      payment_ref: null,
    };

    const appointment = rowToAppointment(row);
    expect("paymentRef" in appointment).toBe(false);
  });

  it("keeps paymentRef when payment_ref is set", () => {
    const row: AppointmentRow = {
      ...appointmentToRow(appointmentFixture),
      payment_ref: "PAY-108-2026",
    };

    expect(rowToAppointment(row).paymentRef).toBe("PAY-108-2026");
  });

  it("omits archived when false but sets archived: true when the flag is set", () => {
    const plain = rowToAppointment({
      ...appointmentToRow(appointmentFixture),
      archived: false,
    });
    expect("archived" in plain).toBe(false);

    const archived = rowToAppointment({
      ...appointmentToRow(fullAppointmentFixture),
      archived: true,
    });
    expect(archived.archived).toBe(true);
  });

  it("coerces numeric Postgres values that arrive as strings", () => {
    const row = {
      ...appointmentToRow(appointmentFixture),
      quantity_quintals: "15" as unknown as number,
      estimated_amount_inr: "34500" as unknown as number,
      stage_index: "0" as unknown as number,
    };

    const appointment = rowToAppointment(row);
    expect(appointment.quantityQuintals).toBe(15);
    expect(appointment.estimatedAmountInr).toBe(34500);
    expect(appointment.stageIndex).toBe(0);
  });
});

describe("appointmentToRow", () => {
  it("maps optional fields to DB-friendly defaults (null / false)", () => {
    const row = appointmentToRow(appointmentFixture);
    expect(row.payment_ref).toBeNull();
    expect(row.archived).toBe(false);
  });

  it("carries paymentRef and archived through when present", () => {
    const row = appointmentToRow(fullAppointmentFixture);
    expect(row.payment_ref).toBe("PAY-108-2026");
    expect(row.archived).toBe(true);
    expect(row.status).toBe("payment_received");
    expect(row.stage_index).toBe(6);
  });
});

describe("appointment mapper round-trip", () => {
  it("preserves a minimal appointment through domain → row → domain", () => {
    const row = appointmentToRow(appointmentFixture);
    const domain = rowToAppointment(row);
    expect(domain).toEqual(appointmentFixture);
  });

  it("preserves an appointment with paymentRef and archived set", () => {
    const row = appointmentToRow(fullAppointmentFixture);
    expect(rowToAppointment(row)).toEqual(fullAppointmentFixture);
  });
});
