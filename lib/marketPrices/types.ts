/**
 * KisanSync — Market Price Domain Types
 * Defines the normalized contract for agricultural market price data
 * sourced from authoritative Government of India datasets (data.gov.in / Agmarknet).
 */

import type { Crop } from "@/lib/types";

export type PriceStatus = "AVAILABLE" | "STALE" | "UNAVAILABLE";

export type MarketMatchType =
  | "EXACT_MARKET"
  | "DISTRICT_FALLBACK"
  | "STATE_FALLBACK"
  | "UNAVAILABLE";

export type MarketPriceSource = "DATA_GOV_IN" | "AGMARKNET";

export interface MarketPriceRecord {
  commodity: string;
  variety?: string;
  grade?: string;
  state: string;
  district: string;
  market: string;
  arrivalDate: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  modalPrice: number | null;
  priceUnit: string;
  source: MarketPriceSource;
  fetchedAt: number;
}

export interface MarketPriceResult {
  status: PriceStatus;
  record: MarketPriceRecord | null;
  modalPrice: number | null;
  priceUnit: string;
  source: MarketPriceSource;
  matchType: MarketMatchType;
  matchedMarket?: string;
  matchedCommodity?: string;
  arrivalDate?: string;
  isFallback: boolean;
  message?: string;
  error?: string;
  fetchedAt: number;
}

export interface FetchMarketPriceParams {
  crop: Crop;
  centreId?: string;
  centreName?: string;
  market?: string;
  location?: string;
  district?: string;
  state?: string;
}
