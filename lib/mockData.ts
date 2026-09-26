/**
 * KisanSync — demo/mock data.
 * Simulated operational data so the app works immediately, with or without Supabase.
 * Replace `MOCK_CENTRES` with a `centres` table fetch when Supabase is wired up.
 */

import type { Appointment, Centre, Crop, Farmer } from "./types";
import { CROP_RATES_INR_PER_QUINTAL, DEMO_FARMER } from "./constants";

// ---------------------------------------------------------------------------
// Centres (realistic Dakshina Kannada district locations)
// ---------------------------------------------------------------------------

export const MOCK_CENTRES: Centre[] = [
  {
    id: "centre-moodbidri",
    name: "Moodbidri APMC",
    distanceKm: 8,
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
    id: "centre-karkala",
    name: "Karkala Co-op",
    distanceKm: 18,
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
    id: "centre-belvai",
    name: "Belvai Agro Hub",
    distanceKm: 4,
    queueCount: 21,
    processingRatePerHour: 4,
    capacityPerDay: 40,
    bookedToday: 36,
    eligibleCrops: ["Paddy / Rice", "Chilli", "Tomato", "Potato", "Black Gram", "Green Gram"],
    location: "Belvai",
    opensAt: "09:00",
    closesAt: "17:00",
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
