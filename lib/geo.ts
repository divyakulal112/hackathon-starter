/**
 * KisanSync — Geographic distance and location utilities.
 *
 * Uses the Haversine formula for calculating spherical distance
 * between coordinates (latitude/longitude) in kilometers.
 * Pure mathematical functions — zero external dependencies.
 */

import type { Location } from "./types";

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @returns Distance in kilometers, rounded to 1 decimal place.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }

  // Identical point
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

/** Normalizes a string for search/lookup (lowercase, trimmed, stripped of special chars). */
export function normalizeLocationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Resolves a location name against the canonical dataset.
 * Supports exact match, normalized match, or partial prefix match.
 */
export function resolveLocation(
  query: string,
  locations: Location[],
): Location | null {
  if (!query || !query.trim()) return null;

  const cleanQuery = query.trim().toLowerCase();
  const normalizedQuery = normalizeLocationName(query);

  // 1. Exact name match (case-insensitive)
  const exact = locations.find(
    (l) => l.name.toLowerCase() === cleanQuery,
  );
  if (exact) return exact;

  // 2. Normalized name match
  const normMatch = locations.find(
    (l) => l.normalizedName === normalizedQuery,
  );
  if (normMatch) return normMatch;

  // 3. Prefix or contains match
  const containsMatch = locations.find(
    (l) =>
      cleanQuery.includes(l.name.toLowerCase()) ||
      l.name.toLowerCase().includes(cleanQuery) ||
      normalizedQuery.includes(l.normalizedName) ||
      l.normalizedName.includes(normalizedQuery),
  );
  if (containsMatch) return containsMatch;

  return null;
}
