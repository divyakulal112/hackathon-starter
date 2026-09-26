/**
 * KisanSync — Commodity & Crop Name Normalization Layer
 *
 * Maps KisanSync internal crop names to official Agmarknet / data.gov.in
 * commodity names. The mapping is data-driven, transparent, and avoids
 * matching unrelated commodities.
 */

import type { Crop } from "@/lib/types";

export interface CommodityMapping {
  /** Primary government commodity name used for filtering */
  primaryCommodity: string;
  /** Acceptable aliases or sub-varieties in government feeds */
  aliases: string[];
}

export const CROP_COMMODITY_MAPPINGS: Record<Crop, CommodityMapping> = {
  "Paddy / Rice": {
    primaryCommodity: "Paddy(Dhan)(Common)",
    aliases: [
      "Paddy(Dhan)(Common)",
      "Paddy(Dhan)(Basmati)",
      "Paddy",
      "Rice",
      "Dhan",
    ],
  },
  Maize: {
    primaryCommodity: "Maize",
    aliases: ["Maize", "Makka", "Corn"],
  },
  Coconut: {
    primaryCommodity: "Coconut",
    aliases: ["Coconut", "Copra", "Tender Coconut"],
  },
  Arecanut: {
    primaryCommodity: "Arecanut(Betelnut/Supari)",
    aliases: [
      "Arecanut(Betelnut/Supari)",
      "Arecanut",
      "Betelnut",
      "Supari",
      "Chali",
    ],
  },
  Groundnut: {
    primaryCommodity: "Groundnut",
    aliases: [
      "Groundnut",
      "Groundnut (Split)",
      "Groundnut pods (raw)",
      "Peanut",
    ],
  },
  Chilli: {
    primaryCommodity: "Chilli Red",
    aliases: [
      "Chilli Red",
      "Green Chilli",
      "Chillies(Red)",
      "Chillies(Green)",
      "Dry Chillies",
    ],
  },
  Tomato: {
    primaryCommodity: "Tomato",
    aliases: ["Tomato", "Local Tomato", "Hybrid Tomato"],
  },
  Potato: {
    primaryCommodity: "Potato",
    aliases: ["Potato", "Jyoti", "Kufri"],
  },
  "Black Gram": {
    primaryCommodity: "Black Gram (Urd Beans)(Whole)",
    aliases: [
      "Black Gram (Urd Beans)(Whole)",
      "Black Gram",
      "Urad",
      "Urd Beans",
    ],
  },
  "Green Gram": {
    primaryCommodity: "Green Gram (Moong)(Whole)",
    aliases: [
      "Green Gram (Moong)(Whole)",
      "Green Gram",
      "Moong",
      "Mung Bean",
    ],
  },
};

/**
 * Checks if a Government commodity record matches an internal KisanSync crop.
 */
export function matchesCommodity(crop: Crop, govCommodity: string): boolean {
  if (!crop || !govCommodity) return false;
  const mapping = CROP_COMMODITY_MAPPINGS[crop];
  if (!mapping) return false;

  const normalizedGov = govCommodity.trim().toLowerCase();
  return mapping.aliases.some((alias) =>
    normalizedGov.includes(alias.toLowerCase()),
  );
}

/**
 * Returns the primary official query parameter for an internal crop.
 */
export function getPrimaryCommodityName(crop: Crop): string {
  return CROP_COMMODITY_MAPPINGS[crop]?.primaryCommodity ?? crop;
}
