import { describe, it, expect, beforeEach } from "vitest";
import { matchesCommodity, getPrimaryCommodityName } from "./cropMapping";
import { matchMarketPrice, parseNumericPrice } from "./marketMatcher";
import {
  getCachedMarketPrice,
  setCachedMarketPrice,
  clearMarketPriceCache,
} from "./priceCache";
import { MarketPriceService } from "./marketPriceService";
import { AGMARKNET_BENCHMARK_RECORDS } from "./agmarknetSnapshot";
import type { MarketPriceRecord } from "./types";

describe("Market Price Layer (Government Mandi Data)", () => {
  beforeEach(() => {
    clearMarketPriceCache();
  });

  describe("1. Crop Name Normalization & Mapping", () => {
    it("maps internal crop names to official Agmarknet commodities", () => {
      expect(matchesCommodity("Paddy / Rice", "Paddy(Dhan)(Common)")).toBe(true);
      expect(matchesCommodity("Paddy / Rice", "Rice")).toBe(true);
      expect(matchesCommodity("Maize", "Maize")).toBe(true);
      expect(matchesCommodity("Arecanut", "Arecanut(Betelnut/Supari)")).toBe(true);
      expect(matchesCommodity("Groundnut", "Groundnut")).toBe(true);
      expect(matchesCommodity("Tomato", "Tomato")).toBe(true);
      expect(matchesCommodity("Potato", "Potato")).toBe(true);
    });

    it("does not match unrelated commodities", () => {
      expect(matchesCommodity("Paddy / Rice", "Wheat")).toBe(false);
      expect(matchesCommodity("Tomato", "Potato")).toBe(false);
      expect(matchesCommodity("Maize", "Cotton")).toBe(false);
    });

    it("provides valid primary commodity names for API filters", () => {
      expect(getPrimaryCommodityName("Paddy / Rice")).toBe("Paddy(Dhan)(Common)");
      expect(getPrimaryCommodityName("Arecanut")).toBe("Arecanut(Betelnut/Supari)");
      expect(getPrimaryCommodityName("Tomato")).toBe("Tomato");
    });
  });

  describe("2. Market Matching & Fallback Hierarchy", () => {
    const mockGovRecords: MarketPriceRecord[] = [
      {
        commodity: "Paddy(Dhan)(Common)",
        state: "Karnataka",
        district: "Dakshina Kannada",
        market: "Moodbidri",
        arrivalDate: "26/09/2026",
        minPrice: 2200,
        maxPrice: 2500,
        modalPrice: 2400,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        fetchedAt: Date.now(),
      },
      {
        commodity: "Paddy(Dhan)(Common)",
        state: "Karnataka",
        district: "Dakshina Kannada",
        market: "Mangalore",
        arrivalDate: "26/09/2026",
        minPrice: 2150,
        maxPrice: 2450,
        modalPrice: 2350,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        fetchedAt: Date.now(),
      },
      {
        commodity: "Paddy(Dhan)(Common)",
        state: "Karnataka",
        district: "Udupi",
        market: "Karkala",
        arrivalDate: "26/09/2026",
        minPrice: 2100,
        maxPrice: 2400,
        modalPrice: 2300,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        fetchedAt: Date.now(),
      },
      {
        commodity: "Tomato",
        state: "Karnataka",
        district: "Kolar",
        market: "Kolar",
        arrivalDate: "26/09/2026",
        minPrice: 1200,
        maxPrice: 1600,
        modalPrice: 1450,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        fetchedAt: Date.now(),
      },
    ];

    it("matches exact market when available", () => {
      const result = matchMarketPrice(mockGovRecords, {
        crop: "Paddy / Rice",
        marketName: "Moodbidri APMC Yard",
        district: "Dakshina Kannada",
        state: "Karnataka",
      });

      expect(result.status).toBe("AVAILABLE");
      expect(result.matchType).toBe("EXACT_MARKET");
      expect(result.matchedMarket).toBe("Moodbidri");
      expect(result.modalPrice).toBe(2400);
      expect(result.isFallback).toBe(false);
    });

    it("falls back to same district when exact market is not reporting", () => {
      const result = matchMarketPrice(mockGovRecords, {
        crop: "Paddy / Rice",
        marketName: "Bantwal APMC", // Bantwal is in Dakshina Kannada, but only Mangalore & Moodbidri are in records
        district: "Dakshina Kannada",
        state: "Karnataka",
      });

      expect(result.status).toBe("AVAILABLE");
      expect(result.matchType).toBe("DISTRICT_FALLBACK");
      expect(result.modalPrice).toBeDefined();
      expect(result.isFallback).toBe(true);
      expect(result.message).toContain("District");
    });

    it("falls back to same state when district has no reporting mandi", () => {
      const result = matchMarketPrice(mockGovRecords, {
        crop: "Tomato",
        marketName: "Moodbidri APMC",
        district: "Dakshina Kannada", // No tomato in Dakshina Kannada records, but Kolar (Karnataka) has it
        state: "Karnataka",
      });

      expect(result.status).toBe("AVAILABLE");
      expect(result.matchType).toBe("STATE_FALLBACK");
      expect(result.modalPrice).toBe(1450);
      expect(result.matchedMarket).toBe("Kolar");
      expect(result.isFallback).toBe(true);
      expect(result.message).toContain("Karnataka");
    });

    it("returns UNAVAILABLE if commodity is not found in state or anywhere", () => {
      const result = matchMarketPrice(mockGovRecords, {
        crop: "Coconut",
        marketName: "Moodbidri APMC",
        district: "Dakshina Kannada",
        state: "Karnataka",
      });

      expect(result.status).toBe("UNAVAILABLE");
      expect(result.modalPrice).toBeNull();
      expect(result.record).toBeNull();
      expect(result.message).toContain("currently unavailable");
    });
  });

  describe("3. Missing Modal Price & Numeric Parsing", () => {
    it("safely handles non-numeric and null values", () => {
      expect(parseNumericPrice("2500")).toBe(2500);
      expect(parseNumericPrice(2400)).toBe(2400);
      expect(parseNumericPrice("0")).toBeNull();
      expect(parseNumericPrice(0)).toBeNull();
      expect(parseNumericPrice("NA")).toBeNull();
      expect(parseNumericPrice(null)).toBeNull();
      expect(parseNumericPrice(undefined)).toBeNull();
    });

    it("does NOT substitute min_price or max_price when modal_price is missing", () => {
      const recordsWithoutModal: MarketPriceRecord[] = [
        {
          commodity: "Paddy(Dhan)(Common)",
          state: "Karnataka",
          district: "Dakshina Kannada",
          market: "Moodbidri",
          arrivalDate: "26/09/2026",
          minPrice: 2000,
          maxPrice: 3000,
          modalPrice: null, // Missing modal price!
          priceUnit: "₹/Quintal",
          source: "DATA_GOV_IN",
          fetchedAt: Date.now(),
        },
      ];

      const result = matchMarketPrice(recordsWithoutModal, {
        crop: "Paddy / Rice",
        marketName: "Moodbidri",
        district: "Dakshina Kannada",
        state: "Karnataka",
      });

      // Must be UNAVAILABLE, not 2000 or 3000!
      expect(result.status).toBe("UNAVAILABLE");
      expect(result.modalPrice).toBeNull();
    });
  });

  describe("4. Estimated Value Calculation (Quantity × Modal Price)", () => {
    it("calculates quantityQuintals × modalPrice correctly", () => {
      const value = MarketPriceService.calculateEstimatedValue(2500, 15);
      expect(value).toBe(37500);
    });

    it("returns null when modalPrice is null (never 0 or fake price)", () => {
      const value = MarketPriceService.calculateEstimatedValue(null, 15);
      expect(value).toBeNull();
    });

    it("returns null when modalPrice is undefined or zero", () => {
      expect(MarketPriceService.calculateEstimatedValue(undefined, 10)).toBeNull();
      expect(MarketPriceService.calculateEstimatedValue(0, 10)).toBeNull();
    });

    it("returns null when quantity is invalid", () => {
      expect(MarketPriceService.calculateEstimatedValue(2500, 0)).toBeNull();
      expect(MarketPriceService.calculateEstimatedValue(2500, -5)).toBeNull();
    });
  });

  describe("5. Offline-First Caching & Fallback", () => {
    it("retrieves previously cached market rate with STALE badge when offline", () => {
      const priceResult = {
        status: "AVAILABLE" as const,
        record: null,
        modalPrice: 2450,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN" as const,
        matchType: "EXACT_MARKET" as const,
        matchedMarket: "Moodbidri APMC",
        arrivalDate: "26/09/2026",
        isFallback: false,
        fetchedAt: Date.now(),
      };

      setCachedMarketPrice("Paddy / Rice", "centre-moodbidri", priceResult);

      const cachedWhenOffline = getCachedMarketPrice(
        "Paddy / Rice",
        "centre-moodbidri",
        true, // isOffline = true
      );

      expect(cachedWhenOffline).not.toBeNull();
      expect(cachedWhenOffline?.status).toBe("STALE");
      expect(cachedWhenOffline?.modalPrice).toBe(2450);
      expect(cachedWhenOffline?.message).toContain("Last known market rate");
    });

    it("returns UNAVAILABLE with offline notice when no price was ever cached", () => {
      const offlineUncached = getCachedMarketPrice(
        "Arecanut",
        "centre-unknown",
        true, // isOffline = true
      );

      expect(offlineUncached?.status).toBe("UNAVAILABLE");
      expect(offlineUncached?.modalPrice).toBeNull();
      expect(offlineUncached?.message).toBe("Market price unavailable offline.");
    });
  });

  describe("6. Agmarknet Official Benchmark Snapshot", () => {
    it("provides valid benchmark records for all 10 supported crops in primary region", () => {
      const supportedCrops: import("@/lib/types").Crop[] = [
        "Paddy / Rice",
        "Maize",
        "Coconut",
        "Arecanut",
        "Groundnut",
        "Chilli",
        "Tomato",
        "Potato",
        "Black Gram",
        "Green Gram",
      ];

      for (const crop of supportedCrops) {
        const result = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
          crop,
          marketName: "Moodbidri",
          district: "Dakshina Kannada",
          state: "Karnataka",
        });

        expect(result.status).toBe("AVAILABLE");
        expect(result.modalPrice).toBeGreaterThan(0);
        expect(result.source).toBe("AGMARKNET");
        expect(result.matchedMarket).toBeDefined();
      }
    });

    it("matches exact local mandi when available in benchmark snapshot", () => {
      const result = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
        crop: "Arecanut",
        marketName: "Karkala Co-op",
        district: "Udupi",
        state: "Karnataka",
      });

      expect(result.status).toBe("AVAILABLE");
      expect(result.modalPrice).toBe(44200);
      expect(result.matchedMarket).toBe("Karkala");
    });
  });
});

