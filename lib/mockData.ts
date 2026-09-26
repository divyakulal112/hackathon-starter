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

import type { Appointment, Centre, Crop, Farmer, Location, FarmerLocation } from "./types";
import { DEMO_FARMER } from "./constants";
import { VERIFIED_CENTRES } from "./data/centresData";

// ---------------------------------------------------------------------------
// Canonical Locations Dataset (Geocoded towns/villages)
// ---------------------------------------------------------------------------

export const LOCATIONS: Location[] = [
  {
    id: "loc-moodbidri",
    name: "Moodbidri",
    normalizedName: "moodbidri",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 13.0697,
    longitude: 74.9983,
  },
  {
    id: "loc-belvai",
    name: "Belvai",
    normalizedName: "belvai",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 13.1114,
    longitude: 75.0022,
  },
  {
    id: "loc-karkala",
    name: "Karkala",
    normalizedName: "karkala",
    district: "Udupi",
    state: "Karnataka",
    latitude: 13.2167,
    longitude: 74.9972,
  },
  {
    id: "loc-mangaluru",
    name: "Mangaluru",
    normalizedName: "mangaluru",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 12.9141,
    longitude: 74.856,
  },
  {
    id: "loc-udupi",
    name: "Udupi",
    normalizedName: "udupi",
    district: "Udupi",
    state: "Karnataka",
    latitude: 13.3409,
    longitude: 74.7421,
  },
  {
    id: "loc-kasaragod",
    name: "Kasaragod",
    normalizedName: "kasaragod",
    district: "Kasaragod",
    state: "Kerala",
    latitude: 12.4996,
    longitude: 74.9869,
  },
  {
    id: "loc-kozhikode",
    name: "Kozhikode",
    normalizedName: "kozhikode",
    district: "Kozhikode",
    state: "Kerala",
    latitude: 11.2588,
    longitude: 75.7804,
  },
  {
    id: "loc-bengaluru",
    name: "Bengaluru",
    normalizedName: "bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: "loc-bantwal",
    name: "Bantwal",
    normalizedName: "bantwal",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 12.8906,
    longitude: 75.0347,
  },
  {
    id: "loc-puttur",
    name: "Puttur",
    normalizedName: "puttur",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 12.7667,
    longitude: 75.2,
  },
  {
    id: "loc-sullia",
    name: "Sullia",
    normalizedName: "sullia",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 12.5667,
    longitude: 75.3833,
  },
  {
    id: "loc-kundapura",
    name: "Kundapura",
    normalizedName: "kundapura",
    district: "Udupi",
    state: "Karnataka",
    latitude: 13.6268,
    longitude: 74.6917,
  },
  {
    id: "loc-manipal",
    name: "Manipal",
    normalizedName: "manipal",
    district: "Udupi",
    state: "Karnataka",
    latitude: 13.3525,
    longitude: 74.7865,
  },
  {
    id: "loc-surathkal",
    name: "Surathkal",
    normalizedName: "surathkal",
    district: "Dakshina Kannada",
    state: "Karnataka",
    latitude: 13.0116,
    longitude: 74.7943,
  },
  {
    id: "loc-mysuru",
    name: "Mysuru",
    normalizedName: "mysuru",
    district: "Mysuru",
    state: "Karnataka",
    latitude: 12.2958,
    longitude: 76.6394,
  },
  {
    id: "loc-hassan",
    name: "Hassan",
    normalizedName: "hassan",
    district: "Hassan",
    state: "Karnataka",
    latitude: 13.0033,
    longitude: 76.1004,
  },
  {
    id: "loc-shivamogga",
    name: "Shivamogga",
    normalizedName: "shivamogga",
    district: "Shivamogga",
    state: "Karnataka",
    latitude: 13.9299,
    longitude: 75.5681,
  },
  {
    id: "loc-hyderabad",
    name: "Hyderabad",
    normalizedName: "hyderabad",
    district: "Hyderabad",
    state: "Telangana",
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    id: "loc-delhi",
    name: "Delhi",
    normalizedName: "delhi",
    district: "New Delhi",
    state: "Delhi",
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    id: "loc-mumbai",
    name: "Mumbai",
    normalizedName: "mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    id: "loc-chennai",
    name: "Chennai",
    normalizedName: "chennai",
    district: "Chennai",
    state: "Tamil Nadu",
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    id: "loc-kochi",
    name: "Kochi",
    normalizedName: "kochi",
    district: "Ernakulam",
    state: "Kerala",
    latitude: 9.9312,
    longitude: 76.2673,
  },
];

export const MOCK_LOCATIONS: Location[] = LOCATIONS;

/** Default demo farmer location (Moodbidri / Belvai). */
export const DEFAULT_LOCATION_ID = "loc-moodbidri";

/** Looks up a farmer location by id or name — falls back to the demo default. */
export function getFarmerLocation(locationIdOrName: string): Location {
  return (
    LOCATIONS.find(
      (l) =>
        l.id === locationIdOrName ||
        l.name.toLowerCase() === locationIdOrName.toLowerCase(),
    ) ??
    LOCATIONS.find((l) => l.id === DEFAULT_LOCATION_ID) ??
    LOCATIONS[0]
  );
}

// ---------------------------------------------------------------------------
// Centres (Master verified procurement centre dataset)
// ---------------------------------------------------------------------------

export const MOCK_CENTRES: Centre[] = VERIFIED_CENTRES;

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
  seedAppointment("KS-101", "centre-moodbidri", "Moodbidri APMC Sub-Yard", "Lakshmi Rai", "Paddy / Rice", 12, "slot_booked", 0),
  seedAppointment("KS-102", "centre-moodbidri", "Moodbidri APMC Sub-Yard", "Suresh Shetty", "Coconut", 8, "arrived", 1),
  seedAppointment("KS-103", "centre-moodbidri", "Moodbidri APMC Sub-Yard", "Ganesh Poojary", "Paddy / Rice", 20, "weighed", 2),
  seedAppointment("KS-105", "centre-karkala", "Karkala APMC Yard & Co-op", "Vasanth Alva", "Arecanut", 6, "slot_booked", 0),
  seedAppointment("KS-106", "centre-karkala", "Karkala APMC Yard & Co-op", "Prakash Nayak", "Paddy / Rice", 15, "slot_booked", 0),
  seedAppointment("KS-107", "centre-belvai", "Belvai Primary Agri Co-op", "Ravi Shetty", "Chilli", 10, "slot_booked", 0),
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
    estimatedAmountInr: null,
  };
}
