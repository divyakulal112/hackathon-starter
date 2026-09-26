import { describe, expect, it } from "vitest";
import { calculateCentreRecommendation } from "./recommendationEngine";
import { LOCATIONS, MOCK_CENTRES } from "./mockData";
import { resolveLocation } from "./geo";
import type { Centre, Location, ProcurementRequest } from "./types";
import { RECOMMENDATION_CONFIG } from "./constants";

describe("Coordination Engine — Comprehensive Scenarios", () => {
  const defaultPaddyRequest: ProcurementRequest = {
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    village: "Moodbidri",
    preferredTime: "afternoon",
  };

  // -------------------------------------------------------------------------
  // TEST 1 — Kochi: Real coordinates, Service Radius, and Karkala NOT winning
  // -------------------------------------------------------------------------
  it("TEST 1: Evaluates Kochi correctly — recommends Kochi centre and prevents distant Karkala from winning", () => {
    const kochiLoc = resolveLocation("Kochi", LOCATIONS);
    expect(kochiLoc).not.toBeNull();
    expect(kochiLoc?.latitude).toBeCloseTo(9.9312, 3);
    expect(kochiLoc?.longitude).toBeCloseTo(76.2673, 3);

    const result = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, kochiLoc);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    // The winning centre MUST be the local Kochi centre, NOT Karkala (which is ~393 km away)
    expect(result.best?.centre.id).toBe("centre-kochi");
    expect(result.best?.centre.distanceKm).toBeLessThan(10);
    expect(result.best?.isWithinServiceRadius).toBe(true);

    // Karkala Co-op must be flagged as outside service radius
    const karkalaEval = result.evaluations.find((e) => e.centre.id === "centre-karkala");
    expect(karkalaEval).toBeDefined();
    expect(karkalaEval?.centre.distanceKm).toBeGreaterThan(350);
    expect(karkalaEval?.isWithinServiceRadius).toBe(false);
    expect(result.distantAlternatives.some((e) => e.centre.id === "centre-karkala")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 2 — Bengaluru: Evaluates Bengaluru area centre
  // -------------------------------------------------------------------------
  it("TEST 2: Evaluates Bengaluru correctly — recommends Bengaluru APMC", () => {
    const blrLoc = resolveLocation("Bengaluru", LOCATIONS);
    expect(blrLoc).not.toBeNull();

    const result = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, blrLoc);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best?.centre.id).toBe("centre-bengaluru");
    expect(result.best?.centre.distanceKm).toBeLessThan(15);
    expect(result.best?.isWithinServiceRadius).toBe(true);

    // Distant coastal centres should be in distantAlternatives
    expect(result.distantAlternatives.length).toBeGreaterThan(0);
    expect(result.distantAlternatives.every((e) => e.centre.distanceKm > RECOMMENDATION_CONFIG.serviceRadiusKm)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 3 — Moodbidri: Evaluates Moodbidri local cluster
  // -------------------------------------------------------------------------
  it("TEST 3: Evaluates Moodbidri correctly — Moodbidri cluster centres are within radius", () => {
    const loc = resolveLocation("Moodbidri", LOCATIONS);
    expect(loc).not.toBeNull();

    const result = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, loc);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    // Best centre is one of the coastal cluster centres (Moodbidri, Belvai, or Karkala)
    expect(["centre-moodbidri", "centre-karkala", "centre-belvai"]).toContain(result.best?.centre.id);
    expect(result.best?.isWithinServiceRadius).toBe(true);

    // Bengaluru and Kochi are outside service area for Moodbidri
    const blrEval = result.evaluations.find((e) => e.centre.id === "centre-bengaluru");
    expect(blrEval?.isWithinServiceRadius).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TEST 4 — Location changes live
  // -------------------------------------------------------------------------
  it("TEST 4: Recalculates dynamically as location changes from Kochi -> Bengaluru -> Moodbidri", () => {
    const kochiLoc = resolveLocation("Kochi", LOCATIONS);
    const blrLoc = resolveLocation("Bengaluru", LOCATIONS);
    const moodbidriLoc = resolveLocation("Moodbidri", LOCATIONS);

    const kochiRes = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, kochiLoc);
    expect(kochiRes.best?.centre.id).toBe("centre-kochi");

    const blrRes = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, blrLoc);
    expect(blrRes.best?.centre.id).toBe("centre-bengaluru");

    const moodbidriRes = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, moodbidriLoc);
    expect(["centre-moodbidri", "centre-karkala", "centre-belvai"]).toContain(moodbidriRes.best?.centre.id);
  });

  // -------------------------------------------------------------------------
  // TEST 5 — Crop changes
  // -------------------------------------------------------------------------
  it("TEST 5: Recalculates eligibility when crop changes", () => {
    const loc = resolveLocation("Belvai", LOCATIONS);
    expect(loc).not.toBeNull();

    // Request Tomato (Belvai Agro Hub accepts Tomato; Moodbidri APMC does not)
    const tomatoRequest: ProcurementRequest = {
      ...defaultPaddyRequest,
      crop: "Tomato",
    };

    const result = calculateCentreRecommendation(tomatoRequest, MOCK_CENTRES, loc);
    expect(result.best?.centre.id).toBe("centre-belvai");

    const moodbidriEval = result.evaluations.find((e) => e.centre.id === "centre-moodbidri");
    expect(moodbidriEval?.eligibility).toBe("ineligible");
    expect(moodbidriEval?.score.eligibilityScore).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 6 — Quantity changes
  // -------------------------------------------------------------------------
  it("TEST 6: Handles quantity changes without crashing", () => {
    const loc = resolveLocation("Moodbidri", LOCATIONS);
    const smallReq: ProcurementRequest = { ...defaultPaddyRequest, quantityQuintals: 4 };
    const largeReq: ProcurementRequest = { ...defaultPaddyRequest, quantityQuintals: 80 };

    const smallRes = calculateCentreRecommendation(smallReq, MOCK_CENTRES, loc);
    const largeRes = calculateCentreRecommendation(largeReq, MOCK_CENTRES, loc);

    expect(smallRes.best).not.toBeNull();
    expect(largeRes.best).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // TEST 7 — Queue changes affect wait time and score
  // -------------------------------------------------------------------------
  it("TEST 7: Queue surge increases wait time and lowers score", () => {
    const loc = resolveLocation("Moodbidri", LOCATIONS);

    const normalCentres = MOCK_CENTRES;
    const congestedCentres: Centre[] = MOCK_CENTRES.map((c) =>
      c.id === "centre-moodbidri" ? { ...c, queueCount: 50 } : c,
    );

    const normalRes = calculateCentreRecommendation(defaultPaddyRequest, normalCentres, loc);
    const congestedRes = calculateCentreRecommendation(defaultPaddyRequest, congestedCentres, loc);

    const normalMood = normalRes.evaluations.find((e) => e.centre.id === "centre-moodbidri")!;
    const congestedMood = congestedRes.evaluations.find((e) => e.centre.id === "centre-moodbidri")!;

    expect(congestedMood.estimatedWaitMinutes).toBeGreaterThan(normalMood.estimatedWaitMinutes);
    expect(congestedMood.score.queueScore).toBeLessThan(normalMood.score.queueScore);
  });

  // -------------------------------------------------------------------------
  // TEST 8 — Capacity changes
  // -------------------------------------------------------------------------
  it("TEST 8: Zero remaining capacity disqualifies centre from best recommendation", () => {
    const loc = resolveLocation("Moodbidri", LOCATIONS);

    const fullCentres: Centre[] = MOCK_CENTRES.map((c) =>
      c.id === "centre-moodbidri" ? { ...c, bookedToday: c.capacityPerDay } : c,
    );

    const result = calculateCentreRecommendation(defaultPaddyRequest, fullCentres, loc);
    const moodEval = result.evaluations.find((e) => e.centre.id === "centre-moodbidri")!;

    expect(moodEval.remainingCapacity).toBe(0);
    expect(result.best?.centre.id).not.toBe("centre-moodbidri");
  });

  // -------------------------------------------------------------------------
  // TEST 9 — No suitable centre within service radius
  // -------------------------------------------------------------------------
  it("TEST 9: Returns null best and clear message when location is outside all service radiuses", () => {
    const remoteLoc: Location = {
      id: "loc-remote-leh",
      name: "Leh",
      normalizedName: "leh",
      district: "Leh",
      state: "Ladakh",
      latitude: 34.1526,
      longitude: 77.5771,
    };

    const result = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, remoteLoc);

    expect(result.locationSupported).toBe(true);
    expect(result.best).toBeNull();
    expect(result.nearbyEvaluations).toHaveLength(0);
    expect(result.distantAlternatives.length).toBeGreaterThan(0);
    expect(result.noSuitableCentreReason).toContain("No suitable procurement centre found within the available service area");
  });

  // -------------------------------------------------------------------------
  // TEST 10 — Invalid data and graceful fallbacks
  // -------------------------------------------------------------------------
  it("TEST 10: Gracefully handles null location, invalid coords, zero rate, and empty dataset", () => {
    // Null location
    const nullLocRes = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, null);
    expect(nullLocRes.locationSupported).toBe(false);
    expect(nullLocRes.best).toBeNull();

    // Invalid coordinates
    const invalidLoc = {
      id: "loc-invalid",
      name: "BadCoords",
      normalizedName: "badcoords",
      latitude: 999, // Out of range [-90, 90]
      longitude: NaN,
    };
    const badCoordRes = calculateCentreRecommendation(defaultPaddyRequest, MOCK_CENTRES, invalidLoc);
    expect(badCoordRes.best).toBeNull();

    // Zero processing rate centre
    const zeroRateCentres: Centre[] = [
      {
        ...MOCK_CENTRES[0],
        processingRatePerHour: 0,
      },
    ];
    const zeroRateRes = calculateCentreRecommendation(defaultPaddyRequest, zeroRateCentres, resolveLocation("Moodbidri", LOCATIONS));
    expect(zeroRateRes.best).toBeNull(); // Cannot recommend centre that cannot process arrivals
    expect(zeroRateRes.evaluations[0].estimatedWaitMinutes).toBe(Infinity);

    // Empty centres array
    const emptyRes = calculateCentreRecommendation(defaultPaddyRequest, [], resolveLocation("Moodbidri", LOCATIONS));
    expect(emptyRes.best).toBeNull();
    expect(emptyRes.evaluations).toHaveLength(0);
  });
});
