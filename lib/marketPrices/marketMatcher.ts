/**
 * KisanSync — Market Matching & Fallback Hierarchy
 *
 * Implements a strict, documented fallback hierarchy:
 * 1. Exact market + commodity + latest date
 * 2. Same district + commodity + latest date
 * 3. Same state + commodity + latest date
 *
 * Note: Never substitutes minPrice or maxPrice for modalPrice.
 * If modalPrice is missing or empty, the record is marked unavailable.
 */

import type { Crop } from "@/lib/types";
import type {
  MarketMatchType,
  MarketPriceRecord,
  MarketPriceResult,
} from "./types";
import { matchesCommodity } from "./cropMapping";

export interface MatchCriteria {
  crop: Crop;
  marketName?: string;
  location?: string;
  district?: string;
  state?: string;
}

function cleanString(str?: string): string {
  return (str ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalizes price values safely.
 * Returns null if missing, zero, non-numeric, or NaN.
 */
export function parseNumericPrice(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  return num;
}

/**
 * Selects the best market price record based on the official hierarchy.
 */
export function matchMarketPrice(
  records: MarketPriceRecord[],
  criteria: MatchCriteria,
): MarketPriceResult {
  const now = Date.now();
  const defaultUnavailable: MarketPriceResult = {
    status: "UNAVAILABLE",
    record: null,
    modalPrice: null,
    priceUnit: "₹/Quintal",
    source: "DATA_GOV_IN",
    matchType: "UNAVAILABLE",
    isFallback: false,
    message: "Market price is currently unavailable. Please try again later.",
    fetchedAt: now,
  };

  if (!records || records.length === 0) {
    return defaultUnavailable;
  }

  // 1. Filter by matching commodity and valid modal price
  const candidateRecords = records.filter((r) => {
    if (!matchesCommodity(criteria.crop, r.commodity)) return false;
    return r.modalPrice !== null && r.modalPrice > 0;
  });

  if (candidateRecords.length === 0) {
    return defaultUnavailable;
  }

  const cleanTargetMarket = cleanString(criteria.marketName);
  const cleanTargetLocation = cleanString(criteria.location);
  const cleanTargetDistrict = cleanString(criteria.district);
  const cleanTargetState = cleanString(criteria.state);

  // Helper: sorts records latest arrival date first if available
  const sorted = [...candidateRecords].sort((a, b) => {
    // Arrival dates are typically "DD/MM/YYYY" or ISO
    return (b.arrivalDate || "").localeCompare(a.arrivalDate || "");
  });

  // Rank 1: Exact market match
  if (cleanTargetMarket || cleanTargetLocation) {
    const exactMatch = sorted.find((r) => {
      const recMarket = cleanString(r.market);
      return (
        (cleanTargetMarket && (recMarket.includes(cleanTargetMarket) || cleanTargetMarket.includes(recMarket))) ||
        (cleanTargetLocation && (recMarket.includes(cleanTargetLocation) || cleanTargetLocation.includes(recMarket)))
      );
    });

    if (exactMatch) {
      return {
        status: "AVAILABLE",
        record: exactMatch,
        modalPrice: exactMatch.modalPrice,
        priceUnit: exactMatch.priceUnit || "₹/Quintal",
        source: exactMatch.source || "DATA_GOV_IN",
        matchType: "EXACT_MARKET",
        matchedMarket: exactMatch.market,
        matchedCommodity: exactMatch.commodity,
        arrivalDate: exactMatch.arrivalDate,
        isFallback: false,
        fetchedAt: now,
      };
    }
  }

  // Rank 2: Same district fallback
  if (cleanTargetDistrict) {
    const districtMatch = sorted.find((r) => {
      const recDistrict = cleanString(r.district);
      return (
        recDistrict.includes(cleanTargetDistrict) ||
        cleanTargetDistrict.includes(recDistrict)
      );
    });

    if (districtMatch) {
      return {
        status: "AVAILABLE",
        record: districtMatch,
        modalPrice: districtMatch.modalPrice,
        priceUnit: districtMatch.priceUnit || "₹/Quintal",
        source: districtMatch.source || "DATA_GOV_IN",
        matchType: "DISTRICT_FALLBACK",
        matchedMarket: districtMatch.market,
        matchedCommodity: districtMatch.commodity,
        arrivalDate: districtMatch.arrivalDate,
        isFallback: true,
        message: `Price from ${districtMatch.market} (${districtMatch.district} District)`,
        fetchedAt: now,
      };
    }
  }

  // Rank 3: Same state fallback
  if (cleanTargetState) {
    const stateMatch = sorted.find((r) => {
      const recState = cleanString(r.state);
      return (
        recState.includes(cleanTargetState) ||
        cleanTargetState.includes(recState)
      );
    });

    if (stateMatch) {
      return {
        status: "AVAILABLE",
        record: stateMatch,
        modalPrice: stateMatch.modalPrice,
        priceUnit: stateMatch.priceUnit || "₹/Quintal",
        source: stateMatch.source || "DATA_GOV_IN",
        matchType: "STATE_FALLBACK",
        matchedMarket: stateMatch.market,
        matchedCommodity: stateMatch.commodity,
        arrivalDate: stateMatch.arrivalDate,
        isFallback: true,
        message: `Price from ${stateMatch.market} (${stateMatch.state})`,
        fetchedAt: now,
      };
    }
  }

  // No regional match found within state hierarchy
  return defaultUnavailable;
}
