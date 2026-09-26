import { describe, expect, it } from "vitest";
import { calculateCentreRecommendation } from "./recommendationEngine";
import { LOCATIONS, MOCK_CENTRES } from "./mockData";
import { calculateHaversineDistanceKm, resolveLocation } from "./geo";
import { LocalStorageSource } from "./data/localStorageSource";
import type { Location, ProcurementRequest } from "./types";

describe("India-Wide Procurement Centres & Recommendation Engine", () => {
  const paddyRequest: ProcurementRequest = {
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    village: "",
    preferredTime: "morning",
  };

  const tomatoRequest: ProcurementRequest = {
    crop: "Tomato",
    quantityQuintals: 10,
    village: "",
    preferredTime: "afternoon",
  };

  // -------------------------------------------------------------------------
  // 1. DELHI (NCT of Delhi)
  // -------------------------------------------------------------------------
  it("evaluates Delhi farmer and recommends a statutory centre within 50 km", () => {
    const delhi = resolveLocation("Delhi", LOCATIONS);
    expect(delhi).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, delhi);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);
    expect(result.best!.score.totalScore).toBeGreaterThan(50);
    expect(result.best!.score.distanceScore).toBeGreaterThan(0);

    // Nearby evaluations should include Delhi facilities: Najafgarh, Azadpur, Narela, Ghazipur
    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-delhi-najafgarh");
    expect(nearbyIds).toContain("centre-delhi-azadpur");
    expect(nearbyIds).toContain("centre-delhi-narela");
    expect(nearbyIds).toContain("centre-delhi-ghazipur");
  });

  // -------------------------------------------------------------------------
  // 2. KOZHIKODE (Kerala)
  // -------------------------------------------------------------------------
  it("evaluates Kozhikode farmer and recommends a statutory centre within 50 km", () => {
    const kozhikode = resolveLocation("Kozhikode", LOCATIONS);
    expect(kozhikode).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, kozhikode);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    // Nearby centres should include Palayam (~1.2 km), Vengeri (~5.4 km), Koyilandy (~22 km), Thamarassery (~24 km)
    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-kozhikode-palayam");
    expect(nearbyIds).toContain("centre-kozhikode-vengeri");
    expect(nearbyIds).toContain("centre-kozhikode-koyilandy");
    expect(nearbyIds).toContain("centre-kozhikode-thamarassery");

    // Palayam should have distance under 5 km
    const palayam = result.nearbyEvaluations.find((e) => e.centre.id === "centre-kozhikode-palayam");
    expect(palayam).toBeDefined();
    expect(palayam!.centre.distanceKm).toBeLessThan(5);
  });

  // -------------------------------------------------------------------------
  // 3. BENGALURU (Karnataka)
  // -------------------------------------------------------------------------
  it("evaluates Bengaluru farmer and recommends a statutory centre within 50 km", () => {
    const bengaluru = resolveLocation("Bengaluru", LOCATIONS);
    expect(bengaluru).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, bengaluru);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-bengaluru");
    expect(nearbyIds).toContain("centre-bengaluru-chamarajpet");
    expect(nearbyIds).toContain("centre-bengaluru-dasanapura");
    expect(nearbyIds).toContain("centre-bengaluru-hoskote");
  });

  // -------------------------------------------------------------------------
  // 4. MANGALURU (Dakshina Kannada)
  // -------------------------------------------------------------------------
  it("evaluates Mangaluru farmer and recommends a statutory centre within 50 km", () => {
    const mangaluru = resolveLocation("Mangaluru", LOCATIONS);
    expect(mangaluru).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, mangaluru);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-mangaluru");
    expect(nearbyIds).toContain("centre-bantwal");
    expect(nearbyIds).toContain("centre-moodbidri");
  });

  // -------------------------------------------------------------------------
  // 5. MOODBIDRI (Dakshina Kannada)
  // -------------------------------------------------------------------------
  it("evaluates Moodbidri farmer and recommends nearby centres within 50 km", () => {
    const moodbidri = resolveLocation("Moodbidri", LOCATIONS);
    expect(moodbidri).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, moodbidri);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-moodbidri");
    expect(nearbyIds).toContain("centre-belvai");
    expect(nearbyIds).toContain("centre-karkala");
  });

  // -------------------------------------------------------------------------
  // 6. KARKALA (Udupi)
  // -------------------------------------------------------------------------
  it("evaluates Karkala farmer and recommends nearby centres within 50 km", () => {
    const karkala = resolveLocation("Karkala", LOCATIONS);
    expect(karkala).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, karkala);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-karkala");
    expect(nearbyIds).toContain("centre-belvai");
    expect(nearbyIds).toContain("centre-moodbidri");
    expect(nearbyIds).toContain("centre-udupi");
  });

  // -------------------------------------------------------------------------
  // 7. HYDERABAD (Telangana)
  // -------------------------------------------------------------------------
  it("evaluates Hyderabad farmer and recommends a statutory centre within 50 km", () => {
    const hyderabad = resolveLocation("Hyderabad", LOCATIONS);
    expect(hyderabad).not.toBeNull();

    const result = calculateCentreRecommendation(tomatoRequest, MOCK_CENTRES, hyderabad);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-hyderabad-malakpet");
    expect(nearbyIds).toContain("centre-hyderabad-gudimalkapur");
    expect(nearbyIds).toContain("centre-hyderabad-bowenpally");
    expect(nearbyIds).toContain("centre-hyderabad-gaddiannaram");
  });

  // -------------------------------------------------------------------------
  // 8. MUMBAI (Maharashtra)
  // -------------------------------------------------------------------------
  it("evaluates Mumbai farmer and recommends a statutory centre within 50 km", () => {
    const mumbai = resolveLocation("Mumbai", LOCATIONS);
    expect(mumbai).not.toBeNull();

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, mumbai);

    expect(result.locationSupported).toBe(true);
    expect(result.best).not.toBeNull();
    expect(result.best!.isWithinServiceRadius).toBe(true);
    expect(result.best!.centre.distanceKm).toBeLessThanOrEqual(50);

    const nearbyIds = result.nearbyEvaluations.map((e) => e.centre.id);
    expect(nearbyIds).toContain("centre-mumbai-vashi");
    expect(nearbyIds).toContain("centre-mumbai-kalyan");
    expect(nearbyIds).toContain("centre-mumbai-vasai");
  });

  // -------------------------------------------------------------------------
  // 9. REMOTE LOCATION (> 50 km from any centre)
  // -------------------------------------------------------------------------
  it("truthfully returns best: null when farmer is > 50 km from all centres", () => {
    const remoteLocation: Location = {
      id: "loc-remote-ladakh",
      name: "Leh",
      normalizedName: "leh",
      district: "Leh",
      state: "Ladakh",
      latitude: 34.1526,
      longitude: 77.5771,
    };

    const result = calculateCentreRecommendation(paddyRequest, MOCK_CENTRES, remoteLocation);

    expect(result.locationSupported).toBe(true);
    expect(result.best).toBeNull();
    expect(result.nearbyEvaluations).toHaveLength(0);
    expect(result.distantAlternatives.length).toBeGreaterThan(0);
    expect(result.noSuitableCentreReason).toContain(
      "No suitable procurement centre found within the available service area (50 km)",
    );
  });

  // -------------------------------------------------------------------------
  // 10. CANDIDATE FILTERING (getNearbyCentres)
  // -------------------------------------------------------------------------
  it("LocalStorageSource.getNearbyCentres retrieves candidates within requested radius", async () => {
    const source = new LocalStorageSource();

    // Delhi coordinates: 28.6139, 77.2090, 50 km radius
    const delhiCentres = await source.getNearbyCentres(28.6139, 77.209, 50);
    expect(delhiCentres.length).toBeGreaterThanOrEqual(4);
    const delhiIds = delhiCentres.map((c) => c.id);
    expect(delhiIds).toContain("centre-delhi-azadpur");
    expect(delhiIds).toContain("centre-delhi-narela");
    expect(delhiIds).toContain("centre-delhi-najafgarh");
    for (const c of delhiCentres) {
      const d = calculateHaversineDistanceKm(28.6139, 77.209, c.latitude, c.longitude);
      expect(d).toBeLessThanOrEqual(50);
    }

    // Kozhikode coordinates: 11.2588, 75.7804, 50 km radius
    const kzkCentres = await source.getNearbyCentres(11.2588, 75.7804, 50);
    expect(kzkCentres.length).toBeGreaterThanOrEqual(3);
    for (const c of kzkCentres) {
      expect(c.district).toBe("Kozhikode");
    }

    // Remote coordinates (Ladakh): should return empty
    const remoteCentres = await source.getNearbyCentres(34.1526, 77.5771, 50);
    expect(remoteCentres).toHaveLength(0);
  });
});
