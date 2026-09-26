import { describe, expect, it } from "vitest";
import { calculateHaversineDistanceKm, normalizeLocationName, resolveLocation } from "./geo";
import { LOCATIONS } from "./mockData";

describe("calculateHaversineDistanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(calculateHaversineDistanceKm(13.0697, 74.9983, 13.0697, 74.9983)).toBe(0);
  });

  it("calculates accurate distance between Belvai and Moodbidri (~4.6 km)", () => {
    const d = calculateHaversineDistanceKm(13.1114, 75.0022, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(4.4);
    expect(d).toBeLessThanOrEqual(5.0);
  });

  it("calculates accurate distance between Belvai and Karkala (~11.7 km)", () => {
    const d = calculateHaversineDistanceKm(13.1114, 75.0022, 13.2167, 74.9972);
    expect(d).toBeGreaterThanOrEqual(11.0);
    expect(d).toBeLessThanOrEqual(12.5);
  });

  it("calculates accurate distance between Mangaluru and Moodbidri (~23.5 km)", () => {
    const d = calculateHaversineDistanceKm(12.9141, 74.856, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(22.0);
    expect(d).toBeLessThanOrEqual(25.0);
  });

  it("calculates accurate distance between Bengaluru and Moodbidri (~281 km)", () => {
    const d = calculateHaversineDistanceKm(12.9716, 77.5946, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(275.0);
    expect(d).toBeLessThanOrEqual(290.0);
  });

  it("calculates accurate distance between Kozhikode and Moodbidri (~218 km)", () => {
    const d = calculateHaversineDistanceKm(11.2588, 75.7804, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(210.0);
    expect(d).toBeLessThanOrEqual(225.0);
  });
  it("calculates accurate distance between Hyderabad and Moodbidri (~600 km)", () => {
    const d = calculateHaversineDistanceKm(17.385, 78.4867, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(580.0);
    expect(d).toBeLessThanOrEqual(630.0);
  });

  it("calculates accurate distance between Delhi and Moodbidri (~1735 km)", () => {
    const d = calculateHaversineDistanceKm(28.6139, 77.209, 13.0697, 74.9983);
    expect(d).toBeGreaterThanOrEqual(1700.0);
    expect(d).toBeLessThanOrEqual(1800.0);
  });
});

describe("resolveLocation", () => {
  it("resolves exact matches case-insensitively", () => {
    const loc = resolveLocation("moodbidri", LOCATIONS);
    expect(loc).not.toBeNull();
    expect(loc!.name).toBe("Moodbidri");
    expect(loc!.district).toBe("Dakshina Kannada");
  });

  it("resolves locations with spaces and mixed case", () => {
    expect(resolveLocation("Bengaluru", LOCATIONS)?.name).toBe("Bengaluru");
    expect(resolveLocation("KOZHIKODE", LOCATIONS)?.name).toBe("Kozhikode");
    expect(resolveLocation("Mangaluru", LOCATIONS)?.name).toBe("Mangaluru");
    expect(resolveLocation("Hyderabad", LOCATIONS)?.name).toBe("Hyderabad");
    expect(resolveLocation("Delhi", LOCATIONS)?.name).toBe("Delhi");
    expect(resolveLocation("karkala", LOCATIONS)?.name).toBe("Karkala");
    expect(resolveLocation("Belvai", LOCATIONS)?.name).toBe("Belvai");
  });

  it("returns null for unknown locations", () => {
    expect(resolveLocation("Atlantis", LOCATIONS)).toBeNull();
    expect(resolveLocation("UnknownVillage123", LOCATIONS)).toBeNull();
    expect(resolveLocation("", LOCATIONS)).toBeNull();
  });
});

