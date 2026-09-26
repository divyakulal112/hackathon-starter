/**
 * KisanSync — Market Price Cache & Offline Storage Layer
 *
 * Implements a time-to-live (TTL) cache with persistent localStorage fallback.
 * Guarantees offline compatibility:
 * - When offline: retrieves last-known market price and badges it as STALE with
 *   its original arrival date.
 * - When no cached price exists offline: returns UNAVAILABLE ("Market price unavailable offline.").
 */

import type { Crop } from "@/lib/types";
import type { MarketPriceResult } from "./types";

const CACHE_STORAGE_KEY = "kisansync_market_prices_cache_v1";
const FRESH_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  result: MarketPriceResult;
  storedAt: number;
}

type CacheMap = Record<string, CacheEntry>;

let memoryCache: CacheMap = {};

function makeCacheKey(crop: Crop, centreId?: string): string {
  return `${crop}::${centreId || "generic"}`.toLowerCase();
}

function readStorage(): CacheMap {
  if (typeof window === "undefined" || !window.localStorage) {
    return memoryCache;
  }
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return memoryCache;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : memoryCache;
  } catch {
    return memoryCache;
  }
}

function writeStorage(map: CacheMap): void {
  memoryCache = map;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded
  }
}

export function getCachedMarketPrice(
  crop: Crop,
  centreId?: string,
  isOffline = false,
): MarketPriceResult | null {
  const key = makeCacheKey(crop, centreId);
  const cache = readStorage();
  const entry = cache[key];

  if (!entry) {
    if (isOffline) {
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
    return null;
  }

  const age = Date.now() - entry.storedAt;
  const isFresh = age < FRESH_TTL_MS;

  if (isOffline) {
    return {
      ...entry.result,
      status: "STALE",
      message: `Last known market rate (${entry.result.arrivalDate || "Previous Session"})`,
    };
  }

  if (entry.result.source === "AGMARKNET" && entry.result.isFallback) {
    return entry.result;
  }

  if (isFresh) {
    return {
      ...entry.result,
      status: "AVAILABLE",
    };
  }

  // Stale online cache — can be shown while background re-validating
  return {
    ...entry.result,
    status: "STALE",
    message: "Refreshing market data...",
  };
}

export function setCachedMarketPrice(
  crop: Crop,
  centreId: string | undefined,
  result: MarketPriceResult,
): void {
  // Only cache valid prices
  if (result.status === "UNAVAILABLE" || !result.modalPrice) return;

  const key = makeCacheKey(crop, centreId);
  const cache = readStorage();
  cache[key] = {
    result,
    storedAt: Date.now(),
  };
  writeStorage(cache);
}

export function clearMarketPriceCache(): void {
  memoryCache = {};
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  }
}
