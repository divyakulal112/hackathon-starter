/**
 * KisanSync — Supabase DataSource (real PostgreSQL backend).
 *
 * Implements the DataSource seam against the tables in supabase/schema.sql.
 * All camelCase↔snake_case mapping lives here. SMS stays client-local
 * (approved decision) under its own localStorage key. Realtime subscriptions
 * replace cross-tab `storage` events so the two-window demo syncs across
 * devices when Supabase mode is active.
 */

import type {
  Appointment,
  AppointmentStatus,
  Centre,
} from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase";
import type { AppStateSnapshot, DataSource, DataSourceKind } from "./types";

// ---------------------------------------------------------------------------
// Row types (snake_case, mirroring supabase/schema.sql)
// ---------------------------------------------------------------------------

interface CentreRow {
  id: string;
  name: string;
  location: string;
  distance_km: number;
  queue_count: number;
  booked_today: number;
  capacity_per_day: number;
  processing_rate_per_hour: number;
  eligible_crops: string[];
  opens_at: string;
  closes_at: string;
}

interface AppointmentRow {
  id: string;
  token_number: string;
  farmer_id: string;
  farmer_name: string;
  centre_id: string;
  centre_name: string;
  crop: string;
  quantity_quintals: number;
  village: string;
  arrival_window: string;
  status: AppointmentStatus;
  stage_index: number;
  estimated_amount_inr: number;
  payment_ref: string | null;
  archived: boolean;
  booked_at: string;
}

interface FarmerRow {
  id: string;
  village: string;
}

interface RequestRow {
  id: string;
  farmer_id: string;
  crop: string;
  quantity_quintals: number;
  village: string;
  preferred_time: string;
}

// ---------------------------------------------------------------------------
// Mappers (camelCase TS model ↔ snake_case Postgres rows)
// ---------------------------------------------------------------------------

/** Postgres `time` arrives as "HH:mm:ss" — trim to "HH:mm" for the engine. */
function trimTime(value: string): string {
  return value.length > 5 ? value.slice(0, 5) : value;
}

function rowToCentre(row: CentreRow): Centre {
  return {
    id: row.id,
    name: row.name,
    distanceKm: Number(row.distance_km),
    queueCount: Number(row.queue_count),
    processingRatePerHour: Number(row.processing_rate_per_hour),
    capacityPerDay: Number(row.capacity_per_day),
    bookedToday: Number(row.booked_today),
    eligibleCrops: row.eligible_crops ?? [],
    location: row.location,
    opensAt: trimTime(row.opens_at),
    closesAt: trimTime(row.closes_at),
  };
}

function centreToRow(centre: Centre): CentreRow {
  return {
    id: centre.id,
    name: centre.name,
    location: centre.location,
    distance_km: centre.distanceKm,
    queue_count: centre.queueCount,
    booked_today: centre.bookedToday,
    capacity_per_day: centre.capacityPerDay,
    processing_rate_per_hour: centre.processingRatePerHour,
    eligible_crops: centre.eligibleCrops,
    opens_at: centre.opensAt,
    closes_at: centre.closesAt,
  };
}

function rowToAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    tokenNumber: row.token_number,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name,
    centreId: row.centre_id,
    centreName: row.centre_name,
    crop: row.crop as Appointment["crop"],
    quantityQuintals: Number(row.quantity_quintals),
    village: row.village,
    arrivalWindow: row.arrival_window,
    bookedAt: row.booked_at,
    status: row.status,
    stageIndex: Number(row.stage_index),
    estimatedAmountInr: Number(row.estimated_amount_inr),
    ...(row.payment_ref ? { paymentRef: row.payment_ref } : {}),
    ...(row.archived ? { archived: true } : {}),
  };
}

function appointmentToRow(a: Appointment): AppointmentRow {
  return {
    id: a.id,
    token_number: a.tokenNumber,
    farmer_id: a.farmerId,
    farmer_name: a.farmerName,
    centre_id: a.centreId,
    centre_name: a.centreName,
    crop: a.crop,
    quantity_quintals: a.quantityQuintals,
    village: a.village,
    arrival_window: a.arrivalWindow,
    status: a.status,
    stage_index: a.stageIndex,
    estimated_amount_inr: a.estimatedAmountInr,
    payment_ref: a.paymentRef ?? null,
    archived: a.archived ?? false,
    booked_at: a.bookedAt,
  };
}

// ---------------------------------------------------------------------------
// SMS outbox — client-local in both modes (approved decision)
// ---------------------------------------------------------------------------

function readSms(): import("@/lib/types").SmsMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.smsOutbox);
    return raw ? (JSON.parse(raw) as import("@/lib/types").SmsMessage[]) : [];
  } catch {
    return [];
  }
}

function writeSms(sms: import("@/lib/types").SmsMessage[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.smsOutbox, JSON.stringify(sms));
  } catch {
    // quota/blocked storage — SMS drawer degrades gracefully
  }
}

// ---------------------------------------------------------------------------
// SupabaseSource
// ---------------------------------------------------------------------------

const APPOINTMENT_COLUMNS =
  "id, token_number, farmer_id, farmer_name, centre_id, centre_name, crop, " +
  "quantity_quintals, village, arrival_window, status, stage_index, " +
  "estimated_amount_inr, payment_ref, archived, booked_at";

const CENTRE_COLUMNS =
  "id, name, location, distance_km, queue_count, booked_today, " +
  "capacity_per_day, processing_rate_per_hour, eligible_crops, opens_at, closes_at";

export class SupabaseSource implements DataSource {
  readonly kind: DataSourceKind = "supabase";

  async load(): Promise<AppStateSnapshot | null> {
    const db = getSupabase();
    if (!db) return null;

    const [centresRes, appointmentsRes] = await Promise.all([
      db.from("centres").select(CENTRE_COLUMNS).order("name"),
      db
        .from("appointments")
        .select(APPOINTMENT_COLUMNS)
        .order("booked_at", { ascending: true }),
    ]);

    if (centresRes.error) throw centresRes.error;
    if (appointmentsRes.error) throw appointmentsRes.error;

    return {
      // supabase-js without generated Database types returns untyped rows;
      // the row interfaces above are the single source of truth for shape.
      centres: (centresRes.data as unknown as CentreRow[]).map(rowToCentre),
      appointments: (appointmentsRes.data as unknown as AppointmentRow[]).map(
        rowToAppointment,
      ),
      smsOutbox: readSms(),
    };
  }

  persist(snapshot: AppStateSnapshot): void {
    // Supabase owns centres/appointments; only SMS is client-local.
    writeSms(snapshot.smsOutbox);
  }

  subscribe(onChange: (snapshot: AppStateSnapshot) => void): () => void {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const db = getSupabase();
    if (db) {
      const channel = db
        .channel("kisansync-state")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "centres" },
          () => void this.refetch(onChange),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments" },
          () => void this.refetch(onChange),
        )
        .subscribe();
      unsubscribe = () => {
        void db.removeChannel(channel);
      };
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }

  private async refetch(onChange: (snapshot: AppStateSnapshot) => void): Promise<void> {
    try {
      const snapshot = await this.load();
      if (snapshot) onChange(snapshot);
    } catch {
      // transient network error — next realtime event or mutation retries
    }
  }

  async bookToken(payload: import("./types").BookTokenPayload): Promise<Appointment | null> {
    const db = getSupabase();
    if (!db) return null;
    const a = payload.appointment;

    // 1. Demo farmer (upsert by id so repeat bookings stay idempotent).
    const farmerRow: FarmerRow = { id: a.farmerId, village: a.village };
    const { error: farmerErr } = await db
      .from("farmers")
      .upsert(farmerRow, { onConflict: "id" });
    if (farmerErr) throw farmerErr;

    // 2. Procurement request (kept for the backend trail).
    const requestRow: RequestRow = {
      id: crypto.randomUUID(),
      farmer_id: a.farmerId,
      crop: a.crop,
      quantity_quintals: a.quantityQuintals,
      village: a.village,
      preferred_time: payload.request.preferredTime,
    };
    const { error: requestErr } = await db
      .from("procurement_requests")
      .insert(requestRow);
    if (requestErr) throw requestErr;

    // 3. Appointment row (denormalized display columns, per approved plan).
    const { error: apptErr } = await db
      .from("appointments")
      .insert(appointmentToRow(a));
    if (apptErr) throw apptErr;

    // 4. Initial procurement_status event (status history).
    const { error: statusErr } = await db
      .from("procurement_status")
      .insert({ appointment_id: a.id, status: a.status });
    if (statusErr) throw statusErr;

    // 5. Centre counters (+1 bookedToday, +1 queueCount).
    const { error: centreErr } = await db
      .from("centres")
      .update(centreToRow(payload.centreAfter))
    // full-row update keeps the mapper single-sourced; RLS demo policies allow it
      .eq("id", payload.centreId);
    if (centreErr) throw centreErr;

    return null;
  }

  async updateAppointmentStatus(appointment: Appointment): Promise<void> {
    const db = getSupabase();
    if (!db) return;
    const row = appointmentToRow(appointment);

    const { error: apptErr } = await db
      .from("appointments")
      .update({
        status: row.status,
        stage_index: row.stage_index,
        payment_ref: row.payment_ref,
      })
      .eq("id", appointment.id);
    if (apptErr) throw apptErr;

    const { error: statusErr } = await db
      .from("procurement_status")
      .insert({ appointment_id: appointment.id, status: appointment.status });
    if (statusErr) throw statusErr;

    if (appointment.status === "payment_received" && appointment.paymentRef) {
      const { error: payErr } = await db.from("payments").insert({
        appointment_id: appointment.id,
        amount_inr: appointment.estimatedAmountInr,
        payment_ref: appointment.paymentRef,
        paid_at: new Date().toISOString(),
      });
      if (payErr) throw payErr;
    }
  }

  async surgeQueue(centreId: string, newQueueCount: number): Promise<void> {
    const db = getSupabase();
    if (!db) return;
    const { error } = await db
      .from("centres")
      .update({ queue_count: newQueueCount })
      .eq("id", centreId);
    if (error) throw error;
  }

  async archiveAppointment(appointment: Appointment): Promise<void> {
    const db = getSupabase();
    if (!db) return;
    const { error } = await db
      .from("appointments")
      .update({ archived: true })
      .eq("id", appointment.id);
    if (error) throw error;
  }

  async resetDemoData(snapshot: AppStateSnapshot): Promise<void> {
    const db = getSupabase();
    if (!db) return;

    // Delete children first (no ON DELETE CASCADE from appointments to these
    // via farmer_id; procurement_status and payments do cascade).
    const { error: apptErr } = await db.from("appointments").delete().neq("id", "");
    if (apptErr) throw apptErr;

    const { error: reqErr } = await db.from("procurement_requests").delete().neq("id", "");
    if (reqErr) throw reqErr;

    const { error: farmerErr } = await db.from("farmers").delete().neq("id", "");
    if (farmerErr) throw farmerErr;

    // Re-seed centres + appointments from the pristine constants.
    const centreRows = snapshot.centres.map(centreToRow);
    const { error: centreErr } = await db
      .from("centres")
      .upsert(centreRows, { onConflict: "id" });
    if (centreErr) throw centreErr;

    const apptRows = snapshot.appointments.map(appointmentToRow);
    if (apptRows.length > 0) {
      const { error: seedErr } = await db.from("appointments").insert(apptRows);
      if (seedErr) throw seedErr;
      const { error: seedStatusErr } = await db
        .from("procurement_status")
        .insert(
          apptRows.map((r) => ({ appointment_id: r.id, status: r.status })),
        );
      if (seedStatusErr) throw seedStatusErr;
    }
  }
}
