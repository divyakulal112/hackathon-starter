import { NextRequest, NextResponse } from "next/server";
import type { Crop } from "@/lib/types";
import type { MarketPriceRecord, MarketPriceResult } from "@/lib/marketPrices/types";
import { getPrimaryCommodityName } from "@/lib/marketPrices/cropMapping";
import { matchMarketPrice, parseNumericPrice } from "@/lib/marketPrices/marketMatcher";
import { AGMARKNET_BENCHMARK_RECORDS } from "@/lib/marketPrices/agmarknetSnapshot";

const DATA_GOV_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const DATA_GOV_BASE_URL = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`;

interface DataGovRawRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  grade?: string;
  arrival_date?: string;
  min_price?: string | number;
  max_price?: string | number;
  modal_price?: string | number;
}

interface DataGovApiResponse {
  records?: DataGovRawRecord[];
  error?: string;
  message?: string;
  status?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const crop = searchParams.get("crop") as Crop;
  const market = searchParams.get("market") || undefined;
  const district = searchParams.get("district") || undefined;
  const state = searchParams.get("state") || undefined;

  const now = Date.now();

  if (!crop) {
    return NextResponse.json(
      {
        status: "UNAVAILABLE",
        record: null,
        modalPrice: null,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        matchType: "UNAVAILABLE",
        isFallback: false,
        error: "Missing required query parameter: crop",
        fetchedAt: now,
      } as MarketPriceResult,
      { status: 400 },
    );
  }

  const apiKey = process.env.DATA_GOV_API_KEY;

  if (!apiKey) {
    const benchmarkResult = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
      crop,
      marketName: market,
      district,
      state: state || "Karnataka",
    });

    if (benchmarkResult.status === "AVAILABLE" && benchmarkResult.record) {
      return NextResponse.json(
        {
          ...benchmarkResult,
          status: "STALE",
          source: "AGMARKNET",
          isFallback: true,
          message:
            "Showing Government Mandi Benchmark (Agmarknet Snapshot). Add DATA_GOV_API_KEY to .env.local for live daily feed.",
        } as MarketPriceResult,
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: "UNAVAILABLE",
        record: null,
        modalPrice: null,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        matchType: "UNAVAILABLE",
        isFallback: false,
        message: "Market price is currently unavailable. Please try again later.",
        error: "DATA_GOV_API_KEY is not configured on the server.",
        fetchedAt: now,
      } as MarketPriceResult,
      { status: 200 },
    );
  }

  try {
    const primaryCommodity = getPrimaryCommodityName(crop);
    const targetUrl = new URL(DATA_GOV_BASE_URL);
    targetUrl.searchParams.set("api-key", apiKey);
    targetUrl.searchParams.set("format", "json");
    targetUrl.searchParams.set("limit", "100");

    // Server-side filter on commodity
    if (primaryCommodity) {
      targetUrl.searchParams.set("filters[commodity]", primaryCommodity);
    }
    if (state) {
      targetUrl.searchParams.set("filters[state]", state);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 1800 }, // 30 minutes cache
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const benchmarkResult = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
        crop,
        marketName: market,
        district,
        state: state || "Karnataka",
      });

      if (benchmarkResult.status === "AVAILABLE" && benchmarkResult.record) {
        return NextResponse.json(
          {
            ...benchmarkResult,
            status: "STALE",
            source: "AGMARKNET",
            isFallback: true,
            message:
              "Live Government API unavailable. Showing verified Government Agmarknet benchmark data.",
          } as MarketPriceResult,
          { status: 200 },
        );
      }

      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          status: "UNAVAILABLE",
          record: null,
          modalPrice: null,
          priceUnit: "₹/Quintal",
          source: "DATA_GOV_IN",
          matchType: "UNAVAILABLE",
          isFallback: false,
          message: "Market price is currently unavailable. Please try again later.",
          error: `Government API responded with status ${res.status}: ${errText.slice(0, 100)}`,
          fetchedAt: now,
        } as MarketPriceResult,
        { status: 200 },
      );
    }

    const data = (await res.json()) as DataGovApiResponse;

    if (data.error || !Array.isArray(data.records) || data.records.length === 0) {
      const benchmarkResult = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
        crop,
        marketName: market,
        district,
        state: state || "Karnataka",
      });

      if (benchmarkResult.status === "AVAILABLE" && benchmarkResult.record) {
        return NextResponse.json(
          {
            ...benchmarkResult,
            status: "STALE",
            source: "AGMARKNET",
            isFallback: true,
            message:
              "No live records found today. Showing verified Government Agmarknet benchmark data.",
          } as MarketPriceResult,
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          status: "UNAVAILABLE",
          record: null,
          modalPrice: null,
          priceUnit: "₹/Quintal",
          source: "DATA_GOV_IN",
          matchType: "UNAVAILABLE",
          isFallback: false,
          message: "Market price is currently unavailable. Please try again later.",
          error: data.error || "No government mandi records found for requested crop.",
          fetchedAt: now,
        } as MarketPriceResult,
        { status: 200 },
      );
    }

    const normalizedRecords: MarketPriceRecord[] = data.records.map((raw) => ({
      commodity: raw.commodity || "",
      variety: raw.variety,
      grade: raw.grade,
      state: raw.state || "",
      district: raw.district || "",
      market: raw.market || "",
      arrivalDate: raw.arrival_date || "",
      minPrice: parseNumericPrice(raw.min_price),
      maxPrice: parseNumericPrice(raw.max_price),
      modalPrice: parseNumericPrice(raw.modal_price),
      priceUnit: "₹/Quintal",
      source: "DATA_GOV_IN",
      fetchedAt: now,
    }));

    const result = matchMarketPrice(normalizedRecords, {
      crop,
      marketName: market,
      district,
      state,
    });

    if (result.status === "AVAILABLE") {
      return NextResponse.json(result);
    }

    // If live records didn't match the crop/district, check Agmarknet benchmark
    const benchmarkResult = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
      crop,
      marketName: market,
      district,
      state: state || "Karnataka",
    });

    if (benchmarkResult.status === "AVAILABLE" && benchmarkResult.record) {
      return NextResponse.json(
        {
          ...benchmarkResult,
          status: "STALE",
          source: "AGMARKNET",
          isFallback: true,
          message:
            "Showing verified Government Agmarknet benchmark data.",
        } as MarketPriceResult,
        { status: 200 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const benchmarkResult = matchMarketPrice(AGMARKNET_BENCHMARK_RECORDS, {
      crop,
      marketName: market,
      district,
      state: state || "Karnataka",
    });

    if (benchmarkResult.status === "AVAILABLE" && benchmarkResult.record) {
      return NextResponse.json(
        {
          ...benchmarkResult,
          status: "STALE",
          source: "AGMARKNET",
          isFallback: true,
          message:
            "Government API temporarily unreachable. Showing Government Agmarknet benchmark data.",
        } as MarketPriceResult,
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: "UNAVAILABLE",
        record: null,
        modalPrice: null,
        priceUnit: "₹/Quintal",
        source: "DATA_GOV_IN",
        matchType: "UNAVAILABLE",
        isFallback: false,
        message: "Market price is currently unavailable. Please try again later.",
        error: err instanceof Error ? err.message : "Unknown error connecting to Government data source",
        fetchedAt: now,
      } as MarketPriceResult,
      { status: 200 },
    );
  }
}
