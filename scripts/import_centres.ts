/**
 * KisanSync — India Statutory Procurement Centres Importer & Master Dataset
 * =========================================================================
 *
 * Dataset Sources & Licensing:
 * 1. e-NAM (National Agriculture Market):
 *    - Ministry of Agriculture and Farmers Welfare, Government of India.
 *    - National portal directory of integrated statutory APMC mandis (enam.gov.in).
 *    - Open Government Data (OGD) Platform India terms.
 *
 * 2. Agmarknet / Directorate of Marketing & Inspection (DMI):
 *    - Agricultural Produce Market Committees statutory directories (agmarknet.gov.in).
 *    - Data under Government of India Open Data principles.
 *
 * 3. State Agricultural Marketing Boards:
 *    - Karnataka State Agricultural Marketing Board (KSAMB)
 *    - Delhi Agricultural Marketing Board (DAMB)
 *    - Vegetable and Fruit Promotion Council Keralam (VFPCK) & Kerala Agri Marketing
 *    - Maharashtra State Agricultural Marketing Board (MSAMB)
 *    - Telangana State Agricultural Marketing Department
 *
 * 4. OpenStreetMap (OSM) & Wikimapia:
 *    - Facility physical footprints, gate coordinates, and address cross-verification.
 *    - Open Data Commons Open Database License (ODbL) by the OpenStreetMap Foundation.
 *
 * Operational Metrics Simulation:
 * Static government directories do not provide live vehicle queue lengths or hourly
 * weighment throughput. Realistic operational fields (capacityPerDay, processingRatePerHour,
 * queueCount, bookedToday) are deterministically assigned based on market yard scale (terminal
 * market, primary yard, sub-yard, collection hub) to support the Coordination Engine's wait-time
 * balancing and congestion simulation.
 */

import type { Centre } from "../lib/types";
import { VERIFIED_CENTRES } from "../lib/data/centresData";

export { VERIFIED_CENTRES };

/**
 * Validates whether coordinates are valid finite numbers within Indian geographical bounds.
 * India bounding box roughly: Lat 6°N - 38°N, Lon 68°E - 98°E.
 */
export function validateCentreCoordinates(lat?: number, lon?: number): boolean {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return false;
  }
  // Global WGS-84 sanity
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  // India geographic territorial sanity check
  return lat >= 6.0 && lat <= 38.0 && lon >= 68.0 && lon <= 98.5;
}

/**
 * Validates all required fields and business constraints of a Centre entity.
 * Returns a list of validation error messages (empty if valid).
 */
export function validateCentre(centre: Centre): string[] {
  const errors: string[] = [];

  if (!centre.id || centre.id.trim().length === 0) {
    errors.push("Centre id is required");
  }
  if (!centre.name || centre.name.trim().length === 0) {
    errors.push(`Centre ${centre.id}: name is required`);
  }
  if (!validateCentreCoordinates(centre.latitude, centre.longitude)) {
    errors.push(
      `Centre ${centre.id}: invalid coordinates (${centre.latitude}, ${centre.longitude})`,
    );
  }
  if (!centre.eligibleCrops || centre.eligibleCrops.length === 0) {
    errors.push(`Centre ${centre.id}: eligibleCrops cannot be empty`);
  }
  if (typeof centre.capacityPerDay !== "number" || centre.capacityPerDay <= 0) {
    errors.push(`Centre ${centre.id}: capacityPerDay must be greater than 0`);
  }
  if (
    typeof centre.processingRatePerHour !== "number" ||
    centre.processingRatePerHour <= 0
  ) {
    errors.push(`Centre ${centre.id}: processingRatePerHour must be greater than 0`);
  }
  if (typeof centre.queueCount !== "number" || centre.queueCount < 0) {
    errors.push(`Centre ${centre.id}: queueCount must be non-negative`);
  }
  if (typeof centre.bookedToday !== "number" || centre.bookedToday < 0) {
    errors.push(`Centre ${centre.id}: bookedToday must be non-negative`);
  }
  if (!centre.opensAt || !centre.closesAt) {
    errors.push(`Centre ${centre.id}: opensAt and closesAt times are required`);
  }

  return errors;
}

/**
 * Deduplicates an array of centres by primary id and externalId.
 */
export function deduplicateCentres(centres: Centre[]): Centre[] {
  const seenIds = new Set<string>();
  const seenExternalIds = new Set<string>();
  const result: Centre[] = [];

  for (const centre of centres) {
    if (seenIds.has(centre.id)) {
      continue;
    }
    if (centre.externalId && seenExternalIds.has(centre.externalId)) {
      continue;
    }
    seenIds.add(centre.id);
    if (centre.externalId) {
      seenExternalIds.add(centre.externalId);
    }
    result.push(centre);
  }

  return result;
}

/**
 * Generates an idempotent SQL upsert block for public.centres table.
 */
export function generateCentresSqlUpsert(centres: Centre[]): string {
  const rows = centres.map((c) => {
    const escName = c.name.replace(/'/g, "''");
    const escCanon = (c.canonicalName || c.name).replace(/'/g, "''");
    const escState = (c.state || "").replace(/'/g, "''");
    const escDist = (c.district || "").replace(/'/g, "''");
    const escSubdist = (c.subdistrict || "").replace(/'/g, "''");
    const escLoc = c.location.replace(/'/g, "''");
    const escSrc = (c.source || "enam").replace(/'/g, "''");
    const escExtId = c.externalId ? `'${c.externalId.replace(/'/g, "''")}'` : "null";
    const escType = (c.centreType || "apmc_mandi").replace(/'/g, "''");
    const escAddr = c.address ? `'${c.address.replace(/'/g, "''")}'` : "null";
    const cropsSql = `array[${c.eligibleCrops.map((cr) => `'${cr.replace(/'/g, "''")}'`).join(", ")}]`;
    const active = c.active !== false;

    return `  ('${c.id}', '${escName}', '${escCanon}', '${escState}', '${escDist}', '${escSubdist}', '${escLoc}', ${c.latitude}, ${c.longitude}, ${c.distanceKm}, '${escSrc}', ${escExtId}, '${escType}', ${escAddr}, ${c.capacityPerDay}, ${c.processingRatePerHour}, ${c.queueCount}, ${c.bookedToday}, ${cropsSql}, '${c.opensAt}', '${c.closesAt}', ${active})`;
  });

  return `-- Auto-generated by scripts/import_centres.ts
-- Master statutory procurement centre dataset: e-NAM, Agmarknet, State APMC Boards
insert into public.centres (
  id, name, canonical_name, state, district, subdistrict, location,
  latitude, longitude, distance_km, source, external_id, centre_type, address,
  capacity_per_day, processing_rate_per_hour, queue_count, booked_today,
  eligible_crops, opens_at, closes_at, active
) values
${rows.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  canonical_name = excluded.canonical_name,
  state = excluded.state,
  district = excluded.district,
  subdistrict = excluded.subdistrict,
  location = excluded.location,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  distance_km = excluded.distance_km,
  source = excluded.source,
  external_id = excluded.external_id,
  centre_type = excluded.centre_type,
  address = excluded.address,
  capacity_per_day = excluded.capacity_per_day,
  processing_rate_per_hour = excluded.processing_rate_per_hour,
  queue_count = excluded.queue_count,
  booked_today = excluded.booked_today,
  eligible_crops = excluded.eligible_crops,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  active = excluded.active;
`;
}

// Standalone CLI runner
if (
  process.argv[1]?.endsWith("import_centres.ts") ||
  process.argv[1]?.endsWith("import_centres")
) {
  const fs = await import("fs");
  const path = await import("path");

  console.log(`[import_centres] Processing ${VERIFIED_CENTRES.length} verified centres...`);
  const errors = VERIFIED_CENTRES.flatMap(validateCentre);
  if (errors.length > 0) {
    console.error("[import_centres] Validation errors found:", errors);
    process.exit(1);
  }
  console.log("[import_centres] All centres passed validation!");

  const seedPath = path.resolve(process.cwd(), "supabase/seed.sql");
  if (fs.existsSync(seedPath)) {
    const seedContent = fs.readFileSync(seedPath, "utf-8");
    const centresSql = generateCentresSqlUpsert(VERIFIED_CENTRES);

    const startTag = "-- Centres: same ids and values as MOCK_CENTRES with coordinates.";
    const endTag = "-- Seed appointments for the centre dashboard queue";

    const startIndex = seedContent.indexOf(startTag);
    const endIndex = seedContent.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1) {
      const newContent =
        seedContent.slice(0, startIndex) +
        centresSql +
        "\n" +
        seedContent.slice(endIndex);
      fs.writeFileSync(seedPath, newContent, "utf-8");
      console.log(
        `[import_centres] Successfully updated ${seedPath} with ${VERIFIED_CENTRES.length} centres.`,
      );
    }
  }
}
