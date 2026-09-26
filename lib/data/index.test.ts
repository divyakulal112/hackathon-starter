/**
 * Unit tests for data-source selection (lib/data/index.ts).
 *
 * The selection rules under test:
 *   1. NEXT_PUBLIC_DATA_SOURCE="local" forces LocalStorageSource, even when
 *      Supabase credentials exist.
 *   2. No credentials → LocalStorageSource (the demo default).
 *   3. Credentials + no override → SupabaseSource.
 *   4. The chosen source is a per-module singleton.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted state read *inside* the vi.mock factories at import time — the
// module under test binds isSupabaseConfigured once, so each scenario
// re-imports a fresh module graph after setting this flag.
const mockState = vi.hoisted(() => ({ supabaseConfigured: false }));
const mockSources = vi.hoisted(() => ({
  local: vi.fn(),
  supabase: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mockState.supabaseConfigured;
  },
  getSupabase: () => null,
}));

vi.mock("./localStorageSource", () => ({
  LocalStorageSource: mockSources.local,
}));

vi.mock("./supabaseSource", () => ({
  SupabaseSource: mockSources.supabase,
}));

beforeEach(() => {
  mockSources.local.mockClear();
  mockSources.supabase.mockClear();
  delete process.env.NEXT_PUBLIC_DATA_SOURCE;
  mockState.supabaseConfigured = false;
});

afterEach(() => {
  vi.resetModules();
});

async function freshGetDataSource() {
  const mod = await import("./index");
  return mod.getDataSource;
}

describe("getDataSource", () => {
  it("falls back to LocalStorageSource when Supabase is not configured", async () => {
    const getDataSource = await freshGetDataSource();
    getDataSource();
    expect(mockSources.local).toHaveBeenCalledTimes(1);
    expect(mockSources.supabase).not.toHaveBeenCalled();
  });

  it("chooses SupabaseSource when configured and not overridden", async () => {
    mockState.supabaseConfigured = true;
    const getDataSource = await freshGetDataSource();
    getDataSource();
    expect(mockSources.supabase).toHaveBeenCalledTimes(1);
    expect(mockSources.local).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_DATA_SOURCE=local forces LocalStorageSource even with credentials", async () => {
    mockState.supabaseConfigured = true;
    process.env.NEXT_PUBLIC_DATA_SOURCE = "local";
    const getDataSource = await freshGetDataSource();
    getDataSource();
    expect(mockSources.local).toHaveBeenCalledTimes(1);
    expect(mockSources.supabase).not.toHaveBeenCalled();
  });

  it("is a per-module singleton: repeated calls reuse one source", async () => {
    const getDataSource = await freshGetDataSource();
    getDataSource();
    getDataSource();
    getDataSource();
    expect(mockSources.local).toHaveBeenCalledTimes(1);
  });
});
