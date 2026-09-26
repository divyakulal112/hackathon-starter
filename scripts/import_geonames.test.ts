import { describe, expect, it } from "vitest";
import {
  parseGeoNamesLine,
  transformToKisanSyncLocation,
  generateSqlUpsert,
  ADMIN1_TO_STATE,
} from "./import_geonames";

describe("GeoNames Importer", () => {
  const sampleLine =
    "1277333\tBengaluru\tBengaluru\tBangalore,Bengaluru,BLR\t12.97194\t77.59369\tP\tPPLA\tIN\t\t19\tBangalore Urban\t\t\t5104047\t914\t912\tAsia/Kolkata\t2023-08-01";

  it("correctly parses standard GeoNames tab-delimited record", () => {
    const record = parseGeoNamesLine(sampleLine);
    expect(record).not.toBeNull();
    expect(record?.geonameid).toBe(1277333);
    expect(record?.name).toBe("Bengaluru");
    expect(record?.latitude).toBeCloseTo(12.9719, 3);
    expect(record?.longitude).toBeCloseTo(77.5937, 3);
    expect(record?.countryCode).toBe("IN");
    expect(record?.admin1Code).toBe("19");
    expect(record?.population).toBe(5104047);
  });

  it("transforms raw record to KisanSync Location entity", () => {
    const record = parseGeoNamesLine(sampleLine)!;
    const location = transformToKisanSyncLocation(record);

    expect(location.id).toBe("geoname-1277333");
    expect(location.name).toBe("Bengaluru");
    expect(location.normalizedName).toBe("bengaluru");
    expect(location.state).toBe("Karnataka");
    expect(location.district).toBe("Bangalore Urban");
    expect(location.latitude).toBeCloseTo(12.9719, 3);
    expect(location.longitude).toBeCloseTo(77.5937, 3);
    expect(location.source).toBe("geonames");
    expect(location.countryCode).toBe("IN");
  });

  it("generates valid SQL upsert statements", () => {
    const record = parseGeoNamesLine(sampleLine)!;
    const location = transformToKisanSyncLocation(record);
    const sql = generateSqlUpsert([location]);

    expect(sql).toContain("insert into public.locations");
    expect(sql).toContain("geoname-1277333");
    expect(sql).toContain("Bengaluru");
    expect(sql).toContain("bengaluru");
    expect(sql).toContain("Karnataka");
    expect(sql).toContain("on conflict (id) do update set");
  });

  it("handles empty or corrupt lines gracefully", () => {
    expect(parseGeoNamesLine("")).toBeNull();
    expect(parseGeoNamesLine("invalid\tline")).toBeNull();
  });
});
