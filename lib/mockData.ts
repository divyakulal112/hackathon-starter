/**
 * KisanSync — demo/mock data.
 * Simulated operational data so the app works immediately, with or without Supabase.
 * Replace `MOCK_CENTRES` with a `centres` table fetch when Supabase is wired up.
 *
 * Centres are distributed across multiple regions (Bengaluru, Moodbidri,
 * Mangaluru, Karkala, Udupi, Belvai) with real approximate coordinates, so
 * distance-aware recommendations behave like the real product. Names are
 * clearly fictional demo procurement centres.
 */

import type { Appointment, Centre, Crop, Farmer, FarmerLocation } from "./types";
import { CROP_RATES_INR_PER_QUINTAL, DEMO_FARMER } from "./constants";

// ---------------------------------------------------------------------------
// Farmer-selectable locations (villages/towns/cities, approximate coords)
// The request form binds its location <select> to this list; the selected
// location's lat/lng feeds the engine's haversine distance calculation.
// ---------------------------------------------------------------------------

export const MOCK_LOCATIONS: FarmerLocation[] = [
  {
    id: "loc-belvai",
    name: "Belvai",
    district: "Moodbidri Taluk, Dakshina Kannada",
    latitude: 13.0092,
    longitude: 75.02,
  },
  {
    id: "loc-moodbidri",
    name: "Moodbidri",
    district: "Dakshina Kannada",
    latitude: 12.994,
    longitude: 74.993,
  },
  {
    id: "loc-mangaluru",
    name: "Mangaluru",
    district: "Dakshina Kannada",
    latitude: 12.9141,
    longitude: 74.856,
  },
  {
    id: "loc-karkala",
    name: "Karkala",
    district: "Udupi",
    latitude: 13.203,
    longitude: 74.999,
  },
  {
    id: "loc-udupi",
    name: "Udupi",
    district: "Udupi",
    latitude: 13.3409,
    longitude: 74.7421,
  },
  {
    id: "loc-bengaluru",
    name: "Bengaluru",
    district: "Bengaluru Urban",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: "loc-nelamangala",
    name: "Nelamangala",
    district: "Bengaluru Rural",
    latitude: 13.0992,
    longitude: 77.3979,
  },
];

/** Default demo farmer location (Belvai). */
export const DEFAULT_LOCATION_ID = "loc-belvai";

/** Looks up a farmer location by id — falls back to the demo default. */
export function getFarmerLocation(locationId: string): FarmerLocation {
  return (
    MOCK_LOCATIONS.find((l) => l.id === locationId) ??
    MOCK_LOCATIONS.find((l) => l.id === DEFAULT_LOCATION_ID) ??
    MOCK_LOCATIONS[0]
  );
}

// ---------------------------------------------------------------------------
// Centres (multi-region demo network — fictional but geographically realistic)
// ---------------------------------------------------------------------------

export const MOCK_CENTRES: Centre[] = [
  {
    id: "centre-bengaluru-apmc",
    name: "Yeshwanthpur APMC Yard",
    district: "Bengaluru Urban",
    latitude: 12.9899,
    longitude: 77.552,
    queueCount: 22,
    processingRatePerHour: 12,
    capacityPerDay: 220,
    bookedToday: 150,
    eligibleCrops: [
      "Paddy / Rice",
      "Maize",
      "Coconut",
      "Groundnut",
      "Chilli",
      "Tomato",
      "Potato",
      "Black Gram",
      "Green Gram",
    ],
    location: "Yeshwanthpur, Bengaluru",
    opensAt: "08:00",
    closesAt: "19:00",
  },
  {
    id: "centre-bidadi",
    name: "Bidadi Aggregation Centre",
    district: "Bengaluru Urban",
    latitude: 12.797,
    longitude: 77.358,
    queueCount: 8,
    processingRatePerHour: 6,
    capacityPerDay: 90,
    bookedToday: 47,
    eligibleCrops: ["Maize", "Tomato", "Potato", "Groundnut", "Chilli", "Green Gram"],
    location: "Bidadi, Bengaluru South",
    opensAt: "08:00",
    closesAt: "18:00",
  },
  {
    id: "centre-nelamangala",
    name: "Nelamangala FPO Collection Hub",
    district: "Bengaluru Rural",
    latitude: 13.0989,
    longitude: 77.396,
    queueCount: 6,
    processingRatePerHour: 5,
    capacityPerDay: 80,
    bookedToday: 41,
    eligibleCrops: ["Paddy / Rice", "Maize", "Groundnut", "Potato", "Tomato", "Green Gram"],
    location: "Nelamangala, Bengaluru Rural",
    opensAt: "08:30",
    closesAt: "18:00",
  },
  {
    id: "centre-moodbidri",
    name: "Moodbidri APMC",
    district: "Dakshina Kannada",
    latitude: 12.994,
    longitude: 74.993,
    queueCount: 14,
    processingRatePerHour: 6,
    capacityPerDay: 100,
    bookedToday: 68,
    eligibleCrops: ["Paddy / Rice", "Maize", "Coconut", "Groundnut", "Black Gram", "Green Gram"],
    location: "Moodbidri",
    opensAt: "08:00",
    closesAt: "19:00",
  },
  {
    id: "centre-belvai",
    name: "Belvai Agro Hub",
    district: "Dakshina Kannada",
    latitude: 13.0092,
    longitude: 75.02,
    queueCount: 21,
    processingRatePerHour: 4,
    capacityPerDay: 40,
    bookedToday: 36,
    eligibleCrops: ["Paddy / Rice", "Chilli", "Tomato", "Potato", "Black Gram", "Green Gram"],
    location: "Belvai",
    opensAt: "09:00",
    closesAt: "17:00",
  },
  {
    id: "centre-karkala",
    name: "Karkala Co-op",
    district: "Udupi",
    latitude: 13.203,
    longitude: 74.999,
    queueCount: 4,
    processingRatePerHour: 5,
    capacityPerDay: 60,
    bookedToday: 22,
    eligibleCrops: ["Paddy / Rice", "Maize", "Coconut", "Arecanut", "Black Gram", "Green Gram"],
    location: "Karkala",
    opensAt: "08:30",
    closesAt: "18:00",
  },
  {
    id: "centre-mangaluru",
    name: "Mangaluru Port Agro Terminal",
    district: "Dakshina Kannada",
    latitude: 12.874,
    longitude: 74.842,
    queueCount: 30,
    processingRatePerHour: 10,
    capacityPerDay: 180,
    bookedToday: 120,
    eligibleCrops: ["Paddy / Rice", "Coconut", "Arecanut", "Groundnut", "Chilli", "Potato"],
    location: "Bunder, Mangaluru",
    opensAt: "07:00",
    closesAt: "20:00",
  },
  {
    id: "centre-udupi",
    name: "Udupi Agri Service Co-op",
    district: "Udupi",
    latitude: 13.335,
    longitude: 74.748,
    queueCount: 9,
    processingRatePerHour: 7,
    capacityPerDay: 90,
    bookedToday: 52,
    eligibleCrops: ["Paddy / Rice", "Coconut", "Arecanut", "Black Gram", "Green Gram", "Groundnut"],
    location: "Udupi",
    opensAt: "08:00",
    closesAt: "18:30",
  },
];

export const DEMO_FARMER_PROFILE: Farmer = {
  id: DEMO_FARMER.id,
  name: DEMO_FARMER.name,
  village: DEMO_FARMER.village,
};

export const DEMO_CROPS: Crop[] = [
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

/** Other farmers already booked at centres today (centre dashboard queue). */
export const MOCK_APPOINTMENTS: Appointment[] = [
  seedAppointment("KS-101", "centre-moodbidri", "Moodbidri APMC", "Lakshmi Rai", "Paddy / Rice", 12, "slot_booked", 0),
  seedAppointment("KS-102", "centre-moodbidri", "Moodbidri APMC", "Suresh Shetty", "Coconut", 8, "arrived", 1),
  seedAppointment("KS-103", "centre-moodbidri", "Moodbidri APMC", "Ganesh Poojary", "Paddy / Rice", 20, "weighed", 2),
  seedAppointment("KS-105", "centre-karkala", "Karkala Co-op", "Vasanth Alva", "Arecanut", 6, "slot_booked", 0),
  seedAppointment("KS-106", "centre-karkala", "Karkala Co-op", "Prakash Nayak", "Paddy / Rice", 15, "slot_booked", 0),
  seedAppointment("KS-107", "centre-belvai", "Belvai Agro Hub", "Ravi Shetty", "Chilli", 10, "slot_booked", 0),
];

function seedAppointment(
  token: string,
  centreId: string,
  centreName: string,
  farmerName: string,
  crop: Crop,
  quantityQuintals: number,
  status: Appointment["status"],
  stageIndex: number,
): Appointment {
  const rate = CROP_RATES_INR_PER_QUINTAL[crop] ?? 2000;
  return {
    id: `apt-${token.toLowerCase()}`,
    tokenNumber: token,
    farmerId: `farmer-${token.toLowerCase()}`,
    farmerName,
    centreId,
    centreName,
    crop,
    quantityQuintals,
    village: "Moodbidri Taluk",
    arrivalWindow: "10:00 AM – 10:20 AM",
    bookedAt: new Date().toISOString(),
    status,
    stageIndex,
    estimatedAmountInr: rate * quantityQuintals,
  };
}
