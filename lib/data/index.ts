/**
 * KisanSync — data-source selection.
 *
 * Chooses between the LocalStorage source (default, the original demo) and the
 * Supabase source. Supabase is used only when all of these hold:
 *   1. NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 *   2. NEXT_PUBLIC_DATA_SOURCE is not explicitly "local".
 *   3. Window exists (client-side only — this module is imported by
 *      "use client" code after mount).
 *
 * The seam keeps the recommendation engine and every UI component free of
 * Supabase imports (approved plan).
 */

import { isSupabaseConfigured } from "@/lib/supabase";
import { LocalStorageSource } from "./localStorageSource";
import { SupabaseSource } from "./supabaseSource";
import type { DataSource } from "./types";

export type { DataSource, AppStateSnapshot, DataSourceKind } from "./types";

function resolveDataSource(): DataSource {
  const forced =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DATA_SOURCE : undefined;

  if (forced === "local") return new LocalStorageSource();
  if (isSupabaseConfigured) return new SupabaseSource();
  return new LocalStorageSource();
}

let instance: DataSource | null = null;

/** Process-wide singleton — one source per browser session. */
export function getDataSource(): DataSource {
  if (!instance) instance = resolveDataSource();
  return instance;
}
