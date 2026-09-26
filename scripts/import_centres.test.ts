import { describe, expect, it } from "vitest";
import {
  deduplicateCentres,
  generateCentresSqlUpsert,
  validateCentre,
  validateCentreCoordinates,
  VERIFIED_CENTRES,
} from "./import_centres";
import type { Centre } from "../lib/types";

describe("import_centres", () => {
  it("validates coordinates within India bounds", () => {
    expect(validateCentreCoordinates(28.6139, 77.209)).toBe(true);
    expect(validateCentreCoordinates(13.0697, 74.9983)).toBe(true);
    expect(validateCentreCoordinates(11.2588, 75.7804)).toBe(true);

    // Out of bounds / invalid
    expect(validateCentreCoordinates(0, 0)).toBe(false);
    expect(validateCentreCoordinates(95, 77)).toBe(false);
    expect(validateCentreCoordinates(NaN, 77)).toBe(false);
    expect(validateCentreCoordinates(28, Infinity)).toBe(false);
  });

  it("ensures all VERIFIED_CENTRES pass complete validation", () => {
    expect(VERIFIED_CENTRES.length).toBeGreaterThanOrEqual(45);

    for (const centre of VERIFIED_CENTRES) {
      const errors = validateCentre(centre);
      expect(errors, `Errors in ${centre.id}: ${errors.join(", ")}`).toEqual([]);
    }
  });

  it("ensures no duplicate centre IDs or external IDs exist in VERIFIED_CENTRES", () => {
    const ids = new Set<string>();
    const externalIds = new Set<string>();

    for (const centre of VERIFIED_CENTRES) {
      expect(ids.has(centre.id), `Duplicate ID: ${centre.id}`).toBe(false);
      ids.add(centre.id);

      if (centre.externalId) {
        expect(
          externalIds.has(centre.externalId),
          `Duplicate externalId: ${centre.externalId}`,
        ).toBe(false);
        externalIds.add(centre.externalId);
      }
    }

    const deduped = deduplicateCentres(VERIFIED_CENTRES);
    expect(deduped.length).toBe(VERIFIED_CENTRES.length);
  });

  it("generates valid SQL upsert statements", () => {
    const sql = generateCentresSqlUpsert(VERIFIED_CENTRES.slice(0, 3));
    expect(sql).toContain("insert into public.centres");
    expect(sql).toContain("on conflict (id) do update set");
    expect(sql).toContain("centre-moodbidri");
    expect(sql).toContain("Moodbidri APMC Sub-Yard");
  });
});
