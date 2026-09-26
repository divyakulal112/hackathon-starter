/**
 * KisanSync — GeoNames India Location Importer & Processor
 * =========================================================
 * 
 * Dataset Source:
 *   GeoNames India Gazetteer (IN.txt) from https://download.geonames.org/export/dump/
 * 
 * License & Attribution:
 *   GeoNames is licensed under a Creative Commons Attribution 4.0 License (CC-BY 4.0).
 *   This dataset provides geographical data for populated places (PPL, PPLA, PPLC, PPLX, etc.)
 *   across India.
 * 
 * Column Mapping (GeoNames Standard Tab-Separated Format):
 *   0: geonameid        - integer id of record in geonames database
 *   1: name             - name of geographical point (utf8) varchar(200)
 *   2: asciiname        - name of geographical point in plain ascii characters, varchar(200)
 *   3: alternatenames   - alternatenames, comma separated, ascii names (varchar(10000))
 *   4: latitude         - latitude in decimal degrees (wgs84)
 *   5: longitude        - longitude in decimal degrees (wgs84)
 *   6: feature class    - see http://www.geonames.org/export/codes.html, char(1)
 *   7: feature code     - see http://www.geonames.org/export/codes.html, varchar(10)
 *   8: country code     - ISO-3166 2-letter country code, 2 characters
 *   9: cc2              - alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
 *  10: admin1 code      - fipscode (subject to change to iso code), code for first administrative division, varchar(20)
 *  11: admin2 code      - code for the second administrative division, varchar(80)
 *  12: admin3 code      - code for third level administrative division, varchar(20)
 *  13: admin4 code      - code for fourth level administrative division, varchar(20)
 *  14: population       - bigint (8 byte int)
 *  15: elevation        - in meters, integer
 *  16: dem              - digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
 *  17: timezone         - the iana timezone id (see file timeZones.txt) varchar(40)
 *  18: modification date- date of last modification in yyyy-MM-dd format
 */

import { normalizeLocationName } from "../lib/geo";
import type { Location } from "../lib/types";

// ISO 3166-2 / FIPS code to Indian State Name Mapping
export const ADMIN1_TO_STATE: Record<string, string> = {
  "01": "Andhra Pradesh",
  "02": "Arunachal Pradesh",
  "03": "Assam",
  "04": "Bihar",
  "05": "Goa",
  "06": "Gujarat",
  "07": "Delhi",
  "09": "Haryana",
  "10": "Himachal Pradesh",
  "11": "Jammu and Kashmir",
  "12": "Kerala",
  "13": "Kerala",
  "14": "Madhya Pradesh",
  "15": "Maharashtra",
  "16": "Maharashtra",
  "17": "Manipur",
  "18": "Meghalaya",
  "19": "Karnataka",
  "20": "Nagaland",
  "21": "Odisha",
  "22": "Punjab",
  "23": "Rajasthan",
  "24": "Sikkim",
  "25": "Tamil Nadu",
  "26": "Tripura",
  "27": "Uttar Pradesh",
  "28": "West Bengal",
  "29": "Telangana",
  "30": "Jharkhand",
  "31": "Uttarakhand",
  "32": "Chhattisgarh",
  "33": "Chandigarh",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Dadra and Nagar Haveli and Daman and Diu",
  "37": "Ladakh",
  "38": "Lakshadweep",
};

export interface RawGeoNameRecord {
  geonameid: number;
  name: string;
  asciiname: string;
  alternatenames: string[];
  latitude: number;
  longitude: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  admin1Code: string;
  admin2Code: string;
  population: number;
}

/**
 * Parses a tab-delimited GeoNames text line into a typed record.
 */
export function parseGeoNamesLine(line: string): RawGeoNameRecord | null {
  const parts = line.split("\t");
  if (parts.length < 19) return null;

  const geonameid = parseInt(parts[0], 10);
  const name = parts[1].trim();
  const asciiname = parts[2].trim();
  const alternatenames = parts[3] ? parts[3].split(",").map((s) => s.trim()) : [];
  const latitude = parseFloat(parts[4]);
  const longitude = parseFloat(parts[5]);
  const featureClass = parts[6].trim();
  const featureCode = parts[7].trim();
  const countryCode = parts[8].trim();
  const admin1Code = parts[10].trim();
  const admin2Code = parts[11].trim();
  const population = parseInt(parts[14], 10) || 0;

  if (isNaN(latitude) || isNaN(longitude) || !name) {
    return null;
  }

  return {
    geonameid,
    name,
    asciiname,
    alternatenames,
    latitude,
    longitude,
    featureClass,
    featureCode,
    countryCode,
    admin1Code,
    admin2Code,
    population,
  };
}

/**
 * Converts a raw GeoNames record to a KisanSync Location entity.
 */
export function transformToKisanSyncLocation(raw: RawGeoNameRecord): Location {
  const state = ADMIN1_TO_STATE[raw.admin1Code] || "India";
  const district = raw.admin2Code ? raw.admin2Code : state;

  return {
    id: `geoname-${raw.geonameid}`,
    name: raw.name,
    normalizedName: normalizeLocationName(raw.name),
    district,
    state,
    latitude: Math.round(raw.latitude * 10000) / 10000,
    longitude: Math.round(raw.longitude * 10000) / 10000,
    source: "geonames",
    externalId: String(raw.geonameid),
    population: raw.population > 0 ? raw.population : undefined,
    featureClass: raw.featureClass,
    featureCode: raw.featureCode,
    countryCode: raw.countryCode,
  };
}

/**
 * Generates SQL batch upsert queries from an array of KisanSync locations.
 */
export function generateSqlUpsert(locations: Location[]): string {
  const values = locations.map((loc) => {
    const escName = loc.name.replace(/'/g, "''");
    const escNorm = loc.normalizedName.replace(/'/g, "''");
    const escDist = (loc.district || "").replace(/'/g, "''");
    const escState = (loc.state || "").replace(/'/g, "''");
    const escSrc = (loc.source || "geonames").replace(/'/g, "''");
    const extId = loc.externalId ? `'${loc.externalId.replace(/'/g, "''")}'` : "null";
    const pop = loc.population ? loc.population : "null";
    const fClass = loc.featureClass ? `'${loc.featureClass}'` : "null";
    const fCode = loc.featureCode ? `'${loc.featureCode}'` : "null";
    const cCode = loc.countryCode ? `'${loc.countryCode}'` : "'IN'";

    return `  ('${loc.id}', '${escName}', '${escNorm}', '${escDist}', '${escState}', ${loc.latitude}, ${loc.longitude}, ${cCode}, ${fClass}, ${fCode}, ${pop}, '${escSrc}', ${extId})`;
  });

  return `
-- Auto-generated by scripts/import_geonames.ts
-- Dataset: GeoNames India (CC-BY 4.0)
insert into public.locations (
  id, name, normalized_name, district, state, latitude, longitude,
  country_code, feature_class, feature_code, population, source, external_id
) values
${values.join(",\n")}
on conflict (id) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  district = excluded.district,
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  population = excluded.population,
  source = excluded.source,
  external_id = excluded.external_id;
`;
}
