/**
 * KisanSync — Market Price Service
 *
 * Primary consumer interface for retrieving authoritative Government of India
 * market prices. Integrates seamlessly with the Next.js API route,
 * local cache, and offline subsystem.
 */

import type { Crop } from "@/lib/types";
import type { FetchMarketPriceParams, MarketPriceResult } from "./types";
import { getCachedMarketPrice, setCachedMarketPrice } from "./priceCache";
import { AGMARKNET_BENCHMARK_RECORDS } from "./agmarknetSnapshot";
import { matchMarketPrice } from "./marketMatcher";

export class MarketPriceService {
  /**
   * Fetches latest market price for a given crop and centre/region.
   */
  static async getMarketPrice(
    params: FetchMarketPriceParams,
    isOffline = false,
  ): Promise<MarketPriceResult> {
    const cached = getCachedMarketPrice(params.crop, params.centreId, isOffline);

    // If offline, check cache or local Agmarknet benchmark snapshot
    if (isOffline) {
      if (cached) return cached;

      const benchmark = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
        crop: params.crop,
        marketName: params.market || params.centreName,
        district: params.district,
        state: params.state || "Karnataka",
      });

      if (benchmark.status === "AVAILABLE" && benchmark.record) {
        return {
          ...benchmark,
          status: "STALE",
          source: "AGMARKNET",
          isFallback: true,
          message: `Last known market rate (Agmarknet Benchmark, ${benchmark.record.arrivalDate})`,
        };
      }

      return {
        status: "UNAVAILABLE",
        record: null,
        modalPrice: null,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        matchType: "UNAVAILABLE",
        isFallback: false,
        message: "Market price unavailable offline.",
        fetchedAt: Date.now(),
      };
    }

    // If cache is fresh, return immediately
    if (cached && cached.status === "AVAILABLE") {
      return cached;
    }

    // Online fetch via server-side secure gateway
    try {
      const url = new URL("/api/market-prices", typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      url.searchParams.set("crop", params.crop);
      if (params.market || params.centreName || params.location) {
        url.searchParams.set("market", params.market || params.centreName || params.location || "");
      }
      if (params.district) {
        url.searchParams.set("district", params.district);
      }
      if (params.state) {
        url.searchParams.set("state", params.state);
      }

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (cached) return cached;
        return {
          status: "UNAVAILABLE",
          record: null,
          modalPrice: null,
          priceUnit: "₹/Quintal",
          source: "DATA_GOV_IN",
          matchType: "UNAVAILABLE",
          isFallback: false,
          message: "Market price is currently unavailable. Please try again later.",
          fetchedAt: Date.now(),
        };
      }

      const result = (await res.json()) as MarketPriceResult;

      if ((result.status === "AVAILABLE" || result.status === "STALE") && result.modalPrice) {
        setCachedMarketPrice(params.crop, params.centreId, result);
      } else if (cached) {
        // If API returned unavailable but we had a cached price, return it as STALE
        return {
          ...cached,
          status: "STALE",
          message: cached.message || "Using previously verified market rate.",
        };
      }

      return result;
    } catch (err) {
      // Network drop or timeout — fallback to stale cache if present
      if (cached) {
        return {
          ...cached,
          status: "STALE",
        };
      }

      const benchmark = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
        crop: params.crop,
        marketName: params.market || params.centreName,
        district: params.district,
        state: params.state || "Karnataka",
      });

      if (benchmark.status === "AVAILABLE" && benchmark.record) {
        return {
          ...benchmark,
          status: "STALE",
          source: "AGMARKNET",
          isFallback: true,
          message: `Last known market rate (Agmarknet Benchmark, ${benchmark.record.arrivalDate})`,
        };
      }

      return {
        status: "UNAVAILABLE",
        record: null,
        modalPrice: null,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        matchType: "UNAVAILABLE",
        isFallback: false,
        message: "Market price is currently unavailable. Please try again later.",
        error: err instanceof Error ? err.message : "Network error",
        fetchedAt: Date.now(),
      };
    }
  }

  /**
   * Calculates the estimated farmer monetary value strictly as:
   * quantityQuintals × modalPrice.
   *
   * If modalPrice is null or unavailable, returns null (never fake or zero).
   */
  static calculateEstimatedValue(
    modalPrice: number | null | undefined,
    quantityQuintals: number,
  ): number | null {
    if (modalPrice === null || modalPrice === undefined || modalPrice <= 0) {
      return null;
    }
    if (!Number.isFinite(quantityQuintals) || quantityQuintals <= 0) {
      return null;
    }
    return Math.round(modalPrice * quantityQuintals);
  }
}

export const getMarketPrice = MarketPriceService.getMarketPrice.bind(MarketPriceService);
export const calculateEstimatedValue = MarketPriceService.calculateEstimatedValue.bind(MarketPriceService);

