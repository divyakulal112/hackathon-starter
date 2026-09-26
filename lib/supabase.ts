/**
 * KisanSync — optional Supabase integration.
 *
 * The prototype runs entirely on mock data. If NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are present, this client can be used to read
 * from / write to the tables defined in supabase/schema.sql. Nothing in the
 * UI imports the client directly — a data layer will map these calls later,
 * so missing credentials never break the app.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Returns the Supabase client, or null when credentials are not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
